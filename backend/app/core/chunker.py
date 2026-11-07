"""
DevLens AI — AST-Aware Code Chunker
Splits source files into semantically meaningful chunks for embedding.

Strategy by language:
  Python     → ast module: chunk per function/class definition
  JS/TS      → tree-sitter: chunk per function/class declaration
  Everything → sliding window with overlap (utils/token_counter.py)

Each chunk preserves: file path, language, symbol name, line range, type.
This metadata powers the "show me where X is defined" feature.
"""

import ast
import re
import structlog
from dataclasses import dataclass, field

from app.core.language_detector import is_ast_supported
from app.utils.token_counter import split_by_token_budget, estimate_tokens

logger = structlog.get_logger(__name__)

MAX_CHUNK_TOKENS = 512    # Target max tokens per chunk
OVERLAP_TOKENS   = 64     # Token overlap between sliding window chunks


@dataclass
class Chunk:
    """A single chunk ready for embedding."""
    file_path: str
    language: str
    chunk_index: int
    content: str
    token_count: int
    chunk_type: str = "generic"      # 'function' | 'class' | 'module' | 'generic'
    symbol_name: str | None = None   # Function or class name
    start_line: int | None = None
    end_line: int | None = None


def chunk_file(
    file_path: str,
    content: str,
    language: str,
) -> list[Chunk]:
    """
    Main entry point. Routes to the appropriate chunking strategy
    based on language. Returns a list of Chunk objects.
    """
    if not content.strip():
        return []

    try:
        if language == "Python":
            chunks = _chunk_python(file_path, content)
        elif language in ("JavaScript", "TypeScript"):
            chunks = _chunk_js_ts(file_path, content, language)
        else:
            chunks = _chunk_generic(file_path, content, language)
    except Exception as exc:
        # Chunking failed (parse error) — fall back to generic sliding window
        logger.warning(
            "chunking_fallback",
            path=file_path,
            language=language,
            error=str(exc),
        )
        chunks = _chunk_generic(file_path, content, language)

    return chunks


# ── Python AST Chunker ────────────────────────────────────────────────────

def _chunk_python(file_path: str, content: str) -> list[Chunk]:
    """
    Parse Python source with the ast module.
    Each top-level function and class becomes its own chunk.
    Module-level code (imports, globals) is a single 'module' chunk.
    """
    tree = ast.parse(content)
    lines = content.splitlines()
    chunks: list[Chunk] = []
    covered_lines: set[int] = set()

    idx = 0
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue

        start = node.lineno - 1
        end = node.end_lineno or (start + 1)
        node_lines = lines[start:end]
        node_content = "\n".join(node_lines)

        chunk_type = "class" if isinstance(node, ast.ClassDef) else "function"
        symbol = node.name

        # Add docstring context header
        header = f"# File: {file_path}\n# {chunk_type.title()}: {symbol}\n\n"
        full_content = header + node_content

        chunks.append(Chunk(
            file_path=file_path,
            language="Python",
            chunk_index=idx,
            content=full_content,
            token_count=estimate_tokens(full_content),
            chunk_type=chunk_type,
            symbol_name=symbol,
            start_line=start + 1,
            end_line=end,
        ))
        covered_lines.update(range(start, end))
        idx += 1

    # Collect uncovered lines (imports, globals) as a 'module' chunk
    uncovered = [
        line for i, line in enumerate(lines)
        if i not in covered_lines
    ]
    module_content = "\n".join(uncovered).strip()
    if module_content:
        header = f"# File: {file_path}\n# Module-level code\n\n"
        full = header + module_content
        chunks.insert(0, Chunk(
            file_path=file_path,
            language="Python",
            chunk_index=idx,
            content=full,
            token_count=estimate_tokens(full),
            chunk_type="module",
            start_line=1,
        ))

    # Re-index after insert
    for i, c in enumerate(chunks):
        c.chunk_index = i

    return chunks


# ── JS/TS Chunker (regex-based, tree-sitter optional) ─────────────────────

def _chunk_js_ts(file_path: str, content: str, language: str) -> list[Chunk]:
    """
    Chunk JavaScript/TypeScript by function/class boundaries using regex.
    Preserves exact whitespace and original line separators across chunks so
    reassembly yields 100% exact equality with the original source file.
    """
    lines = content.splitlines(keepends=True)
    if not lines:
        return []

    # Patterns to detect function/class start lines
    func_pattern = re.compile(
        r"^(?:export\s+)?(?:async\s+)?function\s+(\w+)|"  # function foo
        r"^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(",  # const foo = (
        re.MULTILINE,
    )
    class_pattern = re.compile(
        r"^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)",
        re.MULTILINE,
    )

    def find_block_end(start_line: int) -> int:
        """Find the closing brace for a block starting at start_line."""
        depth = 0
        opened = False
        for i in range(start_line, len(lines)):
            line = lines[i]
            open_count = line.count("{")
            close_count = line.count("}")
            if open_count > 0:
                opened = True
            depth += open_count - close_count
            if opened and depth <= 0 and i >= start_line:
                return i
        return len(lines) - 1

    boundaries: list[tuple[int, str, str]] = []  # (line_idx, symbol, type)

    for match in func_pattern.finditer(content):
        symbol = match.group(1) or match.group(2) or "anonymous"
        line_no = content[:match.start()].count("\n")
        boundaries.append((line_no, symbol, "function"))

    for match in class_pattern.finditer(content):
        symbol = match.group(1)
        line_no = content[:match.start()].count("\n")
        boundaries.append((line_no, symbol, "class"))

    boundaries.sort(key=lambda x: x[0])

    if not boundaries:
        return _chunk_generic(file_path, content, language)

    # Filter nested declarations and determine top-level spans
    spans: list[tuple[int, int, str, str]] = []
    curr_end = -1
    for start_line, symbol, chunk_type in boundaries:
        if start_line <= curr_end:
            continue
        end_line = find_block_end(start_line)
        curr_end = end_line
        spans.append((start_line, end_line, symbol, chunk_type))

    chunks: list[Chunk] = []
    idx = 0

    # If there are lines before the first top-level symbol (e.g. imports), preserve as module chunk
    if spans and spans[0][0] > 0:
        pre_content = "".join(lines[:spans[0][0]])
        header = f"// File: {file_path}\n// Module: imports\n\n"
        full = header + pre_content
        chunks.append(Chunk(
            file_path=file_path,
            language=language,
            chunk_index=idx,
            content=full,
            token_count=estimate_tokens(full),
            chunk_type="module",
            symbol_name="module",
            start_line=1,
            end_line=spans[0][0],
        ))
        idx += 1

    # Contiguously partition all lines to preserve original separators
    for s_idx, (s_line, e_line, sym, ctype) in enumerate(spans):
        next_s = spans[s_idx + 1][0] if s_idx + 1 < len(spans) else len(lines)
        chunk_body = "".join(lines[s_line:next_s])
        header = f"// File: {file_path}\n// {ctype.title()}: {sym}\n\n"
        full = header + chunk_body
        chunks.append(Chunk(
            file_path=file_path,
            language=language,
            chunk_index=idx,
            content=full,
            token_count=estimate_tokens(full),
            chunk_type=ctype,
            symbol_name=sym,
            start_line=s_line + 1,
            end_line=min(e_line + 1, len(lines)),
        ))
        idx += 1

    return chunks if chunks else _chunk_generic(file_path, content, language)


# ── Generic Sliding Window Chunker ────────────────────────────────────────

def _chunk_generic(file_path: str, content: str, language: str) -> list[Chunk]:
    """
    Fallback: sliding window with overlap for unsupported languages.
    Used for: Go, Rust, Java, SQL, YAML, Markdown, etc.
    """
    header = f"# File: {file_path}\n\n"
    raw_chunks = split_by_token_budget(content, MAX_CHUNK_TOKENS, OVERLAP_TOKENS)

    return [
        Chunk(
            file_path=file_path,
            language=language,
            chunk_index=i,
            content=header + chunk,
            token_count=estimate_tokens(header + chunk),
            chunk_type="generic",
        )
        for i, chunk in enumerate(raw_chunks)
    ]

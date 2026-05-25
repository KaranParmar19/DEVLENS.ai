"""
DevLens AI — Token Counter Utility
Rough token estimation without requiring a tokenizer dependency.
Used to enforce chunk size budgets during ingestion.
"""


def estimate_tokens(text: str) -> int:
    """
    Rough token estimate: ~4 characters per token (OpenAI rule of thumb).
    Good enough for chunking decisions without paying tiktoken overhead.
    For precise counts, use tiktoken — but this is 10x faster.
    """
    return max(1, len(text) // 4)


def fits_in_budget(text: str, max_tokens: int = 512) -> bool:
    """Returns True if the text fits within the token budget."""
    return estimate_tokens(text) <= max_tokens


def split_by_token_budget(
    text: str, max_tokens: int = 512, overlap_tokens: int = 50
) -> list[str]:
    """
    Naive sliding-window text splitter for languages without AST support.
    Splits on newlines, respects overlap between chunks for context continuity.
    """
    max_chars = max_tokens * 4
    overlap_chars = overlap_tokens * 4
    chunks: list[str] = []

    lines = text.splitlines(keepends=True)
    current_chunk: list[str] = []
    current_size = 0

    for line in lines:
        line_size = len(line)
        if current_size + line_size > max_chars and current_chunk:
            chunks.append("".join(current_chunk))
            # Keep last `overlap_chars` worth of content for context
            overlap_content = "".join(current_chunk)[-overlap_chars:]
            current_chunk = [overlap_content]
            current_size = len(overlap_content)
        current_chunk.append(line)
        current_size += line_size

    if current_chunk:
        chunks.append("".join(current_chunk))

    return chunks

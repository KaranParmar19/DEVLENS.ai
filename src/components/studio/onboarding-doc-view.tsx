import React, { useState, useMemo, useRef, useCallback } from "react";
import type { GraphData } from "./studio-types";
import { MermaidDiagramCard } from "./mermaid-diagram";

export interface OnboardingDocViewProps {
  repoLabel: string;
  markdownContent?: string;
  graphData?: GraphData | null;
  onSelectFile?: (path: string) => void;
  onAskCopilot?: (prompt: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  theme?: "dark" | "light";
}

interface HeadingItem {
  id: string;
  level: 2 | 3;
  title: string;
}

interface HeroSplitData {
  headingTitle: string;
  headingId: string;
  mermaidCode: string;
  proseMarkdown: string;
  restMarkdown: string;
}

function slugifyHeading(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `wiki-${base || "section"}-${index}`;
}

export function extractHeadings(rawMd: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const lines = rawMd.split("\n");
  let inFence = false;
  let idx = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (trimmed.startsWith("## ")) {
      const title = trimmed.replace(/^##\s+/, "").trim();
      headings.push({ id: slugifyHeading(title, idx++), level: 2, title });
    } else if (trimmed.startsWith("### ")) {
      const title = trimmed.replace(/^###\s+/, "").trim();
      headings.push({ id: slugifyHeading(title, idx++), level: 3, title });
    }
  }
  return headings;
}

/**
 * Splits out Section 1 when it begins with a Mermaid diagram + narrative overview
 * so it can render as a balanced two-column Hero Split (diagram left, overview right).
 */
export function extractHeroSplit(rawMd: string): HeroSplitData | null {
  const lines = rawMd.split("\n");
  let sec1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      sec1Idx = i;
      break;
    }
  }
  if (sec1Idx === -1) return null;

  let nextSecIdx = lines.length;
  for (let i = sec1Idx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      nextSecIdx = i;
      break;
    }
  }

  const sec1Lines = lines.slice(sec1Idx + 1, nextSecIdx);
  let fenceStart = -1;
  let fenceEnd = -1;
  for (let i = 0; i < sec1Lines.length; i++) {
    const t = sec1Lines[i].trim();
    if (fenceStart === -1 && t.startsWith("```mermaid")) {
      fenceStart = i;
    } else if (fenceStart !== -1 && t.startsWith("```")) {
      fenceEnd = i;
      break;
    }
  }
  if (fenceStart === -1 || fenceEnd === -1) return null;

  const mermaidCode = sec1Lines
    .slice(fenceStart + 1, fenceEnd)
    .join("\n")
    .trim();
  const proseLines = [...sec1Lines.slice(0, fenceStart), ...sec1Lines.slice(fenceEnd + 1)];
  const proseMarkdown = proseLines.join("\n").trim();
  if (!mermaidCode || !proseMarkdown) return null;

  const headingTitle = lines[sec1Idx]
    .trim()
    .replace(/^##\s+/, "")
    .trim();
  const restMarkdown = lines.slice(nextSecIdx).join("\n");

  return {
    headingTitle,
    headingId: slugifyHeading(headingTitle, 0),
    mermaidCode,
    proseMarkdown,
    restMarkdown,
  };
}

export function OnboardingDocView({
  repoLabel,
  markdownContent,
  graphData,
  onSelectFile,
  onAskCopilot,
  isLoading = false,
  error = null,
  onRetry,
  theme = "dark",
}: OnboardingDocViewProps) {
  const [copied, setCopied] = useState(false);
  const [copiedBlockKey, setCopiedBlockKey] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLight = theme === "light";

  const knownPaths = useMemo(() => {
    const set = new Set<string>();
    if (graphData?.nodes) {
      for (const n of graphData.nodes) {
        if (n.path) set.add(n.path);
      }
    }
    return set;
  }, [graphData]);

  const handleCopy = useCallback(() => {
    if (!markdownContent) return;
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdownContent]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!markdownContent) return;
    const safeName = repoLabel.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}-CODE_WIKI.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdownContent, repoLabel]);

  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Theme tokens verified for >= 4.5:1 contrast in both light and dark themes
  const bgPage = isLight ? "#fbfbfe" : "#08080a";
  const bgCard = isLight ? "#f4f4f7" : "#111116";
  const textPrimary = isLight ? "#09090b" : "#f4f4f5";
  const textBody = isLight ? "#27272a" : "#d4d4d8";
  const textMuted = isLight ? "#52525b" : "#a1a1aa";
  const borderLine = isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.11)";
  const accentLink = isLight ? "#1d4ed8" : "#60a5fa";

  // Helper to parse [[path]], [label](target), **bold**, `code`, and *italic*
  const renderFormattedInline = (text: string): React.ReactNode[] => {
    const tokenRegex =
      /(\[\[[a-zA-Z0-9_./\\-]+(?::[0-9-]+)?\]\]|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIdx = 0;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const token = match[0];

      if (token.startsWith("[[") && token.endsWith("]]")) {
        const rawContent = token.slice(2, -2);
        const [filePath, lineRange] = rawContent.split(":");
        const fileName = filePath.split("/").pop() || filePath;
        const displayLabel = lineRange ? `${fileName}:${lineRange}` : fileName;

        parts.push(
          <button
            key={`chip-${keyIdx++}`}
            type="button"
            onClick={() => onSelectFile?.(filePath)}
            disabled={!onSelectFile}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "1px 7px",
              margin: "0 2px",
              borderRadius: 4,
              background: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)",
              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.16)" : "rgba(255, 255, 255, 0.18)"}`,
              color: textPrimary,
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              cursor: onSelectFile ? "pointer" : "default",
              verticalAlign: "baseline",
            }}
            title={onSelectFile ? `Inspect ${filePath}` : filePath}
          >
            <span aria-hidden="true" style={{ opacity: 0.6 }}>
              /
            </span>
            <span>{displayLabel}</span>
          </button>,
        );
      } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
        const closeBracket = token.indexOf("](");
        const label = token.slice(1, closeBracket);
        const target = token.slice(closeBracket + 2, -1).trim();
        const isExternal = target.startsWith("http://") || target.startsWith("https://");

        if (isExternal) {
          parts.push(
            <a
              key={`ext-${keyIdx++}`}
              href={target}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: accentLink,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {label}
            </a>,
          );
        } else {
          const cleanTarget = target.replace(/^#/, "");
          const isRepoFile = knownPaths.has(target) || target.includes("/") || target.includes(".");
          if (isRepoFile && onSelectFile) {
            parts.push(
              <button
                key={`ref-${keyIdx++}`}
                type="button"
                onClick={() => onSelectFile(target)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  color: accentLink,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  font: "inherit",
                  cursor: "pointer",
                }}
                title={`Inspect ${target}`}
              >
                {label}
              </button>,
            );
          } else {
            parts.push(
              <a
                key={`anchor-${keyIdx++}`}
                href={`#${cleanTarget}`}
                style={{
                  color: accentLink,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {label}
              </a>,
            );
          }
        }
      } else if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={`b-${keyIdx++}`} style={{ fontWeight: 600, color: textPrimary }}>
            {token.slice(2, -2)}
          </strong>,
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={`c-${keyIdx++}`}
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.8125rem",
              background: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.09)",
              padding: "2px 6px",
              borderRadius: 4,
              color: textPrimary,
            }}
          >
            {token.slice(1, -1)}
          </code>,
        );
      } else if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(<em key={`i-${keyIdx++}`}>{token.slice(1, -1)}</em>);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const renderMarkdownBlocks = (
    rawMd: string,
    headingIdMap?: Map<string, string>,
    skipFirstH1 = false,
    startHeadingIndex = 0,
  ) => {
    const lines = rawMd.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;
    let blockKey = 0;
    let headingCursor = startHeadingIndex;
    let skippedH1 = false;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(trimmed)) {
        elements.push(
          <hr
            key={`hr-${blockKey++}`}
            style={{
              border: "none",
              borderTop: `1px solid ${borderLine}`,
              margin: "28px 0",
            }}
          />,
        );
        i++;
        continue;
      }

      // 1. Code Fence Block (```mermaid or ```lang)
      if (trimmed.startsWith("```")) {
        const lang = trimmed.replace(/^```/, "").trim().toLowerCase();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith("```")) {
          i++;
        }

        const codeText = codeLines.join("\n");
        if (lang === "mermaid") {
          const firstLine = codeText.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
          let diagramTitle = "Architecture Diagram";
          if (firstLine.startsWith("erdiagram")) {
            diagramTitle = "Entity-Relationship Diagram";
          } else if (firstLine.startsWith("sequencediagram")) {
            diagramTitle = "Sequence Diagram";
          } else if (firstLine.startsWith("statediagram")) {
            diagramTitle = "State Diagram";
          } else if (firstLine.startsWith("classdiagram")) {
            diagramTitle = "Class Diagram";
          }
          elements.push(
            <div key={`mmd-${blockKey++}`} style={{ margin: "20px 0" }}>
              <MermaidDiagramCard chart={codeText} title={diagramTitle} theme={theme} />
            </div>,
          );
          continue;
        }

        const thisBlockId = `code-${blockKey++}`;
        elements.push(
          <div key={thisBlockId} style={{ margin: "16px 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  color: textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {lang || "code"}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(codeText);
                  setCopiedBlockKey(thisBlockId);
                  setTimeout(() => setCopiedBlockKey(null), 1500);
                }}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: "transparent",
                  color: textMuted,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  cursor: "pointer",
                }}
              >
                {copiedBlockKey === thisBlockId ? "Copied" : "Copy"}
              </button>
            </div>
            <pre
              className="devlens-scroll"
              style={{
                background: bgCard,
                border: `1px solid ${borderLine}`,
                borderRadius: 8,
                padding: "14px 18px",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.8125rem",
                lineHeight: 1.6,
                color: textPrimary,
                overflowX: "auto",
                margin: 0,
              }}
            >
              <code>{codeText}</code>
            </pre>
          </div>,
        );
        continue;
      }

      // 2. Headings
      if (trimmed.startsWith("# ")) {
        if (skipFirstH1 && !skippedH1) {
          skippedH1 = true;
          i++;
          continue;
        }
        elements.push(
          <h1
            key={`h1-${blockKey++}`}
            style={{
              fontSize: "clamp(1.75rem, 3.2vw, 2.25rem)",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              margin: "12px 0 18px",
              color: textPrimary,
              lineHeight: 1.2,
            }}
          >
            {renderFormattedInline(trimmed.replace(/^#\s+/, ""))}
          </h1>,
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("## ")) {
        const headingTitle = trimmed.replace(/^##\s+/, "").trim();
        const headingId =
          headingIdMap?.get(`h2:${headingCursor}:${headingTitle}`) ??
          slugifyHeading(headingTitle, headingCursor);
        headingCursor++;

        elements.push(
          <div
            key={`h2-wrap-${blockKey++}`}
            id={headingId}
            style={{
              margin: "36px 0 14px",
              borderTop: `1px solid ${borderLine}`,
              paddingTop: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              scrollMarginTop: 24,
            }}
          >
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: 0,
                color: textPrimary,
              }}
            >
              {renderFormattedInline(headingTitle)}
            </h2>
            {onAskCopilot && (
              <button
                type="button"
                onClick={() =>
                  onAskCopilot(
                    `Explain the "${headingTitle}" section of ${repoLabel} in detail, including the key modules, execution path, and files to verify.`,
                  )
                }
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: "transparent",
                  color: textMuted,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Ask Copilot
              </button>
            )}
          </div>,
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("### ")) {
        const headingTitle = trimmed.replace(/^###\s+/, "").trim();
        const headingId =
          headingIdMap?.get(`h3:${headingCursor}:${headingTitle}`) ??
          slugifyHeading(headingTitle, headingCursor);
        headingCursor++;

        elements.push(
          <div
            key={`h3-wrap-${blockKey++}`}
            id={headingId}
            style={{
              margin: "24px 0 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              scrollMarginTop: 24,
            }}
          >
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 600,
                letterSpacing: "-0.015em",
                margin: 0,
                color: textPrimary,
              }}
            >
              {renderFormattedInline(headingTitle)}
            </h3>
            {onAskCopilot && (
              <button
                type="button"
                onClick={() =>
                  onAskCopilot(
                    `Walk me through "${headingTitle}" in ${repoLabel} with exact file references and symbol names.`,
                  )
                }
                style={{
                  padding: "3px 9px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: "transparent",
                  color: textMuted,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  cursor: "pointer",
                }}
              >
                Ask Copilot
              </button>
            )}
          </div>,
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("#### ")) {
        elements.push(
          <h4
            key={`h4-${blockKey++}`}
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              margin: "16px 0 6px",
              color: textPrimary,
            }}
          >
            {renderFormattedInline(trimmed.replace(/^####\s+/, ""))}
          </h4>,
        );
        i++;
        continue;
      }

      // 3. Markdown Table
      if (trimmed.startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i].trim());
          i++;
        }
        const parseRow = (rowStr: string) =>
          rowStr
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        const hasSeparator = tableLines.length > 1 && /^[\s|:-]+$/.test(tableLines[1]);
        const rows = tableLines.slice(hasSeparator ? 2 : 1).map(parseRow);

        elements.push(
          <div
            key={`tbl-${blockKey++}`}
            className="devlens-scroll"
            style={{
              margin: "16px 0",
              overflowX: "auto",
              border: `1px solid ${borderLine}`,
              borderRadius: 8,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: bgCard, borderBottom: `1px solid ${borderLine}` }}>
                  {headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={{
                        padding: "10px 14px",
                        fontWeight: 600,
                        color: textPrimary,
                      }}
                    >
                      {renderFormattedInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: rIdx < rows.length - 1 ? `1px solid ${borderLine}` : "none",
                    }}
                  >
                    {r.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: "10px 14px",
                          color: textBody,
                          verticalAlign: "top",
                        }}
                      >
                        {renderFormattedInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }

      // 4. Blockquotes and GitHub Alerts (> [!NOTE], > [!CAUTION])
      if (trimmed.startsWith(">")) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          quoteLines.push(lines[i].trim().replace(/^>\s*/, ""));
          i++;
        }
        const first = quoteLines[0] || "";
        const isCaution = first.startsWith("[!CAUTION]") || first.startsWith("[!WARNING]");
        const isNote = first.startsWith("[!NOTE]") || first.startsWith("[!IMPORTANT]");

        if (isCaution || isNote) {
          const alertBody = quoteLines.slice(1).join("\n");
          elements.push(
            <div
              key={`alert-${blockKey++}`}
              style={{
                margin: "18px 0",
                padding: "14px 18px",
                borderRadius: 8,
                background: isCaution
                  ? isLight
                    ? "rgba(220, 38, 38, 0.06)"
                    : "rgba(239, 68, 68, 0.08)"
                  : bgCard,
                border: `1px solid ${
                  isCaution
                    ? isLight
                      ? "rgba(220, 38, 38, 0.35)"
                      : "rgba(248, 113, 113, 0.35)"
                    : borderLine
                }`,
                fontSize: "0.875rem",
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: isCaution ? (isLight ? "#b91c1c" : "#fca5a5") : textMuted,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                {isCaution ? "CAUTION: RISK NOTICE" : "NOTE: ARCHITECTURE INVARIANT"}
              </div>
              <div style={{ color: isCaution ? (isLight ? "#7f1d1d" : "#fecaca") : textBody }}>
                {renderFormattedInline(alertBody)}
              </div>
            </div>,
          );
        } else {
          elements.push(
            <blockquote
              key={`quote-${blockKey++}`}
              style={{
                margin: "14px 0",
                paddingLeft: 16,
                borderLeft: `3px solid ${borderLine}`,
                color: textMuted,
                fontStyle: "italic",
              }}
            >
              {renderFormattedInline(quoteLines.join("\n"))}
            </blockquote>,
          );
        }
        continue;
      }

      // 5. Unordered Lists (- or *)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const listItems: string[] = [];
        while (
          i < lines.length &&
          (lines[i].trim().startsWith("- ") ||
            lines[i].trim().startsWith("* ") ||
            (listItems.length > 0 && lines[i].startsWith("  ")))
        ) {
          if (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* ")) {
            listItems.push(lines[i].trim().replace(/^[-*]\s+/, ""));
          } else {
            listItems[listItems.length - 1] += " " + lines[i].trim();
          }
          i++;
        }
        elements.push(
          <ul
            key={`ul-${blockKey++}`}
            style={{
              margin: "10px 0 18px 0",
              paddingLeft: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              listStyleType: "disc",
            }}
          >
            {listItems.map((item, idx) => (
              <li
                key={idx}
                style={{
                  lineHeight: 1.65,
                  color: textBody,
                }}
              >
                {renderFormattedInline(item)}
              </li>
            ))}
          </ul>,
        );
        continue;
      }

      // 6. Ordered Lists (1., 2.)
      if (/^\d+\.\s+/.test(trimmed)) {
        const listItems: string[] = [];
        while (
          i < lines.length &&
          (/^\d+\.\s+/.test(lines[i].trim()) || (listItems.length > 0 && lines[i].startsWith("  ")))
        ) {
          if (/^\d+\.\s+/.test(lines[i].trim())) {
            listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
          } else {
            listItems[listItems.length - 1] += " " + lines[i].trim();
          }
          i++;
        }
        elements.push(
          <ol
            key={`ol-${blockKey++}`}
            style={{
              margin: "10px 0 18px 0",
              paddingLeft: 22,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {listItems.map((item, idx) => (
              <li
                key={idx}
                style={{
                  lineHeight: 1.65,
                  color: textBody,
                }}
              >
                {renderFormattedInline(item)}
              </li>
            ))}
          </ol>,
        );
        continue;
      }

      // 7. Regular Paragraph
      const pLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith("#") &&
        !lines[i].trim().startsWith("```") &&
        !lines[i].trim().startsWith(">") &&
        !lines[i].trim().startsWith("- ") &&
        !lines[i].trim().startsWith("* ") &&
        !/^---+$/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim())
      ) {
        pLines.push(lines[i].trim());
        i++;
      }
      elements.push(
        <p
          key={`p-${blockKey++}`}
          style={{
            margin: "0 0 16px",
            lineHeight: 1.72,
            color: textBody,
            maxWidth: "74ch",
          }}
        >
          {renderFormattedInline(pLines.join(" "))}
        </p>,
      );
    }

    return elements;
  };

  const hasContent = Boolean(markdownContent && markdownContent.trim());
  const headings = useMemo(
    () => (markdownContent ? extractHeadings(markdownContent) : []),
    [markdownContent],
  );
  const heroSplit = useMemo(
    () => (markdownContent ? extractHeroSplit(markdownContent) : null),
    [markdownContent],
  );

  // Extract top H1 title if present
  const docTitle = useMemo(() => {
    if (!markdownContent) return `${repoLabel}: Code Wiki`;
    const firstH1 = markdownContent.split("\n").find((l) => l.trim().startsWith("# "));
    return firstH1 ? firstH1.trim().replace(/^#\s+/, "") : `${repoLabel}: Code Wiki`;
  }, [markdownContent, repoLabel]);

  return (
    <div
      ref={scrollContainerRef}
      className="devlens-scroll devlens-wiki-root"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: bgPage,
        color: textPrimary,
        padding: "clamp(16px, 3vw, 40px)",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <style>{`
        .devlens-wiki-root button:focus-visible,
        .devlens-wiki-root a:focus-visible {
          outline: 2px solid ${accentLink};
          outline-offset: 2px;
        }
        .devlens-wiki-root button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .devlens-wiki-toc button:hover {
          background-color: ${isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.07)"};
        }
        @media (prefers-reduced-motion: reduce) {
          .devlens-wiki-root * {
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Top Action Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
            borderBottom: `1px solid ${borderLine}`,
            paddingBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: textMuted,
              }}
            >
              Code Wiki
            </span>
            <span aria-hidden="true" style={{ color: textMuted }}>
              /
            </span>
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: textPrimary,
                fontWeight: 600,
              }}
            >
              {repoLabel}
            </span>
          </div>

          {hasContent && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  minHeight: 36,
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  background: copied ? textPrimary : "transparent",
                  color: copied ? bgPage : textPrimary,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied Markdown" : "Copy Wiki"}
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                style={{
                  minHeight: 36,
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  background: "transparent",
                  color: textPrimary,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Export .md
              </button>
            </div>
          )}
        </div>

        {/* State 1: Loading */}
        {isLoading && !hasContent && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: "48px 24px",
              borderRadius: 10,
              border: `1px solid ${borderLine}`,
              backgroundColor: bgCard,
              margin: "24px 0",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: textMuted,
                marginBottom: 10,
              }}
            >
              Building Code Wiki
            </div>
            <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.6, color: textBody }}>
              Synthesizing the architecture diagram, subsystem walkthroughs, and verified file links
              from the indexed AST graph for {repoLabel}.
            </p>
          </div>
        )}

        {/* State 2: Error */}
        {!isLoading && error && !hasContent && (
          <div
            role="alert"
            style={{
              padding: "36px 24px",
              borderRadius: 10,
              border: `1px solid ${isLight ? "rgba(220, 38, 38, 0.35)" : "rgba(248, 113, 113, 0.35)"}`,
              backgroundColor: isLight ? "rgba(220, 38, 38, 0.05)" : "rgba(239, 68, 68, 0.07)",
              margin: "24px 0",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: isLight ? "#b91c1c" : "#fca5a5",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Could Not Load Code Wiki
            </div>
            <p
              style={{ margin: "0 0 16px", fontSize: "0.875rem", lineHeight: 1.6, color: textBody }}
            >
              {error}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  minHeight: 40,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: textPrimary,
                  color: bgPage,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Retry Generation
              </button>
            )}
          </div>
        )}

        {/* State 3: Empty */}
        {!isLoading && !error && !hasContent && (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              borderRadius: 10,
              border: `1px dashed ${borderLine}`,
              background: bgCard,
              margin: "24px 0",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: textMuted,
                marginBottom: 8,
              }}
            >
              No Code Wiki Generated Yet
            </div>
            <p
              style={{
                fontSize: "0.875rem",
                color: textBody,
                maxWidth: 500,
                margin: "0 auto 18px",
                lineHeight: 1.6,
              }}
            >
              Index a repository to generate its architecture diagram, subsystem walkthroughs, and
              file-linked onboarding guide.
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  minHeight: 40,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: textPrimary,
                  color: bgPage,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Generate Code Wiki
              </button>
            )}
          </div>
        )}

        {/* Populated Code Wiki Content */}
        {hasContent && (
          <div className="devlens-wiki-shell">
            <style>{`
              .devlens-wiki-shell {
                display: grid;
                grid-template-columns: 1fr;
                gap: 28px;
                align-items: start;
              }
              .devlens-wiki-toc {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding-bottom: 14px;
                border-bottom: 1px solid ${borderLine};
              }
              .devlens-wiki-hero-split {
                display: grid;
                grid-template-columns: 1fr;
                gap: 24px;
                align-items: start;
                margin: 20px 0 28px;
              }
              @media (min-width: 900px) {
                .devlens-wiki-hero-split {
                  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
                  gap: 28px;
                }
              }
              @media (min-width: 1120px) {
                .devlens-wiki-shell {
                  grid-template-columns: 220px minmax(0, 1fr);
                  gap: 36px;
                }
                .devlens-wiki-toc {
                  position: sticky;
                  top: 0;
                  flex-direction: column;
                  flex-wrap: nowrap;
                  gap: 2px;
                  padding-bottom: 0;
                  border-bottom: none;
                  border-right: 1px solid ${borderLine};
                  padding-right: 16px;
                  max-height: calc(100vh - 160px);
                  overflow-y: auto;
                }
              }
            `}</style>

            {/* Left Sticky Wiki Outline */}
            {headings.length > 0 && (
              <nav aria-label="Code Wiki sections" className="devlens-wiki-toc devlens-scroll">
                <span
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: textMuted,
                    padding: "4px 8px 8px",
                    display: "block",
                  }}
                >
                  Contents
                </span>
                {headings.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => scrollToHeading(h.id)}
                    style={{
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderRadius: 5,
                      padding: h.level === 3 ? "5px 8px 5px 18px" : "6px 8px",
                      fontSize: h.level === 3 ? "0.78rem" : "0.82rem",
                      fontWeight: h.level === 2 ? 500 : 400,
                      color: h.level === 2 ? textPrimary : textMuted,
                      cursor: "pointer",
                      lineHeight: 1.35,
                    }}
                  >
                    {h.title}
                  </button>
                ))}
              </nav>
            )}

            {/* Main Code Wiki Article */}
            <article style={{ minWidth: 0, fontSize: "0.95rem", lineHeight: 1.7 }}>
              <h1
                style={{
                  fontSize: "clamp(1.65rem, 3vw, 2.2rem)",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  margin: "0 0 18px",
                  color: textPrimary,
                  lineHeight: 1.2,
                }}
              >
                {docTitle}
              </h1>

              {heroSplit ? (
                <>
                  <div
                    id={heroSplit.headingId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10,
                      borderTop: `1px solid ${borderLine}`,
                      paddingTop: 18,
                      scrollMarginTop: 24,
                    }}
                  >
                    <h2
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        margin: 0,
                        color: textPrimary,
                      }}
                    >
                      {heroSplit.headingTitle}
                    </h2>
                    {onAskCopilot && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskCopilot(
                            `Explain the overall architecture of ${repoLabel} and how its top-level components interact.`,
                          )
                        }
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: `1px solid ${borderLine}`,
                          backgroundColor: "transparent",
                          color: textMuted,
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Ask Copilot
                      </button>
                    )}
                  </div>

                  {/* Two-Column Hero Split: Diagram Left + Architectural Prose & Highlights Right */}
                  <div className="devlens-wiki-hero-split">
                    <MermaidDiagramCard
                      chart={heroSplit.mermaidCode}
                      title={`${repoLabel} Architecture`}
                      theme={theme}
                      compact
                    />
                    <div style={{ minWidth: 0 }}>
                      {renderMarkdownBlocks(heroSplit.proseMarkdown, undefined, false, 1)}
                    </div>
                  </div>

                  {renderMarkdownBlocks(
                    heroSplit.restMarkdown,
                    undefined,
                    false,
                    1 + extractHeadings(heroSplit.proseMarkdown).length,
                  )}
                </>
              ) : (
                renderMarkdownBlocks(markdownContent!, undefined, true)
              )}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import type { GraphData } from "./studio-types";

interface OnboardingDocViewProps {
  repoLabel: string;
  markdownContent?: string;
  graphData?: GraphData | null;
  onSelectFile?: (path: string) => void;
  theme?: "dark" | "light";
}

export function OnboardingDocView({
  repoLabel,
  markdownContent,
  graphData,
  onSelectFile,
  theme = "dark",
}: OnboardingDocViewProps) {
  const [copied, setCopied] = useState(false);
  const isLight = theme === "light";

  const handleCopy = () => {
    if (!markdownContent) return;
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to parse [[path]] file citations and inline markdown (**bold**, `code`, *italic*)
  const renderFormattedInline = (text: string): React.ReactNode[] => {
    // Regex matches:
    // 1. [[path]] or [[path:lines]] citations
    // 2. **bold**
    // 3. `inline code`
    // 4. *italic*
    const tokenRegex = /(\[\[[a-zA-Z0-9_\-./\\]+(?::[0-9\-]+)?\]\]|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
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
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "1px 7px",
              margin: "0 2px",
              borderRadius: 4,
              background: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)",
              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.16)"}`,
              color: isLight ? "#09090b" : "#ffffff",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              cursor: onSelectFile ? "pointer" : "default",
              verticalAlign: "baseline",
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              if (onSelectFile) {
                e.currentTarget.style.backgroundColor = isLight
                  ? "rgba(0, 0, 0, 0.12)"
                  : "rgba(255, 255, 255, 0.18)";
                e.currentTarget.style.borderColor = isLight ? "#09090b" : "#ffffff";
              }
            }}
            onMouseLeave={(e) => {
              if (onSelectFile) {
                e.currentTarget.style.backgroundColor = isLight
                  ? "rgba(0, 0, 0, 0.06)"
                  : "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = isLight
                  ? "rgba(0, 0, 0, 0.15)"
                  : "rgba(255, 255, 255, 0.16)";
              }
            }}
            title={`Focus ${filePath} in Architecture Canvas`}
          >
            <span style={{ opacity: 0.5 }}>↳</span>
            <span>{displayLabel}</span>
          </button>
        );
      } else if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={`b-${keyIdx++}`} style={{ fontWeight: 600, color: isLight ? "#09090b" : "#ffffff" }}>
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={`c-${keyIdx++}`}
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.8125rem",
              background: isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.08)",
              padding: "2px 5px",
              borderRadius: 4,
              color: isLight ? "#0f172a" : "#f1f5f9",
            }}
          >
            {token.slice(1, -1)}
          </code>
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

  // Robust Markdown block parser that handles:
  // - Code fences with internal blank lines
  // - Headings without engulfing text lines below
  // - Unordered and ordered lists
  // - Blockquotes and GitHub alerts
  const renderMarkdownBlocks = (rawMd: string) => {
    const lines = rawMd.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;
    let blockKey = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip blank lines between blocks
      if (!trimmed) {
        i++;
        continue;
      }

      // 1. Code Fence Block (```lang ... ```)
      if (trimmed.startsWith("```")) {
        const lang = trimmed.replace(/^```/, "").trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith("```")) {
          i++; // consume closing fence
        }
        elements.push(
          <div key={`code-${blockKey++}`} style={{ margin: "16px 0" }}>
            {lang && (
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  color: isLight ? "#64748b" : "#94a3b8",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {lang}
              </div>
            )}
            <pre
              className="devlens-scroll"
              style={{
                background: isLight ? "#f4f4f7" : "#0d0d11",
                border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)"}`,
                borderRadius: 8,
                padding: "14px 18px",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.8125rem",
                lineHeight: 1.6,
                color: isLight ? "#09090b" : "rgba(255, 255, 255, 0.9)",
                overflowX: "auto",
                margin: 0,
              }}
            >
              <code>{codeLines.join("\n")}</code>
            </pre>
          </div>
        );
        continue;
      }

      // 2. Headings
      if (trimmed.startsWith("# ")) {
        elements.push(
          <h1
            key={`h1-${blockKey++}`}
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.375rem)",
              fontWeight: 600,
              letterSpacing: "-0.035em",
              margin: "32px 0 16px",
              color: isLight ? "#09090b" : "#ffffff",
              lineHeight: 1.25,
            }}
          >
            {renderFormattedInline(trimmed.replace(/^#\s+/, ""))}
          </h1>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("## ")) {
        elements.push(
          <h2
            key={`h2-${blockKey++}`}
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "36px 0 14px",
              color: isLight ? "#09090b" : "#ffffff",
              borderTop: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255,255,255,0.08)"}`,
              paddingTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {renderFormattedInline(trimmed.replace(/^##\s+/, ""))}
          </h2>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3
            key={`h3-${blockKey++}`}
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              letterSpacing: "-0.015em",
              margin: "20px 0 8px",
              color: isLight ? "#09090b" : "rgba(255,255,255,0.95)",
            }}
          >
            {renderFormattedInline(trimmed.replace(/^###\s+/, ""))}
          </h3>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("#### ")) {
        elements.push(
          <h4
            key={`h4-${blockKey++}`}
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              margin: "16px 0 6px",
              color: isLight ? "rgba(9, 9, 11, 0.85)" : "rgba(255,255,255,0.85)",
            }}
          >
            {renderFormattedInline(trimmed.replace(/^####\s+/, ""))}
          </h4>
        );
        i++;
        continue;
      }

      // 3. Blockquotes and GitHub Alerts (> [!NOTE], > [!CAUTION])
      if (trimmed.startsWith("> ")) {
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
                  ? isLight ? "rgba(239, 68, 68, 0.06)" : "rgba(239, 68, 68, 0.08)"
                  : isLight ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.03)",
                border: `1px solid ${
                  isCaution
                    ? isLight ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.35)"
                    : isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.14)"
                }`,
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.8125rem",
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: isCaution
                    ? isLight ? "#dc2626" : "#fca5a5"
                    : isLight ? "rgba(9, 9, 11, 0.6)" : "rgba(255,255,255,0.7)",
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                {isCaution ? "CAUTION: RISK NOTICE" : "NOTE: REPOSITORY INVARIANT"}
              </div>
              <div style={{ color: isCaution ? (isLight ? "#991b1b" : "#fecaca") : (isLight ? "#09090b" : "rgba(255,255,255,0.85)") }}>
                {renderFormattedInline(alertBody)}
              </div>
            </div>
          );
        } else {
          elements.push(
            <blockquote
              key={`quote-${blockKey++}`}
              style={{
                margin: "14px 0",
                paddingLeft: 16,
                borderLeft: `3px solid ${isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)"}`,
                color: isLight ? "rgba(9,9,11,0.75)" : "rgba(255,255,255,0.75)",
                fontStyle: "italic",
              }}
            >
              {renderFormattedInline(quoteLines.join("\n"))}
            </blockquote>
          );
        }
        continue;
      }

      // 4. Unordered Lists (- or *)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const listItems: string[] = [];
        while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* ") || (listItems.length > 0 && lines[i].startsWith("  ")))) {
          if (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* ")) {
            listItems.push(lines[i].trim().replace(/^[-*]\s+/, ""));
          } else {
            // Continuation line for previous list item
            listItems[listItems.length - 1] += " " + lines[i].trim();
          }
          i++;
        }
        elements.push(
          <ul
            key={`ul-${blockKey++}`}
            style={{
              margin: "10px 0 16px 0",
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
                  lineHeight: 1.6,
                  color: isLight ? "rgba(9, 9, 11, 0.85)" : "rgba(255,255,255,0.8)",
                }}
              >
                {renderFormattedInline(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // 5. Ordered Lists (1., 2.)
      if (/^\d+\.\s+/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && (/^\d+\.\s+/.test(lines[i].trim()) || (listItems.length > 0 && lines[i].startsWith("  ")))) {
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
              margin: "10px 0 16px 0",
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
                  lineHeight: 1.6,
                  color: isLight ? "rgba(9, 9, 11, 0.85)" : "rgba(255,255,255,0.8)",
                }}
              >
                {renderFormattedInline(item)}
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // 6. Regular Paragraph (collect lines until a blank line or special block starter)
      const pLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith("#") &&
        !lines[i].trim().startsWith("```") &&
        !lines[i].trim().startsWith(">") &&
        !lines[i].trim().startsWith("- ") &&
        !lines[i].trim().startsWith("* ") &&
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
            lineHeight: 1.7,
            color: isLight ? "rgba(9, 9, 11, 0.85)" : "rgba(255, 255, 255, 0.82)",
          }}
        >
          {renderFormattedInline(pLines.join(" "))}
        </p>
      );
    }

    return elements;
  };

  const hasContent = Boolean(markdownContent && markdownContent.trim());

  return (
    <div
      className="devlens-scroll"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: isLight ? "#fbfbfe" : "#08080a",
        color: isLight ? "#09090b" : "#ffffff",
        padding: "clamp(20px, 4vw, 56px)",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        overflowY: "auto",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Top Header Strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 28,
            borderBottom: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.09)"}`,
            paddingBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.5)",
              }}
            >
              Architectural Onboarding Dossier
            </span>
            <span style={{ color: isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.2)" }}>/</span>
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                color: isLight ? "#09090b" : "#ffffff",
                fontWeight: 600,
              }}
            >
              {repoLabel}
            </span>
          </div>

          {hasContent && (
            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.14)" : "rgba(255, 255, 255, 0.18)"}`,
                background: copied ? (isLight ? "#09090b" : "#ffffff") : "transparent",
                color: copied ? (isLight ? "#ffffff" : "#000000") : isLight ? "#09090b" : "#ffffff",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {copied ? "✓ Copied Dossier" : "Copy Dossier"}
            </button>
          )}
        </div>

        {/* Editorial Body or Honest Empty State */}
        {hasContent ? (
          <article
            style={{
              lineHeight: 1.7,
              fontSize: "0.9375rem",
            }}
          >
            {renderMarkdownBlocks(markdownContent!)}
          </article>
        ) : (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              borderRadius: 8,
              border: `1px dashed ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)"}`,
              background: isLight ? "rgba(0, 0, 0, 0.02)" : "rgba(255, 255, 255, 0.02)",
              margin: "32px 0",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.5)",
                marginBottom: 8,
              }}
            >
              No Onboarding Document Generated
            </div>
            <p
              style={{
                fontSize: "0.875rem",
                color: isLight ? "rgba(9, 9, 11, 0.7)" : "rgba(255, 255, 255, 0.7)",
                maxWidth: 480,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              An onboarding guide has not been generated for this repository yet. Click "Generate Onboarding Guide" in the top bar to analyze verified codebase facts and AST topology.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

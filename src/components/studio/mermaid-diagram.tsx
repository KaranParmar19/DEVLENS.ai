import React, { useEffect, useId, useState, useCallback } from "react";

interface MermaidDiagramCardProps {
  chart: string;
  title?: string;
  theme?: "dark" | "light";
  compact?: boolean;
}

/**
 * Renders a Mermaid diagram as an interactive SVG card with a modal zoom-and-pan viewer
 * and a raw-source fallback if diagram syntax fails to parse.
 */
export function MermaidDiagramCard({
  chart,
  title = "System Architecture",
  theme = "dark",
  compact = false,
}: MermaidDiagramCardProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const isLight = theme === "light";

  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvgMarkup(null);
    setRenderError(null);

    const trimmed = chart.trim();
    if (!trimmed) {
      setRenderError("Empty diagram definition.");
      return;
    }

    (async () => {
      try {
        const mod = await import("@streamdown/mermaid");
        const instance = mod.mermaid.getMermaid({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isLight ? "neutral" : "dark",
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: "basis",
            nodeSpacing: 36,
            rankSpacing: 44,
            padding: 14,
          },
          themeVariables: isLight
            ? {
                background: "#f4f4f7",
                primaryColor: "#ffffff",
                primaryTextColor: "#0a0a0a",
                primaryBorderColor: "#52525b",
                lineColor: "#52525b",
                secondaryColor: "#e4e4e7",
                tertiaryColor: "#f4f4f7",
                clusterBkg: "#eef0f5",
                clusterBorder: "#a1a1aa",
                fontSize: "13px",
                fontFamily: "var(--mf-font, 'Geist', sans-serif)",
              }
            : {
                background: "#111116",
                primaryColor: "#18181f",
                primaryTextColor: "#f4f4f5",
                primaryBorderColor: "#71717a",
                lineColor: "#a1a1aa",
                secondaryColor: "#1f1f27",
                tertiaryColor: "#14141a",
                clusterBkg: "#14141b",
                clusterBorder: "#3f3f46",
                fontSize: "13px",
                fontFamily: "var(--mf-font, 'Geist', sans-serif)",
              },
        });

        const renderId = `devlens-mmd-${reactId}-${isLight ? "l" : "d"}`;
        const result = await instance.render(renderId, trimmed);
        if (!cancelled) {
          setSvgMarkup(result.svg);
        }
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : "Failed to render Mermaid diagram.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, isLight, reactId]);

  useEffect(() => {
    if (!isZoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsZoomOpen(false);
      } else if (e.key === "+" || e.key === "=") {
        setZoomScale((s) => Math.min(2.5, Number((s + 0.25).toFixed(2))));
      } else if (e.key === "-") {
        setZoomScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))));
      } else if (e.key === "0") {
        setZoomScale(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isZoomOpen]);

  const handleCopySource = useCallback(() => {
    navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [chart]);

  const openModal = useCallback(() => {
    setZoomScale(1);
    setShowSource(false);
    setIsZoomOpen(true);
  }, []);

  const surfaceBg = isLight ? "#f4f4f7" : "#111116";
  const borderColor = isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.13)";
  const mutedText = isLight ? "#52525b" : "#a1a1aa";
  const primaryText = isLight ? "#09090b" : "#f4f4f5";
  const controlBg = isLight ? "#ffffff" : "#1b1b22";

  return (
    <>
      <style>{`
        .devlens-mermaid-svg svg {
          max-width: 100%;
          height: auto;
        }
        .devlens-mmd-card button:focus-visible,
        .devlens-mmd-modal button:focus-visible {
          outline: 2px solid ${isLight ? "#1d4ed8" : "#60a5fa"};
          outline-offset: 2px;
        }
        .devlens-mmd-card button:hover,
        .devlens-mmd-modal button:hover {
          background-color: ${isLight ? "#e4e4e7" : "#272730"} !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .devlens-mmd-modal * {
            transition: none !important;
          }
        }
      `}</style>
      <div
        className="devlens-mmd-card"
        style={{
          position: "relative",
          backgroundColor: surfaceBg,
          border: `1px solid ${borderColor}`,
          borderRadius: 10,
          padding: compact ? "18px 16px 46px" : "24px 24px 52px",
          overflow: "hidden",
          minHeight: compact ? 260 : 220,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {svgMarkup ? (
          <div
            className="devlens-mermaid-svg"
            style={{
              width: "100%",
              overflowX: "auto",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
            // Rendered via mermaid strict securityLevel
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : renderError ? (
          <div style={{ width: "100%" }}>
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: mutedText,
                marginBottom: 8,
              }}
            >
              Diagram source (preview unavailable)
            </div>
            <pre
              className="devlens-scroll"
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 6,
                backgroundColor: isLight ? "#ffffff" : "#0a0a0d",
                border: `1px solid ${borderColor}`,
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                lineHeight: 1.55,
                color: primaryText,
                overflowX: "auto",
              }}
            >
              <code>{chart}</code>
            </pre>
          </div>
        ) : (
          <div
            role="status"
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              color: mutedText,
              padding: "32px 16px",
            }}
          >
            Rendering architecture diagram...
          </div>
        )}

        {/* Bottom-right Zoom / Inspect trigger */}
        <div
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <button
            type="button"
            onClick={openModal}
            aria-label={`Expand ${title}`}
            title="Expand and inspect diagram"
            style={{
              minWidth: 40,
              minHeight: 40,
              padding: "0 10px",
              borderRadius: 8,
              border: `1px solid ${borderColor}`,
              backgroundColor: controlBg,
              color: primaryText,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <span>Inspect</span>
          </button>
        </div>
      </div>

      {/* Expanded Diagram Zoom Modal */}
      {isZoomOpen && (
        <div
          className="devlens-mmd-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Expanded ${title}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsZoomOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: isLight ? "rgba(9, 9, 11, 0.55)" : "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(12px, 3vw, 32px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1120,
              maxHeight: "90vh",
              backgroundColor: isLight ? "#ffffff" : "#0e0e13",
              border: `1px solid ${borderColor}`,
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: isLight
                ? "0 20px 50px rgba(0, 0, 0, 0.18)"
                : "0 24px 60px rgba(0, 0, 0, 0.65)",
            }}
          >
            {/* Modal Toolbar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                padding: "12px 16px",
                borderBottom: `1px solid ${borderColor}`,
                backgroundColor: surfaceBg,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: primaryText,
                }}
              >
                {title}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {!showSource && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomScale((s) => Math.max(0.5, Number((s - 0.25).toFixed(2))))
                      }
                      aria-label="Zoom out diagram"
                      style={modalBtnStyle(controlBg, borderColor, primaryText)}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomScale(1)}
                      aria-label="Reset diagram zoom"
                      style={modalBtnStyle(controlBg, borderColor, primaryText)}
                    >
                      {Math.round(zoomScale * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setZoomScale((s) => Math.min(2.5, Number((s + 0.25).toFixed(2))))
                      }
                      aria-label="Zoom in diagram"
                      style={modalBtnStyle(controlBg, borderColor, primaryText)}
                    >
                      +
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowSource((v) => !v)}
                  style={modalBtnStyle(controlBg, borderColor, primaryText)}
                >
                  {showSource ? "Diagram" : "Mermaid Source"}
                </button>
                <button
                  type="button"
                  onClick={handleCopySource}
                  style={modalBtnStyle(controlBg, borderColor, primaryText)}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(false)}
                  aria-label="Close diagram modal"
                  style={modalBtnStyle(controlBg, borderColor, primaryText)}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div
              className="devlens-scroll"
              style={{
                flex: 1,
                overflow: "auto",
                padding: 24,
                display: "flex",
                justifyContent: showSource ? "stretch" : "center",
                alignItems: showSource ? "stretch" : "flex-start",
                minHeight: 340,
              }}
            >
              {showSource || !svgMarkup ? (
                <pre
                  style={{
                    width: "100%",
                    margin: 0,
                    padding: 16,
                    borderRadius: 8,
                    backgroundColor: surfaceBg,
                    border: `1px solid ${borderColor}`,
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.8125rem",
                    lineHeight: 1.6,
                    color: primaryText,
                    overflowX: "auto",
                  }}
                >
                  <code>{chart}</code>
                </pre>
              ) : (
                <div
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: "top center",
                    transition: "transform 0.15s ease",
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                  }}
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function modalBtnStyle(bg: string, border: string, color: string): React.CSSProperties {
  return {
    minHeight: 36,
    minWidth: 36,
    padding: "4px 10px",
    borderRadius: 6,
    border: `1px solid ${border}`,
    backgroundColor: bg,
    color,
    fontFamily: "var(--mf-mono, monospace)",
    fontSize: "0.75rem",
    cursor: "pointer",
  };
}

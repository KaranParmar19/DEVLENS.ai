import { useState } from "react";

interface OnboardingDocViewProps {
  repoLabel: string;
  markdownContent?: string;
}

export function OnboardingDocView({ repoLabel, markdownContent }: OnboardingDocViewProps) {
  const [copied, setCopied] = useState(false);

  const defaultDoc = `# ${repoLabel} — Architectural Invariants & Onboarding Guide

## 1. System Architecture Overview
This repository implements a modular client-server distributed system. The architecture separates transport adapters (REST endpoints, WebSocket pub/sub streams) from core dependency analysis algorithms.

\`\`\`
[ Client Ingress ]
        │
        ▼
[ Auth & Rate-Limit Middleware ]
        │
        ▼
[ AST Parser & Symbol Table ] ───▶ [ pgvector Embeddings ]
        │
        ▼
[ NetworkX Directed Graph ] ───▶ [ Redis Event Pipeline ]
\`\`\`

## 2. Core Architectural Invariants
1. **Zero Raw Code Retention**: Source repositories are indexed into abstract syntax trees (ASTs) on ephemeral workers and discarded immediately.
2. **Explicit Dependency Flow**: Circular imports between domain modules and transport layers are forbidden.
3. **Idempotent Ingestion**: Analysis jobs can be resumed or replayed safely from any recorded step.

## 3. Critical Files You Must Know Before Modifying
- \`src/server/ingress.ts\`: Core API boundary. Any changes here directly affect client protocol contracts.
- \`src/services/CodeGraphService.ts\`: Constructs the directed acyclic graph (DAG) representing file imports. High blast radius.
- \`src/db/VectorStore.ts\`: Manages similarity search indexing with pgvector.

## 4. Fragile Areas & Common Traps
- **Event Loop Threading in Workers**: Asyncpg connections must not share event loops across concurrent worker threads.
- **WebSocket Reconnection**: Clients must drain the Redis backlog before subscribing to live channels to prevent dropped events.

## 5. Local Setup & Testing
\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Execute architecture tests
npm run test
\`\`\`
`;

  const content = markdownContent || defaultDoc;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#08080a",
        color: "#ffffff",
        padding: "clamp(24px, 5vw, 64px)",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Actions Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 16 }}>
          <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.6875rem", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em" }}>
            Generated Walkthrough // Live AST Grounded
          </span>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: copied ? "#ffffff" : "transparent",
              color: copied ? "#000000" : "#ffffff",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {copied ? "✓ Copied Markdown" : "Copy Markdown"}
          </button>
        </div>

        {/* Editorial Markdown Body */}
        <article
          style={{
            lineHeight: 1.7,
            fontSize: "0.9375rem",
            color: "rgba(255, 255, 255, 0.82)",
          }}
        >
          <div style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
            {content.split("\n\n").map((block, i) => {
              if (block.startsWith("# ")) {
                return (
                  <h1 key={i} style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: 500, letterSpacing: "-0.04em", margin: "0 0 24px", color: "#ffffff" }}>
                    {block.replace("# ", "")}
                  </h1>
                );
              }
              if (block.startsWith("## ")) {
                return (
                  <h2 key={i} style={{ fontSize: "1.375rem", fontWeight: 500, letterSpacing: "-0.02em", margin: "36px 0 16px", color: "#ffffff", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
                    {block.replace("## ", "")}
                  </h2>
                );
              }
              if (block.startsWith("```")) {
                const code = block.replace(/```[a-z]*\n?/g, "");
                return (
                  <pre
                    key={i}
                    style={{
                      background: "#111114",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      padding: "16px 20px",
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.8125rem",
                      lineHeight: 1.6,
                      color: "rgba(255, 255, 255, 0.9)",
                      overflowX: "auto",
                      margin: "16px 0",
                    }}
                  >
                    <code>{code}</code>
                  </pre>
                );
              }
              return (
                <p key={i} style={{ margin: "0 0 16px" }}>
                  {block}
                </p>
              );
            })}
          </div>
        </article>
      </div>
    </div>
  );
}

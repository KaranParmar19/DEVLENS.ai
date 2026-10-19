import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/hooks/useChat";

interface CopilotRailProps {
  repoLabel: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (msg: string) => void;
  onClearChat: () => void;
  onSelectFile: (path: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SUGGESTIONS = [
  "What breaks if I delete router.ts?",
  "Explain the auth flow",
  "Where are the circular dependencies?",
  "What is the blast radius of ApiClient?",
];

export function CopilotRail({
  repoLabel,
  messages,
  isStreaming,
  onSendMessage,
  onClearChat,
  onSelectFile,
  collapsed = false,
  onToggleCollapse,
}: CopilotRailProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput("");
    onSendMessage(q);
  };

  if (collapsed) {
    return (
      <aside
        style={{
          width: 44,
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          backgroundColor: "#0d0d10",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 0",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            color: "rgba(255, 255, 255, 0.7)",
            width: 28,
            height: 28,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
          title="Expand Copilot"
        >
          «
        </button>

        <div
          onClick={onToggleCollapse}
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.6)",
            cursor: "pointer",
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: isStreaming ? "#ffffff" : "rgba(255,255,255,0.6)",
              boxShadow: isStreaming ? "0 0 8px #ffffff" : "none",
            }}
          />
          <span>Ask DevLens</span>
        </div>

        {messages.length > 0 && (
          <span
            style={{
              marginTop: "auto",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.625rem",
              background: "rgba(255,255,255,0.1)",
              borderRadius: 999,
              padding: "2px 6px",
              color: "#ffffff",
            }}
          >
            {messages.length}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 320,
        borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
        backgroundColor: "#0c0c0f",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Copilot Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: isStreaming ? "#ffffff" : "rgba(255,255,255,0.7)",
              boxShadow: isStreaming ? "0 0 10px #ffffff" : "none",
              animation: isStreaming ? "mf-pulse 1s infinite" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#ffffff",
            }}
          >
            Ask DevLens
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 4,
                color: "rgba(255,255,255,0.6)",
                width: 22,
                height: 22,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
              title="Collapse Copilot"
            >
              »
            </button>
          )}
        </div>
      </div>

      {/* Suggested Inquiries */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div
          style={{
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.625rem",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.4)",
            marginBottom: 8,
          }}
        >
          Suggested Inquiries
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSendMessage(q)}
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: "0.6875rem",
                color: "rgba(255, 255, 255, 0.8)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.color = "rgba(255,255,255,0.8)";
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 12px", color: "rgba(255,255,255,0.4)" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
              }}
            >
              AI
            </div>
            <p style={{ fontSize: "0.8125rem", lineHeight: 1.5, margin: 0 }}>
              Ask anything about <strong style={{ color: "#ffffff" }}>{repoLabel}</strong> — architecture, flows, edge cases, refactor risks.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div
                key={i}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "92%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    background: isUser ? "#ffffff" : "rgba(255, 255, 255, 0.05)",
                    color: isUser ? "#000000" : "#ffffff",
                    border: isUser ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    padding: "10px 14px",
                    fontSize: "0.8125rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.content}
                </div>

                {/* Source Citations */}
                {m.sources && m.sources.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 4 }}>
                    {m.sources.map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => onSelectFile(src)}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.625rem",
                          color: "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                        }}
                      >
                        ↳ {src}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "12px 14px",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "#09090b",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 999,
            padding: "4px 6px 4px 14px",
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about architecture..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "var(--mf-font, 'Geist', sans-serif)",
              fontSize: "0.8125rem",
              color: "#ffffff",
            }}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: input.trim() ? "#ffffff" : "rgba(255,255,255,0.15)",
              color: input.trim() ? "#000000" : "rgba(255,255,255,0.3)",
              border: "none",
              cursor: input.trim() ? "pointer" : "default",
              display: "grid",
              placeItems: "center",
              fontSize: "0.8125rem",
              fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            ↑
          </button>
        </div>
      </form>
    </aside>
  );
}

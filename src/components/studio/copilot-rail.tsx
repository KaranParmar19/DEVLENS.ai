import { useState, useRef, useEffect, useMemo } from "react";
import type { ChatMessage } from "@/hooks/useChat";
import type { GraphData } from "./studio-types";

interface CopilotRailProps {
  repoLabel: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (msg: string) => void;
  onClearChat: () => void;
  onSelectFile: (path: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  graphData?: GraphData | null;
}

export function CopilotRail({
  repoLabel,
  messages,
  isStreaming,
  onSendMessage,
  onClearChat,
  onSelectFile,
  collapsed = false,
  onToggleCollapse,
  graphData,
}: CopilotRailProps) {
  const [input, setInput] = useState("");
  const [atQuery, setAtQuery] = useState<string | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages or streaming deltas
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Dynamic context-aware suggested questions derived from actual repository graph
  const suggestions = useMemo(() => {
    const list: string[] = [];
    const nodes = graphData?.nodes || [];
    const cycles = graphData?.meta?.cycles || [];

    // 1. Cycle inquiry if cycles exist
    if (cycles.length > 0) {
      list.push(`Where are the circular dependency cycles?`);
    }

    // 2. High blast radius inquiry from top coupling node
    if (nodes.length > 0) {
      const topCoupled = [...nodes].sort((a, b) => (b.coupling || 0) - (a.coupling || 0))[0];
      if (topCoupled && (topCoupled.coupling || 0) > 0.1) {
        list.push(`What is the blast radius of ${topCoupled.label || topCoupled.id}?`);
      }
    }

    // 3. Entry point inquiry
    const entryNode = nodes.find((n) => n.is_entry);
    if (entryNode) {
      list.push(`Explain entry point: ${entryNode.label || entryNode.id}`);
    }

    // 4. Complexity inquiry
    const complexNode = [...nodes].sort((a, b) => (b.complexity || 0) - (a.complexity || 0))[0];
    if (complexNode && (complexNode.complexity || 0) > 3) {
      list.push(`Why is ${complexNode.label || complexNode.id} high complexity?`);
    }

    // 5. General architecture inquiry
    list.push(`Explain the core architecture of ${repoLabel.split("/").pop() || repoLabel}`);

    return list.slice(0, 4);
  }, [graphData, repoLabel]);

  // Autocomplete file matches when user types @
  const allFiles = useMemo(() => {
    if (!graphData?.nodes) return [];
    return graphData.nodes.map((n) => n.id);
  }, [graphData]);

  const matchingFiles = useMemo(() => {
    if (atQuery === null) return [];
    const q = atQuery.toLowerCase();
    return allFiles
      .filter((f) => f.toLowerCase().includes(q))
      .slice(0, 6);
  }, [atQuery, allFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setAtQuery("");
      setSelectedMentionIndex(0);
    } else if (lastAt !== -1 && !val.slice(lastAt).includes(" ")) {
      setAtQuery(val.slice(lastAt + 1));
      setSelectedMentionIndex(0);
    } else {
      setAtQuery(null);
    }
  };

  const handleSelectMention = (filePath: string) => {
    if (atQuery === null) return;
    const lastAt = input.lastIndexOf("@");
    if (lastAt !== -1) {
      const before = input.slice(0, lastAt);
      setInput(`${before}[[${filePath}]] `);
    }
    setAtQuery(null);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (atQuery !== null && matchingFiles.length > 0) {
      handleSelectMention(matchingFiles[selectedMentionIndex]);
      return;
    }
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput("");
    setAtQuery(null);
    onSendMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (atQuery !== null && matchingFiles.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % matchingFiles.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + matchingFiles.length) % matchingFiles.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectMention(matchingFiles[selectedMentionIndex]);
      } else if (e.key === "Escape") {
        setAtQuery(null);
      }
    }
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(id);
    setTimeout(() => setCopiedCodeIdx(null), 1500);
  };

  // Helper to render inline file citations [[path/file]] as clickable pills
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\[\[.*?\]\])/g);
    return parts.map((part, idx) => {
      if (part.startsWith("[[") && part.endsWith("]]")) {
        const filePath = part.slice(2, -2).trim();
        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectFile(filePath);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "1px 6px",
              margin: "0 2px",
              borderRadius: 4,
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              cursor: "pointer",
              verticalAlign: "baseline",
              transition: "all 0.15s",
            }}
            title={`Inspect ${filePath}`}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.color = "#000000";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.12)";
              e.currentTarget.style.color = "#ffffff";
            }}
          >
            <span style={{ opacity: 0.6 }}>↳</span>
            <span>{filePath.split("/").pop()}</span>
          </button>
        );
      }
      return part;
    });
  };

  // Helper to parse blocks of markdown: headers, lists, code fences
  const renderMessageContent = (content: string, msgIndex: number, isLastAssistant: boolean) => {
    if (!content && isLastAssistant && isStreaming) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: "0.8125rem" }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              animation: "mf-pulse 1s infinite",
            }}
          />
          <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem" }}>
            Retrieving AST chunks & graph context...
          </span>
        </div>
      );
    }

    // Split on code fences ```lang ... ```
    const codeFenceRegex = /```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g;
    const elements = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    let segmentIdx = 0;
    while ((match = codeFenceRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textSegment = content.slice(lastIndex, match.index);
        elements.push(
          <div key={`txt-${segmentIdx++}`} style={{ whiteSpace: "pre-wrap" }}>
            {renderFormattedText(textSegment)}
          </div>
        );
      }

      const lang = match[1] || "text";
      const code = match[2];
      const codeId = `${msgIndex}-${segmentIdx++}`;
      const isCopied = copiedCodeIdx === codeId;

      elements.push(
        <div
          key={`code-${codeId}`}
          style={{
            margin: "8px 0",
            backgroundColor: "#050507",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 8px",
              backgroundColor: "rgba(255,255,255,0.04)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.625rem",
              color: "rgba(255,255,255,0.5)",
              textTransform: "uppercase",
            }}
          >
            <span>{lang}</span>
            <button
              type="button"
              onClick={() => handleCopyCode(codeId, code)}
              style={{
                background: "transparent",
                border: "none",
                color: isCopied ? "#ffffff" : "rgba(255,255,255,0.6)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.625rem",
              }}
            >
              {isCopied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "8px 10px",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              lineHeight: 1.45,
              overflowX: "auto",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const remaining = content.slice(lastIndex);
      elements.push(
        <div key={`txt-${segmentIdx++}`} style={{ whiteSpace: "pre-wrap" }}>
          {renderFormattedText(remaining)}
          {isLastAssistant && isStreaming && (
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 12,
                backgroundColor: "#ffffff",
                marginLeft: 4,
                verticalAlign: "middle",
                animation: "mf-pulse 0.8s infinite",
              }}
            />
          )}
        </div>
      );
    }

    return elements;
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
              backgroundColor: isStreaming ? "#ffffff" : "#10b981",
              boxShadow: isStreaming ? "0 0 8px #ffffff" : "none",
            }}
          />
          <span>DevLens Copilot</span>
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
        width: 340,
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
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#08080a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: isStreaming ? "#ffffff" : "#10b981",
              boxShadow: isStreaming ? "0 0 10px #ffffff" : "0 0 6px rgba(16,185,129,0.5)",
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
              fontWeight: 500,
            }}
          >
            DevLens Copilot
          </span>
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.5625rem",
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4,
              padding: "1px 5px",
              color: "rgba(255,255,255,0.6)",
              textTransform: "uppercase",
            }}
          >
            AST Grounded
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.45)",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                cursor: "pointer",
                padding: "2px 6px",
              }}
              title="Clear message history"
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

      {/* Suggested Inquiries (Dynamically Grounded in Repo) */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", backgroundColor: "rgba(255,255,255,0.01)" }}>
        <div
          style={{
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.625rem",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.4)",
            marginBottom: 6,
            letterSpacing: "0.06em",
          }}
        >
          Suggested Inquiries
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSendMessage(q)}
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 999,
                padding: "3px 9px",
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
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 12px", color: "rgba(255,255,255,0.4)" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.18)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 12px",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: "#ffffff",
              }}
            >
              AI
            </div>
            <p style={{ fontSize: "0.8125rem", lineHeight: 1.5, margin: "0 0 8px" }}>
              Ask anything about <strong style={{ color: "#ffffff" }}>{repoLabel}</strong>.
            </p>
            <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.4)", margin: 0, fontFamily: "var(--mf-mono, monospace)" }}>
              Type @ to mention specific files, or ask about blast radius, entry points, or refactor risks.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === "user";
            const isLastAssistant = !isUser && i === messages.length - 1;

            return (
              <div
                key={i}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "94%",
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
                    padding: "10px 12px",
                    fontSize: "0.8125rem",
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {isUser ? m.content : renderMessageContent(m.content, i, isLastAssistant)}
                </div>

                {/* Grounded Source Citations */}
                {!isUser && m.sources && m.sources.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 2 }}>
                    <span
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.5625rem",
                        color: "rgba(255,255,255,0.4)",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        marginRight: 2,
                      }}
                    >
                      Sources:
                    </span>
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
                          color: "rgba(255,255,255,0.8)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.16)";
                          e.currentTarget.style.color = "#ffffff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
                          e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                        }}
                        title={`Open ${src}`}
                      >
                        ↳ {src.split("/").pop()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mention Autocomplete Popover */}
      {atQuery !== null && matchingFiles.length > 0 && (
        <div
          style={{
            maxHeight: 180,
            overflowY: "auto",
            backgroundColor: "#111116",
            border: "1px solid rgba(255,255,255,0.2)",
            borderBottom: "none",
            borderRadius: "6px 6px 0 0",
            margin: "0 14px",
            padding: "4px 0",
            boxShadow: "0 -8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              padding: "4px 10px",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.5625rem",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Mention File (@)
          </div>
          {matchingFiles.map((file, idx) => (
            <div
              key={file}
              onClick={() => handleSelectMention(file)}
              style={{
                padding: "6px 10px",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: idx === selectedMentionIndex ? "#ffffff" : "rgba(255,255,255,0.7)",
                backgroundColor: idx === selectedMentionIndex ? "rgba(255,255,255,0.12)" : "transparent",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseEnter={() => setSelectedMentionIndex(idx)}
            >
              <span>{file}</span>
              <span style={{ fontSize: "0.625rem", opacity: 0.5 }}>Tab ↵</span>
            </div>
          ))}
        </div>
      )}

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
            border: "1px solid rgba(255, 255, 255, 0.14)",
            borderRadius: 999,
            padding: "4px 6px 4px 14px",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about architecture (type @ for files)..."
            disabled={isStreaming}
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
            disabled={!input.trim() || isStreaming}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: input.trim() && !isStreaming ? "#ffffff" : "rgba(255,255,255,0.15)",
              color: input.trim() && !isStreaming ? "#000000" : "rgba(255,255,255,0.3)",
              border: "none",
              cursor: input.trim() && !isStreaming ? "pointer" : "default",
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

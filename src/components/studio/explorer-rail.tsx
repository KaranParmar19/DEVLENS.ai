import { useState, useMemo } from "react";
import type { ExplorerTab, FileItem, ModuleItem } from "./studio-types";

interface ExplorerRailProps {
  files?: FileItem[];
  modules?: ModuleItem[];
  entryPoints?: string[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ExplorerRail({
  files = [],
  modules = [],
  entryPoints = [],
  activeFile,
  onSelectFile,
  collapsed,
  onToggleCollapse,
}: ExplorerRailProps) {
  const [tab, setTab] = useState<ExplorerTab>("files");
  const [filter, setFilter] = useState("");

  const filteredFiles = useMemo(() => {
    if (!filter) return files;
    const lower = filter.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(lower));
  }, [files, filter]);

  const filteredModules = useMemo(() => {
    if (!filter) return modules;
    const lower = filter.toLowerCase();
    return modules.filter((m) => m.name.toLowerCase().includes(lower));
  }, [modules, filter]);

  const filteredEntryPoints = useMemo(() => {
    if (!filter) return entryPoints;
    const lower = filter.toLowerCase();
    return entryPoints.filter((e) => e.toLowerCase().includes(lower));
  }, [entryPoints, filter]);

  if (collapsed) {
    return (
      <aside
        style={{
          width: 44,
          borderRight: "1px solid rgba(255, 255, 255, 0.1)",
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
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.6)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          title="Expand Explorer"
        >
          ▶
        </button>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 260,
        borderRight: "1px solid rgba(255, 255, 255, 0.1)",
        backgroundColor: "#0c0c0f",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Search Input Bar */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.4)" }}>
            ⌕
          </span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search files..."
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              color: "#ffffff",
              width: "100%",
            }}
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                fontSize: "0.6875rem",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs: FILES | MODULES | ENTRY POINTS */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "#09090b",
        }}
      >
        {(
          [
            { id: "files", label: "Files" },
            { id: "modules", label: "Modules" },
            { id: "entrypoints", label: "Entry" },
          ] as const
        ).map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "8px 4px",
                border: "none",
                background: "transparent",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
                borderBottom: isActive ? "2px solid #ffffff" : "2px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Explorer Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
        {tab === "files" && (
          <div>
            {filteredFiles.length === 0 ? (
              <div style={{ padding: 16, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                No files found
              </div>
            ) : (
              filteredFiles.map((f) => {
                const isSelected = activeFile === f.path;
                const isDir = f.is_dir;
                return (
                  <div
                    key={f.path}
                    onClick={() => {
                      if (!isDir) onSelectFile(f.path);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      paddingLeft: `${Math.min(f.depth * 12 + 8, 48)}px`,
                      borderRadius: 6,
                      background: isSelected ? "rgba(255, 255, 255, 0.12)" : "transparent",
                      color: isSelected ? "#ffffff" : isDir ? "rgba(255,255,255,0.85)" : "rgba(255, 255, 255, 0.65)",
                      cursor: isDir ? "default" : "pointer",
                      fontSize: "0.75rem",
                      fontFamily: "var(--mf-mono, monospace)",
                      marginBottom: 1,
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isDir) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !isDir) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                      <span style={{ opacity: isDir ? 0.9 : 0.4, fontSize: "0.6875rem", flexShrink: 0 }}>
                        {isDir ? "📁" : "📄"}
                      </span>
                      <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {f.name}
                      </span>
                    </div>

                    {f.line_count != null && !isDir && (
                      <span style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                        {f.line_count}L
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "modules" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredModules.length === 0 ? (
              <div style={{ padding: 16, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                No modules parsed
              </div>
            ) : (
              filteredModules.map((m) => (
                <div
                  key={m.name}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontFamily: "var(--mf-mono, monospace)", color: "#ffffff" }}>
                    {m.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontFamily: "var(--mf-mono, monospace)",
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    {m.file_count} files
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "entrypoints" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredEntryPoints.length === 0 ? (
              <div style={{ padding: 16, fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                No entry points detected
              </div>
            ) : (
              filteredEntryPoints.map((entry) => (
                <div
                  key={entry}
                  onClick={() => onSelectFile(entry)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: activeFile === entry ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontFamily: "var(--mf-mono, monospace)", color: "#ffffff" }}>
                    {entry}
                  </span>
                  <span
                    style={{
                      fontSize: "0.5625rem",
                      fontFamily: "var(--mf-mono, monospace)",
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "#ffffff",
                      color: "#000000",
                      fontWeight: 600,
                    }}
                  >
                    ENTRY
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Collapse Footer */}
      <div
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.6875rem",
          color: "rgba(255,255,255,0.4)",
          fontFamily: "var(--mf-mono, monospace)",
        }}
      >
        <span>{files.length} ITEMS</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
        >
          ◀ Collapse
        </button>
      </div>
    </aside>
  );
}

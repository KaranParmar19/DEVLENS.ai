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
  width?: number;
  theme?: "dark" | "light";
}

export function ExplorerRail({
  files = [],
  modules = [],
  entryPoints = [],
  activeFile,
  onSelectFile,
  collapsed,
  onToggleCollapse,
  width = 260,
  theme = "dark",
}: ExplorerRailProps) {
  const [tab, setTab] = useState<ExplorerTab>("files");
  const [filter, setFilter] = useState("");
  const isLight = theme === "light";

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
          borderRight: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)"}`,
          backgroundColor: isLight ? "#f8f8fa" : "#0d0d10",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 0",
          gap: 16,
          flexShrink: 0,
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          style={{
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.75rem",
            color: isLight ? "rgba(9, 9, 11, 0.6)" : "rgba(255, 255, 255, 0.6)",
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
        width,
        borderRight: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)"}`,
        backgroundColor: isLight ? "#ffffff" : "#0c0c0f",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        flexShrink: 0,
        overflow: "hidden",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      {/* Search Input Bar */}
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)"}` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.05)",
            border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)"}`,
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: isLight ? "rgba(9, 9, 11, 0.4)" : "rgba(255, 255, 255, 0.4)" }}>
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
              color: isLight ? "#09090b" : "#ffffff",
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
                color: isLight ? "rgba(9, 9, 11, 0.4)" : "rgba(255, 255, 255, 0.4)",
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
          borderBottom: `1px solid ${isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)"}`,
          backgroundColor: isLight ? "#fbfbfe" : "#09090b",
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
                color: isActive
                  ? isLight
                    ? "#09090b"
                    : "#ffffff"
                  : isLight
                  ? "rgba(9, 9, 11, 0.45)"
                  : "rgba(255, 255, 255, 0.45)",
                borderBottom: isActive
                  ? `2px solid ${isLight ? "#09090b" : "#ffffff"}`
                  : "2px solid transparent",
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
      <div className="devlens-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
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
                      background: isSelected
                        ? isLight
                          ? "rgba(0, 0, 0, 0.08)"
                          : "rgba(255, 255, 255, 0.12)"
                        : "transparent",
                      color: isSelected
                        ? isLight
                          ? "#09090b"
                          : "#ffffff"
                        : isDir
                        ? isLight
                          ? "#09090b"
                          : "rgba(255,255,255,0.85)"
                        : isLight
                        ? "rgba(9, 9, 11, 0.7)"
                        : "rgba(255, 255, 255, 0.65)",
                      cursor: isDir ? "default" : "pointer",
                      fontSize: "0.75rem",
                      fontFamily: "var(--mf-mono, monospace)",
                      marginBottom: 1,
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isDir) {
                        e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !isDir) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                      <span style={{ opacity: isDir ? 0.7 : 0.35, fontSize: "0.6875rem", flexShrink: 0, width: 10, textAlign: "center" }}>
                        {isDir ? "▸" : "·"}
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

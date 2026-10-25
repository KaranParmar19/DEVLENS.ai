import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { StudioTab } from "./studio-types";

interface StudioTopbarProps {
  repoUrl: string;
  branch: string;
  onBranchChange: (b: string) => void;
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  languages: string[];
  selectedLang: string | null;
  onSelectLang: (lang: string | null) => void;
  onExport: (format: "json" | "mermaid" | "plantuml" | "share") => void;
  onClose: () => void;
}

const BRANCHES = ["main", "master", "develop", "staging"];

export function StudioTopbar({
  repoUrl,
  branch,
  onBranchChange,
  activeTab,
  onTabChange,
  languages,
  selectedLang,
  onSelectLang,
  onExport,
  onClose,
}: StudioTopbarProps) {
  const repoLabel = repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");
  const [branchOpen, setBranchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    onExport("share");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header
      style={{
        height: 56,
        borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
        backgroundColor: "#09090b",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        position: "relative",
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* Left: Brand & Repo Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <a
          href="/dashboard"
          onClick={(e) => {
            e.preventDefault();
            onClose();
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.75rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#ffffff",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              display: "inline-block",
            }}
          />
          DevLens // Studio
        </a>

        <div style={{ width: 1, height: 16, backgroundColor: "rgba(255, 255, 255, 0.15)" }} />

        {/* Repo Label */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
          <span
            style={{
              color: "rgba(255, 255, 255, 0.5)",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
            }}
          >
            repo:
          </span>
          <span style={{ fontWeight: 500, letterSpacing: "-0.01em" }}>{repoLabel}</span>

          {/* Branch Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setBranchOpen((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                borderRadius: 999,
                background: branchOpen ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#ffffff",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <span>⎇</span>
              <span>{branch}</span>
              <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>▼</span>
            </button>

            <AnimatePresence>
              {branchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 6,
                    background: "#121215",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    minWidth: 140,
                    boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                    zIndex: 50,
                    overflow: "hidden",
                  }}
                >
                  {BRANCHES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => {
                        onBranchChange(b);
                        setBranchOpen(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        background: b === branch ? "rgba(255,255,255,0.1)" : "transparent",
                        border: "none",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        color: b === branch ? "#ffffff" : "rgba(255,255,255,0.7)",
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      {b === branch ? "✓ " : "  "}
                      {b}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Center: Monoform Tab Switcher with Framer Motion Sliding Pill */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 3,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        {(
          [
            { id: "architecture", label: "Architecture" },
            { id: "flow", label: "Code Flow" },
            { id: "drift", label: "Drift Timeline" },
            { id: "doc", label: "Onboarding Doc" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              style={{
                position: "relative",
                padding: "6px 14px",
                borderRadius: 999,
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                border: "none",
                cursor: "pointer",
                background: "transparent",
                color: isActive ? "#000000" : "rgba(255, 255, 255, 0.65)",
                fontWeight: isActive ? 600 : 400,
                outline: "none",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="studio-active-tab-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 999,
                    backgroundColor: "#ffffff",
                    zIndex: 0,
                  }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Language filters, Export, ⌘K, Close */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Language Filter Chips */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {languages.slice(0, 3).map((lang) => {
            const isSelected = selectedLang === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => onSelectLang(isSelected ? null : lang)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: isSelected ? "#ffffff" : "rgba(255,255,255,0.12)",
                  background: isSelected ? "rgba(255,255,255,0.15)" : "transparent",
                  color: isSelected ? "#ffffff" : "rgba(255,255,255,0.6)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: isSelected ? "#ffffff" : "rgba(255,255,255,0.4)",
                  }}
                />
                {lang}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 16, backgroundColor: "rgba(255, 255, 255, 0.15)" }} />

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          style={{
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            color: copied ? "#ffffff" : "rgba(255,255,255,0.7)",
            background: copied ? "rgba(255,255,255,0.15)" : "transparent",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 999,
            padding: "4px 12px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {copied ? "✓ Copied" : "Share"}
        </button>

        {/* Export Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 999,
              padding: "4px 12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>Export</span>
            <span style={{ fontSize: "0.55rem" }}>▼</span>
          </button>

          <AnimatePresence>
            {exportOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  background: "#121215",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  minWidth: 160,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                {[
                  { label: "Export JSON", format: "json" as const },
                  { label: "Export Mermaid", format: "mermaid" as const },
                  { label: "Export PlantUML", format: "plantuml" as const },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      onExport(opt.format);
                      setExportOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.8)",
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Close Studio Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            display: "inline-grid",
            placeItems: "center",
            cursor: "pointer",
            fontSize: "0.8125rem",
            marginLeft: 4,
          }}
          title="Exit to Dashboard Hub"
        >
          ✕
        </button>
      </div>
    </header>
  );
}

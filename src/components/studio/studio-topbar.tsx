import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sun, Moon } from "lucide-react";
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
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onStartTour?: () => void;
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
  theme = "dark",
  onToggleTheme,
  onStartTour,
}: StudioTopbarProps) {
  const repoLabel = repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");
  const [branchOpen, setBranchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLight = theme === "light";

  const handleShare = () => {
    onExport("share");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header
      className="dx-studio-topbar"
      style={{
        minHeight: 56,
        borderBottom: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.12)"}`,
        backgroundColor: isLight ? "#ffffff" : "#09090b",
        color: isLight ? "#09090b" : "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(10px, 2vw, 16px)",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        position: "relative",
        zIndex: 40,
        flexShrink: 0,
        gap: 10,
        transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
      }}
    >
      {/* Left: Brand & Repo Breadcrumb */}
      <div className="dx-studio-topbar-left" style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 1.5vw, 14px)", minWidth: 0 }}>
        <a
          href="/dashboard"
          className="dx-studio-brand"
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
            color: isLight ? "#09090b" : "#ffffff",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: isLight ? "#09090b" : "#ffffff",
              display: "inline-block",
            }}
          />
          <span className="dx-studio-brand-main">DevLens</span>
          <span className="dx-studio-brand-sub" style={{ opacity: 0.65 }}>· Studio</span>
        </a>

        <div className="dx-studio-divider" style={{ width: 1, height: 16, backgroundColor: isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)", flexShrink: 0 }} />

        {/* Repo Label */}
        <div className="dx-studio-repo-info" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", minWidth: 0 }}>
          <span
            className="dx-studio-repo-tag"
            style={{
              color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.5)",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              flexShrink: 0,
            }}
          >
            repo:
          </span>
          <span
            className="dx-studio-repo-name"
            title={repoLabel}
            style={{
              fontWeight: 500,
              letterSpacing: "-0.01em",
              maxWidth: "clamp(90px, 16vw, 220px)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {repoLabel}
          </span>

          {/* Branch Dropdown */}
          <div className="dx-studio-branch-wrap" style={{ position: "relative", flexShrink: 0 }}>
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
        className="dx-studio-topbar-center"
      >
        <div
          className="dx-studio-tabs-nav"
          data-tour="studio-tabs"
          style={{
            display: "flex",
            gap: 4,
            padding: 3,
            borderRadius: 999,
            border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.09)" : "rgba(255, 255, 255, 0.14)"}`,
            background: isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.03)",
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
                  color: isActive
                    ? isLight
                      ? "#ffffff"
                      : "#000000"
                    : isLight
                    ? "rgba(9, 9, 11, 0.65)"
                    : "rgba(255, 255, 255, 0.65)",
                  fontWeight: isActive ? 600 : 400,
                  outline: "none",
                  flexShrink: 0,
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
                      backgroundColor: isLight ? "#09090b" : "#ffffff",
                      zIndex: 0,
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Language filters, Export, Theme, Close */}
      <div className="dx-studio-topbar-right" style={{ display: "flex", alignItems: "center", gap: "clamp(6px, 1.2vw, 10px)", flexShrink: 0 }}>
        {/* Language Filter Chips */}
        <div className="dx-studio-lang-chips" style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
                  borderColor: isSelected ? (isLight ? "#09090b" : "#ffffff") : (isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"),
                  background: isSelected ? (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)") : "transparent",
                  color: isSelected ? (isLight ? "#09090b" : "#ffffff") : (isLight ? "rgba(9,9,11,0.6)" : "rgba(255,255,255,0.6)"),
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
                    background: isSelected ? (isLight ? "#09090b" : "#ffffff") : (isLight ? "rgba(9,9,11,0.4)" : "rgba(255,255,255,0.4)"),
                  }}
                />
                {lang}
              </button>
            );
          })}
        </div>

        <div className="dx-studio-divider" style={{ width: 1, height: 16, backgroundColor: isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)" }} />

        {/* Share Button */}
        <button
          type="button"
          className="dx-studio-share-btn"
          onClick={handleShare}
          style={{
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            color: copied ? (isLight ? "#09090b" : "#ffffff") : (isLight ? "rgba(9,9,11,0.7)" : "rgba(255,255,255,0.7)"),
            background: copied ? (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)") : "transparent",
            border: `1px solid ${isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.14)"}`,
            borderRadius: 999,
            padding: "4px 12px",
            cursor: "pointer",
            transition: "all 0.2s",
            flexShrink: 0,
          }}
        >
          {copied ? "✓ Copied" : "Share"}
        </button>

        {/* Export Dropdown */}
        <div className="dx-studio-export-wrap" style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            className="dx-studio-export-btn"
            onClick={() => setExportOpen((v) => !v)}
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              color: isLight ? "rgba(9,9,11,0.7)" : "rgba(255,255,255,0.7)",
              background: "transparent",
              border: `1px solid ${isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.14)"}`,
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

        {/* Workspace Guided Tour Trigger */}
        {onStartTour && (
          <button
            type="button"
            className="dx-studio-tour-btn"
            data-tour="studio-tour-trigger"
            onClick={onStartTour}
            aria-label="Start workspace tour"
            title="Start workspace walkthrough"
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: isLight ? "#09090b" : "#f4f4f5",
              background: isLight ? "rgba(9, 9, 11, 0.04)" : "rgba(255, 255, 255, 0.06)",
              border: `1px solid ${isLight ? "#71717a" : "#6b6b76"}`,
              borderRadius: 6,
              minHeight: 32,
              padding: "0 10px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              transition: "background-color 0.15s ease, border-color 0.15s ease, transform 0.12s ease",
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true">?</span>
            <span>Tour</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            type="button"
            className="dx-studio-theme-btn"
            onClick={onToggleTheme}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: `1px solid ${isLight ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.15)"}`,
              background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
              color: isLight ? "#09090b" : "#ffffff",
              display: "inline-grid",
              placeItems: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            title={isLight ? "Switch to Dark Studio" : "Switch to Light Studio"}
          >
            {isLight ? <Moon size={14} strokeWidth={2} /> : <Sun size={14} strokeWidth={2} />}
          </button>
        )}

        {/* Close Studio Button */}
        <button
          type="button"
          className="dx-studio-close-btn"
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: `1px solid ${isLight ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.15)"}`,
            background: "transparent",
            color: isLight ? "rgba(9,9,11,0.7)" : "rgba(255,255,255,0.7)",
            display: "inline-grid",
            placeItems: "center",
            cursor: "pointer",
            fontSize: "0.875rem",
            marginLeft: 2,
            flexShrink: 0,
          }}
          title="Exit to Dashboard Hub"
        >
          ✕
        </button>
      </div>
    </header>
  );
}

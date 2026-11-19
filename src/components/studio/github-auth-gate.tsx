import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FolderGit2,
  GitBranch,
  KeyRound,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export interface GitHubAuthGateProps {
  repoUrl: string;
  onClose: () => void;
  onSuccess?: () => void;
}

function GitHubIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function GitHubAuthGate({ repoUrl, onClose, onSuccess }: GitHubAuthGateProps) {
  const { loginWithGitHub, loginWithToken } = useAuth();

  const [showPatInput, setShowPatInput] = useState(false);
  const [patValue, setPatValue] = useState("");
  const [patLoading, setPatLoading] = useState(false);
  const [patError, setPatError] = useState("");

  const cleanRepo = useMemo(() => {
    return repoUrl
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/+$/, "")
      .replace(/\.git$/, "");
  }, [repoUrl]);

  const [owner, repoName] = useMemo(() => {
    const parts = cleanRepo.split("/");
    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join("/")];
    }
    return ["github", cleanRepo || "repository"];
  }, [cleanRepo]);

  const handleOAuthLogin = () => {
    try {
      localStorage.setItem("devlens_pending_repo", repoUrl);
    } catch {
      // storage unavailable
    }
    loginWithGitHub();
  };

  const handlePatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patValue.trim()) return;
    setPatLoading(true);
    setPatError("");
    try {
      await loginWithToken(patValue.trim());
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to verify Personal Access Token.";
      setPatError(msg);
    } finally {
      setPatLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#f9fafb",
        color: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        padding: "clamp(20px, 3vw, 32px)",
        fontFamily: "var(--mf-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
      }}
    >
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <header
        style={{
          width: "100%",
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 20,
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 2,
              fontSize: "1.25rem",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: "#0a0a0a",
            }}
          >
            <span>DevLens</span>
            <span style={{ fontWeight: 400, opacity: 0.55, fontSize: "0.85em" }}>.ai</span>
          </div>

          <div style={{ height: 18, width: 1, backgroundColor: "#e5e7eb" }} />

          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: "0.75rem",
              color: "#4b5563",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FolderGit2 size={13} style={{ color: "#0a0a0a" }} />
            <span>
              {owner} / <strong style={{ color: "#0a0a0a", fontWeight: 600 }}>{repoName}</strong>
            </span>
            <span style={{ color: "#d1d5db" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#6b7280" }}>
              <GitBranch size={11} />
              HEAD
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 999,
            padding: "6px 14px",
            fontSize: "0.75rem",
            color: "#4b5563",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#0a0a0a";
            e.currentTarget.style.borderColor = "#9ca3af";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#4b5563";
            e.currentTarget.style.borderColor = "#e5e7eb";
          }}
        >
          Cancel
        </button>
      </header>

      {/* ── Focused Auth Card ────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          padding: "24px 0 48px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 540,
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: "clamp(28px, 4vw, 40px)",
            boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* Headline & Description */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(1.5rem, 2.5vw, 1.875rem)",
                fontWeight: 600,
                color: "#0a0a0a",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              Sign in to access the workspace
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.9375rem",
                color: "#4b5563",
                lineHeight: 1.5,
              }}
            >
              Sign in with your GitHub account to analyze repositories, inspect AST dependency
              graphs, and save analysis sessions.
            </p>
          </div>

          {/* Target Repo Snapshot Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#f9fafb",
              border: "1px solid #f3f4f6",
              borderRadius: 10,
              padding: "12px 16px",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FolderGit2 size={16} style={{ color: "#0a0a0a", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#111827" }}>
                  {cleanRepo}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Queued for workspace analysis
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                color: "#2563eb",
                backgroundColor: "#eff6ff",
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              Authentication required
            </span>
          </div>

          {/* Primary Action Button */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <motion.button
              type="button"
              onClick={handleOAuthLogin}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                backgroundColor: "#0a0a0a",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                padding: "14px 20px",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
                transition: "background 0.15s ease",
              }}
            >
              <GitHubIcon size={18} />
              <span>Sign in with GitHub</span>
              <ArrowRight size={15} style={{ marginLeft: 2 }} />
            </motion.button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                padding: "8px 0",
                color: "#6b7280",
                fontSize: "0.8125rem",
                cursor: "pointer",
                textAlign: "center",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0a0a0a")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
            >
              Back to Dashboard
            </button>
          </div>

          {/* Personal Access Token (PAT) Option */}
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowPatInput((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#4b5563",
                fontSize: "0.8125rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0a0a0a")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}
            >
              <KeyRound size={14} />
              <span>{showPatInput ? "Hide token input" : "Use a GitHub Personal Access Token"}</span>
            </button>

            <AnimatePresence>
              {showPatInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden", marginTop: 12 }}
                >
                  <form
                    onSubmit={handlePatSubmit}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      backgroundColor: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="password"
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={patValue}
                        onChange={(e) => setPatValue(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          fontFamily: "monospace",
                          fontSize: "0.8125rem",
                          backgroundColor: "#ffffff",
                          outline: "none",
                        }}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={patLoading || !patValue.trim()}
                        style={{
                          backgroundColor: "#0a0a0a",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 14px",
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          cursor: patLoading || !patValue.trim() ? "not-allowed" : "pointer",
                          opacity: patLoading || !patValue.trim() ? 0.6 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {patLoading ? (
                          <>
                            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                            <span>Verifying</span>
                          </>
                        ) : (
                          <>
                            <span>Connect</span>
                            <CheckCircle2 size={13} />
                          </>
                        )}
                      </button>
                    </div>

                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      Requires <code>read:user</code> and <code>repo</code> scopes. Useful for
                      private organizational codebases.
                    </span>

                    {patError && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: "0.75rem",
                          color: "#dc2626",
                          backgroundColor: "#fef2f2",
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #fecaca",
                        }}
                      >
                        <ShieldAlert size={13} />
                        <span>{patError}</span>
                      </div>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Privacy Note */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.75rem",
              color: "#6b7280",
            }}
          >
            <Lock size={12} style={{ color: "#9ca3af" }} />
            <span>Read-only access. DevLens does not write to your GitHub repositories.</span>
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  KeyRound,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Hoopshots404 } from "@/components/ui/hoopshots-404";

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
  const [patBtnHover, setPatBtnHover] = useState(false);

  const cleanRepo = useMemo(() => {
    return repoUrl
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/+$/, "")
      .replace(/\.git$/, "");
  }, [repoUrl]);

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

  const topHeader = (
    <header
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px clamp(20px, 4.6%, 48px)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 1,
          fontSize: "1.25rem",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: "#0a0a0a",
          pointerEvents: "auto",
        }}
      >
        <span>DevLens</span>
        <span style={{ fontWeight: 400, opacity: 0.55, fontSize: "0.85em" }}>.ai</span>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          pointerEvents: "auto",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
          borderRadius: 999,
          padding: "7px 16px",
          fontSize: "0.78rem",
          fontWeight: 500,
          color: "#374151",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#0a0a0a";
          e.currentTarget.style.borderColor = "#0a0a0a";
          e.currentTarget.style.color = "#ffffff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#ffffff";
          e.currentTarget.style.borderColor = "#e5e7eb";
          e.currentTarget.style.color = "#374151";
        }}
      >
        <ArrowLeft size={13} />
        <span>Back to Dashboard</span>
      </button>
    </header>
  );

  const patToggleBtn = (
    <button
      type="button"
      onClick={() => setShowPatInput((prev) => !prev)}
      onPointerEnter={() => setPatBtnHover(true)}
      onPointerLeave={() => setPatBtnHover(false)}
      style={{
        minHeight: 44,
        padding: "0 22px",
        borderRadius: 999,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: "0.9375rem",
        fontWeight: 500,
        boxSizing: "border-box",
        border: "2px solid #1B1C20",
        backgroundColor: showPatInput || patBtnHover ? "#f3f4f6" : "#ffffff",
        color: "#1B1C20",
        transition: "all 0.15s ease",
      }}
    >
      <KeyRound size={15} />
      <span>{showPatInput ? "Hide Access Token" : "Use Access Token"}</span>
    </button>
  );

  const patDrawer = (
    <AnimatePresence>
      {showPatInput && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          style={{
            marginTop: 14,
            width: "100%",
            maxWidth: 480,
            zIndex: 15,
            position: "relative",
          }}
        >
          <form
            onSubmit={handlePatSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              backgroundColor: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid #e5e7eb",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.08)",
              borderRadius: 20,
              padding: "14px 16px",
              textAlign: "left",
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
                  padding: "9px 14px",
                  borderRadius: 999,
                  border: "1px solid #d1d5db",
                  fontFamily: "monospace",
                  fontSize: "0.8125rem",
                  backgroundColor: "#ffffff",
                  color: "#111827",
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
                  borderRadius: 999,
                  padding: "9px 18px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: patLoading || !patValue.trim() ? "not-allowed" : "pointer",
                  opacity: patLoading || !patValue.trim() ? 0.55 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "opacity 0.15s ease",
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

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.74rem",
                color: "#6b7280",
                padding: "0 4px",
              }}
            >
              <span>
                Requires <code>read:user</code> and <code>repo</code> scopes.
              </span>
            </div>

            {patError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.75rem",
                  color: "#dc2626",
                  backgroundColor: "#fef2f2",
                  padding: "7px 12px",
                  borderRadius: 12,
                  border: "1px solid #fecaca",
                }}
              >
                <ShieldAlert size={13} style={{ flexShrink: 0 }} />
                <span>{patError}</span>
              </div>
            )}
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const bottomRightNote = (
    <div
      style={{
        position: "absolute",
        right: "4.6%",
        bottom: "5%",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "10px 16px",
        borderRadius: 999,
        backgroundColor: "#f9fafb",
        border: "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
        color: "#4b5563",
        fontSize: "0.75rem",
        fontWeight: 500,
        zIndex: 6,
      }}
    >
      <Lock size={12} style={{ color: "#111827" }} />
      <span>Read-only access · No repository writes</span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      <Hoopshots404
        codeVariant="401"
        wallColor="#ffffff"
        glassColor="rgba(249, 250, 251, 0.92)"
        numeralColor="#111827"
        textColor="#0a0a0a"
        mutedColor="#4b5563"
        buttonColor="#0a0a0a"
        topPadding={68}
        numeralFont={{ fontSize: 215 }}
        playTitle="Sign in to access the workspace"
        playText={`Connect your GitHub account to open ${cleanRepo}.\nOr take a few shots while you're here.`}
        winTitle="Nice shot. {made} of {total} made."
        winText={`Sign in with GitHub below to open ${cleanRepo}.`}
        loseTitle="{made} of {total} made."
        loseText={`Sign in with GitHub to open ${cleanRepo}, or play another round.`}
        instruction="Drag the ball down to aim, then release. Make {threshold} of {total}."
        madeText="Made it. {made} of {total} so far, {left} left."
        missText="Missed. {made} of {total} so far, {left} left."
        safeText="{made} of {total} made. {left} shots left."
        outText="{made} of {total} so far. {left} shots left."
        lastShotLabel="Last shot"
        lastShotText="{made} of {total} so far. Sink this one to take the round."
        lastShotSafeText="{made} of {total} made. One shot left."
        homeLabel="Sign in with GitHub"
        onPrimaryAction={handleOAuthLogin}
        primaryIcon={<GitHubIcon size={18} />}
        iconPlay="arrow-right"
        iconResult="arrow-right"
        iconPosition="right"
        replayLabel="Play again"
        retryLimit={99}
        totalShots={5}
        winThreshold={3}
        showConfetti={true}
        showWalkthrough={true}
        topSlot={topHeader}
        extraActions={patToggleBtn}
        belowActionsSlot={patDrawer}
        bottomRightSlot={bottomRightNote}
      />
    </div>
  );
}

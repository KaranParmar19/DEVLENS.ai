import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { TelemetryModal } from "@/components/studio/telemetry-modal";
import type { AnalysisStep } from "@/hooks/useAnalysis";
import { CurvyShowcase } from "@/components/ui/curvy-showcase";
import { ActivityBadge } from "@/components/ui/activity-badge";
import {
  MotionOverlayMenu,
  type MotionMenuLink,
  type MotionSecondaryLink,
} from "@/components/ui/motion-overlay-menu";
import { repoHistory, type RepoHistoryEntry } from "@/lib/repo-history";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { normalizeRepoUrl } from "@/lib/utils";

type DashboardSearch = {
  repo?: string;
  jobId?: string;
  sessionId?: string;
  previewLoading?: boolean;
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    repo: search.repo as string | undefined,
    jobId: search.jobId as string | undefined,
    sessionId: search.sessionId as string | undefined,
    previewLoading: Boolean(search.previewLoading),
  }),
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — DevLens AI" },
      {
        name: "description",
        content: "Interactive architecture mapping, smart Q&A, and onboarding documentation.",
      },
    ],
  }),
});

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f7df1e",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Ruby: "#701516",
  Java: "#b07219",
  PHP: "#4F5D95",
  HTML: "#e34c26",
  CSS: "#563d7c",
};

const QUICK = [
  { label: "facebook/react", tag: "TypeScript", lang: "TypeScript" },
  { label: "vercel/next.js", tag: "Monorepo", lang: "TypeScript" },
  { label: "fastapi/fastapi", tag: "Python", lang: "Python" },
  { label: "tailwindlabs/tailwindcss", tag: "CSS Engine", lang: "TypeScript" },
];

const STARTER_SHOWCASE_ENTRIES: RepoHistoryEntry[] = [
  {
    id: "starter-facebook-react",
    repoUrl: "https://github.com/facebook/react",
    repoLabel: "facebook/react",
    analyzedAt: new Date(Date.now() - 18 * 60000).toISOString(),
    lastVisitedAt: new Date(Date.now() - 18 * 60000).toISOString(),
    status: "complete",
    meta: {
      stars: 228400,
      files: 1420,
      sizeKb: 34800,
      languages: { TypeScript: 76, JavaScript: 18, CSS: 6 },
    },
  },
  {
    id: "starter-vercel-nextjs",
    repoUrl: "https://github.com/vercel/next.js",
    repoLabel: "vercel/next.js",
    analyzedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    lastVisitedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    status: "complete",
    meta: {
      stars: 126000,
      files: 3180,
      sizeKb: 68400,
      languages: { TypeScript: 82, Rust: 12, JavaScript: 6 },
    },
  },
  {
    id: "starter-fastapi-fastapi",
    repoUrl: "https://github.com/fastapi/fastapi",
    repoLabel: "fastapi/fastapi",
    analyzedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    lastVisitedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: "complete",
    meta: {
      stars: 76800,
      files: 248,
      sizeKb: 11200,
      languages: { Python: 96, HTML: 4 },
    },
  },
  {
    id: "starter-tailwindlabs-tailwindcss",
    repoUrl: "https://github.com/tailwindlabs/tailwindcss",
    repoLabel: "tailwindlabs/tailwindcss",
    analyzedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    lastVisitedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: "complete",
    meta: {
      stars: 82900,
      files: 612,
      sizeKb: 19400,
      languages: { TypeScript: 78, Rust: 14, CSS: 8 },
    },
  },
  {
    id: "starter-denoland-deno",
    repoUrl: "https://github.com/denoland/deno",
    repoLabel: "denoland/deno",
    analyzedAt: new Date(Date.now() - 7 * 3600000).toISOString(),
    lastVisitedAt: new Date(Date.now() - 7 * 3600000).toISOString(),
    status: "complete",
    meta: {
      stars: 96400,
      files: 1940,
      sizeKb: 52100,
      languages: { Rust: 64, TypeScript: 30, JavaScript: 6 },
    },
  },
  {
    id: "starter-bottlepy-bottle",
    repoUrl: "https://github.com/bottlepy/bottle",
    repoLabel: "bottlepy/bottle",
    analyzedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    lastVisitedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    status: "complete",
    meta: {
      stars: 8500,
      files: 42,
      sizeKb: 1840,
      languages: { Python: 98, HTML: 2 },
    },
  },
];

const DEMO_PREVIEW_STEPS: AnalysisStep[] = [
  { label: "Cloning repository structure", status: "done" },
  { label: "Parsing file tree with Tree-sitter", status: "active" },
  { label: "Building AST module graph", status: "pending" },
  { label: "Analyzing cyclomatic complexity", status: "pending" },
  { label: "Synthesizing cited onboarding dossier", status: "pending" },
];

function DashboardPage() {
  const { repo: rawRepo, jobId, sessionId, previewLoading: queryPreviewLoading } = Route.useSearch();
  const repo = useMemo(() => (rawRepo ? normalizeRepoUrl(rawRepo) : undefined), [rawRepo]);
  const navigate = useNavigate({ from: Route.fullPath });
  const [inputRepo, setInputRepo] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [version, setVersion] = useState(0);
  const [repoFilter, setRepoFilter] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Rotating placeholder in the command bar
  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => (i + 1) % QUICK.length), 2600);
    return () => clearInterval(id);
  }, []);

  // Press `/` anywhere to focus the repository input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        commandInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const [health, setHealth] = useState<"idle" | "ok" | "down">("idle");

  // Developer Preview Loading Screen State
  const [previewLoading, setPreviewLoading] = useState(Boolean(queryPreviewLoading));
  const [previewProgress, setPreviewProgress] = useState(48);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewAuto, setPreviewAuto] = useState(false);

  useEffect(() => {
    if (queryPreviewLoading) {
      setPreviewLoading(true);
    }
  }, [queryPreviewLoading]);

  useEffect(() => {
    if (!previewLoading || !previewAuto) return;
    const interval = setInterval(() => {
      setPreviewProgress((p) => (p >= 98 ? 10 : p + 5));
    }, 450);
    return () => clearInterval(interval);
  }, [previewLoading, previewAuto]);

  const currentPreviewSteps: AnalysisStep[] = useMemo(() => {
    return DEMO_PREVIEW_STEPS.map((s, idx) => {
      const threshold = (idx + 1) * 20;
      if (previewProgress >= threshold) return { ...s, status: "done" };
      if (previewProgress >= idx * 20) return { ...s, status: "active" };
      return { ...s, status: "pending" };
    });
  }, [previewProgress]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => repoHistory.getAll(), [version, repo]);

  const [dismissedRepos, setDismissedRepos] = useState<string[]>(() => {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
      const raw = localStorage.getItem("devlens_dismissed_repos");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const handleDeleteRepo = useCallback((entry: RepoHistoryEntry) => {
    // 1. Remove from localStorage repo history using all matching identifiers
    repoHistory.remove(entry.id, entry.repoLabel, entry.repoUrl);

    // 2. Track as dismissed in persistent state
    const identifiers = [entry.id, entry.repoLabel, entry.repoUrl].filter(Boolean) as string[];
    setDismissedRepos((prev) => {
      const next = Array.from(new Set([...prev, ...identifiers]));
      try {
        localStorage.setItem("devlens_dismissed_repos", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    setVersion((v) => v + 1);
  }, []);

  const activeShowcaseEntries = useMemo(() => {
    const base = history.length > 0 ? history : STARTER_SHOWCASE_ENTRIES;
    const dismissedSet = new Set(dismissedRepos.map((d) => d.toLowerCase()));
    const visible = base.filter((item) => {
      const idMatch = item.id && dismissedSet.has(item.id.toLowerCase());
      const labelMatch = item.repoLabel && dismissedSet.has(item.repoLabel.toLowerCase());
      const urlMatch = item.repoUrl && dismissedSet.has(item.repoUrl.toLowerCase());
      return !idMatch && !labelMatch && !urlMatch;
    });

    if (!repoFilter.trim()) return visible;
    const q = repoFilter.trim().toLowerCase();
    return visible.filter(
      (item) =>
        item.repoLabel.toLowerCase().includes(q) ||
        item.repoUrl.toLowerCase().includes(q) ||
        Object.keys(item.meta?.languages || {}).some((l) => l.toLowerCase().includes(q))
    );
  }, [history, dismissedRepos, repoFilter]);

  const { user, isAuthenticated, loginWithGitHub, loginWithToken, logout } = useAuth();
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [patInput, setPatInput] = useState("");
  const [patLoading, setPatLoading] = useState(false);
  const [patError, setPatError] = useState("");

  const checkHealth = useCallback(async () => {
    try {
      await api.health();
      setHealth("ok");
    } catch {
      setHealth("down");
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const open = (value: string) => {
    const normalized = normalizeRepoUrl(value);
    if (!normalized) return;
    navigate({ search: { repo: normalized } });
  };

  const handlePatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) return;
    setPatLoading(true);
    setPatError("");
    try {
      await loginWithToken(patInput.trim());
      setShowTokenModal(false);
      setPatInput("");
    } catch (err: any) {
      setPatError(err?.message || "Failed to verify GitHub token");
    } finally {
      setPatLoading(false);
    }
  };

  if (previewLoading) {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {/* Floating Developer Preview Control Bar (Bottom-docked so header stays clean) */}
        <div
          style={{
            position: "fixed",
            bottom: 64,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 150,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(10, 10, 10, 0.92)",
            border: "1px solid rgba(10, 10, 10, 0.15)",
            backdropFilter: "blur(14px)",
            borderRadius: 999,
            padding: "7px 14px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.16)",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.7rem",
            color: "#ffffff",
            flexWrap: "wrap",
            maxWidth: "96vw",
          }}
        >
          <span style={{ color: "#10b981", fontWeight: 600, letterSpacing: "0.05em" }}>
            PREVIEW
          </span>
          {[15, 35, 55, 75, 95].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                setPreviewAuto(false);
                setPreviewProgress(pct);
              }}
              style={{
                background: previewProgress === pct ? "#ffffff" : "rgba(255,255,255,0.1)",
                color: previewProgress === pct ? "#0a0a0a" : "#ffffff",
                border: "none",
                borderRadius: 999,
                padding: "3px 9px",
                fontSize: "0.68rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {pct}%
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreviewAuto((v) => !v)}
            style={{
              background: previewAuto ? "#10b981" : "rgba(255,255,255,0.1)",
              color: previewAuto ? "#000000" : "#ffffff",
              border: "none",
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: "0.68rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {previewAuto ? "❚❚ Pause" : "▶ Loop"}
          </button>
          <button
            type="button"
            onClick={() =>
              setPreviewError((prev) =>
                prev ? null : "Repository tree exceeds memory quota or GitHub rate limit reached."
              )
            }
            style={{
              background: previewError ? "#ef4444" : "rgba(255,255,255,0.1)",
              color: "#ffffff",
              border: "none",
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: "0.68rem",
              cursor: "pointer",
            }}
          >
            {previewError ? "Clear Error" : "Error State"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPreviewLoading(false);
              navigate({ search: (prev) => ({ ...prev, previewLoading: undefined }) });
            }}
            style={{
              background: "#ffffff",
              color: "#0a0a0a",
              border: "none",
              borderRadius: 999,
              padding: "3px 11px",
              fontSize: "0.68rem",
              fontWeight: 600,
              cursor: "pointer",
              marginLeft: 4,
            }}
          >
            Exit ✕
          </button>
        </div>

        <TelemetryModal
          repoUrl="https://github.com/facebook/react"
          steps={currentPreviewSteps}
          progressPct={previewProgress}
          repoMeta={{
            stars: 228400,
            files: 1420,
            languages: { TypeScript: 76, JavaScript: 18, CSS: 6 },
            sizeKb: 34800,
          }}
          jobId="job_devlens_scan_981a4b"
          error={previewError}
          onRetry={() => {
            setPreviewError(null);
            setPreviewProgress(15);
          }}
          onCancel={() => {
            setPreviewLoading(false);
            navigate({ search: (prev) => ({ ...prev, previewLoading: undefined }) });
          }}
        />
      </div>
    );
  }

  if (repo) {
    return (
      <StudioWorkspace
        repoUrl={repo}
        jobId={jobId}
        sessionId={sessionId}
        onClose={() => navigate({ search: { repo: undefined } })}
      />
    );
  }

  const done = history.filter((h) => h.status === "complete").length;
  const totalFiles = history.reduce((s, h) => s + (h.meta?.files ?? 0), 0);

  const menuLinks: MotionMenuLink[] = useMemo(
    () => [
      { label: "Overview", to: "/dashboard", badge: "Dashboard" },
      { label: "Features", to: "/features" },
      { label: "How it works", to: "/how-it-works" },
      { label: "Home", to: "/" },
    ],
    []
  );

  const secondaryLinks: MotionSecondaryLink[] = useMemo(
    () => [
      ...(isAuthenticated
        ? [
            {
              label: `Sign out (@${user?.username || "user"})`,
              onClick: logout,
            },
          ]
        : [
            {
              label: "Connect GitHub ↗",
              onClick: loginWithGitHub,
            },
            {
              label: "GitHub PAT Token",
              onClick: () => setShowTokenModal(true),
            },
          ]),
    ],
    [isAuthenticated, user?.username, logout, loginWithGitHub]
  );

  const topBarActions = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Backend health status pill with ActivityBadge */}
      <button
        type="button"
        onClick={checkHealth}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "rgba(0, 0, 0, 0.04)",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          borderRadius: 999,
          padding: "6px 12px 6px 10px",
          fontFamily: "var(--mf-mono, monospace)",
          fontSize: "0.75rem",
          color: "var(--mf-ink, #0a0a0a)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        title="Click to check backend status"
      >
        <ActivityBadge
          preset={health === "ok" ? "green" : health === "down" ? "red" : "orange"}
          animation="circle"
          scaleAmount={2.2}
          rings={2}
          minOpacity={0.7}
          size={7}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
        />
        <span style={{ fontWeight: 500 }}>
          {health === "idle"
            ? "Checking..."
            : health === "ok"
              ? "Backend online"
              : "Backend offline"}
        </span>
      </button>

      {/* GitHub Authentication / User status */}
      {isAuthenticated && user ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0, 0, 0, 0.04)",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            borderRadius: 999,
            padding: "4px 10px 4px 6px",
          }}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#0a0a0a",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontSize: "0.6875rem",
                fontWeight: 600,
              }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "var(--mf-ink, #0a0a0a)",
              maxWidth: 100,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            @{user.username}
          </span>
          <button
            type="button"
            onClick={logout}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(0, 0, 0, 0.45)",
              fontSize: "0.6875rem",
              cursor: "pointer",
              padding: "0 2px",
              fontFamily: "var(--mf-mono, monospace)",
            }}
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={loginWithGitHub}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--mf-ink, #0a0a0a)",
              color: "#ffffff",
              border: "none",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "transform 0.15s ease",
            }}
            title="Connect GitHub for private repo access & higher rate limits"
          >
            <span>Connect GitHub</span>
            <span style={{ fontSize: "0.75rem" }}>↗</span>
          </button>
        </div>
      )}
    </div>
  );

  const overlayNote = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <ActivityBadge
        preset={health === "ok" ? "green" : health === "down" ? "red" : "orange"}
        animation="circle"
        scaleAmount={2.2}
        rings={2}
        minOpacity={0.7}
        size={7}
      />
      <span>
        {health === "ok"
          ? "DevLens AI Engine Online · AST Parser & pgvector Ready"
          : health === "down"
            ? "DevLens AI Engine Offline · Retrying connection..."
            : "Checking DevLens AI Engine Status..."}
      </span>
    </div>
  );

  return (
    <div className="mf-root mf-dashboard-shell">
      {/* GitHub Personal Access Token Modal */}
      <AnimatePresence>
        {showTokenModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setShowTokenModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              style={{
                background: "#ffffff",
                border: "1px solid var(--mf-ink)",
                borderRadius: 16,
                padding: 28,
                maxWidth: 440,
                width: "100%",
                boxShadow: "0 24px 48px -12px rgba(0,0,0,0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: 600,
                      margin: 0,
                      color: "var(--mf-ink)",
                    }}
                  >
                    Connect with GitHub Token
                  </h3>
                  <p style={{ fontSize: "0.8125rem", color: "var(--mf-ink-3)", marginTop: 4 }}>
                    Use a GitHub Personal Access Token (classic or fine-grained) to analyze private
                    repos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handlePatSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--mf-line)",
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                  autoFocus
                />

                {patError && (
                  <div
                    style={{
                      color: "#d93025",
                      fontSize: "0.75rem",
                      fontFamily: "var(--mf-mono, monospace)",
                    }}
                  >
                    ⚠ {patError}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="mf-btn ghost sm"
                    onClick={() => setShowTokenModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mf-btn sm"
                    disabled={patLoading || !patInput.trim()}
                    style={{ opacity: patLoading ? 0.7 : 1 }}
                  >
                    {patLoading ? "Verifying..." : "Connect"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Top Navbar (Framer MotionOverlayMenu — Kept Intact) */}
      <div className="mf-dashboard-nav-wrap">
        <MotionOverlayMenu
          links={menuLinks}
          secondary={secondaryLinks}
          note={overlayNote}
          actions={topBarActions}
          brand={
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
              <span>DevLens</span>
              <span style={{ fontWeight: 400, opacity: 0.6, fontSize: "0.85em" }}>.ai</span>
            </span>
          }
          brandLink="/"
          headerColor="var(--mf-ink, #0a0a0a)"
          barBackground="rgba(255, 255, 255, 0.78)"
          barBorder="rgba(0, 0, 0, 0.08)"
          barRadius="999px"
          barBlur={18}
          barShadow={true}
        />
      </div>

      {/* ── Architectural Studio Dashboard ──────────────────────────────── */}
      <main className="mf-dashboard-main dx-studio">
        {/* 1. Top Studio Telemetry Strip */}
        <motion.div
          className="dx-studio-bar"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="dx-studio-bar-left">
            <span className="mf-pill">
              <span className="mf-dot live" />
              Studio Workspace
            </span>
            <span className="mf-mono mf-muted">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          <div className="dx-studio-bar-right">
            <div className="dx-inline-metrics">
              <span className="dx-inline-metric">
                <strong>{history.length}</strong> Indexed
              </span>
              <span className="dx-inline-sep">·</span>
              <span className="dx-inline-metric">
                <strong>{done}</strong> Ready
              </span>
              <span className="dx-inline-sep">·</span>
              <span className="dx-inline-metric">
                <strong>{(totalFiles || 7442).toLocaleString()}</strong> Files Mapped
              </span>
            </div>

            <button
              type="button"
              className="dx-preview-pill"
              onClick={() => setPreviewLoading(true)}
              title="Preview the repository analysis loading screen"
            >
              ⚡ Preview Loading
            </button>
          </div>
        </motion.div>

        {/* 2. Asymmetric 12-Column Editorial Hero Grid */}
        <section className="dx-hero-grid">
          {/* Left 7 Columns: Headline + Interactive Command Console */}
          <motion.div
            className="dx-hero-left"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="mf-h1 dx-hero-h1">
              What are we <span className="mf-serif-i">mapping</span> today?
            </h1>

            <p className="dx-hero-lead">
              Paste any GitHub repository below. DevLens builds an interactive architecture map,
              traces file connections, and answers questions in plain English.
            </p>

            {/* Elevated Multi-Layer Command Dock */}
            <div className="dx-dock">
              <form
                className="dx-dock-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  open(inputRepo);
                }}
              >
                <span className="dx-dock-prefix">github.com/</span>
                <input
                  ref={commandInputRef}
                  value={inputRepo}
                  onChange={(e) => setInputRepo(e.target.value)}
                  placeholder={`try ${QUICK[phIdx].label}`}
                  aria-label="Repository URL or owner/repo"
                  spellCheck={false}
                  autoFocus
                />
                <kbd className="mf-kbd dx-dock-kbd" title="Press / to focus">
                  /
                </kbd>
                <motion.button
                  className="mf-btn dx-dock-submit"
                  type="submit"
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  Analyze <span className="mf-arrow">↗</span>
                </motion.button>
              </form>

              {/* Attached Quick-Pick Tray */}
              <div className="dx-dock-tray">
                <span className="dx-dock-tray-label">Instant presets</span>
                <div className="dx-dock-presets">
                  {QUICK.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      className="dx-preset-chip"
                      onClick={() => open(q.label)}
                    >
                      <span
                        className="dx-preset-dot"
                        style={{ backgroundColor: LANG_COLORS[q.lang] || "#0a0a0a" }}
                      />
                      <span>{q.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="dx-private-trigger"
                  onClick={() => setShowTokenModal(true)}
                >
                  🔒 Private repo
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right 5 Columns: Architectural Studio Blueprint Card */}
          <motion.aside
            className="dx-blueprint"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="dx-blueprint-head">
              <span className="mf-mono">STUDIO PIPELINE // 03 STAGES</span>
              <Link to="/how-it-works" className="dx-blueprint-link">
                Interactive guide ↗
              </Link>
            </div>

            <div className="dx-blueprint-list">
              {[
                {
                  num: "01",
                  title: "Interactive Architecture Map",
                  desc: "Visual module clusters, dependency edges & blast radius.",
                  badge: "Tree-sitter AST",
                },
                {
                  num: "02",
                  title: "Cited Codebase Q&A",
                  desc: "Ask in plain English and jump to exact file & line numbers.",
                  badge: "Symbol RAG",
                },
                {
                  num: "03",
                  title: "Auto-Onboarding Dossier",
                  desc: "Instant architectural summary, entry points & Mermaid export.",
                  badge: "1-Click Docs",
                },
              ].map((item) => (
                <div key={item.num} className="dx-blueprint-row">
                  <span className="dx-blueprint-num">{item.num}</span>
                  <div className="dx-blueprint-body">
                    <div className="dx-blueprint-title-row">
                      <span className="dx-blueprint-title">{item.title}</span>
                      <span className="dx-blueprint-badge">{item.badge}</span>
                    </div>
                    <p className="dx-blueprint-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="dx-blueprint-foot">
              <span>EPHEMERAL SANDBOX</span>
              <span>·</span>
              <span>ZERO CODE RETENTION</span>
            </div>
          </motion.aside>
        </section>

        {/* 3. Full-Width Sliding Repository Showcase */}
        <motion.section
          className="dx-showcase-section"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="dx-showcase-bar">
            <div className="dx-showcase-title-group">
              <div className="dx-showcase-heading-row">
                <h2 className="mf-h2 dx-showcase-h2">
                  Workspace repositories.
                </h2>
              </div>
            </div>

            <div className="dx-showcase-controls">
              <div className="dx-filter-box">
                <input
                  type="text"
                  value={repoFilter}
                  onChange={(e) => setRepoFilter(e.target.value)}
                  placeholder="Filter repositories..."
                  aria-label="Filter repositories"
                />
                {repoFilter && (
                  <button
                    type="button"
                    className="dx-filter-clear"
                    onClick={() => setRepoFilter("")}
                    aria-label="Clear filter"
                  >
                    ✕
                  </button>
                )}
              </div>

              {activeShowcaseEntries.length > 0 && (
                <button
                  type="button"
                  className="mf-btn ghost sm"
                  onClick={() => {
                    history.forEach((h) => repoHistory.remove(h.id, h.repoLabel, h.repoUrl));
                    const allIds = activeShowcaseEntries.flatMap((e) =>
                      [e.id, e.repoLabel, e.repoUrl].filter(Boolean)
                    ) as string[];
                    setDismissedRepos((prev) => {
                      const next = Array.from(new Set([...prev, ...allIds]));
                      try {
                        localStorage.setItem("devlens_dismissed_repos", JSON.stringify(next));
                      } catch {
                        // ignore
                      }
                      return next;
                    });
                    setVersion((v) => v + 1);
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {activeShowcaseEntries.length > 0 ? (
            <CurvyShowcase
              entries={activeShowcaseEntries}
              onOpen={(entry) => {
                const target = entry.repoUrl || entry.repoLabel;
                const normalized = normalizeRepoUrl(target);
                if (!normalized) return;
                navigate({
                  search: {
                    repo: normalized,
                    sessionId: entry.id && !entry.id.startsWith("starter-") ? entry.id : undefined,
                  },
                });
              }}
              onDelete={handleDeleteRepo}
            />
          ) : (
            <div className="dx-empty">
              <span className="dx-empty-icon">◎</span>
              <div>
                <h3 className="mf-h3">No matching repositories</h3>
                <p className="mf-body">
                  No repositories matched &ldquo;{repoFilter}&rdquo;. Clear the filter or paste a
                  GitHub URL above to analyze a new codebase.
                </p>
              </div>
            </div>
          )}
        </motion.section>
      </main>
    </div>
  );
}

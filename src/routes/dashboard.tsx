import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
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
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    repo: search.repo as string | undefined,
    jobId: search.jobId as string | undefined,
    sessionId: search.sessionId as string | undefined,
  }),
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard | DevLens" },
      {
        name: "description",
        content:
          "Paste a GitHub repository to inspect its file dependency graph, trace request paths, and search the code with line citations.",
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
  { label: "facebook/react", tag: "UI Runtime", lang: "TypeScript" },
  { label: "vercel/next.js", tag: "Monorepo", lang: "TypeScript" },
  { label: "fastapi/fastapi", tag: "ASGI Framework", lang: "Python" },
  { label: "tailwindlabs/tailwindcss", tag: "CSS Engine", lang: "TypeScript" },
  { label: "denoland/deno", tag: "Rust Runtime", lang: "Rust" },
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

const STUDIO_LENSES = [
  {
    id: "map",
    num: "01",
    label: "Dependency Graph",
    tag: "AST",
    summary:
      "See which files import each other and check what will break before you edit a shared module.",
    sampleRepo: "facebook/react",
  },
  {
    id: "flow",
    num: "02",
    label: "Request Tracer",
    tag: "Call path",
    summary:
      "Follow an API route or background job from the entry handler all the way to the database query.",
    sampleRepo: "fastapi/fastapi",
  },
  {
    id: "copilot",
    num: "03",
    label: "Codebase Q&A",
    tag: "Line links",
    summary:
      "Ask how a feature works in plain English. Every answer points to the exact file and line numbers.",
    sampleRepo: "vercel/next.js",
  },
  {
    id: "dossier",
    num: "04",
    label: "Onboarding Notes",
    tag: "Overview",
    summary:
      "Read a generated breakdown of the folder layout, main entry points, and recent commit activity.",
    sampleRepo: "tailwindlabs/tailwindcss",
  },
] as const;

function DashboardPage() {
  const { repo: rawRepo, jobId, sessionId } = Route.useSearch();
  const repo = useMemo(() => (rawRepo ? normalizeRepoUrl(rawRepo) : undefined), [rawRepo]);
  const navigate = useNavigate({ from: Route.fullPath });
  const [inputRepo, setInputRepo] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [version, setVersion] = useState(0);
  const [repoFilter, setRepoFilter] = useState("");
  const [langFilter, setLangFilter] = useState<string>("ALL");
  const [activeLensIdx, setActiveLensIdx] = useState<number | null>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Rotating placeholder in the command bar
  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => (i + 1) % QUICK.length), 2800);
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
    repoHistory.remove(entry.id, entry.repoLabel, entry.repoUrl);

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

  const handleRestoreStarters = useCallback(() => {
    try {
      localStorage.removeItem("devlens_dismissed_repos");
    } catch {
      // ignore
    }
    setDismissedRepos([]);
    setRepoFilter("");
    setLangFilter("ALL");
    setVersion((v) => v + 1);
  }, []);

  const activeShowcaseEntries = useMemo(() => {
    const base = history.length > 0 ? history : STARTER_SHOWCASE_ENTRIES;
    const dismissedSet = new Set(dismissedRepos.map((d) => d.toLowerCase()));
    let visible = base.filter((item) => {
      const idMatch = item.id && dismissedSet.has(item.id.toLowerCase());
      const labelMatch = item.repoLabel && dismissedSet.has(item.repoLabel.toLowerCase());
      const urlMatch = item.repoUrl && dismissedSet.has(item.repoUrl.toLowerCase());
      return !idMatch && !labelMatch && !urlMatch;
    });

    if (langFilter !== "ALL") {
      visible = visible.filter((item) =>
        Object.keys(item.meta?.languages || {}).some(
          (l) => l.toLowerCase() === langFilter.toLowerCase()
        )
      );
    }

    if (!repoFilter.trim()) return visible;
    const q = repoFilter.trim().toLowerCase();
    return visible.filter(
      (item) =>
        item.repoLabel.toLowerCase().includes(q) ||
        item.repoUrl.toLowerCase().includes(q) ||
        Object.keys(item.meta?.languages || {}).some((l) => l.toLowerCase().includes(q))
    );
  }, [history, dismissedRepos, repoFilter, langFilter]);

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
              label: "Connect GitHub",
              onClick: loginWithGitHub,
            },
            {
              label: "Personal Access Token",
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
            title="Connect GitHub for private repo access and higher rate limits"
          >
            <span>Connect GitHub</span>
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
          ? "Backend connected. Ready to index repositories."
          : health === "down"
            ? "Backend offline. Start the API server to index new repositories."
            : "Checking backend connection..."}
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
                    {patError}
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

      {/* Floating Top Navbar */}
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
          barBackground="rgba(255, 255, 255, 0.82)"
          barBorder="rgba(0, 0, 0, 0.08)"
          barRadius="999px"
          barBlur={18}
          barShadow={true}
        />
      </div>

      {/* Full-Bleed Studio Dashboard Main */}
      <main className="dx-page-main">
        {/* 01. Command Workspace Hero */}
        <section className="dx-hero-section">
          <div className="mf-wrap">
            {/* Asymmetric 2-Column Command Split */}
            <div className="dx-command-split">
              {/* Left Column: Headline + Repository Command Launcher */}
              <motion.div
                className="dx-command-col"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="dx-command-title">
                  Read any codebase <span className="dx-muted-word">without</span>
                  <br />
                  getting lost.
                </h1>

                <p className="dx-command-lead">
                  Paste a GitHub URL to see how files connect and how requests move through the
                  code. Every answer links back to the exact file and line number.
                </p>

                {/* Command Input Console */}
                <div className="dx-dock">
                  <form
                    className="dx-dock-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      open(inputRepo || QUICK[phIdx].label);
                    }}
                  >
                    <span className="dx-dock-prefix">github.com/</span>
                    <input
                      ref={commandInputRef}
                      value={inputRepo}
                      onChange={(e) => setInputRepo(e.target.value)}
                      placeholder={`owner/repo, e.g. ${QUICK[phIdx].label}`}
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
                      Open repo
                    </motion.button>
                  </form>

                  {/* Quick-Pick Presets & Private Repo Trigger */}
                  <div className="dx-dock-tray">
                    <div className="dx-dock-tray-left">
                      <span className="dx-dock-tray-label">Examples</span>
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
                    </div>

                    <button
                      type="button"
                      className="dx-private-trigger"
                      onClick={() => setShowTokenModal(true)}
                    >
                      Private repo token
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Right Column: Hover-Expandable Feature List (Initially Closed) */}
              <motion.aside
                className="dx-kinetic-ledger"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="dx-ledger-head">
                  <span className="mf-mono mf-muted">What you get</span>
                  <Link to="/how-it-works" className="dx-ledger-guide mf-mono">
                    How it works
                  </Link>
                </div>

                <div
                  className="dx-ledger-stack"
                  onMouseLeave={() => setActiveLensIdx(null)}
                >
                  {STUDIO_LENSES.map((lens, idx) => {
                    const isActive = idx === activeLensIdx;
                    return (
                      <div
                        key={lens.id}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isActive}
                        className={`dx-ledger-item ${isActive ? "is-active" : ""}`}
                        onMouseEnter={() => setActiveLensIdx(idx)}
                        onFocus={() => setActiveLensIdx(idx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open(lens.sampleRepo);
                          }
                        }}
                      >
                        <div className="dx-ledger-row-top">
                          <div className="dx-ledger-title-wrap">
                            <span className="dx-ledger-num mf-mono">{lens.num}</span>
                            <span className="dx-ledger-label">{lens.label}</span>
                          </div>
                          <span className="dx-ledger-tag mf-mono">{lens.tag}</span>
                        </div>

                        <AnimatePresence initial={false}>
                          {isActive && (
                            <motion.div
                              className="dx-ledger-expand"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <div className="dx-ledger-expand-inner">
                                <p className="dx-ledger-summary">{lens.summary}</p>
                                <div>
                                  <button
                                    type="button"
                                    className="dx-ledger-launch mf-mono"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      open(lens.sampleRepo);
                                    }}
                                  >
                                    Open {lens.sampleRepo}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.aside>
            </div>
          </div>
        </section>

        {/* 02. Sliding Repository Showcase */}
        <section className="dx-showcase-wrap">
          <div className="mf-wrap">
            <div className="dx-showcase-bar">
              <div className="dx-showcase-title-group">
                <div className="dx-showcase-heading-row">
                  <h2 className="mf-h2 dx-showcase-h2">
                    Recent <span className="dx-muted-word">repositories</span>
                  </h2>
                </div>
              </div>

              <div className="dx-showcase-controls">
                {/* Language Filter Pills */}
                <div className="dx-lang-pills">
                  {["ALL", "TypeScript", "Python", "Rust"].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`dx-lang-pill ${langFilter === lang ? "is-active" : ""}`}
                      onClick={() => setLangFilter(lang)}
                    >
                      {lang === "ALL" ? "All" : lang}
                    </button>
                  ))}
                </div>

                {/* Search / Filter Input */}
                <div className="dx-filter-box">
                  <input
                    type="text"
                    value={repoFilter}
                    onChange={(e) => setRepoFilter(e.target.value)}
                    placeholder="Filter by name or language..."
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

                {dismissedRepos.length > 0 && (
                  <button
                    type="button"
                    className="mf-btn ghost sm"
                    onClick={handleRestoreStarters}
                  >
                    Reset sample repos
                  </button>
                )}

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
                    Clear list
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
                      sessionId:
                        entry.id && !entry.id.startsWith("starter-") ? entry.id : undefined,
                    },
                  });
                }}
                onDelete={handleDeleteRepo}
              />
            ) : (
              <div className="dx-empty">
                <div style={{ flex: 1 }}>
                  <h3 className="mf-h3">No matching repositories</h3>
                  <p className="mf-body">
                    {repoFilter || langFilter !== "ALL"
                      ? "No repositories matched your filter. Clear the filter or reset the sample repositories."
                      : "You cleared the sample repositories. Paste a GitHub URL above, or bring back the sample list."}
                  </p>
                </div>
                <button type="button" className="mf-btn sm" onClick={handleRestoreStarters}>
                  Reset sample repos
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 03. Workflow Cards */}
        <section className="dx-bento-wrap">
          <div className="mf-wrap">
            <div className="dx-bento-grid">
              <div className="dx-bento-card">
                <div className="dx-bento-top">
                  <div className="dx-bento-num-badge">
                    <span className="dx-bento-dot" />
                    <span className="dx-bento-num mf-mono">01</span>
                  </div>
                  <span className="dx-bento-pill mf-mono">Dependencies</span>
                </div>
                <div className="dx-bento-body">
                  <h3 className="dx-bento-title">Spot tightly coupled files</h3>
                  <p className="dx-bento-desc">
                    Click any file in the graph to highlight its imports and dependents. Find
                    bottleneck modules before refactoring.
                  </p>
                </div>
                <div className="dx-bento-foot mf-mono">
                  <button
                    type="button"
                    className="dx-bento-link"
                    onClick={() => open("facebook/react")}
                  >
                    Inspect facebook/react
                  </button>
                </div>
              </div>

              <div className="dx-bento-card">
                <div className="dx-bento-top">
                  <div className="dx-bento-num-badge">
                    <span className="dx-bento-dot" />
                    <span className="dx-bento-num mf-mono">02</span>
                  </div>
                  <span className="dx-bento-pill mf-mono">Execution</span>
                </div>
                <div className="dx-bento-body">
                  <h3 className="dx-bento-title">Follow a request end to end</h3>
                  <p className="dx-bento-desc">
                    Pick an endpoint or worker task and step through each function call in order,
                    without grepping across ten folders.
                  </p>
                </div>
                <div className="dx-bento-foot mf-mono">
                  <button
                    type="button"
                    className="dx-bento-link"
                    onClick={() => open("fastapi/fastapi")}
                  >
                    Inspect fastapi/fastapi
                  </button>
                </div>
              </div>

              <div className="dx-bento-card">
                <div className="dx-bento-top">
                  <div className="dx-bento-num-badge">
                    <span className="dx-bento-dot" />
                    <span className="dx-bento-num mf-mono">03</span>
                  </div>
                  <span className="dx-bento-pill mf-mono">Search &amp; Docs</span>
                </div>
                <div className="dx-bento-body">
                  <h3 className="dx-bento-title">Get answers backed by code</h3>
                  <p className="dx-bento-desc">
                    Ask where authentication, caching, or routing lives and jump straight to the
                    source lines that implement it.
                  </p>
                </div>
                <div className="dx-bento-foot mf-mono">
                  <button
                    type="button"
                    className="dx-bento-link"
                    onClick={() => open("vercel/next.js")}
                  >
                    Inspect vercel/next.js
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

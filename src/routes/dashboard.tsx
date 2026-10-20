import { useMemo, useState, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
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
      { title: "Dashboard — DevLens AI" },
      {
        name: "description",
        content: "Interactive architecture mapping, smart Q&A, and onboarding documentation.",
      },
    ],
  }),
});

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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
  { label: "facebook/react", tag: "TypeScript" },
  { label: "vercel/next.js", tag: "Monorepo" },
  { label: "fastapi/fastapi", tag: "Python" },
  { label: "tailwindlabs/tailwindcss", tag: "CSS Engine" },
];

function RepoCard({
  entry,
  onOpen,
  onDelete,
}: {
  entry: RepoHistoryEntry;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const langs = Object.keys(entry.meta?.languages ?? {}).slice(0, 3);
  const files = entry.meta?.files ?? 0;
  const sizeKb = entry.meta?.sizeKb ?? 0;
  const sizeFormatted =
    sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : sizeKb ? `${sizeKb} KB` : null;
  const pct = entry.status === "complete" ? 100 : entry.status === "failed" ? 0 : 55;

  return (
    <motion.div
      className="mf-repo"
      role="button"
      tabIndex={0}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      whileHover={{
        y: -4,
        borderColor: "var(--mf-ink)",
        boxShadow: "0 14px 28px -10px rgba(0,0,0,0.14)",
      }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mf-pill">
          <span
            className={`mf-dot ${entry.status === "complete" ? "live" : ""}`}
            style={
              entry.status === "complete"
                ? { background: "#10b981" }
                : entry.status === "failed"
                  ? { background: "#ef4444" }
                  : undefined
            }
          />
          {entry.status}
        </span>
        <button
          type="button"
          aria-label="Remove repository"
          className="mf-kbd"
          style={{ cursor: "pointer", transition: "all 0.15s" }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Remove from history"
        >
          ✕
        </button>
      </div>

      <div>
        <div className="mf-h3" style={{ wordBreak: "break-all", fontSize: "1.1875rem" }}>
          {entry.repoLabel}
        </div>
        <div
          className="mf-mono mf-muted"
          style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}
        >
          <span>Analyzed {timeAgo(entry.analyzedAt)}</span>
          {sizeFormatted && <span>· {sizeFormatted}</span>}
        </div>
      </div>

      <div>
        <div className="mf-bar">
          <i
            style={{
              width: `${pct}%`,
              background: entry.status === "failed" ? "#ef4444" : "var(--mf-ink)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            className="mf-mono mf-muted"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <span>📄</span> {files ? `${files.toLocaleString()} files` : "— files"}
          </span>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {langs.map((lang) => (
              <span
                key={lang}
                className="mf-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.6875rem",
                  color: "var(--mf-ink-2)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: LANG_COLORS[lang] || "#888888",
                  }}
                />
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DashboardPage() {
  const { repo: rawRepo, jobId, sessionId } = Route.useSearch();
  const repo = useMemo(() => (rawRepo ? normalizeRepoUrl(rawRepo) : undefined), [rawRepo]);
  const navigate = useNavigate({ from: Route.fullPath });
  const [inputRepo, setInputRepo] = useState("");
  const [version, setVersion] = useState(0);
  const [health, setHealth] = useState<"idle" | "ok" | "down">("idle");
  const palette = useCommandPalette();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => repoHistory.getAll(), [version, repo]);

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

  const paletteActions = [
    {
      id: "home",
      label: "Go to Home",
      icon: "🏠",
      group: "Navigation",
      shortcut: "G H",
      onSelect: () => navigate({ to: "/" }),
    },
    ...history.map((r) => ({
      id: `recent:${r.id}`,
      label: r.repoLabel,
      description: `Last analyzed: ${new Date(r.analyzedAt).toLocaleDateString()}`,
      icon: "🗂",
      group: "Recent Repos",
      onSelect: () => navigate({ search: { repo: r.repoUrl } }),
    })),
  ];

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

  return (
    <div className="mf-root">
      <CommandPalette
        open={palette.open}
        onClose={() => palette.setOpen(false)}
        actions={paletteActions}
      />

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

      <div className="mf-app">
        <aside className="mf-side">
          <Link to="/" className="mf-logo">
            <span className="mf-logo-mark" /> DevLens
            <span className="mf-muted" style={{ fontWeight: 400 }}>
              .ai
            </span>
          </Link>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Link to="/dashboard" className="mf-side-link" data-active="true">
              Overview
            </Link>
            <Link to="/features" className="mf-side-link">
              Features
            </Link>
            <Link to="/how-it-works" className="mf-side-link">
              How it works
            </Link>
            <Link to="/pricing" className="mf-side-link">
              Pricing
            </Link>
            <Link to="/" className="mf-side-link">
              Back to site ↗
            </Link>
          </nav>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="mf-btn ghost sm" onClick={checkHealth}>
              {health === "idle"
                ? "Checking backend..."
                : health === "ok"
                  ? "● Backend online"
                  : "○ Backend offline"}
            </button>

            {isAuthenticated && user ? (
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.04)",
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "1px solid rgba(0,0,0,0.1)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#0a0a0a",
                        color: "#ffffff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        lineHeight: 1.2,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user.name || user.username}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.6875rem",
                        color: "rgba(0,0,0,0.5)",
                      }}
                    >
                      @{user.username}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 4,
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.625rem",
                      color: "#1a8838",
                    }}
                  >
                    ● GitHub linked
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "rgba(0,0,0,0.4)",
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.6875rem",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  className="mf-btn sm"
                  onClick={loginWithGitHub}
                  title="Connect GitHub for private repo access & higher rate limits"
                >
                  Connect GitHub <span className="mf-arrow">↗</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTokenModal(true)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.6875rem",
                    color: "var(--mf-ink-3)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: "2px 0",
                    textAlign: "center",
                  }}
                >
                  Or connect with token (PAT)
                </button>
              </div>
            )}

            <button type="button" className="mf-btn ghost sm" onClick={palette.toggle}>
              <span className="mf-kbd">⌘K</span> Command menu
            </button>
          </div>
        </aside>

        <main className="mf-main">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mf-hero-top" style={{ paddingBottom: 24 }}>
              <span className="mf-pill">
                <span className="mf-dot live" />
                Workspace
              </span>
              <span className="mf-mono mf-muted">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            <h1 className="mf-h1" style={{ maxWidth: "10em" }}>
              What are we <span className="mf-serif-i">mapping</span> today?
            </h1>
          </motion.div>

          <motion.form
            className="mf-ingest"
            style={{ marginTop: 36, width: "min(100%, 680px)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={(e) => {
              e.preventDefault();
              open(inputRepo);
            }}
          >
            <span className="mf-mono mf-muted">github.com/</span>
            <input
              value={inputRepo}
              onChange={(e) => setInputRepo(e.target.value)}
              placeholder="owner/repo or full URL"
              aria-label="Repository"
              spellCheck={false}
              autoFocus
            />
            <motion.button
              className="mf-btn"
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              Analyze <span className="mf-arrow">↗</span>
            </motion.button>
          </motion.form>

          <motion.div
            className="mf-chips"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.16 }}
          >
            {QUICK.map((q) => (
              <motion.button
                key={q.label}
                type="button"
                className="mf-pill mf-chip"
                whileHover={{ y: -2, scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                onClick={() => open(q.label)}
              >
                <span>{q.label}</span>
                <span style={{ opacity: 0.5, fontSize: "0.625rem" }}>({q.tag})</span>
              </motion.button>
            ))}
          </motion.div>

          <motion.div
            className="mf-grid c3"
            style={{ marginTop: 56 }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08, delayChildren: 0.22 },
              },
            }}
          >
            {[
              [String(history.length), "Repositories"],
              [String(done), "Fully indexed"],
              [totalFiles ? totalFiles.toLocaleString() : "0", "Files mapped"],
            ].map(([a, b], i) => (
              <motion.div
                key={b}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { type: "spring", stiffness: 350, damping: 26 },
                  },
                }}
                whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                className={`mf-card ${i === 0 ? "ink" : "soft"}`}
                style={{ minHeight: 170, justifyContent: "space-between" }}
              >
                <span className="mf-mono" style={{ opacity: 0.7 }}>
                  {b}
                </span>
                <span className="mf-big-stat">{a}</span>
              </motion.div>
            ))}
          </motion.div>

          <div className="mf-sec-head" style={{ marginTop: 72, marginBottom: 24 }}>
            <h2 className="mf-h2">Recent repositories</h2>
            {history.length > 0 && (
              <button
                type="button"
                className="mf-btn ghost sm"
                onClick={() => {
                  history.forEach((h) => repoHistory.remove(h.id));
                  setVersion((v) => v + 1);
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                border: "1px dashed var(--mf-line)",
                borderRadius: 20,
                padding: "36px 32px",
                background: "rgba(0,0,0,0.01)",
              }}
            >
              <div style={{ maxWidth: "34em", marginBottom: 24 }}>
                <span className="mf-pill" style={{ marginBottom: 12 }}>
                  Instant Quick-Start
                </span>
                <h3 className="mf-h3" style={{ fontSize: "1.375rem", margin: "8px 0" }}>
                  No indexed repositories yet
                </h3>
                <p className="mf-body">
                  Paste any public GitHub repository above, or click one of these curated codebases
                  to explore full architecture graphs, code flows, and cited Q&amp;A:
                </p>
              </div>

              <div className="mf-grid c3">
                {[
                  {
                    repo: "facebook/react",
                    desc: "React Fiber reconciler, hooks pipeline, and synthetic event system.",
                    lang: "TypeScript",
                    files: "~1,800 files",
                  },
                  {
                    repo: "fastapi/fastapi",
                    desc: "Starlette async routing, dependency injection, and Pydantic validation.",
                    lang: "Python",
                    files: "~240 files",
                  },
                  {
                    repo: "bottlepy/bottle",
                    desc: "Single-file Python WSGI framework with routing, templates, and plugins.",
                    lang: "Python",
                    files: "1 module",
                  },
                ].map((demo) => (
                  <motion.div
                    key={demo.repo}
                    whileHover={{ y: -4, borderColor: "var(--mf-ink)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 26 }}
                    onClick={() => open(demo.repo)}
                    style={{
                      border: "1px solid var(--mf-line)",
                      borderRadius: 14,
                      padding: "20px",
                      background: "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          className="mf-mono"
                          style={{
                            fontSize: "0.6875rem",
                            color: LANG_COLORS[demo.lang] || "var(--mf-ink)",
                          }}
                        >
                          ● {demo.lang}
                        </span>
                        <span className="mf-mono mf-muted" style={{ fontSize: "0.625rem" }}>
                          {demo.files}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "1rem", marginTop: 8 }}>
                        {demo.repo}
                      </div>
                      <p
                        className="mf-body"
                        style={{ fontSize: "0.8125rem", marginTop: 6, lineHeight: 1.45 }}
                      >
                        {demo.desc}
                      </p>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <span
                        className="mf-mono"
                        style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--mf-ink)" }}
                      >
                        Map codebase ↗
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="mf-grid c3">
              <AnimatePresence mode="popLayout">
                {history.map((h) => (
                  <RepoCard
                    key={h.id}
                    entry={h}
                    onOpen={() => navigate({ search: { repo: h.repoUrl } })}
                    onDelete={() => {
                      repoHistory.remove(h.id);
                      setVersion((v) => v + 1);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

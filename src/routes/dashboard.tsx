import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PortalTransform } from "@/components/portal-transform";
import { NeuralMesh } from "@/components/neural-mesh";
import { RepoHub } from "@/components/repo-hub";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { repoHistory } from "@/lib/repo-history";

type DashboardSearch = { repo?: string };

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    repo: search.repo as string | undefined,
  }),
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — DevLens AI" },
      { name: "description", content: "Interactive architecture mapping, smart Q&A, and onboarding documentation." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
});

function DashboardPage() {
  const { repo } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [inputRepo, setInputRepo] = useState("");
  const palette = useCommandPalette();

  // History entries for palette file search
  const historyRepos = repoHistory.getAll();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputRepo.trim();
    if (!raw) return;
    // Normalise: accept github.com/... or just owner/repo
    const url = raw.startsWith("http") ? raw : `https://github.com/${raw}`;
    navigate({ search: { repo: url } });
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
    {
      id: "pricing",
      label: "View Pricing",
      icon: "💳",
      group: "Navigation",
      onSelect: () => navigate({ to: "/pricing" }),
    },
    ...historyRepos.map((r) => ({
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
      <>
        <CommandPalette
          open={palette.open}
          onClose={() => palette.setOpen(false)}
          actions={paletteActions}
        />
        <PortalTransform
          open={true}
          repoUrl={repo}
          onClose={() => navigate({ search: { repo: undefined } })}
          onOpenPalette={palette.toggle}
        />
      </>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--dl-base)",
      fontFamily: "var(--font-sans)",
      display: "flex",
      flexDirection: "column",
      paddingLeft: 240,
    }}>
      {/* Command Palette */}
      <CommandPalette
        open={palette.open}
        onClose={() => palette.setOpen(false)}
        actions={paletteActions}
      />

      {/* Fixed mesh bg */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <NeuralMesh opacity={0.04} />
      </div>

      {/* Nav */}
      <nav className="dl-nav">
        <div className="dl-nav-inner">
          <Link to="/" className="dl-nav-logo">
            <span className="dl-nav-logo-dot" />
            DEVLENS
            <span style={{ color: "var(--dl-text-0)", fontWeight: 400, fontSize: "0.6rem", letterSpacing: "0.2em" }}>AI</span>
          </Link>
          <div className="dl-nav-links">
            <Link to="/" className="dl-nav-link">Home</Link>
            <Link to="/pricing" className="dl-nav-link">Pricing</Link>
            <Link to="/dashboard" className="dl-nav-link" data-active="">Dashboard</Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "flex-start",
        padding: "clamp(4rem,8vw,6rem) clamp(2rem,5vw,4rem) 3rem",
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 1200, margin: "0"
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: "10%", left: "20%", transform: "translate(-50%, -50%)",
          width: 600, height: 400,
          background: "radial-gradient(circle, rgba(0,214,143,0.04) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />

        {/* Connect form */}
        <div style={{ maxWidth: 640, width: "100%", position: "relative", marginBottom: "4rem" }}>
          <div className="dl-section-label" style={{ justifyContent: "flex-start" }}>
            System_Ready // Interactive_Session
          </div>
          <h1 className="dl-h2" style={{ marginBottom: "1rem" }}>Initialize Repository.</h1>
          <p className="dl-body" style={{ marginBottom: "2.5rem", maxWidth: "48ch" }}>
            Provide any GitHub repository URL to load its interactive architecture map and start Q&A.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="dl-input-wrap">
              <span className="dl-mono" style={{ color: "var(--dl-text-3)", fontSize: "0.8125rem", flexShrink: 0 }}>/connect</span>
              <input
                type="text"
                value={inputRepo}
                onChange={e => setInputRepo(e.target.value)}
                placeholder="github.com/org/repo"
                className="dl-input"
                autoFocus
              />
              <button type="submit" className="dl-btn dl-btn-primary dl-btn-sm">Connect</button>
            </div>
          </form>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: 24, flexWrap: "wrap" }}>
            {["AES-256 encrypted", "Zero logs retained", "OAuth secured"].map((t, i) => (
              <span key={i} className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dl-text-3)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 4, height: 4, background: "var(--dl-line-2)", borderRadius: "50%" }} />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Repository Hub */}
        <div style={{ width: "100%", position: "relative" }}>
          <RepoHub onSelectRepo={(url) => navigate({ search: { repo: url } })} />
        </div>
      </main>

      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--dl-line-0)", padding: "1.25rem 0", textAlign: "center" }}>
        <span className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-text-3)", letterSpacing: "0.06em" }}>
          // DevLens AI · Full codebase indexing &amp; semantic RAG · Press ⌘K for commands
        </span>
      </footer>
    </div>
  );
}

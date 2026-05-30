import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PortalTransform } from "@/components/portal-transform";
import { NeuralMesh } from "@/components/neural-mesh";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRepo.trim()) navigate({ search: { repo: inputRepo.trim() } });
  };

  if (repo) {
    return (
      <PortalTransform
        open={true}
        repoUrl={repo}
        onClose={() => navigate({ search: { repo: undefined } })}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--dl-base)", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column" }}>
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
            <span style={{ color: "var(--dl-text-3)", fontWeight: 400, fontSize: "0.6rem", letterSpacing: "0.2em" }}>AI</span>
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
        alignItems: "center", justifyContent: "center",
        padding: "clamp(5rem,10vw,8rem) 1.5rem",
        position: "relative", zIndex: 1, textAlign: "center",
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
          width: 500, height: 300,
          background: "radial-gradient(ellipse, rgba(0,214,143,0.03) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 520, width: "100%", position: "relative" }}>
          <div className="dl-section-label" style={{ justifyContent: "center" }}>
            System_Ready // Interactive_Session
          </div>

          <h1 className="dl-h2" style={{ marginBottom: "1rem" }}>Enter repository.</h1>
          <p className="dl-body" style={{ marginBottom: "2.5rem", maxWidth: "42ch", marginInline: "auto" }}>
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

          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
            {["AES-256 encrypted", "Zero logs retained", "OAuth secured"].map((t, i) => (
              <span key={i} className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dl-text-3)" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </main>

      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid var(--dl-line-0)", padding: "1.25rem 0", textAlign: "center" }}>
        <span className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-text-3)", letterSpacing: "0.06em" }}>
          // DevLens AI · Full codebase indexing &amp; semantic RAG
        </span>
      </footer>
    </div>
  );
}

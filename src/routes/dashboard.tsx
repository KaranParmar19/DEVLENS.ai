import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PortalTransform } from "@/components/portal-transform";
import { NeuralMesh } from "@/components/neural-mesh";
import { RepoHub } from "@/components/repo-hub";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { repoHistory } from "@/lib/repo-history";

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
      { name: "description", content: "Interactive architecture mapping, smart Q&A, and onboarding documentation." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
});

function DashboardPage() {
  const { repo, jobId, sessionId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [inputRepo, setInputRepo] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const palette = useCommandPalette();

  const historyRepos = repoHistory.getAll();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputRepo.trim();
    if (!raw) return;
    const url = raw.startsWith("http") ? raw : `https://github.com/${raw}`;
    navigate({ search: { repo: url } });
  };

  const paletteActions = [
    { id: "home", label: "Go to Home", icon: "🏠", group: "Navigation", shortcut: "G H", onSelect: () => navigate({ to: "/" }) },
    { id: "pricing", label: "View Pricing", icon: "💳", group: "Navigation", onSelect: () => navigate({ to: "/pricing" }) },
    ...historyRepos.map((r) => ({
      id: `recent:${r.id}`, label: r.repoLabel,
      description: `Last analyzed: ${new Date(r.analyzedAt).toLocaleDateString()}`,
      icon: "🗂", group: "Recent Repos",
      onSelect: () => navigate({ search: { repo: r.repoUrl } }),
    })),
  ];

  if (repo) {
    return (
      <>
        <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} actions={paletteActions} />
        <PortalTransform
          open={true} repoUrl={repo} jobId={jobId} sessionId={sessionId}
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
      position: 'relative',
      overflow: 'hidden'
    }}>
      <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} actions={paletteActions} />

      {/* Cinematic Backgrounds */}
      <div className="dl-noise" />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <NeuralMesh opacity={0.06} />
      </div>
      
      {/* Top ambient glow */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: "60vw", height: "60vh",
        background: "radial-gradient(circle at top right, var(--dl-signal-lo) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0
      }} />

      {/* Nav */}
      <nav className="dl-nav" style={{ zIndex: 50 }}>
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
        alignItems: "stretch",
        padding: "clamp(3rem,6vw,5rem) clamp(2rem,5vw,4rem) 3rem",
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 1400, margin: "0 auto"
      }}>
        <div className="dl-animate-fade-up" style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          marginBottom: '3rem', borderBottom: '1px solid var(--dl-line-1)', paddingBottom: '2rem'
        }}>
          <div>
            <div className="dl-section-label" style={{ marginBottom: '1rem', color: 'var(--dl-signal)' }}>
              SYSTEM_READY // INITIATE_CONNECTION
            </div>
            <h1 className="dl-display" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>Command Center</h1>
          </div>
          <div className="dl-mono" style={{ textAlign: 'right', fontSize: '0.6875rem', color: 'var(--dl-text-3)', lineHeight: 1.6 }}>
            SESSION_ID: <span style={{ color: 'var(--dl-text-1)' }}>{Math.random().toString(36).substr(2, 9).toUpperCase()}</span><br/>
            STATUS: <span style={{ color: 'var(--dl-signal)' }}>ONLINE</span><br/>
            CLUSTER: US-EAST-1
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 2fr', gap: '3rem', alignItems: 'start' }}>
          
          {/* Connection Terminal */}
          <div className="dl-card dl-animate-fade-up dl-delay-100" style={{ 
            padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem',
            background: 'linear-gradient(180deg, var(--dl-raised) 0%, var(--dl-overlay) 100%)',
            position: 'relative', overflow: 'hidden'
          }}>
            {/* Scanline effect */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
              background: 'linear-gradient(to bottom, transparent, rgba(0, 214, 143, 0.05), transparent)',
              animation: 'dl-scan-line 4s linear infinite', pointerEvents: 'none'
            }} />
            
            <div>
              <h2 className="dl-h3" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="dl-animate-pulse-sig" style={{ width: 8, height: 8, background: 'var(--dl-signal)', borderRadius: '50%', display: 'inline-block' }} />
                Ingest Repository
              </h2>
              <p className="dl-body-sm">
                Provide a GitHub repository URL to initiate deep architectural indexing and interactive visualization.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 2 }}>
              <div className={`dl-input-wrap ${isFocused ? 'signal-active' : ''}`} style={{ 
                padding: '12px', background: 'var(--dl-base)', border: '1px solid',
                borderColor: isFocused ? 'var(--dl-signal-md)' : 'var(--dl-line-2)',
                boxShadow: isFocused ? '0 0 0 3px var(--dl-signal-lo), 0 0 20px var(--dl-signal-lo)' : 'none'
              }}>
                <span className="dl-mono" style={{ color: isFocused ? 'var(--dl-signal)' : 'var(--dl-text-2)', fontSize: "0.8125rem" }}>
                  $
                </span>
                <input
                  type="text"
                  value={inputRepo}
                  onChange={e => setInputRepo(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="github.com/org/repo"
                  className="dl-input"
                  style={{ fontSize: '0.875rem' }}
                  autoFocus
                />
                <button type="submit" className="dl-btn dl-btn-signal" style={{ padding: '8px 16px' }}>
                  Analyze
                </button>
              </div>
            </form>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", borderTop: '1px solid var(--dl-line-1)', paddingTop: '1.5rem' }}>
              {["AES-256 Secured", "Real-time Indexing", "Zero Persistence"].map((t, i) => (
                <span key={i} className="dl-mono" style={{ fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dl-text-2)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 4, height: 4, background: "var(--dl-signal)", borderRadius: "50%", opacity: 0.5 }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Repository Hub */}
          <div className="dl-animate-fade-up dl-delay-200" style={{ width: "100%", position: "relative" }}>
            <RepoHub onSelectRepo={(url) => navigate({ search: { repo: url } })} />
          </div>

        </div>
      </main>

      <footer style={{ position: "relative", zIndex: 10, borderTop: "1px solid var(--dl-line-1)", padding: "1.5rem 2rem", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-text-3)", letterSpacing: "0.06em" }}>
          // DEV_LENS_AI_RUNTIME · v3.0.1
        </span>
        <button onClick={palette.toggle} className="dl-btn dl-btn-ghost dl-btn-sm" style={{ padding: '4px 8px', fontSize: '0.6rem' }}>
          <kbd style={{ fontFamily: 'var(--font-mono)', padding: '2px 6px', background: 'var(--dl-raised)', borderRadius: 3, border: '1px solid var(--dl-line-2)' }}>⌘K</kbd> Command Menu
        </button>
      </footer>
    </div>
  );
}


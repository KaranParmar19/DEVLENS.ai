import { Link, useRouterState } from "@tanstack/react-router";

interface NavProps {
  username?: string | null;
  avatarUrl?: string | null;
  onLogin?: () => void;
  onLogout?: () => void;
  tunnelState?: string;
}

export function Nav({ username, avatarUrl, onLogin, onLogout, tunnelState }: NavProps) {
  const router = useRouterState();
  const path = router.location.pathname;

  const isConnected = ["establishing", "established", "severing"].includes(tunnelState ?? "");

  return (
    <nav className="dl-nav">
      <div className="dl-nav-inner">
        {/* Logo */}
        <Link to="/" className="dl-nav-logo" aria-label="DevLens AI home">
          <span className="dl-nav-logo-dot" />
          DEVLENS
          <span style={{ color: "var(--dl-text-3)", fontWeight: 400, fontSize: "0.625rem", letterSpacing: "0.2em" }}>
            AI
          </span>
        </Link>

        {/* Links */}
        <div className="dl-nav-links">
          <Link
            to="/"
            className="dl-nav-link"
            data-active={path === "/" ? "" : undefined}
          >
            Home
          </Link>
          <Link
            to="/pricing"
            className="dl-nav-link"
            data-active={path === "/pricing" ? "" : undefined}
          >
            Pricing
          </Link>
          <Link
            to="/dashboard"
            className="dl-nav-link"
            data-active={path === "/dashboard" ? "" : undefined}
          >
            Dashboard
          </Link>

          <div style={{ width: 1, height: 16, background: "var(--dl-line-1)", margin: "0 6px" }} />

          {/* Auth / Tunnel */}
          {username ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isConnected && (
                <span style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.1em",
                  color: "var(--dl-signal)",
                  textTransform: "uppercase",
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "var(--dl-signal)",
                    boxShadow: "0 0 6px var(--dl-signal)",
                    animation: "dl-heartbeat 2s ease-in-out infinite",
                  }} />
                  Tunnel
                </span>
              )}
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={username}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    border: "1px solid var(--dl-line-2)",
                    outline: isConnected ? "2px solid rgba(0,214,143,0.3)" : "none",
                    outlineOffset: 2,
                  }}
                />
              )}
              <button
                type="button"
                onClick={onLogout}
                className="dl-btn dl-btn-ghost dl-btn-sm"
                style={{ color: "var(--dl-text-2)", fontSize: "0.625rem" }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="dl-btn dl-btn-ghost dl-btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
              Connect GitHub
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

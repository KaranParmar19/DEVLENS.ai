import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PortalTransform } from "@/components/portal-transform";
import { NeuralMesh } from "@/components/neural-mesh";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "DevLens AI — Understand any codebase in seconds" },
      { name: "description", content: "DevLens AI gives you an interactive cognitive layer for any codebase. Architecture maps, code flow, smart Q&A, and auto-generated onboarding docs — in under 8 seconds." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
});

type TunnelState =
  | "disconnected" | "handshaking" | "establishing"
  | "established" | "severing" | "terminating" | "closed" | "unwinding";

const CORRUPT_CHARS = ["▓", "░", "▒", "█", "◈", "⟁", "◆", "▸", "✦", "⬡"];
const getRandomChar = () => CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)];

function Index() {
  const navigate = useNavigate({ from: "/" });
  const [repoUrl, setRepoUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [tunnelState, setTunnelState] = useState<TunnelState>("disconnected");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const uname = localStorage.getItem("devlens_username");
    const avatar = localStorage.getItem("devlens_avatar_url");
    const pending = sessionStorage.getItem("tunnel_handshake_pending");
    if (uname && !pending) { setUsername(uname); setAvatarUrl(avatar); setTunnelState("established"); }
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const qUname = params.get("username");
    const qAvatar = params.get("avatar");
    if (token && qUname) {
      localStorage.setItem("devlens_session_token", token);
      localStorage.setItem("devlens_username", qUname);
      localStorage.setItem("devlens_avatar_url", qAvatar || "");
      setUsername(qUname); setAvatarUrl(qAvatar || "");
      window.history.replaceState({}, document.title, window.location.pathname);
      if (sessionStorage.getItem("tunnel_handshake_pending") === "true") {
        sessionStorage.removeItem("tunnel_handshake_pending");
        setTunnelState("establishing");
        setTimeout(() => setTunnelState("established"), 900);
      } else { setTunnelState("established"); }
    }
  }, []);

  const handleLogin = () => {
    setTunnelState("handshaking");
    setTimeout(() => {
      sessionStorage.setItem("tunnel_handshake_pending", "true");
      window.location.href = `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/api/v1/auth/github/login`;
    }, 400);
  };

  const handleLogout = () => {
    setTunnelState("severing");
    setTimeout(() => {
      setTunnelState("terminating");
      setTimeout(() => {
        setTunnelState("closed");
        setTimeout(() => {
          setTunnelState("unwinding");
          setTimeout(() => {
            setTunnelState("disconnected");
            localStorage.removeItem("devlens_session_token");
            localStorage.removeItem("devlens_username");
            localStorage.removeItem("devlens_avatar_url");
            setUsername(null); setAvatarUrl(null);
          }, 500);
        }, 600);
      }, 400);
    }, 300);
  };

  const handleAnalyze = (url: string) => {
    if (url.trim()) navigate({ to: "/dashboard", search: { repo: url.trim() } });
  };

  const isConnectFlow = ["establishing", "established", "severing"].includes(tunnelState);

  const getBadgeState = () => {
    if (["establishing", "established", "severing"].includes(tunnelState))
      return { text: "Tunnel Active", color: "var(--dl-signal)", pulse: true };
    if (["terminating", "closed"].includes(tunnelState))
      return { text: "Tunnel Severed", color: "var(--dl-danger)", pulse: false };
    return { text: "System Ready", color: "var(--dl-text-2)", pulse: false };
  };
  const badge = getBadgeState();

  const getLnStyle = (idx: number): React.CSSProperties => {
    if (["establishing", "established", "severing"].includes(tunnelState)) {
      return {
        color: "var(--dl-signal)",
        transition: "color 0.3s ease",
        transitionDelay: tunnelState === "establishing" ? `${idx * 80}ms` : "0ms",
        animation: tunnelState === "established" ? "dl-heartbeat 2s ease-in-out infinite" : "none",
      };
    }
    return { color: "var(--dl-text-3)", transition: "color 0.3s ease", transitionDelay: `${idx * 60}ms` };
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--dl-base)", fontFamily: "var(--font-sans)", paddingLeft: 240 }}>
      {/* Fixed bg mesh */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <NeuralMesh opacity={0.05} />
      </div>

      {/* Portal */}
      <PortalTransform open={analyzing} repoUrl={repoUrl} onClose={() => setAnalyzing(false)} />

      {/* ── UNIFIED TOP NAV ───────────────────────── */}
      <nav className="dl-nav">
        <div className="dl-nav-inner">
          <Link to="/" className="dl-nav-logo">
            <span className="dl-nav-logo-dot" />
            DEVLENS
            <span style={{ color: "var(--dl-text-0)", fontWeight: 400, fontSize: "0.6rem", letterSpacing: "0.2em" }}>AI</span>
          </Link>

          <div className="dl-nav-links">
            <Link to="/" className="dl-nav-link" data-active="">Home</Link>
            <Link to="/pricing" className="dl-nav-link">Pricing</Link>
            <Link to="/dashboard" className="dl-nav-link">Dashboard</Link>
            <div style={{ width: "100%", height: 1, background: "var(--dl-line-1)", margin: "16px 0" }} />

            {/* Status badge */}
            <div className="dl-pill" style={{ gap: 6 }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: badge.color,
                boxShadow: badge.pulse ? `0 0 6px ${badge.color}` : "none",
                animation: badge.pulse ? "dl-heartbeat 2s infinite" : "none",
                flexShrink: 0,
              }} />
              <span className="dl-mono" style={{ fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: badge.color }}>
                {badge.text}
              </span>
            </div>

            {/* Auth */}
            {username ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {avatarUrl && (
                  <img src={avatarUrl} alt={username} style={{
                    width: 24, height: 24, borderRadius: "50%",
                    border: "1px solid var(--dl-line-2)",
                    outline: isConnectFlow ? "2px solid rgba(0,214,143,0.3)" : "none",
                    outlineOffset: 2,
                  }} />
                )}
                <button type="button" onClick={handleLogout} className="dl-btn dl-btn-ghost dl-btn-sm">
                  Disconnect
                </button>
              </div>
            ) : (
              <button type="button" onClick={handleLogin} className="dl-btn dl-btn-ghost dl-btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                GitHub
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────── */}
      <section style={{ position: "relative", paddingTop: "clamp(6rem,14vw,10rem)", paddingBottom: "clamp(5rem,10vw,8rem)", overflow: "hidden" }}>
        {/* Grid overlay */}
        <div className="dl-grid-overlay" style={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none", zIndex: 0 }} />
        {/* Glow orb */}
        <div style={{
          position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
          width: "600px", height: "400px",
          background: "radial-gradient(ellipse, rgba(0,214,143,0.04) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div className="dl-container" style={{ position: "relative", zIndex: 1, marginInline: 0, paddingLeft: 0, maxWidth: "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "clamp(2rem,4vw,5rem)", alignItems: "start", width: "100%", paddingLeft: "1rem", paddingRight: "12vw" }}>

            {/* Left — primary */}
            <div>
              {/* Line numbers decorative */}
              <div style={{
                display: "flex", alignItems: "center", gap: 16, marginBottom: "2rem",
                fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--dl-text-3)",
              }}>
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <span key={i} style={{ ...getLnStyle(i - 1), display: "inline-block" }}>
                    {String(i).padStart(2, "0")}
                  </span>
                ))}
                <span style={{ flex: 1, height: 1, background: "var(--dl-line-0)" }} />
              </div>

              <h1 className="dl-display dl-animate-fade-up" style={{ maxWidth: "16ch" }}>
                Understand any{" "}
                <em style={{ color: "var(--dl-text-3)", fontStyle: "italic", fontWeight: 600 }}>codebase</em>
                <br />in seconds.
              </h1>

              <p className="dl-body dl-animate-fade-up dl-delay-200" style={{
                maxWidth: "44ch", marginTop: "1.75rem",
                fontSize: "1.0625rem", lineHeight: 1.75,
              }}>
                A cognitive layer for your source code. Map architecture, trace flows,
                and query any repository like a senior engineer who's read every line.
              </p>

              {/* Command bar */}
              <form
                onSubmit={e => { e.preventDefault(); handleAnalyze(repoUrl); }}
                style={{ marginTop: "2.5rem", maxWidth: "520px" }}
                className="dl-animate-fade-up dl-delay-300"
              >
                <div className={`dl-input-wrap${isConnectFlow ? " signal-active" : ""}`}>
                  <span className="dl-mono" style={{ color: "var(--dl-text-3)", fontSize: "0.8125rem", flexShrink: 0 }}>/connect</span>
                  <div style={{ flex: 1, position: "relative", height: 24 }}>
                    <input
                      type="text"
                      value={repoUrl}
                      onChange={e => setRepoUrl(e.target.value)}
                      disabled={analyzing}
                      className="dl-input"
                      style={{ position: "absolute", inset: 0 }}
                      placeholder={tunnelState === "established" ? "private repo now accessible..." : "github.com/org/repo"}
                    />
                  </div>
                  <button type="submit" disabled={analyzing} className="dl-btn dl-btn-primary dl-btn-sm">
                    {analyzing ? "Analyzing..." : "Analyze"}
                  </button>
                </div>
              </form>

              {/* Trust signals */}
              <div className="dl-animate-fade-up dl-delay-500" style={{
                display: "flex", alignItems: "center", gap: 20, marginTop: "1.5rem",
                flexWrap: "wrap",
              }}>
                {["No install", "Public & Private repos", "10k+ engineers"].map((t, i) => (
                  <span key={i} className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dl-text-3)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--dl-text-3)", flexShrink: 0 }} />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — context inspector */}
            <div style={{ width: "clamp(240px, 28vw, 320px)", paddingTop: "clamp(3rem,6vw,5rem)" }}>
              <div className="dl-card" style={{ padding: "20px" }}>
                <div className="dl-label" style={{ marginBottom: "1.25rem" }}>Context_Inspector</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {["Architecture Maps", "Code Flow Tracing", "Smart Q&A", "Onboarding Docs"].map((title, idx) => (
                    <FeatureRow key={title} idx={idx} title={title} state={tunnelState} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTENT SECTIONS REMOVED ──────────────────────── */}

      {/* ── FOOTER ───────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid var(--dl-line-1)",
        padding: "2rem 0",
      }}>
        <div className="dl-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.1em", color: "var(--dl-text-3)", textTransform: "uppercase" }}>
            DevLens AI — All systems operational
          </span>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacy", "Terms", "Status"].map(l => (
              <a key={l} href="#" className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.08em", color: "var(--dl-text-3)", textDecoration: "none", textTransform: "uppercase" }}>
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Feature Row ──────────────────────────────────────────────────────────
function FeatureRow({ idx, title, state }: { idx: number; title: string; state: TunnelState }) {
  const isLit = ["establishing", "established", "severing"].includes(state);
  let delay = 0;
  if (state === "establishing") delay = idx * 150;
  if (state === "terminating") delay = (3 - idx) * 100;

  return (
    <div className="dl-feature-row">
      <div
        className={`dl-feature-indicator${isLit ? " active" : ""}`}
        style={{ transition: "background 0.35s ease, box-shadow 0.35s ease", transitionDelay: `${delay}ms` }}
      />
      <div>
        <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--dl-text-0)" }}>{title}</div>
        <div className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-3)", marginTop: 3, letterSpacing: "0.06em" }}>
          {isLit ? "ACTIVE" : "STANDBY"}
        </div>
      </div>
    </div>
  );
}

// ── Tunnel Card ──────────────────────────────────────────────────────────
function TunnelCard({ tunnelState, onLogin, onLogout }: { tunnelState: TunnelState; onLogin: () => void; onLogout: () => void }) {
  const isActive = ["handshaking", "establishing", "established"].includes(tunnelState);
  const isDanger = ["severing", "terminating", "closed"].includes(tunnelState);

  const borderColor = isActive ? "rgba(0,214,143,0.25)" : isDanger ? "rgba(255,79,79,0.25)" : "var(--dl-line-1)";
  const bgColor = isActive ? "rgba(0,214,143,0.03)" : isDanger ? "rgba(255,79,79,0.03)" : "var(--dl-raised)";

  return (
    <div style={{
      marginTop: 10,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-md)",
      padding: "14px 16px",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      minHeight: 80,
      transition: "border-color 0.4s ease, background 0.4s ease, box-shadow 0.4s ease",
      boxShadow: isActive ? "0 0 20px rgba(0,214,143,0.06)" : isDanger ? "0 0 20px rgba(255,79,79,0.06)" : "none",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span className="dl-mono" style={{ fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dl-text-3)" }}>
            Private Repositories
          </span>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: isActive ? "var(--dl-signal)" : isDanger ? "var(--dl-danger)" : "var(--dl-text-3)",
            animation: tunnelState === "handshaking" ? "dl-heartbeat 0.4s 1" : "none",
          }} />
        </div>
        <TunnelTerminal state={tunnelState} />
      </div>
      <TunnelButton state={tunnelState} onLogin={onLogin} onLogout={onLogout} />
    </div>
  );
}

// ── Tunnel Terminal ───────────────────────────────────────────────────────
function TunnelTerminal({ state }: { state: TunnelState }) {
  const [displayText, setDisplayText] = useState("");
  const [secondLine, setSecondLine] = useState("");

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
    const corruptDissolveRTL = async (text: string, duration: number) => {
      const words = text.split(" ");
      const stepTime = duration / words.length;
      for (let i = words.length - 1; i >= 0; i--) {
        if (cancelled) return;
        words[i] = words[i].replace(/./g, () => getRandomChar());
        setDisplayText(words.join(" "));
        await wait(stepTime * 0.5);
        if (cancelled) return;
        words[i] = "";
        setDisplayText(words.join(" "));
        await wait(stepTime * 0.5);
      }
      setDisplayText("");
    };
    const corruptLineRTL = async (text: string, duration: number) => {
      const chars = text.split("");
      const stepTime = duration / chars.length;
      for (let i = chars.length - 1; i >= 0; i--) {
        if (cancelled) return;
        chars[i] = getRandomChar();
        setDisplayText(chars.join(""));
        await wait(stepTime * 0.2);
        chars[i] = "";
        setDisplayText(chars.join(""));
        await wait(stepTime * 0.8);
      }
      setDisplayText("");
    };
    const typeText = async (text: string, speedMs: number, color: string) => {
      for (let i = 1; i <= text.length; i++) {
        if (cancelled) return;
        setDisplayText(`<span style="color:${color}">${text.substring(0, i)}▌</span>`);
        await wait(speedMs);
      }
    };
    const run = async () => {
      if (state === "disconnected" || state === "unwinding") {
        setSecondLine("");
        setDisplayText(`<span style="color:var(--dl-text-2)">Need to index a private codebase? Establish a secure GitHub OAuth tunnel to grant read access.</span>`);
      } else if (state === "handshaking") {
        await corruptDissolveRTL("Need to index a private codebase? Establish a secure GitHub OAuth tunnel to grant read access.", 400);
      } else if (state === "establishing") {
        await typeText("▸ ESTABLISHING ENCRYPTED TUNNEL · GITHUB OAUTH · AES-256", 28, "var(--dl-signal)");
      } else if (state === "established") {
        setDisplayText(`<span style="color:var(--dl-signal)">✦ SECURE TUNNEL ESTABLISHED · PRIVATE REPOS UNLOCKED</span>`);
        setSecondLine("SESSION ENCRYPTED · KEYS ROTATE EVERY 300s · ZERO LOGS");
      } else if (state === "severing") {
        setSecondLine("");
        await corruptLineRTL("✦ SECURE TUNNEL ESTABLISHED · PRIVATE REPOS UNLOCKED", 280);
      } else if (state === "terminating") {
        await typeText("▸ TERMINATING SESSION · FLUSHING KEYS · REVOKING OAUTH TOKEN", 18, "var(--dl-danger)");
      } else if (state === "closed") {
        await typeText("✦ CONNECTION CLOSED · NO DATA RETAINED · KEYS DESTROYED", 28, "var(--dl-danger)");
      }
    };
    run();
    return () => { cancelled = true; };
  }, [state]);

  return (
    <div>
      <p className="dl-mono" style={{ fontSize: "0.6875rem", lineHeight: 1.6, margin: 0, color: "var(--dl-text-2)" }}
        dangerouslySetInnerHTML={{ __html: displayText }} />
      {secondLine && (
        <p className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-text-3)", marginTop: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {secondLine}
        </p>
      )}
    </div>
  );
}

// ── Tunnel Button ────────────────────────────────────────────────────────
function TunnelButton({ state, onLogin, onLogout }: { state: TunnelState; onLogin: () => void; onLogout: () => void }) {
  if (["disconnected", "unwinding"].includes(state)) {
    return <button onClick={onLogin} className="dl-btn dl-btn-ghost dl-btn-sm" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Secure Tunnel</button>;
  }
  if (state === "handshaking") {
    return <button disabled className="dl-btn dl-btn-sm dl-animate-pulse-sig" style={{ border: "1px solid rgba(0,214,143,0.4)", color: "var(--dl-signal)", background: "transparent", flexShrink: 0 }}>HANDSHAKING...</button>;
  }
  if (["establishing", "established"].includes(state)) {
    return <button onClick={onLogout} className="dl-btn dl-btn-sm" style={{ border: "1px solid rgba(0,214,143,0.3)", color: "var(--dl-signal)", background: "rgba(0,214,143,0.04)", flexShrink: 0 }}>CONNECTED ✦</button>;
  }
  if (["severing", "terminating", "closed"].includes(state)) {
    return <button disabled className="dl-btn dl-btn-sm" style={{ border: "1px solid rgba(255,79,79,0.4)", color: "var(--dl-danger)", background: "transparent", flexShrink: 0 }}>SEVERING...</button>;
  }
  return null;
}

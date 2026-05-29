import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoadingShowcase } from "@/components/loading-showcase";
import {
  InterrogationSection,
  TimeDeltaSection,
  FieldReportsSection,
  FinalCTASection,
} from "@/components/landing-sections";
import { PortalTransform } from "@/components/portal-transform";
import { NeuralMesh } from "@/components/neural-mesh";
import { ScrollNarrative } from "@/components/scroll-narrative";
import { HeroExtras } from "@/components/hero-extras";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "DevLens AI — Understand any codebase in seconds" },
      { name: "description", content: "DevLens AI gives you an interactive cognitive layer for any codebase. Architecture maps, code flow, smart Q&A, and auto-generated onboarding docs — in under 8 seconds." },
      { property: "og:title", content: "DevLens AI — Understand any codebase in seconds" },
      { property: "og:description", content: "Map architecture, trace flows, and query any GitHub repository like a senior engineer who's read every line." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;700&family=Geist:wght@400;500;600&display=swap",
      },
    ],
  }),
});

type TunnelState = 
  | "disconnected" 
  | "handshaking" 
  | "establishing" 
  | "established" 
  | "severing" 
  | "terminating" 
  | "closed"
  | "unwinding";

// ─── UTILS FOR CORRUPTION ────────────────────────────────────────────────────────
const CORRUPT_CHARS = ["▓", "░", "▒", "█", "◈", "⟁", "◆", "▸", "✦", "⬡"];
const getRandomChar = () => CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)];

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────────
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
    
    if (uname && !pending) {
      setUsername(uname);
      setAvatarUrl(avatar);
      setTunnelState("established");
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const qUname = params.get("username");
    const qAvatar = params.get("avatar");
    
    if (token && qUname) {
      localStorage.setItem("devlens_session_token", token);
      localStorage.setItem("devlens_username", qUname);
      localStorage.setItem("devlens_avatar_url", qAvatar || "");
      setUsername(qUname);
      setAvatarUrl(qAvatar || "");
      
      window.history.replaceState({}, document.title, window.location.pathname);
      
      if (sessionStorage.getItem("tunnel_handshake_pending") === "true") {
        sessionStorage.removeItem("tunnel_handshake_pending");
        // Resume from establishing
        setTunnelState("establishing");
        setTimeout(() => setTunnelState("established"), 900); // Wait 900ms before established
      } else {
        setTunnelState("established");
      }
    }
  }, []);

  const handleLogin = () => {
    setTunnelState("handshaking");
    setTimeout(() => {
      sessionStorage.setItem("tunnel_handshake_pending", "true");
      window.location.href = `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/api/v1/auth/github/login`;
    }, 400); // 400ms phase 1
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
            setUsername(null);
            setAvatarUrl(null);
          }, 500); // unwind duration
        }, 600); // hold duration
      }, 400); // terminating duration
    }, 300); // severing duration
  };

  const handleAnalyze = (url: string) => {
    if (url.trim()) {
      navigate({
        to: "/dashboard",
        search: { repo: url.trim() },
      });
    }
  };

  // State-derived UI
  const isConnectFlow = ["establishing", "established", "severing"].includes(tunnelState);
  
  const getLnStyle = (idx: number) => {
    if (tunnelState === "disconnected" || tunnelState === "handshaking" || tunnelState === "unwinding") {
      return { color: "#333333", transition: "color 0.3s cubic-bezier(0.4, 0, 0.2, 1)", transitionDelay: `0ms` };
    }
    if (tunnelState === "establishing" || tunnelState === "established" || tunnelState === "severing") {
      // Light up top to bottom 80ms apart
      return { 
        color: "#00E5A0", 
        transition: "color 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
        transitionDelay: tunnelState === "establishing" ? `${idx * 80}ms` : "0ms",
        opacity: tunnelState === "established" ? 0.6 : 1,
        animation: tunnelState === "established" ? "pulseHeartbeat 2s ease-in-out infinite" : "none"
      };
    }
    // terminating, closed
    // Dim top to bottom 80ms apart
    return { 
      color: "#333333", 
      transition: "color 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
      transitionDelay: `${idx * 80}ms` 
    };
  };

  const getBadgeState = () => {
    if (["establishing", "established", "severing"].includes(tunnelState)) {
      return { text: "● TUNNEL ACTIVE", color: "#00E5A0", dotColor: "#00E5A0", pulse: true };
    }
    if (["terminating", "closed"].includes(tunnelState)) {
      return { text: "○ TUNNEL SEVERED", color: "#FF4444", dotColor: "#FF4444", pulse: false };
    }
    return { text: "System Ready: Scanning Repos", color: "#a1a1aa", dotColor: "#10b981", pulse: false };
  };
  const badgeState = getBadgeState();

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-brand-text selection:bg-zinc-800 selection:text-zinc-100">
      {/* Neural Mesh — fixed background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <NeuralMesh opacity={0.08} />
      </div>
      <style>{`
        @keyframes pulseHeartbeat {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes alarmFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      
      <PortalTransform open={analyzing} repoUrl={repoUrl} onClose={() => setAnalyzing(false)} />

      {/* Fixed Gutter Navigation */}
      <nav className="fixed top-0 bottom-0 left-0 z-50 w-16 border-r border-white/5 bg-[#09090b]/95 backdrop-blur flex flex-col items-center py-8 gap-12">
        <div className="font-mono text-xs font-semibold -rotate-90 tracking-tighter text-brand-heading py-4 whitespace-nowrap">
          DEVLENS_v2
        </div>
        <div className="flex flex-1 flex-col gap-6 items-center">
          <div className="h-px w-4 bg-white/10" />
          
          {/* Home Link */}
          <Link
            to="/"
            activeProps={{ className: "bg-zinc-100 text-zinc-950 ring-4 ring-zinc-100/10" }}
            inactiveProps={{ className: "bg-zinc-900 border border-white/5 text-zinc-400 hover:text-brand-heading hover:bg-zinc-800" }}
            className="size-8 rounded-full flex items-center justify-center font-mono text-[9px] font-bold tracking-tighter transition-all cursor-pointer"
            title="Home"
          >
            H
          </Link>

          {/* Onboarding Link */}
          <Link
            to="/onboarding"
            activeProps={{ className: "bg-zinc-100 text-zinc-950 ring-4 ring-zinc-100/10" }}
            inactiveProps={{ className: "bg-zinc-900 border border-white/5 text-zinc-400 hover:text-brand-heading hover:bg-zinc-800" }}
            className="size-8 rounded-full flex items-center justify-center font-mono text-[9px] font-bold tracking-tighter transition-all cursor-pointer"
            title="Onboarding"
          >
            O
          </Link>

          {/* Dashboard Link */}
          <Link
            to="/dashboard"
            activeProps={{ className: "bg-zinc-100 text-zinc-950 ring-4 ring-zinc-100/10" }}
            inactiveProps={{ className: "bg-zinc-900 border border-white/5 text-zinc-400 hover:text-brand-heading hover:bg-zinc-800" }}
            className="size-8 rounded-full flex items-center justify-center font-mono text-[9px] font-bold tracking-tighter transition-all cursor-pointer"
            title="Dashboard"
          >
            D
          </Link>

          {/* Pricing Link */}
          <Link
            to="/pricing"
            activeProps={{ className: "bg-zinc-100 text-zinc-950 ring-4 ring-zinc-100/10" }}
            inactiveProps={{ className: "bg-zinc-900 border border-white/5 text-zinc-400 hover:text-brand-heading hover:bg-zinc-800" }}
            className="size-8 rounded-full flex items-center justify-center font-mono text-[9px] font-bold tracking-tighter transition-all cursor-pointer"
            title="Pricing"
          >
            $
          </Link>
        </div>
        {avatarUrl ? (
          <div className="group relative flex flex-col items-center gap-1">
            <img
              src={avatarUrl}
              alt={username || "User"}
              className="size-8 rounded-full border border-white/10 ring-2 ring-emerald-500/20"
            />
            <span className="absolute left-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[10px] font-mono transition-opacity bg-zinc-900 border border-white/5 py-1 px-2 rounded text-zinc-400 whitespace-nowrap">
              {username}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogin}
            className="size-8 rounded-full bg-zinc-900 border border-white/5 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-brand-heading transition-colors cursor-pointer"
            aria-label="GitHub Login"
          >
            <svg className="size-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
          </button>
        )}
      </nav>

      <div className="pl-16">
        <section className="relative py-24 lg:py-32 overflow-hidden">
          <div className="absolute top-0 left-1/4 size-[600px] bg-zinc-400/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="mx-auto max-w-7xl px-6 lg:px-12 relative">
            <div className="grid grid-cols-12 gap-8">
              {/* Line numbers (Nervous System) */}
              <div className="hidden lg:flex col-span-1 flex-col gap-1 text-[10px] font-mono border-r border-white/5 pt-2">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <span key={i} style={getLnStyle(i)}>LN: 00{i + 1}</span>
                ))}
              </div>

              {/* Primary */}
              <div className="col-span-12 lg:col-span-7">
                <div className="inline-flex items-center gap-2 mb-8 px-2 py-1 rounded-sm bg-zinc-900 ring-1 ring-white/10 shadow-xl shadow-black/40 transition-colors duration-500">
                  <span 
                    className="size-1.5 rounded-full" 
                    style={{ 
                      backgroundColor: badgeState.dotColor, 
                      boxShadow: `0 0 8px ${badgeState.dotColor}80`,
                      animation: badgeState.pulse ? "pulseHeartbeat 2s infinite" : "none" 
                    }} 
                  />
                  <span className="font-mono text-[10px] tracking-wider uppercase transition-colors duration-500" style={{ color: badgeState.color }}>
                    {badgeState.text}
                  </span>
                </div>

                <h1 className="max-w-[24ch] text-balance font-sans text-5xl font-semibold leading-none tracking-tight text-brand-heading md:text-7xl lg:text-8xl">
                  Understand any <span className="text-zinc-700 italic">codebase</span> in seconds.
                </h1>

                <p className="mt-10 max-w-[42ch] text-pretty text-lg leading-relaxed text-brand-text">
                  A cognitive layer for your source code. Map architecture, trace flows, and query
                  any repository like a senior engineer who's read every line.
                </p>

                {/* Command bar */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAnalyze(repoUrl); }}
                  className="mt-16 group relative max-w-xl"
                >
                  <div 
                    className="flex items-center gap-4 bg-[#09090b] p-2 pl-4 rounded-lg transition-all duration-500"
                    style={{
                      boxShadow: isConnectFlow ? "0 32px 64px -16px rgba(0,0,0,0.8), 0 0 15px rgba(0,229,160,0.15)" : "0 32px 64px -16px rgba(0,0,0,0.8)",
                      border: isConnectFlow ? "1px solid rgba(0,229,160,0.3)" : "1px solid rgba(255,255,255,0.1)"
                    }}
                  >
                    <span className="font-mono text-zinc-600 select-none">/connect</span>
                    <input
                      type="text"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      disabled={analyzing}
                      placeholder="github.com/org/repo"
                      className="bg-transparent flex-1 font-mono text-sm outline-none min-w-0 disabled:opacity-60 absolute inset-0 pl-24 pointer-events-none opacity-0"
                    />
                    
                    {/* Placeholder Crossfade Layer */}
                    <div className="flex-1 relative h-6 overflow-hidden">
                      <input
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        disabled={analyzing}
                        className="absolute inset-0 bg-transparent font-mono text-sm text-brand-heading outline-none placeholder:text-zinc-700 min-w-0"
                        placeholder={tunnelState === "established" ? "" : "github.com/org/repo"}
                      />
                      <div 
                        className="absolute inset-0 flex items-center font-mono text-sm pointer-events-none transition-opacity duration-500"
                        style={{
                          opacity: tunnelState === "established" && !repoUrl ? 0.5 : 0,
                          color: "#00E5A0"
                        }}
                      >
                        private repo now accessible...
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={analyzing}
                      className="bg-zinc-100 text-zinc-950 font-medium text-xs py-2 pl-2 pr-3 rounded flex items-center gap-2 hover:bg-white transition-colors"
                    >
                      Analyze
                    </button>
                  </div>

                  <SecureTunnelCard 
                    tunnelState={tunnelState} 
                    onLogin={handleLogin} 
                    onLogout={handleLogout} 
                  />
                </form>
              </div>

              {/* Context panel */}
              <div className="col-span-12 lg:col-span-4 lg:pt-24">
                <div className="relative rounded-xl bg-zinc-900/60 p-6 ring-1 ring-white/10 backdrop-blur-md">
                  <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-6">Context_Inspector</h2>
                  <div className="space-y-6">
                    <FeatureRow idx={0} title="Architecture Maps" state={tunnelState} />
                    <FeatureRow idx={1} title="Code Flow Tracing" state={tunnelState} />
                    <FeatureRow idx={2} title="Smart Q&A" state={tunnelState} />
                    <FeatureRow idx={3} title="Onboarding Docs" state={tunnelState} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scroll-driven narrative */}
        <ScrollNarrative />

        {/* Loading showcase + other landing sections */}
        <LoadingShowcase />
        <HeroExtras />
        <InterrogationSection />
        <TimeDeltaSection />
        <FieldReportsSection />
        <FinalCTASection
          repoUrl={repoUrl}
          setRepoUrl={setRepoUrl}
          analyzing={analyzing}
          onSubmit={() => handleAnalyze(repoUrl)}
        />
      </div>
    </div>
  );
}

function FeatureRow({ idx, title, state }: { idx: number; title: string; state: TunnelState }) {
  const isLit = ["establishing", "established", "severing"].includes(state);
  
  let delay = 0;
  if (state === "establishing") delay = idx * 150;
  if (state === "terminating") delay = (3 - idx) * 100;

  return (
    <div className="flex gap-4 group">
      <div 
        className="size-8 shrink-0 bg-white/5 border-l-2 grid place-items-center transition-colors cubic-bezier(0.4, 0, 0.2, 1)"
        style={{
          borderColor: isLit ? "#00E5A0" : "transparent",
          transitionDuration: "300ms",
          transitionDelay: `${delay}ms`,
          boxShadow: isLit ? "-2px 0 10px rgba(0,229,160,0.2)" : "none"
        }}
      >
        <div className="size-3 bg-zinc-500/20 border border-zinc-500/40" />
      </div>
      <div>
        <div className="text-sm font-medium text-brand-heading">{title}</div>
        <p className="text-xs text-zinc-500 leading-relaxed mt-1">System ready.</p>
      </div>
    </div>
  );
}

// ─── TUNNEL CARD COMPONENT ───────────────────────────────────────────────────────
function SecureTunnelCard({ tunnelState, onLogin, onLogout }: { tunnelState: TunnelState, onLogin: () => void, onLogout: () => void }) {
  
  const getBorderColor = () => {
    if (["handshaking", "establishing", "established"].includes(tunnelState)) return "#00E5A0";
    if (["severing", "terminating", "closed"].includes(tunnelState)) return "#FF4444";
    return "rgba(255,255,255,0.05)"; // default
  };

  const getBgColor = () => {
    if (tunnelState === "established") return "#0d1a0d"; // subtle dark green shift
    return "rgba(24, 24, 27, 0.4)"; // default zinc-900/40
  };

  const getDotColor = () => {
    if (["handshaking", "establishing", "established"].includes(tunnelState)) return "#00E5A0";
    if (["severing", "terminating", "closed"].includes(tunnelState)) return "#FF4444";
    return "rgba(245, 158, 11, 0.5)"; // default amber
  };

  return (
    <div 
      className="mt-6 relative overflow-hidden rounded-lg p-4 max-w-xl transition-all duration-[400ms] cubic-bezier(0.4, 0, 0.2, 1) min-h-[90px]"
      style={{
        backgroundColor: getBgColor(),
        border: `1px solid ${getBorderColor()}`,
        boxShadow: ["handshaking", "establishing", "established"].includes(tunnelState) 
          ? "0 0 4px rgba(0,229,160,0.4) inset, 0 0 8px rgba(0,229,160,0.2)"
          : ["severing", "terminating", "closed"].includes(tunnelState)
          ? "0 0 4px rgba(255,68,68,0.4) inset, 0 0 8px rgba(255,68,68,0.2)"
          : "none"
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 h-full relative">
        <div className="flex-1 w-full max-w-[38ch] min-h-[48px] relative">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Private Repositories
            </span>
            <span 
              className="h-1.5 w-1.5 rounded-full transition-colors duration-[400ms]" 
              style={{ 
                backgroundColor: getDotColor(),
                animation: tunnelState === "handshaking" ? "pulseHeartbeat 0.4s 1" : tunnelState === "severing" ? "alarmFlash 0.1s 1" : "none"
              }} 
            />
          </div>

          <TunnelTerminal state={tunnelState} />

        </div>
        
        <div className="shrink-0 pt-1">
          <TunnelButton state={tunnelState} onLogin={onLogin} onLogout={onLogout} />
        </div>
      </div>
    </div>
  );
}

// ─── TUNNEL TERMINAL ─────────────────────────────────────────────────────────────
function TunnelTerminal({ state }: { state: TunnelState }) {
  const [displayText, setDisplayText] = useState("");
  const [secondLine, setSecondLine] = useState("");
  
  useEffect(() => {
    let cancelled = false;

    const runSequence = async () => {
      // Helper: sleep
      const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      // Helper: corrupt dissolve (right to left word by word)
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

      // Helper: aggressive fast corrupt line RTL
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

      // Helper: Typewriter
      const typeText = async (text: string, speedMs: number, color: string) => {
        for (let i = 1; i <= text.length; i++) {
          if (cancelled) return;
          setDisplayText(`<span style="color: ${color}">${text.substring(0, i)}▌</span>`);
          await wait(speedMs);
        }
      };

      // Handle states
      if (state === "disconnected" || state === "unwinding") {
        setSecondLine("");
        // fade in word by word LTR (simulate with simple span delay if needed, but simple typing is fine here)
        setDisplayText(`<span style="color: #888888; font-family: sans-serif; opacity: 1; transition: opacity 0.5s">Need to index a private codebase? Establish a secure GitHub OAuth tunnel to grant read access.</span>`);
      }
      
      else if (state === "handshaking") {
        const desc = "Need to index a private codebase? Establish a secure GitHub OAuth tunnel to grant read access.";
        await corruptDissolveRTL(desc, 400);
      }
      
      else if (state === "establishing") {
        await typeText("▸ ESTABLISHING ENCRYPTED TUNNEL · GITHUB OAUTH · AES-256", 28, "#00E5A0");
      }
      
      else if (state === "established") {
        // Rewrite from existing (if it was just established)
        setDisplayText(`<span style="color: #00E5A0">✦ SECURE TUNNEL ESTABLISHED · PRIVATE REPOS UNLOCKED</span>`);
        setSecondLine("SESSION ENCRYPTED · KEYS ROTATE EVERY 300s · ZERO LOGS");
      }
      
      else if (state === "severing") {
        // Aggressive destroy
        setSecondLine("");
        await corruptLineRTL("✦ SECURE TUNNEL ESTABLISHED · PRIVATE REPOS UNLOCKED", 280);
      }
      
      else if (state === "terminating") {
        await typeText("▸ TERMINATING SESSION · FLUSHING KEYS · REVOKING OAUTH TOKEN", 18, "#FF4444");
      }
      
      else if (state === "closed") {
        await typeText("✦ CONNECTION CLOSED · NO DATA RETAINED · KEYS DESTROYED", 28, "#FF4444");
      }
    };

    runSequence();
    return () => { cancelled = true; };
  }, [state]);

  return (
    <div className="absolute inset-0 top-6">
      <p 
        className="text-xs font-mono leading-relaxed m-0" 
        dangerouslySetInnerHTML={{ __html: displayText }} 
      />
      {secondLine && (
        <p className="text-[10px] font-mono text-[#555555] mt-1 animate-fade-in opacity-80">
          {secondLine}
        </p>
      )}
    </div>
  );
}

// ─── TUNNEL BUTTON ───────────────────────────────────────────────────────────────
function TunnelButton({ state, onLogin, onLogout }: { state: TunnelState, onLogin: () => void, onLogout: () => void }) {
  
  if (["disconnected", "unwinding"].includes(state)) {
    return (
      <button onClick={onLogin} className="h-9 px-4 rounded bg-zinc-800 border border-white/10 text-xs font-mono font-semibold text-zinc-100 hover:bg-zinc-700 transition-all">
        Secure Tunnel
      </button>
    );
  }

  if (state === "handshaking") {
    return (
      <button disabled className="h-9 px-4 rounded border border-[#00E5A0]/50 text-xs font-mono font-semibold text-[#00E5A0] animate-[pulseHeartbeat_1s_infinite]">
        HANDSHAKING...
      </button>
    );
  }

  if (["establishing", "established"].includes(state)) {
    return (
      <button onClick={onLogout} className="h-9 px-4 rounded bg-[#0d1a0d] border border-[#00E5A0]/40 text-xs font-mono font-semibold text-[#00E5A0] transition-colors hover:bg-[#1a2e1a]">
        CONNECTED ✦
      </button>
    );
  }

  if (["severing", "terminating", "closed"].includes(state)) {
    return (
      <button disabled className="h-9 px-4 rounded bg-zinc-900 border border-[#FF4444]/50 text-xs font-mono font-semibold text-[#FF4444]">
        SEVERING...
      </button>
    );
  }

  return null;
}

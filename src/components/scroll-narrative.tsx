import { useEffect, useRef, useState, useCallback } from "react";

// ── Data ──────────────────────────────────────────────────────────────────────
const FILE_NAMES = [
  "index.ts","auth.middleware.ts","router.tsx","db.config.ts","utils.ts",
  "Button.tsx","Modal.tsx","useAuth.ts","api.gateway.ts","schema.sql",
  "env.ts","logger.ts","cache.service.ts","types.d.ts","constants.ts",
  "app.module.ts","user.controller.ts","session.store.ts","jwt.service.ts",
  "webpack.config.js","next.config.js","tsconfig.json","package.json",
  "prisma.schema","tailwind.config.ts","vite.config.ts","eslint.config.js",
  "Header.tsx","Footer.tsx","Sidebar.tsx","Layout.tsx","theme.ts",
  "dashboard.page.tsx","settings.page.tsx","profile.page.tsx","login.page.tsx",
  "events.bus.ts","pubsub.ts","queue.ts","worker.ts","cron.ts",
  "migrations/001_init.sql","migrations/002_users.sql","seed.ts","fixtures.ts",
  "test.setup.ts","auth.test.ts","api.test.ts","e2e.spec.ts","jest.config.ts",
  "Dockerfile","docker-compose.yml","nginx.conf","railway.json","vercel.json",
  ".env.example",".gitignore","README.md","CHANGELOG.md","LICENSE",
  "openapi.yaml","swagger.json","api.types.ts","zod.schemas.ts","validators.ts",
  "stripe.service.ts","email.service.ts","s3.service.ts","redis.service.ts",
  "graphql.schema.ts","resolvers.ts","mutations.ts","queries.ts","subscriptions.ts",
  "ssr.ts","hydration.ts","prerender.ts","sitemap.ts","robots.ts",
];

const CLUSTERS = [
  { label: "Auth", color: "#FF6B6B", x: 20, y: 35 },
  { label: "API",  color: "#4A8FFF", x: 50, y: 20 },
  { label: "DB",   color: "#A78BFA", x: 80, y: 35 },
  { label: "UI",   color: "#00E5A0", x: 35, y: 70 },
  { label: "Utils",color: "#FEBC2E", x: 65, y: 70 },
];

const ARCH_NODES = [
  { id: "gw", label: "APIGateway",     x: 50, y: 12 },
  { id: "au", label: "AuthService",    x: 28, y: 36 },
  { id: "uc", label: "UserController", x: 72, y: 36 },
  { id: "db", label: "Database",       x: 50, y: 64 },
  { id: "ca", label: "CacheLayer",     x: 20, y: 64 },
  { id: "lg", label: "Logger",         x: 80, y: 64 },
];

const ARCH_EDGES: [string, string][] = [
  ["gw","au"],["gw","uc"],["au","db"],["uc","db"],["au","ca"],["uc","lg"],["ca","db"],
];

const QA_Q = "What breaks if I change the auth middleware?";
const QA_A = "14 direct consumers affected. UserController loses session validation. Database queries for protected routes fail silently. Estimated blast radius: 62% of API surface.";
const QA_HIGHLIGHTS = ["14 direct consumers", "62% of API surface"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeInOut(t: number) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

// ── Rain particle ─────────────────────────────────────────────────────────────
interface Particle {
  name: string;
  col: number;
  y: number;
  speed: number;
  opacity: number;
  targetX?: number;
  targetY?: number;
  clusterId?: number;
}

// ── Main component ────────────────────────────────────────────────────────────
export function ScrollNarrative() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef  = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [pct, setPct] = useState(0);
  const particles  = useRef<Particle[]>([]);
  const animId     = useRef<number>(0);
  const lastPct    = useRef(0);

  // Setup particles
  useEffect(() => {
    const COLS = 10;
    particles.current = FILE_NAMES.map((name, i) => ({
      name,
      col: i % COLS,
      y: Math.random() * -200 - i * 15,
      speed: 0.6 + Math.random() * 0.8,
      opacity: 0.18 + Math.random() * 0.25,
      targetX: undefined,
      targetY: undefined,
      clusterId: i % CLUSTERS.length,
    }));
  }, []);

  // Scroll → pct
  useEffect(() => {
    const onScroll = () => {
      const sec = sectionRef.current;
      if (!sec) return;
      const rect = sec.getBoundingClientRect();
      const total = sec.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      setPct(clamp(scrolled / total, 0, 1));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Canvas draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const p = lastPct.current;

    ctx.clearRect(0, 0, W, H);

    // ── Phase 0–20%: filenames rain ──────────────────────────────────────────
    if (p < 0.45) {
      const rainAlpha = p < 0.2 ? 1 : 1 - (p - 0.2) / 0.25;
      const COLS = 10;
      const colW = W / COLS;

      ctx.font = "11px 'Geist Mono', monospace";

      for (const pt of particles.current) {
        // move downward only in rain phase
        if (p < 0.2) {
          pt.y += pt.speed;
          if (pt.y > H + 20) pt.y = -30;
        }

        // cluster phase 20–45%: drift toward cluster center
        if (p >= 0.2 && p < 0.45) {
          const cluster = CLUSTERS[pt.clusterId!];
          const tx = (cluster.x / 100) * W;
          const ty = (cluster.y / 100) * H;
          const t2 = (p - 0.2) / 0.25;
          const currentX = lerp(pt.col * colW + colW/2, tx, easeInOut(t2));
          const currentY = lerp(pt.y, ty, easeInOut(t2) * 0.4);
          ctx.fillStyle = `rgba(51,51,51,${pt.opacity * rainAlpha})`;
          ctx.fillText(pt.name.slice(0, 14), currentX - 20, currentY);
          // cluster labels
          if (t2 > 0.5) {
            ctx.fillStyle = `rgba(68,68,68,${(t2 - 0.5) * 2 * 0.6})`;
            ctx.font = "10px 'Geist Mono', monospace";
            ctx.fillText(cluster.label, tx - 15, ty + 20);
            ctx.font = "11px 'Geist Mono', monospace";
          }
          continue;
        }

        const x = pt.col * colW + colW / 2;
        ctx.fillStyle = `rgba(51,51,51,${pt.opacity * rainAlpha})`;
        ctx.fillText(pt.name.slice(0, 14), x - 20, pt.y);
      }
    }

    // ── Phase 45–65%: scan line sweeps → architecture graph snaps in ─────────
    if (p >= 0.45 && p < 0.85) {
      const scanProgress = p < 0.65 ? (p - 0.45) / 0.2 : 1;
      const graphProgress = p < 0.65 ? (p - 0.45) / 0.2 : 1;
      const graphAlpha = p >= 0.65 ? 1 - (p - 0.65) / 0.2 : graphProgress;

      // Scan line
      if (p < 0.65) {
        const scanY = scanProgress * H;
        const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 4);
        grad.addColorStop(0, "rgba(0,229,160,0)");
        grad.addColorStop(0.7, "rgba(0,229,160,0.08)");
        grad.addColorStop(1, "rgba(0,229,160,0.6)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, scanY - 30, W, 34);
      }

      // Graph nodes
      for (let i = 0; i < ARCH_NODES.length; i++) {
        const n = ARCH_NODES[i];
        const nodeProgress = clamp((graphProgress * ARCH_NODES.length - i) / 1.5, 0, 1);
        const nx = (n.x / 100) * W;
        const ny = (n.y / 100) * H;
        const r = 20 * nodeProgress;
        const a = nodeProgress * graphAlpha;

        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,229,160,${a * 0.7})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = `rgba(18,18,21,${a})`;
        ctx.fill();

        if (nodeProgress > 0.6) {
          ctx.fillStyle = `rgba(200,200,200,${a * nodeProgress})`;
          ctx.font = "9px 'Geist Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(n.label, nx, ny + r + 14);
          ctx.textAlign = "left";
        }
      }

      // Graph edges
      for (const [a, b] of ARCH_EDGES) {
        const na = ARCH_NODES.find(n => n.id === a)!;
        const nb = ARCH_NODES.find(n => n.id === b)!;
        const edgeProgress = clamp(graphProgress * 2 - 0.5, 0, 1) * graphAlpha;
        ctx.beginPath();
        ctx.moveTo((na.x/100)*W, (na.y/100)*H);
        ctx.lineTo((nb.x/100)*W, (nb.y/100)*H);
        ctx.strokeStyle = `rgba(0,229,160,${edgeProgress * 0.4})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // ── Phase 65–85%: graph fades to 15%, Q&A appears ────────────────────────
    if (p >= 0.65 && p < 0.85) {
      const qaProgress = (p - 0.65) / 0.2;
      const dimAlpha = 0.15;

      // Dimmed graph on right
      ctx.save();
      ctx.globalAlpha = dimAlpha;
      for (const n of ARCH_NODES) {
        const nx = (n.x / 100) * (W * 0.5) + W * 0.5;
        const ny = (n.y / 100) * H;
        ctx.beginPath();
        ctx.arc(nx, ny, 16, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,229,160,0.5)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();

      // Q&A panel on left
      const panelX = 20;
      const panelW = W * 0.42;
      ctx.fillStyle = `rgba(12,12,14,${qaProgress * 0.95})`;
      ctx.strokeStyle = `rgba(42,42,42,${qaProgress})`;
      ctx.lineWidth = 1;
      roundRect(ctx, panelX, H * 0.15, panelW, H * 0.65, 8);
      ctx.fill();
      ctx.stroke();

      // Question text appears
      const qChars = Math.floor(QA_Q.length * qaProgress);
      ctx.fillStyle = `rgba(136,136,136,${qaProgress})`;
      ctx.font = "12px 'Geist Mono', monospace";
      ctx.fillText(`> ${QA_Q.slice(0, qChars)}`, panelX + 16, H * 0.15 + 40);

      // Answer streams in
      if (qaProgress > 0.5) {
        const aProgress = (qaProgress - 0.5) / 0.5;
        const aChars = Math.floor(QA_A.length * aProgress);
        const shown = QA_A.slice(0, aChars);
        ctx.fillStyle = `rgba(85,85,85,${aProgress})`;
        ctx.font = "11px 'Geist Mono', monospace";
        wrapText(ctx, shown, panelX + 16, H * 0.15 + 70, panelW - 32, 18, QA_HIGHLIGHTS, aProgress);
      }
    }

    // ── Phase 85–100%: fade to black, input reappears ─────────────────────────
    if (p >= 0.85) {
      const fadeProgress = (p - 0.85) / 0.15;
      ctx.fillStyle = `rgba(9,9,11,${fadeProgress * 0.92})`;
      ctx.fillRect(0, 0, W, H);

      // Pulsing /connect text
      const pulse = Math.sin(Date.now() / 500) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(0,229,160,${fadeProgress * (0.3 + pulse * 0.3)})`;
      ctx.font = "bold 14px 'Geist Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Your codebase. 8 seconds.", W / 2, H / 2 - 20);

      ctx.strokeStyle = `rgba(0,229,160,${fadeProgress * (0.4 + pulse * 0.3)})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = "rgba(0,229,160,0.4)";
      ctx.shadowBlur = fadeProgress * 10 * pulse;
      roundRect(ctx, W/2 - 160, H/2, 320, 44, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = `rgba(68,68,68,${fadeProgress * 0.7})`;
      ctx.font = "13px 'Geist Mono', monospace";
      ctx.fillText("/connect github.com/org/repo", W / 2, H / 2 + 26);
      ctx.textAlign = "left";
    }

    animId.current = requestAnimationFrame(draw);
  }, []);

  // Start/stop loop
  useEffect(() => {
    lastPct.current = pct;
  }, [pct]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    animId.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId.current);
      ro.disconnect();
    };
  }, [draw]);

  return (
    <div ref={sectionRef} style={{ height: "500vh" }} className="relative">
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen w-full overflow-hidden bg-[#09090b]"
      >
        {/* Progress label */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 font-mono text-[10px] uppercase tracking-widest text-zinc-700 select-none">
          {pct < 0.2 && "01 / SCANNING"}
          {pct >= 0.2 && pct < 0.45 && "02 / CLUSTERING"}
          {pct >= 0.45 && pct < 0.65 && "03 / MAPPING"}
          {pct >= 0.65 && pct < 0.85 && "04 / QUERYING"}
          {pct >= 0.85 && "05 / READY"}
        </div>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, transparent 40%, rgba(9,9,11,0.6) 100%)"
          }}
        />
      </div>
    </div>
  );
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxW: number, lineH: number,
  highlights: string[],
  alpha: number
) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      drawHighlightedLine(ctx, line, x, curY, highlights, alpha);
      line = word;
      curY += lineH;
    } else {
      line = test;
    }
  }
  if (line) drawHighlightedLine(ctx, line, x, curY, highlights, alpha);
}

function drawHighlightedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  highlights: string[],
  alpha: number
) {
  let cursor = x;
  // simple: just draw text colored based on highlights
  const isHighlighted = highlights.some(h => text.includes(h));
  ctx.fillStyle = isHighlighted ? `rgba(0,229,160,${alpha})` : `rgba(85,85,85,${alpha})`;
  ctx.fillText(text, cursor, y);
}

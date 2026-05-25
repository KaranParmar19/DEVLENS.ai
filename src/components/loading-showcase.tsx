import { useEffect, useState } from "react";

const STEPS = [
  "Cloning repo",
  "Parsing file tree",
  "Building dependency graph",
  "Generating architecture map",
  "Indexing for Q&A",
] as const;

const REPO_META = {
  name: "facebook/react",
  stars: "228.4k",
  files: "4,812",
  languages: [
    { name: "TypeScript", pct: 62, color: "bg-zinc-100" },
    { name: "JavaScript", pct: 31, color: "bg-zinc-500" },
    { name: "CSS", pct: 7, color: "bg-zinc-700" },
  ],
};

function useProgress(durationMs = 14000) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const e = (Date.now() - start) % durationMs;
      setT(e / durationMs);
    }, 100);
    return () => clearInterval(id);
  }, [durationMs]);
  return t; // 0..1
}

function activeStepIndex(p: number) {
  return Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
}

function etaLabel(p: number, totalSec = 14) {
  const remain = Math.max(1, Math.ceil(totalSec * (1 - p)));
  return `~${remain}s remaining`;
}

/* ---------- Variation 1: Full-screen terminal log ---------- */
export function LoadingVariantTerminal() {
  const p = useProgress();
  const active = activeStepIndex(p);

  return (
    <Frame label="V_01  /  Terminal Stream" subtitle="Full-screen overlay">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md grid place-items-center p-8">
        <div className="w-full max-w-3xl bg-[#0a0a0c] ring-1 ring-white/10 rounded-lg shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/60 border-b border-white/5">
            <div className="flex gap-1.5">
              <span className="size-2 rounded-full bg-white/10" />
              <span className="size-2 rounded-full bg-white/10" />
              <span className="size-2 rounded-full bg-white/10" />
            </div>
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
              analyze.sh — {REPO_META.name}
            </span>
            <span className="w-10" />
          </div>

          <div className="p-6 font-mono text-[12px] leading-relaxed">
            <div className="text-zinc-500">
              $ devlens analyze <span className="text-zinc-300">{REPO_META.name}</span>
            </div>
            <div className="text-zinc-600 mt-1">
              ↳ {REPO_META.stars} stars · {REPO_META.files} files ·{" "}
              {REPO_META.languages.map((l) => l.name).join(" · ")}
            </div>

            <div className="mt-5 space-y-1.5">
              {STEPS.map((s, i) => {
                const done = i < active;
                const live = i === active;
                return (
                  <div
                    key={s}
                    className={`flex items-center gap-3 ${
                      done ? "text-zinc-500" : live ? "text-zinc-100" : "text-zinc-700"
                    }`}
                  >
                    <span className="w-4">
                      {done ? "✓" : live ? <Spinner /> : "·"}
                    </span>
                    <span>{s}…</span>
                    {done && <span className="ml-auto text-[10px] text-zinc-600">done</span>}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex justify-between text-[10px] text-zinc-600 uppercase tracking-widest">
              <span>{etaLabel(p)}</span>
              <span>{Math.round(p * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Variation 2: Modal with stat sidebar ---------- */
export function LoadingVariantModal() {
  const p = useProgress();
  const active = activeStepIndex(p);

  return (
    <Frame label="V_02  /  Modal + Metadata" subtitle="Centered overlay">
      <div className="absolute inset-0 bg-brand-bg/85 backdrop-blur-sm grid place-items-center p-6">
        <div className="w-full max-w-2xl rounded-xl bg-brand-card ring-1 ring-white/10 shadow-2xl shadow-black/80 grid grid-cols-5 overflow-hidden">
          {/* Sidebar metadata */}
          <div className="col-span-2 p-6 bg-black/30 border-r border-white/5 flex flex-col gap-5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
                Repository
              </div>
              <div className="text-brand-heading font-medium text-sm leading-tight">
                {REPO_META.name}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[10px]">
              <Meta label="Stars" value={REPO_META.stars} />
              <Meta label="Files" value={REPO_META.files} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
                Languages
              </div>
              <div className="flex h-1 rounded-full overflow-hidden bg-white/5">
                {REPO_META.languages.map((l) => (
                  <div key={l.name} className={l.color} style={{ width: `${l.pct}%` }} />
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {REPO_META.languages.map((l) => (
                  <div
                    key={l.name}
                    className="flex items-center gap-2 text-[10px] text-zinc-500"
                  >
                    <span className={`size-1.5 rounded-full ${l.color}`} />
                    {l.name}
                    <span className="ml-auto text-zinc-700">{l.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="col-span-3 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Analyzing
              </span>
              <span className="font-mono text-[10px] text-zinc-500">{etaLabel(p)}</span>
            </div>
            <ol className="space-y-3 flex-1">
              {STEPS.map((s, i) => {
                const done = i < active;
                const live = i === active;
                return (
                  <li key={s} className="flex items-center gap-3">
                    <span
                      className={`size-5 rounded-full grid place-items-center text-[10px] ${
                        done
                          ? "bg-zinc-100 text-zinc-950"
                          : live
                            ? "ring-1 ring-zinc-100/80 text-zinc-100"
                            : "ring-1 ring-white/10 text-zinc-700"
                      }`}
                    >
                      {done ? "✓" : live ? <Spinner /> : i + 1}
                    </span>
                    <span
                      className={`text-sm ${
                        done
                          ? "text-zinc-500 line-through decoration-zinc-700"
                          : live
                            ? "text-brand-heading"
                            : "text-zinc-600"
                      }`}
                    >
                      {s}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-zinc-100 transition-[width] duration-200"
                style={{ width: `${p * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Variation 3: Horizontal pipeline stepper ---------- */
export function LoadingVariantPipeline() {
  const p = useProgress();
  const active = activeStepIndex(p);

  return (
    <Frame label="V_03  /  Pipeline" subtitle="In-app processing strip">
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="w-full max-w-3xl space-y-6">
          {/* Repo header */}
          <div className="flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                Now analyzing
              </div>
              <div className="mt-1 text-2xl font-medium text-brand-heading tracking-tight">
                {REPO_META.name}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {REPO_META.languages.map((l) => (
                  <span
                    key={l.name}
                    className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-white/5 ring-1 ring-white/10 text-zinc-400"
                  >
                    {l.name}
                  </span>
                ))}
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-white/5 ring-1 ring-white/10 text-zinc-400">
                  ★ {REPO_META.stars}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-white/5 ring-1 ring-white/10 text-zinc-400">
                  {REPO_META.files} files
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                ETA
              </div>
              <div className="font-mono text-sm text-brand-heading">{etaLabel(p)}</div>
            </div>
          </div>

          {/* Pipeline */}
          <div className="relative bg-brand-card ring-1 ring-white/10 rounded-lg p-6">
            <div className="absolute top-[42px] left-10 right-10 h-px bg-white/5" />
            <div
              className="absolute top-[42px] left-10 h-px bg-zinc-100/80 transition-[width] duration-200"
              style={{ width: `calc((100% - 80px) * ${p})` }}
            />
            <div className="relative grid grid-cols-5 gap-2">
              {STEPS.map((s, i) => {
                const done = i < active;
                const live = i === active;
                return (
                  <div key={s} className="flex flex-col items-center text-center gap-3">
                    <span
                      className={`size-5 rounded-full grid place-items-center text-[10px] ${
                        done
                          ? "bg-zinc-100 text-zinc-950"
                          : live
                            ? "bg-zinc-900 ring-2 ring-zinc-100 text-zinc-100 shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                            : "bg-zinc-900 ring-1 ring-white/10 text-zinc-600"
                      }`}
                    >
                      {done ? "✓" : live ? <Spinner /> : i + 1}
                    </span>
                    <span
                      className={`text-[11px] leading-tight ${
                        live
                          ? "text-brand-heading"
                          : done
                            ? "text-zinc-500"
                            : "text-zinc-600"
                      }`}
                    >
                      {s}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Variation 4: Split with live node graph ---------- */
export function LoadingVariantSplit() {
  const p = useProgress();
  const active = activeStepIndex(p);

  return (
    <Frame label="V_04  /  Spatial Render" subtitle="Split overlay + graph">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md grid grid-cols-5">
        {/* Left: steps */}
        <div className="col-span-2 p-6 bg-brand-bg border-r border-white/10 flex flex-col gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              Bootstrapping
            </div>
            <div className="mt-1 text-brand-heading font-medium">{REPO_META.name}</div>
            <div className="mt-1 text-[10px] font-mono text-zinc-500">
              ★ {REPO_META.stars} · {REPO_META.files} files
            </div>
          </div>

          <div className="flex-1 relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />
            <div
              className="absolute left-[7px] top-2 w-px bg-zinc-100/70 transition-[height] duration-200"
              style={{ height: `calc((100% - 16px) * ${p})` }}
            />
            <ul className="space-y-4">
              {STEPS.map((s, i) => {
                const done = i < active;
                const live = i === active;
                return (
                  <li key={s} className="flex items-center gap-4">
                    <span
                      className={`size-[15px] rounded-full grid place-items-center text-[8px] z-10 ${
                        done
                          ? "bg-zinc-100 text-zinc-950"
                          : live
                            ? "bg-brand-bg ring-2 ring-zinc-100 text-zinc-100"
                            : "bg-brand-bg ring-1 ring-white/15 text-zinc-700"
                      }`}
                    >
                      {done ? "✓" : live ? "●" : ""}
                    </span>
                    <span
                      className={`text-xs ${
                        live
                          ? "text-brand-heading"
                          : done
                            ? "text-zinc-500"
                            : "text-zinc-600"
                      }`}
                    >
                      {s}…
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-between font-mono text-[10px] text-zinc-500">
            <span>{etaLabel(p)}</span>
            <span>{Math.round(p * 100)}%</span>
          </div>
        </div>

        {/* Right: live graph */}
        <div className="col-span-3 relative bg-[#0a0a0c] overflow-hidden">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #ffffff15 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          <LiveGraph progress={p} />
          <div className="absolute bottom-4 left-4 font-mono text-[9px] text-zinc-500 flex flex-col gap-0.5">
            <span>RENDER_ENGINE: BLINK_V2</span>
            <span>NODES: {Math.round(p * 12482).toLocaleString()}</span>
            <span>EDGES: {Math.round(p * 28104).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ---------- Helpers ---------- */
function Frame({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {label}
        </span>
        <span className="font-mono text-[10px] text-zinc-700">{subtitle}</span>
      </div>
      <div className="relative aspect-[4/3] rounded-md bg-brand-card ring-1 ring-white/10 overflow-hidden shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] transition-all group-hover:ring-white/20">
        {children}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-white/5 ring-1 ring-white/5 p-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
        {label}
      </div>
      <div className="font-mono text-[11px] text-brand-heading mt-0.5">{value}</div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block size-2.5 rounded-full border border-zinc-100/30 border-t-zinc-100 animate-spin"
      aria-label="loading"
    />
  );
}

function LiveGraph({ progress }: { progress: number }) {
  // Static seeded layout; "reveal" lines/nodes proportional to progress.
  const nodes = [
    { x: 50, y: 50 },
    { x: 22, y: 30 },
    { x: 78, y: 28 },
    { x: 16, y: 70 },
    { x: 82, y: 72 },
    { x: 38, y: 18 },
    { x: 64, y: 82 },
    { x: 38, y: 84 },
    { x: 64, y: 16 },
    { x: 10, y: 48 },
    { x: 90, y: 50 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
    [1, 5], [2, 8], [3, 7], [4, 6], [1, 9], [2, 10],
    [5, 8], [3, 9], [4, 10],
  ];
  const revealed = Math.ceil(edges.length * progress);
  const nodeReveal = Math.ceil(nodes.length * Math.min(1, progress * 1.2));

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      {edges.slice(0, revealed).map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={0.2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {nodes.slice(0, nodeReveal).map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={i === 0 ? 1.4 : 0.9} fill="#fafafa" />
          {i === 0 && (
            <circle
              cx={n.x}
              cy={n.y}
              r={3}
              fill="none"
              stroke="#fafafa"
              strokeWidth={0.2}
              opacity={0.4}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
      ))}
    </svg>
  );
}

export function LoadingShowcase() {
  return (
    <section id="loading" className="relative py-32 border-t border-white/5 bg-brand-bg">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-3">
              02 / Processing State
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-brand-heading max-w-[20ch] leading-tight">
              Four ways to wait — none of them boring.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-zinc-500 leading-relaxed">
            From repo clone to Q&A index in seconds. Every step is observable, every metric
            visible. No black-box loaders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LoadingVariantTerminal />
          <LoadingVariantModal />
          <LoadingVariantPipeline />
          <LoadingVariantSplit />
        </div>
      </div>
    </section>
  );
}

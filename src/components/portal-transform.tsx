import { useEffect, useMemo, useRef, useState } from "react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useChat } from "@/hooks/useChat";
import type { FileNode } from "@/lib/api";

type StepStatus = "pending" | "active" | "done";

const STEPS = [
  "Cloning repo",
  "Parsing file tree",
  "Building dependency graph",
  "Generating architecture map",
  "Indexing for Q&A",
] as const;

const STEP_INTERVAL = 600; // ms between checklist ticks
const DASHBOARD_FADE_IN = 350; // overlay appear
const OVERLAY_FADE_OUT = 400; // processing modal dissolve
const FLASH_DURATION = 2000;

export function PortalTransform({
  open,
  repoUrl,
  onClose,
}: {
  open: boolean;
  repoUrl: string;
  onClose: () => void;
}) {
  const { state: analysisState, startAnalysis, reset: _resetAnalysis } = useAnalysis();
  const chat = useChat(analysisState.sessionId ?? null);
  // mounted: controls presence in the tree (kept for fade-out)
  const [mounted, setMounted] = useState(false);
  // shown: drives opacity/transform of the whole layer (false right after mount → triggers fade-in)
  const [shown, setShown] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [processingDone, setProcessingDone] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [drawNodes, setDrawNodes] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Mount / unmount lifecycle + trigger real analysis
  useEffect(() => {
    if (open) {
      setMounted(true);
      setShown(false);
      setActiveStep(0);
      setProcessingDone(false);
      setShowFlash(false);
      setDrawNodes(false);
      // Kick off real backend analysis
      if (repoUrl) startAnalysis(repoUrl);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => setShown(true));
      });
    } else if (mounted) {
      setShown(false);
      const t = setTimeout(() => setMounted(false), DASHBOARD_FADE_IN);
      return () => clearTimeout(t);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sync activeStep from real WebSocket progress
  const currentStepIndex = analysisState.steps.findIndex(s => s.status === 'active');
  const isRunning = !analysisState.isComplete && !analysisState.error && analysisState.jobId !== null;

  useEffect(() => {
    if (currentStepIndex >= 0) {
      setActiveStep(currentStepIndex);
    }
    if (analysisState.isComplete) {
      setActiveStep(STEPS.length);
      const t = setTimeout(() => setProcessingDone(true), 400);
      return () => clearTimeout(t);
    }
    // Fallback fake ticker if backend is not connected
    if (!isRunning && shown && !processingDone && activeStep < STEPS.length) {
      const t = setTimeout(() => setActiveStep((s) => s + 1), STEP_INTERVAL);
      return () => clearTimeout(t);
    }
  }, [currentStepIndex, analysisState.isComplete, isRunning, shown, activeStep, processingDone]);

  // After overlay dissolves → flash + draw nodes
  useEffect(() => {
    if (!processingDone) return;
    const tFlash = setTimeout(() => setShowFlash(true), OVERLAY_FADE_OUT);
    const tFlashOff = setTimeout(
      () => setShowFlash(false),
      OVERLAY_FADE_OUT + FLASH_DURATION,
    );
    const tDraw = setTimeout(() => setDrawNodes(true), OVERLAY_FADE_OUT + 100);
    return () => {
      clearTimeout(tFlash);
      clearTimeout(tFlashOff);
      clearTimeout(tDraw);
    };
  }, [processingDone]);

  // Smooth progress bar driven by activeStep (with eased interpolation via CSS)
  const progressPct = useMemo(() => {
    const base = Math.min(activeStep, STEPS.length) / STEPS.length;
    return Math.round(base * 100);
  }, [activeStep]);

  if (!mounted) return null;

  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div
      className="fixed inset-0 z-[100] font-sans text-brand-text"
      role="dialog"
      aria-label="Analyzing repository"
      style={{
        opacity: shown ? 1 : 0,
        transition: `opacity ${DASHBOARD_FADE_IN}ms ${ease}`,
        willChange: "opacity",
      }}
    >
      {/* ===== Dashboard shell (already built; sits underneath) ===== */}
      <div
        className="absolute inset-0 bg-brand-bg"
        style={{
          transform: shown ? "scale(1)" : "scale(1.01)",
          transition: `transform ${DASHBOARD_FADE_IN}ms ${ease}`,
          willChange: "transform",
        }}
      >
        <DashboardShell
          repoUrl={repoUrl}
          onClose={onClose}
          drawNodes={drawNodes}
          showFlash={showFlash}
          graphData={analysisState.graphData ?? undefined}
          fileTree={analysisState.filesData?.tree}
          entryPoints={analysisState.filesData?.entry_points}
          chat={chat}
        />
      </div>

      {/* ===== Phase 3 — Processing overlay ===== */}
      <div
        className="absolute inset-0 grid place-items-center"
        style={{
          backgroundColor: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(2px)",
          opacity: processingDone ? 0 : 1,
          transition: `opacity ${OVERLAY_FADE_OUT}ms ${ease}`,
          pointerEvents: processingDone ? "none" : "auto",
          willChange: "opacity",
        }}
      >
        <ProcessingModal
          repoUrl={repoUrl}
          activeStep={activeStep}
          progressPct={progressPct}
          appear={shown}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Processing Modal ----------------------------- */

function ProcessingModal({
  repoUrl,
  activeStep,
  progressPct,
  appear,
}: {
  repoUrl: string;
  activeStep: number;
  progressPct: number;
  appear: boolean;
}) {
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const remaining = Math.max(0, Math.ceil(((STEPS.length - activeStep) * STEP_INTERVAL) / 1000));
  const repoLabel = repoUrl?.replace(/^https?:\/\/(www\.)?github\.com\//, "") || "facebook/react";

  return (
    <div
      className="w-[min(720px,92vw)] rounded-xl bg-[#0c0c0e] ring-1 ring-white/10 shadow-[0_60px_120px_-30px_rgba(0,0,0,0.9)] p-8"
      style={{
        transform: appear ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)",
        opacity: appear ? 1 : 0,
        transition: `opacity 350ms ${ease}, transform 350ms ${ease}`,
        willChange: "opacity, transform",
      }}
    >
      <div className="flex items-start justify-between mb-8">
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Repository
          </div>
          <div className="font-mono text-base text-brand-heading">{repoLabel}</div>
        </div>
        <div className="text-right space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 flex items-center gap-2 justify-end">
            <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
            Analyzing
          </div>
          <div className="font-mono text-xs text-zinc-500">~{remaining}s remaining</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Metadata column — staggered fade-in */}
        <div className="space-y-6">
          <MetaRow label="Stars" value="228.4k" delay={120} />
          <MetaRow label="Files" value="4,812" delay={240} />
          <div style={{ animation: `dl-fade-up 500ms ${ease} 360ms both` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-3">
              Languages
            </div>
            <div className="space-y-2">
              <LangBar color="#3b82f6" name="TypeScript" pct={62} />
              <LangBar color="#facc15" name="JavaScript" pct={31} />
              <LangBar color="#a855f7" name="CSS" pct={7} />
            </div>
          </div>
        </div>

        {/* Checklist column */}
        <div className="space-y-3">
          {STEPS.map((label, i) => {
            const status: StepStatus =
              i < activeStep ? "done" : i === activeStep ? "active" : "pending";
            return <ChecklistItem key={label} label={label} status={status} index={i} />;
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-8">
        <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-zinc-400 to-zinc-100"
            style={{
              width: `${progressPct}%`,
              transition: `width ${STEP_INTERVAL}ms ${ease}`,
              willChange: "width",
            }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <span>Processing</span>
          <span className="tabular-nums">{progressPct}%</span>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div
      style={{
        animation: `dl-fade-up 500ms cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-1">
        {label}
      </div>
      <div className="text-2xl font-medium text-brand-heading tabular-nums">{value}</div>
    </div>
  );
}

function LangBar({ color, name, pct }: { color: string; name: string; pct: number }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex-1">{name}</span>
      <span className="tabular-nums text-zinc-500">{pct}%</span>
    </div>
  );
}

function ChecklistItem({
  label,
  status,
  index,
}: {
  label: string;
  status: StepStatus;
  index: number;
}) {
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  return (
    <div
      className="flex items-center gap-3"
      style={{
        opacity: status === "pending" ? 0.45 : 1,
        transition: `opacity 300ms ${ease}`,
        animation: `dl-fade-up 400ms ${ease} ${index * 80}ms both`,
      }}
    >
      <div className="size-5 grid place-items-center shrink-0">
        {status === "done" && (
          <svg
            viewBox="0 0 16 16"
            className="size-4"
            style={{ animation: `dl-pop 280ms ${ease} both` }}
          >
            <path
              d="M3 8.5l3 3 7-7"
              fill="none"
              stroke="rgb(16,185,129)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {status === "active" && (
          <span className="size-3 rounded-full border-2 border-zinc-700 border-t-zinc-100 animate-spin" />
        )}
        {status === "pending" && (
          <span className="size-2 rounded-full border border-zinc-700" />
        )}
      </div>
      <span
        className={`text-sm ${
          status === "done"
            ? "text-zinc-500 line-through decoration-zinc-700"
            : status === "active"
              ? "text-brand-heading"
              : "text-zinc-600"
        }`}
      >
        {label}
        {status === "active" && "..."}
      </span>
    </div>
  );
}

/* -------------------------------- Dashboard -------------------------------- */

type LeftTab = "FILES" | "MODULES" | "ENTRY POINTS";
type CenterTab = "ARCHITECTURE" | "CODE FLOW" | "ONBOARDING DOC";

function DashboardShell({
  repoUrl,
  onClose,
  drawNodes,
  showFlash,
  graphData,
  fileTree,
  entryPoints,
  chat,
}: {
  repoUrl: string;
  onClose: () => void;
  drawNodes: boolean;
  showFlash: boolean;
  graphData?: { nodes: Node[]; edges: [string, string][]; meta?: Record<string, unknown> };
  fileTree?: FileNode[];
  entryPoints?: string[];
  chat: ReturnType<typeof useChat>;
}) {
  const repoLabel = repoUrl?.replace(/^https?:\/\/(www\.)?github\.com\//, "") || "facebook/react";
  const [leftTab, setLeftTab] = useState<LeftTab>("FILES");
  const [centerTab, setCenterTab] = useState<CenterTab>("ARCHITECTURE");
  const [activeFile, setActiveFile] = useState("src/components/Button.tsx");
  const [fileFilter, setFileFilter] = useState("");

  return (
    <>
      {/* ============================== Top Bar ============================== */}
      <header className="absolute top-0 left-0 right-0 h-[52px] border-b border-white/5 bg-brand-bg/95 backdrop-blur flex items-center px-4 gap-4 z-20">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-brand-heading">
          <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          DEVLENS_V2
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2 font-mono text-xs text-brand-heading">
          <span className="text-zinc-500">repo:</span>
          <span>{repoLabel}</span>
          <span className="ml-1 px-1.5 py-0.5 rounded bg-white/5 ring-1 ring-white/10 text-[10px] uppercase tracking-widest text-zinc-400">
            main
          </span>
        </div>

        {/* Center: languages */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <LangBadge color="#3b82f6" name="TypeScript" />
          <LangBadge color="#facc15" name="JavaScript" />
          <LangBadge color="#a855f7" name="CSS" />
        </div>

        {/* Right: actions + flash + status */}
        <div
          className="font-mono text-[10px] uppercase tracking-widest mr-2"
          style={{
            color: "rgb(16,185,129)",
            opacity: showFlash ? 1 : 0,
            transform: showFlash ? "translateY(0)" : "translateY(-4px)",
            transition: "opacity 300ms ease, transform 300ms ease",
          }}
        >
          ◆ Analysis Complete
        </div>
        <TopBarButton label="Share" />
        <TopBarButton label="Export" />
        <TopBarButton label="Docs" />
        <TopBarButton label="Invite" primary />
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
          <span className="size-1.5 rounded-full bg-[#00E5A0] shadow-[0_0_10px_rgba(0,229,160,0.7)]" />
          Indexed
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 text-zinc-500 hover:text-brand-heading text-sm px-2"
          aria-label="Close"
        >
          ✕
        </button>
      </header>

      {/* ============================ Left Panel ============================ */}
      <aside className="absolute top-[52px] bottom-0 left-0 w-[220px] border-r border-white/5 bg-[#0b0b0d] flex flex-col">
        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-zinc-600">
              ⌕
            </span>
            <input
              type="text"
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              placeholder="filter files..."
              className="w-full bg-white/5 ring-1 ring-white/5 rounded-sm pl-7 pr-2 py-1.5 font-mono text-xs text-brand-heading placeholder:text-zinc-600 outline-none focus:ring-white/15"
            />
          </div>
        </div>

        <div className="flex border-b border-white/5">
          {(["FILES", "MODULES", "ENTRY POINTS"] as LeftTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLeftTab(t)}
              className={`flex-1 py-2 font-mono text-[9px] uppercase tracking-widest transition-colors relative ${
                leftTab === t
                  ? "text-brand-heading"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {t}
              {leftTab === t && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.6)]" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-2">
          {leftTab === "FILES" && (
            <FileTree
              filter={fileFilter}
              active={activeFile}
              onSelect={setActiveFile}
              items={fileTree}
            />
          )}
          {leftTab === "MODULES" && <ModulesList />}
          {leftTab === "ENTRY POINTS" && <EntryPointsList items={entryPoints} />}
        </div>
      </aside>

      {/* =========================== Center Panel =========================== */}
      <main className="absolute top-[52px] bottom-0 left-[220px] right-[320px] flex flex-col bg-brand-bg">
        <div className="flex border-b border-white/5 px-2">
          {(["ARCHITECTURE", "CODE FLOW", "ONBOARDING DOC"] as CenterTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCenterTab(t)}
              className={`px-4 py-3 font-mono text-[10px] uppercase tracking-widest transition-colors relative ${
                centerTab === t
                  ? "text-brand-heading"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {t}
              {centerTab === t && (
                <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-[#00E5A0] shadow-[0_0_10px_rgba(0,229,160,0.6)]" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 relative overflow-hidden">
          {centerTab === "ARCHITECTURE" && <ArchitectureGraph draw={drawNodes} graphData={graphData} />}
          {centerTab === "CODE FLOW" && <CodeFlowPlaceholder />}
          {centerTab === "ONBOARDING DOC" && <OnboardingDocPlaceholder repo={repoLabel} />}
        </div>
      </main>

      {/* ============================ Right Panel =========================== */}
      <aside className="absolute top-[52px] bottom-0 right-0 w-[320px] border-l border-white/5 bg-[#0b0b0d] flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span className="size-1.5 rounded-full bg-zinc-100 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
            Ask DevLens
            {chat.isStreaming && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          </div>
        </div>

        <div className="p-4 border-b border-white/5">
          <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-2">Suggested</div>
          <div className="flex flex-wrap gap-1.5">
            {["What does this repo do?","Explain the auth flow","What are the entry points?"].map((q) => (
              <button key={q} type="button"
                onClick={() => chat.sendMessage(q)}
                className="text-[11px] text-zinc-400 bg-white/5 ring-1 ring-white/5 hover:ring-white/15 hover:text-brand-heading rounded-full px-2.5 py-1 transition-colors"
              >{q}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {chat.messages.length === 0 ? (
            <div className="h-full grid place-items-center text-center">
              <div className="max-w-[220px]">
                <div className="size-10 mx-auto mb-3 rounded-full ring-1 ring-white/10 grid place-items-center">
                  <span className="font-mono text-xs text-zinc-500">AI</span>
                </div>
                <div className="text-xs text-zinc-500 leading-relaxed">
                  Ask anything about{" "}
                  <span className="text-brand-heading font-mono">{repoLabel}</span> — architecture, flows, edge cases, refactor risk.
                </div>
              </div>
            </div>
          ) : (
            chat.messages.map((msg, i) => (
              <div key={i} className={`text-xs leading-relaxed ${
                msg.role === "user" ? "text-brand-heading text-right" : "text-zinc-400"
              }`}>
                {msg.role === "assistant" && (
                  <span className="font-mono text-[9px] uppercase text-zinc-600 block mb-1">DevLens</span>
                )}
                <span className={`inline-block px-3 py-2 rounded-lg ${
                  msg.role === "user" ? "bg-white/10" : "bg-zinc-900 ring-1 ring-white/5"
                }`}>{msg.content}</span>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {msg.sources.map((s) => (
                      <span key={s} className="font-mono text-[9px] text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded">{s.split("/").pop()}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/5">
          <ChatInput onSend={chat.sendMessage} repoLabel={repoLabel} disabled={chat.isStreaming} />
        </div>
      </aside>
    </>
  );
}

function TopBarButton({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded transition-colors ${
        primary
          ? "bg-zinc-100 text-zinc-950 hover:bg-white"
          : "text-zinc-400 hover:text-brand-heading hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

function LangBadge({ color, name }: { color: string; name: string }) {
  return (
    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10 font-mono text-[10px] text-zinc-400">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

/* ------------------------------- Left panels ------------------------------ */

const FILE_TREE: Array<{ d: number; n: string; o?: boolean; path?: string }> = [
  { d: 0, n: "src/", o: true },
  { d: 1, n: "components/", o: true },
  { d: 2, n: "Button.tsx", path: "src/components/Button.tsx" },
  { d: 2, n: "Modal.tsx", path: "src/components/Modal.tsx" },
  { d: 2, n: "Sidebar.tsx", path: "src/components/Sidebar.tsx" },
  { d: 1, n: "hooks/", o: true },
  { d: 2, n: "useAuth.ts", path: "src/hooks/useAuth.ts" },
  { d: 2, n: "useFetch.ts", path: "src/hooks/useFetch.ts" },
  { d: 1, n: "utils/", o: true },
  { d: 2, n: "format.ts", path: "src/utils/format.ts" },
  { d: 2, n: "logger.ts", path: "src/utils/logger.ts" },
  { d: 1, n: "services/", o: true },
  { d: 2, n: "auth.service.ts", path: "src/services/auth.service.ts" },
  { d: 2, n: "api.gateway.ts", path: "src/services/api.gateway.ts" },
  { d: 1, n: "routes/", o: true },
  { d: 2, n: "index.tsx", path: "src/routes/index.tsx" },
  { d: 0, n: "__tests__/", o: false },
  { d: 0, n: "package.json", path: "package.json" },
  { d: 0, n: "README.md", path: "README.md" },
  { d: 0, n: "tsconfig.json", path: "tsconfig.json" },
];

function FileTree({
  filter,
  active,
  onSelect,
  items,
}: {
  filter: string;
  active: string;
  onSelect: (path: string) => void;
  items?: FileNode[];
}) {
  const q = filter.trim().toLowerCase();

  // Use real API data if available, else fall back to static demo tree
  if (items && items.length > 0) {
    const filtered = items.filter((f) => !q || f.path.toLowerCase().includes(q));
    return (
      <div className="font-mono text-xs space-y-0.5">
        {filtered.map((f) => (
          <button key={f.path} type="button" onClick={() => onSelect(f.path)}
            className={`w-full text-left flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${
              f.path === active ? "bg-white/10 text-brand-heading ring-1 ring-white/10" : "text-zinc-500 hover:text-brand-heading hover:bg-white/5"
            }`}
            style={{ paddingLeft: 6 + f.depth * 10 }}>
            <span className="truncate">{f.name}</span>
            {f.language && <span className="ml-auto text-zinc-700 text-[9px] shrink-0">{f.language}</span>}
          </button>
        ))}
      </div>
    );
  }

  // Fallback static demo
  return (
    <div className="font-mono text-xs space-y-0.5">
      {FILE_TREE.filter(
        (f) => !q || f.n.toLowerCase().includes(q) || f.path?.toLowerCase().includes(q),
      ).map((f, i) => {
        const isFolder = f.n.endsWith("/");
        const isActive = !isFolder && f.path === active;
        return (
          <button key={f.path ?? `fallback-${i}`} type="button" onClick={() => f.path && onSelect(f.path)}
            disabled={isFolder}
            className={`w-full text-left flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors ${
              isActive ? "bg-white/10 text-brand-heading ring-1 ring-white/10" : "text-zinc-500 hover:text-brand-heading hover:bg-white/5"
            }`}
            style={{ paddingLeft: 6 + f.d * 12 }}>
            <span className="text-zinc-700 w-3 shrink-0">{isFolder ? (f.o ? "▾" : "▸") : ""}</span>
            <span className="truncate">{f.n}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModulesList() {
  const mods = [
    { n: "auth", c: 12 },
    { n: "api", c: 28 },
    { n: "ui", c: 41 },
    { n: "store", c: 9 },
    { n: "utils", c: 17 },
    { n: "cache", c: 6 },
  ];
  return (
    <div className="space-y-1">
      {mods.map((m) => (
        <div
          key={m.n}
          className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 font-mono text-xs text-zinc-400 cursor-default"
        >
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-zinc-500" />
            {m.n}
          </span>
          <span className="text-zinc-600 text-[10px]">{m.c} files</span>
        </div>
      ))}
    </div>
  );
}

function EntryPointsList({ items }: { items?: string[] }) {
  const eps = items && items.length > 0
    ? items
    : ["src/routes/index.tsx", "src/server.ts", "src/start.ts", "src/router.tsx"];
  return (
    <div className="space-y-1">
      {eps.map((e) => (
        <div key={e} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 font-mono text-[11px] text-zinc-400 cursor-default">
          <span className="text-emerald-500 text-[10px]">●</span>
          <span className="truncate">{e}</span>
        </div>
      ))}
    </div>
  );
}

function ChatInput({ onSend, repoLabel, disabled }: { onSend: (msg: string) => void; repoLabel: string; disabled?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) { onSend(value.trim()); setValue(""); } }}
      className="flex items-center gap-2 bg-white/5 ring-1 ring-white/10 rounded-md pl-3 pr-1 py-1 focus-within:ring-white/25 transition-shadow">
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
        placeholder={disabled ? "DevLens is thinking..." : `Ask anything about ${repoLabel}...`}
        disabled={disabled}
        className="flex-1 bg-transparent text-xs text-brand-heading outline-none placeholder:text-zinc-600 min-w-0 disabled:opacity-50" />
      <button type="submit" aria-label="Send" disabled={disabled || !value.trim()}
        className="size-7 rounded bg-[#00E5A0] text-zinc-950 grid place-items-center hover:bg-[#1cf1b1] shadow-[0_0_18px_rgba(0,229,160,0.35)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );
}

/* --------------------------- Center placeholders -------------------------- */

function CodeFlowPlaceholder() {
  return (
    <div className="absolute inset-0 grid place-items-center text-center">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          Code_Flow
        </div>
        <div className="text-zinc-500 text-sm mt-2 max-w-sm">
          Trace execution paths across modules. Select a function to see callers and callees.
        </div>
      </div>
    </div>
  );
}

function OnboardingDocPlaceholder({ repo }: { repo: string }) {
  return (
    <div className="absolute inset-0 overflow-auto p-10">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          Onboarding_Doc
        </div>
        <h3 className="text-2xl font-medium text-brand-heading">Getting started with {repo}</h3>
        <p className="text-sm text-zinc-500 leading-relaxed">
          A senior-engineer-grade walkthrough auto-generated from the codebase. Architecture,
          critical paths, gotchas, and a "first PR" suggestion.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-4">
          {["Architecture", "Critical paths", "Conventions", "First PR"].map((s) => (
            <div
              key={s}
              className="rounded bg-zinc-900/60 ring-1 ring-white/10 p-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500"
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Architecture ------------------------------ */

type Node = { id: string; x: number; y: number; label: string; path: string; desc: string };

// Hierarchy (top → bottom): gateway → controllers → services/config → infra
const NODES: Node[] = [
  // Row 1 — entry
  { id: "gateway", x: 50, y: 12, label: "APIGateway", path: "src/services/api.gateway.ts", desc: "Routes incoming HTTP requests to internal services." },
  // Row 2 — controllers
  { id: "auth", x: 28, y: 36, label: "AuthService", path: "src/services/auth.service.ts", desc: "Handles login, tokens, and session validation." },
  { id: "user", x: 72, y: 36, label: "UserController", path: "src/controllers/user.controller.ts", desc: "CRUD + profile actions for users." },
  // Row 3 — coordination
  { id: "config", x: 28, y: 60, label: "ConfigStore", path: "src/config/index.ts", desc: "Central config + feature flags." },
  { id: "event", x: 72, y: 60, label: "EventBus", path: "src/services/event.bus.ts", desc: "Pub/sub for cross-module events." },
  // Row 4 — infrastructure
  { id: "cache", x: 20, y: 86, label: "CacheLayer", path: "src/services/cache.layer.ts", desc: "Redis-backed read-through cache." },
  { id: "db", x: 50, y: 86, label: "Database", path: "src/db/index.ts", desc: "PostgreSQL connection pool." },
  { id: "logger", x: 80, y: 86, label: "Logger", path: "src/utils/logger.ts", desc: "Structured logs + tracing." },
];

const EDGES: Array<[string, string]> = [
  ["gateway", "auth"],
  ["gateway", "user"],
  ["auth", "config"],
  ["user", "config"],
  ["user", "event"],
  ["auth", "cache"],
  ["event", "logger"],
  ["cache", "db"],
  ["user", "db"],
  ["config", "db"],
];

const NODE_PX = 48; // visual circle size
const NODE_HALF_VB = 3.2; // ~ NODE_PX/2 in viewBox units (assuming ~750px canvas)

function ArchitectureGraph({ draw, graphData }: { draw: boolean; graphData?: { nodes: Node[]; edges: [string,string][] } }) {
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Use real API nodes/edges if available, else fall back to static demo
  const activeNodes = (graphData?.nodes?.length ? graphData.nodes : NODES) as Node[];
  const activeEdges = (graphData?.edges?.length ? graphData.edges : EDGES) as [string,string][];
  const focus = selected ?? hover;
  const focused = activeNodes.find((n) => n.id === focus);
  const selectedNode = activeNodes.find((n) => n.id === selected);

  const connectedIds = useMemo(() => {
    if (!selected) return null;
    const ids = new Set<string>([selected]);
    for (const [a, b] of activeEdges) {
      if (a === selected) ids.add(b);
      if (b === selected) ids.add(a);
    }
    return ids;
  }, [selected, activeEdges]);

  return (
    <div
      className="absolute inset-0 bg-[radial-gradient(40%_50%_at_50%_50%,_rgba(63,63,70,0.10)_0%,_transparent_100%)] overflow-hidden"
      onClick={() => setSelected(null)}
    >
      {/* grid backdrop */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          transition: `transform 200ms ${ease}`,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(255,255,255,0.35)" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#00E5A0" />
            </marker>
            <marker
              id="arrow-dim"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(255,255,255,0.08)" />
            </marker>
          </defs>
          {activeEdges.map(([a, b], i) => {
            const na = activeNodes.find((n) => n.id === a);
            const nb = activeNodes.find((n) => n.id === b);
            // Guard: skip edges whose nodes aren't in the current graph
            if (!na || !nb) return null;
            // shorten endpoint so arrow lands at circle edge, not center
            const dx = nb.x - na.x;
            const dy = nb.y - na.y;
            const len = Math.hypot(dx, dy);
            // Guard: skip degenerate edges where both nodes are at the same position
            if (len === 0) return null;
            const ux = dx / len;
            const uy = dy / len;
            const x1 = na.x + ux * NODE_HALF_VB;
            const y1 = na.y + uy * NODE_HALF_VB;
            const x2 = nb.x - ux * NODE_HALF_VB;
            const y2 = nb.y - uy * NODE_HALF_VB;
            const adj = Math.hypot(x2 - x1, y2 - y1);
            const isActive = selected && (a === selected || b === selected);
            const isDim = selected && !isActive;
            const stroke = isActive
              ? "#00E5A0"
              : isDim
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.22)";
            const marker = isActive
              ? "url(#arrow-active)"
              : isDim
                ? "url(#arrow-dim)"
                : "url(#arrow-default)";
            return (
              <line
                key={`${a}-${b}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={isActive ? 0.32 : 0.22}
                strokeDasharray={adj}
                strokeDashoffset={draw ? 0 : adj}
                markerEnd={marker}
                style={{
                  transition: `stroke-dashoffset 700ms ${ease} ${600 + i * 80}ms, stroke 200ms ease, stroke-width 200ms ease`,
                }}
              />
            );
          })}
        </svg>

        {activeNodes.map((n, i) => {
          const isHover = hover === n.id;
          const isSelected = selected === n.id;
          const isConnected = connectedIds?.has(n.id) ?? false;
          const isDim = selected && !isConnected;
          return (
            <button
              type="button"
              key={n.id}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
              onClick={(e) => {
                e.stopPropagation();
                setSelected((s) => (s === n.id ? null : n.id));
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 group focus:outline-none"
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                opacity: draw ? (isDim ? 0.35 : 1) : 0,
                transform: `translate(-50%, -50%) scale(${draw ? 1 : 0.5})`,
                transition: `opacity 220ms ${ease} ${draw ? 0 : i * 90}ms, transform 320ms ${ease} ${i * 90}ms`,
                willChange: "opacity, transform",
              }}
            >
              <span
                className={`grid place-items-center font-mono text-[10px] font-medium uppercase tracking-tight rounded-full ring-1 transition-all ${
                  isSelected
                    ? "bg-[#0e1f1a] text-[#00E5A0] ring-[#00E5A0] shadow-[0_0_24px_rgba(0,229,160,0.45)]"
                    : isHover
                      ? "bg-zinc-700 text-brand-heading ring-white/40 shadow-[0_0_18px_rgba(255,255,255,0.18)]"
                      : "bg-zinc-800 text-zinc-300 ring-white/15 group-hover:ring-white/30"
                }`}
                style={{ width: NODE_PX, height: NODE_PX }}
              >
                {n.label.slice(0, 2).toUpperCase()}
              </span>
              <span
                className={`font-mono text-[10px] uppercase tracking-widest whitespace-nowrap ${
                  isSelected ? "text-[#00E5A0]" : "text-zinc-400"
                }`}
              >
                {n.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Hover tooltip (only when not selected, to avoid double-info) */}
      {focused && !selected && (
        <div
          className="absolute z-10 pointer-events-none rounded-md bg-[#0c0c0e] ring-1 ring-white/15 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] px-3 py-2 max-w-[240px]"
          style={{
            left: `min(${focused.x}%, calc(100% - 260px))`,
            top: `calc(${focused.y}% + 44px)`,
            transform: "translateX(-50%)",
            animation: `dl-fade-up 180ms ${ease} both`,
          }}
        >
          <div className="font-mono text-[10px] text-brand-heading">{focused.label}</div>
          <div className="font-mono text-[10px] text-zinc-500 mt-0.5">{focused.path}</div>
          <div className="text-[11px] text-zinc-400 mt-1.5 leading-snug">{focused.desc}</div>
        </div>
      )}

      {/* Breadcrumb (only when a node is clicked) */}
      {selectedNode && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0c0c0e]/90 ring-1 ring-white/10 backdrop-blur font-mono text-[10px] text-zinc-400"
          style={{ animation: `dl-fade-up 200ms ${ease} both` }}
        >
          {selectedNode.path.split("/").map((seg, idx, arr) => (
            <span key={idx} className="flex items-center gap-1.5">
              <span className={idx === arr.length - 1 ? "text-[#00E5A0]" : "text-zinc-500"}>
                {seg}
              </span>
              {idx < arr.length - 1 && <span className="text-zinc-700">›</span>}
            </span>
          ))}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col bg-[#0c0c0e] ring-1 ring-white/10 rounded-md overflow-hidden shadow-lg">
        <ZoomButton onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} label="+" />
        <div className="h-px bg-white/5" />
        <ZoomButton onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} label="−" />
        <div className="h-px bg-white/5" />
        <ZoomButton onClick={() => setZoom(1)} label="⊡" />
      </div>

      {/* Stage label */}
      <div className="absolute top-3 left-4 z-10 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        Architecture_Graph · {activeNodes.length} nodes · {activeEdges.length} edges
      </div>
    </div>
  );
}

function ZoomButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-8 grid place-items-center font-mono text-xs text-zinc-400 hover:text-brand-heading hover:bg-white/5 transition-colors"
    >
      {label}
    </button>
  );
}

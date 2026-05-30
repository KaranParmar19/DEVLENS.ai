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

  // Use real backend progress percentage
  const progressPct = analysisState.progressPct;

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
          drawNodes={true}
          showFlash={false}
          sessionId={analysisState.sessionId ?? undefined}
          graphData={analysisState.graphData ?? undefined}
          fileTree={analysisState.filesData?.tree}
          entryPoints={analysisState.filesData?.entry_points}
          chat={chat}
        />
      </div>

      {/* ===== Phase 3 — Processing overlay ===== */}
      {!processingDone && (
        <div
          className="absolute inset-0 grid place-items-center z-50"
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
            repoMeta={analysisState.repoMeta}
            jobId={analysisState.jobId}
          />
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Processing Modal ----------------------------- */

function ProcessingModal({
  repoUrl,
  activeStep,
  progressPct,
  appear,
  repoMeta,
  jobId,
}: {
  repoUrl: string;
  activeStep: number;
  progressPct: number;
  appear: boolean;
  repoMeta: {
    stars: number;
    files: number;
    languages: Record<string, number>;
    sizeKb: number;
  } | null;
  jobId: string | null;
}) {
  const [logs, setLogs] = useState<{ time: string; msg: React.ReactNode }[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const loggedSteps = useRef(new Set<string>());
  const repoLabel = repoUrl?.replace(/^https?:\/\/(www\.)?github\.com\//, "") || "facebook/react";

  // Fix log duplication using a ref to track what has been pushed
  useEffect(() => {
    const pushLog = (key: string, msg: string) => {
      if (loggedSteps.current.has(key)) return;
      loggedSteps.current.add(key);
      setLogs(prev => [...prev, {
        time: new Date().toLocaleTimeString([], { hour12: false }),
        msg
      }].slice(-30));
    };

    pushLog(`phase-${activeStep}`, `[Phase ${activeStep + 1}] ${STEPS[Math.min(activeStep, STEPS.length - 1)]}...`);

    if (activeStep === 0 && jobId) {
      pushLog('connected', `Successfully connected to worker node ${jobId.substring(0, 8)}.`);
    }

    if (activeStep >= 1 && repoMeta) {
      pushLog('files', `Detected ${repoMeta.files.toLocaleString()} files. Total size: ${(repoMeta.sizeKb / 1024).toFixed(2)} MB.`);
    }

    if (activeStep >= 2 && repoMeta?.languages) {
      const langs = Object.keys(repoMeta.languages).slice(0, 3).join(", ");
      if (langs) {
        pushLog('langs', `Identified primary languages: ${langs}.`);
      }
    }

    if (progressPct === 100) {
       pushLog('complete', `Analysis complete. Rendering visualization...`);
    }
  }, [activeStep, repoLabel, jobId, repoMeta, progressPct]);

  // Smooth real-time size counter
  const [displaySizeMb, setDisplaySizeMb] = useState(0);
  useEffect(() => {
    if (!repoMeta?.sizeKb) return;
    const targetMb = (repoMeta.sizeKb / 1024) * (Math.max(2, progressPct) / 100);
    
    let active = true;
    const animate = () => {
      setDisplaySizeMb(prev => {
        const diff = targetMb - prev;
        if (Math.abs(diff) < 0.01) return targetMb;
        return prev + diff * 0.1;
      });
      if (active) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    return () => { active = false; };
  }, [progressPct, repoMeta]);

  // Tech stack cycling
  const langsList = useMemo(() => {
    if (!repoMeta?.languages) return ["Detecting..."];
    const keys = Object.keys(repoMeta.languages);
    return keys.length > 0 ? keys : ["Unknown"];
  }, [repoMeta]);

  const [activeLangIdx, setActiveLangIdx] = useState(0);
  useEffect(() => {
    if (langsList.length <= 1) return;
    const int = setInterval(() => {
      setActiveLangIdx(prev => (prev + 1) % langsList.length);
    }, 1800);
    return () => clearInterval(int);
  }, [langsList]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const SHORT_STEPS = [
    "Discovery",
    "AST Parsing",
    "Graph Build",
    "Architecture",
    "Semantic Map",
  ];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <style>{`
        .glass-panel {
          background: rgba(26, 26, 26, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid #333333;
        }
        .progress-segment {
          height: 4px;
          background: #1a1a1a;
          position: relative;
          overflow: hidden;
        }
        .scanning-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #ffffff, transparent);
          animation: dl-scan-line-2 3s linear infinite;
          opacity: 0.2;
          pointer-events: none;
          z-index: 50;
        }
        @keyframes dl-scan-line-2 {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }
        .status-pulse {
          animation: dl-status-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes dl-status-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
        .log-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .log-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .log-scroll::-webkit-scrollbar-thumb {
          background: #333333;
          border-radius: 2px;
        }
      `}</style>

      <div className="scanning-line"></div>
      
      <main 
        className="w-full max-w-[900px] flex flex-col gap-6"
        style={{
          transform: appear ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)",
          opacity: appear ? 1 : 0,
          transition: "opacity 500ms ease, transform 500ms ease",
          willChange: "opacity, transform",
        }}
      >
        {/* Header Branding */}
        <div className="flex justify-between items-end px-1">
          <div className="flex flex-col">
            <span className="font-mono text-xs font-medium tracking-widest text-zinc-400 uppercase">System Status</span>
            <h1 className="font-sans text-3xl font-semibold text-white tracking-tighter">DEVLENS AI</h1>
          </div>
          <div className="font-mono text-sm font-medium text-zinc-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white status-pulse"></span>
            ACTIVE SESSION
          </div>
        </div>

        {/* Central Analysis Card */}
        <div className="glass-panel rounded-xl overflow-hidden shadow-2xl relative">
          <div className="p-6 md:p-10 flex flex-col gap-10">
            {/* Progress Header */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <h2 className="font-sans text-2xl font-semibold text-white">Analyzing Repository</h2>
                <div className="font-mono text-sm font-medium text-white tracking-wide">{progressPct}% COMPLETE</div>
              </div>
              <p className="font-sans text-base text-zinc-400">
                Deconstructing <span className="text-white font-medium">{repoLabel}</span> architecture...
              </p>
            </div>

            {/* Progress Visual */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-xs font-medium text-zinc-400 uppercase tracking-widest">
                <span>Phase {Math.min(activeStep + 1, STEPS.length)}: {STEPS[Math.min(activeStep, STEPS.length - 1)]}</span>
                <span className="font-medium text-white">Mapping Object Relations</span>
              </div>
              <div className="progress-segment rounded-full">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>
            </div>

            {/* Phase Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {STEPS.map((label, i) => {
                const isDone = i < activeStep;
                const isActive = i === activeStep;
                const isPending = i > activeStep;
                
                return (
                  <div key={label} className={`flex items-center gap-2 p-3 border rounded relative overflow-hidden ${
                    isActive ? "border-white/50 bg-white/5" :
                    isDone ? "border-white/10 bg-[#0e0e0e]" :
                    "border-white/5 bg-[#0e0e0e]/50 opacity-40"
                  }`}>
                    {isActive && <div className="absolute inset-0 bg-white/5 status-pulse" />}
                    
                    <span className={`material-symbols-outlined text-[20px] relative z-10 ${
                      isPending ? "text-zinc-500" : "text-white"
                    }`} style={{ fontVariationSettings: isDone ? "'FILL' 1" : undefined }}>
                      {isDone ? "check_circle" : isActive ? "sync" : "pending"}
                    </span>
                    
                    <div className="flex flex-col relative z-10">
                      <span className={`font-mono text-[10px] font-medium tracking-widest ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                        STEP {i + 1}
                      </span>
                      <span className={`font-sans text-sm ${isActive ? 'text-white font-bold' : isPending ? 'text-zinc-500' : 'text-white'}`}>
                        {SHORT_STEPS[i]}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* System Log & Technical Metrics Split */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white/10 pt-6">
              {/* Log */}
              <div className="md:col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium tracking-widest text-zinc-400 uppercase">System Log</span>
                  <span className="font-mono text-xs font-medium tracking-widest text-zinc-500">Streaming...</span>
                </div>
                <div ref={logContainerRef} className="log-scroll h-40 overflow-y-auto font-mono text-xs flex flex-col gap-1 pr-2">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4 animate-in fade-in duration-500">
                      <span className="text-zinc-600 shrink-0">{log.time}</span>
                      <span className="text-zinc-200">{log.msg}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metrics */}
              <div className="flex flex-col gap-4 bg-[#1c1b1b] p-4 rounded border border-white/10">
                <span className="font-mono text-xs font-medium tracking-widest text-zinc-400 uppercase">Technical Metrics</span>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-sm text-zinc-400">Files Processed</span>
                    <span className="font-mono text-xs font-medium text-white">
                      {repoMeta ? Math.floor((progressPct / 100) * repoMeta.files).toLocaleString() : "..."} / {repoMeta ? repoMeta.files.toLocaleString() : "..."}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full">
                    <div className="bg-zinc-400 h-full rounded-full transition-all" style={{ width: `${Math.max(10, progressPct)}%` }}></div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="font-sans text-sm text-zinc-400">Repository Size</span>
                  <span className="font-mono text-xs font-medium text-white">
                    {repoMeta ? `${displaySizeMb.toFixed(2)} MB` : "..."}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="font-sans text-sm text-zinc-400">Tech Stack</span>
                  <div className="relative h-4 overflow-hidden w-32">
                    {langsList.map((lang, idx) => (
                      <span 
                        key={lang}
                        className={`absolute right-0 font-mono text-xs font-medium transition-all duration-500 ${
                          idx === activeLangIdx 
                            ? "opacity-100 translate-y-0 text-emerald-400" 
                            : "opacity-0 translate-y-4 text-zinc-500"
                        }`}
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="font-sans text-sm text-zinc-400">Complexity Index</span>
                  <span className="font-mono text-[10px] tracking-widest px-1.5 py-0.5 bg-white text-black rounded-sm font-bold">
                    {repoMeta ? (repoMeta.files > 50 ? "HIGH" : repoMeta.files > 15 ? "MEDIUM" : "LOW") : "..."}
                  </span>
                </div>
                
                <div className="mt-auto pt-4 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-white text-[16px]">terminal</span>
                    <span className="font-mono text-xs font-medium text-zinc-400">Worker node: {jobId ? jobId.substring(0, 8) : "Pending..."}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Visual Hint */}
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-10 opacity-30">
            <div className="w-24 h-px bg-gradient-to-r from-transparent to-white"></div>
            <span className="font-mono text-xs font-medium text-zinc-200 tracking-[0.3em] uppercase">Processing Core v4.1.0</span>
            <div className="w-24 h-px bg-gradient-to-l from-transparent to-white"></div>
          </div>
        </div>
      </main>
    </>
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
  sessionId,
  graphData,
  fileTree,
  modules,
  entryPoints,
  chat,
}: {
  repoUrl: string;
  onClose: () => void;
  drawNodes: boolean;
  showFlash: boolean;
  sessionId?: string;
  graphData?: { nodes: Node[]; edges: [string, string][]; meta?: Record<string, unknown> };
  fileTree?: FileNode[];
  modules?: Array<{ name: string; file_count: number; files: string[] }>;
  entryPoints?: string[];
  chat: ReturnType<typeof useChat>;
}) {
  const repoLabel = repoUrl?.replace(/^https?:\/\/(www\.)?github\.com\//, "") || "facebook/react";
  const [leftTab, setLeftTab] = useState<LeftTab>("FILES");
  const [centerTab, setCenterTab] = useState<CenterTab>("ARCHITECTURE");
  const [activeFile, setActiveFile] = useState("src/components/Button.tsx");
  const [fileFilter, setFileFilter] = useState("");

  // Auto-select first real file when tree is loaded
  useEffect(() => {
    if (fileTree && fileTree.length > 0) {
      const firstRealFile = fileTree.find(f => !f.is_dir);
      if (firstRealFile) {
        setActiveFile(firstRealFile.path);
      }
    }
  }, [fileTree]);

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
              className={`flex-1 py-2 font-mono text-[9px] uppercase tracking-widest transition-colors relative ${leftTab === t
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
          {leftTab === "MODULES" && <ModulesList items={modules} />}
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
              className={`px-4 py-3 font-mono text-[10px] uppercase tracking-widest transition-colors relative ${centerTab === t
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
          {centerTab === "ONBOARDING DOC" && (
            sessionId ? (
              <OnboardingDoc sessionId={sessionId} repo={repoLabel} />
            ) : (
              <OnboardingDocPlaceholder repo={repoLabel} />
            )
          )}
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
            {["What does this repo do?", "Explain the auth flow", "What are the entry points?"].map((q) => (
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
              <div key={i} className={`text-xs leading-relaxed ${msg.role === "user" ? "text-brand-heading text-right" : "text-zinc-400"
                }`}>
                {msg.role === "assistant" && (
                  <span className="font-mono text-[9px] uppercase text-zinc-600 block mb-1">DevLens</span>
                )}
                <span className={`inline-block px-3 py-2 rounded-lg ${msg.role === "user" ? "bg-white/10" : "bg-zinc-900 ring-1 ring-white/5"
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
      className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded transition-colors ${primary
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
            className={`w-full text-left flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${f.path === active ? "bg-white/10 text-brand-heading ring-1 ring-white/10" : "text-zinc-500 hover:text-brand-heading hover:bg-white/5"
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
            className={`w-full text-left flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors ${isActive ? "bg-white/10 text-brand-heading ring-1 ring-white/10" : "text-zinc-500 hover:text-brand-heading hover:bg-white/5"
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

function ModulesList({ items }: { items?: Array<{ name: string; file_count: number }> }) {
  const mods = items && items.length > 0
    ? items.map(m => ({ n: m.name, c: m.file_count }))
    : [
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
  const LANES = [
    { id: "client", label: "Client", color: "#4A8FFF" },
    { id: "gateway", label: "APIGateway", color: "#00E5A0" },
    { id: "auth", label: "AuthService", color: "#FF6B6B" },
    { id: "db", label: "Database", color: "#A78BFA" },
  ];

  const STEPS = [
    { from: 0, to: 1, label: "POST /api/analyze", y: 80 },
    { from: 1, to: 2, label: "validateJWT(token)", y: 130 },
    { from: 2, to: 1, label: "✓ user: { id, plan }", y: 160, dashed: true },
    { from: 1, to: 3, label: "repos.findOrCreate(url)", y: 210 },
    { from: 3, to: 1, label: "✓ repo_id: 4821", y: 240, dashed: true },
    { from: 1, to: 0, label: "202 Accepted · job_id", y: 290, dashed: true },
    { from: 0, to: 1, label: "WS /analysis/{id}/status", y: 350 },
    { from: 1, to: 0, label: "{ step: 'cloning', pct: 12 }", y: 400, dashed: true },
    { from: 1, to: 0, label: "{ step: 'done', pct: 100 }", y: 450, dashed: true },
  ];

  const W = 600;
  const H = 520;
  const LANE_W = W / LANES.length;
  const CENTER = (i: number) => LANE_W * i + LANE_W / 2;

  return (
    <div className="absolute inset-0 overflow-auto bg-brand-bg">
      <div className="p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-4">
          Code_Flow · POST /api/repos/analyze · Execution Trace
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-3xl mx-auto"
          style={{ fontFamily: "'Geist Mono', monospace" }}
        >
          {/* Lane headers */}
          {LANES.map((lane, i) => (
            <g key={lane.id}>
              <rect x={CENTER(i) - 44} y={4} width={88} height={28} rx={4}
                fill="#111" stroke={lane.color} strokeWidth="0.8" />
              <text x={CENTER(i)} y={23} textAnchor="middle" fill={lane.color}
                fontSize={9} fontWeight={600}>
                {lane.label}
              </text>
              {/* Lifeline */}
              <line x1={CENTER(i)} y1={36} x2={CENTER(i)} y2={H - 20}
                stroke="#2A2A2A" strokeWidth={0.8} strokeDasharray="4 4" />
            </g>
          ))}

          {/* Arrows */}
          {STEPS.map((step, idx) => {
            const x1 = CENTER(step.from);
            const x2 = CENTER(step.to);
            const dir = x2 > x1 ? 1 : -1;
            const arrX = x2 - dir * 8;
            const midX = (x1 + x2) / 2;
            const color = step.dashed ? "#3A3A3A" : "#555";
            return (
              <g key={idx}>
                <line
                  x1={x1} y1={step.y} x2={arrX} y2={step.y}
                  stroke={color} strokeWidth={0.9}
                  strokeDasharray={step.dashed ? "4 3" : undefined}
                />
                <polygon
                  points={`${x2},${step.y} ${arrX - dir * 4},${step.y - 4} ${arrX - dir * 4},${step.y + 4}`}
                  fill={color}
                />
                {/* Label */}
                <text
                  x={midX} y={step.y - 5}
                  textAnchor="middle" fill={step.dashed ? "#3A3A3A" : "#555"}
                  fontSize={8}
                >
                  {step.label}
                </text>
                {/* Activation box */}
                <rect
                  x={x1 - 4} y={step.y - 2} width={8} height={16}
                  fill="#1C1C1C" stroke={LANES[step.from].color} strokeWidth={0.6}
                  opacity={0.7}
                />
              </g>
            );
          })}
        </svg>
        <p className="text-center font-mono text-[10px] text-zinc-700 mt-4">
          // Select a function in the graph to trace its execution path
        </p>
      </div>
    </div>
  );
}

function parseMarkdown(md: string) {
  if (!md) return null;
  const lines = md.split("\n");
  let inCode = false;
  const codeBlock: string[] = [];

  return lines
    .map((line, idx) => {
      if (line.startsWith("```")) {
        if (inCode) {
          inCode = false;
          const code = codeBlock.join("\n");
          codeBlock.length = 0;
          return (
            <pre
              key={idx}
              className="bg-zinc-950 border border-zinc-900 rounded-md p-4 font-mono text-xs text-zinc-300 my-4 overflow-x-auto"
            >
              <code>{code}</code>
            </pre>
          );
        } else {
          inCode = true;
          return null;
        }
      }

      if (inCode) {
        codeBlock.push(line);
        return null;
      }

      if (line.startsWith("# ")) {
        return (
          <h1 key={idx} className="text-2xl font-bold text-white mt-6 mb-4">
            {line.slice(2)}
          </h1>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={idx} className="text-xl font-bold text-[#00E5A0] mt-6 mb-3">
            {line.slice(3)}
          </h2>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-lg font-semibold text-zinc-200 mt-4 mb-2">
            {line.slice(4)}
          </h3>
        );
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={idx} className="ml-6 list-disc text-sm text-zinc-400 my-1">
            {line.slice(2)}
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-sm text-zinc-400 my-2 leading-relaxed">
          {line}
        </p>
      );
    })
    .filter(Boolean);
}

function OnboardingDoc({ sessionId, repo }: { sessionId: string; repo: string }) {
  const [doc, setDoc] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await api.getOnboardingDoc(sessionId);
        if (active) {
          setDoc(data.markdown);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load document.");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#070708]">
        <div className="text-center space-y-3">
          <span className="size-6 rounded-full border-2 border-zinc-800 border-t-[#00E5A0] animate-spin inline-block" />
          <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
            Generating Onboarding Doc...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#070708] text-center">
        <div className="font-mono text-xs text-zinc-500">
          Error loading onboarding doc. Using placeholder.
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-auto bg-[#070708]">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">
        <div className="border-b border-white/5 pb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Onboarding_Doc
          </div>
          <h3 className="text-xl font-medium text-white mt-1">Getting started with {repo}</h3>
          <p className="text-xs text-zinc-500 mt-1">Auto-generated by DevLens AI</p>
        </div>
        <div className="text-sm leading-relaxed text-zinc-300 font-sans">
          {parseMarkdown(doc)}
        </div>
      </div>
    </div>
  );
}

function OnboardingDocPlaceholder({ repo }: { repo: string }) {
  const sections = [
    {
      title: "Overview",
      content: `${repo} is a production-grade application with a modular architecture. The codebase follows domain-driven design principles with clear separation of concerns across Auth, API, Database, and UI layers.`,
    },
    {
      title: "Tech Stack",
      content: "TypeScript · React 18 · FastAPI · PostgreSQL · Redis · OpenAI GPT-4",
      isBadges: true,
    },
    {
      title: "Architecture",
      content: "Requests flow through APIGateway → AuthService (JWT validation) → domain controllers → PostgreSQL via connection pool. CacheLayer (Redis) sits in front of hot read paths.",
    },
    {
      title: "Key Modules",
      items: [
        { path: "src/services/api.gateway.ts", desc: "Central request router. All HTTP traffic enters here." },
        { path: "src/services/auth.service.ts", desc: "JWT issuance, validation, refresh token rotation." },
        { path: "src/controllers/user.controller.ts", desc: "User CRUD, profile management, plan enforcement." },
        { path: "src/db/index.ts", desc: "PostgreSQL connection pool, migration runner." },
        { path: "src/services/cache.layer.ts", desc: "Redis-backed read-through cache with TTL management." },
      ],
    },
    {
      title: "How to Contribute",
      content: "1. Fork the repo and create a feature branch.\n2. Run tests: npm test.\n3. Submit a PR with a description of changes.\n4. All PRs require review from a CODEOWNER.",
    },
    {
      title: "Common Patterns",
      content: "Dependency injection via constructor params. Services are singletons. Controllers are stateless. All database access through the repository pattern.",
    },
    {
      title: "⚠️ Gotchas",
      content: "Never import from src/db directly in controllers — use repositories. AuthService caches tokens in Redis with a 15-min TTL; invalidation requires explicit cache.del(). The EventBus is not persistent — missed events are dropped.",
      isWarning: true,
    },
  ];

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Onboarding_Doc</div>
            <h3 className="text-xl font-medium text-white mt-1">Getting started with {repo}</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Auto-generated by DevLens AI · GPT-4 · Based on full codebase analysis
            </p>
          </div>
          <div className="flex gap-2">
            {["Markdown", "Notion", "PDF"].map((fmt) => (
              <button key={fmt} type="button"
                className="font-mono text-[10px] px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-colors">
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        {sections.map((sec) => (
          <div key={sec.title} className="border-l-2 pl-4"
            style={{ borderColor: sec.isWarning ? "#FF4444" : "#2A2A2A" }}>
            <h4 className="font-mono text-[11px] uppercase tracking-widest mb-3"
              style={{ color: sec.isWarning ? "#FF4444" : "#00E5A0" }}>
              {sec.title}
            </h4>

            {sec.isBadges && (
              <div className="flex flex-wrap gap-2">
                {(sec.content as string).split(" · ").map((b) => (
                  <span key={b}
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                    {b}
                  </span>
                ))}
              </div>
            )}

            {!sec.isBadges && sec.content && (
              <p className="text-sm leading-relaxed"
                style={{ color: sec.isWarning ? "#FF6666" : "#666", whiteSpace: "pre-line" }}>
                {sec.content}
              </p>
            )}

            {sec.items && (
              <div className="space-y-2">
                {sec.items.map((item) => (
                  <div key={item.path}>
                    <span className="font-mono text-[11px] text-[#00E5A0]">{item.path}</span>
                    <p className="text-xs text-zinc-600 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="pt-4 border-t border-zinc-900 font-mono text-[10px] text-zinc-700">
          // Generated {new Date().toLocaleDateString()} · DevLens AI v2 · GPT-4o · Full codebase indexed
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

const NODE_PX = 32; // visual circle size
const RADIUS = NODE_PX / 2;

function ArchitectureGraph({ draw, graphData }: { draw: boolean; graphData?: { nodes: Node[]; edges: [string, string][] } }) {
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Use real API nodes/edges if available, else fall back to static demo
  const activeNodes = (graphData?.nodes?.length ? graphData.nodes : NODES) as Node[];
  const activeEdges = (graphData?.edges?.length ? graphData.edges : EDGES) as [string, string][];
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

  const spread = activeNodes.length > 40 ? 3 : activeNodes.length > 15 ? 2 : 1;
  const canvasSize = spread * 100;
  const offset = -((spread - 1) * 50);
  const initialScale = 1 / spread;

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
        className="absolute"
        style={{
          width: `${canvasSize}%`,
          height: `${canvasSize}%`,
          left: `${offset}%`,
          top: `${offset}%`,
          transform: `scale(${zoom * initialScale})`,
          transformOrigin: "center center",
          transition: `transform 200ms ${ease}`,
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            <marker
              id="arrow-default"
              markerUnits="userSpaceOnUse"
              viewBox="0 0 10 10"
              refX={RADIUS + 10}
              refY="5"
              markerWidth="10"
              markerHeight="10"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(255,255,255,0.35)" />
            </marker>
            <marker
              id="arrow-active"
              markerUnits="userSpaceOnUse"
              viewBox="0 0 10 10"
              refX={RADIUS + 10}
              refY="5"
              markerWidth="10"
              markerHeight="10"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#00E5A0" />
            </marker>
            <marker
              id="arrow-dim"
              markerUnits="userSpaceOnUse"
              viewBox="0 0 10 10"
              refX={RADIUS + 10}
              refY="5"
              markerWidth="10"
              markerHeight="10"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(255,255,255,0.08)" />
            </marker>
          </defs>
          {activeEdges.map(([a, b], i) => {
            const na = activeNodes.find((n) => n.id === a);
            const nb = activeNodes.find((n) => n.id === b);
            if (!na || !nb) return null;

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
                x1={`${na.x}%`}
                y1={`${na.y}%`}
                x2={`${nb.x}%`}
                y2={`${nb.y}%`}
                stroke={stroke}
                strokeWidth={isActive ? 1.5 : 1}
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={draw ? 0 : 100}
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
                className={`grid place-items-center font-mono text-[10px] font-medium uppercase tracking-tight rounded-full ring-1 transition-all ${isSelected
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
                className={`font-mono text-[10px] uppercase tracking-widest whitespace-nowrap ${isSelected ? "text-[#00E5A0]" : "text-zinc-400"
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

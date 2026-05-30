import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useChat } from "@/hooks/useChat";
import type { FileNode } from "@/lib/api";
import { repoHistory } from "@/lib/repo-history";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";

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
  onOpenPalette,
}: {
  open: boolean;
  repoUrl: string;
  onClose: () => void;
  onOpenPalette?: () => void;
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
  const [overlayUnmounted, setOverlayUnmounted] = useState(false);
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
      setOverlayUnmounted(false);
      // Kick off real backend analysis
      if (repoUrl) {
        startAnalysis(repoUrl);
        // Persist to repo history immediately so hub shows it
        const label = repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace('.git', '');
        repoHistory.upsert({
          id: `pending-${Date.now()}`,
          repoUrl,
          repoLabel: label,
          analyzedAt: new Date().toISOString(),
          status: 'indexing',
        });
      }
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
    if (analysisState.isComplete && analysisState.sessionId) {
      setActiveStep(STEPS.length);
      const t = setTimeout(() => setProcessingDone(true), 400);
      // Persist completed analysis to history
      const label = repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace('.git', '');
      repoHistory.upsert({
        id: analysisState.sessionId,
        repoUrl,
        repoLabel: label,
        analyzedAt: new Date().toISOString(),
        status: 'complete',
        meta: analysisState.repoMeta ? {
          stars: analysisState.repoMeta.stars,
          files: analysisState.repoMeta.files,
          sizeKb: analysisState.repoMeta.sizeKb,
          languages: analysisState.repoMeta.languages,
        } : undefined,
      });
      return () => clearTimeout(t);
    }
    if (analysisState.error) {
      if (analysisState.sessionId) {
        repoHistory.markFailed(analysisState.sessionId);
      }
      // Dissolve the processing overlay on error
      setProcessingDone(true);
    }
  }, [currentStepIndex, analysisState.isComplete, analysisState.error, analysisState.sessionId, repoUrl, isRunning, shown, activeStep, processingDone]);

  // After overlay dissolves → flash + draw nodes
  useEffect(() => {
    if (!processingDone) return;
    
    // If there's an error, just unmount the overlay without the success flash
    if (analysisState.error) {
      const tUnmount = setTimeout(() => setOverlayUnmounted(true), OVERLAY_FADE_OUT);
      return () => clearTimeout(tUnmount);
    }

    const tFlash = setTimeout(() => setShowFlash(true), OVERLAY_FADE_OUT);
    const tFlashOff = setTimeout(
      () => setShowFlash(false),
      OVERLAY_FADE_OUT + FLASH_DURATION,
    );
    const tDraw = setTimeout(() => setDrawNodes(true), OVERLAY_FADE_OUT + 100);
    const tUnmount = setTimeout(() => setOverlayUnmounted(true), OVERLAY_FADE_OUT);
    return () => {
      clearTimeout(tFlash);
      clearTimeout(tFlashOff);
      clearTimeout(tDraw);
      clearTimeout(tUnmount);
    };
  }, [processingDone, analysisState.error]);

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
          onOpenPalette={onOpenPalette}
          drawNodes={drawNodes}
          showFlash={showFlash}
          sessionId={analysisState.sessionId ?? undefined}
          graphData={analysisState.graphData ?? undefined}
          fileTree={analysisState.filesData?.tree}
          entryPoints={analysisState.filesData?.entry_points}
          modules={analysisState.filesData?.modules}
          chat={chat}
          analysisError={analysisState.error ?? undefined}
        />
      </div>

      {/* ===== Phase 3 — Processing overlay ===== */}
      {!overlayUnmounted && (
        <div
          className="absolute inset-0 grid place-items-center z-50"
          style={{
            backgroundColor: "#000000",
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
  const [latency, setLatency] = useState(12);
  const [videoScene, setVideoScene] = useState<1 | 2>(1);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [displayFiles, setDisplayFiles] = useState(0);
  const [displaySize, setDisplaySize] = useState(0);
  const [techStackIndex, setTechStackIndex] = useState(0);
  const [scrollingStack, setScrollingStack] = useState<{id: number, lang: string}[]>([]);
  const stackCounter = useRef(0);
  const [readmeLangs, setReadmeLangs] = useState<string[]>([]);

  // Attempt to fetch README to parse real tech stack dependencies dynamically
  useEffect(() => {
    if (!repoUrl) return;
    const match = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (!match) return;
    const ownerRepo = match[1].replace('.git', '');
    
    const fetchReadme = async () => {
      try {
        let res = await fetch(`https://raw.githubusercontent.com/${ownerRepo}/main/README.md`);
        if (!res.ok) res = await fetch(`https://raw.githubusercontent.com/${ownerRepo}/master/README.md`);
        if (!res.ok) return;
        
        const text = await res.text();
        const keywords = [
          "React", "Vue", "Angular", "Next.js", "Nuxt", "Node.js", "Express", "MongoDB", 
          "PostgreSQL", "MySQL", "Redis", "Docker", "AWS", "Firebase", "Supabase", 
          "TailwindCSS", "Prisma", "GraphQL", "FastAPI", "Django", "Flask", 
          "Spring Boot", "Laravel", "Kubernetes", "TensorFlow", "PyTorch", "Celery",
          "RabbitMQ", "Kafka", "Elasticsearch", "Vite", "Webpack", "Redux", "Zustand", "Axios"
        ];
        
        const found = keywords.filter(kw => {
          const regex = new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'i');
          return regex.test(text);
        });
        
        if (found.length > 0) {
          setReadmeLangs(found);
        }
      } catch (err) {
        console.error("Failed to parse README for tech stack", err);
      }
    };
    fetchReadme();
  }, [repoUrl]);

  useEffect(() => {
    if (!repoMeta) return;
    const maxFiles = repoMeta.files || 0;
    const maxSize = repoMeta.sizeKb || Math.floor(maxFiles * 18.5) || 12400; // fallback if sizeKb is 0
    setDisplayFiles(Math.floor(maxFiles * (progressPct / 100)));
    setDisplaySize(Math.floor(maxSize * (progressPct / 100)));
  }, [progressPct, repoMeta]);

  useEffect(() => {
    if (!repoMeta?.languages) return;
    const baseLangs = Object.keys(repoMeta.languages);
    const langs = [...new Set([...baseLangs, ...readmeLangs])];
    if (langs.length === 0) return;
    
    // Initialize scrolling stack immediately if empty
    if (stackCounter.current === 0) {
      setScrollingStack([{ id: Date.now(), lang: langs[0] }]);
      stackCounter.current = 1;
    }

    const int = setInterval(() => {
      setTechStackIndex(prev => (prev + 1) % langs.length);
      setScrollingStack(prev => {
        const nextLang = langs[stackCounter.current % langs.length];
        stackCounter.current++;
        return [{ id: Date.now(), lang: nextLang }, ...prev].slice(0, 10);
      });
    }, 900);
    return () => clearInterval(int);
  }, [repoMeta, readmeLangs]);

  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: any[] = [];
    let animationFrameId: number;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    class Particle {
      x!: number; y!: number; vx!: number; vy!: number; size!: number; alpha!: number;
      constructor() { this.reset(); }
      reset() {
        if (!canvas) return;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2;
        this.alpha = Math.random() * 0.5;
      }
      update() {
        if (!canvas) return;
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
          this.reset();
        }
      }
      draw() {
        if (!ctx) return;
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    window.addEventListener('resize', resize);
    resize();

    for (let i = 0; i < 40; i++) {
      particles.push(new Particle());
    }

    function animate() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (videoScene === 2 && video2Ref.current) {
      video2Ref.current.currentTime = 0;
      video2Ref.current.play().catch(() => {});
    } else if (videoScene === 1 && video1Ref.current) {
      video1Ref.current.currentTime = 0;
      video1Ref.current.play().catch(() => {});
    }
  }, [videoScene]);

  // Dynamic latency for effect
  useEffect(() => {
    const int = setInterval(() => {
      if (Math.random() > 0.6) {
        setLatency(Math.floor(Math.random() * 5 + 8));
      }
    }, 400);
    return () => clearInterval(int);
  }, []);

  // Logs logic
  useEffect(() => {
    const pushLog = (key: string, msg: string) => {
      if (loggedSteps.current.has(key)) return;
      loggedSteps.current.add(key);
      setLogs(prev => [...prev, {
        time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        msg
      }].slice(-12));
    };

    const STEPS = ["Cloning repository", "Parsing file tree", "Building dependency graph", "Generating architecture map", "Indexing for Q&A"];
    
    if (activeStep < STEPS.length) {
      pushLog(`phase-${activeStep}`, `[${progressPct}%] ${STEPS[activeStep]}...`);
    }

    if (activeStep === 0 && jobId) {
      pushLog('connected', `Authenticating kernel signatures... node ${jobId.substring(0, 8)}`);
    }
    if (activeStep >= 1 && repoMeta) {
      pushLog('files', `Indexing function signatures... ${repoMeta.files.toLocaleString()} files found.`);
    }
    if (activeStep >= 2 && repoMeta?.languages) {
      const langs = Object.keys(repoMeta.languages).slice(0, 3).join(", ");
      if (langs) {
        pushLog('langs', `Resolving dependency subgraph nodes... [${langs}]`);
      }
    }
    if (progressPct === 100) {
      pushLog('complete', `Synchronizing local state with cloud...`);
    }
  }, [activeStep, jobId, repoMeta, progressPct]);

  // Ensure scroll is at bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const displayNodes = repoMeta?.files ? repoMeta.files.toLocaleString() : "...";
  const displayLatency = `${latency}ms`; 
  const displayIntegrity = "99.98%";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <style>{`
        .bg-video {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 0;
            pointer-events: none;
            transition: opacity 1.5s ease-in-out;
        }
        .data-stream::after {
            content: "";
            animation: cursor 0.8s infinite;
        }
        @keyframes cursor {
            50% { border-right: 2px solid white; }
        }
      `}</style>
      
      <video 
        ref={video1Ref}
        className="bg-video" 
        style={{ opacity: videoScene === 1 ? 0.5 : 0 }} 
        src="/video/scene1.mp4" 
        autoPlay 
        muted 
        playsInline 
        onEnded={() => setVideoScene(2)}
      />
      <video 
        ref={video2Ref}
        className="bg-video" 
        style={{ opacity: videoScene === 2 ? 0.5 : 0 }} 
        src="/video/scene2.mp4" 
        muted 
        playsInline 
        onEnded={() => setVideoScene(1)}
      />

      <canvas ref={particleCanvasRef} className="fixed inset-0 pointer-events-none z-10" />
      
      {/* Top and Bottom shadow vignettes to blend edges and hide watermark */}
      <div className="fixed top-0 left-0 right-0 h-48 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none"></div>

      <main 
        className="relative w-full h-screen flex flex-col items-center justify-center z-20"
        style={{
          opacity: appear ? 1 : 0,
          transition: "opacity 500ms ease",
        }}
      >
        <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
          {/* Top Bar */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1 p-2 drop-shadow-md">
              <h1 className="font-['Inter'] text-[32px] leading-[40px] tracking-[-0.01em] font-semibold text-white uppercase">DEVLENS AI</h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]"></span>
                <p className="font-['JetBrains_Mono'] text-[12px] leading-[14px] tracking-[0.05em] font-medium text-[#8e9192] uppercase">INITIALIZING ARCHITECTURAL ENGINE</p>
              </div>
            </div>
            <div className="text-right flex flex-col gap-1 p-2 drop-shadow-md min-w-[200px]">
              <p className="font-['JetBrains_Mono'] text-[12px] leading-[14px] tracking-[0.05em] font-medium text-white">BUILD_VER: 2.4.0-STABLE</p>
              <p className="font-['JetBrains_Mono'] text-[12px] leading-[14px] tracking-[0.05em] font-medium text-[#8e9192]">LOC: 0.0.0.0 // ROOT_ACCESS</p>
              <div className="flex justify-between items-center w-full gap-4 mt-1 border-b border-white/10 pb-2">
                <span className="font-['Inter'] text-[12px] font-medium text-[#8e9192]">Memory Usage</span>
                <span className="font-['JetBrains_Mono'] text-[14px] font-bold text-white">{(4.26 * (progressPct / 100)).toFixed(2)}GB</span>
              </div>
              <p className="font-['JetBrains_Mono'] text-[12px] leading-[14px] tracking-[0.05em] font-medium text-[#8e9192] mt-4 border-b border-white/5 pb-2">
                VOL: <span className="text-white font-bold">{displaySize.toLocaleString()} KB</span> // NODES: <span className="text-white font-bold">{displayFiles.toLocaleString()}</span>
              </p>
              {repoMeta?.languages && Object.keys(repoMeta.languages).length > 0 && (
                <div className="flex flex-col items-end mt-4">
                  <span className="font-['JetBrains_Mono'] text-[14px] font-bold tracking-[0.08em] text-white mb-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">DETECTED_STACK</span>
                  <div 
                    className="flex flex-col items-end gap-1.5 h-[150px] overflow-hidden w-full relative" 
                    style={{ maskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)' }}
                  >
                    {scrollingStack.map((item) => (
                      <div key={item.id} className="animate-in slide-in-from-top-2 fade-in duration-500 font-['JetBrains_Mono'] text-[13px] font-semibold text-white whitespace-nowrap drop-shadow-md">
                        {item.lang}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Data Readout */}
          <div className="flex justify-between items-end">
            <div className="max-w-md w-full flex flex-col p-2 drop-shadow-md">
              <p className="font-['JetBrains_Mono'] text-[12px] leading-[14px] tracking-[0.05em] font-medium text-[#8e9192] mb-1">SYSTEM_TELEMETRY</p>
              <div className="font-['JetBrains_Mono'] text-[12px] leading-[14px] tracking-[0.05em] font-medium text-white opacity-80 flex flex-col justify-end gap-1 h-[200px] overflow-hidden" ref={logContainerRef}>
                {logs.map((log, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="text-white/40 mr-2">{log.time}</span> {log.msg}
                  </div>
                ))}
                {logs.length > 0 && <div className="data-stream mt-1 text-[#8e9192] opacity-50">&gt; SYNCING_AST_MODELS_04</div>}
              </div>
            </div>
            <div className="flex flex-col items-end p-2 drop-shadow-md">
              <div className="flex gap-2 mb-6">
                {["Discovery", "AST Parsing", "Semantic Map", "Graph Logic"].map((step, idx) => {
                  const isComplete = activeStep > idx;
                  const isActive = activeStep === idx;
                  return (
                    <div key={idx} className={`flex flex-col p-2 bg-transparent border ${isActive ? 'border-white/40' : 'border-white/5'} rounded min-w-[120px] transition-colors duration-300`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`material-symbols-outlined text-[14px] ${isComplete ? 'text-white' : isActive ? 'text-white animate-spin' : 'text-[#444]'} `}>
                          {isComplete ? 'check_circle' : isActive ? 'sync' : 'pending'}
                        </span>
                        <span className={`font-['JetBrains_Mono'] text-[10px] ${isActive || isComplete ? 'text-white' : 'text-[#666]'}`}>STEP {idx + 1}</span>
                      </div>
                      <span className={`font-['Inter'] text-[12px] font-medium ${isActive || isComplete ? 'text-white' : 'text-[#666]'}`}>{step}</span>
                    </div>
                  );
                })}
              </div>
              <span className="font-['JetBrains_Mono'] text-[14px] leading-[16px] tracking-[0.05em] font-medium text-white mb-2">{progressPct.toFixed(2)}% COMPLETE</span>
              <div className="w-48 h-1 bg-[#2a2a2a] relative overflow-hidden rounded-full">
                <div className="absolute inset-y-0 left-0 bg-white transition-all duration-300 ease-out rounded-full" style={{ width: `${progressPct}%` }}></div>
                <div className="absolute inset-y-0 bg-white blur-[2px] w-8 transition-all duration-300 ease-out animate-[pulse_2s_infinite]" style={{ left: `calc(${progressPct}% - 32px)` }}></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/* -------------------------------- Dashboard -------------------------------- */

type LeftTab = "FILES" | "MODULES" | "ENTRY POINTS";
type CenterTab = "ARCHITECTURE" | "CODE FLOW" | "ONBOARDING DOC";

const BRANCHES = ["main", "dev", "staging", "feature/auth", "hotfix/patch"];

function exportGraphAsJSON(graphData?: { nodes: any[]; edges: [string, string][] }) {
  const data = graphData ?? { nodes: [], edges: [] };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'devlens-graph.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportGraphAsMermaid(graphData?: { nodes: any[]; edges: [string, string][] }, sessionId?: string) {
  if (!graphData) return;
  const lines = ['graph TD'];
  graphData.edges.forEach(([a, b]) => {
    const na = graphData.nodes.find((n: any) => n.id === a);
    const nb = graphData.nodes.find((n: any) => n.id === b);
    if (na && nb) lines.push(`  ${a}["${na.label}"] --> ${b}["${nb.label}"]`);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'devlens-graph.mmd';
  a.click();
  URL.revokeObjectURL(a.href);
}

function DashboardShell({
  repoUrl,
  onClose,
  onOpenPalette,
  drawNodes,
  showFlash,
  sessionId,
  graphData,
  fileTree,
  modules,
  entryPoints,
  chat,
  analysisError,
}: {
  repoUrl: string;
  onClose: () => void;
  onOpenPalette?: () => void;
  drawNodes: boolean;
  showFlash: boolean;
  sessionId?: string;
  graphData?: { nodes: Node[]; edges: [string, string][]; meta?: Record<string, unknown> };
  fileTree?: FileNode[];
  modules?: Array<{ name: string; file_count: number; files: string[] }>;
  entryPoints?: string[];
  chat: ReturnType<typeof useChat>;
  analysisError?: string;
}) {
  const repoLabel = repoUrl?.replace(/^https?:\/\/(www\.)?github\.com\//, "") || "facebook/react";
  const [leftTab, setLeftTab] = useState<LeftTab>("FILES");
  const [centerTab, setCenterTab] = useState<CenterTab>("ARCHITECTURE");
  const [activeFile, setActiveFile] = useState("src/components/Button.tsx");
  const [fileFilter, setFileFilter] = useState("");
  const [branch, setBranch] = useState("main");
  const [branchOpen, setBranchOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [langFilter, setLangFilter] = useState<string | null>(null);

  // Derive languages from graph meta or graphData nodes
  const availableLangs = useMemo(() => {
    if (graphData?.meta && typeof graphData.meta.languages === 'object') {
      return Object.keys(graphData.meta.languages as Record<string, number>);
    }
    const langs = new Set<string>();
    graphData?.nodes?.forEach((n: any) => { if (n.language) langs.add(n.language); });
    return Array.from(langs);
  }, [graphData]);

  // Auto-select first real file when tree is loaded
  useEffect(() => {
    if (fileTree && fileTree.length > 0) {
      const firstRealFile = fileTree.find(f => !f.is_dir);
      if (firstRealFile) setActiveFile(firstRealFile.path);
    }
  }, [fileTree]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/dashboard?repo=${encodeURIComponent(repoUrl)}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {
      prompt('Copy this link:', url);
    });
  }, [repoUrl]);

  // File paths for command palette
  const filePaths = useMemo(() => {
    return (fileTree ?? []).filter(f => !f.is_dir).map(f => f.path);
  }, [fileTree]);

  const palette = useCommandPalette();
  const paletteActions = useMemo(() => [
    { id: 'arch', label: 'Architecture Graph', icon: '🔷', group: 'Views', shortcut: '1', onSelect: () => setCenterTab('ARCHITECTURE') },
    { id: 'flow', label: 'Code Flow', icon: '🌊', group: 'Views', shortcut: '2', onSelect: () => setCenterTab('CODE FLOW') },
    { id: 'doc', label: 'Onboarding Doc', icon: '📋', group: 'Views', shortcut: '3', onSelect: () => setCenterTab('ONBOARDING DOC') },
    { id: 'files', label: 'Files Panel', icon: '📁', group: 'Panel', onSelect: () => setLeftTab('FILES') },
    { id: 'modules', label: 'Modules Panel', icon: '📦', group: 'Panel', onSelect: () => setLeftTab('MODULES') },
    { id: 'export-json', label: 'Export as JSON', icon: '⬇', group: 'Export', onSelect: () => exportGraphAsJSON(graphData) },
    { id: 'export-mermaid', label: 'Export as Mermaid', icon: '⬇', group: 'Export', onSelect: () => exportGraphAsMermaid(graphData, sessionId) },
    { id: 'share', label: 'Copy Share Link', icon: '🔗', group: 'Share', onSelect: handleShare },
    { id: 'close', label: 'Close Repository', icon: '✕', group: 'Navigation', shortcut: 'Esc', onSelect: onClose },
  ], [graphData, sessionId, handleShare, onClose]);

  return (
    <>
      {/* Global Command Palette */}
      <CommandPalette
        open={palette.open}
        onClose={() => palette.setOpen(false)}
        actions={paletteActions}
        files={filePaths}
        onFileSelect={(path) => { setActiveFile(path); setLeftTab('FILES'); }}
      />

      {/* Error banner */}
      {analysisError && (
        <div style={{
          position: 'absolute', top: 52, left: 0, right: 0, zIndex: 30,
          background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.3)',
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.08em' }}>
            ⚠ INGESTION_ERROR
          </span>
          <span style={{ color: '#fca5a5', fontFamily: 'monospace', fontSize: 10, flex: 1 }}>
            {analysisError}
          </span>
          <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 9 }}>
            Dashboard shows cached / partial data.
          </span>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowExport(false)}
        >
          <div
            style={{
              background: '#0d0d10', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '24px 28px', minWidth: 320,
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#00E5A0', marginBottom: 4 }}>Export_Pipeline</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 20 }}>Choose format</div>
            {[
              { label: 'JSON', desc: 'Raw graph data — nodes, edges, metadata', icon: '{ }', action: () => { exportGraphAsJSON(graphData); setShowExport(false); } },
              { label: 'Mermaid', desc: 'Mermaid diagram — paste into docs or GitHub', icon: '⟁', action: () => { exportGraphAsMermaid(graphData, sessionId); setShowExport(false); } },
              { label: 'Share URL', desc: 'Copy a direct link to this analysis', icon: '🔗', action: () => { handleShare(); setShowExport(false); } },
            ].map(({ label, desc, icon, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 8,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,229,160,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              >
                <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</span>
                <span>
                  <span style={{ display: 'block', color: '#fff', fontWeight: 600, fontSize: 13 }}>{label}</span>
                  <span style={{ display: 'block', color: '#555', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
          {/* Branch selector */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setBranchOpen((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                marginLeft: 4, padding: '2px 8px 2px 6px',
                background: branchOpen ? 'rgba(0,229,160,0.08)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${branchOpen ? 'rgba(0,229,160,0.3)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 5, cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              <span style={{ fontSize: 9, color: '#555' }}>⎇</span>
              <span style={{ fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: branchOpen ? '#00E5A0' : '#aaa' }}>
                {branch}
              </span>
              <span style={{ fontSize: 8, color: '#555', marginLeft: 2 }}>▾</span>
            </button>
            {branchOpen && (
              <div
                style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4,
                  background: '#0d0d10', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 7, overflow: 'hidden', zIndex: 50, minWidth: 160,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                }}
              >
                {BRANCHES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => { setBranch(b); setBranchOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '7px 12px',
                      fontFamily: 'monospace', fontSize: 11,
                      color: b === branch ? '#00E5A0' : '#888',
                      background: b === branch ? 'rgba(0,229,160,0.06)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'all 100ms',
                    }}
                    onMouseEnter={(e) => { if (b !== branch) e.currentTarget.style.color = '#ccc'; }}
                    onMouseLeave={(e) => { if (b !== branch) e.currentTarget.style.color = '#888'; }}
                  >
                    {b === branch ? '✓ ' : '  '}{b}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: languages + filter */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {availableLangs.slice(0, 4).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLangFilter(langFilter === lang ? null : lang)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '2px 8px', borderRadius: 100,
                background: langFilter === lang ? 'rgba(0,229,160,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${langFilter === lang ? 'rgba(0,229,160,0.4)' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: langFilter === lang ? '#00E5A0' : '#555',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'monospace', fontSize: 10, color: langFilter === lang ? '#00E5A0' : '#666',
              }}>
                {lang}
              </span>
            </button>
          ))}
          {langFilter && (
            <button
              type="button"
              onClick={() => setLangFilter(null)}
              style={{
                fontFamily: 'monospace', fontSize: 9, color: '#555', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 100,
                padding: '2px 8px', cursor: 'pointer',
              }}
            >
              clear filter ✕
            </button>
          )}
        </div>

        {/* Right: actions */}
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

        {/* ⌘K */}
        <button
          type="button"
          onClick={() => { palette.toggle(); onOpenPalette?.(); }}
          style={{
            fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 5, color: '#555', padding: '3px 8px', cursor: 'pointer',
            transition: 'all 150ms',
          }}
          title="Command Palette (⌘K)"
        >⌘K</button>

        <button
          type="button"
          onClick={handleShare}
          style={{
            fontFamily: 'monospace', fontSize: '0.625rem', letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: shareCopied ? 'rgba(0,229,160,0.1)' : 'transparent',
            border: `1px solid ${shareCopied ? 'rgba(0,229,160,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 5, color: shareCopied ? '#00E5A0' : '#777',
            padding: '3px 10px', cursor: 'pointer', transition: 'all 200ms',
          }}
        >
          {shareCopied ? '✓ Copied!' : 'Share'}
        </button>

        <button
          type="button"
          onClick={() => setShowExport(true)}
          style={{
            fontFamily: 'monospace', fontSize: '0.625rem', letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5, color: '#777', padding: '3px 10px', cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        >
          Export
        </button>

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
          {centerTab === "CODE FLOW" && <InteractiveCodeFlow graphData={graphData} />}
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
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span className="size-1.5 rounded-full bg-zinc-100 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
            Ask DevLens
            {chat.isStreaming && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          </div>
          {sessionId && chat.messages.length > 0 && (
            <button
              onClick={chat.clearMessages}
              style={{
                fontFamily: 'monospace', fontSize: 9, textTransform: 'uppercase', color: '#666',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
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
                  <br /><br />
                  <span className="text-[10px] text-zinc-600 bg-white/5 px-2 py-1 rounded">@mention files to force context</span>
                </div>
              </div>
            </div>
          ) : (
            chat.messages.map((msg, i) => (
              <div key={i} className={`text-xs leading-relaxed ${msg.role === "user" ? "text-brand-heading text-right flex justify-end" : "text-zinc-400"
                }`}>
                <div style={{ maxWidth: '85%' }}>
                  {msg.role === "assistant" && (
                    <span className="font-mono text-[9px] uppercase text-zinc-600 block mb-1">DevLens</span>
                  )}
                  <span className={`inline-block px-3 py-2 rounded-lg ${msg.role === "user" ? "bg-white/10" : "bg-zinc-900 ring-1 ring-white/5"
                    }`}>{msg.content}</span>
                  
                  {/* Assistant Message Controls */}
                  {msg.role === "assistant" && !msg.isStreaming && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {/* Sources */}
                      <div className="flex flex-wrap gap-1">
                        {msg.sources?.map((s) => (
                          <span key={s} className="font-mono text-[9px] text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded cursor-pointer hover:text-white"
                                onClick={() => { setActiveFile(s); setLeftTab('FILES'); }}>
                            {s.split("/").pop()}
                          </span>
                        ))}
                      </div>

                      {/* RLHF / Actions */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" title="Helpful" onClick={() => sessionId && repoHistory.updateMessageFeedback(sessionId, i, 'up')}
                                style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 10, padding: 2 }}>👍</button>
                        <button type="button" title="Not helpful" onClick={() => sessionId && repoHistory.updateMessageFeedback(sessionId, i, 'down')}
                                style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 10, padding: 2 }}>👎</button>
                        <button type="button" title="Create Jira Ticket / GitHub Issue" 
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#aaa', cursor: 'pointer', fontSize: 9, padding: '2px 6px', fontFamily: 'monospace' }}>
                          Draft Issue
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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

function InteractiveCodeFlow({ graphData }: { graphData?: { nodes: Node[]; edges: [string, string][] } }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root", "src", "backend", "app"]));
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const treeData = useMemo(() => {
    const nodes = graphData?.nodes?.length ? graphData.nodes : NODES;
    
    const root: any = { id: "root", name: "Project Codebase", children: [], isFile: false, depth: 0, path: "" };
    const map = new Map<string, any>();
    map.set("root", root);
    
    nodes.forEach(n => {
      const parts = n.path.split('/');
      let parentPath = "root";
      parts.forEach((part, i) => {
        const isFile = i === parts.length - 1;
        const currentPath = parentPath === "root" ? part : `${parentPath}/${part}`;
        
        if (!map.has(currentPath)) {
          const node = {
            id: currentPath,
            name: part,
            path: currentPath,
            children: [],
            isFile,
            depth: i + 1,
            desc: isFile ? n.desc : undefined
          };
          map.set(currentPath, node);
          map.get(parentPath).children.push(node);
        }
        parentPath = currentPath;
      });
    });
    
    const sortTree = (node: any) => {
      node.children.sort((a: any, b: any) => {
        if (a.isFile && !b.isFile) return 1;
        if (!a.isFile && b.isFile) return -1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    };
    sortTree(root);
    
    // Auto-expand top level on first render
    root.children.forEach((c: any) => expanded.add(c.id));
    
    return root;
  }, [graphData]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Umbrella / Hanging Chimes Layout Algorithm
  const { layoutNodes, canopyLines, columnLines, totalW, totalH } = useMemo(() => {
    if (!treeData) return { layoutNodes: [], canopyLines: [], columnLines: [], totalW: 800, totalH: 600 };

    const folders = treeData.children.filter((c: any) => !c.isFile);
    const files = treeData.children.filter((c: any) => c.isFile);

    const columns: any[] = [];
    const mid = Math.floor(folders.length / 2);
    
    // Balance the umbrella: Folders -> Root Files (Center) -> Folders
    for(let i = 0; i < mid; i++) columns.push({ type: 'folder', node: folders[i] });
    if (files.length > 0) columns.push({ type: 'root_files', nodes: files });
    for(let i = mid; i < folders.length; i++) columns.push({ type: 'folder', node: folders[i] });

    const numCols = columns.length || 1;
    const TOTAL_W = Math.max(900, numCols * 180);
    const CENTER_X = TOTAL_W / 2;
    const ROOT_Y = 40;

    const result: any[] = [];
    const canopyLines: any[] = [];
    const columnLines: any[] = [];
    let maxH = ROOT_Y + 100;

    // Root Node
    result.push({ 
       ...treeData, 
       cx: CENTER_X, y: ROOT_Y, w: 240, h: 48, 
       isRoot: true 
    });

    columns.forEach((col, i) => {
      const cx = (i + 0.5) * (TOTAL_W / numCols);
      
      if (col.type === 'folder') {
         const spoke = col.node;
         const SPOKE_Y = 160;
         
         result.push({ ...spoke, cx, y: SPOKE_Y, w: 160, h: 36, isSpoke: true });
         canopyLines.push({ startX: CENTER_X, startY: ROOT_Y + 48, endX: cx, endY: SPOKE_Y });
         
         let currentY = SPOKE_Y + 36 + 24;
         const traverse = (n: any, depth: number) => {
            result.push({ ...n, cx, y: currentY, w: 150, h: 32, depth });
            currentY += 32 + 10;
            if (expanded.has(n.id) && n.children) {
               n.children.forEach((c: any) => traverse(c, depth + 1));
            }
         };
         
         if (expanded.has(spoke.id) && spoke.children) {
            spoke.children.forEach((c: any) => traverse(c, 1));
         }
         
         const lowestY = currentY - 42;
         if (lowestY > SPOKE_Y + 36) {
           columnLines.push({ x: cx, startY: SPOKE_Y + 36, endY: lowestY + 16 });
         }
         maxH = Math.max(maxH, currentY);
         
      } else {
         // Root Files (Center Column)
         let currentY = 160;
         col.nodes.forEach((n: any) => {
            result.push({ ...n, cx, y: currentY, w: 150, h: 32, depth: 1, isRootFile: true });
            currentY += 32 + 10;
         });
         
         const lowestY = currentY - 42;
         if (lowestY > ROOT_Y + 48) {
           columnLines.push({ x: cx, startY: ROOT_Y + 48, endY: lowestY + 16 });
         }
         canopyLines.push({ startX: CENTER_X, startY: ROOT_Y + 48, endX: cx, endY: 160, isStraight: true });
         maxH = Math.max(maxH, currentY);
      }
    });

    return { layoutNodes: result, canopyLines, columnLines, totalW: TOTAL_W, totalH: maxH + 100 };
  }, [treeData, expanded]);

  const findNode = (id: string) => layoutNodes.find(n => n.id === id);

  // Draw dependency edges (from graphData.edges) when hovering a file
  const edgesToDraw = useMemo(() => {
     if (!hoveredNode) return [];
     const edges = graphData?.edges?.length ? graphData.edges : EDGES;
     const hoveredPos = findNode(hoveredNode);
     if (!hoveredPos) return [];
     
     const lines: Array<{ source: any, target: any }> = [];
     edges.forEach(([source, target]) => {
         if (source === hoveredNode || target === hoveredNode) {
             const sPos = findNode(source);
             const tPos = findNode(target);
             if (sPos && tPos) {
                 lines.push({ source: sPos, target: tPos });
             }
         }
     });
     return lines;
  }, [hoveredNode, graphData, layoutNodes]);

  return (
    <div className="absolute inset-0 overflow-x-hidden overflow-y-auto bg-brand-bg select-none scroll-smooth">
      <div 
        className="p-4 relative w-full flex justify-center" 
        style={{ minHeight: totalH }}
      >
        {/* We use an inner wrapper to center the absolute visualization perfectly */}
        <div className="relative" style={{ width: totalW, height: totalH }}>
          
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 absolute -left-4 -top-4 z-20 bg-brand-bg/90 backdrop-blur inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/5 shadow-sm">
            <span className="size-1.5 rounded-full bg-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.6)]"></span>
            <span className="text-[#00E5A0]">Architecture Map</span>
            <span className="text-zinc-600">·</span>
            <span>Radial Umbrella Flow</span>
          </div>

          {/* Edges Layer */}
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Canopy Lines (Umbrella Ribs) */}
            {canopyLines.map((line, i) => {
              if (line.isStraight) {
                return (
                  <path key={`canopy-${i}`} d={`M ${line.startX} ${line.startY} L ${line.endX} ${line.endY}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                );
              }
              // Beautiful swooping bezier for umbrella ribs
              return (
                <path
                  key={`canopy-${i}`}
                  d={`M ${line.startX} ${line.startY} C ${line.startX} ${line.startY + 60}, ${line.endX} ${line.endY - 60}, ${line.endX} ${line.endY}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1.5"
                />
              );
            })}

            {/* Column Strings (Hanging Chimes) */}
            {columnLines.map((line, i) => (
              <line
                key={`col-${i}`}
                x1={line.x} y1={line.startY} x2={line.x} y2={line.endY}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            ))}
            
            {/* Dependency Edges (Cross-column Synapses active on hover) */}
            {edgesToDraw.map((edge, i) => {
               const startX = edge.source.cx;
               const startY = edge.source.y + edge.source.h / 2;
               const endX = edge.target.cx;
               const endY = edge.target.y + edge.target.h / 2;
               
               // Calculate a sweeping "vine" curve that drops down and sweeps across
               const midY = Math.max(startY, endY) + 60;
               
               return (
                 <path
                   key={`dep-${i}`}
                   d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
                   fill="none"
                   stroke="#00E5A0"
                   strokeWidth="1.5"
                   className="opacity-90"
                   strokeDasharray="6 4"
                   filter="url(#glow)"
                 />
               );
            })}
          </svg>

          {/* Nodes Layer */}
          {layoutNodes.map(node => {
            const isExpanded = expanded.has(node.id);
            const isHovered = hoveredNode === node.id;
            const isDepHovered = edgesToDraw.some(e => e.source.id === node.id || e.target.id === node.id);
            
            return (
              <div
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => toggleExpand(node.id)}
                className={`absolute flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all cursor-pointer z-10 overflow-hidden
                  ${node.isRoot 
                    ? "bg-zinc-950 border-[#00E5A0]/40 shadow-[0_0_24px_rgba(0,229,160,0.15)] ring-1 ring-[#00E5A0]/20"
                    : node.isSpoke
                      ? "bg-[#111] border-b-2 border-b-[#00E5A0]/60 border-t-white/5 border-x-white/5 shadow-lg"
                      : node.isFile 
                        ? "bg-[#0b0b0c]/80 border-white/5 hover:border-white/20" 
                        : "bg-[#141416]/90 border-white/10 hover:border-white/30 shadow-md"
                  } 
                  ${isHovered && !node.isRoot ? "ring-1 ring-[#00E5A0]/50 bg-[#00E5A0]/5 transform scale-105" : ""} 
                  ${isDepHovered && !isHovered ? "ring-1 ring-[#00E5A0]/30 bg-zinc-900" : ""}`
                }
                style={{
                   left: node.cx - node.w / 2,
                   top: node.y,
                   width: node.w,
                   height: node.h,
                   boxShadow: isHovered && !node.isFile && !node.isRoot ? "0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,229,160,0.2)" : undefined
                }}
              >
                {node.isRoot ? (
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-[8px] uppercase tracking-widest text-[#00E5A0] mb-0.5">Root Architecture</span>
                    <span className="font-sans text-sm font-semibold tracking-tight text-white">{node.name}</span>
                  </div>
                ) : node.isSpoke ? (
                  <div className="flex items-center gap-2 w-full px-1">
                    <span className={`text-[9px] font-mono transition-transform duration-300 ${isExpanded ? "rotate-0 text-[#00E5A0]" : "-rotate-90 text-zinc-500"}`}>▼</span>
                    <span className="font-sans text-xs font-semibold text-zinc-100 truncate flex-1">{node.name}</span>
                    <span className="font-mono text-[9px] text-zinc-500 bg-white/5 px-1.5 rounded-full">{node.children?.length || 0}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-full px-1" style={{ paddingLeft: `${Math.min(node.depth - 1, 3) * 8}px` }}>
                    {!node.isFile && (
                      <span className={`text-[8px] font-mono transition-transform duration-300 ${isExpanded ? "rotate-0 text-[#00E5A0]" : "-rotate-90 text-zinc-600"}`}>▼</span>
                    )}
                    {node.isFile && (
                      <span className="text-zinc-600 font-mono text-[10px]">📄</span>
                    )}
                    <span className={`font-sans text-[11px] truncate flex-1 ${node.isFile ? 'text-zinc-400' : 'text-zinc-200 font-medium'}`}>
                      {node.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

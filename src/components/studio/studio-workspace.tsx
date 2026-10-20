import { useState, useEffect, useMemo, useCallback } from "react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useChat } from "@/hooks/useChat";
import { api } from "@/lib/api";
import { repoHistory } from "@/lib/repo-history";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";

import type { StudioTab } from "./studio-types";
import { TelemetryModal } from "./telemetry-modal";
import { StudioTopbar } from "./studio-topbar";
import { ExplorerRail } from "./explorer-rail";
import { ArchitectureCanvas } from "./architecture-canvas";
import { CodeFlowStepper } from "./code-flow-stepper";
import { OnboardingDocView } from "./onboarding-doc-view";
import { DriftTimelineView } from "./drift-timeline-view";
import { CopilotRail } from "./copilot-rail";
import { generateJsonExport, generateMermaidDiagram, generatePlantUmlDiagram } from "./export-utils";

interface StudioWorkspaceProps {
  repoUrl: string;
  jobId?: string;
  sessionId?: string;
  onClose: () => void;
}

export function StudioWorkspace({
  repoUrl,
  jobId,
  sessionId,
  onClose,
}: StudioWorkspaceProps) {
  const repoLabel = repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");
  const { state: analysisState, startAnalysis } = useAnalysis();
  const chat = useChat(analysisState.sessionId ?? sessionId ?? null);

  const [activeTab, setActiveTab] = useState<StudioTab>("architecture");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [branch, setBranch] = useState("main");
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);
  const [isProcessingDone, setIsProcessingDone] = useState(!!(jobId && sessionId));
  const [onboardingDoc, setOnboardingDoc] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2800);
  }, []);

  // Fetch AI-generated onboarding doc when sessionId is available
  useEffect(() => {
    const sid = analysisState.sessionId ?? sessionId;
    if (sid && !onboardingDoc) {
      api.getOnboardingDoc(sid)
        .then((res) => {
          if (res?.markdown) {
            setOnboardingDoc(res.markdown);
          }
        })
        .catch(() => {
          // Fallback to rich built-in guide
        });
    }
  }, [analysisState.sessionId, sessionId, onboardingDoc]);

  // Responsive panel auto-collapse on tablet / mobile screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setExplorerCollapsed(true);
      }
      if (window.innerWidth < 768) {
        setCopilotCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const palette = useCommandPalette();

  // Kick off real analysis on mount
  useEffect(() => {
    if (jobId && sessionId) {
      startAnalysis(repoUrl, { jobId, sessionId });
      setIsProcessingDone(true);
    } else {
      startAnalysis(repoUrl);
    }
  }, [repoUrl, jobId, sessionId, startAnalysis]);

  // When analysis completes, persist to repo history and open the studio
  useEffect(() => {
    if (analysisState.isComplete && analysisState.sessionId) {
      setIsProcessingDone(true);
      repoHistory.upsert({
        id: analysisState.sessionId,
        repoUrl,
        repoLabel,
        analyzedAt: new Date().toISOString(),
        status: "complete",
        meta: analysisState.repoMeta ? {
          stars: analysisState.repoMeta.stars,
          files: analysisState.repoMeta.files,
          sizeKb: analysisState.repoMeta.sizeKb,
          languages: analysisState.repoMeta.languages,
        } : undefined,
      });
    }
  }, [analysisState.isComplete, analysisState.sessionId, repoUrl, repoLabel, analysisState.repoMeta]);

  // Available languages
  const languages = useMemo(() => {
    if (analysisState.repoMeta?.languages) {
      return Object.keys(analysisState.repoMeta.languages);
    }
    return ["TypeScript", "JavaScript", "Python", "Rust"];
  }, [analysisState.repoMeta]);

  // File paths for ⌘K palette
  const filePaths = useMemo(() => {
    return (analysisState.filesData?.tree ?? [])
      .filter((f) => !f.is_dir)
      .map((f) => f.path);
  }, [analysisState.filesData]);

  // Export handlers
  const handleExport = useCallback((format: "json" | "mermaid" | "plantuml" | "share") => {
    if (format === "share") {
      const url = `${window.location.origin}/dashboard?repo=${encodeURIComponent(repoUrl)}`;
      navigator.clipboard.writeText(url);
      showToast("✓ Studio share link copied to clipboard");
      return;
    }

    if (format === "json") {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(generateJsonExport(analysisState.graphData));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${repoLabel.replace(/\//g, "-")}-graph.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("✓ Architecture JSON downloaded");
      return;
    }

    if (format === "mermaid") {
      const sid = analysisState.sessionId ?? sessionId;
      if (sid) {
        api.exportGraph(sid, "mermaid")
          .then((mermaidStr) => {
            navigator.clipboard.writeText(mermaidStr);
            showToast("✓ Mermaid diagram copied to clipboard");
          })
          .catch(() => {
            const mermaidStr = generateMermaidDiagram(analysisState.graphData?.edges ?? []);
            navigator.clipboard.writeText(mermaidStr);
            showToast("✓ Mermaid diagram copied to clipboard");
          });
        return;
      }

      const mermaidStr = generateMermaidDiagram(analysisState.graphData?.edges ?? []);
      navigator.clipboard.writeText(mermaidStr);
      showToast("✓ Mermaid diagram copied to clipboard");
      return;
    }

    if (format === "plantuml") {
      const sid = analysisState.sessionId ?? sessionId;
      if (sid) {
        api.exportGraph(sid, "plantuml")
          .then((pumlStr) => {
            navigator.clipboard.writeText(pumlStr);
            showToast("✓ PlantUML diagram copied to clipboard");
          })
          .catch(() => {
            const pumlStr = generatePlantUmlDiagram(analysisState.graphData?.edges ?? [], repoLabel);
            navigator.clipboard.writeText(pumlStr);
            showToast("✓ PlantUML diagram copied to clipboard");
          });
        return;
      }

      const pumlStr = generatePlantUmlDiagram(analysisState.graphData?.edges ?? [], repoLabel);
      navigator.clipboard.writeText(pumlStr);
      showToast("✓ PlantUML diagram copied to clipboard");
    }
  }, [repoUrl, repoLabel, analysisState.graphData, analysisState.sessionId, sessionId, showToast]);

  const paletteActions = useMemo(() => [
    { id: "arch", label: "Architecture Graph", icon: "🔷", group: "Views", shortcut: "1", onSelect: () => setActiveTab("architecture") },
    { id: "flow", label: "Code Flow", icon: "🌊", group: "Views", shortcut: "2", onSelect: () => setActiveTab("flow") },
    { id: "drift", label: "Drift Timeline", icon: "⏳", group: "Views", shortcut: "3", onSelect: () => setActiveTab("drift") },
    { id: "doc", label: "Onboarding Doc", icon: "📋", group: "Views", shortcut: "4", onSelect: () => setActiveTab("doc") },
    { id: "toggle-explorer", label: "Toggle File Explorer", icon: "📁", group: "Panels", onSelect: () => setExplorerCollapsed((v) => !v) },
    { id: "toggle-copilot", label: "Toggle DevLens Copilot", icon: "💬", group: "Panels", onSelect: () => setCopilotCollapsed((v) => !v) },
    { id: "export-json", label: "Export as JSON", icon: "⬇", group: "Export", onSelect: () => handleExport("json") },
    { id: "export-mermaid", label: "Export as Mermaid", icon: "⬇", group: "Export", onSelect: () => handleExport("mermaid") },
    { id: "export-plantuml", label: "Export as PlantUML", icon: "⬇", group: "Export", onSelect: () => handleExport("plantuml") },
    { id: "share", label: "Copy Share Link", icon: "🔗", group: "Share", onSelect: () => handleExport("share") },
    { id: "close", label: "Close Repository", icon: "✕", group: "Navigation", shortcut: "Esc", onSelect: onClose },
  ], [handleExport, onClose]);

  // Rich fallback files for preview / offline mode
  const displayFiles = useMemo(() => {
    if (analysisState.filesData?.tree && analysisState.filesData.tree.length > 0) {
      return analysisState.filesData.tree;
    }
    return [
      { path: "src", name: "src", is_dir: true, depth: 0 },
      { path: "src/App.tsx", name: "App.tsx", is_dir: false, depth: 1, line_count: 140, language: "TypeScript" },
      { path: "src/router", name: "router", is_dir: true, depth: 1 },
      { path: "src/router/Router.tsx", name: "Router.tsx", is_dir: false, depth: 2, line_count: 280, language: "TypeScript" },
      { path: "src/services", name: "services", is_dir: true, depth: 1 },
      { path: "src/services/AuthService.ts", name: "AuthService.ts", is_dir: false, depth: 2, line_count: 195, language: "TypeScript" },
      { path: "src/lib", name: "lib", is_dir: true, depth: 1 },
      { path: "src/lib/ApiClient.ts", name: "ApiClient.ts", is_dir: false, depth: 2, line_count: 160, language: "TypeScript" },
      { path: "src/store", name: "store", is_dir: true, depth: 1 },
      { path: "src/store/Store.ts", name: "Store.ts", is_dir: false, depth: 2, line_count: 310, language: "TypeScript" },
      { path: "src/utils", name: "utils", is_dir: true, depth: 1 },
      { path: "src/utils/Formatters.ts", name: "Formatters.ts", is_dir: false, depth: 2, line_count: 85, language: "TypeScript" },
      { path: "src/db", name: "db", is_dir: true, depth: 1 },
      { path: "src/db/Database.ts", name: "Database.ts", is_dir: false, depth: 2, line_count: 220, language: "TypeScript" },
      { path: "package.json", name: "package.json", is_dir: false, depth: 0, line_count: 55, language: "JSON" },
      { path: "README.md", name: "README.md", is_dir: false, depth: 0, line_count: 92, language: "Markdown" },
    ];
  }, [analysisState.filesData]);

  const displayModules = useMemo(() => {
    if (analysisState.filesData?.modules && analysisState.filesData.modules.length > 0) {
      return analysisState.filesData.modules;
    }
    return [
      { name: "core/services", file_count: 4, files: ["AuthService.ts", "CodeGraphService.ts"] },
      { name: "router", file_count: 2, files: ["Router.tsx"] },
      { name: "store", file_count: 3, files: ["Store.ts"] },
      { name: "db", file_count: 2, files: ["Database.ts"] },
    ];
  }, [analysisState.filesData]);

  const displayEntryPoints = useMemo(() => {
    if (analysisState.filesData?.entry_points && analysisState.filesData.entry_points.length > 0) {
      return analysisState.filesData.entry_points;
    }
    return ["src/App.tsx", "src/router/Router.tsx", "src/server/ingress.ts"];
  }, [analysisState.filesData]);

  // Real dynamic graph metrics calculated from active ingested data
  const graphStats = useMemo(() => {
    const nodes = analysisState.graphData?.nodes ?? [];
    const edges = analysisState.graphData?.edges ?? [];
    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    const outDegrees = new Map<string, number>();
    edges.forEach(([u]) => {
      outDegrees.set(u, (outDegrees.get(u) ?? 0) + 1);
    });
    let maxFanOut = 0;
    outDegrees.forEach((deg) => {
      if (deg > maxFanOut) maxFanOut = deg;
    });

    const totalComp = nodes.reduce((acc, n) => acc + (n.complexity ?? 1), 0);
    const avgComp = nodes.length > 0 ? (totalComp / nodes.length).toFixed(1) : "0.0";
    const cyclesList = analysisState.graphData?.meta?.cycles ?? [];

    return {
      nodeCount,
      edgeCount,
      maxFanOut,
      avgComp,
      cycles: cyclesList.length,
      cycleDetails: cyclesList,
    };
  }, [analysisState.graphData]);

  // Show Ingest Telemetry Modal while analyzing
  if (!isProcessingDone && !analysisState.isComplete) {
    return (
      <TelemetryModal
        repoUrl={repoUrl}
        steps={analysisState.steps}
        progressPct={analysisState.progressPct}
        repoMeta={analysisState.repoMeta}
        jobId={analysisState.jobId}
        onCancel={onClose}
        onBypass={() => setIsProcessingDone(true)}
      />
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        backgroundColor: "#08080a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ⌘K Command Palette */}
      <CommandPalette
        open={palette.open}
        onClose={() => palette.setOpen(false)}
        actions={paletteActions}
        files={filePaths}
        onFileSelect={(path) => {
          setActiveFile(path);
          setActiveTab("architecture");
        }}
      />

      {/* Studio Topbar */}
      <StudioTopbar
        repoUrl={repoUrl}
        branch={branch}
        onBranchChange={setBranch}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        languages={languages}
        selectedLang={selectedLang}
        onSelectLang={setSelectedLang}
        onOpenPalette={palette.toggle}
        onExport={handleExport}
        onClose={onClose}
      />

      {/* 3-Pane Studio Workspace Layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Explorer Rail */}
        <ExplorerRail
          files={displayFiles}
          modules={displayModules}
          entryPoints={displayEntryPoints}
          activeFile={activeFile}
          onSelectFile={(path) => {
            setActiveFile(path);
            setActiveTab("architecture");
          }}
          collapsed={explorerCollapsed}
          onToggleCollapse={() => setExplorerCollapsed((v) => !v)}
        />

        {/* Center Stage: Architecture | Code Flow | Onboarding Doc */}
        <main style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {activeTab === "architecture" && (
            <ArchitectureCanvas
              graphData={analysisState.graphData}
              sessionId={analysisState.sessionId ?? sessionId}
              activeFile={activeFile}
              onSelectNode={(_id, path) => setActiveFile(path)}
              onAskCopilotAboutFile={(path) => {
                chat.sendMessage(`Explain the role, dependencies, and blast radius of ${path}`);
              }}
            />
          )}

          {activeTab === "flow" && (
            <CodeFlowStepper
              graphData={analysisState.graphData}
              onAskCopilot={(prompt) => chat.sendMessage(prompt)}
              onSelectFile={(path) => {
                setActiveFile(path);
                setActiveTab("architecture");
              }}
            />
          )}

          {activeTab === "drift" && (
            <DriftTimelineView
              sessionId={analysisState.sessionId ?? sessionId}
              repoLabel={repoLabel}
              graphData={analysisState.graphData}
              onSelectFile={(path) => {
                setActiveFile(path);
                setActiveTab("architecture");
              }}
              onAskCopilot={(prompt) => chat.sendMessage(prompt)}
            />
          )}

          {activeTab === "doc" && (
            <OnboardingDocView
              repoLabel={repoLabel}
              markdownContent={onboardingDoc}
            />
          )}
        </main>

        {/* Right Copilot Rail */}
        <CopilotRail
          repoLabel={repoLabel}
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          onSendMessage={(msg) => chat.sendMessage(msg)}
          onClearChat={chat.clearMessages}
          onSelectFile={(path) => {
            setActiveFile(path);
            setActiveTab("architecture");
          }}
          collapsed={copilotCollapsed}
          onToggleCollapse={() => setCopilotCollapsed((v) => !v)}
          graphData={analysisState.graphData}
        />
      </div>

      {/* Bottom Architecture Health & Telemetry Strip */}
      <footer
        style={{
          height: 32,
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          backgroundColor: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          fontFamily: "var(--mf-mono, monospace)",
          fontSize: "0.6875rem",
          color: "rgba(255, 255, 255, 0.5)",
          flexShrink: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: graphStats.cycles === 0 ? "#10b981" : "#ef4444",
              }}
            />
            <span>
              {graphStats.cycles === 0
                ? "0 CIRCULAR CYCLES [DAG STABLE]"
                : `${graphStats.cycles} CIRCULAR CYCLE${graphStats.cycles > 1 ? "S" : ""} DETECTED`}
            </span>
          </span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
          <span>MAX FAN-OUT: {graphStats.maxFanOut} CALLERS</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
          <span>AVG MCCABE COMPLEXITY: {graphStats.avgComp}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span>INDEX: {graphStats.nodeCount} MODULES ({graphStats.edgeCount} EDGES)</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
          <span style={{ color: "rgba(255,255,255,0.7)" }}>FASTAPI + AST</span>
        </div>
      </footer>

      {/* Floating Monoform Action Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#ffffff",
            color: "#000000",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.75rem",
            fontWeight: 500,
            letterSpacing: "0.02em",
            padding: "8px 18px",
            borderRadius: 999,
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
            animation: "fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

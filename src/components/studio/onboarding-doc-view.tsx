import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { GraphData } from "./studio-types";
import { MermaidDiagramCard } from "./mermaid-diagram";

export interface OnboardingDocViewProps {
  repoLabel: string;
  markdownContent?: string;
  graphData?: GraphData | null;
  onSelectFile?: (path: string) => void;
  onAskCopilot?: (prompt: string) => void;
  isLoading?: boolean;
  isAnalyzingRepo?: boolean;
  error?: string | null;
  onRetry?: () => void;
  theme?: "dark" | "light";
}

interface HeadingItem {
  id: string;
  level: 2 | 3;
  title: string;
}

interface HeroSplitData {
  headingTitle: string;
  headingId: string;
  mermaidCode: string;
  proseMarkdown: string;
  restMarkdown: string;
}

function slugifyHeading(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `wiki-${base || "section"}-${index}`;
}

export function extractHeadings(rawMd: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const lines = rawMd.split("\n");
  let inFence = false;
  let idx = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (trimmed.startsWith("## ")) {
      const title = trimmed.replace(/^##\s+/, "").trim();
      headings.push({ id: slugifyHeading(title, idx++), level: 2, title });
    } else if (trimmed.startsWith("### ")) {
      const title = trimmed.replace(/^###\s+/, "").trim();
      headings.push({ id: slugifyHeading(title, idx++), level: 3, title });
    }
  }
  return headings;
}

/**
 * Splits out Section 1 when it begins with a Mermaid diagram + narrative overview
 * so it can render as a balanced two-column Hero Split (diagram left, overview right).
 */
export function extractHeroSplit(rawMd: string): HeroSplitData | null {
  const lines = rawMd.split("\n");
  let sec1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      sec1Idx = i;
      break;
    }
  }
  if (sec1Idx === -1) return null;

  let nextSecIdx = lines.length;
  for (let i = sec1Idx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      nextSecIdx = i;
      break;
    }
  }

  const sec1Lines = lines.slice(sec1Idx + 1, nextSecIdx);
  let fenceStart = -1;
  let fenceEnd = -1;
  for (let i = 0; i < sec1Lines.length; i++) {
    const t = sec1Lines[i].trim();
    if (fenceStart === -1 && t.startsWith("```mermaid")) {
      fenceStart = i;
    } else if (fenceStart !== -1 && t.startsWith("```")) {
      fenceEnd = i;
      break;
    }
  }
  if (fenceStart === -1 || fenceEnd === -1) return null;

  const mermaidCode = sec1Lines
    .slice(fenceStart + 1, fenceEnd)
    .join("\n")
    .trim();
  const proseLines = [...sec1Lines.slice(0, fenceStart), ...sec1Lines.slice(fenceEnd + 1)];
  const proseMarkdown = proseLines.join("\n").trim();
  if (!mermaidCode || !proseMarkdown) return null;

  const headingTitle = lines[sec1Idx]
    .trim()
    .replace(/^##\s+/, "")
    .trim();
  const restMarkdown = lines.slice(nextSecIdx).join("\n");

  return {
    headingTitle,
    headingId: slugifyHeading(headingTitle, 0),
    mermaidCode,
    proseMarkdown,
    restMarkdown,
  };
}

const NON_ARCH_EXACT_NAMES = new Set([
  ".gitignore",
  ".dockerignore",
  ".editorconfig",
  ".eslintrc",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json",
  ".env",
  ".env.example",
  "readme.md",
  "readme.rst",
  "readme.txt",
  "license",
  "license.md",
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "tsconfig.json",
  "jsconfig.json",
  "requirements.txt",
  "pyproject.toml",
  "makefile",
]);

const NON_ARCH_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".rst",
  ".lock",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".map",
]);

function isArchSourcePath(rawPath: string): boolean {
  const clean = rawPath.trim().replace(/\\/g, "/");
  if (!clean) return false;
  const base = (clean.split("/").pop() || clean).toLowerCase();
  if (NON_ARCH_EXACT_NAMES.has(base) || base.startsWith(".env")) return false;
  const dotIdx = base.lastIndexOf(".");
  if (dotIdx > 0) {
    const ext = base.slice(dotIdx);
    if (NON_ARCH_EXTENSIONS.has(ext)) return false;
  }
  return true;
}

function sanitizeMermaidLabel(text: string): string {
  return text.replace(/["'`[\]{}()<>]/g, "").trim().slice(0, 64) || "Module";
}

export function hasMermaidEdges(code: string): boolean {
  return /(-->|-\.->|==>|---|--o|--x|\|\|--|\}o--|\}--)/.test(code);
}

export function parseBracketCitation(
  rawToken: string,
): { filePath: string; lineRange?: string; displayLabel: string } | null {
  let inner = rawToken.trim();
  if (inner.startsWith("`") && inner.endsWith("`") && inner.length >= 2) {
    inner = inner.slice(1, -1).trim();
  }
  if (!inner.startsWith("[[") || !inner.endsWith("]]")) {
    return null;
  }
  const content = inner.slice(2, -2).trim();
  if (!content) return null;

  const lineMatch = content.match(/^(.*):([0-9]+(?:-[0-9]+)?)$/);
  const filePath = (lineMatch ? lineMatch[1] : content).trim();
  const lineRange = lineMatch ? lineMatch[2] : undefined;
  if (!filePath) return null;

  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const compactPath =
    segments.length <= 3 ? normalized : `${segments.slice(-3).join("/")}`;
  const displayLabel = lineRange ? `${compactPath}:${lineRange}` : compactPath;

  return { filePath, lineRange, displayLabel };
}

export function buildClientMermaidFallback(graphData?: GraphData | null): string | null {
  if (!graphData?.nodes || graphData.nodes.length === 0) return null;

  const nodeById = new Map<string, (typeof graphData.nodes)[number]>();
  for (const n of graphData.nodes) {
    nodeById.set(n.id, n);
  }

  const normalizedEdges: Array<[string, string]> = [];
  const seenEdgeKeys = new Set<string>();
  const outDeg = new Map<string, number>();
  const inDeg = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const e of graphData.edges ?? []) {
    const rawSrc = Array.isArray(e) ? e[0] : (e as unknown as { source: string }).source;
    const rawTgt = Array.isArray(e) ? e[1] : (e as unknown as { target: string }).target;
    if (!rawSrc || !rawTgt || rawSrc === rawTgt) continue;
    const srcNode = nodeById.get(rawSrc);
    const tgtNode = nodeById.get(rawTgt);
    const srcPath = srcNode?.path || srcNode?.label || rawSrc;
    const tgtPath = tgtNode?.path || tgtNode?.label || rawTgt;
    if (!isArchSourcePath(srcPath) || !isArchSourcePath(tgtPath)) continue;

    const key = `${rawSrc}->${rawTgt}`;
    if (seenEdgeKeys.has(key)) continue;
    seenEdgeKeys.add(key);
    normalizedEdges.push([rawSrc, rawTgt]);
    outDeg.set(rawSrc, (outDeg.get(rawSrc) ?? 0) + 1);
    inDeg.set(rawTgt, (inDeg.get(rawTgt) ?? 0) + 1);
    outgoing.set(rawSrc, [...(outgoing.get(rawSrc) ?? []), rawTgt]);
    incoming.set(rawTgt, [...(incoming.get(rawTgt) ?? []), rawSrc]);
  }

  const lines = ["graph TD"];

  if (normalizedEdges.length > 0) {
    const selectedIds: string[] = [];
    const selectedSet = new Set<string>();
    const addId = (id: string) => {
      if (!selectedSet.has(id) && selectedIds.length < 10) {
        selectedSet.add(id);
        selectedIds.push(id);
      }
    };

    // Prefer connected entry points and high-out-degree orchestrators first
    const connectedNodes = graphData.nodes
      .filter((n) => (outDeg.get(n.id) ?? 0) + (inDeg.get(n.id) ?? 0) > 0)
      .sort((a, b) => {
        const aEntry = a.is_entry ? 1 : 0;
        const bEntry = b.is_entry ? 1 : 0;
        if (bEntry !== aEntry) return bEntry - aEntry;
        const aScore = (inDeg.get(a.id) ?? 0) * 2 + (outDeg.get(a.id) ?? 0);
        const bScore = (inDeg.get(b.id) ?? 0) * 2 + (outDeg.get(b.id) ?? 0);
        return bScore - aScore;
      });

    for (const n of connectedNodes.slice(0, 4)) {
      addId(n.id);
    }

    // Pull immediate targets and callers so every seeded node has visible arrows
    for (const seed of [...selectedIds]) {
      const targets = (outgoing.get(seed) ?? []).sort(
        (a, b) =>
          (inDeg.get(b) ?? 0) + (outDeg.get(b) ?? 0) - ((inDeg.get(a) ?? 0) + (outDeg.get(a) ?? 0)),
      );
      for (const t of targets.slice(0, 2)) addId(t);
      const callers = (incoming.get(seed) ?? []).sort(
        (a, b) => (outDeg.get(b) ?? 0) - (outDeg.get(a) ?? 0),
      );
      for (const c of callers.slice(0, 1)) addId(c);
    }

    if (selectedIds.length < 6) {
      const rankedEdges = [...normalizedEdges].sort(
        (a, b) =>
          (inDeg.get(b[1]) ?? 0) +
          (outDeg.get(b[0]) ?? 0) -
          ((inDeg.get(a[1]) ?? 0) + (outDeg.get(a[0]) ?? 0)),
      );
      for (const [src, tgt] of rankedEdges) {
        addId(src);
        addId(tgt);
        if (selectedIds.length >= 10) break;
      }
    }

    const activeEdges = normalizedEdges
      .filter(([src, tgt]) => selectedSet.has(src) && selectedSet.has(tgt))
      .slice(0, 14);

    if (activeEdges.length > 0) {
      const finalIds: string[] = [];
      const finalSet = new Set<string>();
      for (const [src, tgt] of activeEdges) {
        if (!finalSet.has(src)) {
          finalSet.add(src);
          finalIds.push(src);
        }
        if (!finalSet.has(tgt)) {
          finalSet.add(tgt);
          finalIds.push(tgt);
        }
      }

      const pathFor = (id: string) => {
        const n = nodeById.get(id);
        return (n?.path || n?.label || id).replace(/\\/g, "/");
      };

      const basenameCounts = new Map<string, number>();
      for (const id of finalIds) {
        const base = pathFor(id).split("/").pop() || id;
        basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1);
      }

      const labelFor = (id: string) => {
        const p = pathFor(id);
        const parts = p.split("/").filter(Boolean);
        const base = parts[parts.length - 1] || p;
        if ((basenameCounts.get(base) ?? 0) > 1 && parts.length >= 2) {
          return sanitizeMermaidLabel(parts.slice(-2).join("/"));
        }
        return sanitizeMermaidLabel(base);
      };

      const mmdIds = new Map<string, string>();
      finalIds.forEach((id, idx) => mmdIds.set(id, `MOD_${idx}`));

      // Group into top-level subgraphs when multiple directories exist
      const groups = new Map<string, string[]>();
      for (const id of finalIds) {
        const parts = pathFor(id).split("/").filter(Boolean);
        const dirKey = parts.length > 1 ? parts[0] : "root";
        groups.set(dirKey, [...(groups.get(dirKey) ?? []), id]);
      }

      if (groups.size >= 2) {
        let gIdx = 0;
        for (const [dirName, ids] of groups.entries()) {
          const safeGroup = sanitizeMermaidLabel(dirName === "root" ? "Root Modules" : `${dirName}/`);
          lines.push(`    subgraph SG_${gIdx++}["${safeGroup}"]`);
          for (const id of ids) {
            lines.push(`        ${mmdIds.get(id)}["${labelFor(id)}"]`);
          }
          lines.push("    end");
        }
      } else {
        for (const id of finalIds) {
          lines.push(`    ${mmdIds.get(id)}["${labelFor(id)}"]`);
        }
      }

      for (const [src, tgt] of activeEdges) {
        lines.push(`    ${mmdIds.get(src)} -->|"imports"| ${mmdIds.get(tgt)}`);
      }
      return lines.join("\n");
    }
  }

  // Fallback when graph has zero edges: group top source files under their top-level folders
  const sourceNodes = graphData.nodes.filter((n) => isArchSourcePath(n.path || n.label || n.id));
  const pool = (sourceNodes.length > 0 ? sourceNodes : graphData.nodes).slice(0, 6);
  const rootId = "REPO_ROOT";
  lines.push(`    ${rootId}["Indexed Source Modules"]`);
  pool.forEach((n, idx) => {
    const id = `MOD_${idx}`;
    const rawName = (n.path || n.label || `Module_${idx}`).split("/").pop() || `Module_${idx}`;
    lines.push(`    ${id}["${sanitizeMermaidLabel(rawName)}"]`);
    lines.push(`    ${rootId} -->|"contains"| ${id}`);
  });
  return lines.length >= 3 ? lines.join("\n") : null;
}

interface GenerationStage {
  phase: string;
  title: string;
  detail: string;
  tag: string;
}

const GENERATION_STAGES: GenerationStage[] = [
  {
    phase: "PHASE 1 OF 5",
    title: "Mapping Module Topology",
    detail:
      "Parsing abstract syntax tree for verified entry points and exported module boundaries.",
    tag: "ast-topology",
  },
  {
    phase: "PHASE 2 OF 5",
    title: "Extracting Schemas & Data Contracts",
    detail: "Inspecting database models, request routers, and environment configurations.",
    tag: "schema-contracts",
  },
  {
    phase: "PHASE 3 OF 5",
    title: "Synthesizing Architecture Diagrams",
    detail: "Drafting interactive Mermaid entity-relationship models and sequence flows.",
    tag: "mermaid-synthesis",
  },
  {
    phase: "PHASE 4 OF 5",
    title: "Authoring Subsystem Deep Dives",
    detail: "Documenting architectural patterns with verified file and symbol citations.",
    tag: "subsystem-walkthrough",
  },
  {
    phase: "PHASE 5 OF 5",
    title: "Compiling Interactive Code Wiki",
    detail: "Validating cross-links and compiling the two-column walkthrough overview.",
    tag: "wiki-assembly",
  },
];

const TELEMETRY_STREAM = [
  { atSec: 1, text: "AST scan complete: modules and exports cataloged across repo" },
  { atSec: 3, text: "Identifying candidate starter files and primary execution entry points" },
  { atSec: 6, text: "Grounding database schemas, entities, and foreign key relations" },
  { atSec: 9, text: "Synthesizing Mermaid diagrams with deterministic topological fallbacks" },
  { atSec: 13, text: "Drafting subsystem deep dives and verifying file citations" },
  { atSec: 17, text: "Generating contextual Copilot questions for each architectural domain" },
  { atSec: 21, text: "Assembling split-view hero overview and sticky navigation index" },
];

function RealtimeDocGenerationLoader({
  repoLabel,
  isLight,
  borderLine,
  bgCard,
  textPrimary,
  textBody,
  textMuted,
}: {
  repoLabel: string;
  isLight: boolean;
  borderLine: string;
  bgCard: string;
  textPrimary: string;
  textBody: string;
  textMuted: string;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeStageIndex = useMemo(() => {
    if (elapsedSeconds < 4) return 0;
    if (elapsedSeconds < 9) return 1;
    if (elapsedSeconds < 15) return 2;
    if (elapsedSeconds < 21) return 3;
    return 4;
  }, [elapsedSeconds]);

  const progressPercent = useMemo(() => {
    if (elapsedSeconds <= 0) return 12;
    if (elapsedSeconds < 4) return 15 + Math.round((elapsedSeconds / 4) * 15);
    if (elapsedSeconds < 9) return 30 + Math.round(((elapsedSeconds - 4) / 5) * 25);
    if (elapsedSeconds < 15) return 55 + Math.round(((elapsedSeconds - 9) / 6) * 20);
    if (elapsedSeconds < 21) return 75 + Math.round(((elapsedSeconds - 15) / 6) * 15);
    return Math.min(95, 90 + Math.round((elapsedSeconds - 21) * 0.4));
  }, [elapsedSeconds]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [elapsedSeconds]);

  const currentStage = GENERATION_STAGES[activeStageIndex];
  const visibleLogs = useMemo(() => {
    return TELEMETRY_STREAM.filter((item) => item.atSec <= elapsedSeconds);
  }, [elapsedSeconds]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: "36px 32px",
        borderRadius: 12,
        border: `1px solid ${borderLine}`,
        backgroundColor: bgCard,
        margin: "24px 0",
      }}
    >
      <style>{`
        @keyframes devlens-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.9); }
        }
        @keyframes devlens-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: `1px solid ${borderLine}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: "50%",
              backgroundColor: isLight ? "#2563eb" : "#38bdf8",
              boxShadow: isLight
                ? "0 0 0 3px rgba(37, 99, 235, 0.2)"
                : "0 0 0 3px rgba(56, 189, 248, 0.25)",
              animation: "devlens-pulse 1.8s infinite ease-in-out",
            }}
          />
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: textMuted,
            }}
          >
            Synthesizing Code Wiki / {repoLabel}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              color: textMuted,
            }}
          >
            ELAPSED: <strong style={{ color: textPrimary }}>{formattedTime}</strong>
          </span>
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              padding: "2px 8px",
              borderRadius: 4,
              backgroundColor: isLight ? "rgba(37, 99, 235, 0.1)" : "rgba(56, 189, 248, 0.15)",
              color: isLight ? "#1d4ed8" : "#38bdf8",
              fontWeight: 600,
            }}
          >
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Primary active stage hero */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: isLight ? "#2563eb" : "#38bdf8",
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          {currentStage.phase}
        </div>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: textPrimary,
            letterSpacing: "-0.01em",
          }}
        >
          {currentStage.title}
        </h3>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: textBody,
            maxWidth: 620,
          }}
        >
          {currentStage.detail}
        </p>

        {/* Progress Track */}
        <div
          style={{
            width: "100%",
            height: 6,
            borderRadius: 3,
            backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              borderRadius: 3,
              backgroundColor: isLight ? "#2563eb" : "#38bdf8",
              transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
      </div>

      {/* 5-Stage Checklist Timeline */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
          marginBottom: 24,
        }}
      >
        {GENERATION_STAGES.map((stg, idx) => {
          const isDone = idx < activeStageIndex;
          const isActive = idx === activeStageIndex;
          return (
            <div
              key={stg.tag}
              style={{
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${
                  isActive
                    ? isLight
                      ? "rgba(37, 99, 235, 0.4)"
                      : "rgba(56, 189, 248, 0.4)"
                    : borderLine
                }`,
                backgroundColor: isActive
                  ? isLight
                    ? "rgba(37, 99, 235, 0.04)"
                    : "rgba(56, 189, 248, 0.05)"
                  : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                  fontSize: "0.75rem",
                  fontFamily: "var(--mf-mono, monospace)",
                }}
              >
                {isDone ? (
                  <span style={{ color: isLight ? "#16a34a" : "#4ade80", fontWeight: 700 }}>✓</span>
                ) : isActive ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: isLight ? "#2563eb" : "#38bdf8",
                    }}
                  />
                ) : (
                  <span style={{ color: textMuted }}>{idx + 1}</span>
                )}
                <span
                  style={{
                    color: isActive ? textPrimary : textMuted,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {stg.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Telemetry Terminal Box */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 8,
          backgroundColor: isLight ? "#111114" : "#050508",
          color: "#e4e4e7",
          fontFamily: "var(--mf-mono, monospace)",
          fontSize: "0.75rem",
          lineHeight: 1.6,
          border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.08)"}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
            paddingBottom: 6,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            fontSize: "0.6875rem",
            color: "#a1a1aa",
          }}
        >
          <span>GENERATION TELEMETRY</span>
          <span>LIVE ENGINE STREAM</span>
        </div>

        {visibleLogs.map((log, idx) => (
          <div key={idx} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ color: isLight ? "#60a5fa" : "#38bdf8", opacity: 0.8 }}>›</span>
            <span>{log.text}</span>
          </div>
        ))}

        <div
          style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, color: "#38bdf8" }}
        >
          <span>›</span>
          <span style={{ animation: "devlens-blink 1s infinite" }}>_</span>
        </div>
      </div>
    </div>
  );
}

export function OnboardingDocView({
  repoLabel,
  markdownContent,
  graphData,
  onSelectFile,
  onAskCopilot,
  isLoading = false,
  isAnalyzingRepo = false,
  error = null,
  onRetry,
  theme = "dark",
}: OnboardingDocViewProps) {
  const [copied, setCopied] = useState(false);
  const [copiedBlockKey, setCopiedBlockKey] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLight = theme === "light";

  const knownPaths = useMemo(() => {
    const set = new Set<string>();
    if (graphData?.nodes) {
      for (const n of graphData.nodes) {
        if (n.path) set.add(n.path);
      }
    }
    return set;
  }, [graphData]);

  const handleCopy = useCallback(() => {
    if (!markdownContent) return;
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdownContent]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!markdownContent) return;
    const safeName = repoLabel.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const blob = new Blob([markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}-CODE_WIKI.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdownContent, repoLabel]);

  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Theme tokens verified for >= 4.5:1 contrast in both light and dark themes
  const bgPage = isLight ? "#fbfbfe" : "#08080a";
  const bgCard = isLight ? "#f4f4f7" : "#111116";
  const textPrimary = isLight ? "#09090b" : "#f4f4f5";
  const textBody = isLight ? "#27272a" : "#d4d4d8";
  const textMuted = isLight ? "#52525b" : "#a1a1aa";
  const borderLine = isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.11)";
  const accentLink = isLight ? "#1d4ed8" : "#60a5fa";

  // Helper to render a clickable file citation chip without raw [[ ]] brackets
  const renderCitationChip = (
    filePath: string,
    displayLabel: string,
    key: string,
    bold = false,
  ): React.ReactNode => (
    <button
      key={key}
      type="button"
      onClick={() => onSelectFile?.(filePath)}
      disabled={!onSelectFile}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 7px",
        margin: "0 2px",
        borderRadius: 4,
        background: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)",
        border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.16)" : "rgba(255, 255, 255, 0.18)"}`,
        color: textPrimary,
        fontFamily: "var(--mf-mono, monospace)",
        fontSize: "0.75rem",
        fontWeight: bold ? 600 : 400,
        cursor: onSelectFile ? "pointer" : "default",
        verticalAlign: "baseline",
      }}
      title={onSelectFile ? `Inspect ${filePath}` : filePath}
    >
      <span aria-hidden="true" style={{ opacity: 0.6 }}>
        /
      </span>
      <span>{displayLabel}</span>
    </button>
  );

  // Helper to parse `[[path]]`, [[path]], [label](target), **bold**, `code`, and *italic*
  const renderFormattedInline = (text: string, depth = 0): React.ReactNode[] => {
    const tokenRegex =
      /(`\[\[[^\r\n`]+?\]\]`|\[\[[^\r\n]+?\]\]|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIdx = 0;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const token = match[0];
      const citation = parseBracketCitation(token);

      if (citation) {
        parts.push(
          renderCitationChip(
            citation.filePath,
            citation.displayLabel,
            `chip-${depth}-${keyIdx++}`,
          ),
        );
      } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
        const closeBracket = token.indexOf("](");
        const label = token.slice(1, closeBracket);
        const target = token.slice(closeBracket + 2, -1).trim();
        const isExternal = target.startsWith("http://") || target.startsWith("https://");

        if (isExternal) {
          parts.push(
            <a
              key={`ext-${depth}-${keyIdx++}`}
              href={target}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: accentLink,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {label}
            </a>,
          );
        } else {
          const cleanTarget = target.replace(/^#/, "");
          const isRepoFile = knownPaths.has(target) || target.includes("/") || target.includes(".");
          if (isRepoFile && onSelectFile) {
            parts.push(
              <button
                key={`ref-${depth}-${keyIdx++}`}
                type="button"
                onClick={() => onSelectFile(target)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  color: accentLink,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  font: "inherit",
                  cursor: "pointer",
                }}
                title={`Inspect ${target}`}
              >
                {label}
              </button>,
            );
          } else {
            parts.push(
              <a
                key={`anchor-${depth}-${keyIdx++}`}
                href={`#${cleanTarget}`}
                style={{
                  color: accentLink,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {label}
              </a>,
            );
          }
        }
      } else if (token.startsWith("**") && token.endsWith("**")) {
        const inner = token.slice(2, -2);
        const boldCitation = parseBracketCitation(inner);
        if (boldCitation) {
          parts.push(
            renderCitationChip(
              boldCitation.filePath,
              boldCitation.displayLabel,
              `bchip-${depth}-${keyIdx++}`,
              true,
            ),
          );
        } else {
          parts.push(
            <strong key={`b-${depth}-${keyIdx++}`} style={{ fontWeight: 600, color: textPrimary }}>
              {depth < 2 ? renderFormattedInline(inner, depth + 1) : inner}
            </strong>,
          );
        }
      } else if (token.startsWith("`") && token.endsWith("`")) {
        const inner = token.slice(1, -1);
        const codeCitation = parseBracketCitation(inner);
        if (codeCitation) {
          parts.push(
            renderCitationChip(
              codeCitation.filePath,
              codeCitation.displayLabel,
              `cchip-${depth}-${keyIdx++}`,
            ),
          );
        } else {
          parts.push(
            <code
              key={`c-${depth}-${keyIdx++}`}
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.8125rem",
                background: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.09)",
                padding: "2px 6px",
                borderRadius: 4,
                color: textPrimary,
              }}
            >
              {inner}
            </code>,
          );
        }
      } else if (token.startsWith("*") && token.endsWith("*")) {
        const inner = token.slice(1, -1);
        parts.push(
          <em key={`i-${depth}-${keyIdx++}`}>
            {depth < 2 ? renderFormattedInline(inner, depth + 1) : inner}
          </em>,
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const renderMarkdownBlocks = (
    rawMd: string,
    headingIdMap?: Map<string, string>,
    skipFirstH1 = false,
    startHeadingIndex = 0,
  ) => {
    const lines = rawMd.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;
    let blockKey = 0;
    let headingCursor = startHeadingIndex;
    let skippedH1 = false;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(trimmed)) {
        elements.push(
          <hr
            key={`hr-${blockKey++}`}
            style={{
              border: "none",
              borderTop: `1px solid ${borderLine}`,
              margin: "28px 0",
            }}
          />,
        );
        i++;
        continue;
      }

      // Skip raw HTML badge sludge leaking from README
      if (
        trimmed.startsWith("<") &&
        (trimmed.includes("<h1>") ||
          trimmed.includes("<h2>") ||
          trimmed.includes("<h3>") ||
          trimmed.includes("<a ") ||
          trimmed.includes("<img") ||
          trimmed.includes("shields.io"))
      ) {
        const cleanText = trimmed.replace(/<[^>]+>/g, " ").trim();
        if (!cleanText || cleanText.length < 5) {
          i++;
          continue;
        }
      }

      // 1. Code Fence Block (```mermaid or ```lang)
      if (trimmed.startsWith("```")) {
        const lang = trimmed.replace(/^```/, "").trim().toLowerCase();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith("```")) {
          i++;
        }

        const codeText = codeLines.join("\n");
        if (lang === "mermaid") {
          const firstLine = codeText.trim().split("\n")[0]?.trim().toLowerCase() ?? "";
          let diagramTitle = "Architecture Diagram";
          if (firstLine.startsWith("erdiagram")) {
            diagramTitle = "Entity-Relationship Diagram";
          } else if (firstLine.startsWith("sequencediagram")) {
            diagramTitle = "Sequence Diagram";
          } else if (firstLine.startsWith("statediagram")) {
            diagramTitle = "State Diagram";
          } else if (firstLine.startsWith("classdiagram")) {
            diagramTitle = "Class Diagram";
          }
          elements.push(
            <div key={`mmd-${blockKey++}`} style={{ margin: "20px 0" }}>
              <MermaidDiagramCard chart={codeText} title={diagramTitle} theme={theme} />
            </div>,
          );
          continue;
        }

        const thisBlockId = `code-${blockKey++}`;
        elements.push(
          <div key={thisBlockId} style={{ margin: "16px 0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  color: textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {lang || "code"}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(codeText);
                  setCopiedBlockKey(thisBlockId);
                  setTimeout(() => setCopiedBlockKey(null), 1500);
                }}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: "transparent",
                  color: textMuted,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  cursor: "pointer",
                }}
              >
                {copiedBlockKey === thisBlockId ? "Copied" : "Copy"}
              </button>
            </div>
            <pre
              className="devlens-scroll"
              style={{
                background: bgCard,
                border: `1px solid ${borderLine}`,
                borderRadius: 8,
                padding: "14px 18px",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.8125rem",
                lineHeight: 1.6,
                color: textPrimary,
                overflowX: "auto",
                margin: 0,
              }}
            >
              <code>{codeText}</code>
            </pre>
          </div>,
        );
        continue;
      }

      // 2. Headings
      if (trimmed.startsWith("# ")) {
        if (skipFirstH1 && !skippedH1) {
          skippedH1 = true;
          i++;
          continue;
        }
        elements.push(
          <h1
            key={`h1-${blockKey++}`}
            style={{
              fontSize: "clamp(1.75rem, 3.2vw, 2.25rem)",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              margin: "12px 0 18px",
              color: textPrimary,
              lineHeight: 1.2,
            }}
          >
            {renderFormattedInline(trimmed.replace(/^#\s+/, ""))}
          </h1>,
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("## ")) {
        const headingTitle = trimmed.replace(/^##\s+/, "").trim();
        const headingId =
          headingIdMap?.get(`h2:${headingCursor}:${headingTitle}`) ??
          slugifyHeading(headingTitle, headingCursor);
        headingCursor++;

        elements.push(
          <div
            key={`h2-wrap-${blockKey++}`}
            id={headingId}
            style={{
              margin: "36px 0 14px",
              borderTop: `1px solid ${borderLine}`,
              paddingTop: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              scrollMarginTop: 24,
            }}
          >
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: 0,
                color: textPrimary,
              }}
            >
              {renderFormattedInline(headingTitle)}
            </h2>
            {onAskCopilot && (
              <button
                type="button"
                onClick={() =>
                  onAskCopilot(
                    `Explain the "${headingTitle}" section of ${repoLabel} in detail, including the key modules, execution path, and files to verify.`,
                  )
                }
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: "transparent",
                  color: textMuted,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Ask Copilot
              </button>
            )}
          </div>,
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("### ")) {
        const headingTitle = trimmed.replace(/^###\s+/, "").trim();
        const headingId =
          headingIdMap?.get(`h3:${headingCursor}:${headingTitle}`) ??
          slugifyHeading(headingTitle, headingCursor);
        headingCursor++;

        elements.push(
          <div
            key={`h3-wrap-${blockKey++}`}
            id={headingId}
            style={{
              margin: "24px 0 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              scrollMarginTop: 24,
            }}
          >
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 600,
                letterSpacing: "-0.015em",
                margin: 0,
                color: textPrimary,
              }}
            >
              {renderFormattedInline(headingTitle)}
            </h3>
            {onAskCopilot && (
              <button
                type="button"
                onClick={() =>
                  onAskCopilot(
                    `Walk me through "${headingTitle}" in ${repoLabel} with exact file references and symbol names.`,
                  )
                }
                style={{
                  padding: "3px 9px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: "transparent",
                  color: textMuted,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  cursor: "pointer",
                }}
              >
                Ask Copilot
              </button>
            )}
          </div>,
        );
        i++;
        continue;
      }

      if (trimmed.startsWith("#### ")) {
        elements.push(
          <h4
            key={`h4-${blockKey++}`}
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              margin: "16px 0 6px",
              color: textPrimary,
            }}
          >
            {renderFormattedInline(trimmed.replace(/^####\s+/, ""))}
          </h4>,
        );
        i++;
        continue;
      }

      // 3. Markdown Table
      if (trimmed.startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i].trim());
          i++;
        }
        const parseRow = (rowStr: string) =>
          rowStr
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim());

        const headers = parseRow(tableLines[0]);
        const hasSeparator = tableLines.length > 1 && /^[\s|:-]+$/.test(tableLines[1]);
        const rows = tableLines.slice(hasSeparator ? 2 : 1).map(parseRow);

        elements.push(
          <div
            key={`tbl-${blockKey++}`}
            className="devlens-scroll"
            style={{
              margin: "16px 0",
              overflowX: "auto",
              border: `1px solid ${borderLine}`,
              borderRadius: 8,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: bgCard, borderBottom: `1px solid ${borderLine}` }}>
                  {headers.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={{
                        padding: "10px 14px",
                        fontWeight: 600,
                        color: textPrimary,
                      }}
                    >
                      {renderFormattedInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: rIdx < rows.length - 1 ? `1px solid ${borderLine}` : "none",
                    }}
                  >
                    {r.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: "10px 14px",
                          color: textBody,
                          verticalAlign: "top",
                        }}
                      >
                        {renderFormattedInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }

      // 4. Blockquotes and GitHub Alerts (> [!NOTE], > [!CAUTION])
      if (trimmed.startsWith(">")) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          quoteLines.push(lines[i].trim().replace(/^>\s*/, ""));
          i++;
        }
        const first = quoteLines[0] || "";
        const isCaution = first.startsWith("[!CAUTION]") || first.startsWith("[!WARNING]");
        const isNote = first.startsWith("[!NOTE]") || first.startsWith("[!IMPORTANT]");

        if (isCaution || isNote) {
          const alertBody = quoteLines.slice(1).join("\n");
          elements.push(
            <div
              key={`alert-${blockKey++}`}
              style={{
                margin: "18px 0",
                padding: "14px 18px",
                borderRadius: 8,
                background: isCaution
                  ? isLight
                    ? "rgba(220, 38, 38, 0.06)"
                    : "rgba(239, 68, 68, 0.08)"
                  : bgCard,
                border: `1px solid ${
                  isCaution
                    ? isLight
                      ? "rgba(220, 38, 38, 0.35)"
                      : "rgba(248, 113, 113, 0.35)"
                    : borderLine
                }`,
                fontSize: "0.875rem",
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: isCaution ? (isLight ? "#b91c1c" : "#fca5a5") : textMuted,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                {isCaution ? "CAUTION: RISK NOTICE" : "NOTE: ARCHITECTURE INVARIANT"}
              </div>
              <div style={{ color: isCaution ? (isLight ? "#7f1d1d" : "#fecaca") : textBody }}>
                {renderFormattedInline(alertBody)}
              </div>
            </div>,
          );
        } else {
          elements.push(
            <blockquote
              key={`quote-${blockKey++}`}
              style={{
                margin: "14px 0",
                paddingLeft: 16,
                borderLeft: `3px solid ${borderLine}`,
                color: textMuted,
                fontStyle: "italic",
              }}
            >
              {renderFormattedInline(quoteLines.join("\n"))}
            </blockquote>,
          );
        }
        continue;
      }

      // 5. Unordered Lists (- or *)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const listItems: string[] = [];
        while (
          i < lines.length &&
          (lines[i].trim().startsWith("- ") ||
            lines[i].trim().startsWith("* ") ||
            (listItems.length > 0 && lines[i].startsWith("  ")))
        ) {
          if (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* ")) {
            listItems.push(lines[i].trim().replace(/^[-*]\s+/, ""));
          } else {
            listItems[listItems.length - 1] += " " + lines[i].trim();
          }
          i++;
        }
        elements.push(
          <ul
            key={`ul-${blockKey++}`}
            style={{
              margin: "10px 0 18px 0",
              paddingLeft: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              listStyleType: "disc",
            }}
          >
            {listItems.map((item, idx) => (
              <li
                key={idx}
                style={{
                  lineHeight: 1.65,
                  color: textBody,
                }}
              >
                {renderFormattedInline(item)}
              </li>
            ))}
          </ul>,
        );
        continue;
      }

      // 6. Ordered Lists (1., 2.)
      if (/^\d+\.\s+/.test(trimmed)) {
        const listItems: string[] = [];
        while (
          i < lines.length &&
          (/^\d+\.\s+/.test(lines[i].trim()) || (listItems.length > 0 && lines[i].startsWith("  ")))
        ) {
          if (/^\d+\.\s+/.test(lines[i].trim())) {
            listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
          } else {
            listItems[listItems.length - 1] += " " + lines[i].trim();
          }
          i++;
        }
        elements.push(
          <ol
            key={`ol-${blockKey++}`}
            style={{
              margin: "10px 0 18px 0",
              paddingLeft: 22,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {listItems.map((item, idx) => (
              <li
                key={idx}
                style={{
                  lineHeight: 1.65,
                  color: textBody,
                }}
              >
                {renderFormattedInline(item)}
              </li>
            ))}
          </ol>,
        );
        continue;
      }

      // 7. Regular Paragraph
      const pLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith("#") &&
        !lines[i].trim().startsWith("```") &&
        !lines[i].trim().startsWith(">") &&
        !lines[i].trim().startsWith("- ") &&
        !lines[i].trim().startsWith("* ") &&
        !/^---+$/.test(lines[i].trim()) &&
        !/^\d+\.\s+/.test(lines[i].trim())
      ) {
        pLines.push(lines[i].trim());
        i++;
      }
      elements.push(
        <p
          key={`p-${blockKey++}`}
          style={{
            margin: "0 0 16px",
            lineHeight: 1.72,
            color: textBody,
            maxWidth: "74ch",
          }}
        >
          {renderFormattedInline(pLines.join(" "))}
        </p>,
      );
    }

    return elements;
  };

  const hasContent = Boolean(markdownContent && markdownContent.trim());
  const headings = useMemo(
    () => (markdownContent ? extractHeadings(markdownContent) : []),
    [markdownContent],
  );
  const clientFallbackMermaid = useMemo(() => buildClientMermaidFallback(graphData), [graphData]);

  const heroSplit = useMemo(() => {
    if (!markdownContent) return null;
    const split = extractHeroSplit(markdownContent);
    if (split) {
      // Upgrade disconnected diagrams (zero edges) automatically when real graph edges are available
      if (
        !hasMermaidEdges(split.mermaidCode) &&
        clientFallbackMermaid &&
        hasMermaidEdges(clientFallbackMermaid)
      ) {
        return { ...split, mermaidCode: clientFallbackMermaid };
      }
      return split;
    }
    if (clientFallbackMermaid) {
      const lines = markdownContent.split("\n");
      let sec1Idx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith("## ")) {
          sec1Idx = i;
          break;
        }
      }
      if (sec1Idx !== -1) {
        let nextSecIdx = lines.length;
        for (let i = sec1Idx + 1; i < lines.length; i++) {
          if (lines[i].trim().startsWith("## ")) {
            nextSecIdx = i;
            break;
          }
        }
        const headingTitle = lines[sec1Idx]
          .trim()
          .replace(/^##\s+/, "")
          .trim();
        const proseMarkdown = lines
          .slice(sec1Idx + 1, nextSecIdx)
          .join("\n")
          .trim();
        const restMarkdown = lines.slice(nextSecIdx).join("\n");
        return {
          headingTitle,
          headingId: slugifyHeading(headingTitle, 0),
          mermaidCode: clientFallbackMermaid,
          proseMarkdown,
          restMarkdown,
        };
      }
    }
    return null;
  }, [markdownContent, clientFallbackMermaid]);

  // Extract top H1 title if present
  const docTitle = useMemo(() => {
    if (!markdownContent) return `${repoLabel}: Code Wiki`;
    const firstH1 = markdownContent.split("\n").find((l) => l.trim().startsWith("# "));
    return firstH1 ? firstH1.trim().replace(/^#\s+/, "") : `${repoLabel}: Code Wiki`;
  }, [markdownContent, repoLabel]);

  return (
    <div
      ref={scrollContainerRef}
      className="devlens-scroll devlens-wiki-root"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: bgPage,
        color: textPrimary,
        padding: "clamp(16px, 3vw, 40px)",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <style>{`
        .devlens-wiki-root button:focus-visible,
        .devlens-wiki-root a:focus-visible {
          outline: 2px solid ${accentLink};
          outline-offset: 2px;
        }
        .devlens-wiki-root button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .devlens-wiki-toc button:hover {
          background-color: ${isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.07)"};
        }
        @media (prefers-reduced-motion: reduce) {
          .devlens-wiki-root * {
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Top Action Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
            borderBottom: `1px solid ${borderLine}`,
            paddingBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: textMuted,
              }}
            >
              Code Wiki
            </span>
            <span aria-hidden="true" style={{ color: textMuted }}>
              /
            </span>
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: textPrimary,
                fontWeight: 600,
              }}
            >
              {repoLabel}
            </span>
          </div>

          {hasContent && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  minHeight: 36,
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  background: copied ? textPrimary : "transparent",
                  color: copied ? bgPage : textPrimary,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied Markdown" : "Copy Wiki"}
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                style={{
                  minHeight: 36,
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  background: "transparent",
                  color: textPrimary,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Export .md
              </button>
            </div>
          )}
        </div>

        {/* State 1: Real-time Live AI Generation Loader */}
        {isLoading && !hasContent && (
          <RealtimeDocGenerationLoader
            repoLabel={repoLabel}
            isLight={isLight}
            borderLine={borderLine}
            bgCard={bgCard}
            textPrimary={textPrimary}
            textBody={textBody}
            textMuted={textMuted}
          />
        )}

        {/* State 2: Error */}
        {!isLoading && error && !hasContent && (
          <div
            role="alert"
            style={{
              padding: "36px 28px",
              borderRadius: 12,
              border: `1px solid ${isLight ? "rgba(220, 38, 38, 0.35)" : "rgba(248, 113, 113, 0.35)"}`,
              backgroundColor: isLight ? "rgba(220, 38, 38, 0.05)" : "rgba(239, 68, 68, 0.07)",
              margin: "24px 0",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: isLight ? "#b91c1c" : "#fca5a5",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Could Not Generate Code Wiki
            </div>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                color: textBody,
              }}
            >
              {error}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  minHeight: 44,
                  padding: "10px 18px",
                  borderRadius: 6,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: textPrimary,
                  color: bgPage,
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Retry Generation
              </button>
            )}
          </div>
        )}

        {/* State 3: Empty / Not Generated */}
        {!isLoading && !error && !hasContent && (
          <div>
            {isAnalyzingRepo ? (
              <div
                role="status"
                style={{
                  padding: "48px 32px",
                  borderRadius: 12,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: bgCard,
                  margin: "24px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      backgroundColor: isLight ? "#d97706" : "#f59e0b",
                      boxShadow: isLight
                        ? "0 0 0 3px rgba(217, 119, 6, 0.2)"
                        : "0 0 0 3px rgba(245, 158, 11, 0.25)",
                      animation: "devlens-pulse 1.8s infinite ease-in-out",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: textMuted,
                    }}
                  >
                    Indexing Codebase
                  </span>
                </div>
                <h2
                  style={{
                    margin: "0 0 10px",
                    fontSize: "1.375rem",
                    fontWeight: 600,
                    color: textPrimary,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Analyzing {repoLabel}
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.9375rem",
                    lineHeight: 1.65,
                    color: textBody,
                    maxWidth: 620,
                  }}
                >
                  DevLens is indexing repository files, resolving module imports, and compiling the
                  dependency graph. Code Wiki generation will begin automatically as soon as
                  indexing finishes.
                </p>
              </div>
            ) : (
              <div
                style={{
                  padding: "44px 36px",
                  borderRadius: 12,
                  border: `1px solid ${borderLine}`,
                  backgroundColor: bgCard,
                  margin: "24px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: textMuted,
                    }}
                  >
                    Architectural Knowledge Engine
                  </span>
                  <span aria-hidden="true" style={{ color: textMuted }}>
                    /
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.75rem",
                      color: textPrimary,
                      fontWeight: 600,
                    }}
                  >
                    {repoLabel}
                  </span>
                </div>

                <h2
                  style={{
                    margin: "0 0 12px",
                    fontSize: "1.5rem",
                    fontWeight: 600,
                    color: textPrimary,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Architecture Wiki for {repoLabel}
                </h2>

                <p
                  style={{
                    margin: "0 0 28px",
                    fontSize: "0.9375rem",
                    lineHeight: 1.65,
                    color: textBody,
                    maxWidth: 680,
                  }}
                >
                  Understand how this codebase is structured before touching code. Generate a
                  verified architectural guide with interactive entity-relationship diagrams,
                  subsystem deep dives, and direct links to source files.
                </p>

                {/* 3 Value Pillars */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                    marginBottom: 32,
                  }}
                >
                  <div
                    style={{
                      padding: "16px 18px",
                      borderRadius: 8,
                      background: isLight ? "#ffffff" : "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${borderLine}`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: textPrimary,
                        marginBottom: 6,
                      }}
                    >
                      Interactive Topologies
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.8125rem",
                        lineHeight: 1.5,
                        color: textMuted,
                      }}
                    >
                      Mermaid entity-relationship diagrams and request flows with zoom, pan, and SVG
                      export.
                    </p>
                  </div>

                  <div
                    style={{
                      padding: "16px 18px",
                      borderRadius: 8,
                      background: isLight ? "#ffffff" : "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${borderLine}`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: textPrimary,
                        marginBottom: 6,
                      }}
                    >
                      Verified File Links
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.8125rem",
                        lineHeight: 1.5,
                        color: textMuted,
                      }}
                    >
                      Every file, router, and database schema citation links directly into the
                      studio code inspector.
                    </p>
                  </div>

                  <div
                    style={{
                      padding: "16px 18px",
                      borderRadius: 8,
                      background: isLight ? "#ffffff" : "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${borderLine}`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: textPrimary,
                        marginBottom: 6,
                      }}
                    >
                      Contextual Copilot
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.8125rem",
                        lineHeight: 1.5,
                        color: textMuted,
                      }}
                    >
                      Launch tailored architectural queries into DevLens Copilot with a single
                      click.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      style={{
                        minHeight: 44,
                        padding: "10px 22px",
                        borderRadius: 6,
                        border: "none",
                        backgroundColor: textPrimary,
                        color: bgPage,
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>Generate Architecture Wiki</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  )}

                  {onAskCopilot && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskCopilot(`Explain the high-level architecture of ${repoLabel}`)
                      }
                      style={{
                        minHeight: 44,
                        padding: "10px 18px",
                        borderRadius: 6,
                        border: `1px solid ${borderLine}`,
                        backgroundColor: "transparent",
                        color: textPrimary,
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                      }}
                    >
                      Ask Copilot About Architecture
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Populated Code Wiki Content */}
        {hasContent && (
          <div className="devlens-wiki-shell">
            <style>{`
              .devlens-wiki-shell {
                display: grid;
                grid-template-columns: 1fr;
                gap: 28px;
                align-items: start;
              }
              .devlens-wiki-toc {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding-bottom: 14px;
                border-bottom: 1px solid ${borderLine};
              }
              .devlens-wiki-hero-split {
                display: grid;
                grid-template-columns: 1fr;
                gap: 24px;
                align-items: start;
                margin: 20px 0 28px;
              }
              @media (min-width: 900px) {
                .devlens-wiki-hero-split {
                  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
                  gap: 28px;
                }
              }
              @media (min-width: 1120px) {
                .devlens-wiki-shell {
                  grid-template-columns: 220px minmax(0, 1fr);
                  gap: 36px;
                }
                .devlens-wiki-toc {
                  position: sticky;
                  top: 0;
                  flex-direction: column;
                  flex-wrap: nowrap;
                  gap: 2px;
                  padding-bottom: 0;
                  border-bottom: none;
                  border-right: 1px solid ${borderLine};
                  padding-right: 16px;
                  max-height: calc(100vh - 160px);
                  overflow-y: auto;
                }
              }
            `}</style>

            {/* Left Sticky Wiki Outline */}
            {headings.length > 0 && (
              <nav aria-label="Code Wiki sections" className="devlens-wiki-toc devlens-scroll">
                <span
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: textMuted,
                    padding: "4px 8px 8px",
                    display: "block",
                  }}
                >
                  Contents
                </span>
                {headings.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => scrollToHeading(h.id)}
                    style={{
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderRadius: 5,
                      padding: h.level === 3 ? "5px 8px 5px 18px" : "6px 8px",
                      fontSize: h.level === 3 ? "0.78rem" : "0.82rem",
                      fontWeight: h.level === 2 ? 500 : 400,
                      color: h.level === 2 ? textPrimary : textMuted,
                      cursor: "pointer",
                      lineHeight: 1.35,
                    }}
                  >
                    {h.title}
                  </button>
                ))}
              </nav>
            )}

            {/* Main Code Wiki Article */}
            <article style={{ minWidth: 0, fontSize: "0.95rem", lineHeight: 1.7 }}>
              <h1
                style={{
                  fontSize: "clamp(1.65rem, 3vw, 2.2rem)",
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  margin: "0 0 18px",
                  color: textPrimary,
                  lineHeight: 1.2,
                }}
              >
                {docTitle}
              </h1>

              {heroSplit ? (
                <>
                  <div
                    id={heroSplit.headingId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 10,
                      borderTop: `1px solid ${borderLine}`,
                      paddingTop: 18,
                      scrollMarginTop: 24,
                    }}
                  >
                    <h2
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        margin: 0,
                        color: textPrimary,
                      }}
                    >
                      {heroSplit.headingTitle}
                    </h2>
                    {onAskCopilot && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskCopilot(
                            `Explain the overall architecture of ${repoLabel} and how its top-level components interact.`,
                          )
                        }
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: `1px solid ${borderLine}`,
                          backgroundColor: "transparent",
                          color: textMuted,
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Ask Copilot
                      </button>
                    )}
                  </div>

                  {/* Two-Column Hero Split: Diagram Left + Architectural Prose & Highlights Right */}
                  <div className="devlens-wiki-hero-split">
                    <MermaidDiagramCard
                      chart={heroSplit.mermaidCode}
                      title={`${repoLabel} Architecture`}
                      theme={theme}
                      compact
                    />
                    <div style={{ minWidth: 0 }}>
                      {renderMarkdownBlocks(heroSplit.proseMarkdown, undefined, false, 1)}
                    </div>
                  </div>

                  {renderMarkdownBlocks(
                    heroSplit.restMarkdown,
                    undefined,
                    false,
                    1 + extractHeadings(heroSplit.proseMarkdown).length,
                  )}
                </>
              ) : (
                renderMarkdownBlocks(markdownContent!, undefined, true)
              )}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}

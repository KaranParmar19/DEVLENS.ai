import { useState, useEffect, useCallback } from "react";
import type { GraphData } from "./studio-types";

interface CodeFlowStepperProps {
  graphData?: GraphData | null;
  onAskCopilot: (prompt: string) => void;
  onSelectFile?: (filePath: string) => void;
}

interface FlowStep {
  id: string;
  stepNumber: string;
  stage: string;
  file: string;
  symbol: string;
  inputContract: string;
  outputContract: string;
  description: string;
  failureRisk: string;
}

interface FlowCategory {
  id: string;
  title: string;
  steps: FlowStep[];
}

const FLOWS: FlowCategory[] = [
  {
    id: "ingestion",
    title: "Repository AST Ingestion",
    steps: [
      {
        id: "ingest-1",
        stepNumber: "01",
        stage: "Ingress Handshake & Worktree Clone",
        file: "backend/app/core/github_client.py",
        symbol: "clone_repository(repo_url, depth=1)",
        inputContract: "{ repo_url: string, branch?: string }",
        outputContract: "WorktreeDir { path: string, commit_sha: string }",
        description: "Clones repository worktree into an isolated ephemeral volume using a shallow depth-1 git fetch.",
        failureRisk: "Git rate limiting or 401 Bad Credentials if private token is invalid.",
      },
      {
        id: "ingest-2",
        stepNumber: "02",
        stage: "Abstract Syntax Tree Parsing",
        file: "backend/app/core/chunker.py",
        symbol: "parse_ast_symbols(file_path: Path)",
        inputContract: "RawFileContentBuffer",
        outputContract: "ASTSymbolTable { classes, functions, imports }",
        description: "Iterates through source files using Tree-sitter AST queries to extract function declarations, classes, and import statements.",
        failureRisk: "Parser crash on non-standard syntax extensions (e.g. JSX pragmas).",
      },
      {
        id: "ingest-3",
        stepNumber: "03",
        stage: "Dependency DAG Resolution",
        file: "backend/app/core/graph_builder.py",
        symbol: "construct_directed_graph(symbols)",
        inputContract: "Array<ASTSymbolTable>",
        outputContract: "NetworkX.DiGraph { nodes: 420, edges: 1120 }",
        description: "Maps import statements to resolved relative files, constructing a directed acyclic graph (DAG) of the entire module topology.",
        failureRisk: "Circular import loops will cause infinite topological sort cycles without cycle guards.",
      },
      {
        id: "ingest-4",
        stepNumber: "04",
        stage: "pgvector Embedding Generation",
        file: "backend/app/rag/vector_store.py",
        symbol: "generate_and_store_embeddings(chunks)",
        inputContract: "Array<CodeChunk { content, metadata }>",
        outputContract: "HNSW_Index_Commit { chunks_indexed: 1840 }",
        description: "Batches AST chunks into OpenAI text-embedding-3-small and commits vectors to Postgres pgvector table with cosine index.",
        failureRisk: "OpenAI rate limit quota (TPM) exceeded if chunking produces excessive token volumes.",
      },
    ],
  },
  {
    id: "auth",
    title: "GitHub OAuth Handshake",
    steps: [
      {
        id: "auth-1",
        stepNumber: "01",
        stage: "OAuth Initiation & State Generation",
        file: "backend/app/api/routes/auth.py",
        symbol: "get_github_login_url()",
        inputContract: "void",
        outputContract: "RedirectResponse { state: string, url: string }",
        description: "Generates an anti-CSRF state token and redirects browser to GitHub OAuth authorization portal.",
        failureRisk: "CSRF state replay if cookie expiration policy is misconfigured.",
      },
      {
        id: "auth-2",
        stepNumber: "02",
        stage: "Code Exchange & Token Grant",
        file: "backend/app/api/routes/auth.py",
        symbol: "github_oauth_callback(code, state)",
        inputContract: "{ code: string, state: string }",
        outputContract: "OAuthTokenPayload { access_token, scope }",
        description: "Exchanges single-use authorization code with GitHub API for an access token scoped to repository read permissions.",
        failureRisk: "Expired code or network timeout communicating with api.github.com.",
      },
      {
        id: "auth-3",
        stepNumber: "03",
        stage: "Session Storage & Key Derivation",
        file: "backend/app/database.py",
        symbol: "upsert_user_session(github_id, token)",
        inputContract: "{ github_id: string, access_token: string }",
        outputContract: "UserSession { api_key: string, user_id: UUID }",
        description: "Encrypts token at rest and provisions an ephemeral session API key returned to client in secure cookie.",
        failureRisk: "PostgreSQL transaction deadlock during concurrent callback bursts.",
      },
    ],
  },
  {
    id: "rag",
    title: "Q&A Vector Retrieval & Synthesis",
    steps: [
      {
        id: "rag-1",
        stepNumber: "01",
        stage: "Natural Language Query Embedding",
        file: "backend/app/rag/retriever.py",
        symbol: "embed_query_string(question: str)",
        inputContract: "Question: 'What breaks if I modify router.ts?'",
        outputContract: "Vector: Float32Array(1536)",
        description: "Normalizes developer prompt and converts semantic intent into a 1536-dimensional embedding vector.",
        failureRisk: "Embedding model downtime or latency spikes.",
      },
      {
        id: "rag-2",
        stepNumber: "02",
        stage: "HNSW Vector Cosine Distance Query",
        file: "backend/app/rag/vector_store.py",
        symbol: "similarity_search(query_vec, top_k=6)",
        inputContract: "QueryVector + SessionId",
        outputContract: "Array<RetrievedChunk { file, score, content }>",
        description: "Executes cosine distance search `<=>` in pgvector indexed table to find highest-scoring AST code chunks.",
        failureRisk: "Low recall if chunks are too granular or stripped of function signatures.",
      },
      {
        id: "rag-3",
        stepNumber: "03",
        stage: "LangChain ReAct Agent Reasoning",
        file: "backend/app/agent/devlens_agent.py",
        symbol: "synthesize_answer(context, question)",
        inputContract: "RetrievedChunks + GraphTopologyMeta",
        outputContract: "StreamingTokenBuffer",
        description: "Constructs prompt context with file citations, calculates blast radius, and streams response over WebSocket.",
        failureRisk: "LLM hallucination if prompt does not enforce strict source citation constraints.",
      },
    ],
  },
];

export function CodeFlowStepper({ onAskCopilot, onSelectFile }: CodeFlowStepperProps) {
  const [activeFlowId, setActiveFlowId] = useState("ingestion");
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  const currentFlow = FLOWS.find((f) => f.id === activeFlowId) ?? FLOWS[0];
  const current = currentFlow.steps[activeStepIdx] ?? currentFlow.steps[0];

  const nextStep = useCallback(() => {
    setActiveStepIdx((i) => Math.min(i + 1, currentFlow.steps.length - 1));
  }, [currentFlow]);

  const prevStep = useCallback(() => {
    setActiveStepIdx((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextStep();
      if (e.key === "ArrowLeft") prevStep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextStep, prevStep]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#08080a",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(24px, 4vw, 48px)",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        overflowY: "auto",
      }}
    >
      {/* Top Header & Flow Category Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255, 255, 255, 0.45)",
            }}
          >
            Trace Execution Engine
          </span>
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 500, letterSpacing: "-0.03em", margin: "6px 0 0" }}>
            Runtime Request Flow
          </h2>
        </div>

        {/* Flow Switcher Pills */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 999,
            padding: 4,
          }}
        >
          {FLOWS.map((flow) => {
            const isActive = flow.id === activeFlowId;
            return (
              <button
                key={flow.id}
                type="button"
                onClick={() => {
                  setActiveFlowId(flow.id);
                  setActiveStepIdx(0);
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "none",
                  background: isActive ? "#ffffff" : "transparent",
                  color: isActive ? "#000000" : "rgba(255, 255, 255, 0.65)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {flow.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stepper Navigation Strip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)" }}>
          Hop {activeStepIdx + 1} of {currentFlow.steps.length} // {current.stage}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={prevStep}
            disabled={activeStepIdx === 0}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "transparent",
              color: activeStepIdx === 0 ? "rgba(255, 255, 255, 0.2)" : "#ffffff",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              cursor: activeStepIdx === 0 ? "not-allowed" : "pointer",
            }}
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={activeStepIdx === currentFlow.steps.length - 1}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: activeStepIdx === currentFlow.steps.length - 1 ? "transparent" : "#ffffff",
              color: activeStepIdx === currentFlow.steps.length - 1 ? "rgba(255, 255, 255, 0.2)" : "#000000",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              fontWeight: 500,
              cursor: activeStepIdx === currentFlow.steps.length - 1 ? "not-allowed" : "pointer",
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Flow Timeline Track */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${currentFlow.steps.length}, 1fr)`,
          gap: 12,
          marginBottom: 36,
        }}
      >
        {currentFlow.steps.map((s, idx) => {
          const isActive = idx === activeStepIdx;
          const isPassed = idx < activeStepIdx;
          return (
            <div
              key={s.id}
              onClick={() => setActiveStepIdx(idx)}
              style={{
                cursor: "pointer",
                padding: "12px",
                borderRadius: 10,
                border: "1px solid",
                borderColor: isActive ? "#ffffff" : isPassed ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                background: isActive ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.02)",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.6875rem", color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.4)" }}>
                  {s.stepNumber}
                </span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: isActive ? "#ffffff" : isPassed ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.15)",
                  }}
                />
              </div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.stage}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Step Detailed Card */}
      <div
        style={{
          background: "#111114",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: 16,
          padding: "clamp(24px, 4vw, 36px)",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          maxWidth: 960,
        }}
      >
        <div>
          <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)" }}>
            STAGE {current.stepNumber} // EXECUTION HOP
          </span>
          <h3 style={{ fontSize: "1.75rem", fontWeight: 500, margin: "8px 0 12px", letterSpacing: "-0.03em" }}>
            {current.stage}
          </h3>
          <p style={{ fontSize: "0.9375rem", lineHeight: 1.6, color: "rgba(255, 255, 255, 0.8)", margin: 0 }}>
            {current.description}
          </p>
        </div>

        {/* Function & File Signature Box */}
        <div
          style={{
            background: "#08080a",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 10,
            padding: "16px 20px",
          }}
        >
          <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.6875rem", color: "rgba(255, 255, 255, 0.4)", marginBottom: 6 }}>
            INVOCATION TARGET
          </div>
          <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.875rem", color: "#ffffff", marginBottom: 6 }}>
            {current.symbol}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)" }}>file:</span>
            {onSelectFile ? (
              <button
                type="button"
                onClick={() => onSelectFile(current.file)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  color: "#ffffff",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
                title="View in Architecture Canvas"
              >
                <span>{current.file}</span>
                <span style={{ fontSize: "0.625rem", opacity: 0.6 }}>↗</span>
              </button>
            ) : (
              <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "#ffffff" }}>{current.file}</span>
            )}
          </div>
        </div>

        {/* Input / Output Contracts Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.625rem", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
              INBOUND DATA CONTRACT
            </div>
            <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "#ffffff" }}>
              {current.inputContract}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.625rem", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
              OUTBOUND RESULT CONTRACT
            </div>
            <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "#ffffff" }}>
              {current.outputContract}
            </div>
          </div>
        </div>

        {/* Failure Impact Alert */}
        <div style={{ borderLeft: "2px solid #ffffff", paddingLeft: 16 }}>
          <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.6875rem", textTransform: "uppercase", color: "rgba(255, 255, 255, 0.5)", marginBottom: 4 }}>
            Failure Consequence & Blast Radius
          </div>
          <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.5 }}>
            {current.failureRisk}
          </div>
        </div>

        {/* Ask Copilot action */}
        <div>
          <button
            type="button"
            onClick={() => onAskCopilot(`Explain the execution flow hop "${current.stage}" at ${current.file} in detail.`)}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid #ffffff",
              background: "#ffffff",
              color: "#000000",
              fontFamily: "var(--mf-font, 'Geist', sans-serif)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Ask Copilot to deep-dive this hop ↗
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import type { GraphNode } from "./studio-types";

export interface FunctionSymbol {
  name: string;
  signature: string;
  kind: "function" | "method" | "class" | "interface" | "constant";
  returnType: string;
  parameters: { name: string; type: string }[];
  complexityScore: "low" | "moderate" | "high";
  lineRange: string;
  docstring?: string;
  isExported: boolean;
}

interface CodeViewerDrawerProps {
  node: GraphNode | null;
  incomingNodes?: GraphNode[];
  outgoingNodes?: GraphNode[];
  onSelectNode?: (nodeId: string, path: string) => void;
  onClose: () => void;
  onSimulateBlastRadius: (nodeId: string) => void;
  onAskCopilot: (prompt: string) => void;
}

// Realistic source code samples for primary modules
const CODE_SAMPLES: Record<
  string,
  {
    code: string;
    exports: string[];
    imports: string[];
    risk: string;
    symbols: FunctionSymbol[];
  }
> = {
  "src/App.tsx": {
    code: `import React, { useEffect, useState } from "react";
import { AppRouter } from "./router/Router";
import { useAuthStore } from "./store/Store";
import { initApiClient } from "./lib/ApiClient";

export function App() {
  const [ready, setReady] = useState(false);
  const { sessionToken, checkSession } = useAuthStore();

  useEffect(() => {
    initApiClient({ token: sessionToken });
    checkSession().finally(() => setReady(true));
  }, [sessionToken]);

  if (!ready) return <div className="loading-splash">Initializing Runtime...</div>;

  return (
    <div className="app-viewport">
      <AppRouter />
    </div>
  );
}`,
    exports: ["App()"],
    imports: ["AppRouter", "useAuthStore", "initApiClient"],
    risk: "Root application entry. Any state invalidation here forces a full React subtree remount.",
    symbols: [
      {
        name: "App",
        signature: "App(): JSX.Element",
        kind: "function",
        returnType: "JSX.Element",
        parameters: [],
        complexityScore: "low",
        lineRange: "L19-L35",
        docstring: "Root application component. Handles session hydration and router mount.",
        isExported: true,
      },
    ],
  },
  "src/router/Router.tsx": {
    code: `import { createRouter, Route } from "@tanstack/react-router";
import { AuthService } from "../services/AuthService";
import { ApiClient } from "../lib/ApiClient";

export const routes = [
  { path: "/", element: <LandingPage /> },
  { path: "/dashboard", element: <DashboardPage />, guard: AuthService.isAuthenticated },
  { path: "/repo/:id", element: <WorkspaceStudio />, loader: ApiClient.fetchGraph },
];

export function AppRouter() {
  return <Router routes={routes} />;
}`,
    exports: ["AppRouter", "routes"],
    imports: ["AuthService", "ApiClient"],
    risk: "Routing layer. Modifying route guards affects session protection across 8 downstream views.",
    symbols: [
      {
        name: "AppRouter",
        signature: "AppRouter(): JSX.Element",
        kind: "function",
        returnType: "JSX.Element",
        parameters: [],
        complexityScore: "low",
        lineRange: "L51-L53",
        docstring: "Declares top-level URL routes and authentication gatekeeper guards.",
        isExported: true,
      },
      {
        name: "routes",
        signature: "const routes: RouteConfig[]",
        kind: "constant",
        returnType: "RouteConfig[]",
        parameters: [],
        complexityScore: "low",
        lineRange: "L45-L49",
        docstring: "Route table defining path-to-component mappings and auth guards.",
        isExported: true,
      },
    ],
  },
  "src/services/AuthService.ts": {
    code: `import { ApiClient } from "../lib/ApiClient";
import { useAuthStore } from "../store/Store";

export class AuthService {
  /**
   * Exchanges an OAuth callback code for a verified session API token.
   * Commits the session to the client store on success.
   */
  static async authenticate(code: string): Promise<string> {
    const res = await ApiClient.post<{ token: string }>("/auth/github/callback", { code });
    if (!res.ok) throw new Error("OAuth Handshake Failed");
    
    useAuthStore.getState().setSession(res.token);
    return res.token;
  }

  /**
   * Verifies if the local runtime holds a non-expired session token.
   */
  static isAuthenticated(): boolean {
    return Boolean(useAuthStore.getState().sessionToken);
  }

  /**
   * Revokes the active session and clears the localStorage token.
   */
  static logout(): void {
    useAuthStore.getState().clearSession();
  }
}`,
    exports: ["AuthService.authenticate()", "AuthService.isAuthenticated()", "AuthService.logout()"],
    imports: ["ApiClient", "useAuthStore"],
    risk: "Security perimeter. 14 consumer paths depend on this authentication token contract.",
    symbols: [
      {
        name: "AuthService.authenticate",
        signature: "static async authenticate(code: string): Promise<string>",
        kind: "method",
        returnType: "Promise<string>",
        parameters: [{ name: "code", type: "string" }],
        complexityScore: "moderate",
        lineRange: "L63-L69",
        docstring: "Exchanges OAuth code with FastAPI server, validates GitHub signature, and stores session API key.",
        isExported: true,
      },
      {
        name: "AuthService.isAuthenticated",
        signature: "static isAuthenticated(): boolean",
        kind: "method",
        returnType: "boolean",
        parameters: [],
        complexityScore: "low",
        lineRange: "L71-L73",
        docstring: "Checks presence of valid session token in global state.",
        isExported: true,
      },
      {
        name: "AuthService.logout",
        signature: "static logout(): void",
        kind: "method",
        returnType: "void",
        parameters: [],
        complexityScore: "low",
        lineRange: "L75-L77",
        docstring: "Clears session credentials and invalidates client state.",
        isExported: true,
      },
    ],
  },
  "src/lib/ApiClient.ts": {
    code: `export class ApiClient {
  private static baseUrl = process.env.VITE_API_URL || "http://localhost:8000";
  private static token: string | null = null;

  static setToken(token: string) {
    this.token = token;
  }

  static async get<T>(path: string): Promise<T> {
    const res = await fetch(\`\${this.baseUrl}\${path}\`, {
      headers: {
        Authorization: this.token ? \`Bearer \${this.token}\` : "",
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
    return res.json();
  }

  static async post<T>(path: string, payload: unknown): Promise<T> {
    const res = await fetch(\`\${this.baseUrl}\${path}\`, {
      method: "POST",
      headers: {
        Authorization: this.token ? \`Bearer \${this.token}\` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
    return res.json();
  }
}`,
    exports: ["ApiClient.setToken()", "ApiClient.get()", "ApiClient.post()"],
    imports: [],
    risk: "Transport backbone. Any changes to error handling propagate to every data hook in the system.",
    symbols: [
      {
        name: "ApiClient.get",
        signature: "static async get<T>(path: string): Promise<T>",
        kind: "method",
        returnType: "Promise<T>",
        parameters: [{ name: "path", type: "string" }],
        complexityScore: "low",
        lineRange: "L88-L97",
        docstring: "Dispatches authenticated HTTP GET with session token header.",
        isExported: true,
      },
      {
        name: "ApiClient.post",
        signature: "static async post<T>(path: string, payload: unknown): Promise<T>",
        kind: "method",
        returnType: "Promise<T>",
        parameters: [
          { name: "path", type: "string" },
          { name: "payload", type: "unknown" },
        ],
        complexityScore: "moderate",
        lineRange: "L99-L111",
        docstring: "Dispatches authenticated HTTP POST with JSON body serialization.",
        isExported: true,
      },
    ],
  },
  "src/store/Store.ts": {
    code: `import { create } from "zustand";

interface AuthState {
  sessionToken: string | null;
  setSession: (token: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  sessionToken: null,
  setSession: (token) => set({ sessionToken: token }),
  clearSession: () => set({ sessionToken: null }),
}));`,
    exports: ["useAuthStore"],
    imports: ["zustand"],
    risk: "Centralized client memory. Holds session tokens and user state.",
    symbols: [
      {
        name: "useAuthStore",
        signature: "const useAuthStore: UseBoundStore<StoreApi<AuthState>>",
        kind: "constant",
        returnType: "AuthState",
        parameters: [],
        complexityScore: "low",
        lineRange: "L9-L13",
        docstring: "Reactive Zustand store for session persistence.",
        isExported: true,
      },
    ],
  },
  "src/db/Database.ts": {
    code: `import { Pool } from "pg";

export class DatabasePool {
  private static pool: Pool;

  static init(connectionString: string): void {
    this.pool = new Pool({ connectionString, max: 20 });
  }

  static async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(sql, params);
      return res.rows;
    } finally {
      client.release();
    }
  }
}`,
    exports: ["DatabasePool.init()", "DatabasePool.query()"],
    imports: ["pg"],
    risk: "Data persistence foundation. SQL query regressions risk connection leaks and query timeouts.",
    symbols: [
      {
        name: "DatabasePool.query",
        signature: "static async query<T>(sql: string, params?: any[]): Promise<T[]>",
        kind: "method",
        returnType: "Promise<T[]>",
        parameters: [
          { name: "sql", type: "string" },
          { name: "params", type: "any[]" },
        ],
        complexityScore: "moderate",
        lineRange: "L10-L18",
        docstring: "Executes parameterized PostgreSQL query with connection pool lifecycle management.",
        isExported: true,
      },
    ],
  },
};

export function CodeViewerDrawer({
  node,
  incomingNodes = [],
  outgoingNodes = [],
  onSelectNode,
  onClose,
  onSimulateBlastRadius,
  onAskCopilot,
}: CodeViewerDrawerProps) {
  const [activeTab, setActiveTab] = useState<"symbols" | "code" | "topology">("symbols");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedSymbolName, setSelectedSymbolName] = useState<string | null>(null);

  // Fallback sample generator if node is not explicitly in CODE_SAMPLES
  const sample = useMemo(() => {
    if (!node) return null;
    if (CODE_SAMPLES[node.path]) return CODE_SAMPLES[node.path];

    const baseName = node.label.replace(/\.[^/.]+$/, "");
    const isPy = node.language === "Python" || node.path.endsWith(".py");
    const isTs = node.language === "TypeScript" || node.path.endsWith(".ts") || node.path.endsWith(".tsx");

    const code = isPy
      ? `"""
DevLens AI Module — ${node.path}
LOC: ${node.line_count ?? 160} | Complexity: ${node.complexity ?? 14}
"""

from typing import Any, Optional
import structlog

logger = structlog.get_logger(__name__)


class ${baseName}Service:
    """Core domain logic for ${baseName}."""

    def __init__(self, config: Optional[dict[str, Any]] = None):
        self.config = config or {}

    async def execute_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Dispatches ${baseName} execution and emits metrics."""
        logger.info("${baseName.toLowerCase()}_executed", status="success")
        return {"status": "ok", "target": "${node.label}"}

    def validate_inputs(self, payload: dict[str, Any]) -> bool:
        """Validates contract invariants."""
        return bool(payload.get("id"))
`
      : `/**
 * DevLens AI Module — ${node.path}
 * Lines: ${node.line_count ?? 140} | Complexity: ${node.complexity ?? 12}
 */

export interface ${baseName}Config {
  endpoint: string;
  timeoutMs: number;
}

export class ${baseName}Controller {
  private config: ${baseName}Config;

  constructor(config: ${baseName}Config) {
    this.config = config;
  }

  public async handleRequest(requestId: string): Promise<{ success: boolean }> {
    console.log("Handling ${baseName} request:", requestId);
    return { success: true };
  }

  public validateInvariant(): boolean {
    return Boolean(this.config.endpoint);
  }
}
`;

    const symbols: FunctionSymbol[] = [
      {
        name: isPy ? `${baseName}Service.execute_task` : `${baseName}Controller.handleRequest`,
        signature: isPy
          ? `async def execute_task(self, payload: dict) -> dict`
          : `public async handleRequest(requestId: string): Promise<{ success: boolean }>`,
        kind: "method",
        returnType: isPy ? "dict[str, Any]" : "Promise<{ success: boolean }>",
        parameters: [
          { name: isPy ? "payload" : "requestId", type: isPy ? "dict[str, Any]" : "string" },
        ],
        complexityScore: (node.complexity ?? 10) > 20 ? "high" : (node.complexity ?? 10) > 10 ? "moderate" : "low",
        lineRange: "L15-L28",
        docstring: `Primary domain execution method for ${node.label}.`,
        isExported: true,
      },
      {
        name: isPy ? `${baseName}Service.validate_inputs` : `${baseName}Controller.validateInvariant`,
        signature: isPy
          ? `def validate_inputs(self, payload: dict) -> bool`
          : `public validateInvariant(): boolean`,
        kind: "method",
        returnType: "boolean",
        parameters: isPy ? [{ name: "payload", type: "dict" }] : [],
        complexityScore: "low",
        lineRange: "L30-L38",
        docstring: `Guards preconditions and contract invariants.`,
        isExported: true,
      },
    ];

    return {
      code,
      exports: [isPy ? `${baseName}Service` : `${baseName}Controller`],
      imports: isPy ? ["structlog", "typing"] : ["react"],
      risk: (node.coupling ?? 0) > 20
        ? "High-coupling core hub. Modifying public signatures will break downstream caller contracts."
        : "Standard modular service. Well-encapsulated internal state with low ripple effect.",
      symbols,
    };
  }, [node]);

  if (!node || !sample) return null;

  const filteredSymbols = sample.symbols.filter(
    (s) =>
      s.name.toLowerCase().includes(symbolFilter.toLowerCase()) ||
      s.signature.toLowerCase().includes(symbolFilter.toLowerCase()) ||
      (s.docstring && s.docstring.toLowerCase().includes(symbolFilter.toLowerCase()))
  );

  const copyCode = () => {
    navigator.clipboard.writeText(sample.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        width: "min(680px, 94vw)",
        backgroundColor: "#0d0d11",
        borderLeft: "1px solid rgba(255, 255, 255, 0.15)",
        boxShadow: "-24px 0 64px rgba(0, 0, 0, 0.85)",
        zIndex: 45,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        color: "#ffffff",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#09090b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              display: "grid",
              placeItems: "center",
              fontSize: "0.875rem",
              flexShrink: 0,
            }}
          >
            {node.is_entry ? "🚀" : "📄"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                letterSpacing: "-0.015em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {node.label}
            </div>
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                color: "rgba(255, 255, 255, 0.45)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {node.path}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={copyCode}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              cursor: "pointer",
            }}
          >
            {copied ? "✓ Copied" : "Copy Code"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "rgba(255, 255, 255, 0.7)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              fontSize: "0.8125rem",
            }}
            title="Close Drawer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Metadata & Action Strip ─────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "var(--mf-mono, monospace)", fontSize: "0.6875rem" }}>
          <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            LOC: <strong style={{ color: "#fff" }}>{node.line_count ?? 140}</strong>
          </span>
          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>/</span>
          <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            FAN-IN: <strong style={{ color: "#fff" }}>{incomingNodes.length} callers</strong>
          </span>
          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>/</span>
          <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            FAN-OUT: <strong style={{ color: "#fff" }}>{outgoingNodes.length} deps</strong>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => onSimulateBlastRadius(node.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 999,
              background: "#ffffff",
              color: "#000000",
              border: "1px solid #ffffff",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span>💥 Blast Radius</span>
          </button>

          <button
            type="button"
            onClick={() => onAskCopilot(`Perform an architectural audit of ${node.path}. What are the breaking change risks?`)}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              background: "transparent",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              cursor: "pointer",
            }}
          >
            Ask Copilot ↗
          </button>
        </div>
      </div>

      {/* ── Tabs (Symbols | Code | Topology) ───────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "#09090b" }}>
        <button
          type="button"
          onClick={() => setActiveTab("symbols")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            background: "transparent",
            color: activeTab === "symbols" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
            borderBottom: activeTab === "symbols" ? "2px solid #ffffff" : "2px solid transparent",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          AST Symbols ({sample.symbols.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("code")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            background: "transparent",
            color: activeTab === "code" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
            borderBottom: activeTab === "code" ? "2px solid #ffffff" : "2px solid transparent",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          Source Code
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("topology")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            background: "transparent",
            color: activeTab === "topology" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
            borderBottom: activeTab === "topology" ? "2px solid #ffffff" : "2px solid transparent",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          Topology ({incomingNodes.length + outgoingNodes.length})
        </button>
      </div>

      {/* ── Drawer Body ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {/* TAB 1: AST SYMBOLS & FUNCTION INSPECTOR */}
        {activeTab === "symbols" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Filter Search */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Filter symbols or methods..."
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  backgroundColor: "#070709",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  outline: "none",
                }}
              />
              {symbolFilter && (
                <button
                  type="button"
                  onClick={() => setSymbolFilter("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Invariant Alert */}
            <div
              style={{
                borderLeft: "2px solid #ffffff",
                paddingLeft: 12,
                fontSize: "0.75rem",
                color: "rgba(255, 255, 255, 0.75)",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "#ffffff" }}>Architectural Invariant:</strong> {sample.risk}
            </div>

            {/* Symbol Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredSymbols.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "rgba(255, 255, 255, 0.4)", fontSize: "0.8125rem" }}>
                  No matching symbols found for &quot;{symbolFilter}&quot;
                </div>
              ) : (
                filteredSymbols.map((sym) => {
                  const isExpanded = selectedSymbolName === sym.name;
                  return (
                    <div
                      key={sym.name}
                      style={{
                        backgroundColor: "#08080a",
                        border: isExpanded ? "1px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 10,
                        padding: "14px 16px",
                        transition: "border-color 0.15s",
                      }}
                    >
                      {/* Top Row: Symbol Name & Type Badges */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "0.625rem",
                              textTransform: "uppercase",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: sym.kind === "function" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                              color: "#ffffff",
                              fontWeight: 600,
                            }}
                          >
                            {sym.kind}
                          </span>
                          <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.8125rem", fontWeight: 600, color: "#ffffff" }}>
                            {sym.name}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span
                            style={{
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "0.625rem",
                              padding: "2px 6px",
                              borderRadius: 4,
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                              color:
                                sym.complexityScore === "high"
                                  ? "#ff6b6b"
                                  : sym.complexityScore === "moderate"
                                  ? "#ffc078"
                                  : "#69db7c",
                            }}
                          >
                            {sym.complexityScore.toUpperCase()} COMPLEXITY
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "0.625rem",
                              color: "rgba(255, 255, 255, 0.35)",
                            }}
                          >
                            {sym.lineRange}
                          </span>
                        </div>
                      </div>

                      {/* Signature Bar */}
                      <div
                        style={{
                          margin: "10px 0 8px",
                          padding: "6px 10px",
                          borderRadius: 6,
                          backgroundColor: "#111114",
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.75rem",
                          color: "rgba(255, 255, 255, 0.9)",
                          overflowX: "auto",
                        }}
                      >
                        {sym.signature}
                      </div>

                      {/* Docstring */}
                      {sym.docstring && (
                        <p style={{ margin: "6px 0 12px", fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.65)", lineHeight: 1.5 }}>
                          {sym.docstring}
                        </p>
                      )}

                      {/* Parameters Table */}
                      {sym.parameters.length > 0 && (
                        <div style={{ margin: "10px 0", borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: 8 }}>
                          <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.625rem", textTransform: "uppercase", color: "rgba(255, 255, 255, 0.4)", marginBottom: 6 }}>
                            Input Parameters:
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {sym.parameters.map((p) => (
                              <div
                                key={p.name}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  fontFamily: "var(--mf-mono, monospace)",
                                  fontSize: "0.6875rem",
                                }}
                              >
                                <span style={{ color: "#ffffff", fontWeight: 500 }}>{p.name}</span>
                                <span style={{ color: "rgba(255, 255, 255, 0.3)" }}>:</span>
                                <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>{p.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Symbol Actions */}
                      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: 10 }}>
                        <button
                          type="button"
                          onClick={() =>
                            onAskCopilot(`Explain function ${sym.name} in ${node.path}, detailing its purpose, invariants, and edge cases.`)
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#ffffff",
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "0.625rem",
                            cursor: "pointer",
                          }}
                        >
                          💡 Explain
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onAskCopilot(`Write a comprehensive unit test suite covering edge cases for function ${sym.name} in ${node.path}.`)
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#ffffff",
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "0.625rem",
                            cursor: "pointer",
                          }}
                        >
                          🧪 Generate Tests
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onAskCopilot(`If I refactor ${sym.name} in ${node.path}, what downstream callers will break? Check blast radius.`)
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#ffffff",
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "0.625rem",
                            cursor: "pointer",
                          }}
                        >
                          ⚡ Refactor Impact
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SOURCE CODE */}
        {activeTab === "code" && (
          <div>
            <div
              style={{
                borderLeft: "2px solid #ffffff",
                paddingLeft: 12,
                marginBottom: 16,
                fontSize: "0.75rem",
                color: "rgba(255, 255, 255, 0.75)",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "#ffffff" }}>Architectural Invariant:</strong> {sample.risk}
            </div>

            <pre
              style={{
                margin: 0,
                background: "#08080a",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 8,
                padding: "16px",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                lineHeight: 1.6,
                overflowX: "auto",
              }}
            >
              <code>
                {sample.code.split("\n").map((line, idx) => (
                  <div key={idx} style={{ display: "flex" }}>
                    <span
                      style={{
                        width: 36,
                        color: "rgba(255, 255, 255, 0.25)",
                        userSelect: "none",
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ color: "rgba(255, 255, 255, 0.85)" }}>{line}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        )}

        {/* TAB 3: TOPOLOGY & DEPENDENCY GRAPH */}
        {activeTab === "topology" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Callers (Fan-in) */}
            <div>
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  color: "rgba(255, 255, 255, 0.4)",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>Incoming Callers (Fan-In: {incomingNodes.length})</span>
                <span style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.25)" }}>— Files that import this module</span>
              </div>

              {incomingNodes.length === 0 ? (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    color: "rgba(255, 255, 255, 0.4)",
                    fontSize: "0.75rem",
                  }}
                >
                  🚀 Entry point or standalone root — no upstream callers inside this repository.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {incomingNodes.map((inc) => (
                    <div
                      key={inc.id}
                      onClick={() => onSelectNode && onSelectNode(inc.id, inc.path)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: onSelectNode ? "pointer" : "default",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#ffffff" }}>{inc.label}</div>
                        <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.625rem", color: "rgba(255,255,255,0.4)" }}>
                          {inc.path}
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.625rem",
                          color: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          padding: "2px 8px",
                          borderRadius: 999,
                        }}
                      >
                        Navigate ↗
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Dependencies (Fan-out) */}
            <div>
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  color: "rgba(255, 255, 255, 0.4)",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>Outgoing Dependencies (Fan-Out: {outgoingNodes.length})</span>
                <span style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.25)" }}>— Modules imported by this file</span>
              </div>

              {outgoingNodes.length === 0 ? (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    color: "rgba(255, 255, 255, 0.4)",
                    fontSize: "0.75rem",
                  }}
                >
                  🍃 Leaf node — does not import any other local modules.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {outgoingNodes.map((out) => (
                    <div
                      key={out.id}
                      onClick={() => onSelectNode && onSelectNode(out.id, out.path)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: onSelectNode ? "pointer" : "default",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#ffffff" }}>{out.label}</div>
                        <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.625rem", color: "rgba(255,255,255,0.4)" }}>
                          {out.path}
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.625rem",
                          color: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          padding: "2px 8px",
                          borderRadius: 999,
                        }}
                      >
                        Navigate ↗
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

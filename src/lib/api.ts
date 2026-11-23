/**
 * DevLens AI — Backend API Client
 * All HTTP calls to the FastAPI backend go through this module.
 * Configure the base URL via VITE_API_URL environment variable.
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const result = await api.analyze('https://github.com/org/repo');
 */

const DEFAULT_API_URL = "https://devlens-api-f0jm.onrender.com";
const DEFAULT_API_KEY = "4d9f6a1e8c0b2d4f7e5a3c1b9d8e0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d";

function resolveApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) {
      return "http://localhost:8000";
    }
  }
  return DEFAULT_API_URL;
}

const API_BASE = resolveApiBase();
const API_KEY = (import.meta.env.VITE_API_KEY || DEFAULT_API_KEY).trim();

// ── Base fetch wrapper ──────────────────────────────────────────────────

function getSessionToken(): string | null {
  try {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      return localStorage.getItem("devlens_session_token");
    }
  } catch {
    // Graceful fallback for restricted storage / SSR
  }
  return null;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = getSessionToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Types (mirrors backend schemas) ─────────────────────────────────────

export interface AnalyzeResponse {
  id: string;
  full_name: string;
  owner: string;
  name: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  languages: Record<string, number>;
  is_monorepo: boolean;
  status: string;
  session_id: string;
  job_id: string;
}

export interface ArchNode {
  id: string;
  x: number;
  y: number;
  label: string;
  path: string;
  desc: string;
  complexity: number;
  coupling: number;
  is_entry: boolean;
  language: string;
  line_count: number;
}

export interface GraphData {
  nodes: ArchNode[];
  edges: [string, string][];
  meta: {
    total_files: number;
    total_nodes: number;
    total_edges: number;
    languages: Record<string, number>;
    is_monorepo: boolean;
    commit_sha: string | null;
    cycles?: string[][];
    search_mode?: "semantic" | "keyword";
  };
}

export interface SymbolDetail {
  name: string;
  type: string;
  start_line?: number;
  end_line?: number;
  complexity: number;
  parameters?: string[];
  return_type?: string;
}

export interface FileDetailResponse {
  path: string;
  content: string;
  line_count: number;
  language: string;
  symbols: SymbolDetail[];
}

export interface GitCommitDetail {
  sha: string;
  short_sha: string;
  message: string;
  full_message: string;
  author: string;
  author_avatar?: string | null;
  date: string;
  files_changed: number;
  insertions: number;
  deletions: number;
  impacted_files: string[];
  risk_level: "low" | "moderate" | "high";
  drift_summary: string;
}

export interface FileNode {
  path: string;
  name: string;
  is_dir: boolean;
  depth: number;
  language: string | null;
  line_count: number | null;
}

export interface FilesResponse {
  tree: FileNode[];
  modules: Array<{ name: string; file_count: number; files: string[] }>;
  entry_points: string[];
}

export interface JobStatus {
  id: string;
  status: "queued" | "running" | "complete" | "failed";
  current_step: string | null;
  current_step_index: number;
  progress_pct: number;
  error_message: string | null;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  services: Record<string, string>;
}

export interface ChatResponse {
  reply: string;
  sources: string[];
  session_id: string;
}

export interface GitHubUser {
  api_key: string;
  github_username: string;
  github_avatar_url: string | null;
  github_name: string | null;
}

// ── API Methods ──────────────────────────────────────────────────────────

export const api = {
  // Health
  health: () => apiFetch<HealthResponse>("/api/v1/health"),

  // Repos
  analyze: (repoUrl: string, branch = "main") =>
    apiFetch<AnalyzeResponse>("/api/v1/repos/analyze", {
      method: "POST",
      body: JSON.stringify({ repo_url: repoUrl, branch }),
    }),

  // Analysis job status (poll fallback)
  getJobStatus: (jobId: string) => apiFetch<JobStatus>(`/api/v1/analysis/${jobId}/status`),

  // Graph
  getGraph: (sessionId: string) => apiFetch<GraphData>(`/api/v1/sessions/${sessionId}/graph`),

  // Files / tree
  getFiles: (sessionId: string) => apiFetch<FilesResponse>(`/api/v1/sessions/${sessionId}/files`),

  // File detail & AST symbol inspection
  getFile: (sessionId: string, path: string) =>
    apiFetch<FileDetailResponse>(
      `/api/v1/sessions/${sessionId}/file?path=${encodeURIComponent(path)}`,
    ),

  // Onboarding doc (bounded by a 60s AbortController so the UI never hangs indefinitely)
  getOnboardingDoc: async (sessionId: string) => {
    const controller = new AbortController();
    const timer =
      typeof window !== "undefined"
        ? window.setTimeout(() => controller.abort(), 60_000)
        : undefined;
    try {
      return await apiFetch<{
        markdown: string;
        structured?: Record<string, unknown> | null;
        repo: string;
      }>(`/api/v1/sessions/${sessionId}/onboarding`, {
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          "Onboarding generation timed out while waiting for the backend. Click Retry to regenerate.",
        );
      }
      throw err;
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  },

  // Commits & Architectural Drift
  getCommits: (sessionId: string) =>
    apiFetch<{
      repo: string;
      branch: string;
      commits: GitCommitDetail[];
    }>(`/api/v1/sessions/${sessionId}/commits`),

  // Chat (REST — non-streaming fallback)
  chat: (sessionId: string, message: string) =>
    apiFetch<ChatResponse>("/api/v1/chat", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, message }),
    }),

  // Export
  exportGraph: (sessionId: string, format: "mermaid" | "plantuml" = "mermaid") =>
    fetch(`${API_BASE}/api/v1/sessions/${sessionId}/export?format=${format}`, {
      headers: { "X-API-Key": API_KEY },
    }).then((r) => r.text()),

  // Auth
  getGitHubLoginUrl: () => `${API_BASE}/api/v1/auth/github/login`,
  loginWithToken: (token: string) =>
    apiFetch<{
      id: string;
      github_id: number;
      github_username: string;
      github_name: string | null;
      github_avatar_url: string | null;
      api_key: string;
    }>("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};

// ── WebSocket URL Builder ────────────────────────────────────────────────

const RAW_WS_URL = (import.meta.env.VITE_WS_URL || "").trim().replace(/\/+$/, "");
const WS_BASE = RAW_WS_URL || API_BASE.replace(/^http/, "ws");

export const wsUrls = {
  jobProgress: (jobId: string) => `${WS_BASE}/ws/jobs/${jobId}`,
  chat: (sessionId: string) => `${WS_BASE}/ws/chat/${sessionId}`,
};

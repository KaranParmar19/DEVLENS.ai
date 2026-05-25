/**
 * DevLens AI — Backend API Client
 * All HTTP calls to the FastAPI backend go through this module.
 * Configure the base URL via VITE_API_URL environment variable.
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const result = await api.analyze('https://github.com/org/repo');
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const API_KEY  = import.meta.env.VITE_API_KEY  ?? '';

// ── Base fetch wrapper ──────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      // GitHub OAuth token (if logged in) — stored in localStorage after /auth/github/callback
      ...(localStorage.getItem('devlens_session_token')
        ? { 'X-Session-Token': localStorage.getItem('devlens_session_token')! }
        : {}),
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
  };
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
  status: 'queued' | 'running' | 'complete' | 'failed';
  current_step: string | null;
  current_step_index: number;
  progress_pct: number;
  error_message: string | null;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
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
  health: () => apiFetch<HealthResponse>('/api/v1/health'),

  // Repos
  analyze: (repoUrl: string, branch = 'main') =>
    apiFetch<AnalyzeResponse>('/api/v1/repos/analyze', {
      method: 'POST',
      body: JSON.stringify({ repo_url: repoUrl, branch }),
    }),

  // Analysis job status (poll fallback)
  getJobStatus: (jobId: string) =>
    apiFetch<JobStatus>(`/api/v1/analysis/${jobId}/status`),

  // Graph
  getGraph: (sessionId: string) =>
    apiFetch<GraphData>(`/api/v1/sessions/${sessionId}/graph`),

  // Files / tree
  getFiles: (sessionId: string) =>
    apiFetch<FilesResponse>(`/api/v1/sessions/${sessionId}/files`),

  // Onboarding doc
  getOnboardingDoc: (sessionId: string) =>
    apiFetch<{ markdown: string; repo: string }>(
      `/api/v1/sessions/${sessionId}/onboarding`
    ),

  // Chat (REST — non-streaming fallback)
  chat: (sessionId: string, message: string) =>
    apiFetch<ChatResponse>('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, message }),
    }),

  // Export
  exportGraph: (sessionId: string, format: 'mermaid' | 'plantuml' = 'mermaid') =>
    fetch(`${API_BASE}/api/v1/sessions/${sessionId}/export?format=${format}`, {
      headers: { 'X-API-Key': API_KEY },
    }).then(r => r.text()),

  // Auth
  getGitHubLoginUrl: () => `${API_BASE}/api/v1/auth/github/login`,
};

// ── WebSocket URL Builder ────────────────────────────────────────────────

const WS_BASE = API_BASE.replace(/^http/, 'ws');

export const wsUrls = {
  jobProgress: (jobId: string) => `${WS_BASE}/ws/jobs/${jobId}`,
  chat:        (sessionId: string) => `${WS_BASE}/ws/chat/${sessionId}`,
};

/**
 * DevLens AI — useAnalysis Hook
 * Manages the full repo analysis flow:
 * 1. POST /repos/analyze → get job_id + session_id
 * 2. Connect WebSocket /ws/jobs/{job_id} → stream progress steps
 * 3. On complete → fetch graph + files from /sessions/{id}/...
 *
 * Replaces the fake setTimeout-based step ticker in portal-transform.tsx.
 */

import { useState, useRef, useCallback } from 'react';
import { api, wsUrls, type GraphData, type FilesResponse } from '@/lib/api';

export type StepStatus = 'pending' | 'active' | 'done';

export interface AnalysisStep {
  label: string;
  status: StepStatus;
}

export interface AnalysisState {
  jobId: string | null;
  sessionId: string | null;
  steps: AnalysisStep[];
  progressPct: number;
  repoMeta: {
    stars: number;
    files: number;
    languages: Record<string, number>;
    sizeKb: number;
  } | null;
  graphData: GraphData | null;
  filesData: FilesResponse | null;
  isComplete: boolean;
  error: string | null;
}

const INITIAL_STEPS: AnalysisStep[] = [
  { label: 'Cloning repo',              status: 'pending' },
  { label: 'Parsing file tree',         status: 'pending' },
  { label: 'Building dependency graph', status: 'pending' },
  { label: 'Generating architecture map', status: 'pending' },
  { label: 'Indexing for Q&A',          status: 'pending' },
];

const INITIAL_STATE: AnalysisState = {
  jobId: null,
  sessionId: null,
  steps: INITIAL_STEPS,
  progressPct: 0,
  repoMeta: null,
  graphData: null,
  filesData: null,
  isComplete: false,
  error: null,
};

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);

  const reset = useCallback(() => {
    wsRef.current?.close();
    setState(INITIAL_STATE);
  }, []);

  const startAnalysis = useCallback(async (repoUrl: string) => {
    setState({ ...INITIAL_STATE, steps: INITIAL_STEPS.map(s => ({ ...s })) });

    try {
      // Step 1: Submit repo
      const result = await api.analyze(repoUrl);
      const { job_id, session_id } = result;

      setState(prev => ({ ...prev, jobId: job_id, sessionId: session_id }));

      // Step 2: Open WebSocket for real-time progress
      const ws = new WebSocket(wsUrls.jobProgress(job_id));
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data) as Record<string, unknown>;

        if (msg.type === 'step_start') {
          const idx = msg.step_index as number;
          setState(prev => ({
            ...prev,
            steps: prev.steps.map((s, i) => ({
              ...s,
              status: i === idx ? 'active' : i < idx ? 'done' : 'pending',
            })),
            progressPct: Math.round((idx / INITIAL_STEPS.length) * 100),
          }));
        }

        if (msg.type === 'step_done') {
          const idx = msg.step_index as number;
          const meta = (msg.meta ?? {}) as Record<string, unknown>;
          setState(prev => ({
            ...prev,
            steps: prev.steps.map((s, i) => ({
              ...s,
              status: i <= idx ? 'done' : s.status,
            })),
            progressPct: Math.round(((idx + 1) / INITIAL_STEPS.length) * 100),
            // Capture repo metadata when it arrives on step 0
            ...(idx === 0 && meta ? {
              repoMeta: {
                stars: (meta.stars as number) ?? 0,
                files: (meta.files as number) ?? 0,
                languages: {},
                sizeKb: (meta.size_kb as number) ?? 0,
              },
            } : {}),
            // Capture languages on step 1
            ...(idx === 1 && meta?.languages ? {
              repoMeta: prev.repoMeta
                ? { ...prev.repoMeta, languages: meta.languages as Record<string, number> }
                : null,
            } : {}),
          }));
        }

        if (msg.type === 'complete') {
          const sid = msg.session_id as string;
          // Fetch graph and file tree now that indexing is done
          const [graphData, filesData] = await Promise.all([
            api.getGraph(sid),
            api.getFiles(sid),
          ]);
          setState(prev => ({
            ...prev,
            sessionId: sid,
            graphData,
            filesData,
            steps: prev.steps.map(s => ({ ...s, status: 'done' as StepStatus })),
            progressPct: 100,
            isComplete: true,
            error: null,
          }));
          ws.close();
        }

        if (msg.type === 'error') {
          setState(prev => ({
            ...prev,
            error: msg.message as string,
          }));
          ws.close();
        }
      };

      ws.onerror = () => {
        setState(prev => ({ ...prev, error: 'Connection to analysis server failed.' }));
      };

    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Analysis failed.',
      }));
    }
  }, []);

  return { state, startAnalysis, reset };
}

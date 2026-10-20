export type StudioTab = "architecture" | "flow" | "drift" | "doc";
export type ExplorerTab = "files" | "modules" | "entrypoints";

export interface GitCommitItem {
  sha: string;
  short_sha: string;
  message: string;
  full_message: string;
  author: string;
  author_avatar?: string | null;
  date: string;
  files_changed?: number;
  insertions?: number;
  deletions?: number;
  risk_level?: "low" | "moderate" | "high";
  drift_summary?: string;
  impacted_files?: string[];
  new_dependencies?: string[];
}


export interface GraphNode {
  id: string;
  label: string;
  path: string;
  language?: string;
  line_count?: number;
  complexity?: number;
  coupling?: number;
  is_entry?: boolean;
  x?: number;
  y?: number;
  desc?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: [string, string][];
  meta?: {
    total_files?: number;
    total_nodes?: number;
    total_edges?: number;
    languages?: Record<string, number>;
    is_monorepo?: boolean;
    commit_sha?: string | null;
    cycles?: string[][];
  };
}

export interface FileItem {
  path: string;
  name: string;
  is_dir: boolean;
  depth: number;
  language?: string | null;
  line_count?: number | null;
}

export interface ModuleItem {
  name: string;
  file_count: number;
  files: string[];
}

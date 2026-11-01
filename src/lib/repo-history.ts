/**
 * DevLens AI — Repository History Store
 * Persists analyzed repos to localStorage so the Repository Hub can surface them.
 */

const STORAGE_KEY = 'devlens_repo_history';
const MAX_ENTRIES = 20;

export interface RepoHistoryEntry {
  id: string; // sessionId
  repoUrl: string;
  repoLabel: string; // owner/repo
  analyzedAt: string; // ISO timestamp
  lastVisitedAt: string;
  status: 'complete' | 'failed' | 'indexing';
  meta?: {
    stars: number;
    files: number;
    sizeKb: number;
    languages: Record<string, number>;
  };
  // Conversation threads: sessionId -> messages
  chatHistory?: ChatThread[];
}

export interface ChatThread {
  id: string;
  createdAt: string;
  messages: StoredMessage[];
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  feedback?: 'up' | 'down' | null;
  timestamp: string;
}

function load(): RepoHistoryEntry[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RepoHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: RepoHistoryEntry[]) {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // storage quota exceeded — ignore
  }
}

export const repoHistory = {
  getAll(): RepoHistoryEntry[] {
    const raw = load();
    const now = Date.now();
    const seen = new Set<string>();
    const cleaned: RepoHistoryEntry[] = [];
    let modified = false;

    for (const entry of raw) {
      // Normalize unique key (case-insensitive repoLabel or repoUrl)
      const key = (entry.repoLabel || entry.repoUrl || entry.id).trim().toLowerCase();
      if (seen.has(key)) {
        modified = true;
        continue;
      }
      seen.add(key);

      // Reconcile stale 'indexing' jobs from past sessions (> 5 minutes old)
      if (entry.status === 'indexing') {
        const timestamp = new Date(entry.analyzedAt || entry.lastVisitedAt || 0).getTime();
        if (now - timestamp > 5 * 60 * 1000) {
          if (entry.meta && entry.meta.files > 0) {
            entry.status = 'complete';
          } else {
            entry.status = 'failed';
          }
          modified = true;
        }
      }

      cleaned.push(entry);
    }

    if (modified) {
      save(cleaned);
    }

    return cleaned.sort((a, b) => {
      const timeB = new Date(b.lastVisitedAt || b.analyzedAt || 0).getTime();
      const timeA = new Date(a.lastVisitedAt || a.analyzedAt || 0).getTime();
      return timeB - timeA;
    });
  },

  upsert(entry: Omit<RepoHistoryEntry, 'lastVisitedAt'>): RepoHistoryEntry {
    const entries = load();
    const targetLabel = (entry.repoLabel || "").trim().toLowerCase();
    const targetUrl = (entry.repoUrl || "").trim().toLowerCase();
    const existing = entries.findIndex(
      (e) =>
        e.id === entry.id ||
        (targetLabel && e.repoLabel.trim().toLowerCase() === targetLabel) ||
        (targetUrl && e.repoUrl.trim().toLowerCase() === targetUrl)
    );
    const now = new Date().toISOString();
    const updated: RepoHistoryEntry = { ...entry, lastVisitedAt: now };

    if (existing >= 0) {
      entries[existing] = { ...entries[existing], ...updated };
    } else {
      entries.unshift(updated);
    }
    save(entries);
    return updated;
  },

  updateMeta(sessionId: string, meta: RepoHistoryEntry['meta']) {
    const entries = load();
    const idx = entries.findIndex((e) => e.id === sessionId);
    if (idx >= 0) {
      entries[idx].meta = meta;
      save(entries);
    }
  },

  markComplete(sessionId: string) {
    const entries = load();
    const idx = entries.findIndex((e) => e.id === sessionId);
    if (idx >= 0) {
      entries[idx].status = 'complete';
      save(entries);
    }
  },

  markFailed(sessionId: string) {
    const entries = load();
    const idx = entries.findIndex((e) => e.id === sessionId);
    if (idx >= 0) {
      entries[idx].status = 'failed';
      save(entries);
    }
  },

  remove(sessionId: string) {
    const target = sessionId.trim().toLowerCase();
    const entries = load().filter(
      (e) =>
        e.id !== sessionId &&
        e.repoLabel.trim().toLowerCase() !== target &&
        e.repoUrl.trim().toLowerCase() !== target
    );
    save(entries);
  },

  // ── Chat history ────────────────────────────────────────────────────────
  saveChatMessages(sessionId: string, messages: StoredMessage[]) {
    const entries = load();
    const idx = entries.findIndex((e) => e.id === sessionId);
    if (idx < 0) return;
    const thread: ChatThread = {
      id: sessionId,
      createdAt: entries[idx].analyzedAt,
      messages,
    };
    entries[idx].chatHistory = [thread];
    save(entries);
  },

  getChatMessages(sessionId: string): StoredMessage[] {
    const entries = load();
    const entry = entries.find((e) => e.id === sessionId);
    return entry?.chatHistory?.[0]?.messages ?? [];
  },

  updateMessageFeedback(sessionId: string, msgIndex: number, feedback: 'up' | 'down' | null) {
    const entries = load();
    const idx = entries.findIndex((e) => e.id === sessionId);
    if (idx < 0) return;
    const msgs = entries[idx].chatHistory?.[0]?.messages;
    if (msgs && msgs[msgIndex]) {
      msgs[msgIndex].feedback = feedback;
      save(entries);
    }
  },
};

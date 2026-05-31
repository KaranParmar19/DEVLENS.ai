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
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RepoHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: RepoHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // storage quota exceeded — ignore
  }
}

export const repoHistory = {
  getAll(): RepoHistoryEntry[] {
    return load().sort(
      (a, b) => new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime()
    );
  },

  upsert(entry: Omit<RepoHistoryEntry, 'lastVisitedAt'>): RepoHistoryEntry {
    const entries = load();
    const existing = entries.findIndex((e) => e.id === entry.id || e.repoUrl === entry.repoUrl);
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
    const entries = load().filter((e) => e.id !== sessionId);
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

/**
 * DevLens AI — useChat Hook
 * Manages the WebSocket chat connection to the backend.
 * Handles streaming token-by-token responses grounded in the repository's AST index.
 *
 * Usage:
 *   const { messages, sendMessage, isStreaming, isConnected, error, clearMessages } = useChat(sessionId);
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { wsUrls, api } from '@/lib/api';
import { repoHistory } from '@/lib/repo-history';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  isStreaming?: boolean;
}

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (sessionId) {
      const stored = repoHistory.getChatMessages(sessionId);
      if (stored && stored.length > 0) {
        return stored.map(m => ({
          role: m.role,
          content: m.content,
          sources: m.sources,
        }));
      }
    }
    return [];
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Sync to history on change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      // Only persist non-streaming messages
      const finalized = messages.filter(m => !m.isStreaming);
      if (finalized.length > 0) {
        repoHistory.saveChatMessages(
          sessionId,
          finalized.map(m => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
            timestamp: new Date().toISOString()
          }))
        );
      }
    }
  }, [messages, sessionId]);

  // ── Connect WebSocket when sessionId is available ────────────────────
  useEffect(() => {
    if (!sessionId) return;

    try {
      const ws = new WebSocket(wsUrls.chat(sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };
      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as Record<string, unknown>;

          if (msg.type === 'stream_chunk') {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last.isStreaming) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + (msg.delta as string) },
                ];
              }
              return [
                ...prev,
                { role: 'assistant', content: msg.delta as string, isStreaming: true },
              ];
            });
          }

          if (msg.type === 'stream_done') {
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, isStreaming: false, sources: (msg.sources as string[]) ?? [] },
                ];
              }
              return prev;
            });
            setIsStreaming(false);
          }

          if (msg.type === 'stream_error') {
            const errText = msg.message as string;
            setError(errText);
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: `⚠️ Error: ${errText}`, isStreaming: false },
                ];
              }
              return prev;
            });
            setIsStreaming(false);
          }
        } catch {
          // ignore parse errors
        }
      };

      return () => {
        ws.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, [sessionId]);

  // ── Send a message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    // Optimistically add user message and streaming assistant placeholder
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', isStreaming: true },
    ]);
    setIsStreaming(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Real backend live streaming
      wsRef.current.send(JSON.stringify({ message: text }));
    } else if (sessionId) {
      // Fallback: Try REST
      try {
        const res = await api.chat(sessionId, text);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { role: 'assistant', content: res.reply, sources: res.sources, isStreaming: false },
            ];
          }
          return [
            ...prev,
            { role: 'assistant', content: res.reply, sources: res.sources, isStreaming: false },
          ];
        });
        setIsStreaming(false);
      } catch (err: any) {
        setIsStreaming(false);
        const errMsg = err?.message || "Failed to communicate with chat backend.";
        setError(errMsg);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          const errorMsg = `⚠️ **Copilot Error**: ${errMsg}\n\nPlease check server logs or verify your session.`;
          if (last?.role === 'assistant' && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { role: 'assistant', content: errorMsg, sources: [], isStreaming: false },
            ];
          }
          return [
            ...prev,
            { role: 'assistant', content: errorMsg, sources: [], isStreaming: false },
          ];
        });
      }
    } else {
      setIsStreaming(false);
      setError("No active repository session.");
      setMessages(prev => {
        const last = prev[prev.length - 1];
        const noSessionMsg = "⚠️ **No Active Session**: Please index a repository to ask DevLens Copilot questions grounded in AST code context.";
        if (last?.role === 'assistant' && last.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { role: 'assistant', content: noSessionMsg, sources: [], isStreaming: false },
          ];
        }
        return [
          ...prev,
          { role: 'assistant', content: noSessionMsg, sources: [], isStreaming: false },
        ];
      });
    }
  }, [sessionId, isStreaming]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, sendMessage, isStreaming, isConnected, error, clearMessages };
}

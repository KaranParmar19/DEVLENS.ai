/**
 * DevLens AI — useChat Hook
 * Manages the WebSocket chat connection to the backend.
 * Handles streaming token-by-token responses from Claude.
 *
 * Usage:
 *   const { messages, sendMessage, isStreaming } = useChat(sessionId);
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
      repoHistory.saveChatMessages(
        sessionId,
        messages.map(m => ({
          role: m.role,
          content: m.content,
          sources: m.sources,
          timestamp: new Date().toISOString()
        }))
      );
    }
  }, [messages, sessionId]);

  // ── Connect WebSocket when sessionId is available ────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const ws = new WebSocket(wsUrls.chat(sessionId));
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setError('Chat connection lost. Retrying...');

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as Record<string, unknown>;

      if (msg.type === 'stream_chunk') {
        // Append delta to the streaming assistant message
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
        // Mark streaming complete + attach sources
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
        setError(msg.message as string);
        setIsStreaming(false);
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  // ── Send a message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    // Optimistically add user message
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsStreaming(true);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Use WebSocket for streaming
      wsRef.current.send(JSON.stringify({ message: text }));
    } else if (sessionId) {
      // Fallback: REST (non-streaming)
      try {
        const res = await api.chat(sessionId, text);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: res.reply, sources: res.sources },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Chat failed.');
      } finally {
        setIsStreaming(false);
      }
    }
  }, [sessionId, isStreaming]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, sendMessage, isStreaming, isConnected, error, clearMessages };
}

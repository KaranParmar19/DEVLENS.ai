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
import { getSimulatedCopilotResponse } from '@/lib/mock-ai-copilot';

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

    try {
      const ws = new WebSocket(wsUrls.chat(sessionId));
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
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
            setError(msg.message as string);
            setIsStreaming(false);
          }
        } catch {
          // ignore parsing error
        }
      };

      return () => {
        ws.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, [sessionId]);

  // Simulated streaming helper for offline / demo mode
  const streamSimulatedResponse = useCallback((query: string) => {
    const simulated = getSimulatedCopilotResponse(query);
    const fullText = simulated.reply;
    let currentIndex = 0;
    const chunkSize = 5;

    // Append initial streaming placeholder
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: '', isStreaming: true },
    ]);

    const interval = setInterval(() => {
      currentIndex += chunkSize;
      if (currentIndex >= fullText.length) {
        clearInterval(interval);
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: fullText,
                isStreaming: false,
                sources: simulated.sources,
              },
            ];
          }
          return prev;
        });
        setIsStreaming(false);
      } else {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: fullText.slice(0, currentIndex) },
            ];
          }
          return prev;
        });
      }
    }, 18);
  }, []);

  // ── Send a message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    // Optimistically add user message
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsStreaming(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Real backend live streaming
      wsRef.current.send(JSON.stringify({ message: text }));
    } else if (sessionId) {
      // Fallback: Try REST
      try {
        const res = await api.chat(sessionId, text);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: res.reply, sources: res.sources },
        ]);
        setIsStreaming(false);
      } catch (err: any) {
        setIsStreaming(false);
        const errMsg = err?.message || "Failed to communicate with chat backend.";
        setError(errMsg);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ **Copilot Unavailable**: ${errMsg}\n\nVerify that the backend is running and \`OPENAI_API_KEY\` is configured in \`backend/.env\`.`,
            sources: [],
          },
        ]);
      }
    } else {
      setIsStreaming(false);
      setError("No active repository session.");
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "⚠️ **No Active Session**: Please index a repository to ask DevLens Copilot questions grounded in AST code context.",
          sources: [],
        },
      ]);
    }
  }, [sessionId, isStreaming, streamSimulatedResponse]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, sendMessage, isStreaming, isConnected, error, clearMessages };
}

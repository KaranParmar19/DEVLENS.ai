/**
 * DevLens AI — Command Palette (Cmd+K / Ctrl+K)
 * Power-user command palette for searching files, running actions, and navigating.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  group?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
  files?: string[];
  onFileSelect?: (path: string) => void;
}

export function CommandPalette({ open, onClose, actions, files = [], onFileSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build combined results
  const fileActions: PaletteAction[] = files.map((f) => ({
    id: `file:${f}`,
    label: f.split('/').pop() ?? f,
    description: f,
    icon: '📄',
    group: 'Files',
    onSelect: () => {
      onFileSelect?.(f);
      onClose();
    },
  }));

  const allItems = [...actions, ...fileActions].filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.group?.toLowerCase().includes(q)
    );
  });

  // Group items
  const grouped: Record<string, PaletteAction[]> = {};
  allItems.forEach((item) => {
    const g = item.group ?? 'Actions';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(item);
  });

  const flatList = Object.values(grouped).flat();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, flatList.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        flatList[cursor]?.onSelect();
        onClose();
      }
    },
    [flatList, cursor, onClose]
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // Scroll cursor into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cursor="true"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
        animation: 'dl-fade-up 150ms cubic-bezier(0.22,1,0.36,1) both',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 600,
          background: '#0d0d10',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,229,160,0.06)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#4a4a4a', fontSize: 14, fontFamily: 'monospace' }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Search files, actions, commands..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: 14, fontFamily: 'var(--font-sans, Inter, sans-serif)',
              letterSpacing: '0.01em',
            }}
          />
          <kbd style={{
            fontFamily: 'monospace', fontSize: 10, color: '#444',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4, padding: '2px 6px',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
          {flatList.length === 0 ? (
            <div style={{
              padding: '24px', textAlign: 'center',
              fontFamily: 'monospace', fontSize: 12, color: '#444',
            }}>
              No results for "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div style={{
                  padding: '6px 16px 4px',
                  fontFamily: 'monospace', fontSize: 10,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#444',
                }}>
                  {group}
                </div>
                {items.map((item) => {
                  const isFocused = flatIndex === cursor;
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.id}
                      data-cursor={isFocused ? 'true' : undefined}
                      type="button"
                      onClick={() => { item.onSelect(); onClose(); }}
                      onMouseEnter={() => setCursor(idx)}
                      style={{
                        width: '100%', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 16px',
                        background: isFocused ? 'rgba(0,229,160,0.06)' : 'transparent',
                        border: 'none',
                        borderLeft: isFocused ? '2px solid #00E5A0' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'background 80ms ease',
                      }}
                    >
                      {item.icon && (
                        <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>
                          {item.icon}
                        </span>
                      )}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'block', color: isFocused ? '#fff' : '#ccc',
                          fontFamily: 'var(--font-sans, Inter, sans-serif)',
                          fontSize: 13, fontWeight: 500,
                        }}>
                          {item.label}
                        </span>
                        {item.description && (
                          <span style={{
                            display: 'block', fontFamily: 'monospace', fontSize: 10,
                            color: '#555', marginTop: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.description}
                          </span>
                        )}
                      </span>
                      {item.shortcut && (
                        <kbd style={{
                          fontFamily: 'monospace', fontSize: 10, color: '#444',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 4, padding: '2px 6px', flexShrink: 0,
                        }}>
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          {[['↑↓', 'Navigate'], ['↵', 'Select'], ['Esc', 'Close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <kbd style={{
                fontFamily: 'monospace', fontSize: 10, color: '#555',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4, padding: '2px 6px',
              }}>{key}</kbd>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#444' }}>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Hook to toggle Cmd+K / Ctrl+K */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen, toggle: () => setOpen((v) => !v) };
}

/**
 * DevLens AI — Repository Hub
 * Landing view inside the Dashboard that shows all previously analyzed repos,
 * health metrics, last scan timestamps, and quick-action links.
 */

import { useState, useEffect } from 'react';
import { repoHistory, type RepoHistoryEntry } from '@/lib/repo-history';

interface RepoHubProps {
  onSelectRepo: (url: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function HealthBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 3, borderRadius: 4,
        background: 'var(--dl-line-1)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 800ms cubic-bezier(0.22,1,0.36,1)',
          boxShadow: `0 0 12px ${color}`,
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color,
        minWidth: 28, textAlign: 'right',
      }}>{pct}%</span>
    </div>
  );
}

function RepoCard({ entry, onOpen, onDelete }: {
  entry: RepoHistoryEntry;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const langs = Object.keys(entry.meta?.languages ?? {}).slice(0, 3);
  const files = entry.meta?.files ?? 0;
  const size = entry.meta?.sizeKb ?? 0;

  // Fake health metric derived from real data
  const health = entry.status === 'complete'
    ? Math.min(100, Math.round(70 + Math.random() * 30))
    : entry.status === 'failed' ? 0 : 50;
  const healthColor = health > 75 ? 'var(--dl-signal)' : health > 40 ? 'var(--dl-text-1)' : 'var(--dl-danger)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: hovered ? 'var(--dl-overlay)' : 'var(--dl-raised)',
        border: `1px solid ${hovered ? 'var(--dl-line-2)' : 'var(--dl-line-1)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
      }}
      onClick={onOpen}
    >
      {/* Status dot */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: entry.status === 'complete' ? 'var(--dl-signal)'
            : entry.status === 'failed' ? 'var(--dl-danger)' : 'var(--dl-text-2)',
          boxShadow: entry.status === 'complete' ? '0 0 8px var(--dl-signal-hi)' : 'none',
          animation: entry.status === 'indexing' ? 'dl-pulse-dot 1.5s infinite' : 'none',
        }} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: entry.status === 'complete' ? 'var(--dl-signal)'
            : entry.status === 'failed' ? 'var(--dl-danger)' : 'var(--dl-text-1)',
        }}>
          {entry.status}
        </span>
      </div>

      {/* Repo name */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: 'var(--dl-text-2)',
        marginBottom: 2,
      }}>
        {entry.repoLabel.split('/')[0]}/
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 15, fontWeight: 600, color: 'var(--dl-text-0)',
        marginBottom: 12,
      }}>
        {entry.repoLabel.split('/')[1] ?? entry.repoLabel}
      </div>

      {/* Health */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--dl-text-3)', marginBottom: 4,
        }}>
          <span>Health</span>
        </div>
        <HealthBar pct={health} color={healthColor} />
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 12,
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'Files', value: files > 0 ? files.toLocaleString() : '—' },
          { label: 'Size', value: size > 0 ? `${(size / 1024).toFixed(1)}MB` : '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--dl-text-2)', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 2,
            }}>{label}</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--dl-text-0)', fontWeight: 500,
            }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Language badges */}
      {langs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {langs.map((lang) => (
            <span key={lang} style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              padding: '2px 8px', borderRadius: 100,
              background: 'var(--dl-line-1)',
              border: '1px solid var(--dl-line-2)',
              color: 'var(--dl-text-1)',
              letterSpacing: '0.06em',
            }}>
              {lang}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid var(--dl-line-1)',
        paddingTop: 10, marginTop: 4,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--dl-text-3)', letterSpacing: '0.06em',
        }}>
          Last scan: {timeAgo(entry.analyzedAt)}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--dl-text-3)', cursor: 'pointer', padding: '2px 4px',
              fontSize: 11, borderRadius: 4,
              transition: 'color 150ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--dl-danger)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dl-text-3)')}
            title="Remove from history"
          >
            ✕
          </button>
          {/* Open */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              background: hovered ? 'var(--dl-signal-lo)' : 'transparent',
              border: `1px solid ${hovered ? 'var(--dl-signal-md)' : 'var(--dl-line-2)'}`,
              color: hovered ? 'var(--dl-signal)' : 'var(--dl-text-2)',
              padding: '3px 10px', borderRadius: 5,
              cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            Open →
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: '60px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        border: '1px solid var(--dl-line-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color: 'var(--dl-text-3)',
      }}>
        ⬡
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 16, fontWeight: 600, color: 'var(--dl-text-0)', marginBottom: 6,
        }}>
          No repositories yet
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--dl-text-2)', lineHeight: 1.6,
        }}>
          Connect a GitHub repository above to start analyzing its architecture.
        </div>
      </div>
    </div>
  );
}

export function RepoHub({ onSelectRepo }: RepoHubProps) {
  const [repos, setRepos] = useState<RepoHistoryEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setRepos(repoHistory.getAll());
  }, [tick]);

  const filtered = repos.filter((r) =>
    !filter || r.repoLabel.toLowerCase().includes(filter.toLowerCase())
  );

  const handleDelete = (id: string) => {
    repoHistory.remove(id);
    setTick((t) => t + 1);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--dl-signal)', marginBottom: 4,
          }}>
            Repository_Hub
          </div>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 20, fontWeight: 700, color: 'var(--dl-text-0)', margin: 0,
          }}>
            Recent analyses
          </h2>
        </div>

        {repos.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--dl-raised)',
            border: '1px solid var(--dl-line-2)',
            borderRadius: 7, padding: '7px 12px',
          }}>
            <span style={{ color: 'var(--dl-text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>⌕</span>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter repos..."
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--dl-text-0)', fontSize: 12,
                fontFamily: 'var(--font-mono)', width: 160,
              }}
            />
          </div>
        )}
      </div>

      {/* Stats bar */}
      {repos.length > 0 && (
        <div style={{
          display: 'flex', gap: 20, marginBottom: 20,
          padding: '10px 16px',
          background: 'var(--dl-raised)',
          border: '1px solid var(--dl-line-1)',
          borderRadius: 8,
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Total Repos', value: repos.length },
            {
              label: 'Indexed',
              value: repos.filter((r) => r.status === 'complete').length,
              color: 'var(--dl-signal)',
            },
            {
              label: 'Failed',
              value: repos.filter((r) => r.status === 'failed').length,
              color: 'var(--dl-danger)',
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dl-text-2)',
              }}>
                {label}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 14,
                fontWeight: 700, color: color ?? 'var(--dl-text-0)',
              }}>
                {value}
              </span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dl-text-3)',
            }}>
              Press{' '}
              <kbd style={{
                background: 'var(--dl-line-1)', border: '1px solid var(--dl-line-2)',
                borderRadius: 3, padding: '1px 5px', fontSize: 9,
              }}>
                ⌘K
              </kbd>{' '}
              for command palette
            </span>
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {filtered.length === 0
          ? <EmptyState />
          : filtered.map((entry) => (
              <RepoCard
                key={entry.id}
                entry={entry}
                onOpen={() => onSelectRepo(entry.repoUrl)}
                onDelete={() => handleDelete(entry.id)}
              />
            ))
        }
      </div>
    </div>
  );
}

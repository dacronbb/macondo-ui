import { useState, useEffect } from 'react';
import type { MoveInfo } from '../api/types';

function parseCoords(coords: string): { row: number; col: number; across: boolean } | null {
  if (!coords) return null;
  const acrossMatch = coords.match(/^(\d+)([A-O])$/);
  if (acrossMatch) return { row: parseInt(acrossMatch[1]) - 1, col: acrossMatch[2].charCodeAt(0) - 65, across: true };
  const downMatch = coords.match(/^([A-O])(\d+)$/);
  if (downMatch) return { row: parseInt(downMatch[2]) - 1, col: downMatch[1].charCodeAt(0) - 65, across: false };
  return null;
}

function formatTilesWithBoard(tiles: string, coords: string, board?: string[][]): string {
  if (!tiles || !board) return tiles || '';
  const pos = parseCoords(coords);
  if (!pos) return tiles;
  let r = pos.row, c = pos.col, result = '', i = 0;
  while (i < tiles.length) {
    if (tiles[i] === '.') {
      let group = '';
      while (i < tiles.length && tiles[i] === '.') {
        group += (board[r]?.[c] ?? '').toUpperCase();
        if (pos.across) c++; else r++;
        i++;
      }
      if (group) result += `(${group})`;
    } else {
      result += tiles[i];
      if (pos.across) c++; else r++;
      i++;
    }
  }
  return result;
}

const iconBtn: React.CSSProperties = {
  background: 'var(--bg-raised)', border: 'none', padding: '3px 5px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center', borderRadius: 6, lineHeight: 0,
  boxShadow: 'var(--shadow-neu-sm)', color: 'var(--cw)',
};

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AddIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21V6" />
    <path d="M5 13l7-7 7 7" />
  </svg>
);

const RemoveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 4px', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '4px 4px' };
const firstThStyle: React.CSSProperties = { ...thStyle, paddingLeft: 8 };
const firstTdStyle: React.CSSProperties = { ...tdStyle, paddingLeft: 8 };
const lastThStyle: React.CSSProperties = { padding: '4px 8px 4px 4px' };
const lastTdStyle: React.CSSProperties = { ...tdStyle, paddingRight: 8, whiteSpace: 'nowrap', textAlign: 'right' };

interface MoveListProps {
  moves: MoveInfo[];
  board?: string[][];
  onPlayMove: (index: number) => void;
  onAddMove?: (index: number) => void;
  analysisMode?: boolean;
  loading?: boolean;
}

export function MoveList({ moves, board, onPlayMove, onAddMove, analysisMode, loading }: MoveListProps) {

  const [removed, setRemoved] = useState<Set<number>>(new Set());
  useEffect(() => { setRemoved(new Set()); }, [moves]);

  if (moves.length === 0) {
    return (
      <div style={{ padding: 12, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
        {loading ? 'Analyzing…' : 'Click "Generate" to see moves'}
      </div>
    );
  }

  const visible = moves.filter(m => !removed.has(m.index));

  return (
    <div style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Lexend', sans-serif", tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <th style={firstThStyle}>Move</th>
            <th style={{ ...thStyle, width: 48 }}>Score</th>
            <th style={{ ...thStyle, width: 60 }}>Leave</th>
            <th style={{ ...thStyle, width: 56 }}>Equity</th>
            {analysisMode && <th style={{ ...thStyle, width: 44 }}>Win%</th>}
            <th style={{ ...lastThStyle, width: 66 }} />
          </tr>
        </thead>
        <tbody>
          {visible.map((m, idx) => {
            const moveText = m.action === 'play'
              ? `${m.coords} ${formatTilesWithBoard(m.tiles || '', m.coords || '', board)}`
              : m.action === 'exchange' ? `exch ${m.tiles}` : m.action;

            return (
              <tr
                key={m.index}
                style={{ borderBottom: idx < visible.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                onDoubleClick={() => onPlayMove(m.index)}
              >
                <td style={{ ...firstTdStyle, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={moveText}>{moveText}</td>
                <td style={{ ...tdStyle, color: 'var(--text)' }}>{m.score}</td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{m.leave}</td>
                <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{m.equity.toFixed(1)}</td>
                {analysisMode && (
                  <td style={{ ...tdStyle, color: m.winPct != null ? 'var(--text)' : 'var(--text-muted)' }}>
                    {m.winPct != null ? `${(m.winPct * 100).toFixed(1)}%` : '—'}
                  </td>
                )}
                <td style={lastTdStyle}>
                  {analysisMode && (
                    <button
                      onClick={() => setRemoved(prev => new Set(prev).add(m.index))}
                      style={{ ...iconBtn, marginRight: 3 }}
                      title="Remove from analysis"
                    >
                      <RemoveIcon />
                    </button>
                  )}
                  {onAddMove && m.action === 'play' && (
                    <button
                      onClick={() => onAddMove(m.index)}
                      style={{ ...iconBtn, marginRight: 3 }}
                      title="Add to board"
                    >
                      <AddIcon />
                    </button>
                  )}
                  {!analysisMode && (
                    <button
                      onClick={() => onPlayMove(m.index)}
                      style={iconBtn}
                      title="Play"
                    >
                      <PlayIcon />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

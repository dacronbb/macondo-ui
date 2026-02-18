import type { GameState } from '../api/types';

const FULL_DISTRIBUTION: Record<string, number> = {
  A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,
  R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1,'?':2,
};

const VOWELS = new Set(['A','E','I','O','U']);
const LETTER_ORDER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?'.split('');

interface TilePoolProps {
  state: GameState | null;
}

export function TilePool({ state }: TilePoolProps) {
  if (!state) return null;

  const used: Record<string, number> = {};
  for (const row of state.board) {
    for (const cell of row) {
      if (cell) {
        const key = cell === cell.toLowerCase() ? '?' : cell;
        used[key] = (used[key] || 0) + 1;
      }
    }
  }

  const remaining: Record<string, number> = {};
  for (const letter of LETTER_ORDER) {
    const total = FULL_DISTRIBUTION[letter] || 0;
    remaining[letter] = Math.max(0, total - (used[letter] || 0));
  }

  let vowelCount = 0, consonantCount = 0;
  for (const letter of LETTER_ORDER) {
    if (letter === '?') continue;
    if (VOWELS.has(letter)) vowelCount += remaining[letter];
    else consonantCount += remaining[letter];
  }

  return (
    <div style={{
      background: 'var(--bg-raised)', borderRadius: 12, overflow: 'hidden',
      boxShadow: 'var(--shadow-neu)',
    }}>
      <h3 style={{
        margin: 0, padding: '8px 12px', fontSize: 13,
        color: 'var(--text-secondary)', background: 'transparent',
        borderBottom: '1px solid var(--border)',
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {state.bagCount} Unseen Tiles
      </h3>
      <div style={{
        padding: '8px 12px', fontFamily: "'Lexend', sans-serif",
        fontSize: 13, fontWeight: 600, color: 'var(--text)',
        lineHeight: '22px', display: 'flex', flexWrap: 'wrap', gap: '0 8px',
      }}>
        {LETTER_ORDER.map(letter => {
          const count = remaining[letter];
          if (count === 0) return null;
          return (
            <span key={letter} style={{
              whiteSpace: 'nowrap',
              color: letter === '?' ? 'var(--text-subtle)' : undefined,
            }}>
              {(letter === '?' ? '?' : letter).repeat(count)}
            </span>
          );
        })}
        <div style={{
          borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6,
          fontSize: 12, color: 'var(--text-muted)', width: '100%',
        }}>
          {consonantCount} consonants, {vowelCount} vowels
        </div>
      </div>
    </div>
  );
}

import type { GameState } from '../api/types';

// Standard English Scrabble tile distribution
const FULL_DISTRIBUTION: Record<string, number> = {
  A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,
  R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1,'?':2,
};

const TILE_VALUES: Record<string, number> = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,
  R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,
};

const VOWELS = new Set(['A','E','I','O','U']);

// Letters in display order
const LETTER_ORDER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?'.split('');

interface TilePoolProps {
  state: GameState | null;
}

export function TilePool({ state }: TilePoolProps) {
  if (!state) return null;

  // Count tiles on the board
  const used: Record<string, number> = {};
  for (const row of state.board) {
    for (const cell of row) {
      if (cell) {
        // Lowercase = blank used as that letter
        const key = cell === cell.toLowerCase() ? '?' : cell;
        used[key] = (used[key] || 0) + 1;
      }
    }
  }

  // Don't subtract rack tiles — show unseen tiles (bag + opponent's rack)

  // Calculate remaining
  const remaining: Record<string, number> = {};
  for (const letter of LETTER_ORDER) {
    const total = FULL_DISTRIBUTION[letter] || 0;
    const usedCount = used[letter] || 0;
    remaining[letter] = Math.max(0, total - usedCount);
  }

  // Count vowels and consonants
  let vowelCount = 0;
  let consonantCount = 0;
  for (const letter of LETTER_ORDER) {
    if (letter === '?') continue;
    const count = remaining[letter];
    if (VOWELS.has(letter)) {
      vowelCount += count;
    } else {
      consonantCount += count;
    }
  }

  return (
    <div style={{
      background: '#1e1e1e',
      borderRadius: 6,
      border: '1px solid #333',
      overflow: 'hidden',
    }}>
      <h3 style={{
        margin: 0,
        padding: '8px 12px',
        fontSize: 13,
        color: '#aaa',
        background: '#252525',
        borderBottom: '1px solid #333',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {state.bagCount} Unseen Tiles
      </h3>
      <div style={{
        padding: '8px 12px',
        fontFamily: "'Lexend', sans-serif",
        fontSize: 13,
        fontWeight: 'bold',
        color: '#e0e0e0',
        lineHeight: '22px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0 8px',
      }}>
        {LETTER_ORDER.map(letter => {
          const count = remaining[letter];
          if (count === 0) return null;
          return (
            <span key={letter} style={{
              whiteSpace: 'nowrap',
              color: letter === '?' ? '#888' : undefined,
            }}>
              {(letter === '?' ? '?' : letter).repeat(count)}
            </span>
          );
        })}
        <div style={{
          borderTop: '1px solid #333',
          marginTop: 6,
          paddingTop: 6,
          fontSize: 12,
          color: '#888',
          width: '100%',
        }}>
          {consonantCount} consonants, {vowelCount} vowels
        </div>
      </div>
    </div>
  );
}

import type { MoveInfo } from '../api/types';

/**
 * Parse macondo coords (e.g. "8D" across, "D8" down) into row, col, direction.
 */
function parseCoords(coords: string): { row: number; col: number; across: boolean } | null {
  if (!coords) return null;
  const acrossMatch = coords.match(/^(\d+)([A-O])$/);
  if (acrossMatch) {
    return { row: parseInt(acrossMatch[1]) - 1, col: acrossMatch[2].charCodeAt(0) - 65, across: true };
  }
  const downMatch = coords.match(/^([A-O])(\d+)$/);
  if (downMatch) {
    return { row: parseInt(downMatch[2]) - 1, col: downMatch[1].charCodeAt(0) - 65, across: false };
  }
  return null;
}

/**
 * Resolve '.' in tiles using the board at the given coords.
 * E.g. tiles="D.G" at 8D across with board having 'O' at 8E => "D(O)G"
 */
function formatTilesWithBoard(tiles: string, coords: string, board?: string[][]): string {
  if (!tiles || !board) return tiles || '';
  const pos = parseCoords(coords);
  if (!pos) return tiles;
  let r = pos.row, c = pos.col;
  let result = '';
  for (const ch of tiles) {
    if (ch === '.' && board[r]?.[c]) {
      result += `(${board[r][c].toUpperCase()})`;
    } else {
      result += ch;
    }
    if (pos.across) c++; else r++;
  }
  return result;
}

interface MoveListProps {
  moves: MoveInfo[];
  board?: string[][];
  onPlayMove: (index: number) => void;
}

export function MoveList({ moves, board, onPlayMove }: MoveListProps) {
  if (moves.length === 0) {
    return (
      <div style={{ padding: 12, color: '#888', fontStyle: 'italic', fontSize: 13 }}>
        Click "Generate" to see moves
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Lexend', sans-serif" }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #444', color: '#888' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px' }}>#</th>
            <th style={{ textAlign: 'left', padding: '4px 6px' }}>Move</th>
            <th style={{ textAlign: 'right', padding: '4px 6px' }}>Score</th>
            <th style={{ textAlign: 'right', padding: '4px 6px' }}>Equity</th>
            <th style={{ textAlign: 'left', padding: '4px 6px' }}>Leave</th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m) => (
            <tr
              key={m.index}
              style={{
                borderBottom: '1px solid #333',
                cursor: 'pointer',
              }}
              onDoubleClick={() => onPlayMove(m.index)}
            >
              <td style={{ padding: '4px 6px', color: '#888' }}>{m.index}</td>
              <td style={{ padding: '4px 6px' }}>
                {m.action === 'play' ? `${m.coords} ${formatTilesWithBoard(m.tiles || '', m.coords || '', board)}` : m.action === 'exchange' ? `exch ${m.tiles}` : m.action}
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{m.score}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right' }}>{m.equity.toFixed(1)}</td>
              <td style={{ padding: '4px 6px', color: '#aaa' }}>{m.leave}</td>
              <td style={{ padding: '4px 6px' }}>
                <button
                  onClick={() => onPlayMove(m.index)}
                  style={{
                    background: '#4a7c59',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 3,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  Play
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

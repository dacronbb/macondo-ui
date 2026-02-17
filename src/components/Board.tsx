import type { GameState } from '../api/types';

const BONUS_MAP: Record<string, string> = {};
// Standard 15x15 Scrabble board bonus squares
const TW = [[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]];
const DW = [[1,1],[1,13],[2,2],[2,12],[3,3],[3,11],[4,4],[4,10],[7,7],
            [10,4],[10,10],[11,3],[11,11],[12,2],[12,12],[13,1],[13,13]];
const TL = [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],
            [13,5],[13,9]];
const DL = [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],
            [6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],
            [11,14],[12,6],[12,8],[14,3],[14,11]];

TW.forEach(([r,c]) => { BONUS_MAP[`${r},${c}`] = 'tw'; });
DW.forEach(([r,c]) => { BONUS_MAP[`${r},${c}`] = 'dw'; });
TL.forEach(([r,c]) => { BONUS_MAP[`${r},${c}`] = 'tl'; });
DL.forEach(([r,c]) => { BONUS_MAP[`${r},${c}`] = 'dl'; });

const BONUS_COLORS: Record<string, string> = {
  tw: '#ff3333',
  dw: '#ffaaaa',
  tl: '#3366ff',
  dl: '#aaccff',
};

const BONUS_LABELS: Record<string, string> = {
  tw: 'TW',
  dw: 'DW',
  tl: 'TL',
  dl: 'DL',
};

const TILE_VALUES: Record<string, number> = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,
  R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,
};

export interface BoardSelection {
  row: number;
  col: number;
  direction: 'across' | 'down';
}

interface BoardProps {
  state: GameState | null;
  selection: BoardSelection | null;
  tileInput: string;
  onSquareClick: (row: number, col: number) => void;
}

/** Convert row/col + direction to macondo coordinate string */
export function toCoords(sel: BoardSelection): string {
  const colLetter = String.fromCharCode(65 + sel.col); // A-O
  const rowNum = sel.row + 1; // 1-15
  if (sel.direction === 'across') {
    return `${rowNum}${colLetter}`; // e.g. "8D"
  }
  return `${colLetter}${rowNum}`; // e.g. "D8"
}

/**
 * Format tiles string, replacing '.' play-through markers with (LETTER) from the board.
 */
export function formatPlayThrough(tiles: string, coords: string, board?: string[][]): string {
  if (!tiles || !board || !coords) return tiles || '';
  const acrossMatch = coords.match(/^(\d+)([A-O])$/);
  const downMatch = coords.match(/^([A-O])(\d+)$/);
  let r: number, c: number, across: boolean;
  if (acrossMatch) {
    r = parseInt(acrossMatch[1]) - 1; c = acrossMatch[2].charCodeAt(0) - 65; across = true;
  } else if (downMatch) {
    r = parseInt(downMatch[2]) - 1; c = downMatch[1].charCodeAt(0) - 65; across = false;
  } else {
    return tiles;
  }
  let result = '';
  for (const ch of tiles) {
    if (ch === '.' && board[r]?.[c]) {
      result += `(${board[r][c].toUpperCase()})`;
    } else {
      result += ch;
    }
    if (across) c++; else r++;
  }
  return result;
}

/**
 * Build the full move string with play-through markers (.) for existing tiles.
 * Also adjusts the starting coordinate to include any contiguous existing tiles
 * before the selection point.
 *
 * Returns { coords, tiles } ready to send to the API, or null if invalid.
 */
export function buildMoveString(
  board: string[][],
  selection: BoardSelection,
  tileInput: string,
): { coords: string; tiles: string } | null {
  if (!tileInput) return null;

  const dim = board.length;
  const isAcross = selection.direction === 'across';

  // Helper to get board letter at (r, c)
  const getCell = (r: number, c: number): string => board[r]?.[c] || '';

  // 1. Scan backward from selection to find the true start of the word
  let startRow = selection.row;
  let startCol = selection.col;
  if (isAcross) {
    while (startCol > 0 && getCell(startRow, startCol - 1) !== '') {
      startCol--;
    }
  } else {
    while (startRow > 0 && getCell(startRow - 1, startCol) !== '') {
      startRow--;
    }
  }

  // 2. Walk forward from the true start, building the tiles string
  let r = startRow;
  let c = startCol;
  let ti = 0; // index into tileInput
  let tiles = '';
  let reachedSelection = false;

  while (r < dim && c < dim) {
    const existing = getCell(r, c);

    // Check if we've reached the selection point
    if (r === selection.row && c === selection.col) {
      reachedSelection = true;
    }

    if (existing) {
      // Existing tile -> play-through marker
      tiles += '.';
    } else if (reachedSelection && ti < tileInput.length) {
      // Empty square past selection -> place a typed tile
      // Use lowercase for blanks (tiles played from '?' on rack)
      tiles += tileInput[ti];
      ti++;
    } else if (!reachedSelection) {
      // Empty square before we've reached the selection - stop scanning backward extension
      // This shouldn't happen since we scanned backward only over existing tiles
      break;
    } else {
      // No more typed tiles to place
      break;
    }

    if (isAcross) c++;
    else r++;
  }

  // 3. After placing all typed tiles, extend forward to include trailing existing tiles
  while (r < dim && c < dim) {
    const existing = getCell(r, c);
    if (!existing) break;
    tiles += '.';
    if (isAcross) c++;
    else r++;
  }

  if (ti < tileInput.length) {
    // Couldn't place all tiles (ran off the board)
    return null;
  }

  // 4. Build adjusted coordinates
  const adjustedSelection: BoardSelection = {
    row: startRow,
    col: startCol,
    direction: selection.direction,
  };
  const coords = toCoords(adjustedSelection);

  return { coords, tiles };
}

/**
 * Build a map of preview tiles: {`row,col` -> letter} for the typed input.
 * Skips over squares that already have tiles on the board.
 */
function buildPreview(
  board: string[][] | undefined,
  selection: BoardSelection | null,
  tileInput: string,
): Map<string, string> {
  const preview = new Map<string, string>();
  if (!selection || !tileInput || !board) return preview;

  const dim = board.length;
  let r = selection.row;
  let c = selection.col;
  let ti = 0;

  while (ti < tileInput.length && r < dim && c < dim) {
    const existing = board[r]?.[c] || '';
    if (existing) {
      // Square already has a tile — skip over it (play-through)
      if (selection.direction === 'across') c++;
      else r++;
      continue;
    }
    preview.set(`${r},${c}`, tileInput[ti]);
    ti++;
    if (selection.direction === 'across') c++;
    else r++;
  }
  return preview;
}

export function Board({ state, selection, tileInput, onSquareClick }: BoardProps) {
  const dim = state?.board?.length || 15;
  const cellSize = 36;
  const preview = buildPreview(state?.board, selection, tileInput);

  return (
    <div style={{
      display: 'inline-block',
      border: '2px solid #333',
      background: '#1a6b3c',
      lineHeight: 0,
    }}>
      {Array.from({ length: dim }, (_, row) => (
        <div key={row} style={{ display: 'flex' }}>
          {Array.from({ length: dim }, (_, col) => {
            const letter = state?.board?.[row]?.[col] || '';
            const bonus = BONUS_MAP[`${row},${col}`];
            const isCenter = row === 7 && col === 7;
            const hasTile = letter !== '';
            const previewLetter = preview.get(`${row},${col}`);
            const isPreview = !!previewLetter;
            const isSelected = selection && selection.row === row && selection.col === col;

            let bg = '#c8b97a';
            if (!hasTile && !isPreview && bonus) bg = BONUS_COLORS[bonus];
            if (!hasTile && !isPreview && isCenter && !bonus) bg = '#ffaaaa';

            // Preview tiles get a distinct look
            if (isPreview) bg = '#ffe082';

            return (
              <div
                key={col}
                onClick={() => onSquareClick(row, col)}
                style={{
                  width: cellSize,
                  height: cellSize,
                  border: isSelected
                    ? '2px solid #ffff00'
                    : isPreview
                    ? '2px solid #ffa000'
                    : '1px solid #9a8a5a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: hasTile ? '#f5e6b8' : bg,
                  fontSize: (hasTile || isPreview) ? 16 : 9,
                  fontWeight: (hasTile || isPreview) ? 'bold' : 'normal',
                  color: isPreview
                    ? '#bf360c'
                    : hasTile
                    ? (letter === letter.toLowerCase() ? '#666' : '#222')
                    : '#fff',
                  fontFamily: "'Lexend', sans-serif",
                  position: 'relative',
                  boxShadow: isSelected
                    ? '0 0 6px rgba(255,255,0,0.6)'
                    : isPreview
                    ? '0 0 4px rgba(255,160,0,0.5)'
                    : hasTile ? 'inset 0 0 3px rgba(0,0,0,0.3)' : 'none',
                  borderRadius: (hasTile || isPreview) ? 2 : 0,
                  lineHeight: '1',
                  cursor: 'pointer',
                }}
                title={`${String.fromCharCode(65 + col)}${row + 1}`}
              >
                {isSelected && !hasTile && !isPreview && (
                  <span style={{
                    position: 'absolute',
                    bottom: 1,
                    right: 2,
                    fontSize: 8,
                    color: '#ffff00',
                    fontWeight: 'bold',
                  }}>
                    {selection.direction === 'across' ? '\u2192' : '\u2193'}
                  </span>
                )}
                {isPreview
                  ? <>
                      {previewLetter}
                      {previewLetter === previewLetter.toUpperCase() && TILE_VALUES[previewLetter.toUpperCase()] && (
                        <span style={{ position:'absolute', bottom:1, right:2, fontSize:8, fontWeight:'bold', color:'#bf360c', opacity:0.7 }}>
                          {TILE_VALUES[previewLetter.toUpperCase()]}
                        </span>
                      )}
                    </>
                  : hasTile
                  ? <>
                      {letter.toUpperCase()}
                      {letter === letter.toUpperCase() && TILE_VALUES[letter] && (
                        <span style={{ position:'absolute', bottom:1, right:2, fontSize:8, fontWeight:'bold', color:'#555' }}>
                          {TILE_VALUES[letter]}
                        </span>
                      )}
                    </>
                  : (bonus ? BONUS_LABELS[bonus] : (isCenter ? '\u2605' : ''))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

import type { GameState, PlacedTile } from '../api/types';
import { parsePosition } from '../utils/notation';

/** Returns the set of cell keys ("row,col") that were newly placed in the last move */
function getLastMoveCells(lastMove: string | undefined): Set<string> {
  const cells = new Set<string>();
  if (!lastMove) return cells;
  const parts = lastMove.split(' ');
  if (parts.length < 2) return cells;
  const [position, tiles] = parts; // ignore trailing "(score)" if present
  const parsed = parsePosition(position);
  if (!parsed) return cells;
  let { row, col } = parsed;
  const { isAcross } = parsed;
  for (const ch of tiles) {
    if (ch !== '.') cells.add(`${row},${col}`);
    if (isAcross) col++; else row++;
  }
  return cells;
}

const BONUS_MAP: Record<string, string> = {};
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

const BONUS_LABELS: Record<string, string> = {
  tw: 'TW', dw: 'DW', tl: 'TL', dl: 'DL',
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
  placedTiles: PlacedTile[];
  cellSize?: number;
  previewScore?: number | null;
  onSquareClick: (row: number, col: number) => void;
  onBoardPointerDown?: (row: number, col: number, e: React.PointerEvent) => void;
}

export function toCoords(sel: BoardSelection): string {
  const colLetter = String.fromCharCode(65 + sel.col);
  const rowNum = sel.row + 1;
  if (sel.direction === 'across') return `${rowNum}${colLetter}`;
  return `${colLetter}${rowNum}`;
}

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

/** Auto-detect direction from placed tiles */
function detectDirection(placedTiles: PlacedTile[], board: string[][]): 'across' | 'down' {
  if (placedTiles.length <= 1) {
    // Single tile: check board adjacency
    if (placedTiles.length === 1) {
      const { row, col } = placedTiles[0];
      const hasLeft = col > 0 && board[row]?.[col - 1] !== '';
      const hasRight = col < 14 && board[row]?.[col + 1] !== '';
      const hasAbove = row > 0 && board[row - 1]?.[col] !== '';
      const hasBelow = row < 14 && board[row + 1]?.[col] !== '';
      if ((hasAbove || hasBelow) && !hasLeft && !hasRight) return 'down';
    }
    return 'across';
  }
  // Multiple tiles: same row = across, same col = down
  const allSameRow = placedTiles.every(t => t.row === placedTiles[0].row);
  if (allSameRow) return 'across';
  return 'down';
}

export function buildMoveStringFromPlaced(
  board: string[][],
  placedTiles: PlacedTile[],
): { coords: string; tiles: string } | null {
  if (placedTiles.length === 0) return null;
  const dim = board.length;

  const direction = detectDirection(placedTiles, board);
  const isAcross = direction === 'across';

  // Build a map of placed tiles
  const placedMap = new Map<string, string>();
  for (const t of placedTiles) {
    placedMap.set(`${t.row},${t.col}`, t.letter);
  }

  // Sort placed tiles by position
  const sorted = [...placedTiles].sort((a, b) =>
    isAcross ? a.col - b.col : a.row - b.row
  );

  // Find the start of the word by walking backward from the leftmost/topmost placed tile
  let startRow = sorted[0].row;
  let startCol = sorted[0].col;
  const getCell = (r: number, c: number): string => board[r]?.[c] || '';

  if (isAcross) {
    while (startCol > 0 && getCell(startRow, startCol - 1) !== '') startCol--;
  } else {
    while (startRow > 0 && getCell(startRow - 1, startCol) !== '') startRow--;
  }

  // Walk forward building the tiles string
  const lastPlaced = sorted[sorted.length - 1];
  let r = startRow, c = startCol;
  let tiles = '';

  while (r < dim && c < dim) {
    const existing = getCell(r, c);
    const placed = placedMap.get(`${r},${c}`);

    if (existing) {
      tiles += '.';
    } else if (placed) {
      tiles += placed;
    } else {
      // Gap — if we haven't reached the last placed tile, there's a contiguity error
      if (isAcross ? c < lastPlaced.col : r < lastPlaced.row) {
        return null; // non-contiguous
      }
      break;
    }

    if (isAcross) c++; else r++;
  }

  // Continue through any trailing existing tiles
  while (r < dim && c < dim) {
    const existing = getCell(r, c);
    if (!existing) break;
    tiles += '.';
    if (isAcross) c++; else r++;
  }

  // Verify every placed tile was visited along the word path
  let vr = startRow, vc = startCol;
  const visitedPlaced = new Set<string>();
  for (const _ch of tiles) {
    const key = `${vr},${vc}`;
    if (placedMap.has(key)) visitedPlaced.add(key);
    if (isAcross) vc++; else vr++;
  }
  for (const t of placedTiles) {
    if (!visitedPlaced.has(`${t.row},${t.col}`)) return null;
  }

  const coords = toCoords({ row: startRow, col: startCol, direction });
  return { coords, tiles };
}

/** Find the start cell of the word formed by placed tiles (including run-up of existing tiles) */
function getWordStartCell(
  board: string[][],
  placedTiles: PlacedTile[],
): { row: number; col: number; isAcross: boolean } | null {
  if (placedTiles.length === 0) return null;
  const direction = detectDirection(placedTiles, board);
  const isAcross = direction === 'across';
  const sorted = [...placedTiles].sort((a, b) => isAcross ? a.col - b.col : a.row - b.row);
  let startRow = sorted[0].row;
  let startCol = sorted[0].col;
  if (isAcross) {
    while (startCol > 0 && (board[startRow]?.[startCol - 1] || '') !== '') startCol--;
  } else {
    while (startRow > 0 && (board[startRow - 1]?.[startCol] || '') !== '') startRow--;
  }
  return { row: startRow, col: startCol, isAcross };
}

/** Build preview map from PlacedTile array */
function buildPreviewFromPlaced(placedTiles: PlacedTile[]): Map<string, string> {
  const preview = new Map<string, string>();
  for (const t of placedTiles) {
    preview.set(`${t.row},${t.col}`, t.letter);
  }
  return preview;
}

/** Find the next empty square where the cursor should appear */
export function getCursorPos(
  board: string[][] | undefined,
  selection: BoardSelection | null,
  placedTiles: PlacedTile[],
): { row: number; col: number } | null {
  if (!selection || !board) return null;
  const dim = board.length;
  const placedSet = new Set(placedTiles.map(t => `${t.row},${t.col}`));
  let r = selection.row, c = selection.col;
  while (r < dim && c < dim) {
    const existing = board[r]?.[c] || '';
    if (!existing && !placedSet.has(`${r},${c}`)) {
      return { row: r, col: c };
    }
    if (selection.direction === 'across') c++; else r++;
  }
  return null;
}

// Helper to read a CSS variable value
function v(name: string): string {
  return `var(${name})`;
}

export function Board({ state, selection, placedTiles, cellSize = 36, previewScore, onSquareClick, onBoardPointerDown }: BoardProps) {
  const dim = state?.board?.length || 15;
  const labelSize = Math.round(cellSize * 0.5);
  const preview = buildPreviewFromPlaced(placedTiles);
  const cursorPos = getCursorPos(state?.board, selection, placedTiles);
  const lastMoveCells = getLastMoveCells(state?.lastMove);

  // Score chip position: cell before the word start
  const scoreChip = (() => {
    if (previewScore == null || !state?.board) return null;
    const ws = getWordStartCell(state.board, placedTiles);
    if (!ws) return null;
    const gap = 1;
    const gridLeft = labelSize + 1;
    const gridTop = labelSize + 1;
    let cx: number, cy: number;
    if (ws.isAcross) {
      cx = gridLeft + (ws.col - 1) * (cellSize + gap) + cellSize / 2;
      cy = gridTop + ws.row * (cellSize + gap) + cellSize / 2;
    } else {
      cx = gridLeft + ws.col * (cellSize + gap) + cellSize / 2;
      cy = gridTop + (ws.row - 1) * (cellSize + gap) + cellSize / 2;
    }
    return { cx, cy };
  })();

  const bonusBg: Record<string, string> = {
    tw: v('--tw'), dw: v('--dw'), tl: v('--tl'), dl: v('--dl'),
  };
  const bonusText: Record<string, string> = {
    tw: v('--tw-text'), dw: v('--dw-text'), tl: v('--tl-text'), dl: v('--dl-text'),
  };

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      {scoreChip && (
        <div style={{
          position: 'absolute',
          left: scoreChip.cx, top: scoreChip.cy,
          transform: 'translate(-50%, -50%)',
          background: v('--tile-bg'),
          outline: `2px solid ${v('--accent-green')}`,
          outlineOffset: '-2px',
          borderRadius: 6,
          minWidth: Math.round(cellSize * 0.85),
          height: Math.round(cellSize * 0.72),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.round(cellSize * 0.34),
          fontWeight: 700,
          fontFamily: "'Lexend', sans-serif",
          color: v('--cw'),
          zIndex: 10,
          pointerEvents: 'none',
          padding: '0 4px',
        }}>
          {previewScore}
        </div>
      )}
      <div style={{
        display: 'inline-flex', flexDirection: 'column', borderRadius: 10, overflow: 'hidden',
        boxShadow: v('--board-shadow'), lineHeight: 0, background: v('--board-bg'),
      }}>
        <div style={{ display: 'flex' }}>
          {/* +1 accounts for the 1px left border on the cell grid */}
          <div style={{ width: labelSize + 1, height: labelSize, background: v('--board-bg'), flexShrink: 0 }} />
          {Array.from({ length: dim }, (_, col) => (
            <div key={col} style={{
              width: cellSize, flexShrink: 0,
              marginLeft: col > 0 ? 1 : 0,  /* match the gap:1 between cells */
              textAlign: 'center', fontSize: Math.round(cellSize * 0.28),
              color: v('--board-label'), fontWeight: 500, lineHeight: `${labelSize}px`,
              background: v('--board-bg'),
            }}>
              {String.fromCharCode(65 + col)}
            </div>
          ))}
          <div style={{ width: labelSize, height: labelSize, background: v('--board-bg'), flexShrink: 0 }} />
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ display: 'flex', flexDirection: 'column', background: v('--board-bg') }}>
            {Array.from({ length: dim }, (_, row) => (
              <div key={row} style={{
                width: labelSize, height: cellSize, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: Math.round(cellSize * 0.28),
                color: v('--board-label'), fontWeight: 500,
                marginTop: row > 0 ? 1 : 0,
              }}>
                {row + 1}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: v('--bg'), border: `1px solid ${v('--bg')}` }}>
            {Array.from({ length: dim }, (_, row) => (
              <div key={row} style={{ display: 'flex', gap: 1 }}>
              {Array.from({ length: dim }, (_, col) => {
              const letter = state?.board?.[row]?.[col] || '';
              const bonus = BONUS_MAP[`${row},${col}`];
              const isCenter = row === 7 && col === 7;
              const hasTile = letter !== '';
              const previewLetter = preview.get(`${row},${col}`);
              const isPreview = !!previewLetter;
              const isSelected = cursorPos && cursorPos.row === row && cursorPos.col === col;
              const isBlank = hasTile && letter === letter.toLowerCase();
              const isPreviewBlank = isPreview && previewLetter === previewLetter!.toLowerCase();
              const cellKey = `${row},${col}`;
              const isLastMove = !isPreview && hasTile && lastMoveCells.has(cellKey);

              let bg = v('--board-bg');
              if (!hasTile && !isPreview && bonus) bg = bonusBg[bonus];
              if (!hasTile && !isPreview && isCenter && !bonus) bg = v('--center');
              if (hasTile && !isLastMove) bg = v('--tile-bg');
              if (isLastMove) bg = v('--tile-last-bg');

              const selColor = isSelected && bonus ? bonusText[bonus] : v('--cw');

              return (
                <div
                  key={col}
                  onClick={() => onSquareClick(row, col)}
                  onPointerDown={isPreview && onBoardPointerDown ? (e) => onBoardPointerDown(row, col, e) : undefined}
                  style={{
                    width: cellSize, height: cellSize,
                    border: isSelected ? `2px solid ${selColor}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isPreview ? v('--tile-bg') : hasTile ? bg : bg,
                    fontSize: (hasTile || isPreview) ? Math.round(cellSize * 0.44) : Math.round(cellSize * 0.25),
                    fontWeight: (hasTile || isPreview) ? 600 : 500,
                    color: isPreview
                      ? (isPreviewBlank ? v('--cw-blank') : v('--cw'))
                      : hasTile
                      ? (isBlank ? v('--cw-blank') : v('--cw'))
                      : (bonus ? bonusText[bonus] : v('--text-muted')),
                    fontFamily: "'Lexend', sans-serif",
                    position: 'relative',
                    boxShadow: isSelected
                      ? `0 0 4px ${selColor}`
                      : 'none',
                    borderRadius: 0,
                    lineHeight: '1', cursor: 'pointer',
                    paddingBottom: 2,
                    touchAction: isPreview ? 'none' : undefined,
                  }}
                  title={`${String.fromCharCode(65 + col)}${row + 1}`}
                >
                  {isSelected && !hasTile && !isPreview && selection && (() => {
                    const hasLabel = !!(bonus || isCenter);
                    return (
                      <span style={{
                        position: 'absolute',
                        fontSize: Math.round(cellSize * (hasLabel ? 0.28 : 0.45)),
                        color: selColor, fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        ...(hasLabel
                          ? { left: 0, right: 0, top: '62%', bottom: 0 }
                          : { inset: 0 }),
                      }}>
                        {selection.direction === 'across' ? '\u2192' : '\u2193'}
                      </span>
                    );
                  })()}
                  {isPreview
                    ? <>
                        {previewLetter!.toUpperCase()}
                        {!isPreviewBlank && TILE_VALUES[previewLetter!.toUpperCase()] && (
                          <span style={{ position:'absolute', bottom: Math.round(cellSize * 0.08), right: Math.round(cellSize * 0.08), fontSize: Math.round(cellSize * 0.22), fontWeight:600, color: v('--tile-preview-text'), opacity:0.6 }}>
                            {TILE_VALUES[previewLetter!.toUpperCase()]}
                          </span>
                        )}
                      </>
                    : hasTile
                    ? <>
                        {letter.toUpperCase()}
                        {!isBlank && TILE_VALUES[letter] && (
                          <span style={{ position:'absolute', bottom: Math.round(cellSize * 0.08), right: Math.round(cellSize * 0.08), fontSize: Math.round(cellSize * 0.22), fontWeight:600, color: v('--cw-subtle') }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', background: v('--board-bg') }}>
            {Array.from({ length: dim }, (_, row) => (
              <div key={row} style={{ width: labelSize, height: cellSize, marginTop: row > 0 ? 1 : 0 }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ width: labelSize, height: labelSize, background: v('--board-bg') }} />
          <div style={{ flex: 1, height: labelSize, background: v('--board-bg') }} />
          <div style={{ width: labelSize, height: labelSize, background: v('--board-bg') }} />
        </div>
      </div>
    </div>
  );
}

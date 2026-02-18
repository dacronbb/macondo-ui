import type { GameState } from '../api/types';

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
  tileInput: string;
  cellSize?: number;
  onSquareClick: (row: number, col: number) => void;
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

export function buildMoveString(
  board: string[][],
  selection: BoardSelection,
  tileInput: string,
): { coords: string; tiles: string } | null {
  if (!tileInput) return null;
  const dim = board.length;
  const isAcross = selection.direction === 'across';
  const getCell = (r: number, c: number): string => board[r]?.[c] || '';

  let startRow = selection.row;
  let startCol = selection.col;
  if (isAcross) {
    while (startCol > 0 && getCell(startRow, startCol - 1) !== '') startCol--;
  } else {
    while (startRow > 0 && getCell(startRow - 1, startCol) !== '') startRow--;
  }

  let r = startRow, c = startCol, ti = 0, tiles = '', reachedSelection = false;
  while (r < dim && c < dim) {
    const existing = getCell(r, c);
    if (r === selection.row && c === selection.col) reachedSelection = true;
    if (existing) { tiles += '.'; }
    else if (reachedSelection && ti < tileInput.length) { tiles += tileInput[ti]; ti++; }
    else if (!reachedSelection) { break; }
    else { break; }
    if (isAcross) c++; else r++;
  }
  while (r < dim && c < dim) {
    const existing = getCell(r, c);
    if (!existing) break;
    tiles += '.';
    if (isAcross) c++; else r++;
  }
  if (ti < tileInput.length) return null;
  const coords = toCoords({ row: startRow, col: startCol, direction: selection.direction });
  return { coords, tiles };
}

function buildPreview(
  board: string[][] | undefined,
  selection: BoardSelection | null,
  tileInput: string,
): Map<string, string> {
  const preview = new Map<string, string>();
  if (!selection || !tileInput || !board) return preview;
  const dim = board.length;
  let r = selection.row, c = selection.col, ti = 0;
  while (ti < tileInput.length && r < dim && c < dim) {
    const existing = board[r]?.[c] || '';
    if (existing) {
      if (selection.direction === 'across') c++; else r++;
      continue;
    }
    preview.set(`${r},${c}`, tileInput[ti]);
    ti++;
    if (selection.direction === 'across') c++; else r++;
  }
  return preview;
}

// Helper to read a CSS variable value
function v(name: string): string {
  return `var(${name})`;
}

export function Board({ state, selection, tileInput, cellSize = 36, onSquareClick }: BoardProps) {
  const dim = state?.board?.length || 15;
  const labelSize = Math.round(cellSize * 0.5);
  const preview = buildPreview(state?.board, selection, tileInput);

  const bonusBg: Record<string, string> = {
    tw: v('--tw'), dw: v('--dw'), tl: v('--tl'), dl: v('--dl'),
  };
  const bonusText: Record<string, string> = {
    tw: v('--tw-text'), dw: v('--dw-text'), tl: v('--tl-text'), dl: v('--dl-text'),
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <div style={{
        display: 'inline-flex', flexDirection: 'column', borderRadius: 10, overflow: 'hidden',
        boxShadow: v('--board-shadow'), lineHeight: 0, background: v('--board-bg'),
      }}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: labelSize, height: labelSize, background: v('--board-bg') }} />
          {Array.from({ length: dim }, (_, col) => (
            <div key={col} style={{
              width: cellSize, textAlign: 'center', fontSize: Math.round(cellSize * 0.28),
              color: v('--board-label'), fontWeight: 500, lineHeight: `${labelSize}px`,
              background: v('--board-bg'),
            }}>
              {String.fromCharCode(65 + col)}
            </div>
          ))}
          <div style={{ width: labelSize, height: labelSize, background: v('--board-bg') }} />
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
              const isSelected = selection && selection.row === row && selection.col === col;
              const isBlank = hasTile && letter === letter.toLowerCase();
              const isPreviewBlank = isPreview && previewLetter === previewLetter!.toLowerCase();

              let bg = v('--board-bg');
              if (!hasTile && !isPreview && bonus) bg = bonusBg[bonus];
              if (!hasTile && !isPreview && isCenter && !bonus) bg = v('--center');
              if (isPreview) bg = v('--tile-preview-bg');

              return (
                <div
                  key={col}
                  onClick={() => onSquareClick(row, col)}
                  style={{
                    width: cellSize, height: cellSize,
                    border: isSelected ? `2px solid ${v('--selection-border')}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: hasTile ? v('--tile-bg') : bg,
                    fontSize: (hasTile || isPreview) ? Math.round(cellSize * 0.44) : Math.round(cellSize * 0.25),
                    fontWeight: (hasTile || isPreview) ? 600 : 500,
                    color: isPreview
                      ? (isPreviewBlank ? v('--tile-preview-blank') : v('--tile-preview-text'))
                      : hasTile
                      ? (isBlank ? v('--cw-blank') : v('--cw'))
                      : (bonus ? bonusText[bonus] : v('--text-muted')),
                    fontFamily: "'Lexend', sans-serif",
                    position: 'relative',
                    boxShadow: isSelected
                      ? `0 0 4px ${v('--selection-glow')}`
                      : 'none',
                    borderRadius: 0,
                    lineHeight: '1', cursor: 'pointer',
                    paddingBottom: 2,
                  }}
                  title={`${String.fromCharCode(65 + col)}${row + 1}`}
                >
                  {isSelected && !hasTile && !isPreview && (
                    <span style={{
                      position: 'absolute', bottom: Math.round(cellSize * 0.03), right: Math.round(cellSize * 0.06), fontSize: Math.round(cellSize * 0.22),
                      color: v('--selection-arrow'), fontWeight: 'bold',
                    }}>
                      {selection.direction === 'across' ? '\u2192' : '\u2193'}
                    </span>
                  )}
                  {isPreview
                    ? <>
                        {previewLetter}
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

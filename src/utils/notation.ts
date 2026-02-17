/**
 * Convert macondo dot-notation tiles to display notation:
 * - Play-through tiles shown as (X) instead of .
 * - Blanks shown as lowercase
 *
 * @param position - macondo position string, e.g. "8D" (across) or "D8" (down)
 * @param tiles - tiles string with . for play-through, e.g. "D.G"
 * @param board - 15x15 board array
 * @returns display string like "D(O)G"
 */
export function formatTilesForDisplay(
  position: string | undefined,
  tiles: string | undefined,
  board: string[][] | undefined,
): string {
  if (!position || !tiles || !board) return tiles || '';
  if (!tiles.includes('.')) return tiles;

  // Parse position to get starting row, col, and direction
  const parsed = parsePosition(position);
  if (!parsed) return tiles;

  const { row, col, isAcross } = parsed;
  let r = row;
  let c = col;
  let result = '';

  for (const ch of tiles) {
    if (ch === '.') {
      const boardLetter = board[r]?.[c] || '?';
      result += `(${boardLetter.toUpperCase()})`;
    } else {
      result += ch;
    }
    if (isAcross) c++;
    else r++;
  }

  return result;
}

/**
 * Parse a macondo position string into row, col, direction.
 * "8D" = row 7, col 3, across (number first = across)
 * "D8" = row 7, col 3, down (letter first = down)
 */
function parsePosition(pos: string): { row: number; col: number; isAcross: boolean } | null {
  // Across: number then letter(s), e.g. "8D", "15A"
  const acrossMatch = pos.match(/^(\d+)([A-O])$/);
  if (acrossMatch) {
    return {
      row: parseInt(acrossMatch[1]) - 1,
      col: acrossMatch[2].charCodeAt(0) - 65,
      isAcross: true,
    };
  }

  // Down: letter then number, e.g. "D8", "A15"
  const downMatch = pos.match(/^([A-O])(\d+)$/);
  if (downMatch) {
    return {
      row: parseInt(downMatch[2]) - 1,
      col: downMatch[1].charCodeAt(0) - 65,
      isAcross: false,
    };
  }

  return null;
}

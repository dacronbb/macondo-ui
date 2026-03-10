import { useRef, useState, useEffect, useCallback } from 'react';

type BogglePhase = 'idle' | 'playing' | 'finished';

interface BoggleBoardProps {
  board: string[][];
  size: number;
  cellSize: number;
  phase: BogglePhase;
  onWordTrace: (word: string) => void;
}

export function BoggleBoard({ board, size, cellSize, phase, onWordTrace }: BoggleBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tracePath, setTracePath] = useState<[number, number][]>([]);

  // Use refs to avoid stale closures in the window pointerup handler.
  const tracePathRef = useRef<[number, number][]>([]);
  const isTracingRef = useRef(false);
  const boardRef = useRef(board);
  boardRef.current = board;
  const onWordTraceRef = useRef(onWordTrace);
  onWordTraceRef.current = onWordTrace;

  const gap = Math.round(cellSize * 0.1);
  const pitch = cellSize + gap;

  // Window-level pointerup: complete the trace.
  useEffect(() => {
    const handlePointerUp = () => {
      if (!isTracingRef.current) return;
      const path = tracePathRef.current;
      if (path.length > 0) {
        const word = path.map(([r, c]) => boardRef.current[r][c]).join('');
        onWordTraceRef.current(word);
      }
      isTracingRef.current = false;
      tracePathRef.current = [];
      setTracePath([]);
    };
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  const handleCellPointerDown = useCallback((e: React.PointerEvent, r: number, c: number) => {
    if (phase !== 'playing') return;
    // Release capture so pointermove fires on whatever element is hovered.
    e.currentTarget.releasePointerCapture(e.pointerId);
    isTracingRef.current = true;
    const path: [number, number][] = [[r, c]];
    tracePathRef.current = path;
    setTracePath([[r, c]]);
  }, [phase]);

  // Direction-aware neighbor selection.
  //
  // The core insight: diagonal neighbors sit at pitch*√2 ≈ 1.41 * cellSize
  // from the last cell center, while orthogonal neighbors sit at only pitch ≈
  // 1.16 * cellSize.  When moving diagonally the pointer passes through the
  // "zone" of orthogonal cells before reaching the diagonal target, so a
  // pure-proximity approach always fires the wrong cell.
  //
  // Fix: use asymmetric proximity thresholds.  Orthogonal neighbors require
  // the pointer to be MUCH closer to their center than diagonal neighbors do.
  // This means that on a diagonal swipe the orthogonal cells are gated out
  // until the pointer physically enters them, while the target diagonal cell
  // is reachable with normal movement.
  //
  // Gate 1: pointer must leave the last cell first (prevents border jitter).
  // Per-candidate gate: diagonal threshold > orthogonal threshold.
  // Tiebreaker: tiny direction-alignment score for exact boundary cases.
  const handleContainerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isTracingRef.current || phase !== 'playing') return;
    const path = tracePathRef.current;
    if (path.length === 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const last = path[path.length - 1];
    const lastCX = last[1] * pitch + cellSize / 2;
    const lastCY = last[0] * pitch + cellSize / 2;

    const dx = px - lastCX;
    const dy = py - lastCY;
    const moveDist = Math.sqrt(dx * dx + dy * dy);

    // Gate 1: pointer must have left the last cell.
    if (moveDist < cellSize * 0.55) return;

    let bestCell: [number, number] | null = null;
    let bestScore = -Infinity;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = last[0] + dr;
        const nc = last[1] + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (path.some(([r, c]) => r === nr && c === nc)) continue;

        const cCX = nc * pitch + cellSize / 2;
        const cCY = nr * pitch + cellSize / 2;
        const dist = Math.sqrt((px - cCX) * (px - cCX) + (py - cCY) * (py - cCY));

        // Asymmetric proximity gate: diagonal neighbors can trigger from
        // farther away; orthogonal neighbors require pointer nearly at their
        // center so they cannot steal a diagonal swipe.
        const isDiagonal = dr !== 0 && dc !== 0;
        const threshold = isDiagonal ? cellSize * 0.55 : cellSize * 0.38;
        if (dist >= threshold) continue;

        // Tiny direction-alignment tiebreaker for contested boundary cases.
        let alignment = 0;
        if (moveDist > 1) {
          const toCX = dc * pitch;
          const toCY = dr * pitch;
          const toDist = Math.sqrt(toCX * toCX + toCY * toCY);
          alignment = (dx * toCX + dy * toCY) / (moveDist * toDist);
        }

        const score = -dist + alignment * cellSize * 0.1;
        if (score > bestScore) {
          bestScore = score;
          bestCell = [nr, nc];
        }
      }
    }

    if (bestCell) {
      const newPath = [...path, bestCell];
      tracePathRef.current = newPath;
      setTracePath(newPath);
    }
  }, [phase, size, pitch, cellSize]);

  const gridWidth = size * cellSize + (size - 1) * gap;
  const gridHeight = size * cellSize + (size - 1) * gap;

  return (
    <div
      ref={containerRef}
      onPointerMove={handleContainerPointerMove}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
        gap,
        width: gridWidth,
        height: gridHeight,
        position: 'relative',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {tracePath.length > 1 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: gridWidth,
            height: gridHeight,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
        >
          {tracePath.slice(1).map(([r, c], i) => {
            const [pr, pc] = tracePath[i];
            return (
              <line
                key={i}
                x1={pc * pitch + cellSize / 2}
                y1={pr * pitch + cellSize / 2}
                x2={c * pitch + cellSize / 2}
                y2={r * pitch + cellSize / 2}
                stroke="var(--cw)"
                strokeWidth={Math.round(cellSize * 0.09)}
                strokeLinecap="round"
                opacity={0.6}
              />
            );
          })}
        </svg>
      )}
      {board.map((row, r) =>
        row.map((letter, c) => {
          const isInPath = tracePath.some(([tr, tc]) => tr === r && tc === c);
          const radius = Math.round(cellSize * 0.18);

          return (
            <div
              key={`${r}-${c}`}
              data-row={r}
              data-col={c}
              onPointerDown={e => handleCellPointerDown(e, r, c)}
              style={{
                width: cellSize,
                height: cellSize,
                background: 'var(--bg-raised)',
                borderRadius: radius,
                boxShadow: isInPath ? 'var(--shadow-neu-inset)' : 'var(--shadow-neu)',
                color: isInPath ? 'var(--cw)' : 'var(--text)',
                fontSize: Math.round(cellSize * 0.42),
                fontWeight: 700,
                fontFamily: "'Lexend', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: phase === 'playing' ? 'pointer' : 'default',
                position: 'relative',
                transition: 'box-shadow 0.08s, color 0.08s',
              }}
            >
              <span style={{ fontSize: letter === 'QU' ? Math.round(cellSize * 0.30) : undefined }}>
                {letter === 'QU' ? 'Qu' : letter}
              </span>
              {isInPath && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: radius,
                  background: 'var(--cw)',
                  opacity: 0.12,
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

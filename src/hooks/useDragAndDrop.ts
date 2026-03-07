import { useRef, useCallback, useState } from 'react';
import type { PlacedTile } from '../api/types';

export interface DragSource {
  type: 'rack' | 'board';
  rackIndex?: number;    // for rack source
  row?: number;          // for board source
  col?: number;          // for board source
  letter: string;
}

export interface DragState {
  source: DragSource;
  pointerX: number;
  pointerY: number;
  isDragging: boolean;   // true once movement threshold is met
}

interface UseDragAndDropOptions {
  boardRef: React.RefObject<HTMLDivElement | null>;
  rackRef: React.RefObject<HTMLDivElement | null>;
  placedTiles: PlacedTile[];
  localRack: string[];
  board: string[][] | undefined;
  cellSize: number;
  onPlaceTile: (tile: PlacedTile) => void;
  onRemovePlacedTile: (row: number, col: number) => void;
  onMovePlacedTile: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  onReturnToRack: (row: number, col: number, insertIndex: number) => void;
  onReorderRack: (fromIndex: number, toIndex: number) => void;
  onBlankDrop: (row: number, col: number, rackIndex: number) => void;
}

const DRAG_THRESHOLD = 3;

export function useDragAndDrop({
  boardRef,
  rackRef,
  placedTiles,
  localRack,
  board,
  cellSize,
  onPlaceTile,
  onRemovePlacedTile,
  onMovePlacedTile,
  onReturnToRack,
  onReorderRack,
  onBlankDrop,
}: UseDragAndDropOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const sourceRef = useRef<DragSource | null>(null);
  const thresholdMet = useRef(false);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!sourceRef.current || !startPos.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    if (!thresholdMet.current) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      thresholdMet.current = true;
      document.body.style.userSelect = 'none';
    }

    setDragState({
      source: sourceRef.current,
      pointerX: e.clientX,
      pointerY: e.clientY,
      isDragging: true,
    });
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    document.body.style.userSelect = '';

    const source = sourceRef.current;
    const wasDragging = thresholdMet.current;
    sourceRef.current = null;
    startPos.current = null;
    thresholdMet.current = false;
    setDragState(null);

    if (!source || !wasDragging) return;

    // Determine drop target via hit testing
    const dropTarget = resolveDropTarget(e.clientX, e.clientY);

    if (!dropTarget) {
      // Dropped outside — bounce back (no-op)
      return;
    }

    if (dropTarget.type === 'board') {
      const { row, col } = dropTarget;
      const existingOnBoard = board?.[row]?.[col] || '';
      const existingPreview = placedTiles.find(t => t.row === row && t.col === col);

      if (source.type === 'rack') {
        if (existingOnBoard) {
          // Rack → occupied board square: bounce back
          return;
        }
        if (existingPreview) {
          // Rack → preview tile square: swap — displaced tile returns to rack
          const displaced = existingPreview;
          onRemovePlacedTile(displaced.row, displaced.col);
          // Check if blank
          if (source.letter === '?') {
            onBlankDrop(row, col, source.rackIndex!);
          } else {
            onPlaceTile({ row, col, letter: source.letter, rackIndex: source.rackIndex! });
          }
          return;
        }
        // Rack → empty board square
        if (source.letter === '?') {
          onBlankDrop(row, col, source.rackIndex!);
        } else {
          onPlaceTile({ row, col, letter: source.letter, rackIndex: source.rackIndex! });
        }
      } else {
        // Board preview → board
        if (source.row === row && source.col === col) return; // same spot
        if (existingOnBoard) return; // occupied
        if (existingPreview) return; // another preview tile there
        onMovePlacedTile(source.row!, source.col!, row, col);
      }
    } else if (dropTarget.type === 'rack') {
      if (source.type === 'board') {
        // Board preview → rack: return tile
        onReturnToRack(source.row!, source.col!, dropTarget.index);
      } else if (source.type === 'rack') {
        // Rack → rack: reorder
        if (source.rackIndex !== dropTarget.index) {
          onReorderRack(source.rackIndex!, dropTarget.index);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, placedTiles, localRack, onPlaceTile, onRemovePlacedTile, onMovePlacedTile, onReturnToRack, onReorderRack, onBlankDrop, handlePointerMove]);

  const resolveDropTarget = useCallback((x: number, y: number): { type: 'board'; row: number; col: number } | { type: 'rack'; index: number } | null => {
    // Check board first
    const boardEl = boardRef.current;
    if (boardEl) {
      const rect = boardEl.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        // Find the grid area (skip labels)
        const labelSize = Math.round(cellSize * 0.5);
        const gridLeft = rect.left + labelSize;
        const gridTop = rect.top + labelSize;
        const gap = 1; // 1px gap between cells
        const col = Math.floor((x - gridLeft) / (cellSize + gap));
        const row = Math.floor((y - gridTop) / (cellSize + gap));
        if (row >= 0 && row < 15 && col >= 0 && col < 15) {
          return { type: 'board', row, col };
        }
      }
    }

    // Check rack
    const rackEl = rackRef.current;
    if (rackEl) {
      const rect = rackEl.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        // Find tile slots within the rack
        const tileEls = rackEl.querySelectorAll('[data-rack-tile]');
        let bestIndex = 0;
        let bestDist = Infinity;
        tileEls.forEach((el, i) => {
          const tr = el.getBoundingClientRect();
          const cx = tr.left + tr.width / 2;
          const dist = Math.abs(x - cx);
          if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
          }
        });
        // If pointer is to the right of the center of the nearest tile, insert after
        const nearestEl = tileEls[bestIndex];
        if (nearestEl) {
          const tr = nearestEl.getBoundingClientRect();
          const cx = tr.left + tr.width / 2;
          if (x > cx && bestIndex < localRack.length - 1) {
            bestIndex++;
          }
        }
        return { type: 'rack', index: bestIndex };
      }
    }

    return null;
  }, [boardRef, rackRef, cellSize, localRack.length]);

  const startDrag = useCallback((source: DragSource, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    sourceRef.current = source;
    startPos.current = { x: e.clientX, y: e.clientY };
    thresholdMet.current = false;

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove, handlePointerUp]);

  const onRackPointerDown = useCallback((rackIndex: number, e: React.PointerEvent) => {
    const letter = localRack[rackIndex];
    if (letter === undefined) return;
    startDrag({ type: 'rack', rackIndex, letter }, e);
  }, [localRack, startDrag]);

  const onBoardPointerDown = useCallback((row: number, col: number, e: React.PointerEvent) => {
    const placed = placedTiles.find(t => t.row === row && t.col === col);
    if (!placed) return;
    startDrag({ type: 'board', row, col, letter: placed.letter }, e);
  }, [placedTiles, startDrag]);

  return {
    dragState,
    onRackPointerDown,
    onBoardPointerDown,
  };
}

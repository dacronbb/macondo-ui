import { createPortal } from 'react-dom';

const TILE_VALUES: Record<string, number> = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,
  R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,
};

interface DragGhostProps {
  letter: string;
  pointerX: number;
  pointerY: number;
  cellSize: number;
}

export function DragGhost({ letter, pointerX, pointerY, cellSize }: DragGhostProps) {
  const tileSize = Math.round(cellSize * 1.15);
  const displayLetter = letter === '?' ? ' ' : letter.toUpperCase();
  const isBlank = letter === '?' || letter === letter.toLowerCase();
  const isMobile = 'ontouchstart' in window;
  const offsetY = isMobile ? -40 : 0;

  return createPortal(
    <div style={{
      position: 'fixed',
      left: pointerX - tileSize / 2,
      top: pointerY - tileSize / 2 + offsetY,
      width: tileSize,
      height: tileSize,
      background: 'var(--tile-bg)',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(tileSize * 0.48),
      fontWeight: 600,
      fontFamily: "'Lexend', sans-serif",
      color: isBlank ? 'var(--cw-blank)' : 'var(--cw)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      pointerEvents: 'none',
      zIndex: 1000,
      transform: 'scale(1.1)',
      opacity: 0.9,
      paddingBottom: 2,
    }}>
      {displayLetter}
      {!isBlank && TILE_VALUES[letter.toUpperCase()] && (
        <span style={{
          position: 'absolute',
          bottom: Math.round(tileSize * 0.1),
          right: Math.round(tileSize * 0.1),
          fontSize: Math.round(tileSize * 0.22),
          fontWeight: 600,
          color: 'var(--cw-subtle)',
          lineHeight: 1,
        }}>
          {TILE_VALUES[letter.toUpperCase()]}
        </span>
      )}
    </div>,
    document.body
  );
}

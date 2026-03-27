import { useRef, useState } from 'react';

const TILE_VALUES: Record<string, number> = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,
  R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,
};

interface RackEditorProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  cellSize: number;
}

export function RackEditor({ value, onChange, onSave, cellSize }: RackEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const tileSize = Math.round(cellSize * 1.15);
  const gap = Math.round(cellSize * 0.17);

  const tileBase: React.CSSProperties = {
    width: tileSize, height: tileSize,
    background: 'var(--tile-bg)',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.round(tileSize * 0.48), fontWeight: 600,
    fontFamily: "'Lexend', sans-serif",
    boxShadow: 'var(--shadow-neu-sm)',
    position: 'relative',
    paddingBottom: 2,
    flexShrink: 0,
    userSelect: 'none',
  };

  const letters = value.split('');

  return (
    <div
      style={{ display: 'flex', gap: Math.round(cellSize * 0.5), justifyContent: 'center', alignItems: 'center', padding: '20px 0 4px', cursor: 'text' }}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase().replace(/[^A-Z?.]/g, '').slice(0, 7))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSave(); } }}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
      />

      <div style={{ display: 'flex', gap }}>
        {letters.map((letter, i) => (
          <div
            key={`${i}-${letter}`}
            style={{
              ...tileBase,
              color: (letter === '?' || letter === '.') ? 'var(--cw-blank)' : 'var(--cw)',
              animation: 'tile-in 0.12s ease-out',
            }}
          >
            {(letter === '?' || letter === '.') ? '' : letter}
            {letter !== '?' && letter !== '.' && TILE_VALUES[letter] && (
              <span style={{
                position: 'absolute',
                bottom: Math.round(tileSize * 0.1), right: Math.round(tileSize * 0.1),
                fontSize: Math.round(tileSize * 0.22), fontWeight: 600,
                color: 'var(--cw-subtle)', lineHeight: 1,
              }}>
                {TILE_VALUES[letter]}
              </span>
            )}
          </div>
        ))}

        {/* Blinking cursor */}
        {focused && (
          <div style={{
            width: letters.length < 7 ? Math.round(tileSize * 0.35) : 2,
            height: tileSize,
            background: 'var(--cw)',
            borderRadius: 2,
            flexShrink: 0,
            animation: 'cursor-blink 1s ease-in-out infinite',
          }} />
        )}

        {/* Ghost tiles when unfocused and empty */}
        {!focused && letters.length === 0 && Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{
            ...tileBase,
            background: 'var(--bg-raised)',
            boxShadow: 'var(--shadow-neu-inset)',
            opacity: 0.3,
          }} />
        ))}
      </div>
    </div>
  );
}

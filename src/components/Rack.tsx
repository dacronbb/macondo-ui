const TILE_VALUES: Record<string, number> = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,
  R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,
};

interface RackProps {
  rack: string;
  cellSize?: number;
  onShuffle?: () => void;
  onRecall?: () => void;
}

export function Rack({ rack, cellSize = 36, onShuffle, onRecall }: RackProps) {
  const tiles = rack.split('');
  const tileSize = Math.round(cellSize * 1.15);
  const btnSize = Math.round(tileSize * 0.9);

  const iconBtnStyle: React.CSSProperties = {
    width: btnSize, height: btnSize,
    borderRadius: '50%',
    background: 'var(--bg-raised)',
    border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-neu-sm)',
    flexShrink: 0,
    padding: 0,
  };

  const iconSize = Math.round(btnSize * 0.55);

  return (
    <div style={{ display: 'flex', gap: Math.round(cellSize * 0.5), justifyContent: 'center', alignItems: 'center', padding: '12px 0' }}>
      <button onClick={onRecall} style={iconBtnStyle} title="Recall tiles">
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="var(--cw)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v15" />
          <path d="M5 13l7 7 7-7" />
        </svg>
      </button>
      <div style={{ display: 'flex', gap: Math.round(cellSize * 0.17) }}>
        {tiles.map((letter, i) => (
          <div
            key={i}
            style={{
              width: tileSize, height: tileSize,
              background: 'var(--tile-bg)',
              border: 'none',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: Math.round(tileSize * 0.48), fontWeight: 600,
              fontFamily: "'Lexend', sans-serif",
              color: letter === '?' ? 'var(--cw-blank)' : 'var(--cw)',
              boxShadow: 'var(--shadow-neu-sm)',
              cursor: 'grab', position: 'relative',
            paddingBottom: 2,
            }}
          >
            {letter === '?' ? ' ' : letter}
            {letter !== '?' && TILE_VALUES[letter] && (
              <span style={{
                position: 'absolute', bottom: Math.round(tileSize * 0.1), right: Math.round(tileSize * 0.1),
                fontSize: Math.round(tileSize * 0.22), fontWeight: 600,
                color: 'var(--cw-subtle)', lineHeight: 1,
              }}>
                {TILE_VALUES[letter]}
              </span>
            )}
          </div>
        ))}
      </div>
      <button onClick={onShuffle} style={iconBtnStyle} title="Shuffle tiles">
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="var(--cw)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
      </button>
    </div>
  );
}

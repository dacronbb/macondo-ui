interface ControlsProps {
  onNewGame: () => void;
  onGenerate: () => void;
  onPass: () => void;
  onExchange: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  isPlaying: boolean;
  loading: boolean;
}

export function Controls({
  onNewGame, onGenerate, onPass, onExchange,
  onPrev, onNext, onFirst, onLast,
  isPlaying, loading,
}: ControlsProps) {
  const btnStyle = (accent = false) => ({
    background: 'var(--bg-raised)',
    color: accent ? 'var(--cw)' : 'var(--text-secondary)',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: loading ? 'wait' : 'pointer',
    fontSize: 13,
    fontWeight: 600 as const,
    opacity: loading ? 0.6 : 1,
    boxShadow: 'var(--shadow-neu-sm)',
  });

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <button onClick={onNewGame} style={btnStyle(true)} disabled={loading}>
        New Game
      </button>
      <button onClick={onGenerate} style={btnStyle(true)} disabled={loading || !isPlaying}>
        Generate
      </button>
      <button onClick={onExchange} style={btnStyle(true)} disabled={loading || !isPlaying}>
        Exchange
      </button>
      <button onClick={onPass} style={btnStyle(true)} disabled={loading || !isPlaying}>
        Pass
      </button>
      <div style={{ borderLeft: `1px solid var(--border-strong)`, margin: '0 4px' }} />
      <button onClick={onFirst} style={btnStyle()} disabled={loading}>|&lt;</button>
      <button onClick={onPrev} style={btnStyle()} disabled={loading}>&lt;</button>
      <button onClick={onNext} style={btnStyle()} disabled={loading}>&gt;</button>
      <button onClick={onLast} style={btnStyle()} disabled={loading}>&gt;|</button>
    </div>
  );
}

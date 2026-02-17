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
  const btnStyle = (color: string) => ({
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: loading ? 'wait' : 'pointer',
    fontSize: 13,
    fontWeight: 600 as const,
    opacity: loading ? 0.6 : 1,
  });

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 0' }}>
      <button onClick={onNewGame} style={btnStyle('#2196f3')} disabled={loading}>
        New Game
      </button>
      <button onClick={onGenerate} style={btnStyle('#4a7c59')} disabled={loading || !isPlaying}>
        Generate
      </button>
      <button onClick={onExchange} style={btnStyle('#9c27b0')} disabled={loading || !isPlaying}>
        Exchange
      </button>
      <button onClick={onPass} style={btnStyle('#666')} disabled={loading || !isPlaying}>
        Pass
      </button>
      <div style={{ borderLeft: '1px solid #444', margin: '0 4px' }} />
      <button onClick={onFirst} style={btnStyle('#555')} disabled={loading}>
        |&lt;
      </button>
      <button onClick={onPrev} style={btnStyle('#555')} disabled={loading}>
        &lt;
      </button>
      <button onClick={onNext} style={btnStyle('#555')} disabled={loading}>
        &gt;
      </button>
      <button onClick={onLast} style={btnStyle('#555')} disabled={loading}>
        &gt;|
      </button>
    </div>
  );
}

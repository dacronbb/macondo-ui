import { useState } from 'react';

interface ExchangeModalProps {
  rack: string;
  onExchange: (tiles: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export function ExchangeModal({ rack, onExchange, onCancel, loading }: ExchangeModalProps) {
  const tiles = rack.split('');
  const [selected, setSelected] = useState<boolean[]>(new Array(tiles.length).fill(false));

  const toggleTile = (index: number) => {
    setSelected(prev => { const next = [...prev]; next[index] = !next[index]; return next; });
  };

  const selectedCount = selected.filter(Boolean).length;
  const selectedTiles = tiles.filter((_, i) => selected[i]).join('');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--modal-overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--modal-bg)', borderRadius: 16,
        padding: 24, minWidth: 320,
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 16 }}>Exchange Tiles</h3>
        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
          Click tiles to select them for exchange:
        </p>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          {tiles.map((letter, i) => (
            <div key={i} onClick={() => toggleTile(i)} style={{
              width: 44, height: 44,
              background: selected[i] ? 'var(--cw)' : 'var(--tile-bg)',
              border: selected[i] ? '2px solid var(--cw)' : '2px solid transparent',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 600, fontFamily: "'Lexend', sans-serif",
              color: selected[i] ? 'var(--tile-bg)' : (letter === '?' ? 'var(--cw-blank)' : 'var(--cw)'),
              cursor: 'pointer', transition: 'all 0.1s',
              transform: selected[i] ? 'scale(1.05)' : 'scale(1)',
              paddingBottom: 2,
            }}>
              {letter === '?' ? ' ' : letter}
            </div>
          ))}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
          {selectedCount === 0
            ? 'Select tiles to exchange'
            : `Exchanging ${selectedCount} tile${selectedCount > 1 ? 's' : ''}: ${selectedTiles}`}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => { if (selectedCount > 0) onExchange(selectedTiles); }}
            disabled={selectedCount === 0 || loading} style={{
              background: selectedCount > 0 ? 'var(--cw)' : 'var(--bg-raised)',
              color: selectedCount > 0 ? 'var(--tile-bg)' : 'var(--text-disabled)',
              border: '2px solid ' + (selectedCount > 0 ? 'var(--cw)' : 'var(--border-strong)'),
              borderRadius: 10, padding: '10px 24px',
              fontSize: 14, fontWeight: 600,
              fontFamily: "'Lexend', sans-serif",
              cursor: selectedCount > 0 && !loading ? 'pointer' : 'not-allowed',
            }}>
            Exchange {selectedCount > 0 ? `(${selectedCount})` : ''}
          </button>
          <button onClick={onCancel} style={{
            background: 'var(--bg-raised)', color: 'var(--cw)',
            border: '2px solid var(--cw)', borderRadius: 10, padding: '10px 24px',
            fontSize: 14, fontWeight: 600, fontFamily: "'Lexend', sans-serif",
            cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

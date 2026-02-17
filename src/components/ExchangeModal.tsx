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
    setSelected(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const selectedCount = selected.filter(Boolean).length;
  const selectedTiles = tiles.filter((_, i) => selected[i]).join('');

  const handleSubmit = () => {
    if (selectedCount > 0) {
      onExchange(selectedTiles);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
    }} onClick={onCancel}>
      <div
        style={{
          background: '#1e1e1e',
          border: '1px solid #444',
          borderRadius: 8,
          padding: 24,
          minWidth: 320,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: 16 }}>
          Exchange Tiles
        </h3>
        <p style={{ margin: '0 0 12px', color: '#aaa', fontSize: 13 }}>
          Click tiles to select them for exchange:
        </p>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          {tiles.map((letter, i) => (
            <div
              key={i}
              onClick={() => toggleTile(i)}
              style={{
                width: 44,
                height: 44,
                background: selected[i] ? '#ff5252' : '#f5e6b8',
                border: selected[i] ? '3px solid #ff8a80' : '2px solid #9a8a5a',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 'bold',
                fontFamily: "'Lexend', sans-serif",
                color: selected[i] ? '#fff' : (letter === '?' ? '#888' : '#222'),
                boxShadow: selected[i]
                  ? '0 0 8px rgba(255,82,82,0.5)'
                  : '1px 2px 3px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                transition: 'all 0.1s',
                transform: selected[i] ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {letter === '?' ? ' ' : letter}
            </div>
          ))}
        </div>

        <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
          {selectedCount === 0
            ? 'Select tiles to exchange'
            : `Exchanging ${selectedCount} tile${selectedCount > 1 ? 's' : ''}: ${selectedTiles}`}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={handleSubmit}
            disabled={selectedCount === 0 || loading}
            style={{
              background: selectedCount > 0 ? '#ff9800' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '8px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedCount === 0 || loading ? 0.5 : 1,
            }}
          >
            Exchange {selectedCount > 0 ? `(${selectedCount})` : ''}
          </button>
          <button
            onClick={onCancel}
            style={{
              background: '#555',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '8px 24px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

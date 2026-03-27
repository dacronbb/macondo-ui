import { useState, useRef, useEffect } from 'react';

type GameId = 'scrabble' | 'boggle' | 'cardbbox';

interface GameDef {
  id: GameId;
  label: React.ReactNode;
}

const GAMES: GameDef[] = [
  {
    id: 'scrabble',
    // prettier-ignore
    label: <>s<span style={{ color: 'var(--cw)' }}>C</span>ra<span style={{ color: 'var(--cw)' }}>BB</span>le</>,
  },
  {
    id: 'boggle',
    // prettier-ignore
    label: <><span style={{ color: 'var(--cw)' }}>CBB</span>oggle</>,
  },
  {
    id: 'cardbbox',
    // prettier-ignore
    label: <><span style={{ color: 'var(--cw)' }}>C</span>ard<span style={{ color: 'var(--cw)' }}>BB</span>ox</>,
  },
];

interface GameSwitcherProps {
  current: GameId;
  onChange: (game: GameId) => void;
}

export function GameSwitcher({ current, onChange }: GameSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentGame = GAMES.find(g => g.id === current)!;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: "'Lexend', sans-serif",
        }}
      >
        <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
          {currentGame.label}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={{ flexShrink: 0, marginTop: 4, fill: 'var(--cw)' }}
        >
          <polygon points="2,3 10,3 6,9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            background: 'var(--modal-bg)',
            borderRadius: 12,
            padding: '6px 0',
            zIndex: 200,
            minWidth: 160,
            boxShadow: '8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light)',
          }}
        >
          {GAMES.map(game => (
            <button
              key={game.id}
              onClick={() => {
                setOpen(false);
                if (game.id !== current) onChange(game.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Lexend', sans-serif",
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                textAlign: 'left',
              }}
            >
              <span style={{ width: 14, color: 'var(--cw)', fontSize: 12 }}>
                {game.id === current ? '▶' : ''}
              </span>
              <span>{game.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

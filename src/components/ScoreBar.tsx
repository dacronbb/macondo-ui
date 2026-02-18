import type { GameState } from '../api/types';

interface ScoreBarProps {
  state: GameState | null;
  statusMsg?: string;
}

export function ScoreBar({ state, statusMsg }: ScoreBarProps) {
  if (!state) return null;

  const centerText = statusMsg || `Bag: ${state.bagCount} | Turn ${state.turnNumber} | ${state.playState}`;

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 12px', fontFamily: "'Lexend', sans-serif", fontSize: 14,
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        fontWeight: state.onTurn === 0 ? 700 : 400,
        color: state.onTurn === 0 ? 'var(--cw)' : 'var(--text-secondary)',
      }}>
        {state.onTurn === 0 ? '\u25B6 ' : ''}{state.playerNames[0]}: {state.scores[0]}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        {centerText}
      </div>
      <div style={{
        fontWeight: state.onTurn === 1 ? 700 : 400,
        color: state.onTurn === 1 ? 'var(--cw)' : 'var(--text-secondary)',
      }}>
        {state.playerNames[1]}: {state.scores[1]}{state.onTurn === 1 ? ' \u25C0' : ''}
      </div>
    </div>
  );
}

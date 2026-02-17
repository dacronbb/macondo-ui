import type { GameState } from '../api/types';

interface ScoreBarProps {
  state: GameState | null;
}

export function ScoreBar({ state }: ScoreBarProps) {
  if (!state) return null;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 16px',
      background: '#2a2a2a',
      color: '#fff',
      borderRadius: 6,
      fontFamily: "'Lexend', sans-serif",
      fontSize: 16,
      marginBottom: 8,
    }}>
      <div style={{
        fontWeight: state.onTurn === 0 ? 'bold' : 'normal',
        color: state.onTurn === 0 ? '#4fc3f7' : '#ccc',
      }}>
        {state.onTurn === 0 ? '\u25B6 ' : ''}{state.playerNames[0]}: {state.scores[0]}
      </div>
      <div style={{ color: '#888', fontSize: 13 }}>
        Bag: {state.bagCount} | Turn {state.turnNumber} | {state.playState}
      </div>
      <div style={{
        fontWeight: state.onTurn === 1 ? 'bold' : 'normal',
        color: state.onTurn === 1 ? '#4fc3f7' : '#ccc',
      }}>
        {state.playerNames[1]}: {state.scores[1]}{state.onTurn === 1 ? ' \u25C0' : ''}
      </div>
    </div>
  );
}

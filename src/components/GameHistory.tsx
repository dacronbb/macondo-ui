import type { EventInfo } from '../api/types';

interface GameHistoryProps {
  events: EventInfo[];
  playerNames: string[];
  onNavigate: (turn: number) => void;
}

/**
 * Format played tiles with play-through notation: D.G + wordsFormed["DOG"] => D(O)G
 */
function formatPlayedTiles(playedTiles: string, wordsFormed?: string[]): string {
  if (!playedTiles || !wordsFormed || wordsFormed.length === 0) return playedTiles || '';
  const mainWord = wordsFormed[0];
  if (mainWord.length !== playedTiles.length) return playedTiles;
  let result = '';
  for (let i = 0; i < playedTiles.length; i++) {
    if (playedTiles[i] === '.') {
      result += `(${mainWord[i]})`;
    } else {
      result += playedTiles[i];
    }
  }
  return result;
}

export function GameHistory({ events, playerNames, onNavigate }: GameHistoryProps) {
  if (events.length === 0) {
    return (
      <div style={{ padding: 12, color: '#888', fontStyle: 'italic', fontSize: 13 }}>
        No moves yet
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "'Lexend', sans-serif" }}>
        <tbody>
          {events.map((evt, i) => (
            <tr
              key={i}
              style={{
                borderBottom: '1px solid #333',
                cursor: 'pointer',
              }}
              onClick={() => onNavigate(evt.turn + 1)}
            >
              <td style={{ padding: '3px 6px', color: '#888', width: 20 }}>{evt.turn + 1}</td>
              <td style={{ padding: '3px 6px', color: evt.playerIndex === 0 ? '#4fc3f7' : '#f7a04f', width: 80 }}>
                {playerNames[evt.playerIndex] || `P${evt.playerIndex + 1}`}
              </td>
              <td style={{ padding: '3px 6px' }}>
                {evt.type === 'TILE_PLACEMENT_MOVE'
                  ? `${evt.position} ${formatPlayedTiles(evt.playedTiles || '', evt.wordsFormed)}`
                  : evt.type === 'EXCHANGE'
                  ? `exch ${evt.exchanged}`
                  : evt.type === 'PASS'
                  ? 'pass'
                  : evt.type}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                {evt.score > 0 ? `+${evt.score}` : evt.score}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', color: '#aaa' }}>
                {evt.cumulative}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

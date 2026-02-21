import type { EventInfo, GameState } from '../api/types';

interface ScoresheetProps {
  events: EventInfo[];
  state: GameState | null;
  statusMsg: string;
  onNavigate: (turn: number) => void;
}

function formatPlayedTiles(playedTiles: string, wordsFormed?: string[]): string {
  if (!playedTiles || !wordsFormed || wordsFormed.length === 0) return playedTiles || '';
  const mainWord = wordsFormed[0];
  if (mainWord.length !== playedTiles.length) return playedTiles;
  let result = '';
  for (let i = 0; i < playedTiles.length; i++) {
    if (playedTiles[i] === '.') result += `(${mainWord[i]})`;
    else result += playedTiles[i];
  }
  return result;
}

// A display-ready cell after merging challenge events
interface DisplayCell {
  description: string;
  scoreText: string;
  rack?: string;
  cumulative: number;
  playerIndex: number;
  turn: number;
  isPhony: boolean;
}

function isChallengeBonus(evt: EventInfo): boolean {
  return evt.type === 'CHALLENGE_BONUS';
}

function buildDisplayCells(events: EventInfo[], botIndex: number): DisplayCell[] {
  const cells: DisplayCell[] = [];
  let i = 0;

  while (i < events.length) {
    const evt = events[i];
    const isBotPlayer = evt.playerIndex === botIndex;

    // Check what follows this tile placement
    const next = i + 1 < events.length ? events[i + 1] : null;
    const hasChallengeBonus = next
      && next.playerIndex === evt.playerIndex
      && evt.type === 'TILE_PLACEMENT_MOVE'
      && isChallengeBonus(next);
    const hasPhonyReturn = next
      && next.playerIndex === evt.playerIndex
      && evt.type === 'TILE_PLACEMENT_MOVE'
      && next.type === 'PHONY_TILES_RETURNED';

    if (evt.type === 'TILE_PLACEMENT_MOVE') {
      const playDesc = `${evt.position} ${formatPlayedTiles(evt.playedTiles || '', evt.wordsFormed)}`;

      if (hasPhonyReturn && next) {
        // Play followed by phony return: merge into one cell
        cells.push({
          description: playDesc + ' *',
          scoreText: '',
          rack: !isBotPlayer ? evt.rack : undefined,
          cumulative: next.cumulative,
          playerIndex: evt.playerIndex,
          turn: evt.turn,
          isPhony: true,
        });
        i += 2; // skip the PHONY_TILES_RETURNED
      } else if (hasChallengeBonus && next) {
        // 5pt/10pt challenge: merge play + bonus into one cell
        // Bonus is in the cumulative difference since score field is 0
        const bonus = next.cumulative - evt.cumulative;
        cells.push({
          description: playDesc + ' [challenged]',
          scoreText: `+${evt.score}+${bonus}`,
          rack: !isBotPlayer ? evt.rack : undefined,
          cumulative: next.cumulative,
          playerIndex: evt.playerIndex,
          turn: evt.turn,
          isPhony: false,
        });
        i += 2; // skip the bonus event
      } else {
        cells.push({
          description: playDesc,
          scoreText: evt.score > 0 ? `+${evt.score}` : '',
          rack: !isBotPlayer ? evt.rack : undefined,
          cumulative: evt.cumulative,
          playerIndex: evt.playerIndex,
          turn: evt.turn,
          isPhony: false,
        });
        i++;
      }
    } else if (evt.type === 'PHONY_TILES_RETURNED') {
      // Phony challenged off: show play with *, score 0
      const playDesc = evt.playedTiles
        ? `${evt.position || ''} ${formatPlayedTiles(evt.playedTiles, evt.wordsFormed)}`.trim() + ' *'
        : 'Phony *';
      cells.push({
        description: playDesc,
        scoreText: '',
        rack: !isBotPlayer ? evt.rack : undefined,
        cumulative: evt.cumulative,
        playerIndex: evt.playerIndex,
        turn: evt.turn,
        isPhony: true,
      });
      i++;
    } else if (evt.type === 'UNSUCCESSFUL_CHALLENGE_TURN_LOSS') {
      cells.push({
        description: 'Unsuccessful challenge',
        scoreText: '',
        rack: undefined,
        cumulative: evt.cumulative,
        playerIndex: evt.playerIndex,
        turn: evt.turn,
        isPhony: false,
      });
      i++;
    } else if (evt.type === 'EXCHANGE') {
      cells.push({
        description: isBotPlayer ? `Exchange ${evt.exchanged?.length || 0}` : `Exch. ${evt.exchanged || ''}`,
        scoreText: '',
        rack: !isBotPlayer ? evt.rack : undefined,
        cumulative: evt.cumulative,
        playerIndex: evt.playerIndex,
        turn: evt.turn,
        isPhony: false,
      });
      i++;
    } else if (evt.type === 'PASS') {
      cells.push({
        description: 'Pass',
        scoreText: '',
        rack: undefined,
        cumulative: evt.cumulative,
        playerIndex: evt.playerIndex,
        turn: evt.turn,
        isPhony: false,
      });
      i++;
    } else {
      // Fallback: skip unknown challenge/bonus events that were already merged
      cells.push({
        description: evt.type,
        scoreText: evt.score > 0 ? `+${evt.score}` : evt.score < 0 ? String(evt.score) : '',
        rack: undefined,
        cumulative: evt.cumulative,
        playerIndex: evt.playerIndex,
        turn: evt.turn,
        isPhony: false,
      });
      i++;
    }
  }

  return cells;
}

export function Scoresheet({ events, state, statusMsg, onNavigate }: ScoresheetProps) {
  const playerNames = state?.playerNames || ['Player 1', 'Player 2'];
  const onTurn = state?.onTurn ?? -1;

  const botIndex = playerNames.indexOf('maCATdo');

  // Build merged display cells, then split by player
  const allCells = buildDisplayCells(events, botIndex);
  const p0Cells = allCells.filter(c => c.playerIndex === 0);
  const p1Cells = allCells.filter(c => c.playerIndex === 1);
  const roundCount = Math.max(p0Cells.length, p1Cells.length);

  return (
    <div className="panel-section" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header row */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {[0, 1].map(pi => (
          <div key={pi} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px',
            borderRight: pi === 0 ? '1px solid var(--border)' : undefined,
          }}>
            <span style={{
              fontWeight: onTurn === pi ? 700 : 600,
              color: onTurn === pi ? 'var(--cw)' : 'var(--text-secondary)',
              fontSize: 13, letterSpacing: 0.5,
            }}>
              {onTurn === pi ? '\u25B6 ' : ''}{playerNames[pi]}
            </span>
            <span style={{
              fontSize: 10, color: 'var(--text-subtle)',
              background: 'var(--bg)', borderRadius: 8, padding: '2px 6px',
            }}>
              25:00
            </span>
          </div>
        ))}
      </div>

      {/* Move rows */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {roundCount === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>
            No moves yet
          </div>
        ) : (
          Array.from({ length: roundCount }, (_, ri) => {
            const left = p0Cells[ri];
            const right = p1Cells[ri];
            return (
              <div key={ri} style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {[left, right].map((cell, ci) => (
                  <div
                    key={ci}
                    onClick={cell ? () => onNavigate(cell.turn + 1) : undefined}
                    style={{
                      flex: 1, padding: '6px 10px', cursor: cell ? 'pointer' : 'default',
                      borderRight: ci === 0 ? '1px solid var(--border)' : undefined,
                      minHeight: 36,
                    }}
                  >
                    {cell && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                            {cell.description}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, whiteSpace: 'nowrap' }}>
                            {cell.scoreText}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 1 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-subtle)', letterSpacing: 1 }}>
                            {cell.rack || ''}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--cw)', fontWeight: 700 }}>
                            {cell.cumulative}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

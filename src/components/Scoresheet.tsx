import { useRef, useState, useEffect } from 'react';
import type { EventInfo, GameState } from '../api/types';

interface ScoresheetProps {
  events: EventInfo[];
  state: GameState | null;
  statusMsg: string;
  onNavigate: (turn: number) => void;
  gameOver?: boolean;
}

function formatPlayedTiles(playedTiles: string, wordsFormed?: string[]): string {
  if (!playedTiles || !wordsFormed || wordsFormed.length === 0) return playedTiles || '';
  const mainWord = wordsFormed[0];
  if (mainWord.length !== playedTiles.length) return playedTiles;
  let result = '';
  let i = 0;
  while (i < playedTiles.length) {
    if (playedTiles[i] === '.') {
      let group = '';
      while (i < playedTiles.length && playedTiles[i] === '.') {
        group += mainWord[i];
        i++;
      }
      result += `(${group})`;
    } else {
      result += playedTiles[i];
      i++;
    }
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
      const isFinalPass = next?.type === 'END_RACK_PTS';
      cells.push({
        description: isFinalPass ? '' : 'Pass',
        scoreText: '',
        rack: undefined,
        cumulative: evt.cumulative,
        playerIndex: evt.playerIndex,
        turn: evt.turn,
        isPhony: false,
      });
      i++;
    } else if (evt.type === 'END_RACK_PTS') {
      cells.push({
        description: `Tiles: ${evt.rack || ''}`,
        scoreText: evt.endRackPoints ? `+${evt.endRackPoints}` : '',
        rack: undefined,
        cumulative: evt.cumulative,
        playerIndex: evt.playerIndex,
        turn: evt.turn,
        isPhony: false,
      });
      i++;
    } else if (evt.type === 'END_RACK_PENALTY') {
      cells.push({
        description: `Tiles: ${evt.rack || ''}`,
        scoreText: evt.lostScore ? `-${evt.lostScore}` : '',
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

const FULL_DISTRIBUTION: Record<string, number> = {
  A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,P:2,Q:1,
  R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1,'?':2,
};
const VOWELS = new Set(['A','E','I','O','U']);
const LETTER_ORDER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ?'.split('');

function computeRemaining(board: string[][], rack: string) {
  const used: Record<string, number> = {};
  for (const row of board) {
    for (const cell of row) {
      if (cell) {
        const key = cell === cell.toLowerCase() ? '?' : cell;
        used[key] = (used[key] || 0) + 1;
      }
    }
  }
  for (const ch of rack) {
    const key = ch === '?' ? '?' : ch.toUpperCase();
    used[key] = (used[key] || 0) + 1;
  }
  const remaining: Record<string, number> = {};
  for (const letter of LETTER_ORDER) {
    remaining[letter] = Math.max(0, (FULL_DISTRIBUTION[letter] || 0) - (used[letter] || 0));
  }
  return remaining;
}

export function Scoresheet({ events, state, statusMsg, onNavigate, gameOver }: ScoresheetProps) {
  const playerNames = state?.playerNames || ['Player 1', 'Player 2'];
  const onTurn = state?.onTurn ?? -1;

  const botIndex = playerNames.indexOf('maCATdo');

  // Build merged display cells, then split by player
  const allCells = buildDisplayCells(events, botIndex);
  const p0Cells = allCells.filter(c => c.playerIndex === 0);
  const p1Cells = allCells.filter(c => c.playerIndex === 1);
  const roundCount = Math.max(p0Cells.length, p1Cells.length);

  // Measure container width for proportional row heights
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const rowHeight = containerWidth > 0 ? containerWidth / 4 : 80;

  return (
    <div ref={containerRef} className="panel-section" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
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
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {roundCount === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 14, textAlign: 'center' }}>
            No moves yet
          </div>
        ) : (
          Array.from({ length: roundCount }, (_, ri) => {
            const left = p0Cells[ri];
            const right = p1Cells[ri];
            return (
              <div key={ri} style={{ display: 'flex', borderBottom: '1px solid var(--border)', height: rowHeight }}>
                {[left, right].map((cell, ci) => (
                  <div
                    key={ci}
                    onClick={cell ? () => onNavigate(cell.turn + 1) : undefined}
                    style={{
                      flex: 1, padding: '8px 12px', cursor: cell ? 'pointer' : 'default',
                      borderRight: ci === 0 ? '1px solid var(--border)' : undefined,
                      display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    }}
                  >
                    {cell && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
                            {cell.description}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4, whiteSpace: 'nowrap' }}>
                            {cell.scoreText}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-subtle)', letterSpacing: 1 }}>
                            {cell.rack || ''}
                          </span>
                          <span style={{ fontSize: 15, color: 'var(--cw)', fontWeight: 700 }}>
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

      {/* Unseen tiles — pinned at bottom */}
      {state && !gameOver && (() => {
        const remaining = computeRemaining(state.board, state.rack);
        let vowelCount = 0, consonantCount = 0;
        for (const letter of LETTER_ORDER) {
          if (letter === '?') continue;
          if (VOWELS.has(letter)) vowelCount += remaining[letter];
          else consonantCount += remaining[letter];
        }
        return (
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '8px 12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {state.bagCount} in bag
              </span>
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 12px',
                  background: 'var(--dl)', color: 'var(--dl-text)',
                  textAlign: 'center',
                  minWidth: `${String(consonantCount).length + 13}ch`,
                }}>
                  {vowelCount} vowels
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 12px',
                  background: 'var(--tl)', color: 'var(--tl-text)',
                  textAlign: 'center',
                }}>
                  {consonantCount} consonants
                </span>
              </div>
            </div>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              lineHeight: '22px', display: 'flex', flexWrap: 'wrap', gap: '0 8px',
            }}>
              {LETTER_ORDER.map(letter => {
                const count = remaining[letter];
                if (count === 0) return null;
                return (
                  <span key={letter} style={{
                    whiteSpace: 'nowrap',
                    color: undefined,
                  }}>
                    {(letter === '?' ? '?' : letter).repeat(count)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

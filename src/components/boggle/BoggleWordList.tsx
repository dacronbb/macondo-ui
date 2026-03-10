import type { CSSProperties } from 'react';

type BogglePhase = 'idle' | 'playing' | 'finished';

export interface FoundWord {
  word: string;
  score: number;
  valid: boolean;
}

export function boggleScore(word: string): number {
  // QU counts as one tile for scoring purposes
  const len = word.replace(/QU/g, 'Q').length;
  if (len <= 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  if (len === 7) return 5;
  return 11;
}

interface BoggleWordListProps {
  foundWords: FoundWord[];
  validWordSet: Set<string>;
  phase: BogglePhase;
}

const colStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const colHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  flexShrink: 0,
  borderBottom: '1px solid var(--border)',
};

function WordRow({ score, word, colorWord, strikethrough, subtle }: {
  score: number;
  word: string;
  colorWord?: boolean;
  strikethrough?: boolean;
  subtle?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '2px 10px', gap: 8 }}>
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: subtle ? 'var(--text-subtle)' : colorWord ? 'var(--cw)' : 'var(--text-disabled)',
        minWidth: 18,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {score}
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: subtle ? 'var(--text-subtle)' : colorWord ? 'var(--text)' : 'var(--text-disabled)',
        textDecoration: strikethrough ? 'line-through' : 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {word}
      </span>
    </div>
  );
}

export function BoggleWordList({ foundWords, validWordSet, phase }: BoggleWordListProps) {
  const foundWordStrings = new Set(foundWords.map(fw => fw.word));
  const missedWords = phase === 'finished'
    ? [...validWordSet]
        .filter(w => !foundWordStrings.has(w))
        .sort((a, b) => boggleScore(b) - boggleScore(a) || a.localeCompare(b))
    : [];

  const totalFound = foundWords.reduce((sum, fw) => sum + fw.score, 0);
  const totalMissed = missedWords.reduce((sum, w) => sum + boggleScore(w), 0);
  const showTwoColumns = phase === 'finished' && missedWords.length > 0;

  return (
    <div className="panel-section" style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

      {/* Found words column */}
      <div style={colStyle}>
        <div style={colHeaderStyle}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Your words
          </span>
          {foundWords.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cw)', flexShrink: 0 }}>
              {totalFound} pts
            </span>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 0' }}>
          {foundWords.length === 0 && phase === 'idle' && (
            <div style={{ padding: '12px 10px', color: 'var(--text-subtle)', fontSize: 12 }}>
              Start a game to find words
            </div>
          )}
          {foundWords.length === 0 && phase !== 'idle' && (
            <div style={{ padding: '12px 10px', color: 'var(--text-subtle)', fontSize: 12 }}>
              No words yet
            </div>
          )}
          {[...foundWords]
            .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
            .map((fw, i) => (
            <WordRow
              key={`${fw.word}-${i}`}
              score={fw.score}
              word={fw.word}
              colorWord={fw.valid}
              strikethrough={!fw.valid}
            />
          ))}
        </div>
      </div>

      {/* Missed words column (finished phase only) */}
      {showTwoColumns && (
        <div style={{ ...colStyle, borderLeft: '1px solid var(--border)' }}>
          <div style={colHeaderStyle}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-subtle)' }}>
              Missed
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', flexShrink: 0 }}>
              {totalMissed} pts
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 0' }}>
            {missedWords.map(w => (
              <WordRow
                key={w}
                score={boggleScore(w)}
                word={w}
                subtle
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

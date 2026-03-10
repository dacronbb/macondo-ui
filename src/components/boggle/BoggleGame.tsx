import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../../api/client';
import { GameSwitcher } from '../GameSwitcher';
import { Settings } from '../Settings';
import { BoggleBoard } from './BoggleBoard';
import { BoggleWordList, boggleScore } from './BoggleWordList';
import type { FoundWord } from './BoggleWordList';

export type BogglePhase = 'idle' | 'playing' | 'finished';

interface BoggleGameProps {
  lexicon: string;
  lexicons: string[];
  onChangeLexicon: (lex: string) => void;
  theme: string;
  colorway: string;
  onChangeTheme: (t: string) => void;
  onChangeColorway: (c: string) => void;
  onSwitchGame: (game: 'scrabble' | 'boggle') => void;
}

export function BoggleGame({
  lexicon,
  lexicons,
  onChangeLexicon,
  theme,
  colorway,
  onChangeTheme,
  onChangeColorway,
  onSwitchGame,
}: BoggleGameProps) {
  const [phase, setPhase] = useState<BogglePhase>('idle');
  const [size, setSize] = useState<4 | 5>(4);       // committed game size
  const [pendingSize, setPendingSize] = useState<4 | 5>(4); // settings selection
  const [board, setBoard] = useState<string[][]>([]);
  const [validWordSet, setValidWordSet] = useState<Set<string>>(new Set());
  const [foundWords, setFoundWords] = useState<FoundWord[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Viewport size for board sizing
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On idle, reflect pendingSize in the placeholder grid; during a game use the committed size.
  const activeSize = phase === 'idle' ? pendingSize : size;
  const cellSize = useMemo(() => {
    const byHeight = Math.floor((viewportHeight - 180) / (activeSize + 1));
    const byWidth = Math.floor((viewportWidth - 380) / activeSize);
    return Math.max(56, Math.min(Math.min(byHeight, byWidth), 120));
  }, [viewportHeight, viewportWidth, activeSize]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // End game when timer hits 0
  useEffect(() => {
    if (phase === 'playing' && secondsLeft === 0) {
      setPhase('finished');
    }
  }, [secondsLeft, phase]);

  const submitWord = useCallback((raw: string) => {
    const word = raw.toUpperCase().trim();
    if (!word) return;
    if (foundWords.some(fw => fw.word === word)) return;
    const valid = validWordSet.has(word);
    const score = valid ? boggleScore(word) : 0;
    setFoundWords(prev => [...prev, { word, score, valid }]);
  }, [foundWords, validWordSet]);

  const handleStart = useCallback(async () => {
    setSize(pendingSize);  // commit the pending selection
    setLoading(true);
    setError(null);
    try {
      const result = await api.boggle.newGame(pendingSize, lexicon);
      setBoard(result.board);
      setValidWordSet(new Set(result.validWords));
      setFoundWords([]);
      setSecondsLeft(180);
      setInputValue('');
      setPhase('playing');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [pendingSize, lexicon]);

  const handleEnd = useCallback(() => {
    setPhase('finished');
  }, []);

  const handleNewGame = useCallback(() => {
    setPhase('idle');
    setBoard([]);
    setFoundWords([]);
    setValidWordSet(new Set());
    setInputValue('');
    setSecondsLeft(180);
  }, []);

  const handleInputSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    submitWord(inputValue);
    setInputValue('');
  }, [inputValue, submitWord]);

  const handleTraceWord = useCallback((word: string) => {
    if (phase !== 'playing') return;
    submitWord(word);
  }, [phase, submitWord]);

  const handleSwitchGame = useCallback((game: 'scrabble' | 'boggle') => {
    if (game === 'boggle') return;
    if (phase === 'playing') {
      if (!window.confirm('Abandon current Boggle game?')) return;
    }
    onSwitchGame(game);
  }, [phase, onSwitchGame]);

  const timerColor = secondsLeft <= 30 ? 'var(--error-text, #c00)' : 'var(--cw)';
  const timerMins = Math.floor(secondsLeft / 60);
  const timerSecs = String(secondsLeft % 60).padStart(2, '0');

  // Show an idle grid placeholder when no board
  const displayBoard = board.length > 0
    ? board
    : Array.from({ length: activeSize }, () => Array.from({ length: activeSize }, () => ''));

  return (
    <div className="app">
      <div className="main-layout">
        {/* Board area */}
        <div className="board-area">
          {board.length > 0 ? (
            <BoggleBoard
              board={board}
              size={size}  // always the committed game size during play
              cellSize={cellSize}
              phase={phase}
              onWordTrace={handleTraceWord}
            />
          ) : (
            /* Idle placeholder grid */
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${activeSize}, ${cellSize}px)`,
              gap: Math.round(cellSize * 0.1),
            }}>
              {Array.from({ length: activeSize * activeSize }).map((_, i) => (
                <div key={i} style={{
                  width: cellSize,
                  height: cellSize,
                  background: 'var(--bg-raised)',
                  borderRadius: Math.round(cellSize * 0.18),
                  boxShadow: 'var(--shadow-neu)',
                }} />
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="action-bar">
            {phase === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {error && (
                  <div style={{ fontSize: 13, color: 'var(--error-text, #c00)' }}>{error}</div>
                )}
                <div className="action-bar-inner">
                  <button
                    className="action-btn action-btn-primary"
                    onClick={handleStart}
                    disabled={loading}
                  >
                    {loading ? 'Loading…' : 'Start game'}
                  </button>
                </div>
              </div>
            )}

            {(phase === 'playing' || phase === 'finished') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {phase === 'playing' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value.toUpperCase())}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleInputSubmit(); }
                      }}
                      placeholder="Type a word…"
                      className="woogles-input"
                      style={{ flex: 1, fontSize: 15, fontWeight: 600 }}
                    />
                    <button
                      className="action-btn action-btn-primary"
                      onClick={handleInputSubmit}
                      disabled={!inputValue.trim()}
                      style={{ flex: 'none', padding: '8px 16px' }}
                    >
                      Submit
                    </button>
                    <button
                      className="action-btn"
                      onClick={handleEnd}
                      style={{ flex: 'none', padding: '8px 16px' }}
                    >
                      End
                    </button>
                  </div>
                )}

                {phase === 'finished' && (
                  <div className="action-bar-inner">
                    <button className="action-btn action-btn-primary" onClick={handleNewGame}>
                      New game
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="side-panel">
          <header className="app-header" style={{ flexShrink: 0, paddingBottom: 16 }}>
            <GameSwitcher current="boggle" onChange={handleSwitchGame} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Timer */}
              {phase !== 'idle' && (
                <div style={{
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: "'Lexend', sans-serif",
                  color: timerColor,
                  minWidth: 58,
                  textAlign: 'right',
                  letterSpacing: 1,
                }}>
                  {timerMins}:{timerSecs}
                </div>
              )}
              <Settings
                currentLexicon={lexicon}
                lexicons={lexicons}
                theme={theme}
                colorway={colorway}
                onChangeLexicon={onChangeLexicon}
                onChangeTheme={onChangeTheme}
                onChangeColorway={onChangeColorway}
                loading={loading}
                boggleBoardSize={pendingSize}
                onChangeBoardSize={setPendingSize}
              />
            </div>
          </header>

          <BoggleWordList
            foundWords={foundWords}
            validWordSet={validWordSet}
            phase={phase}
          />
        </div>
      </div>
    </div>
  );
}

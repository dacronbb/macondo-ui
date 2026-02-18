import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { api } from './api/client';
import type { GameState, MoveInfo, EventInfo } from './api/types';
import { Board, toCoords, buildMoveString, formatPlayThrough } from './components/Board';
import type { BoardSelection } from './components/Board';
import { Rack } from './components/Rack';
import { ScoreBar } from './components/ScoreBar';
import { MoveList } from './components/MoveList';
import { GameHistory } from './components/GameHistory';
// Controls moved to action bar below the board
import { Settings } from './components/Settings';
import { ExchangeModal } from './components/ExchangeModal';
import { TilePool } from './components/TilePool';
import './App.css';

function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [moves, setMoves] = useState<MoveInfo[]>([]);
  const [history, setHistory] = useState<EventInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Settings state
  const [lexicon, setLexicon] = useState('CSW24');
  const [lexicons, setLexicons] = useState<string[]>(['CSW24', 'NWL23']);
  const [challengeRule, setChallengeRule] = useState('DOUBLE');

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('macondo-theme') || 'light');
  const [colorway, setColorway] = useState(() => localStorage.getItem('macondo-colorway') || 'green');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('macondo-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-colorway', colorway);
    localStorage.setItem('macondo-colorway', colorway);
  }, [colorway]);

  // Exchange modal state
  const [showExchange, setShowExchange] = useState(false);
  // Options menu state
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOptions) return;
    const handler = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setShowOptions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOptions]);

  // Board interaction state
  const [selection, setSelection] = useState<BoardSelection | null>(null);
  const [tileInput, setTileInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch available lexicons on mount
  useEffect(() => {
    api.getLexicons().then(setLexicons).catch(() => {});
  }, []);

  const clearError = () => setError(null);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    clearError();
    try {
      return await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const h = await api.getHistory();
      setHistory(h);
    } catch {
      // ignore
    }
  }, []);

  const handleNewGame = useCallback(async () => {
    const s = await withLoading(() => api.newGame(lexicon, challengeRule));
    if (s) {
      setState(s);
      setMoves([]);
      setHistory([]);
      setSelection(null);
      setTileInput('');
      setStatusMsg(`New game (${s.lexicon}, ${s.challengeRule})`);
    }
  }, [withLoading, lexicon, challengeRule]);

  const handleGenerate = useCallback(async () => {
    const m = await withLoading(() => api.generate(15));
    if (m) {
      setMoves(m);
      setStatusMsg(`Generated ${m.length} moves`);
    }
  }, [withLoading]);

  const handlePlayMove = useCallback(async (index: number) => {
    const s = await withLoading(() => api.playMoveFromList(index));
    if (s) {
      setState(s);
      setMoves([]);
      setSelection(null);
      setTileInput('');
      await refreshHistory();
      if (s.phonyChallenged) {
        setStatusMsg(`PHONY CHALLENGED! Move #${index} was removed from the board.`);
      } else {
        setStatusMsg(`Played move #${index}`);
      }
    }
  }, [withLoading, refreshHistory]);

  const handleAIPlay = useCallback(async () => {
    const result = await withLoading(() => api.aiPlay());
    if (result) {
      setState(result.state);
      setMoves([]);
      setSelection(null);
      setTileInput('');
      await refreshHistory();
      const parts = result.move.split(' ');
      const aiCoords = parts[0], aiTiles = parts[1] || '';
      setStatusMsg(`AI played: ${aiCoords} ${formatPlayThrough(aiTiles, aiCoords, result.state.board)} (+${result.score})`);
    }
  }, [withLoading, refreshHistory]);

  const handlePass = useCallback(async () => {
    const s = await withLoading(() => api.playPass());
    if (s) {
      setState(s);
      setMoves([]);
      setSelection(null);
      setTileInput('');
      await refreshHistory();
      setStatusMsg('Passed');
    }
  }, [withLoading, refreshHistory]);

  const handleExchange = useCallback(async (tiles: string) => {
    const s = await withLoading(() => api.playExchange(tiles));
    if (s) {
      setState(s);
      setMoves([]);
      setSelection(null);
      setTileInput('');
      setShowExchange(false);
      await refreshHistory();
      setStatusMsg(`Exchanged ${tiles.length} tile${tiles.length > 1 ? 's' : ''}`);
    }
  }, [withLoading, refreshHistory]);

  const handleNavigate = useCallback(async (action: string) => {
    const s = await withLoading(() => api.navigate(action));
    if (s) {
      setState(s);
      setMoves([]);
      setStatusMsg(`Navigated: ${action}`);
    }
  }, [withLoading]);

  const handleNavigateToTurn = useCallback(async (turn: number) => {
    const s = await withLoading(() => api.navigateToTurn(turn));
    if (s) {
      setState(s);
      setMoves([]);
      setStatusMsg(`Jumped to turn ${turn}`);
    }
  }, [withLoading]);

  // Challenge the last play
  const handleChallenge = useCallback(async () => {
    const s = await withLoading(() => api.challenge());
    if (s) {
      setState(s);
      setMoves([]);
      await refreshHistory();
      setStatusMsg(s.phonyChallenged ? 'Challenge successful! Move removed.' : 'Challenge failed.');
    }
  }, [withLoading, refreshHistory]);

  // Shuffle rack tiles randomly
  const handleShuffle = useCallback(() => {
    if (!state) return;
    const letters = state.rack.split('');
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    setState(prev => prev ? { ...prev, rack: letters.join('') } : prev);
  }, [state]);

  // Recall tiles from board (clear selection and typed tiles)
  const handleRecall = useCallback(() => {
    setSelection(null);
    setTileInput('');
  }, []);

  // Board square click: set selection or toggle direction
  const handleSquareClick = useCallback((row: number, col: number) => {
    setSelection(prev => {
      if (prev && prev.row === row && prev.col === col) {
        // Click same square: toggle direction
        return { row, col, direction: prev.direction === 'across' ? 'down' : 'across' };
      }
      // New square: default to across
      return { row, col, direction: 'across' };
    });
    setTileInput('');
    // Focus the input after selection
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Build remaining rack after accounting for already-typed letters in tileInput.
  // Uppercase in tileInput = used a real tile, lowercase = used a blank.
  const getRemainingRack = useCallback((currentInput: string): string[] => {
    if (!state) return [];
    const remaining = state.rack.split('');
    for (const ch of currentInput) {
      if (ch === ch.toLowerCase()) {
        // lowercase = blank was used
        const blankIdx = remaining.indexOf('?');
        if (blankIdx !== -1) remaining.splice(blankIdx, 1);
      } else {
        const idx = remaining.indexOf(ch);
        if (idx !== -1) remaining.splice(idx, 1);
      }
    }
    return remaining;
  }, [state]);

  // Determine how a typed letter should be stored: uppercase if available on rack, lowercase if using blank.
  // If forceBlank is true, use a blank even if the real tile is available.
  // Returns the character to store, or null if the letter can't be played.
  const resolveTypedLetter = useCallback((letter: string, currentInput: string, forceBlank = false): string | null => {
    if (!state) return null;
    if (!/^[A-Z]$/.test(letter)) return null;
    const remaining = getRemainingRack(currentInput);
    if (forceBlank) {
      if (remaining.indexOf('?') !== -1) return letter.toLowerCase();
      return null;
    }
    if (remaining.indexOf(letter) !== -1) return letter; // real tile
    if (remaining.indexOf('?') !== -1) return letter.toLowerCase(); // blank
    return null;
  }, [state, getRemainingRack]);

  // Handle input onChange — only for deletions (backspace). Letter entry is via onKeyDown.
  const handleTileInputChange = useCallback((newValue: string) => {
    // If shorter than current, user deleted — allow it
    if (newValue.length < tileInput.length) {
      setTileInput(newValue);
    }
    // Otherwise ignore — letter additions are handled by onKeyDown
  }, [tileInput]);

  // Submit a typed move
  const handleSubmitTiledMove = useCallback(async () => {
    if (!selection || !tileInput.trim() || !state?.board) return;
    const move = buildMoveString(state.board, selection, tileInput.trim());
    if (!move) {
      setError('Could not build a valid move from the typed tiles.');
      return;
    }
    const { coords, tiles } = move;
    const s = await withLoading(() => api.playMove(coords, tiles));
    if (s) {
      setState(s);
      setMoves([]);
      setSelection(null);
      setTileInput('');
      await refreshHistory();
      if (s.phonyChallenged) {
        setStatusMsg(`PHONY CHALLENGED! "${formatPlayThrough(tiles, coords, state?.board)}" at ${coords} was removed from the board.`);
      } else {
        setStatusMsg(`Played: ${coords} ${formatPlayThrough(tiles, coords, state?.board)}`);
      }
    }
  }, [selection, tileInput, state, withLoading, refreshHistory]);

  // Handle keyboard on the input: letters, Enter, Escape, Backspace
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitTiledMove();
    } else if (e.key === 'Escape') {
      setSelection(null);
      setTileInput('');
    } else if (e.key === 'Backspace') {
      // Let default behavior handle it (controlled input will update via onChange)
      return;
    } else if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      const upper = e.key.toUpperCase();
      const resolved = resolveTypedLetter(upper, tileInput, e.shiftKey);
      if (resolved) setTileInput(prev => prev + resolved);
    }
  }, [handleSubmitTiledMove, tileInput, resolveTypedLetter]);

  // Global keydown: if a square is selected and user starts typing, focus the input
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (!selection) return;
      // Don't capture if already focused on an input
      if (document.activeElement === inputRef.current) return;
      // Ignore modifier keys and special keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        const upper = e.key.toUpperCase();
        const resolved = resolveTypedLetter(upper, tileInput, e.shiftKey);
        if (resolved) {
          e.preventDefault();
          inputRef.current?.focus();
          setTileInput(prev => prev + resolved);
        }
      }
      if (e.key === 'Escape') {
        setSelection(null);
        setTileInput('');
      }
      if (e.key === 'Enter' && tileInput.trim()) {
        e.preventDefault();
        handleSubmitTiledMove();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [selection, tileInput, handleSubmitTiledMove, resolveTypedLetter]);

  const handleChangeRule = useCallback(async (rule: string) => {
    setChallengeRule(rule);
    // If a game is active, change it immediately
    if (state) {
      const s = await withLoading(() => api.setSettings(rule));
      if (s) {
        setState(s);
        setStatusMsg(`Challenge rule: ${rule}`);
      }
    }
  }, [withLoading, state]);

  // Auto-play for bot when it's maCATdo's turn
  useEffect(() => {
    if (!state || loading) return;
    if (state.playState !== 'PLAYING') return;
    const currentPlayer = state.playerNames[state.onTurn];
    if (currentPlayer !== 'maCATdo') return;

    const timer = setTimeout(async () => {
      const result = await withLoading(() => api.aiPlay());
      if (result) {
        setState(result.state);
        setMoves([]);
        await refreshHistory();
        const mp = result.move.split(' ');
        const mCoords = mp[0], mTiles = mp[1] || '';
        setStatusMsg(`maCATdo played: ${mCoords} ${formatPlayThrough(mTiles, mCoords, result.state.board)} (+${result.score})`);
      }
    }, 500); // small delay so the human can see the board before bot plays
    return () => clearTimeout(timer);
  }, [state, loading, withLoading, refreshHistory]);

  const isPlaying = state?.playState === 'PLAYING';
  const lastEvent = history.length > 0 ? history[history.length - 1] : null;
  const canChallenge = isPlaying && !!lastEvent?.position && state?.challengeRule !== 'VOID';

  // Dynamic board sizing: maximize board to fit viewport height
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const cellSize = useMemo(() => {
    const dim = 15;
    // Vertical budget: 32px padding top + board + rack(~54) + action bar(~48) + 32px padding bottom
    const overhead = 32 + 54 + 48 + 32;
    const availableHeight = viewportHeight - overhead;
    // Board height = dim * cellSize + 2 * labelSize, where labelSize = cellSize * 0.5
    // So: availableHeight = dim * cellSize + cellSize => cellSize = availableHeight / (dim + 1)
    const computed = Math.floor(availableHeight / (dim + 1));
    return Math.max(24, Math.min(computed, 48)); // clamp between 24-48px
  }, [viewportHeight]);

  return (
    <div className="app">
      <div className="main-layout">
        <div className="board-area">
          <Board state={state} selection={selection} tileInput={tileInput} cellSize={cellSize} onSquareClick={handleSquareClick} />
          {state && <Rack rack={state.rack} cellSize={cellSize} onShuffle={handleShuffle} onRecall={handleRecall} />}

          {/* Action bar */}
          <div className="action-bar" ref={optionsRef}>
            {!state ? (
              <div className="action-bar-inner">
                <button className="action-btn action-btn-primary" onClick={handleNewGame} disabled={loading}>
                  Start Game
                </button>
              </div>
            ) : (
              <div className="action-bar-inner">
                <button className="action-btn" onClick={() => setShowOptions(!showOptions)} disabled={loading}>
                  Options
                </button>
                <button className="action-btn" onClick={handlePass} disabled={loading || !isPlaying}>
                  Pass
                </button>
                {state.challengeRule !== 'VOID' && (
                  <button className="action-btn" onClick={handleChallenge} disabled={loading || !canChallenge}>
                    Challenge
                  </button>
                )}
                <button className="action-btn" onClick={() => setShowExchange(true)} disabled={loading || !isPlaying}>
                  Exchange
                </button>
                <button
                  className="action-btn action-btn-primary"
                  onClick={handleSubmitTiledMove}
                  disabled={!tileInput.trim() || loading}
                >
                  Play
                </button>
              </div>
            )}
            {showOptions && (
              <div className="options-dropdown">
                <button className="option-item" onClick={() => { handleNewGame(); setShowOptions(false); }} disabled={loading}>
                  New Game
                </button>
                <button className="option-item" onClick={() => { handleAIPlay(); setShowOptions(false); }} disabled={loading || !isPlaying}>
                  AI Play
                </button>
                <div className="option-divider" />
                <button className="option-item" onClick={() => { handleNavigate('first'); setShowOptions(false); }} disabled={loading}>
                  |&lt; First
                </button>
                <button className="option-item" onClick={() => { handleNavigate('prev'); setShowOptions(false); }} disabled={loading}>
                  &lt; Previous
                </button>
                <button className="option-item" onClick={() => { handleNavigate('next'); setShowOptions(false); }} disabled={loading}>
                  Next &gt;
                </button>
                <button className="option-item" onClick={() => { handleNavigate('last'); setShowOptions(false); }} disabled={loading}>
                  Last &gt;|
                </button>
              </div>
            )}
          </div>

          {/* Hidden input for keyboard tile entry */}
          <input
            ref={inputRef}
            type="text"
            value={tileInput}
            onChange={e => handleTileInputChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            tabIndex={-1}
          />
        </div>

        <div className="side-panel">
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <h1>s<span style={{ color: 'var(--cw)' }}>C</span>ra<span style={{ color: 'var(--cw)' }}>BB</span>le</h1>
              {error && <span className="error-msg" onClick={clearError}>{error}</span>}
            </div>
            <Settings
              currentRule={state?.challengeRule || challengeRule}
              currentLexicon={lexicon}
              lexicons={lexicons}
              theme={theme}
              colorway={colorway}
              onChangeRule={handleChangeRule}
              onChangeLexicon={setLexicon}
              onChangeTheme={setTheme}
              onChangeColorway={setColorway}
              loading={loading}
            />
          </header>

          <div className="panel-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ borderBottom: 'none' }}>Generated Moves</h3>
              <button
                onClick={handleGenerate}
                disabled={loading || !isPlaying}
                style={{
                  background: 'none', border: 'none', color: 'var(--cw)',
                  fontSize: 12, fontWeight: 600, fontFamily: "'Lexend', sans-serif",
                  cursor: loading || !isPlaying ? 'not-allowed' : 'pointer',
                  padding: '8px 12px', opacity: loading || !isPlaying ? 0.5 : 1,
                }}
              >
                Generate
              </button>
            </div>
            <MoveList moves={moves} board={state?.board} onPlayMove={handlePlayMove} />
          </div>

          <TilePool state={state} />

          <div className="panel-section">
            <h3>Game History</h3>
            <ScoreBar state={state} statusMsg={statusMsg} />
            <GameHistory
              events={history}
              playerNames={state?.playerNames || ['Player 1', 'Player 2']}
              onNavigate={handleNavigateToTurn}
            />
          </div>
        </div>
      </div>

      {showExchange && state && (
        <ExchangeModal
          rack={state.rack}
          onExchange={handleExchange}
          onCancel={() => setShowExchange(false)}
          loading={loading}
        />
      )}
    </div>
  );
}

export default App;

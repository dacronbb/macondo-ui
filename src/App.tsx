import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from './api/client';
import type { GameState, MoveInfo, EventInfo } from './api/types';
import { Board, toCoords, buildMoveString, formatPlayThrough } from './components/Board';
import type { BoardSelection } from './components/Board';
import { Rack } from './components/Rack';
import { ScoreBar } from './components/ScoreBar';
import { MoveList } from './components/MoveList';
import { GameHistory } from './components/GameHistory';
import { Controls } from './components/Controls';
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

  // Exchange modal state
  const [showExchange, setShowExchange] = useState(false);

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
      setStatusMsg(`AI played: ${result.move} (+${result.score})`);
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
        setStatusMsg(`maCATdo played: ${result.move} (+${result.score})`);
      }
    }, 500); // small delay so the human can see the board before bot plays
    return () => clearTimeout(timer);
  }, [state, loading, withLoading, refreshHistory]);

  const isPlaying = state?.playState === 'PLAYING';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Macondo</h1>
        <Settings
          currentRule={state?.challengeRule || challengeRule}
          currentLexicon={lexicon}
          lexicons={lexicons}
          onChangeRule={handleChangeRule}
          onChangeLexicon={setLexicon}
          loading={loading}
        />
        {statusMsg && <span className="status-msg">{statusMsg}</span>}
        {error && <span className="error-msg" onClick={clearError}>{error}</span>}
      </header>

      <Controls
        onNewGame={handleNewGame}
        onGenerate={handleGenerate}
        onPass={handlePass}
        onExchange={() => setShowExchange(true)}
        onFirst={() => handleNavigate('first')}
        onPrev={() => handleNavigate('prev')}
        onNext={() => handleNavigate('next')}
        onLast={() => handleNavigate('last')}
        isPlaying={isPlaying}
        loading={loading}
      />

      <ScoreBar state={state} />

      <div className="main-layout">
        <div className="board-area">
          <Board state={state} selection={selection} tileInput={tileInput} onSquareClick={handleSquareClick} />
          {state && <Rack rack={state.rack} />}

          {/* Move input bar */}
          {selection && (
            <div className="move-input-bar">
              <span className="move-coords">
                {toCoords(selection)} {selection.direction === 'across' ? '\u2192' : '\u2193'}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={tileInput}
                onChange={e => handleTileInputChange(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Type tiles then Enter (use . for blank)"
                className="move-tile-input"
                autoFocus
              />
              <button
                onClick={handleSubmitTiledMove}
                disabled={!tileInput.trim() || loading}
                className="move-submit-btn"
              >
                Play
              </button>
              <button
                onClick={() => { setSelection(null); setTileInput(''); }}
                className="move-cancel-btn"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="side-panel">
          <div className="panel-section">
            <h3>Generated Moves</h3>
            <MoveList moves={moves} board={state?.board} onPlayMove={handlePlayMove} />
          </div>

          <TilePool state={state} />

          <div className="panel-section">
            <h3>Game History</h3>
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

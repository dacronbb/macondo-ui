import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { api } from './api/client';
import type { GameState, MoveInfo, EventInfo, PlacedTile } from './api/types';
import { Board, toCoords, buildMoveStringFromPlaced, formatPlayThrough, getCursorPos } from './components/Board';
import type { BoardSelection } from './components/Board';
import { Rack } from './components/Rack';
import { MoveList } from './components/MoveList';
import { Scoresheet } from './components/Scoresheet';
import { Settings } from './components/Settings';
import { ExchangeModal } from './components/ExchangeModal';
import { BlankPickerModal } from './components/BlankPickerModal';
import { DragGhost } from './components/DragGhost';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import './App.css';

function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [moves, setMoves] = useState<MoveInfo[]>([]);
  const [history, setHistory] = useState<EventInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const [analyzeMode, setAnalyzeMode] = useState(false);
  const showToast = useCallback((text: string) => {
    setToasts(prev => {
      const existing = prev.find(t => t.text === text);
      if (existing) {
        return prev.map(t => t.text === text ? { ...t, version: t.version + 1 } : t);
      }
      return [...prev, { id: ++toastIdRef.current, text, version: 0 }];
    });
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
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
  // Move list visibility
  const [showMoves, setShowMoves] = useState(true);
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
  const [placedTiles, setPlacedTiles] = useState<PlacedTile[]>([]);
  const [localRack, setLocalRack] = useState<string[]>([]);
  const [previewScore, setPreviewScore] = useState<number | null>(null);
  const [moveValid, setMoveValid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Blank picker state
  const [pendingBlank, setPendingBlank] = useState<{ row: number; col: number; rackIndex: number } | null>(null);

  // Refs for drag-and-drop hit testing
  const boardRef = useRef<HTMLDivElement>(null);
  const rackRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch available lexicons on mount
  useEffect(() => {
    api.getLexicons().then(setLexicons).catch(() => {});
  }, []);

  // Initialize localRack from state.rack whenever server state changes
  useEffect(() => {
    if (state) {
      setLocalRack(state.rack.split(''));
    }
  }, [state]);

  // Fetch score preview when placed tiles change; also drives move validity
  useEffect(() => {
    if (!state || placedTiles.length === 0) {
      setPreviewScore(null);
      setMoveValid(false);
      return;
    }
    const move = buildMoveStringFromPlaced(state.board, placedTiles);
    if (!move) {
      setPreviewScore(null);
      setMoveValid(false);
      return;
    }
    const { coords, tiles } = move;
    // Reset while waiting for validation
    setPreviewScore(null);
    setMoveValid(false);
    const timer = setTimeout(() => {
      api.scoreMove(coords, tiles)
        .then(r => { setPreviewScore(r.score); setMoveValid(true); })
        .catch(() => { setPreviewScore(null); setMoveValid(false); });
    }, 150);
    return () => clearTimeout(timer);
  }, [placedTiles, state]);

  const clearError = () => setError(null);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    clearError();
    try {
      return await fn();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : String(e));
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

  const clearBoard = useCallback(() => {
    setSelection(null);
    setPlacedTiles([]);
  }, []);

  const handleNewGame = useCallback(async () => {
    const s = await withLoading(() => api.newGame(lexicon, challengeRule));
    if (s) {
      setState(s);
      setMoves([]);
      setHistory([]);
      clearBoard();
      setStatusMsg(`New game (${s.lexicon}, ${s.challengeRule})`);
    }
  }, [withLoading, lexicon, challengeRule, clearBoard]);

  const handleGenerate = useCallback(async () => {
    const m = await withLoading(() => api.generate(15));
    if (m) {
      setMoves(m);
      setShowMoves(true);
      setStatusMsg(`Generated ${m.length} moves`);
    }
  }, [withLoading]);

  const handleAddMove = useCallback((index: number) => {
    if (!state) return;
    const move = moves.find(m => m.index === index);
    if (!move || move.action !== 'play' || !move.coords || !move.tiles) return;

    // Parse coords into selection
    const acrossMatch = move.coords.match(/^(\d+)([A-O])$/);
    const downMatch = move.coords.match(/^([A-O])(\d+)$/);
    let startRow: number, startCol: number, direction: 'across' | 'down';
    if (acrossMatch) {
      startRow = parseInt(acrossMatch[1]) - 1;
      startCol = acrossMatch[2].charCodeAt(0) - 65;
      direction = 'across';
    } else if (downMatch) {
      startRow = parseInt(downMatch[2]) - 1;
      startCol = downMatch[1].charCodeAt(0) - 65;
      direction = 'down';
    } else return;

    // Build PlacedTiles from the move tiles string
    const newPlaced: PlacedTile[] = [];
    const rackLetters = state.rack.split('');
    const usedRackIndices: number[] = [];
    let r = startRow, c = startCol;

    for (const ch of move.tiles) {
      if (ch === '.') {
        // play-through — skip
      } else {
        // Find matching rack tile
        const isBlankPlay = ch === ch.toLowerCase();
        let rackIdx = -1;
        if (isBlankPlay) {
          rackIdx = rackLetters.findIndex((l, i) => l === '?' && !usedRackIndices.includes(i));
        } else {
          rackIdx = rackLetters.findIndex((l, i) => l === ch && !usedRackIndices.includes(i));
          if (rackIdx === -1) {
            // Try blank
            rackIdx = rackLetters.findIndex((l, i) => l === '?' && !usedRackIndices.includes(i));
          }
        }
        if (rackIdx !== -1) {
          usedRackIndices.push(rackIdx);
          newPlaced.push({ row: r, col: c, letter: ch, rackIndex: rackIdx });
        }
      }
      if (direction === 'across') c++; else r++;
    }

    setPlacedTiles(newPlaced);
    // Update localRack: remove used tiles
    const newRack = rackLetters.filter((_, i) => !usedRackIndices.includes(i));
    setLocalRack(newRack);
    setSelection({ row: startRow, col: startCol, direction });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [moves, state]);

  const handlePlayMove = useCallback(async (index: number) => {
    const s = await withLoading(() => api.playMoveFromList(index));
    if (s) {
      setState(s);
      setMoves([]);
      clearBoard();
      await refreshHistory();
      if (s.phonyChallenged) {
        setStatusMsg(`PHONY CHALLENGED! Move #${index} was removed from the board.`);
      } else {
        setStatusMsg(`Played move #${index}`);
      }
    }
  }, [withLoading, refreshHistory, clearBoard]);

  const handleAIPlay = useCallback(async () => {
    const result = await withLoading(() => api.aiPlay());
    if (result) {
      setState(result.state);
      setMoves([]);
      clearBoard();
      await refreshHistory();
      const parts = result.move.split(' ');
      const aiCoords = parts[0], aiTiles = parts[1] || '';
      setStatusMsg(`AI played: ${aiCoords} ${formatPlayThrough(aiTiles, aiCoords, result.state.board)} (+${result.score})`);
    }
  }, [withLoading, refreshHistory, clearBoard]);

  const handlePass = useCallback(async () => {
    const s = await withLoading(() => api.playPass());
    if (s) {
      setState(s);
      setMoves([]);
      clearBoard();
      await refreshHistory();
      setStatusMsg('Passed');
    }
  }, [withLoading, refreshHistory, clearBoard]);

  const handleExchange = useCallback(async (tiles: string) => {
    const s = await withLoading(() => api.playExchange(tiles));
    if (s) {
      setState(s);
      setMoves([]);
      clearBoard();
      setShowExchange(false);
      await refreshHistory();
      setStatusMsg(`Exchanged ${tiles.length} tile${tiles.length > 1 ? 's' : ''}`);
    }
  }, [withLoading, refreshHistory, clearBoard]);

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

  const handleExport = useCallback(async () => {
    const result = await withLoading(() => api.exportGCG());
    if (result) {
      const blob = new Blob([result.gcg], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'game.gcg';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [withLoading]);

  const handleExit = useCallback(() => {
    setState(null);
    setHistory([]);
    setMoves([]);
    clearBoard();
    setAnalyzeMode(false);
    setStatusMsg('');
  }, [clearBoard]);

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
    setLocalRack(prev => {
      const letters = [...prev];
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      return letters;
    });
  }, []);

  // Recall tiles from board (clear selection and placed tiles, reset rack)
  const handleRecall = useCallback(() => {
    clearBoard();
    if (state) {
      setLocalRack(state.rack.split(''));
    }
  }, [clearBoard, state]);

  // Board square click: re-open blank picker if clicking a placed blank, otherwise set selection
  const handleSquareClick = useCallback((row: number, col: number) => {
    const placedBlank = placedTiles.find(t => t.row === row && t.col === col && t.letter === t.letter.toLowerCase());
    if (placedBlank) {
      setPendingBlank({ row, col, rackIndex: placedBlank.rackIndex });
      return;
    }
    setSelection(prev => {
      if (prev && prev.row === row && prev.col === col) {
        return { row, col, direction: prev.direction === 'across' ? 'down' : 'across' };
      }
      return { row, col, direction: 'across' };
    });
    // Don't clear placed tiles on click — user may want to add more tiles via keyboard
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [placedTiles]);

  // --- Drag-and-drop handlers ---

  const handlePlaceTile = useCallback((tile: PlacedTile) => {
    setPlacedTiles(prev => [...prev, tile]);
    setLocalRack(prev => {
      const next = [...prev];
      // Find and remove the tile at rackIndex — but since indices shift as tiles are removed,
      // we need to find the actual tile. The rackIndex refers to the current localRack position.
      next.splice(tile.rackIndex, 1);
      return next;
    });
  }, []);

  const handleRemovePlacedTile = useCallback((row: number, col: number) => {
    setPlacedTiles(prev => {
      const tile = prev.find(t => t.row === row && t.col === col);
      if (tile) {
        // Return tile to rack
        setLocalRack(rk => {
          const next = [...rk];
          const returnLetter = tile.letter === tile.letter.toLowerCase() ? '?' : tile.letter;
          next.push(returnLetter);
          return next;
        });
      }
      return prev.filter(t => !(t.row === row && t.col === col));
    });
  }, []);

  const handleMovePlacedTile = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    setPlacedTiles(prev => prev.map(t =>
      t.row === fromRow && t.col === fromCol
        ? { ...t, row: toRow, col: toCol }
        : t
    ));
  }, []);

  const handleReturnToRack = useCallback((row: number, col: number, insertIndex: number) => {
    setPlacedTiles(prev => {
      const tile = prev.find(t => t.row === row && t.col === col);
      if (tile) {
        const returnLetter = tile.letter === tile.letter.toLowerCase() ? '?' : tile.letter;
        setLocalRack(rk => {
          const next = [...rk];
          const idx = Math.min(insertIndex, next.length);
          next.splice(idx, 0, returnLetter);
          return next;
        });
      }
      return prev.filter(t => !(t.row === row && t.col === col));
    });
  }, []);

  const handleReorderRack = useCallback((fromIndex: number, toIndex: number) => {
    setLocalRack(prev => {
      const next = [...prev];
      const [tile] = next.splice(fromIndex, 1);
      const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
      next.splice(Math.min(insertAt, next.length), 0, tile);
      return next;
    });
  }, []);

  const handleBlankDrop = useCallback((row: number, col: number, rackIndex: number) => {
    // Remove from rack immediately, show picker
    setLocalRack(prev => {
      const next = [...prev];
      next.splice(rackIndex, 1);
      return next;
    });
    setPendingBlank({ row, col, rackIndex });
  }, []);

  const handleBlankPick = useCallback((letter: string) => {
    if (!pendingBlank) return;
    const { row, col, rackIndex } = pendingBlank;
    setPlacedTiles(prev => {
      const exists = prev.some(t => t.row === row && t.col === col);
      if (exists) {
        return prev.map(t => t.row === row && t.col === col ? { ...t, letter: letter.toLowerCase() } : t);
      }
      return [...prev, { row, col, letter: letter.toLowerCase(), rackIndex }];
    });
    setPendingBlank(null);
  }, [pendingBlank]);

  const handleBlankCancel = useCallback(() => {
    if (!pendingBlank) return;
    const { row, col, rackIndex } = pendingBlank;
    const alreadyPlaced = placedTiles.some(t => t.row === row && t.col === col);
    if (!alreadyPlaced) {
      // Return blank to rack (fresh drop cancelled)
      setLocalRack(prev => {
        const next = [...prev];
        next.splice(Math.min(rackIndex, next.length), 0, '?');
        return next;
      });
    }
    setPendingBlank(null);
  }, [pendingBlank, placedTiles]);

  // Dynamic board sizing
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const cellSize = useMemo(() => {
    const dim = 15;
    const overhead = 32 + 54 + 48 + 32;
    const availableHeight = viewportHeight - overhead;
    const computed = Math.floor(availableHeight / (dim + 1));
    return Math.max(24, Math.min(computed, 48));
  }, [viewportHeight]);

  const { dragState, onRackPointerDown, onBoardPointerDown } = useDragAndDrop({
    boardRef,
    rackRef,
    placedTiles,
    localRack,
    board: state?.board,
    cellSize,
    onPlaceTile: handlePlaceTile,
    onRemovePlacedTile: handleRemovePlacedTile,
    onMovePlacedTile: handleMovePlacedTile,
    onReturnToRack: handleReturnToRack,
    onReorderRack: handleReorderRack,
    onBlankDrop: handleBlankDrop,
  });

  // --- Keyboard input ---

  // Resolve typed letter against localRack (not state.rack)
  const resolveTypedLetter = useCallback((letter: string, forceBlank = false): { stored: string; rackIndex: number } | null => {
    if (!/^[A-Z]$/.test(letter)) return null;
    if (forceBlank) {
      const idx = localRack.indexOf('?');
      if (idx !== -1) return { stored: letter.toLowerCase(), rackIndex: idx };
      return null;
    }
    const idx = localRack.indexOf(letter);
    if (idx !== -1) return { stored: letter, rackIndex: idx };
    const blankIdx = localRack.indexOf('?');
    if (blankIdx !== -1) return { stored: letter.toLowerCase(), rackIndex: blankIdx };
    return null;
  }, [localRack]);

  // Submit a placed move
  const handleSubmitTiledMove = useCallback(async () => {
    if (placedTiles.length === 0 || !state?.board) return;
    const move = buildMoveStringFromPlaced(state.board, placedTiles);
    if (!move) {
      showToast('Please make a valid move');
      return;
    }
    const { coords, tiles } = move;
    const s = await withLoading(() => api.playMove(coords, tiles));
    if (s) {
      setState(s);
      setMoves([]);
      clearBoard();
      await refreshHistory();
      if (s.phonyChallenged) {
        setStatusMsg(`PHONY CHALLENGED! "${formatPlayThrough(tiles, coords, state?.board)}" at ${coords} was removed from the board.`);
      } else {
        setStatusMsg(`Played: ${coords} ${formatPlayThrough(tiles, coords, state?.board)}`);
      }
    }
  }, [placedTiles, state, withLoading, refreshHistory, clearBoard]);

  // Update selection direction based on placed tiles
  useEffect(() => {
    if (placedTiles.length >= 2 && state?.board) {
      const allSameRow = placedTiles.every(t => t.row === placedTiles[0].row);
      const allSameCol = placedTiles.every(t => t.col === placedTiles[0].col);
      const newDir = allSameRow ? 'across' : allSameCol ? 'down' : undefined;
      if (newDir) {
        setSelection(prev => {
          if (!prev || prev.direction === newDir) return prev;
          return { ...prev, direction: newDir };
        });
      }
    }
  }, [placedTiles, state?.board]);

  // Handle keyboard input
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitTiledMove();
    } else if (e.key === 'Escape') {
      handleRecall();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      // Remove the last placed tile
      if (placedTiles.length > 0) {
        const last = placedTiles[placedTiles.length - 1];
        const returnLetter = last.letter === last.letter.toLowerCase() ? '?' : last.letter;
        setPlacedTiles(prev => prev.slice(0, -1));
        setLocalRack(prev => [...prev, returnLetter]);
      }
    } else if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      if (!selection || !state?.board) return;
      const upper = e.key.toUpperCase();
      const resolved = resolveTypedLetter(upper, e.shiftKey);
      if (!resolved) return;

      // Find cursor position (next empty square)
      const cursor = getCursorPos(state.board, selection, placedTiles);
      if (!cursor) return;

      const newTile: PlacedTile = {
        row: cursor.row,
        col: cursor.col,
        letter: resolved.stored,
        rackIndex: resolved.rackIndex,
      };
      setPlacedTiles(prev => [...prev, newTile]);
      setLocalRack(prev => {
        const next = [...prev];
        next.splice(resolved.rackIndex, 1);
        return next;
      });
    }
  }, [handleSubmitTiledMove, handleRecall, selection, state?.board, placedTiles, resolveTypedLetter]);

  // Global keydown: capture typing when a square is selected
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (!selection) return;
      if (document.activeElement === inputRef.current) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        if (!state?.board) return;
        const upper = e.key.toUpperCase();
        const resolved = resolveTypedLetter(upper, e.shiftKey);
        if (resolved) {
          e.preventDefault();
          inputRef.current?.focus();
          const cursor = getCursorPos(state.board, selection, placedTiles);
          if (!cursor) return;
          setPlacedTiles(prev => [...prev, {
            row: cursor.row,
            col: cursor.col,
            letter: resolved.stored,
            rackIndex: resolved.rackIndex,
          }]);
          setLocalRack(prev => {
            const next = [...prev];
            next.splice(resolved.rackIndex, 1);
            return next;
          });
        }
      }
      if (e.key === 'Escape') {
        handleRecall();
      }
      if (e.key === 'Enter' && moveValid) {
        e.preventDefault();
        handleSubmitTiledMove();
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (placedTiles.length > 0) {
          const last = placedTiles[placedTiles.length - 1];
          const returnLetter = last.letter === last.letter.toLowerCase() ? '?' : last.letter;
          setPlacedTiles(prev => prev.slice(0, -1));
          setLocalRack(prev => [...prev, returnLetter]);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [selection, placedTiles, moveValid, handleSubmitTiledMove, handleRecall, resolveTypedLetter, state?.board]);

  const handleChangeRule = useCallback(async (rule: string) => {
    setChallengeRule(rule);
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
    }, 500);
    return () => clearTimeout(timer);
  }, [state, loading, withLoading, refreshHistory]);

  // Auto-pass to resolve WAITING_FOR_FINAL_PASS → triggers endOfGameCalcs and END_RACK_PTS event
  useEffect(() => {
    if (!state || loading) return;
    if (state.playState !== 'WAITING_FOR_FINAL_PASS') return;
    const timer = setTimeout(async () => {
      const s = await withLoading(() => api.playPass());
      if (s) {
        setState(s);
        setMoves([]);
        clearBoard();
        await refreshHistory();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [state, loading, withLoading, refreshHistory, clearBoard]);

  const isPlaying = state?.playState === 'PLAYING';
  const isGameOver = state?.playState === 'GAME_OVER';
  const lastEvent = history.length > 0 ? history[history.length - 1] : null;
  const canChallenge = isPlaying && !!lastEvent?.position && state?.challengeRule !== 'VOID';

  // Measure board and bottom heights for side panel alignment
  const [boardHeight, setBoardHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (boardRef.current) setBoardHeight(boardRef.current.offsetHeight);
      if (bottomRef.current) setBottomHeight(bottomRef.current.offsetHeight);
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (boardRef.current) obs.observe(boardRef.current);
    if (bottomRef.current) obs.observe(bottomRef.current);
    return () => obs.disconnect();
  }, [cellSize, state]);


  return (
    <div className="app">
      <div className="main-layout">
        <div className="board-area">
          <div ref={boardRef}>
            <Board
              state={state}
              selection={selection}
              placedTiles={placedTiles}
              cellSize={cellSize}
              previewScore={previewScore}
              onSquareClick={handleSquareClick}
              onBoardPointerDown={onBoardPointerDown}
            />
          </div>
          <div ref={bottomRef}>
          {state && (isPlaying || analyzeMode) && (
            <Rack
              ref={rackRef}
              localRack={localRack}
              cellSize={cellSize}
              onShuffle={handleShuffle}
              onRecall={handleRecall}
              onRackPointerDown={onRackPointerDown}
              dragState={dragState}
            />
          )}

          {isGameOver && !analyzeMode && (() => {
            const winnerIdx = state.scores[0] > state.scores[1] ? 0 : state.scores[1] > state.scores[0] ? 1 : -1;
            const winnerLine = winnerIdx === -1
              ? `Draw! Final score: ${state.scores[0]} – ${state.scores[1]}`
              : `${state.playerNames[winnerIdx]} wins. Final score: ${state.scores[winnerIdx]} – ${state.scores[1 - winnerIdx]}`;
            return (
              <div className="winner-module">
                <span className="winner-line">{winnerLine}</span>
              </div>
            );
          })()}

          {/* Action bar */}
          <div className="action-bar" ref={optionsRef}>
            {!state ? (
              <div className="action-bar-inner">
                <button className="action-btn action-btn-primary" onClick={handleNewGame} disabled={loading}>
                  Start Game
                </button>
              </div>
            ) : (isGameOver && !analyzeMode) ? (
              <div className="action-bar-inner">
                <button className="action-btn" onClick={handleExport} disabled={loading}>Export GCG</button>
                <button className="action-btn" onClick={() => { setAnalyzeMode(true); clearBoard(); }}>Analyze</button>
                <button className="action-btn" onClick={handleExit} disabled={loading}>Exit</button>
                <button className="action-btn action-btn-primary" onClick={handleNewGame} disabled={loading}>Rematch</button>
              </div>
            ) : analyzeMode ? (
              <div className="action-bar-inner">
                <button className="action-btn" onClick={() => handleNavigate('first')} disabled={loading}>|&lt;</button>
                <button className="action-btn" onClick={() => handleNavigate('prev')} disabled={loading}>&lt; Prev</button>
                <button className="action-btn" onClick={() => handleNavigate('next')} disabled={loading}>Next &gt;</button>
                <button className="action-btn" onClick={() => handleNavigate('last')} disabled={loading}>&gt;|</button>
                <button className="action-btn action-btn-primary" onClick={() => { setAnalyzeMode(false); clearBoard(); }}>Done</button>
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
                  disabled={!moveValid || loading}
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
          </div>{/* end bottomRef */}

          {/* Hidden input for keyboard tile entry */}
          <input
            ref={inputRef}
            type="text"
            value=""
            onChange={() => {}}
            onKeyDown={handleInputKeyDown}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            tabIndex={-1}
          />
        </div>

        <div className="side-panel">
          {/* Top zone: sCraBBle header + scoresheet — same height as board */}
          <div style={{ height: boardHeight || undefined, display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 0 }}>
            <header className="app-header" style={{ flexShrink: 0, paddingBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <h1>s<span style={{ color: 'var(--cw)' }}>C</span>ra<span style={{ color: 'var(--cw)' }}>BB</span>le</h1>
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
            <Scoresheet
              events={history}
              state={state}
              statusMsg={statusMsg}
              onNavigate={handleNavigateToTurn}
              gameOver={isGameOver}
            />
          </div>

          {/* Bottom zone: generated moves — aligned with rack + action bar */}
          {!isGameOver && <div className="panel-section" style={{ marginTop: 16, height: bottomHeight ? bottomHeight - 16 : undefined, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h3 style={{ borderBottom: 'none' }}>Generated moves</h3>
              <button
                onClick={moves.length > 0 && showMoves ? () => setShowMoves(false) : handleGenerate}
                disabled={moves.length === 0 && (loading || (!isPlaying && !analyzeMode))}
                style={{
                  background: 'none', border: 'none', color: 'var(--cw)',
                  fontSize: 12, fontWeight: 600, fontFamily: "'Lexend', sans-serif",
                  cursor: (moves.length === 0 && (loading || (!isPlaying && !analyzeMode))) ? 'not-allowed' : 'pointer',
                  padding: '8px 12px', opacity: (moves.length === 0 && (loading || (!isPlaying && !analyzeMode))) ? 0.5 : 1,
                }}
              >
                {moves.length > 0 && showMoves ? 'Hide' : 'Generate'}
              </button>
            </div>
            {showMoves && (
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <MoveList moves={moves} board={state?.board} onPlayMove={handlePlayMove} onAddMove={handleAddMove} />
              </div>
            )}
          </div>}
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

      {pendingBlank && (
        <BlankPickerModal
          onPick={handleBlankPick}
          onCancel={handleBlankCancel}
        />
      )}

      {dragState?.isDragging && (
        <DragGhost
          letter={dragState.source.letter}
          pointerX={dragState.pointerX}
          pointerY={dragState.pointerY}
          cellSize={cellSize}
        />
      )}
      <Toast messages={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;

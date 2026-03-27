import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { api } from './api/client';
import type { GameState, MoveInfo, EventInfo, PlacedTile } from './api/types';
import { Board, buildMoveStringFromPlaced, formatPlayThrough, getCursorPos } from './components/Board';
import type { BoardSelection } from './components/Board';
import { Rack } from './components/Rack';
import { MoveList } from './components/MoveList';
import { Scoresheet } from './components/Scoresheet';
import { Settings } from './components/Settings';
import { GameSwitcher } from './components/GameSwitcher';
import { BoggleGame } from './components/boggle/BoggleGame';
import { CardBBox } from './components/CardBBox';
import { ExchangeModal } from './components/ExchangeModal';
import { AnalyzeModal } from './components/AnalyzeModal';
import { BlankPickerModal } from './components/BlankPickerModal';
import { SimSettingsModal } from './components/SimSettingsModal';
import type { SimSettings } from './api/types';
import { DragGhost } from './components/DragGhost';
import { Toast } from './components/Toast';
import type { ToastMessage } from './components/Toast';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { RackEditor } from './components/RackEditor';
import './App.css';

function App() {
  const [currentGame, setCurrentGame] = useState<'scrabble' | 'boggle' | 'cardbbox'>('scrabble');
  const [state, setState] = useState<GameState | null>(null);
  const [moves, setMoves] = useState<MoveInfo[]>([]);
  const [history, setHistory] = useState<EventInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const [analyzeMode, setAnalyzeMode] = useState(false);
  const [navIndex, setNavIndex] = useState(0);
  const [simRunning, setSimRunning] = useState(false);
  const [simIterations, setSimIterations] = useState(0);
  const [simSettings, setSimSettings] = useState<SimSettings>({ plies: 2, stoppingCondition: 0, inference: '' });
  const [showSimSettings, setShowSimSettings] = useState(false);
  const [generateCount, setGenerateCount] = useState(15);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedTurn, setSelectedTurn] = useState<number | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{ position: string; tiles: string; rack: string } | null>(null);

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
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);

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
  const selectPlayIdRef = useRef(0); // for cancelling stale handleSelectPlay calls
  const userPlayIndexRef = useRef(-1); // unique negative indices for user-added moves in analyze mode
  const selectedPlayRackRef = useRef(''); // pre-play rack of the currently selected scoresheet play

  // Blank picker state
  const [pendingBlank, setPendingBlank] = useState<{ row: number; col: number; rackIndex: number } | null>(null);

  // Refs for drag-and-drop hit testing
  const boardRef = useRef<HTMLDivElement>(null);
  const rackRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Fetch available lexicons on mount
  useEffect(() => {
    api.getLexicons().then(setLexicons).catch(() => {});
  }, []);

  // Initialize localRack from state.rack whenever server state changes.
  // Skip when a scoresheet play is selected — handleSelectPlay sets localRack directly,
  // and placeOnBoard (via pendingPlacement) finalizes it to the leave.
  useEffect(() => {
    if (state && !selectedPlayRackRef.current) {
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

  const handleLoadGCGFile = useCallback((file: File) => {
    setShowAnalyzeModal(false);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      if (!content) return;
      const s = await withLoading(() => api.loadGame('gcg', content));
      if (s) {
        setState(s);
        setMoves([]);
        setAnalyzeMode(true);
        clearBoard();
        let h: EventInfo[] = [];
        try { h = await api.getHistory(); setHistory(h); } catch {}
        const ns = await withLoading(() => api.navigate('last'));
        if (ns) { setState(ns); setNavIndex(h.length - 1); setStatusMsg('Game loaded for analysis'); }
      }
    };
    reader.readAsText(file);
  }, [withLoading, clearBoard]);

  const handleLoadWoogles = useCallback(async (raw: string) => {
    if (!raw) return;
    setShowAnalyzeModal(false);
    // Accept full URL (woogles.io/game/ID) or bare ID
    const id = raw.replace(/^.*\/game\//, '');
    const s = await withLoading(() => api.loadGame('woogles', undefined, id));
    if (s) {
      setState(s);
      setMoves([]);
      setAnalyzeMode(true);
      clearBoard();
      let h: EventInfo[] = [];
      try { h = await api.getHistory(); setHistory(h); } catch {}
      const ns = await withLoading(() => api.navigate('last'));
      if (ns) { setState(ns); setNavIndex(h.length - 1); setStatusMsg(`Woogles game ${id} loaded`); }
    }
  }, [withLoading, clearBoard]);

  const handleGenerate = useCallback(async () => {
    const m = await withLoading(() => api.generate(15));
    if (m) {
      setMoves(m);
      setShowMoves(true);
      setStatusMsg(`Generated ${m.length} moves`);
    }
  }, [withLoading]);

  const handleGenerateMore = useCallback(async () => {
    const nextCount = generateCount + 15;
    const m = await withLoading(() => api.generate(nextCount));
    if (m) {
      setMoves(m);
      setGenerateCount(nextCount);
    }
  }, [withLoading, generateCount]);

  const handleReset = useCallback(async () => {
    setMoves([]);
    setGenerateCount(15);
    const m = await withLoading(() => api.generate(15));
    if (m) setMoves(m);
  }, [withLoading]);

  const handleSimulate = useCallback(async () => {
    if (simRunning) {
      await api.sim.stop().catch(() => {});
      setSimRunning(false);
    } else {
      try {
        await api.sim.start(simSettings.plies, simSettings.stoppingCondition, simSettings.inference || undefined);
        setSimRunning(true);
        setSimIterations(0);
      } catch (e) {
        showToast((e as Error).message);
      }
    }
  }, [simRunning, simSettings, showToast]);

  const placeOnBoard = useCallback((coords: string, tilesStr: string, rackOverride?: string) => {
    if (!state) return;
    const acrossMatch = coords.match(/^(\d+)([A-O])$/i);
    const downMatch = coords.match(/^([A-O])(\d+)$/i);
    let startRow: number, startCol: number, direction: 'across' | 'down';
    if (acrossMatch) {
      startRow = parseInt(acrossMatch[1]) - 1;
      startCol = acrossMatch[2].toUpperCase().charCodeAt(0) - 65;
      direction = 'across';
    } else if (downMatch) {
      startRow = parseInt(downMatch[2]) - 1;
      startCol = downMatch[1].toUpperCase().charCodeAt(0) - 65;
      direction = 'down';
    } else return;

    const newPlaced: PlacedTile[] = [];
    const rackLetters = (rackOverride ?? state.rack).split('');
    const usedRackIndices: number[] = [];
    let r = startRow, c = startCol;

    for (const ch of tilesStr) {
      if (ch === '.') {
        // play-through — skip
      } else {
        const isBlankPlay = ch === ch.toLowerCase();
        let rackIdx = -1;
        if (isBlankPlay) {
          rackIdx = rackLetters.findIndex((l, i) => l === '?' && !usedRackIndices.includes(i));
        } else {
          rackIdx = rackLetters.findIndex((l, i) => l === ch && !usedRackIndices.includes(i));
          if (rackIdx === -1) rackIdx = rackLetters.findIndex((l, i) => l === '?' && !usedRackIndices.includes(i));
        }
        if (rackIdx === -1) rackIdx = rackLetters.length + newPlaced.length;
        usedRackIndices.push(rackIdx);
        newPlaced.push({ row: r, col: c, letter: ch, rackIndex: rackIdx });
      }
      if (direction === 'across') c++; else r++;
    }

    setPlacedTiles(newPlaced);
    setLocalRack(rackLetters.filter((_, i) => !usedRackIndices.includes(i)));
    setSelection({ row: startRow, col: startCol, direction });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [state]);

  const handleAddMove = useCallback((index: number) => {
    const move = moves.find(m => m.index === index);
    if (!move || move.action !== 'play' || !move.coords || !move.tiles) return;
    placeOnBoard(move.coords, move.tiles);
  }, [moves, placeOnBoard]);


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
    if (!state) return;
    setEditingRacks(false);
    // state.turnNumber is the authoritative turn index (events 0..turnNumber-1 committed).
    // Use it — not navIndex — to compute where to go next.
    let newTurn = state.turnNumber;
    if (action === 'first') newTurn = 0;
    else if (action === 'last') newTurn = Math.max(0, history.length - 1);
    else if (action === 'prev') newTurn = Math.max(0, state.turnNumber - 1);
    else if (action === 'next') newTurn = Math.min(history.length - 1, state.turnNumber + 1);

    const id = ++selectPlayIdRef.current;
    clearBoard();
    setSelectedTurn(newTurn);
    setMoves([]);

    const navState = await withLoading(() => api.navigateToTurn(newTurn));
    if (!navState || selectPlayIdRef.current !== id) return;

    const evt = history[newTurn];
    const rack = evt?.rack || navState.rack;
    const rackState = rack !== navState.rack ? await withLoading(() => api.setRack(rack)) : null;
    if (selectPlayIdRef.current !== id) return;

    setState(rackState ?? navState);
    setNavIndex(newTurn);
    selectedPlayRackRef.current = rack;
    setLocalRack(rack.split(''));

    if (evt?.position && evt?.playedTiles) {
      setPendingPlacement({ position: evt.position, tiles: evt.playedTiles, rack });
    }
  }, [withLoading, state, history, clearBoard]);

  const handleNavigateToTurn = useCallback(async (turn: number) => {
    const id = ++selectPlayIdRef.current;
    clearBoard();

    const navState = await withLoading(() => api.navigateToTurn(turn));
    if (!navState || selectPlayIdRef.current !== id) return;

    const evt = history[turn];
    const rack = evt?.rack || navState.rack;
    const rackState = rack !== navState.rack ? await withLoading(() => api.setRack(rack)) : null;
    if (selectPlayIdRef.current !== id) return;

    setState(rackState ?? navState);
    setMoves([]);
    setNavIndex(turn);
    setSelectedTurn(turn);
    selectedPlayRackRef.current = rack;
    setLocalRack(rack.split(''));

    if (evt?.position && evt?.playedTiles) {
      setPendingPlacement({ position: evt.position, tiles: evt.playedTiles, rack });
    }
  }, [withLoading, history, clearBoard]);

  const handleNoteClick = useCallback((turn: number) => {
    handleNavigateToTurn(turn + 1);
    setNoteText(notes[turn] || '');
    setShowNoteInput(true);
  }, [handleNavigateToTurn, notes]);

  // Rack edit mode
  const [editingRacks, setEditingRacks] = useState(false);
  const [editRackOwn, setEditRackOwn] = useState('');
  const [editRackOpp, setEditRackOpp] = useState('');

  const handleAnnotate = useCallback(async () => {
    setShowAnalyzeModal(false);
    const gs = await withLoading(() => api.newGame(lexicon, challengeRule));
    if (!gs) return;
    setState(gs);
    setHistory([]);
    setMoves([]);
    setAnalyzeMode(true);
    setNavIndex(0);
    setEditRackOwn('');
    setEditRackOpp('');
    setEditingRacks(true);
  }, [lexicon, challengeRule]);

  const handleEditStart = useCallback(() => {
    const oppIdx = state ? (state.onTurn === 0 ? 1 : 0) : 1;
    const oppLastEvent = [...history].reverse().find(e => e.playerIndex === oppIdx && e.rack);
    setEditRackOwn(state?.rack ?? '');
    setEditRackOpp(oppLastEvent?.rack ?? '');
    setEditingRacks(true);
  }, [state, history]);

  const handleEditSave = useCallback(async () => {
    if (editRackOwn) {
      const newState = await api.setRack(editRackOwn);
      if (newState) setState(newState);
    }
    setEditingRacks(false);
  }, [editRackOwn]);

  const handleSelectPlay = useCallback(async (turn: number, position: string, tiles: string, rack: string) => {
    const id = ++selectPlayIdRef.current;
    clearBoard();
    setSelectedTurn(turn);
    // Navigate to the state before this play
    const navState = await withLoading(() => api.navigateToTurn(turn));
    if (!navState || selectPlayIdRef.current !== id) return;
    // Explicitly set rack so analysis generates from the correct pre-play rack
    const rackState = await withLoading(() => api.setRack(rack));
    if (selectPlayIdRef.current !== id) return;
    setState(rackState ?? navState);
    setMoves([]);
    setNavIndex(turn);
    selectedPlayRackRef.current = rack;
    setLocalRack(rack.split(''));
    setPendingPlacement({ position, tiles, rack });
  }, [clearBoard, withLoading]);

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
    setNavIndex(0);
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
    // In analyze mode with a selected play, restore the pre-play rack
    const rackSource = selectedPlayRackRef.current || state?.rack || '';
    if (rackSource) {
      setLocalRack(rackSource.split(''));
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
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [headerHeight, setHeaderHeight] = useState(72);
  useEffect(() => {
    const onResize = () => { setViewportHeight(window.innerHeight); setViewportWidth(window.innerWidth); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const cellSize = useMemo(() => {
    // Board: ~15.5cs + 16px | Rack: ~1.15cs + 24px | Action bar: ~54px fixed | bottom padding: 32px
    // Plus measured title row height
    const fixedOverhead = 154 + (headerHeight || 72);
    const byHeight = Math.floor((viewportHeight - fixedOverhead) / 16.65);
    // Two-col (>1100px): reserve 280px side panel + 64px padding + 32px gap + 15px labels
    // Single-col (≤1100px): full width minus 32px padding (smaller padding in media query)
    const byWidth = viewportWidth > 1100
      ? Math.floor((viewportWidth - 400) / 16)
      : Math.floor((viewportWidth - 32) / 16);
    const computed = Math.min(byHeight, byWidth);
    return Math.max(24, Math.min(computed, 60));
  }, [viewportHeight, viewportWidth, headerHeight]);

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
    if (analyzeMode || state.playState === 'GAME_OVER') {
      // In analyze mode: score the move and add it to the list for comparison; don't commit to game
      const result = await withLoading(() => api.scoreMove(coords, tiles));
      if (result) {
        const idx = userPlayIndexRef.current--;
        setMoves(prev => [...prev, {
          index: idx, action: 'play', coords, tiles,
          score: result.score, equity: NaN, leave: '—',
        }]);
        clearBoard();
      }
      return;
    }
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
  }, [placedTiles, state, analyzeMode, withLoading, refreshHistory, clearBoard]);

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

  const handleSwitchGame = useCallback((game: 'scrabble' | 'boggle' | 'cardbbox') => {
    if (game === currentGame) return;
    if (game === 'boggle' && state !== null) {
      if (!window.confirm('Abandon current Scrabble game?')) return;
    }
    if (game === 'cardbbox' && state !== null) {
      if (!window.confirm('Leave current Scrabble game?')) return;
    }
    setCurrentGame(game);
  }, [currentGame, state]);

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
    if (!state || loading || analyzeMode) return;
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
    if (!state || loading || analyzeMode) return;
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

  // Auto-enter analyze mode when game ends
  useEffect(() => {
    const gameOver = state?.playState === 'GAME_OVER';
    if (!gameOver || analyzeMode) return;
    setAnalyzeMode(true);
    clearBoard();
    setNavIndex(history.length - 1);
  }, [state?.playState, analyzeMode, history.length, clearBoard]);

  // Apply pending tile placement after navigation state settles
  useEffect(() => {
    if (!pendingPlacement) return;
    placeOnBoard(pendingPlacement.position, pendingPlacement.tiles, pendingPlacement.rack);
    setPendingPlacement(null);
  }, [pendingPlacement, placeOnBoard]);

  // Poll sim status + results while running
  useEffect(() => {
    if (!simRunning) return;
    const id = setInterval(async () => {
      try {
        const status = await api.sim.status();
        setSimIterations(status.iterations);
        const results = await api.sim.results();
        if (results.length > 0) setMoves(results);
        if (!status.isRunning) {
          setSimRunning(false);
          clearInterval(id);
        }
      } catch {
        setSimRunning(false);
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [simRunning]);

  // Auto-generate moves when navigating in analyze mode
  useEffect(() => {
    const isAnalyze = analyzeMode || state?.playState === 'GAME_OVER';
    if (!isAnalyze || !state) return;
    setGenerateCount(15);
    let cancelled = false;
    api.generate(15).then(m => { if (!cancelled && m) setMoves(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [state, analyzeMode]);

  const isPlaying = state?.playState === 'PLAYING';
  const isGameOver = state?.playState === 'GAME_OVER';
  // Show analyze UI the instant the game ends — don't wait for the auto-enter effect
  const effectiveAnalyzeMode = analyzeMode || isGameOver;
  // When game just ended but analyzeMode state not yet set, treat nav as being at the last turn
  const effectiveNavIndex = analyzeMode ? navIndex : history.length - 1;

  // Winner text — computed synchronously so banner and nav buttons appear in the same render
  let winnerText = '';
  if (isGameOver && state) {
    const idx = state.scores[0] > state.scores[1] ? 0 : state.scores[1] > state.scores[0] ? 1 : -1;
    winnerText = idx === -1
      ? `Draw! Final score: ${state.scores[0]} – ${state.scores[1]}`
      : `${state.playerNames[idx]} wins. Final score: ${state.scores[idx]} – ${state.scores[1 - idx]}`;
  }

  const currentNoteTurn = effectiveNavIndex - 1;
  const handleAddNote = useCallback(() => {
    if (currentNoteTurn < 0) return;
    if (noteText.trim()) {
      setNotes(prev => ({ ...prev, [currentNoteTurn]: noteText.trim() }));
    } else {
      setNotes(prev => { const n = { ...prev }; delete n[currentNoteTurn]; return n; });
    }
    setShowNoteInput(false);
    setNoteText('');
  }, [currentNoteTurn, noteText]);

  const atFirst = effectiveNavIndex <= 0;
  const atLast = history.length === 0 || effectiveNavIndex >= history.length - 1;
  const lastEvent = history.length > 0 ? history[history.length - 1] : null;
  const canChallenge = isPlaying && !!lastEvent?.position && state?.challengeRule !== 'VOID';

  // Global hotkeys for in-game actions (1–6)
  useEffect(() => {
    const handleHotkey = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case '1': if (moveValid) { e.preventDefault(); handleSubmitTiledMove(); } break;
        case '2': e.preventDefault(); handlePass(); break;
        case '3': if (canChallenge) { e.preventDefault(); handleChallenge(); } break;
        case '4': e.preventDefault(); setShowExchange(true); break;
        case '5': e.preventDefault(); handleRecall(); break;
        case '6': e.preventDefault(); handleShuffle(); break;
      }
    };
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, [isPlaying, moveValid, canChallenge, handleSubmitTiledMove, handlePass, handleChallenge, handleRecall, handleShuffle]);

  // Measure board, bottom, and header heights for layout
  const [boardHeight, setBoardHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (boardRef.current) setBoardHeight(boardRef.current.offsetHeight);
      if (bottomRef.current) setBottomHeight(bottomRef.current.offsetHeight);
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (boardRef.current) obs.observe(boardRef.current);
    if (bottomRef.current) obs.observe(bottomRef.current);
    if (headerRef.current) obs.observe(headerRef.current);
    return () => obs.disconnect();
  }, [cellSize, state]);

  // In analyze mode, analysis panel takes 2/3 and scoresheet takes 1/3 of combined content area
  const combinedHeight = boardHeight > 0 && bottomHeight > 0
    ? boardHeight + bottomHeight
    : 0;
  const topZoneHeight = effectiveAnalyzeMode && combinedHeight > 0
    ? Math.round(combinedHeight / 3)
    : boardHeight || undefined;
  const bottomZoneHeight = effectiveAnalyzeMode && combinedHeight > 0
    ? Math.round((2 * combinedHeight) / 3)
    : bottomHeight ? bottomHeight - 16 : undefined;
  const noteInputHeight = bottomZoneHeight ? Math.round(bottomZoneHeight * 0.45) : 160;

  if (currentGame === 'cardbbox') {
    return (
      <CardBBox
        onSwitch={handleSwitchGame}
        lexicon={lexicon}
        lexicons={lexicons}
        theme={theme}
        colorway={colorway}
        onChangeLexicon={setLexicon}
        onChangeTheme={setTheme}
        onChangeColorway={setColorway}
      />
    );
  }

  if (currentGame === 'boggle') {
    return (
      <BoggleGame
        lexicon={lexicon}
        lexicons={lexicons}
        onChangeLexicon={setLexicon}
        theme={theme}
        colorway={colorway}
        onChangeTheme={setTheme}
        onChangeColorway={setColorway}
        onSwitchGame={setCurrentGame}
      />
    );
  }

  return (
    <div className="app">
      <div ref={headerRef} className="app-title-row">
        <GameSwitcher current="scrabble" onChange={handleSwitchGame} />
        <div style={{ flex: 1 }} />
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
      </div>
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
          {state && (isPlaying || effectiveAnalyzeMode) && (
            isGameOver ? (
              // Winner banner occupies the same height as the rack row so the button row never shifts
              <div style={{ height: Math.round(cellSize * 1.15) + 24, display: 'flex', alignItems: 'center' }}>
                <div className="winner-module" style={{ flex: 1, marginBottom: 0 }}>
                  <span className="winner-line">{winnerText}</span>
                </div>
              </div>
            ) : effectiveAnalyzeMode && editingRacks ? (
              <RackEditor
                value={editRackOwn}
                onChange={setEditRackOwn}
                onSave={handleEditSave}
                cellSize={cellSize}
              />
            ) : (
              <Rack
                ref={rackRef}
                localRack={localRack}
                cellSize={cellSize}
                showControls={!effectiveAnalyzeMode}
                showRecall={effectiveAnalyzeMode}
                onShuffle={handleShuffle}
                onRecall={handleRecall}
                onRackPointerDown={onRackPointerDown}
                dragState={dragState}
              />
            )
          )}

          {/* Action bar */}
          <div className="action-bar" ref={optionsRef}>
            {!state ? (
              <div className="action-bar-inner">
                <button className="action-btn action-btn-outline" onClick={() => setShowAnalyzeModal(true)} disabled={loading}>
                  Analyze
                </button>
                <button className="action-btn action-btn-primary" onClick={handleNewGame} disabled={loading}>
                  Start game
                </button>
              </div>
            ) : effectiveAnalyzeMode ? (
              <div className="action-bar-inner">
                  <button className="action-btn action-btn-outline" onClick={handleExport} disabled={loading || editingRacks}>Export</button>
                  <button className={`nav-circle-btn${(atFirst || editingRacks) ? ' nav-circle-inactive' : ' nav-circle-active'}`} onClick={() => handleNavigate('first')} disabled={loading || atFirst || editingRacks} title="First">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
                    </svg>
                  </button>
                  <button className={`nav-circle-btn${(atFirst || editingRacks) ? ' nav-circle-inactive' : ' nav-circle-active'}`} onClick={() => handleNavigate('prev')} disabled={loading || atFirst || editingRacks} title="Previous">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  {editingRacks ? (
                    <button className="nav-circle-btn nav-circle-active" onClick={handleEditSave} title="Save rack">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  ) : (
                    <button className="nav-circle-btn nav-circle-active" onClick={handleEditStart} title="Edit rack">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  <button className={`nav-circle-btn${(atLast || editingRacks) ? ' nav-circle-inactive' : ' nav-circle-active'}`} onClick={() => handleNavigate('next')} disabled={loading || atLast || editingRacks} title="Next">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <button className={`nav-circle-btn${(atLast || editingRacks) ? ' nav-circle-inactive' : ' nav-circle-active'}`} onClick={() => handleNavigate('last')} disabled={loading || atLast || editingRacks} title="Last">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
                    </svg>
                  </button>
                  <button className="action-btn action-btn-primary" onClick={handleExit} disabled={editingRacks}>Done</button>
                </div>
            ) : (isPlaying && !analyzeMode) ? (
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
            ) : null}
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

        <div className="side-panel" style={effectiveAnalyzeMode ? { minWidth: 340 } : undefined}>
          {/* Top zone: sCraBBle header + scoresheet */}
          <div style={{ height: topZoneHeight, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, flexShrink: 0, overflow: 'hidden' }}>
            <Scoresheet
              events={history}
              state={state}
              statusMsg={statusMsg}
              onNavigate={handleNavigateToTurn}
              gameOver={isGameOver}
              currentTurn={effectiveNavIndex}
              notes={notes}
              onNoteClick={handleNoteClick}
              onSelectPlay={effectiveAnalyzeMode ? handleSelectPlay : undefined}
              selectedTurn={selectedTurn}
            />
          </div>

          {/* Bottom zone: generated moves / analysis */}
          {state && (isPlaying || effectiveAnalyzeMode) && <div className="panel-section" style={{ marginTop: 16, height: bottomZoneHeight, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 12px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '10px 0' }}>
                <h3 style={{ borderBottom: 'none', fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  {effectiveAnalyzeMode
                    ? `Analysis (${simSettings.plies}-ply${simSettings.stoppingCondition > 0 ? `, ${['','90%','95%','98%','99%','99.9%'][simSettings.stoppingCondition]}` : ''}${simSettings.inference ? `, infer ${simSettings.inference}` : ''})`
                    : 'Generated moves'}
                </h3>
              </div>
              {effectiveAnalyzeMode ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className={`nav-circle-btn ${currentNoteTurn < 0 ? 'nav-circle-inactive' : 'nav-circle-active'}`}
                    onClick={() => {
                      if (showNoteInput) {
                        setShowNoteInput(false);
                      } else {
                        setNoteText(notes[currentNoteTurn] || '');
                        setShowNoteInput(true);
                      }
                    }}
                    disabled={currentNoteTurn < 0}
                    title="Add note"
                    style={{
                      width: 32, height: 32,
                      color: notes[currentNoteTurn] || showNoteInput ? 'var(--cw)' : 'var(--cw)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className={`nav-circle-btn ${simRunning ? 'nav-circle-inactive' : 'nav-circle-active'}`}
                    onClick={() => setShowSimSettings(true)}
                    disabled={simRunning}
                    title="Sim settings"
                    style={{ width: 32, height: 32 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={moves.length > 0 && showMoves ? () => setShowMoves(false) : handleGenerate}
                  disabled={moves.length === 0 && (loading || !isPlaying)}
                  style={{
                    background: 'var(--bg)', border: 'none',
                    fontSize: 12, fontWeight: 600, fontFamily: "'Lexend', sans-serif",
                    cursor: (moves.length === 0 && (loading || !isPlaying)) ? 'not-allowed' : 'pointer',
                    padding: '6px 12px', borderRadius: 8,
                    boxShadow: (moves.length === 0 && (loading || !isPlaying)) ? 'none' : 'var(--shadow-neu-sm)',
                    color: (moves.length === 0 && (loading || !isPlaying)) ? 'var(--text-disabled)' : 'var(--cw)',
                  }}
                >
                  {moves.length > 0 && showMoves ? 'Hide' : 'Generate'}
                </button>
              )}
            </div>

            {/* Scrollable moves list */}
            {(effectiveAnalyzeMode || showMoves) && (
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <MoveList
                  moves={moves}
                  board={state?.board}
                  onPlayMove={handlePlayMove}
                  onAddMove={handleAddMove}
                  analysisMode={effectiveAnalyzeMode}
                  loading={loading}
                />
                {effectiveAnalyzeMode && moves.length > 0 && (
                  <div style={{ padding: '8px 12px' }}>
                    <button
                      className="action-btn action-btn-outline"
                      onClick={handleGenerateMore}
                      disabled={loading || simRunning}
                      style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
                    >
                      More
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Note input panel — slides up from below scrollable area */}
            {effectiveAnalyzeMode && (
              <div style={{
                flexShrink: 0, overflow: 'hidden',
                height: showNoteInput ? noteInputHeight : 0,
                transition: 'height 0.25s ease',
                borderTop: showNoteInput ? '1px solid var(--border)' : 'none',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ flex: 1, padding: '10px 12px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add a note for this play…"
                    style={{
                      flex: 1, resize: 'none', border: 'none', outline: 'none',
                      background: 'var(--bg)', borderRadius: 8, padding: '8px 10px',
                      fontSize: 13, fontFamily: "'Lexend', sans-serif", color: 'var(--text)',
                      boxShadow: 'var(--shadow-neu-inset)',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="action-btn action-btn-outline"
                      onClick={() => { setShowNoteInput(false); setNoteText(''); }}
                      style={{ fontSize: 12, padding: '5px 12px', flex: 'none' }}
                    >
                      Cancel
                    </button>
                    <button
                      className={`action-btn ${noteText.trim() ? 'action-btn-primary' : 'action-btn-outline'}`}
                      onClick={handleAddNote}
                      style={{ fontSize: 12, padding: '5px 14px', flex: 'none' }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sticky footer — analysis mode only */}
            {effectiveAnalyzeMode && (
              <div style={{
                flexShrink: 0, borderTop: '1px solid var(--border)',
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <button
                  className="action-btn action-btn-outline"
                  onClick={handleReset}
                  disabled={simRunning || loading}
                  style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
                >
                  Reset
                </button>
                <div style={{ flex: 1 }} />
                <button
                  className="action-btn action-btn-outline"
                  onClick={handleSubmitTiledMove}
                  disabled={!moveValid || loading || simRunning}
                  style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
                >
                  Add play
                </button>
                <button
                  className="action-btn action-btn-primary"
                  onClick={handleSimulate}
                  disabled={loading}
                  style={{ fontSize: 12, padding: '6px 16px', whiteSpace: 'nowrap' }}
                >
                  {simRunning ? `Stop (${simIterations.toLocaleString()})` : 'Simulate'}
                </button>
              </div>
            )}
          </div>}
        </div>
      </div>

      {showAnalyzeModal && (
        <AnalyzeModal
          onWoogles={handleLoadWoogles}
          onGCG={handleLoadGCGFile}
          onAnnotate={handleAnnotate}
          onCancel={() => setShowAnalyzeModal(false)}
          loading={loading}
        />
      )}

      {showExchange && state && (
        <ExchangeModal
          rack={state.rack}
          onExchange={handleExchange}
          onCancel={() => setShowExchange(false)}
          loading={loading}
        />
      )}

      {showSimSettings && (
        <SimSettingsModal
          settings={simSettings}
          onSave={s => { setSimSettings(s); setShowSimSettings(false); }}
          onCancel={() => setShowSimSettings(false)}
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

export interface GameState {
  board: string[][];
  rack: string;
  scores: number[];
  playerNames: string[];
  onTurn: number;
  turnNumber: number;
  bagCount: number;
  playState: string;
  lastMove: string;
  scorelessTurns: number;
  lexicon: string;
  challengeRule: string;
  phonyChallenged?: boolean;
}

export interface MoveInfo {
  index: number;
  action: string;
  coords?: string;
  tiles?: string;
  score: number;
  equity: number;
  leave: string;
  tilesPlayed?: number;
  winPct?: number;
}

export interface SimStatus {
  isRunning: boolean;
  iterations: number;
}

export interface SimSettings {
  plies: number;
  stoppingCondition: number; // 0=none,1=90%,2=95%,3=98%,4=99%,5=99.9%
  inference: string; // known opponent tiles, e.g. "AEI?" — empty = no inference
}

export interface AIPlayResult {
  move: string;
  score: number;
  state: GameState;
}

export interface EventInfo {
  turn: number;
  playerIndex: number;
  type: string;
  position?: string;
  playedTiles?: string;
  score: number;
  cumulative: number;
  rack?: string;
  exchanged?: string;
  isBingo?: boolean;
  note?: string;
  wordsFormed?: string[];
  endRackPoints?: number;
  lostScore?: number;
}

export interface PlacedTile {
  row: number;
  col: number;
  letter: string;     // uppercase = real tile, lowercase = blank
  rackIndex: number;   // original index in localRack for returns
}

export interface BoggleGameState {
  board: string[][];
  size: 4 | 5;
  validWords: string[];
}

export interface APIResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

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
}

export interface APIResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

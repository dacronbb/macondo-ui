import type { APIResponse, GameState, MoveInfo, AIPlayResult, EventInfo } from './types';

const BASE = '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const json: APIResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error || 'Unknown error');
  return json.data as T;
}

export const api = {
  newGame: (lexicon?: string, challengeRule?: string) =>
    request<GameState>('POST', '/game/new', { lexicon, challengeRule }),

  loadGame: (source: string, content?: string, gameId?: string) =>
    request<GameState>('POST', '/game/load', { source, content, gameId }),

  getState: () =>
    request<GameState>('GET', '/game/state'),

  playMove: (coords: string, tiles: string) =>
    request<GameState>('POST', '/game/move', { coords, tiles }),

  playMoveFromList: (moveIndex: number) =>
    request<GameState>('POST', '/game/move', { moveIndex }),

  playPass: () =>
    request<GameState>('POST', '/game/move', { isPass: true }),

  playExchange: (tiles: string) =>
    request<GameState>('POST', '/game/move', { isExchange: true, tiles }),

  generate: (numPlays = 15) =>
    request<MoveInfo[]>('POST', '/game/generate', { numPlays }),

  navigate: (action: string) =>
    request<GameState>('POST', '/game/navigate', { action }),

  navigateToTurn: (turn: number) =>
    request<GameState>('POST', '/game/navigate', { turn }),

  setRack: (rack: string) =>
    request<GameState>('POST', '/game/rack', { rack }),

  challenge: () =>
    request<GameState>('POST', '/game/challenge'),

  aiPlay: () =>
    request<AIPlayResult>('POST', '/game/aiplay'),

  getHistory: () =>
    request<EventInfo[]>('GET', '/game/history'),

  exportGCG: () =>
    request<{ gcg: string }>('POST', '/game/export'),

  getLexicons: () =>
    request<string[]>('GET', '/lexicons'),

  checkWords: (words: string[]) =>
    request<Record<string, boolean>>('POST', '/word/check', { words }),

  setSettings: (challengeRule: string) =>
    request<GameState>('POST', '/game/settings', { challengeRule }),
};

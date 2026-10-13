import Fuse from 'fuse.js';
import type { Prompt } from './types';
export function normalize(answer: string) { return answer.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' '); }
/** Display aid only. The server owns score decisions. Never runs on unrevealed choices. */
export function fuzzyMatch(answer: string, guess: string) {
  const a = normalize(answer); const b = normalize(guess);
  return a === b || (a.length >= 4 && b.length >= 4 && new Fuse([a], { threshold: 0.2, ignoreLocation: true }).search(b).length > 0);
}
export function winLine(board: number[]): number[] {
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
    const cells = Array.from({ length: 4 }, (_, i) => (r + dr * i) * 7 + c + dc * i);
    if (r + dr * 3 >= 6 || c + dc * 3 >= 7 || c + dc * 3 < 0) continue;
    if (board[cells[0]!] && cells.every(cell => board[cell] === board[cells[0]!])) return cells;
  }
  return [];
}
export function pickPrompt(pool: Prompt[], used?: string): Prompt {
  const fresh = pool.filter(p => p.id !== used);
  const candidates = fresh.length ? fresh : pool;
  if (!candidates.length) throw new Error('No prompts in this category. Add one or choose another category.');
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

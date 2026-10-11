import { Chess, type Color, type PieceSymbol } from 'chess.js';
import type { ChessGameRow } from '@/types/db';

export const glyphs: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
export function restore(game: Pick<ChessGameRow, 'fen' | 'pgn'>): Chess {
  const chess = new Chess();
  // Replay PGN, rather than only FEN, to preserve repetition history.
  if (game.pgn.trim()) chess.loadPgn(game.pgn);
  else chess.load(game.fen);
  if (chess.fen() !== game.fen) throw new Error('Saved chess history does not match the board. Please refresh.');
  return chess;
}
export function outcome(chess: Chess): ChessGameRow['status'] {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  return chess.isDraw() ? 'draw' : 'active';
}
export function drawReason(chess: Chess): string {
  if (chess.isStalemate()) return 'Stalemate';
  if (chess.isThreefoldRepetition()) return 'Threefold repetition';
  if (chess.isInsufficientMaterial()) return 'Insufficient material';
  if (chess.isDrawByFiftyMoves()) return '50-move rule';
  return 'Draw by agreement';
}
export function captures(chess: Chess, color: Color) {
  return chess.history({ verbose: true }).filter(move => move.color === color && move.captured).map(move => move.captured!);
}
export function material(chess: Chess, color: Color): number {
  const values: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return chess.board().flat().reduce((sum, piece) => sum + (piece ? values[piece.type] * (piece.color === color ? 1 : -1) : 0), 0);
}

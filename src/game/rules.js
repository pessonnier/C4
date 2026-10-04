import { ROWS, hasFour } from "./bitboard.js";
import { RED, YELLOW, canPlay, legalMoves, play } from "./board.js";

export function hasWon(board, player) {
  return hasFour(player === RED ? board.redMask : board.yellowMask);
}

export function winner(board) {
  if (hasWon(board, RED)) return RED;
  if (hasWon(board, YELLOW)) return YELLOW;
  return null;
}

export function isWinningMove(board, column, player) {
  if (!canPlay(board, column)) return false;
  // Policy probes may ask about either player, independently of board parity.
  const height = (() => {
    const occupied = board.redMask | board.yellowMask;
    for (let row = 1; row <= ROWS; row += 1) {
      const shift = BigInt((column - 1) * 7 + row - 1);
      if ((occupied & (1n << shift)) === 0n) return row;
    }
    return null;
  })();
  if (height === null) return false;
  const bit = 1n << BigInt((column - 1) * 7 + height - 1);
  return hasFour((player === RED ? board.redMask : board.yellowMask) | bit);
}

export function immediateWinningMoves(board, player) {
  return legalMoves(board).filter((column) => isWinningMove(board, column, player));
}

export function isFull(board) {
  return board.ply === 42;
}

export function playAndCheck(board, column) {
  const next = play(board, column);
  return { board: next, winner: winner(next), full: isFull(next) };
}

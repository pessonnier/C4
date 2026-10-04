import { createBoard, boardKey } from "./board.js";
import { mirrorBitboard } from "./bitboard.js";

export function mirrorColumn(column) {
  if (!Number.isInteger(column) || column < 1 || column > 7) {
    throw new RangeError("column must be between 1 and 7");
  }
  return 8 - column;
}

export function mirrorMoveSequence(moves) {
  return [...String(moves)].map((move) => String(mirrorColumn(Number(move)))).join("");
}

export function mirrorBoard(board) {
  return createBoard(mirrorBitboard(board.redMask), mirrorBitboard(board.yellowMask), board.ply);
}

export function canonicalBoardKey(board) {
  const direct = boardKey(board);
  const mirrored = boardKey(mirrorBoard(board));
  return direct < mirrored ? direct : mirrored;
}

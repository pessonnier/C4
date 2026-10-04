import { boardFromMoves, boardKey } from "../game/board.js";
import { mirrorBoard, mirrorColumn } from "../game/symmetry.js";

export function validateBranchesFormat(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("branches must be a JSON object");
  }
  for (const [moves, move] of Object.entries(value)) {
    if (!/^[1-7]*$/.test(moves)) throw new Error(`invalid branch position ${JSON.stringify(moves)}`);
    if (moves.length % 2 !== 0) throw new Error(`branch ${moves} is not a Red-to-move position`);
    if (typeof move !== "string" || !/^[1-7]$/.test(move)) {
      throw new Error(`branch ${moves} must select one column from 1 to 7`);
    }
    boardFromMoves(moves);
  }
  return value;
}

export class BranchBook {
  constructor(rawBranches) {
    this.raw = validateBranchesFormat(rawBranches);
    this.byBoardKey = new Map();
    for (const [moves, rawMove] of Object.entries(rawBranches)) {
      const board = boardFromMoves(moves);
      const key = boardKey(board);
      const mirrorKey = boardKey(mirrorBoard(board));
      if (this.byBoardKey.has(key) || (mirrorKey !== key && this.byBoardKey.has(mirrorKey))) {
        throw new Error(`duplicate branch board modulo mirror at ${JSON.stringify(moves)}`);
      }
      this.byBoardKey.set(key, { move: Number(rawMove), sourceMoves: moves });
    }
  }

  lookup(board) {
    const direct = this.byBoardKey.get(boardKey(board));
    if (direct) return { ...direct, mirrored: false };
    const reflected = this.byBoardKey.get(boardKey(mirrorBoard(board)));
    if (!reflected) return null;
    return { ...reflected, move: mirrorColumn(reflected.move), mirrored: true };
  }

  has(board) {
    return this.lookup(board) !== null;
  }

  get size() {
    return this.byBoardKey.size;
  }
}

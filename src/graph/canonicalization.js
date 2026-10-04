import { boardKey } from "../game/board.js";

export const ROOT_ID = "root";

export function nodeIdForBoard(board) {
  if (board.ply === 0) return ROOT_ID;
  return `n-${boardKey(board).replace(":", "-")}`;
}

export class BoardNodeIndex {
  constructor(nodes = []) {
    this.byBoardKey = new Map(nodes.map((node) => [node.boardKey, node.id]));
  }

  add(board, nodeId) {
    const key = boardKey(board);
    const existing = this.byBoardKey.get(key);
    if (existing && existing !== nodeId) throw new Error(`board ${key} already belongs to ${existing}`);
    this.byBoardKey.set(key, nodeId);
  }

  get(boardOrKey) {
    return this.byBoardKey.get(typeof boardOrKey === "string" ? boardOrKey : boardKey(boardOrKey));
  }

  has(boardOrKey) {
    return this.get(boardOrKey) !== undefined;
  }
}

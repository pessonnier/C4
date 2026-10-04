import { boardFromDiagram, boardKey } from "../game/board.js";
import { mirrorBoard } from "../game/symmetry.js";

export const STEADY_STATE_SYMBOLS = new Set(["1", "2", "!", "@", "|", " ", "+", "=", "-"]);

export function validateDiagram(diagram, label = "diagram") {
  if (!Array.isArray(diagram) || diagram.length !== 6) {
    throw new Error(`${label} must contain exactly six rows`);
  }
  for (let row = 0; row < 6; row += 1) {
    if (typeof diagram[row] !== "string" || diagram[row].length !== 7) {
      throw new Error(`${label} row ${row + 1} must contain exactly seven characters`);
    }
    for (const symbol of diagram[row]) {
      if (!STEADY_STATE_SYMBOLS.has(symbol)) {
        throw new Error(`${label} contains unknown symbol ${JSON.stringify(symbol)}`);
      }
    }
  }
  const board = boardFromDiagram(diagram);
  if (board.ply % 2 !== 0) throw new Error(`${label} must describe a Red-to-move board`);
  return diagram;
}

export function validateSteadyStatesFormat(value) {
  if (!Array.isArray(value)) throw new TypeError("steady states must be a JSON array");
  value.forEach((diagram, index) => validateDiagram(diagram, `steady state ${index}`));
  return value;
}

export function mirrorDiagram(diagram) {
  return diagram.map((row) => [...row].reverse().join(""));
}

export class SteadyStateBook {
  constructor(rawDiagrams) {
    this.diagrams = validateSteadyStatesFormat(rawDiagrams);
    this.byBoardKey = new Map();
    rawDiagrams.forEach((diagram, id) => {
      const board = boardFromDiagram(diagram);
      const key = boardKey(board);
      const mirrorKey = boardKey(mirrorBoard(board));
      if (this.byBoardKey.has(key) || (mirrorKey !== key && this.byBoardKey.has(mirrorKey))) {
        throw new Error(`duplicate steady-state board modulo mirror at index ${id}`);
      }
      this.byBoardKey.set(key, { id, diagram });
    });
  }

  lookup(board) {
    const direct = this.byBoardKey.get(boardKey(board));
    if (direct) return { ...direct, mirrored: false };
    const reflected = this.byBoardKey.get(boardKey(mirrorBoard(board)));
    if (!reflected) return null;
    return { id: reflected.id, diagram: mirrorDiagram(reflected.diagram), mirrored: true };
  }

  has(board) {
    return this.lookup(board) !== null;
  }

  get size() {
    return this.byBoardKey.size;
  }
}

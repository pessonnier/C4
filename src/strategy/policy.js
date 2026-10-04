import { RED, YELLOW, columnHeight, legalMoves } from "../game/board.js";
import { isWinningMove } from "../game/rules.js";
import { validateDiagram } from "./steady-state.js";

export class SteadyStatePolicyError extends Error {
  constructor(message, level = null, candidates = []) {
    super(message);
    this.name = "SteadyStatePolicyError";
    this.level = level;
    this.candidates = candidates;
  }
}

function playableSymbol(board, diagram, symbol, rowPredicate = () => true) {
  return legalMoves(board).filter((column) => {
    const row = columnHeight(board, column) + 1;
    const diagramRow = 6 - row;
    return rowPredicate(row) && diagram[diagramRow][column - 1] === symbol;
  });
}

function uniqueOrContinue(candidates, level) {
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw new SteadyStatePolicyError(
      `steady-state level ${level} is ambiguous (${candidates.join(", ")})`,
      level,
      candidates,
    );
  }
  return null;
}

export function steadyStatePolicy(board, diagram) {
  validateDiagram(diagram);

  for (const column of legalMoves(board)) {
    if (isWinningMove(board, column, RED)) return column;
  }
  for (const column of legalMoves(board)) {
    if (isWinningMove(board, column, YELLOW)) return column;
  }

  const urgent = uniqueOrContinue(playableSymbol(board, diagram, "!"), "urgent");
  if (urgent !== null) return urgent;

  const miai = playableSymbol(board, diagram, "@");
  if (miai.length === 1) return miai[0];
  // Multiple miai candidates are deliberately ignored, unlike other levels.

  const claims = [
    ...playableSymbol(board, diagram, "|", (row) => row % 2 === 1),
    ...playableSymbol(board, diagram, " ", (row) => row % 2 === 0),
  ].sort((left, right) => left - right);
  const claim = uniqueOrContinue(claims, "claim");
  if (claim !== null) return claim;

  for (const [symbol, level] of [["+", "plus"], ["=", "equal"], ["-", "minus"]]) {
    const selected = uniqueOrContinue(playableSymbol(board, diagram, symbol), level);
    if (selected !== null) return selected;
  }

  throw new SteadyStatePolicyError("steady-state diagram does not determine a move", "none", []);
}

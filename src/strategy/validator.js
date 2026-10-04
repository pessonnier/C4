import { RED, YELLOW, boardKey, legalMoves, play } from "../game/board.js";
import { hasWon, immediateWinningMoves, isFull } from "../game/rules.js";
import { BranchBook, validateBranchesFormat } from "./branches.js";
import { SteadyStateBook, validateSteadyStatesFormat } from "./steady-state.js";
import { steadyStatePolicy } from "./policy.js";

export function classifyYellowReply(board, branches, steadyStates) {
  const branch = branches.lookup(board);
  const steadyState = steadyStates.lookup(board);
  const immediateWin = immediateWinningMoves(board, RED).length > 0;
  return {
    branch,
    steadyState,
    immediateWin,
    count: Number(Boolean(branch)) + Number(Boolean(steadyState)) + Number(immediateWin),
  };
}

export function verifySteadyState(diagram, { maxPositions = Infinity } = {}) {
  const book = new SteadyStateBook([diagram]);
  const initial = [...book.byBoardKey.keys()][0];
  const start = (() => {
    const record = book.byBoardKey.get(initial);
    return importDiagramBoard(record.diagram);
  })();
  const memo = new Map();
  let visited = 0;

  function redTurn(board) {
    const key = boardKey(board);
    if (memo.has(key)) return memo.get(key);
    visited += 1;
    if (visited > maxPositions) throw new Error(`steady-state verification exceeded ${maxPositions} positions`);
    // Mark pessimistically to make the routine robust even if fed malformed cyclic state objects.
    memo.set(key, false);
    let redMove;
    try {
      redMove = steadyStatePolicy(board, diagram);
    } catch {
      return false;
    }
    let afterRed;
    try {
      afterRed = play(board, redMove, RED);
    } catch {
      return false;
    }
    if (hasWon(afterRed, RED)) {
      memo.set(key, true);
      return true;
    }
    if (isFull(afterRed)) return false;
    for (const yellowMove of legalMoves(afterRed)) {
      const afterYellow = play(afterRed, yellowMove, YELLOW);
      if (hasWon(afterYellow, YELLOW) || isFull(afterYellow) || !redTurn(afterYellow)) return false;
    }
    memo.set(key, true);
    return true;
  }

  if (hasWon(start, RED) || hasWon(start, YELLOW)) return { valid: false, visited: 0 };
  return { valid: redTurn(start), visited };
}

// Kept local to avoid exposing strategy parsing through the game API.
function importDiagramBoard(diagram) {
  let redMask = 0n;
  let yellowMask = 0n;
  for (let top = 0; top < 6; top += 1) {
    for (let column = 1; column <= 7; column += 1) {
      const shift = BigInt((column - 1) * 7 + (5 - top));
      if (diagram[top][column - 1] === "1") redMask |= 1n << shift;
      if (diagram[top][column - 1] === "2") yellowMask |= 1n << shift;
    }
  }
  return Object.freeze({ redMask, yellowMask, ply: popcountLocal(redMask | yellowMask) });
}

function popcountLocal(mask) {
  let count = 0;
  for (let value = mask; value; value &= value - 1n) count += 1;
  return count;
}

export function validateCompactStrategy(rawBranches, rawSteadyStates, options = {}) {
  validateBranchesFormat(rawBranches);
  validateSteadyStatesFormat(rawSteadyStates);
  const branches = new BranchBook(rawBranches);
  const steadyStates = new SteadyStateBook(rawSteadyStates);
  const issues = [];
  const usedBranches = new Set([""]);
  const usedSteadyStates = new Set();

  if (!Object.hasOwn(rawBranches, "")) issues.push("branches do not contain the empty-board root");

  for (const [moves, rawMove] of Object.entries(rawBranches)) {
    let board;
    try {
      const { boardFromMoves } = options.game ?? {};
      board = boardFromMoves ? boardFromMoves(moves) : null;
    } catch (error) {
      issues.push(`branch ${moves}: ${error.message}`);
    }
    if (!board) {
      // Dynamic-free default path keeps this module browser-compatible.
      board = replayMoves(moves);
    }
    const afterRed = play(board, Number(rawMove), RED);
    for (const yellowMove of legalMoves(afterRed)) {
      const child = play(afterRed, yellowMove, YELLOW);
      if (hasWon(child, YELLOW)) {
        issues.push(`branch ${moves}${rawMove}: Yellow wins with ${yellowMove}`);
        continue;
      }
      const coverage = classifyYellowReply(child, branches, steadyStates);
      if (coverage.count !== 1) {
        issues.push(
          `reply ${moves}${rawMove}${yellowMove} has ${coverage.count} coverages ` +
          `(branch=${Boolean(coverage.branch)}, steady=${Boolean(coverage.steadyState)}, win=${coverage.immediateWin})`,
        );
      }
      if (coverage.branch) usedBranches.add(coverage.branch.sourceMoves);
      if (coverage.steadyState) usedSteadyStates.add(coverage.steadyState.id);
    }
  }

  for (const moves of Object.keys(rawBranches)) {
    if (!usedBranches.has(moves)) issues.push(`branch ${moves} is unreachable`);
  }
  rawSteadyStates.forEach((_diagram, id) => {
    if (!usedSteadyStates.has(id)) issues.push(`steady state ${id} is unreachable`);
  });

  const steadyStateResults = [];
  if (options.exhaustive !== false) {
    rawSteadyStates.forEach((diagram, id) => {
      const result = verifySteadyState(diagram, options);
      steadyStateResults.push({ id, ...result });
      if (!result.valid) issues.push(`steady state ${id} does not force a Red win`);
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    counts: { branches: branches.size, steadyStates: steadyStates.size },
    usedBranches,
    usedSteadyStates,
    steadyStateResults,
  };
}

function replayMoves(moves) {
  let board = Object.freeze({ redMask: 0n, yellowMask: 0n, ply: 0 });
  for (const move of moves) board = play(board, Number(move));
  return board;
}

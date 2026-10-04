import { RED, YELLOW, boardKey, legalMoves, play, sideToMove } from "../game/board.js";
import { decodeMask } from "../game/bitboard.js";
import { hasWon, isFull } from "../game/rules.js";
import { steadyStatePolicy } from "./policy.js";

const ZERO = Object.freeze({ redWins: 0n, yellowWins: 0n, draws: 0n });

function terminal(outcome) {
  return {
    redWins: outcome === RED ? 1n : 0n,
    yellowWins: outcome === YELLOW ? 1n : 0n,
    draws: outcome === "DRAW" ? 1n : 0n,
  };
}

function add(left, right) {
  return {
    redWins: left.redWins + right.redWins,
    yellowWins: left.yellowWins + right.yellowWins,
    draws: left.draws + right.draws,
  };
}

function boardFromNode(node) {
  return Object.freeze({
    redMask: decodeMask(node.redMask),
    yellowMask: decodeMask(node.yellowMask),
    ply: node.ply,
  });
}

/**
 * Counts proof paths in the developed DAG. A steady-state certificate and an
 * omitted immediate Red win each count as one successful terminal proof path.
 */
export class GraphOutcomeIndex {
  constructor(graph) {
    this.graph = graph;
    this.nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    this.outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
    graph.edges.forEach((edge) => this.outgoing.get(edge.source)?.push(edge));
    this.results = new Map();
    this.build();
  }

  build() {
    const ordered = [...this.graph.nodes].sort((left, right) => right.ply - left.ply);
    for (const node of ordered) {
      if (node.kind === "STEADY_STATE") {
        this.results.set(node.id, {
          totals: terminal(RED),
          columns: {},
          basis: "steady-state-certificate",
        });
        continue;
      }
      const edges = this.outgoing.get(node.id) ?? [];
      if (node.sideToMove === RED) {
        const selected = edges[0];
        const totals = selected ? this.results.get(selected.target).totals : terminal(RED);
        this.results.set(node.id, {
          totals,
          columns: selected ? { [selected.column]: totals } : {},
          basis: "proof-dag",
        });
        continue;
      }
      const board = boardFromNode(node);
      const byColumn = new Map(edges.map((edge) => [edge.column, edge]));
      const columns = {};
      let totals = ZERO;
      for (const column of legalMoves(board)) {
        const edge = byColumn.get(column);
        // Missing Yellow edges are exactly the certified immediate-Red-win case.
        const result = edge ? this.results.get(edge.target).totals : terminal(RED);
        columns[column] = result;
        totals = add(totals, result);
      }
      this.results.set(node.id, { totals, columns, basis: "proof-dag" });
    }
  }

  get(nodeId) {
    return this.results.get(nodeId) ?? { totals: ZERO, columns: {}, basis: "unavailable" };
  }
}

/** Counts complete terminal game lines once play has entered a fixed diagram. */
export class SteadyStateOutcomeAnalyzer {
  constructor() {
    this.memo = new Map();
  }

  contextKey(diagram, diagramId) {
    return diagramId === undefined || diagramId === null
      ? diagram.join("/")
      : String(diagramId);
  }

  analyzeRedTurn(board, diagram, diagramId = null) {
    const key = `R|${this.contextKey(diagram, diagramId)}|${boardKey(board)}`;
    if (this.memo.has(key)) return this.memo.get(key);
    if (hasWon(board, RED)) return terminal(RED);
    if (hasWon(board, YELLOW)) return terminal(YELLOW);
    if (isFull(board)) return terminal("DRAW");
    const move = steadyStatePolicy(board, diagram);
    const afterRed = play(board, move, RED);
    let result;
    if (hasWon(afterRed, RED)) result = terminal(RED);
    else if (isFull(afterRed)) result = terminal("DRAW");
    else result = this.analyzeYellowTurn(afterRed, diagram, diagramId).totals;
    this.memo.set(key, result);
    return result;
  }

  analyzeYellowTurn(board, diagram, diagramId = null) {
    if (sideToMove(board) !== YELLOW) throw new Error("outcome analysis expected Yellow to move");
    const key = `Y|${this.contextKey(diagram, diagramId)}|${boardKey(board)}`;
    if (this.memo.has(key)) return this.memo.get(key);
    const columns = {};
    let totals = ZERO;
    for (const column of legalMoves(board)) {
      const afterYellow = play(board, column, YELLOW);
      let result;
      if (hasWon(afterYellow, YELLOW)) result = terminal(YELLOW);
      else if (isFull(afterYellow)) result = terminal("DRAW");
      else result = this.analyzeRedTurn(afterYellow, diagram, diagramId);
      columns[column] = result;
      totals = add(totals, result);
    }
    const analysis = { totals, columns, basis: "complete-game-lines" };
    this.memo.set(key, analysis);
    return analysis;
  }
}

export class StrategyOutcomeAnalyzer {
  constructor(graph) {
    this.graph = new GraphOutcomeIndex(graph);
    this.steadyState = new SteadyStateOutcomeAnalyzer();
  }

  graphNode(nodeId) {
    return this.graph.get(nodeId);
  }

  yellowPosition(board, { nodeId = null, diagram = null, diagramId = null } = {}) {
    if (diagram) return this.steadyState.analyzeYellowTurn(board, diagram, diagramId);
    return this.graphNode(nodeId);
  }

  position(board, { nodeId = null, diagram = null, diagramId = null } = {}) {
    if (!diagram) return this.graphNode(nodeId);
    if (sideToMove(board) === YELLOW) {
      return this.steadyState.analyzeYellowTurn(board, diagram, diagramId);
    }
    const move = steadyStatePolicy(board, diagram);
    const totals = this.steadyState.analyzeRedTurn(board, diagram, diagramId);
    return { totals, columns: { [move]: totals }, basis: "complete-game-lines" };
  }
}

export function classifyColumn(result, player) {
  const ownWins = player === RED ? result.redWins : result.yellowWins;
  const losses = player === RED ? result.yellowWins : result.redWins;
  if (ownWins > 0n && losses === 0n && result.draws === 0n) return "WIN";
  if (losses > 0n && ownWins === 0n && result.draws === 0n) return "LOSS";
  if (result.draws > 0n && ownWins === 0n && losses === 0n) return "DRAW";
  return "MIXED";
}

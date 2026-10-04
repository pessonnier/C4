import {
  RED,
  YELLOW,
  boardKey,
  emptyBoard,
  legalMoves,
  play,
  serializeBoard,
  sideToMove,
} from "../game/board.js";
import { hasWon, immediateWinningMoves } from "../game/rules.js";
import { BranchBook } from "../strategy/branches.js";
import { SteadyStateBook } from "../strategy/steady-state.js";
import { classifyYellowReply } from "../strategy/validator.js";
import { BoardNodeIndex, ROOT_ID, nodeIdForBoard } from "./canonicalization.js";

export class GraphBuildError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "GraphBuildError";
    this.details = details;
  }
}

function nodeKind(board, steadyState) {
  if (steadyState) return "STEADY_STATE";
  return sideToMove(board) === RED ? "RED_DECISION" : "YELLOW_REPLY";
}

export function buildGraph(rawBranches, rawSteadyStates, options = {}) {
  const branches = rawBranches instanceof BranchBook ? rawBranches : new BranchBook(rawBranches);
  const steadyStates = rawSteadyStates instanceof SteadyStateBook
    ? rawSteadyStates
    : new SteadyStateBook(rawSteadyStates);
  const nodes = [];
  const edges = [];
  const nodeById = new Map();
  const boardsById = new Map();
  const index = new BoardNodeIndex();
  const queue = [];
  const expanded = new Set();

  function ensureNode(board, representativeMoves) {
    const key = boardKey(board);
    const knownId = index.get(key);
    if (knownId) return nodeById.get(knownId);
    const steadyState = sideToMove(board) === RED ? steadyStates.lookup(board) : null;
    const id = nodeIdForBoard(board);
    const node = {
      id,
      boardKey: key,
      ...serializeBoard(board),
      representativeMoves,
      ply: board.ply,
      sideToMove: sideToMove(board),
      kind: nodeKind(board, steadyState),
      ...(steadyState ? {
        steadyStateId: steadyState.id,
        steadyStateDiagram: steadyState.diagram,
        steadyStateMirrored: steadyState.mirrored,
      } : {}),
    };
    nodes.push(node);
    nodeById.set(id, node);
    boardsById.set(id, board);
    index.add(board, id);
    queue.push(id);
    return node;
  }

  function addEdge(source, target, player, column) {
    const id = `e-${source}-${column}-${target}`;
    if (!edges.some((edge) => edge.id === id)) edges.push({ id, source, target, player, column });
  }

  const root = ensureNode(emptyBoard(), "");
  if (root.id !== ROOT_ID) throw new GraphBuildError("root id is not stable");

  while (queue.length) {
    const id = queue.shift();
    if (expanded.has(id)) continue;
    expanded.add(id);
    const node = nodeById.get(id);
    const board = boardsById.get(id);

    if (node.kind === "STEADY_STATE") continue;

    if (node.sideToMove === RED) {
      const branch = branches.lookup(board);
      if (!branch) {
        if (immediateWinningMoves(board, RED).length > 0) continue;
        throw new GraphBuildError(`reachable Red position ${node.representativeMoves} is uncovered`, {
          nodeId: id,
          boardKey: node.boardKey,
        });
      }
      const childBoard = play(board, branch.move, RED);
      if (hasWon(childBoard, RED)) continue;
      const child = ensureNode(childBoard, `${node.representativeMoves}${branch.move}`);
      addEdge(node.id, child.id, RED, branch.move);
      continue;
    }

    for (const column of legalMoves(board)) {
      const childBoard = play(board, column, YELLOW);
      if (hasWon(childBoard, YELLOW)) {
        throw new GraphBuildError(
          `Yellow wins from ${node.representativeMoves} in column ${column}`,
          { nodeId: id, column },
        );
      }
      const coverage = classifyYellowReply(childBoard, branches, steadyStates);
      if (coverage.count !== 1) {
        throw new GraphBuildError(
          `Yellow reply ${node.representativeMoves}${column} has ${coverage.count} coverages`,
          { nodeId: id, column, coverage },
        );
      }
      if (coverage.immediateWin) continue;
      const child = ensureNode(childBoard, `${node.representativeMoves}${column}`);
      addEdge(node.id, child.id, YELLOW, column);
    }
  }

  const graph = {
    metadata: {
      format: "weakc4-dag",
      version: 1,
      rootId: ROOT_ID,
      compactBranches: branches.size,
      compactSteadyStates: steadyStates.size,
      generatedAt: options.generatedAt ?? null,
    },
    nodes,
    edges,
  };
  validateGraph(graph);
  return graph;
}

export function validateGraph(graph) {
  const issues = [];
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodes.has(ROOT_ID)) issues.push("root node is missing");
  if (nodes.size !== graph.nodes.length) issues.push("duplicate node ids");
  if (new Set(graph.nodes.map((node) => node.boardKey)).size !== graph.nodes.length) {
    issues.push("multiple nodes represent the same physical board");
  }
  const outgoing = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target) {
      issues.push(`edge ${edge.id} references a missing node`);
      continue;
    }
    if (target.ply !== source.ply + 1) issues.push(`edge ${edge.id} does not increase ply by one`);
    if (edge.player !== source.sideToMove) issues.push(`edge ${edge.id} player disagrees with its source`);
    outgoing.get(edge.source).push(edge);
  }
  for (const node of graph.nodes) {
    if (node.kind === "RED_DECISION" && outgoing.get(node.id).length !== 1) {
      issues.push(`Red decision ${node.id} does not have exactly one outgoing edge`);
    }
    if (node.kind === "STEADY_STATE" && outgoing.get(node.id).length !== 0) {
      issues.push(`steady state ${node.id} has outgoing edges`);
    }
  }

  // Increasing ply already proves acyclicity, but retain an explicit Kahn check.
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  graph.edges.forEach((edge) => indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1));
  const pending = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  let seen = 0;
  while (pending.length) {
    const id = pending.pop();
    seen += 1;
    for (const edge of outgoing.get(id) ?? []) {
      const degree = indegree.get(edge.target) - 1;
      indegree.set(edge.target, degree);
      if (degree === 0) pending.push(edge.target);
    }
  }
  if (seen !== graph.nodes.length) issues.push("graph contains a cycle");
  if (issues.length) throw new GraphBuildError("graph validation failed", { issues });
  return true;
}

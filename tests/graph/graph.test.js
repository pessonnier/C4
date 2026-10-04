import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { boardFromMoves, boardKey, play } from "../../src/game/board.js";
import { popcount } from "../../src/game/bitboard.js";
import { BranchBook } from "../../src/strategy/branches.js";
import { SteadyStateBook } from "../../src/strategy/steady-state.js";
import { classifyYellowReply } from "../../src/strategy/validator.js";
import { BoardNodeIndex } from "../../src/graph/canonicalization.js";
import { buildGraph, validateGraph } from "../../src/graph/builder.js";
import { graphStatistics } from "../../src/graph/statistics.js";

const noBranches = new BranchBook({});
const noSteadyStates = new SteadyStateBook([]);

test("transposition_deduplication", () => {
  const first = boardFromMoves("1234");
  const transposition = boardFromMoves("3412");
  const index = new BoardNodeIndex();
  index.add(first, "one-node");
  assert.equal(index.get(transposition), "one-node");
  assert.equal(boardKey(first), boardKey(transposition));
});

test("yellow_reply_covered_by_branch", () => {
  const board = boardFromMoves("12");
  const coverage = classifyYellowReply(board, new BranchBook({ "12": "3" }), noSteadyStates);
  assert.equal(coverage.count, 1);
  assert.ok(coverage.branch);
});

test("yellow_reply_covered_by_steady_state", () => {
  const diagram = ["       ", "       ", "       ", "       ", "       ", "12  !  "];
  const coverage = classifyYellowReply(boardFromMoves("12"), noBranches, new SteadyStateBook([diagram]));
  assert.equal(coverage.count, 1);
  assert.ok(coverage.steadyState);
});

test("yellow_reply_covered_by_immediate_win", () => {
  const coverage = classifyYellowReply(boardFromMoves("152637"), noBranches, noSteadyStates);
  assert.equal(coverage.count, 1);
  assert.equal(coverage.immediateWin, true);
});

test("yellow_reply_uncovered_is_error", () => {
  const coverage = classifyYellowReply(boardFromMoves("12"), noBranches, noSteadyStates);
  assert.equal(coverage.count, 0);
  assert.throws(() => buildGraph({ "": "4" }, []), /coverages/);
});

test("current WeakC4 dataset reconstructs the expected DAG", async () => {
  const root = new URL("../../data/", import.meta.url);
  const [branches, steadyStates] = await Promise.all([
    readFile(new URL("branches.json", root), "utf8").then(JSON.parse),
    readFile(new URL("steady_states.json", root), "utf8").then(JSON.parse),
  ]);
  const graph = buildGraph(branches, steadyStates);
  assert.equal(validateGraph(graph), true);
  const stats = graphStatistics(graph);
  assert.deepEqual({
    nodes: stats.numberOfNodes,
    edges: stats.numberOfEdges,
    leaves: stats.numberOfSteadyStates,
    red: stats.numberOfRedNodes,
    yellow: stats.numberOfYellowNodes,
    transpositions: stats.numberOfTranspositionNodes,
    maxIndegree: stats.maximumIndegree,
    maxPly: stats.maximumPly,
  }, {
    nodes: 3754,
    edges: 3989,
    leaves: 2520,
    red: 3168,
    yellow: 586,
    transpositions: 224,
    maxIndegree: 3,
    maxPly: 22,
  });
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const edge of graph.edges) {
    const parent = nodes.get(edge.source);
    const child = nodes.get(edge.target);
    assert.equal(child.ply, parent.ply + 1);
    const parentBoard = Object.freeze({
      redMask: BigInt(`0x${parent.redMask}`),
      yellowMask: BigInt(`0x${parent.yellowMask}`),
      ply: parent.ply,
    });
    const replayed = play(parentBoard, edge.column, edge.player);
    assert.equal(boardKey(replayed), child.boardKey);
    assert.equal(popcount(replayed.redMask | replayed.yellowMask), popcount(parentBoard.redMask | parentBoard.yellowMask) + 1);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RED, YELLOW, boardFromDiagram, play } from "../../src/game/board.js";
import { steadyStatePolicy } from "../../src/strategy/policy.js";
import {
  GraphOutcomeIndex,
  SteadyStateOutcomeAnalyzer,
  classifyColumn,
} from "../../src/strategy/outcome-analysis.js";

test("column verdicts are relative to the player at the move", () => {
  const result = { redWins: 4n, yellowWins: 0n, draws: 0n };
  assert.equal(classifyColumn(result, RED), "WIN");
  assert.equal(classifyColumn(result, YELLOW), "LOSS");
  assert.equal(classifyColumn({ redWins: 0n, yellowWins: 0n, draws: 2n }, YELLOW), "DRAW");
});

test("graph proof paths count every Yellow column", () => {
  const graph = {
    metadata: { rootId: "root" },
    nodes: [
      { id: "root", kind: "RED_DECISION", sideToMove: RED, ply: 0, redMask: "0", yellowMask: "0" },
      { id: "yellow", kind: "YELLOW_REPLY", sideToMove: YELLOW, ply: 1, redMask: "200000", yellowMask: "0" },
    ],
    edges: [{ id: "e", source: "root", target: "yellow", player: RED, column: 4 }],
  };
  const analysis = new GraphOutcomeIndex(graph).get("yellow");
  assert.equal(Object.keys(analysis.columns).length, 7);
  assert.deepEqual(analysis.totals, { redWins: 7n, yellowWins: 0n, draws: 0n });
});

test("steady-state paths count complete terminal game lines", async () => {
  const diagrams = JSON.parse(await readFile(new URL("../../data/steady_states.json", import.meta.url), "utf8"));
  const diagram = diagrams[0];
  const start = boardFromDiagram(diagram);
  const afterRed = play(start, steadyStatePolicy(start, diagram), RED);
  const analysis = new SteadyStateOutcomeAnalyzer().analyzeYellowTurn(afterRed, diagram, 0);
  assert.deepEqual(analysis.totals, { redWins: 7n, yellowWins: 0n, draws: 0n });
  assert.equal(Object.keys(analysis.columns).length, 7);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildGraph } from "../../src/graph/builder.js";
import { GameNavigation } from "../../src/viewer/navigation.js";

async function currentGraph() {
  const data = new URL("../../data/", import.meta.url);
  const [branches, steadyStates] = await Promise.all([
    readFile(new URL("branches.json", data), "utf8").then(JSON.parse),
    readFile(new URL("steady_states.json", data), "utf8").then(JSON.parse),
  ]);
  return buildGraph(branches, steadyStates);
}

test("two-player mode alternates without automatic Red replies", async () => {
  const graph = await currentGraph();
  let latest;
  const navigation = new GameNavigation(graph, { onChange: (state) => { latest = state; } });
  navigation.setMode("two-player");
  assert.equal(latest.board.ply, 0);
  assert.equal(latest.mode, "two-player");
  assert.ok(latest.analysis.columns[4]);

  navigation.playColumn(4);
  assert.equal(latest.board.ply, 1);
  assert.equal(latest.node.sideToMove, "YELLOW");

  navigation.playColumn(1);
  assert.equal(latest.board.ply, 2);
  assert.equal(latest.node.sideToMove, "RED");
  assert.ok(latest.analysis);
});

test("switching back to WeakC4 retains automatic strategy play", async () => {
  const graph = await currentGraph();
  let latest;
  const navigation = new GameNavigation(graph, { mode: "two-player", onChange: (state) => { latest = state; } });
  navigation.setMode("weakc4");
  assert.equal(latest.mode, "weakc4");
  assert.equal(latest.board.ply, 1);
  assert.equal(latest.node.sideToMove, "YELLOW");
});

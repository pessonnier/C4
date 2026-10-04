import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildGraph } from "../../src/graph/builder.js";
import { GameNavigation } from "../../src/viewer/navigation.js";

test("continue game from a selected graph node", async () => {
  const data = new URL("../../data/", import.meta.url);
  const [branches, steadyStates] = await Promise.all([
    readFile(new URL("branches.json", data), "utf8").then(JSON.parse),
    readFile(new URL("steady_states.json", data), "utf8").then(JSON.parse),
  ]);
  const graph = buildGraph(branches, steadyStates);
  let latest;
  const navigation = new GameNavigation(graph, { onChange: (state) => { latest = state; } });
  const redNode = graph.nodes.find((node) => node.kind === "RED_DECISION" && node.ply === 2);
  assert.equal(navigation.continueFromNode(redNode.id), true);
  assert.equal(latest.board.ply, 3);
  assert.equal(latest.node.sideToMove, "YELLOW");
  assert.ok(latest.analysis);
});

#!/usr/bin/env node
import { buildGraph } from "../src/graph/builder.js";
import { ForceDirectedLayout } from "../src/graph/layout.js";
import { readJson, writeJson } from "./io.js";

try {
  const [branches, steadyStates] = await Promise.all([
    readJson("data/branches.json"),
    readJson("data/steady_states.json"),
  ]);
  const graph = buildGraph(branches, steadyStates);
  const layout = new ForceDirectedLayout({ seed: Number(process.env.WEAKC4_LAYOUT_SEED ?? 4) });
  layout.initialize(graph);
  const report = layout.run();
  const target = await writeJson("dist/graph-layout.json", Object.fromEntries(layout.positions()));
  console.log(JSON.stringify({ status: "OK", target, ...report }, null, 2));
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}

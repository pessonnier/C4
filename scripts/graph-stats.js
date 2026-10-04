#!/usr/bin/env node
import { buildGraph } from "../src/graph/builder.js";
import { graphStatistics } from "../src/graph/statistics.js";
import { readJson } from "./io.js";

try {
  let graph;
  try {
    graph = await readJson("dist/graph.json");
  } catch {
    const [branches, steadyStates] = await Promise.all([
      readJson("data/branches.json"),
      readJson("data/steady_states.json"),
    ]);
    graph = buildGraph(branches, steadyStates);
  }
  console.log(JSON.stringify(graphStatistics(graph), null, 2));
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}

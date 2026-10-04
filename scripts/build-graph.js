#!/usr/bin/env node
import { buildGraph } from "../src/graph/builder.js";
import { weakC4OriginalLayout } from "../src/graph/layout.js";
import { serializeGraph } from "../src/graph/serialization.js";
import { graphStatistics } from "../src/graph/statistics.js";
import { readJson, readText, writeJson } from "./io.js";

try {
  const [branches, steadyStates, positions] = await Promise.all([
    readJson("data/branches.json"),
    readJson("data/steady_states.json"),
    readText("data/positions.txt"),
  ]);
  const graph = buildGraph(branches, steadyStates, { generatedAt: new Date().toISOString() });
  const layout = weakC4OriginalLayout(graph, positions);
  const document = serializeGraph(graph, layout, { layout: "weakc4-original" });
  const target = await writeJson("dist/graph.json", document);
  console.log(JSON.stringify({ status: "OK", target, ...graphStatistics(document) }, null, 2));
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}

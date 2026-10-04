#!/usr/bin/env node
import { buildGraph, validateGraph } from "../src/graph/builder.js";
import { validateCompactStrategy } from "../src/strategy/validator.js";
import { flag, readJson } from "./io.js";

try {
  const [branches, steadyStates] = await Promise.all([
    readJson("data/branches.json"),
    readJson("data/steady_states.json"),
  ]);
  const quick = flag("--quick");
  const result = validateCompactStrategy(branches, steadyStates, { exhaustive: !quick });
  if (result.issues.length) {
    console.error(result.issues.slice(0, 100).map((issue) => `- ${issue}`).join("\n"));
    if (result.issues.length > 100) console.error(`... and ${result.issues.length - 100} more`);
    process.exitCode = 1;
  } else {
    const graph = buildGraph(branches, steadyStates);
    validateGraph(graph);
    console.log(JSON.stringify({
      status: "OK",
      mode: quick ? "structural" : "exhaustive",
      ...result.counts,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      steadyStatesVerified: result.steadyStateResults.length,
      positionsVisited: result.steadyStateResults.reduce((sum, entry) => sum + entry.visited, 0),
    }, null, 2));
  }
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}

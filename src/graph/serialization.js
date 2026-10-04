import { validateGraph } from "./builder.js";

export function serializeGraph(graph, layout = new Map(), metadata = {}) {
  validateGraph(graph);
  const layoutObject = Object.fromEntries(
    layout instanceof Map ? layout : Object.entries(layout ?? {}),
  );
  return {
    metadata: { ...graph.metadata, ...metadata },
    nodes: graph.nodes,
    edges: graph.edges,
    layout: layoutObject,
  };
}

export function parseGraph(value) {
  const graph = typeof value === "string" ? JSON.parse(value) : value;
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new TypeError("invalid developed graph document");
  }
  validateGraph(graph);
  return graph;
}

export function graphStatistics(graph) {
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  const outdegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outdegree.set(edge.source, (outdegree.get(edge.source) ?? 0) + 1);
  }
  const histogram = (values) => Object.fromEntries(
    [...values].reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map()),
  );
  const compactEntries = (graph.metadata.compactBranches ?? 0) + (graph.metadata.compactSteadyStates ?? 0);
  return {
    numberOfNodes: graph.nodes.length,
    numberOfEdges: graph.edges.length,
    numberOfSteadyStates: graph.nodes.filter((node) => node.kind === "STEADY_STATE").length,
    numberOfRedNodes: graph.nodes.filter((node) => node.sideToMove === "RED").length,
    numberOfYellowNodes: graph.nodes.filter((node) => node.sideToMove === "YELLOW").length,
    numberOfTranspositionNodes: [...indegree.values()].filter((degree) => degree > 1).length,
    maximumIndegree: Math.max(0, ...indegree.values()),
    maximumOutdegree: Math.max(0, ...outdegree.values()),
    maximumPly: Math.max(0, ...graph.nodes.map((node) => node.ply)),
    nodesByPly: histogram(graph.nodes.map((node) => node.ply)),
    nodesByOutdegree: histogram(outdegree.values()),
    compressionRatio: compactEntries ? graph.nodes.length / compactEntries : null,
  };
}

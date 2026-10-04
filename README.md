# WeakC4 DAG Explorer

This project loads the compact WeakC4 strategy, validates its invariants,
reconstructs its transposition-aware directed acyclic graph, and displays that
graph alongside a playable Connect Four board.

## Quick start

Node.js 22 or later is sufficient; the project has no npm dependencies.

```bash
npm test
npm run validate-solution -- --quick
npm run build-graph
npm run serve
```

Open <http://localhost:8000>. Use `npm run validate-solution` without
`--quick` to exhaustively prove every steady-state diagram.

## Commands

- `npm run build-graph` regenerates `dist/graph.json` from compact data.
- `npm run validate-solution` validates structure, exact Yellow coverage,
  reachability, the reconstructed DAG, and every steady state.
- `npm run graph-stats` prints graph statistics.
- `npm run build-layout` computes a deterministic force-directed layout in
  `dist/graph-layout.json` (`WEAKC4_LAYOUT_SEED` controls its seed).

The browser never defines the strategy. It only consumes the graph artifact
produced by the validation and reconstruction layers.



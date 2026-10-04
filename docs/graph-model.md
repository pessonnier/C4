# Graph model

WeakC4 is represented as a DAG, not a move-sequence tree. A node is identified
by the pair `(redMask, yellowMask)` encoded by `boardKey`; its representative
move sequence is display metadata only. The 49-bit bitboards use seven bits per
column: six playable cells followed by a sentinel slot.

The reconstruction starts at the stable `root` id. Red decision nodes have one
strategy edge. Yellow reply nodes enumerate every legal Yellow move; a reply
must be covered by exactly one branch, steady state, or immediate Red win.
Immediate wins stop the certified graph before the final Red disc. Reusing an
existing `boardKey` merges a transposition without changing its first
representative sequence.

Node types are `RED_DECISION`, `YELLOW_REPLY`, and `STEADY_STATE`. Every edge
stores its player and column explicitly. Every edge raises `ply` by one, which
both preserves game depth and proves acyclicity. Coordinates live in the
separate `layout` object and never participate in identity.

Horizontal symmetry is used only for compact strategy lookup. The developed
graph keeps both physical orientations when both are reachable from the root.

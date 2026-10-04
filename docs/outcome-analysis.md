# Outcome analysis

The viewer reports Red wins, Yellow wins, draws, and a verdict for every legal
column from the perspective of the player at the move.

Before a Steady State is activated, the values count distinct paths in the
developed proof DAG. An omitted immediate Red win and a Steady-State
certificate each count as one successful terminal proof path. Transpositions
remain shared nodes, but every distinct incoming move path is counted.

After activation, the fixed diagram is expanded on demand with memoization.
These values count complete terminal game lines: Red's move is deterministic,
every legal Yellow continuation is explored, and a terminal line is classified
as a Red win, Yellow win, or draw.

For a Red node, columns outside WeakC4's unique selected move are marked
`hors stratégie`; the weak solution intentionally makes no game-theoretic claim
about them. The blank-space claimeven symbol is rendered as `·` in the legend
so that it remains visible without changing the compact source language.

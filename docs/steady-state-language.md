# Steady-State language

A diagram is six strings of seven characters, top row first. `1` and `2` are
stones. The other symbols are immutable instructions evaluated only when their
cell is currently playable. A blank space is meaningful: on an even board row
it is the `claimeven` instruction.

Red selects the first applicable priority:

1. the first immediate Red win from columns 1 through 7;
2. the first immediate Yellow threat to block;
3. exactly one `!` (urgent);
4. exactly one `@` (miai); multiple miai cells are ignored;
5. exactly one candidate in the union of odd-row `|` and even-row spaces;
6. exactly one `+`;
7. exactly one `=`;
8. exactly one `-`.

Multiple candidates at any non-miai instruction level are invalid. No candidate
at any level is also invalid. Exhaustive verification explores every legal
Yellow continuation with board-key memoization. Only an eventual Red win is
success; a draw or Yellow win rejects the diagram.

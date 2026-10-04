# WeakC4 import

The importer accepts the upstream compact files directly:

- `branches.json` maps an even-length representative move sequence to Red's
  unique move (`"1"` through `"7"`).
- `steady_states.json` is an array of six-by-seven diagrams. The stones in each
  diagram identify the board; no move sequence is required.
- `positions.txt` contains `sequence,x,y,z`. It is used only by the
  `weakc4-original` layout. If only a mirrored board has coordinates, the
  importer uses `(-x, y, z)`.

Both branch and steady-state books index physical board keys and transparently
mirror their stored move or diagram on lookup. Duplicate entries modulo mirror
are rejected. The generated `dist/graph.json` can always be deleted and rebuilt
from these compact files.

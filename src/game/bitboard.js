/** Classic 7 x (6 + sentinel) Connect Four bitboard primitives. */

export const COLUMNS = 7;
export const ROWS = 6;
export const STRIDE = ROWS + 1;
export const BOARD_BITS = COLUMNS * STRIDE;
export const PLAYABLE_MASK = Array.from({ length: COLUMNS }, (_, column) =>
  ((1n << BigInt(ROWS)) - 1n) << BigInt(column * STRIDE),
).reduce((all, mask) => all | mask, 0n);

export function bitAt(column, row) {
  if (!Number.isInteger(column) || column < 1 || column > COLUMNS) {
    throw new RangeError(`column must be between 1 and ${COLUMNS}`);
  }
  if (!Number.isInteger(row) || row < 1 || row > ROWS) {
    throw new RangeError(`row must be between 1 and ${ROWS}`);
  }
  return 1n << BigInt((column - 1) * STRIDE + row - 1);
}

export function columnMask(column) {
  return PLAYABLE_MASK & (((1n << BigInt(ROWS)) - 1n) << BigInt((column - 1) * STRIDE));
}

export function hasFour(mask) {
  for (const shift of [1n, 6n, 7n, 8n]) {
    const pairs = mask & (mask >> shift);
    if ((pairs & (pairs >> (2n * shift))) !== 0n) return true;
  }
  return false;
}

export function mirrorBitboard(mask) {
  let mirrored = 0n;
  const segmentMask = (1n << BigInt(STRIDE)) - 1n;
  for (let column = 0; column < COLUMNS; column += 1) {
    const segment = (mask >> BigInt(column * STRIDE)) & segmentMask;
    mirrored |= segment << BigInt((COLUMNS - 1 - column) * STRIDE);
  }
  return mirrored;
}

export function popcount(mask) {
  let count = 0;
  for (let value = mask; value; value &= value - 1n) count += 1;
  return count;
}

export function encodeMask(mask) {
  return mask.toString(16).padStart(13, "0");
}

export function decodeMask(value) {
  if (typeof value === "bigint") return value;
  if (typeof value !== "string" || !/^[0-9a-f]+$/i.test(value)) {
    throw new TypeError(`invalid bitboard encoding: ${String(value)}`);
  }
  return BigInt(`0x${value}`);
}

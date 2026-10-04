import { COLUMNS, ROWS, bitAt, encodeMask, popcount } from "./bitboard.js";

export const RED = "RED";
export const YELLOW = "YELLOW";

export function emptyBoard() {
  return Object.freeze({ redMask: 0n, yellowMask: 0n, ply: 0 });
}

export function createBoard(redMask, yellowMask, ply = popcount(redMask | yellowMask)) {
  if ((redMask & yellowMask) !== 0n) throw new Error("red and yellow masks overlap");
  if (ply !== popcount(redMask | yellowMask)) throw new Error("ply does not match occupancy");
  return Object.freeze({ redMask, yellowMask, ply });
}

export function sideToMove(board) {
  return board.ply % 2 === 0 ? RED : YELLOW;
}

export function occupancy(board) {
  return board.redMask | board.yellowMask;
}

export function columnHeight(board, column) {
  if (!Number.isInteger(column) || column < 1 || column > COLUMNS) {
    throw new RangeError("column must be between 1 and 7");
  }
  const occupied = occupancy(board);
  for (let row = 1; row <= ROWS; row += 1) {
    if ((occupied & bitAt(column, row)) === 0n) return row - 1;
  }
  return ROWS;
}

export function canPlay(board, column) {
  return columnHeight(board, column) < ROWS;
}

export function legalMoves(board) {
  const moves = [];
  for (let column = 1; column <= COLUMNS; column += 1) {
    if (canPlay(board, column)) moves.push(column);
  }
  return moves;
}

export function play(board, column, player = sideToMove(board)) {
  const height = columnHeight(board, column);
  if (height >= ROWS) throw new Error(`column ${column} is full`);
  if (player !== RED && player !== YELLOW) throw new Error(`unknown player ${player}`);
  if (player !== sideToMove(board)) {
    throw new Error(`${player} cannot play at ply ${board.ply}`);
  }
  const moveBit = bitAt(column, height + 1);
  return createBoard(
    player === RED ? board.redMask | moveBit : board.redMask,
    player === YELLOW ? board.yellowMask | moveBit : board.yellowMask,
    board.ply + 1,
  );
}

export function boardFromMoves(moves) {
  let board = emptyBoard();
  for (const token of String(moves)) {
    if (!/[1-7]/.test(token)) throw new Error(`illegal move ${JSON.stringify(token)} in ${moves}`);
    board = play(board, Number(token));
  }
  return board;
}

export function cellAt(board, column, row) {
  const bit = bitAt(column, row);
  if (board.redMask & bit) return RED;
  if (board.yellowMask & bit) return YELLOW;
  return null;
}

export function boardKey(board) {
  return `${encodeMask(board.redMask)}:${encodeMask(board.yellowMask)}`;
}

export function boardEquals(left, right) {
  return left.redMask === right.redMask && left.yellowMask === right.yellowMask;
}

export function boardFromDiagram(diagram) {
  let redMask = 0n;
  let yellowMask = 0n;
  for (let topRow = 0; topRow < ROWS; topRow += 1) {
    const row = ROWS - topRow;
    for (let column = 1; column <= COLUMNS; column += 1) {
      const value = diagram[topRow][column - 1];
      if (value === "1") redMask |= bitAt(column, row);
      if (value === "2") yellowMask |= bitAt(column, row);
    }
  }
  const board = createBoard(redMask, yellowMask);
  // Diagram stones must obey gravity even though annotations may float.
  for (let column = 1; column <= COLUMNS; column += 1) {
    let foundEmpty = false;
    for (let row = 1; row <= ROWS; row += 1) {
      const occupied = cellAt(board, column, row) !== null;
      if (!occupied) foundEmpty = true;
      if (occupied && foundEmpty) throw new Error(`diagram has a floating stone at column ${column}, row ${row}`);
    }
  }
  return board;
}

export function serializeBoard(board) {
  return { redMask: encodeMask(board.redMask), yellowMask: encodeMask(board.yellowMask), ply: board.ply };
}

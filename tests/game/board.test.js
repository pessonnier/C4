import test from "node:test";
import assert from "node:assert/strict";
import {
  RED,
  YELLOW,
  boardEquals,
  boardFromMoves,
  boardKey,
  canPlay,
  cellAt,
  emptyBoard,
  play,
} from "../../src/game/board.js";
import { hasWon } from "../../src/game/rules.js";
import { mirrorBoard, mirrorColumn } from "../../src/game/symmetry.js";

test("board_empty", () => {
  const board = emptyBoard();
  assert.equal(board.ply, 0);
  assert.equal(board.redMask, 0n);
  assert.equal(board.yellowMask, 0n);
});

test("board_play_move", () => {
  const board = play(emptyBoard(), 4);
  assert.equal(board.ply, 1);
  assert.equal(cellAt(board, 4, 1), RED);
  assert.equal(cellAt(board, 4, 2), null);
});

test("board_full_column", () => {
  const board = boardFromMoves("111111");
  assert.equal(canPlay(board, 1), false);
  assert.throws(() => play(board, 1), /full/);
});

test("horizontal_win", () => assert.equal(hasWon(boardFromMoves("1526374"), RED), true));
test("vertical_win", () => assert.equal(hasWon(boardFromMoves("1212121"), RED), true));
test("diagonal_win_1", () => assert.equal(hasWon(boardFromMoves("1223533454644"), RED), true));
test("diagonal_win_2", () => assert.equal(hasWon(mirrorBoard(boardFromMoves("1223533454644")), RED), true));

test("mirror_column", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(mirrorColumn), [7, 6, 5, 4, 3, 2, 1]);
});

test("mirror_board", () => {
  const board = mirrorBoard(boardFromMoves("1234"));
  assert.equal(cellAt(board, 7, 1), RED);
  assert.equal(cellAt(board, 6, 1), YELLOW);
});

test("mirror_twice_identity", () => {
  const board = boardFromMoves("4156545562");
  assert.equal(boardEquals(mirrorBoard(mirrorBoard(board)), board), true);
});

test("same_board_different_move_order", () => {
  assert.equal(boardKey(boardFromMoves("1234")), boardKey(boardFromMoves("3412")));
});

test("mirror identity property over deterministic legal positions", () => {
  let seed = 0x4c4;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
  for (let sample = 0; sample < 400; sample += 1) {
    let board = emptyBoard();
    const plies = Math.floor(random() * 32);
    for (let ply = 0; ply < plies; ply += 1) {
      const legal = [1, 2, 3, 4, 5, 6, 7].filter((column) => canPlay(board, column));
      if (!legal.length || hasWon(board, RED) || hasWon(board, YELLOW)) break;
      board = play(board, legal[Math.floor(random() * legal.length)]);
    }
    assert.equal(boardKey(mirrorBoard(mirrorBoard(board))), boardKey(board));
  }
});

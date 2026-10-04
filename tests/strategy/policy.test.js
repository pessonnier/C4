import test from "node:test";
import assert from "node:assert/strict";
import { boardFromMoves, emptyBoard } from "../../src/game/board.js";
import { BranchBook } from "../../src/strategy/branches.js";
import { SteadyStateBook, mirrorDiagram } from "../../src/strategy/steady-state.js";
import { SteadyStatePolicyError, steadyStatePolicy } from "../../src/strategy/policy.js";

const rows = (...bottomUp) => {
  const filled = [...bottomUp, ...Array(6 - bottomUp.length).fill("       ")];
  return filled.reverse();
};

test("steady_state_urgent", () => {
  assert.equal(steadyStatePolicy(emptyBoard(), rows("  !    ")), 3);
});

test("steady_state_urgent_collision", () => {
  assert.throws(() => steadyStatePolicy(emptyBoard(), rows(" !!    ")), SteadyStatePolicyError);
});

test("steady_state_single_miai", () => {
  assert.equal(steadyStatePolicy(emptyBoard(), rows("   @   ")), 4);
});

test("steady_state_double_miai_is_ignored", () => {
  assert.equal(steadyStatePolicy(emptyBoard(), rows("@@+    ")), 3);
});

test("steady_state_claimodd", () => {
  assert.equal(steadyStatePolicy(emptyBoard(), rows("    |  ")), 5);
});

test("steady_state_claimeven", () => {
  const diagram = rows("12     ", " -     ");
  assert.equal(steadyStatePolicy(boardFromMoves("12"), diagram), 1);
});

test("steady_state_claim_collision", () => {
  const diagram = rows("12     ", "       ");
  assert.throws(() => steadyStatePolicy(boardFromMoves("12"), diagram), /ambiguous/);
});

test("branch_mirror_lookup", () => {
  const book = new BranchBook({ "41": "5" });
  assert.deepEqual(book.lookup(boardFromMoves("47")), { move: 3, sourceMoves: "41", mirrored: true });
});

test("steady_state_mirror_lookup", () => {
  const diagram = rows("12  !  ");
  const book = new SteadyStateBook([diagram]);
  const found = book.lookup(boardFromMoves("76"));
  assert.equal(found.mirrored, true);
  assert.deepEqual(found.diagram, mirrorDiagram(diagram));
});

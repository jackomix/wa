/* Headless proof that the v2 picking model does what the brief asked for.
 *
 * The claim under test: "On collision between Player and Ball -> Destroy Ball"
 * must destroy THE BALL THAT WAS HIT, not every ball.
 *
 * Run: node tools/test-picking.mjs
 */

import { PickState, collectPairs } from "../src/engine/picking.ts";
import { evalExpr } from "../src/engine/expr.ts";

let pass = 0, fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m  ${name}`); }
};

const mk = (defId, instId, x, y, w = 10, h = 10) => ({
  defId, instId, alive: true, x, y, w, h, seq: 0, vars: {},
});
const overlap = (a, b) =>
  Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

console.log("\n\x1b[1mv2 instance picking\x1b[0m");

/* ---- 1. the headline bug ---- */
{
  const player = mk("player", "p1", 50, 50);
  const balls = [
    mk("ball", "b1", 52, 50),   // touching
    mk("ball", "b2", 10, 10),   // far away
    mk("ball", "b3", 90, 90),   // far away
  ];
  const all = [player, ...balls];
  const pick = new PickState(() => all);

  const pairs = collectPairs(pick.get("player"), pick.get("ball"), overlap);
  pick.set("player", [...new Set(pairs.map((p) => p.a))]);
  pick.set("ball", [...new Set(pairs.map((p) => p.b))]);

  const picked = pick.get("ball");
  ok("collision picks exactly 1 ball", picked.length === 1);
  ok("...and it is the one that was touching (b1)", picked[0]?.instId === "b1");

  for (const b of picked) b.alive = false;
  ok("b2 survives", balls[1].alive === true);
  ok("b3 survives", balls[2].alive === true);
  ok("b1 destroyed", balls[0].alive === false);
}

/* ---- 2. multiple simultaneous collisions ---- */
{
  const players = [mk("player", "p1", 20, 20), mk("player", "p2", 80, 80)];
  const balls = [
    mk("ball", "b1", 22, 20),  // hits p1
    mk("ball", "b2", 50, 50),  // hits nobody
    mk("ball", "b3", 82, 80),  // hits p2
  ];
  const all = [...players, ...balls];
  const pick = new PickState(() => all);
  const pairs = collectPairs(pick.get("player"), pick.get("ball"), overlap);

  ok("2 pairs found", pairs.length === 2);
  const ids = pairs.map((p) => `${p.a.instId}->${p.b.instId}`).sort();
  ok("pairs are p1->b1 and p2->b3", ids.join(",") === "p1->b1,p2->b3");
  ok("the untouched ball is not picked", !pairs.some((p) => p.b.instId === "b2"));
}

/* ---- 3. un-narrowed types default to all ---- */
{
  const all = [mk("ball", "b1", 0, 0), mk("ball", "b2", 50, 50)];
  const pick = new PickState(() => all);
  ok("un-narrowed type returns all instances", pick.get("ball").length === 2);
  pick.filter("ball", (b) => b.x > 10);
  ok("after narrowing, returns the subset", pick.get("ball").length === 1);
  pick.clearPick("ball");
  ok("clearPick restores all", pick.get("ball").length === 2);
}

/* ---- 4. sub-event scoping ---- */
{
  const all = [mk("ball", "b1", 0, 0), mk("ball", "b2", 50, 50), mk("ball", "b3", 90, 90)];
  const parent = new PickState(() => all);
  parent.filter("ball", (b) => b.x >= 50);           // {b2,b3}
  const child = parent.clone();
  child.filter("ball", (b) => b.x >= 90);            // {b3}
  ok("child narrows independently", child.get("ball").length === 1);
  ok("parent is unaffected by child", parent.get("ball").length === 2);
}

/* ---- 5. dead instances drop out ---- */
{
  const all = [mk("ball", "b1", 0, 0), mk("ball", "b2", 50, 50)];
  const pick = new PickState(() => all);
  pick.set("ball", all.slice());
  all[0].alive = false;
  ok("destroyed instances leave the picked set", pick.get("ball").length === 1);
}

console.log("\n\x1b[1mexpression engine\x1b[0m");

const host = {
  self: (n) => ({ x: 10, y: 20, width: 8, hp: 3 })[n] ?? 0,
  scene: (n) => ({ score: 7 })[n] ?? 0,
  actorProp: (a, p) => (a === "Ball" ? { x: 42, width: 16 }[p] ?? 0 : 0),
  count: (a) => (a === "Ball" ? 3 : 0),
  t: 2.5,
  rng: () => 0.5,
};

ok("plain number", evalExpr("42", host) === 42);
ok("negative", evalExpr("-7", host) === -7);
ok("v1 {self:x} still works", evalExpr("{self:x}", host) === 10);
ok("v1 {scene:score} still works", evalExpr("{scene:score}", host) === 7);
ok("v1 {scene:t} still works", evalExpr("{scene:t}", host) === 2.5);
ok("cross-actor Ball.x (NEW)", evalExpr("Ball.x", host) === 42);
ok("brace form {Ball:width} (NEW)", evalExpr("{Ball:width}", host) === 16);
ok("arithmetic + precedence", evalExpr("2+3*4", host) === 14);
ok("parens", evalExpr("(2+3)*4", host) === 20);
ok("mixed refs", evalExpr("{self:x} + Ball.x", host) === 52);
ok("Set Player size to Ball size", evalExpr("Ball.width", host) === 16);
ok("count(Ball)", evalExpr("count(Ball)", host) === 3);
ok("clamp", evalExpr("clamp(99, 0, 50)", host) === 50);
ok("sin(90)", Math.abs(evalExpr("sin(90)", host) - 1) < 1e-9);
ok("comparison yields 1/0", evalExpr("Ball.x > {self:x}", host) === 1);
ok("malformed degrades to 0, no throw", evalExpr("((((", host) === 0);
ok("empty degrades to 0", evalExpr("", host) === 0);
ok("unknown ident degrades to 0", evalExpr("nonsense", host) === 0);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

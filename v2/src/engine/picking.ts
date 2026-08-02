/* ==================================================================
 *  Instance picking — Construct's "SOL" (selected object list) model
 *
 *  This is the feature the brief named explicitly, and the thing that
 *  separates an event sheet from a list of if-statements.
 *
 *  v1's interpreter looped every instance and an action's `targetDef`
 *  applied to EVERY live instance of that type. So:
 *
 *      [Player overlaps Ball] -> Destroy Ball
 *
 *  destroyed *all* the balls, not the one that was hit. The author's only
 *  workaround was to allow exactly one ball to exist.
 *
 *  The model here: a condition does not merely return true/false — it
 *  NARROWS the set of instances the rest of the event talks about. A
 *  condition is "true" precisely when it leaves at least one instance
 *  picked. Truthiness and selection are the same operation, which is the
 *  elegant bit, and it means the obvious authoring reads correctly with no
 *  disambiguation UI:
 *
 *      [Player overlaps Ball] -> Destroy Ball      // the ball that was hit
 *      [Player overlaps Ball] -> Set Player.w to Ball.w
 *
 *  Sub-events inherit a CLONE of the parent's picked set, so siblings can't
 *  contaminate each other.
 * ================================================================== */

export interface Pickable {
  instId: string;
  alive: boolean;
  defId: string;
}

export class PickState<T extends Pickable> {
  /** defId -> picked instances. A missing key means "not narrowed" = all of them. */
  private sol = new Map<string, T[]>();

  constructor(private source: () => T[]) {}

  /** Every live instance of a type, ignoring current narrowing. */
  allOf(defId: string): T[] {
    return this.source().filter((a) => a.alive && a.defId === defId);
  }

  /** Currently picked instances of a type. Defaults to all when un-narrowed. */
  get(defId: string): T[] {
    const picked = this.sol.get(defId);
    if (picked) return picked.filter((a) => a.alive);
    return this.allOf(defId);
  }

  /** Has this type been explicitly narrowed? */
  isNarrowed(defId: string): boolean {
    return this.sol.has(defId);
  }

  set(defId: string, list: T[]): void {
    this.sol.set(defId, list);
  }

  /**
   * Narrow by predicate. Returns whether anything survived.
   * This is the primitive every instance-scoped condition is built from.
   */
  filter(defId: string, pred: (a: T) => boolean): boolean {
    const next = this.get(defId).filter(pred);
    this.sol.set(defId, next);
    return next.length > 0;
  }

  /** Union into the picked set — for OR-style conditions. */
  addPick(defId: string, list: T[]): void {
    const cur = this.sol.get(defId) ?? [];
    const seen = new Set(cur.map((a) => a.instId));
    this.sol.set(defId, cur.concat(list.filter((a) => !seen.has(a.instId))));
  }

  clearPick(defId: string): void {
    this.sol.delete(defId);
  }

  /** Scope a sub-event: arrays copied, instances shared. */
  clone(): PickState<T> {
    const c = new PickState<T>(this.source);
    for (const [k, v] of this.sol) c.sol.set(k, v.slice());
    return c;
  }

  narrowedTypes(): string[] {
    return Array.from(this.sol.keys());
  }
}

/**
 * Paired narrowing for two-type conditions (collision being the important one).
 *
 * The subtlety: if Player A hits Ball 3 and Player B hits Ball 7, the picked
 * sets are {A,B} and {3,7} — but an action mentioning both must see the PAIRS,
 * not the 2x2 cross product. We return the pairs so the interpreter can run the
 * action list once per pair when both types are referenced, and fall back to the
 * cheap union when only one type is.
 */
export interface Pair<T> {
  a: T;
  b: T;
}

export function collectPairs<T extends Pickable>(
  listA: T[],
  listB: T[],
  test: (a: T, b: T) => boolean,
): Pair<T>[] {
  const out: Pair<T>[] = [];
  for (const a of listA) {
    if (!a.alive) continue;
    for (const b of listB) {
      if (!b.alive || a.instId === b.instId) continue;
      if (test(a, b)) out.push({ a, b });
    }
  }
  return out;
}

/** Distinct instances on each side of a pair list. */
export function pairSides<T extends Pickable>(pairs: Pair<T>[]): { as: T[]; bs: T[] } {
  const as = new Map<string, T>();
  const bs = new Map<string, T>();
  for (const p of pairs) {
    as.set(p.a.instId, p.a);
    bs.set(p.b.instId, p.b);
  }
  return { as: Array.from(as.values()), bs: Array.from(bs.values()) };
}

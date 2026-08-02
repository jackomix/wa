/* ==================================================================
 *  Expression evaluator
 *
 *  v1 resolved expressions with a regex over `{self:x}` / `{scene:foo}` /
 *  `{rnd:a,b}` tokens. That works, and every existing microgame uses it, so
 *  IT KEEPS WORKING — this is a strict superset.
 *
 *  What's added is the thing the brief asked for: expressions that reach
 *  ACROSS actors, resolved against the picked set. That's what makes
 *
 *      "Set Player size to Ball size"
 *
 *  expressible without a bespoke action, and makes it mean *the ball that
 *  was just hit* rather than "some ball".
 *
 *  Syntax (all optional sugar over the same evaluator):
 *      42                  literal
 *      {self:x}            own property / own var       (v1, still valid)
 *      {scene:score}       scene var                    (v1, still valid)
 *      {scene:t}           beats elapsed                (v1, still valid)
 *      {rnd:a,b}           uniform random               (v1, still valid)
 *      Ball.x              picked Ball's x              (NEW)
 *      {Ball:width}        same thing, brace form       (NEW)
 *      count(Ball)         how many Balls are picked    (NEW)
 *      sin(t*90) + 3*2     arithmetic and functions     (NEW)
 * ================================================================== */

export interface ExprHost {
  /** own property or var, or null at scene scope */
  self: ((name: string) => number) | null;
  /** scene variable lookup */
  scene: (name: string) => number;
  /** property of the FIRST picked instance of a named actor */
  actorProp: (actorName: string, prop: string) => number;
  /** how many instances of a named actor are picked */
  count: (actorName: string) => number;
  /** beats elapsed in this microgame */
  t: number;
  rng: () => number;
}

/* ---- tokenizer --------------------------------------------------- */
type Tok =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "op"; v: string }
  | { k: "("; }
  | { k: ")"; }
  | { k: ","; };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }

    // brace token: {scope:name} — kept verbatim as an identifier
    if (c === "{") {
      const end = src.indexOf("}", i);
      if (end < 0) { i++; continue; }
      out.push({ k: "id", v: src.slice(i, end + 1) });
      i = end + 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ k: "num", v: parseFloat(src.slice(i, j)) || 0 });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      out.push({ k: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "(") { out.push({ k: "(" }); i++; continue; }
    if (c === ")") { out.push({ k: ")" }); i++; continue; }
    if (c === ",") { out.push({ k: "," }); i++; continue; }
    // multi-char comparison operators
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!="].includes(two)) { out.push({ k: "op", v: two }); i += 2; continue; }
    if ("+-*/%<>".includes(c)) { out.push({ k: "op", v: c }); i++; continue; }
    i++; // skip anything unrecognised rather than throwing
  }
  return out;
}

/* ---- parser (precedence climbing) -------------------------------- */
const PREC: Record<string, number> = {
  "<": 1, ">": 1, "<=": 1, ">=": 1, "==": 1, "!=": 1,
  "+": 2, "-": 2,
  "*": 3, "/": 3, "%": 3,
};

class P {
  i = 0;
  constructor(private t: Tok[], private h: ExprHost) {}
  peek(): Tok | undefined { return this.t[this.i]; }
  next(): Tok | undefined { return this.t[this.i++]; }

  parse(minPrec = 0): number {
    let lhs = this.atom();
    for (;;) {
      const tk = this.peek();
      if (!tk || tk.k !== "op") break;
      const prec = PREC[tk.v] ?? 0;
      if (prec < minPrec || prec === 0) break;
      this.next();
      const rhs = this.parse(prec + 1);
      lhs = apply(tk.v, lhs, rhs);
    }
    return lhs;
  }

  atom(): number {
    const tk = this.next();
    if (!tk) return 0;
    if (tk.k === "num") return tk.v;
    if (tk.k === "op" && tk.v === "-") return -this.atom();
    if (tk.k === "op" && tk.v === "+") return this.atom();
    if (tk.k === "(") {
      const v = this.parse(0);
      if (this.peek()?.k === ")") this.next();
      return v;
    }
    if (tk.k === "id") {
      // function call?
      if (this.peek()?.k === "(") {
        this.next();
        const args: number[] = [];
        if (this.peek()?.k !== ")") {
          for (;;) {
            args.push(this.parse(0));
            if (this.peek()?.k === ",") { this.next(); continue; }
            break;
          }
        }
        if (this.peek()?.k === ")") this.next();
        return callFn(tk.v, args, this.h, this.rawArgName());
      }
      return resolveIdent(tk.v, this.h);
    }
    return 0;
  }

  /** last identifier consumed inside a call — lets count(Ball) see "Ball" */
  private rawArgName(): string {
    for (let j = this.i - 1; j >= 0; j--) {
      const t = this.t[j];
      if (t.k === "id") return t.v;
    }
    return "";
  }
}

function apply(op: string, a: number, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b === 0 ? 0 : a / b;
    case "%": return b === 0 ? 0 : a % b;
    case "<": return a < b ? 1 : 0;
    case ">": return a > b ? 1 : 0;
    case "<=": return a <= b ? 1 : 0;
    case ">=": return a >= b ? 1 : 0;
    case "==": return a === b ? 1 : 0;
    case "!=": return a !== b ? 1 : 0;
    default: return 0;
  }
}

function callFn(name: string, a: number[], h: ExprHost, lastId: string): number {
  switch (name) {
    case "sin": return Math.sin((a[0] ?? 0) * Math.PI / 180);
    case "cos": return Math.cos((a[0] ?? 0) * Math.PI / 180);
    case "abs": return Math.abs(a[0] ?? 0);
    case "min": return Math.min(...(a.length ? a : [0]));
    case "max": return Math.max(...(a.length ? a : [0]));
    case "floor": return Math.floor(a[0] ?? 0);
    case "ceil": return Math.ceil(a[0] ?? 0);
    case "round": return Math.round(a[0] ?? 0);
    case "sign": return Math.sign(a[0] ?? 0);
    case "sqrt": return Math.sqrt(Math.max(0, a[0] ?? 0));
    case "clamp": return Math.max(a[1] ?? 0, Math.min(a[2] ?? 1, a[0] ?? 0));
    case "lerp": return (a[0] ?? 0) + ((a[1] ?? 0) - (a[0] ?? 0)) * (a[2] ?? 0);
    case "dist": return Math.hypot((a[2] ?? 0) - (a[0] ?? 0), (a[3] ?? 0) - (a[1] ?? 0));
    case "random": return h.rng() * (a.length ? a[0] : 1);
    case "randomInt": {
      const lo = a[0] ?? 0, hi = a[1] ?? 1;
      return Math.floor(lo + h.rng() * (hi - lo + 1));
    }
    case "choose": return a.length ? a[Math.floor(h.rng() * a.length)] : 0;
    case "count": return h.count(lastId);
    default: return 0;
  }
}

function resolveIdent(id: string, h: ExprHost): number {
  // {scope:name} brace form
  if (id.startsWith("{") && id.endsWith("}")) {
    const inner = id.slice(1, -1);
    const ci = inner.indexOf(":");
    const scope = ci >= 0 ? inner.slice(0, ci) : "scene";
    const name = ci >= 0 ? inner.slice(ci + 1) : inner;

    if (scope === "scene") return name === "t" ? h.t : h.scene(name);
    if (scope === "self") return h.self ? h.self(name) : 0;
    if (scope === "rnd") {
      const [a, b] = name.split(",").map((s) => parseFloat(s) || 0);
      return a + h.rng() * (b - a);
    }
    // {ActorName:prop}
    return h.actorProp(scope, name);
  }

  // dotted form: Ball.x
  const dot = id.indexOf(".");
  if (dot > 0) return h.actorProp(id.slice(0, dot), id.slice(dot + 1));

  // bare words
  if (id === "t") return h.t;
  if (id === "pi") return Math.PI;
  if (id === "true") return 1;
  if (id === "false") return 0;

  // bare name = self var, falling back to scene var
  if (h.self) {
    const v = h.self(id);
    if (v !== undefined && v !== 0) return v;
  }
  return h.scene(id);
}

/* ---- public API -------------------------------------------------- */

/**
 * Evaluate an expression. Total: never throws. A malformed expression in a
 * user's microgame degrades to 0 rather than killing the frame — important
 * when the thing is authored in a live editor.
 */
export function evalExpr(raw: unknown, h: ExprHost): number {
  if (typeof raw === "number") return raw;
  if (raw == null) return 0;
  const src = String(raw).trim();
  if (src === "") return 0;

  // fast path: plain number (the overwhelmingly common case)
  if (/^-?\d+(\.\d+)?$/.test(src)) return parseFloat(src);

  // fast path: single brace token, no arithmetic (v1's exact syntax)
  if (src.startsWith("{") && src.endsWith("}") && src.indexOf("}") === src.length - 1) {
    return resolveIdent(src, h);
  }

  try {
    const v = new P(lex(src), h).parse(0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/** Does this expression reference another actor by name? Used by the editor
 *  to show a live "this resolves to the picked instance" hint. */
export function referencedActors(raw: unknown): string[] {
  const src = String(raw ?? "");
  const out = new Set<string>();
  for (const m of src.matchAll(/\{([A-Za-z_][A-Za-z0-9_ ]*):/g)) {
    const s = m[1];
    if (s !== "self" && s !== "scene" && s !== "rnd") out.add(s);
  }
  for (const m of src.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z_]+/g)) out.add(m[1]);
  return Array.from(out);
}

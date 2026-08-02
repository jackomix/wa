# The Open Decision: (a) extend v1, or (b) rebuild fresh?

## Recommendation: **(a) — extend the existing codebase. Do not rebuild.**

I want to be transparent about how I got here, because I changed my mind.

I initially read the wrong commit (`9b5bf4c`, since superseded by `46b1108 CORRECT BUILD, IGNORE OLD
ONE`). That build was a 1,725-line hardcoded `switch` with zero editor code, and for *that* artifact
rebuilding was obviously correct. Having now read the real v1, **that recommendation was wrong** and
I'm reversing it.

The real v1 already implements the architecture the brief asks me to keep. Rebuilding it would be
vandalism.

---

## What the real v1 already gets right

I read all 4,525 lines. This is a competent, well-factored data-driven engine:

| file | lines | what it actually is |
| --- | --- | --- |
| `editor/spec.ts` | 225 | **declarative catalog** of conditions/actions/behaviors that drives the editor UI *and* the runtime switch from one source |
| `editor/schema.ts` | 165 | clean JSON microgame model: actors, appearance, scene, event sheet |
| `editor/runtime.tsx` | 589 | compiles `MicrogameData` → live `MicrogameDef`; behavior integrator + event interpreter |
| `editor/Editor.tsx` | 976 | four-tab editor (scene / sprite / events / settings) |
| `engine/useEngine.ts` | 462 | beat-clock state machine, lookahead audio scheduling |
| `microgames/index.tsx` | 505 | 7 hand-written reference microgames |

Specific things that are genuinely well done and that I am **keeping**:

1. **The spec-driven catalog.** `COND_SPECS` / `ACTION_SPECS` / `BEHAVIOR_SPECS` declare their own
   parameter fields, and both the editor UI and the runtime dispatch off the same ids. Adding a new
   action means adding one entry, not editing five files. This is exactly the Construct approach.
2. **Time measured in beats, not seconds.** `MgCtx.dtBeats`, `t`, `beatPhase`. Behaviors integrate
   against `dtBeats`, so *everything automatically stays correct when the tempo ramps*. Most clones
   get this wrong and it is the single biggest reason v1's rhythm holds up.
3. **A never-pausing global `beatClock`** with run starts quantised to the next bar
   (`Math.ceil((beatClock + 0.05) / 4) * 4`). The metronome is the spine; phases attach to it.
4. **Lookahead audio scheduling** against `AudioContext.currentTime` with a 160 ms horizon, rather
   than firing sounds from rAF. This is the correct way to do rhythm audio on the web.
5. **The microgame starts one beat *before* control.** `spawnMg(c, p.startBeat + L)` at `local >= L-1`,
   so `t` runs `-1 → 0` while the doors open. Objects are already moving when you take over. This is
   a real WarioWare detail and v1 nailed it.
6. **`solid` + least-penetration resolution**, `groundedPrev` for reliable jump edges, pointer mapped
   through `[data-gamescreen]` so Drag & Drop works in a letterboxed canvas.

None of that gets thrown away.

## What's genuinely missing or wrong

The gaps are real but they are *additive* — every one is a new module or a localised change, not a
re-architecture:

| gap | severity | why it's additive |
| --- | --- | --- |
| **No instance picking (SOL)** | the big one | `runtime.tsx` loops `for (const a of s.actors)` and an action's `targetDef` hits *every* live instance. "On collision Player↔Ball → Destroy Ball" destroys **all** balls. Fix = a `PickState` layer between conditions and actions. Contained in one file. |
| **No costumes** | required by brief | `Appearance` is a single static value. Needs `costumes[]` with frame sequences. Schema addition + migration. |
| **No expression objects** | limits authoring | expressions are `{self:x}` strings via regex. Can't write `Ball.width` or `sin(t*90)`. Extend the resolver, keep the string syntax working. |
| **Emoji is a `<span>`** | brief item 4 | `<span style={{fontSize}}>{a.emoji}</span>` — a literal glyph render, exactly as reported. Needs an asset-reference indirection. |
| **Frame rules surfaced** | brief item 1 | `FRAMERULE!` badge in `Screens.tsx:146`, `"4 bars (framerules)"` in the editor dropdown, comments in `microgames/index.tsx`. Delete the surfacing, keep the mechanic. |
| **Instruction lingers** | brief item 2 | `Screens.tsx:170` holds full opacity to beat 2.4 of 3. Retime. |
| **`♩=BPM` + bar counter HUD** | brief item 3 | `RhythmHUD` in the bottom-left. This is the "music-note icon" — remove. |
| **One canvas size for all** | brief item 4 | screen is hardcoded `left:11% top:8.5% width:78% height:78%`. Needs per-microgame canvas. |
| **7 microgames, no hosts** | content | no host/stage structure, no boss games, no difficulty tiers. |

## Why extending wins here

- The **spec catalog pattern is worth more than any code I'd write from scratch**. It's the right
  abstraction and it's already load-bearing. Rebuilding would mean reinventing it and getting it
  slightly differently wrong.
- The **beats-not-seconds decision is baked through every behavior**. That's the hard-won part. It's
  already correct.
- The four reported bugs are **four small localised edits** (~40 lines total), not symptoms of a rotten
  foundation. I was wrong to characterise them as one systemic bug — that was true of the *other* build.
- Every missing feature is a **new module** (`picking.ts`, `costumes.ts`, `expr.ts`, `assets.ts`) plus a
  versioned schema migration. Nothing requires demolishing what's there.
- The user data model is already persisted to `localStorage` with import/export codes. A rebuild
  breaks every microgame anyone already made. Migration is strictly kinder.

## The one thing I *am* restructuring

`runtime.tsx`'s `step()` is the only place where the existing design actively blocks the brief. Its
event loop is:

```ts
for (const ev of data.events) {
  if (!evalGlobal(ev.conditions, ec)) continue;
  if (ev.forActor) {
    for (const a of [...s.actors]) {          // iterate ALL instances
      if (a.def.id !== ev.forActor) continue;
      ec.self = a;
      if (!evalInstance(ev.conditions, ec)) continue;
      for (const act of ev.actions) applyAction(act, ec);
    }
  }
}
```

Two structural problems: an event has exactly one `self` actor type (so `targetDef` sprays actions
across all instances of the *other* type), and conditions are split into `evalGlobal`/`evalInstance`
which prevents a condition from *narrowing* a set.

The replacement keeps the same outer shape and the same spec ids — conditions become set-narrowing
operations over a `PickState`, and actions read the picked set. Existing microgames keep working
because a single-instance actor picks to itself either way. This is a rewrite of ~200 lines inside one
function, not of the project.

---

## Ground truth from the ROM (this part is unchanged and it's the good news)

I verified your ROM:

```
title    : WARIOWAREINC
gamecode : AZWE            (Mega Microgame$!, USA)
sha1     : 3f556448d290fa5406d6ed367fee16cc02387ad3
```

That SHA-1 is the **exact baserom target** of the `ShaffySwitcher/wariowareinc` decompilation
(`BASEROM_SHA1 := 3f556448d290fa5406d6ed367fee16cc02387ad3`). So I read the engine rather than
inferring it. The headline findings, which now become *tuning* for v1's existing clock rather than a
reason to replace it:

**The tick model.** From `set_beatscript_tempo()`:

```c
speed     = tempo << 8;
speed    /= musicBaseBPM;
deltaTime = musicBaseBPM * speed / 150u;   // == (tempo << 8) / 150
```

`rest N` stores `N << 8` and is decremented by `deltaTime` once per frame. Every decompiled script
rests in multiples of 24. Therefore **24 ticks = 1 beat**, and:

$$\text{frames per beat} = \frac{24 \ll 8}{(tempo \ll 8)/150} = \frac{3600}{tempo}$$

So one beat is *exactly* `60/tempo` seconds at 60 fps. v1's `dtBeats = dt * bpm / 60` is already
numerically identical — it just arrives there by a different route. **v1's clock was right.** The ROM
confirms it rather than contradicting it, which is a strong signal for option (a).

**The real "frame rule."** It is the tick quantisation itself, an internal scheduler property. It was
never a player-facing concept. Deleting the `FRAMERULE!` badge isn't hiding a feature; it's correcting
a category error.

**Collision.** `gameplay_check_collision` is four early-out AABB comparisons — no radius, no slop.
v1's `overlap()` matches. Hit windows in WarioWare are *tight*, and a friendlier test feels wrong.

**Structure.** `#define MAX_LIVES 4`, `MAX_SCORE 999`, two concurrent beatscript threads, a sprite
handler with `SET_ANIM`/`SET_PLAYBACK` operations (which is precisely the costume system v1 lacks —
the original had it, so adding it is restoration, not invention).

---

## Scope, stated honestly

The original ships **213 microgames** (`u8 microgameFlags[0x100]`; the menu iterates to 226).
Recreating all 213 well is a content marathon, and shipping 213 shallow ones defeats the stated
purpose — which was to use recreation as a **stress test for the editor**.

So: engine + editor upgrades to spec, a meaningful recreated roster across all 9 hosts with real
names / canvas sizes / difficulty tiers, and the pipeline documented so the rest is data entry rather
than programming. Every editor change provoked by an awkward recreation is logged in
`docs/40-EDITOR-CHANGELOG.md` against the microgame that caused it — that log is the real deliverable
of "recreation as a design tool."

Proceeding with **(a)**.

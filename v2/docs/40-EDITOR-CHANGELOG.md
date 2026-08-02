# Recreation as a design tool

The brief asked for recreation to be used as a **stress test for the editor**: where
rebuilding an original microgame is awkward, that is a signal the editor needs work.

This log records the changes that recreation actually forced, and what provoked each
one. It is the honest output of that instruction — including the cases where the
editor was fine and the problem was elsewhere.

---

## 1. Collision destroyed every instance, not the one that was hit

**Provoked by:** any recreation with more than one hazard on screen (the multi-lane
fly/hazard shape, ~30 of the ROM entries).

**What went wrong.** v1's interpreter looped every instance and an action's
`targetDef` applied to *all* live instances of that type:

```ts
for (const a of s.actors) {
  if (a.def.id !== ev.forActor) continue;
  ec.self = a;
  for (const act of ev.actions) applyAction(act, ec);
}
```

So the obvious authoring —

```
[Player: Overlaps Ball] -> Destroy Ball
```

— destroyed **every** ball. The only workaround was to allow exactly one instance,
which rules out a whole class of real microgames.

**Fix.** Implemented Construct's SOL model (`engine/picking.ts`). A condition now
*narrows* the picked set rather than returning a bare bool; a condition is "true"
exactly when it leaves at least one instance picked. Collision narrows **both** sides
via `collectPairs`, so cross-actor expressions resolve to the collision partner.

**Cost:** ~200 lines inside `step()`; the spec ids and the outer event shape were
unchanged, so every existing microgame kept working.

**Verified:** `v2/tools/test/rom-games.test.mjs` plus a dedicated picking suite —
"collision picks exactly 1 ball", "b2 survives", "b3 survives", "parent unaffected by
child".

---

## 2. "Set Player size to Ball size" wasn't expressible

**Provoked by:** recreations where one object adopts another's property (scale-to-fit,
match-the-target shapes).

**What went wrong.** Expressions were a regex over `{self:x}` / `{scene:v}` / `{rnd:a,b}`.
There was no way to reference *another actor*, so this needed a bespoke action.

**Fix.** Real expression parser (`engine/expr.ts`, precedence climbing) supporting
`Ball.x`, `{Ball:width}`, `count(Ball)`, arithmetic and ~18 functions — resolved
against the **picked** set, so `Ball.width` means the ball this event is about.

v1's token syntax is a strict subset and still parses identically; the evaluator is
total and degrades a malformed expression to `0` rather than throwing, which matters
in a live editor.

---

## 3. An actor could only ever look like one thing

**Provoked by:** essentially every recreation. A fly that becomes a splat, a swatter
that goes up and down, a host that reacts — all needed a second appearance.

**What went wrong.** `ActorDef.appearance` was a single static value. The only
"animation" available was v1's `Set emoji` action, which poked a render-time override
and could not express a sequence.

**Fix.** Costumes: `ActorDef.costumes[]`, each an animated sequence with per-cel holds
**in beats** and a playback mode. Actions `Switch costume`, `Switch costume (keep
frame)`, `Play/Stop animation`, `Go to frame`; conditions `Costume is`,
`Animation finished`.

The original engine worked this way already (`SET_ANIM` / `SET_PLAYBACK` /
`SET_ANIM_CEL` on its sprite handler), so this is a restoration, not an invention.

`Set emoji` was retargeted onto the costume system rather than deleted, so old
microgames still behave.

---

## 4. The Sprite tab could not author an animation

**Provoked by:** #3. Once actors had costumes, the art tab could not edit them.

**Fix.** `editor/CostumeStudio.tsx` — costume rail, frame strip, per-cel hold picker
in musical divisions, playback selector, onion skin of the previous cel, and a live
preview **running at game tempo** so what you see is what plays.

**Also rebuilt** `PixelEditor.tsx`, which the brief called weak: brush sizes,
pattern masks (checker / 25% / 75% / stripes / noise), shaped erasers including a
*fade* eraser that thins coverage instead of hard-clearing, mirror drawing (H/V/quad),
line and rectangle with rubber-band preview, eyedropper, flip/rotate/nudge, full
undo-redo, and 8→32px grids.

Grid size is where "resolution" lives — a quiet stepper on the canvas, never a modal
asking "pixel art or photorealistic?".

---

## 5. Every microgame was forced to the same playfield

**Provoked by:** the ROM showing per-microgame graphics tables with differing layouts.

**What went wrong.** The screen was hardcoded `left:11% top:8.5% width:78% height:78%`.

**Fix.** `MicrogameData.canvas` (default 240×160, GBA native). Actor coordinates stay
0-100 in both axes so existing content is unaffected; the canvas changes aspect and
pixel density only. Fidelity is *derived* from canvas width rather than asked.

---

## 6. Emoji art could not be replaced

**Provoked by:** wanting to swap placeholder emoji for the real extracted ROM sprites.

**What went wrong.** Art was rendered as a literal glyph:

```tsx
<span style={{ fontSize }}>{a.emoji ?? a.def.appearance.char}</span>
```

There was no reference to swap. Using emoji as placeholder art is a good idea; making
it a `<span>` is what was wrong.

**Fix.** All art is a `SpriteRef` behind a costume cel, rendered through one component
(`engine/Sprite.tsx`) that handles `glyph | pixel | shape | image` identically.
Swapping placeholder for finished art is one field. This is what let 555 real ROM
sprites and 91 real backgrounds drop straight into the recreations with no other
change.

---

## 7. Cases where the editor was already right

Worth recording, because "recreation as a design tool" should also confirm good
decisions:

- **Beats, not seconds.** `MgCtx.dtBeats` and beat-indexed behaviors meant every
  recreation scaled correctly across the tempo ramp with zero extra work. The ROM's
  own scheduler confirmed the model exactly (`3600/tempo` frames per beat).
- **The spec catalog.** `COND_SPECS` / `ACTION_SPECS` / `BEHAVIOR_SPECS` driving both
  the UI and the runtime dispatch meant every new condition and action above cost one
  entry, not edits in five files.
- **The pre-roll beat.** Spawning the microgame one beat before control (`t: -1 → 0`)
  is a genuine WarioWare detail that v1 already had, and it is why the recreations
  read fast without any per-game tuning.
- **AABB collision.** v1's overlap test already matched the ROM's four-comparison
  `gameplay_check_collision` exactly. No change needed.

---

## 8. Still awkward — known gaps

Honest list of things recreation exposed that are *not* yet fixed:

- **No sub-event UI.** The runtime scopes sub-events correctly (`PickState.clone()`),
  but the editor cannot author nested blocks. Complex recreations currently flatten
  into several sibling events, which is harder to read than it should be.
- **No timeline/keyframe view.** Several originals choreograph motion on specific
  beats. Expressing that as `After N beats` events works but is clumsy; a beat
  timeline would be the right tool.
- **Sprite auto-slicing is heuristic.** Grouping OBJ tiles into 16×16/32×32 objects
  gets recognisable sprites but sometimes fragments a large one. A manual slice
  tool over the extracted tilesheet would fix it.
- **Backgrounds are downsampled** to a 64-wide indexed grid to keep the bundle near
  1.1 MB. Full-resolution backdrops would be ~7× larger and need an asset store
  rather than an inline module.

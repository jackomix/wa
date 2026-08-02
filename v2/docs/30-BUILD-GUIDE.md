# Building a faithful microgame

A practical guide. Not "how WarioWare-style games work in the abstract" — this is
what the original actually does, why, and how to reproduce it in this engine.
Everything asserted here is sourced in [`10-ROM-FINDINGS.md`](./10-ROM-FINDINGS.md).

---

## 0. The one rule

**A microgame is data.** There is no per-microgame code path anywhere in the engine.
If you cannot build something out of actors + behaviors + the event sheet, that is a
missing engine feature, not a licence to write a special case. Every one of the 139
ROM recreations obeys this.

---

## 1. Get the length right first

The single most common failure in fan recreations is treating a microgame as
"about 4 seconds". It isn't. It is **8 beats**, and how long that is depends on the
current tempo.

```
frames per beat = 3600 / tempo          (derived from the ROM's scheduler)
one beat        = 60 / tempo seconds    at 60fps
standard game   = 8 beats
long game       = 16 beats
```

| tempo | 8-beat game |
| ---: | ---: |
| 120 | 4.03 s |
| 140 | 3.46 s |
| 180 | 2.68 s |
| 220 | 2.20 s |

**Why this matters:** the game speeds up as you play. If you author against seconds,
your microgame breaks at high tempo. If you author against beats, it scales for free.

In this engine that is already handled: `MgCtx.dtBeats` is beats-per-frame, and every
behavior integrates against it. **Never use `ctx.dt` for gameplay motion.** Use
`ctx.dtBeats` and express speeds in units-per-beat.

```ts
// wrong — breaks when the tempo ramps
a.x += 30 * ctx.dt;

// right — stays correct at any tempo
a.x += 30 * ctx.dtBeats;
```

Costume frame holds are in beats for the same reason, so animation stays locked to
the music as the run accelerates.

### Pick your length from the source

The ROM stores a `timerValue` per microgame (`unk9` of `GameplayMicrogameInfo`):

| value | count in ROM | length |
| ---: | ---: | --- |
| 10 | 35 | 2 bars (8 beats) |
| 15 | 54 | 2 bars |
| 20 | 31 | 2 bars |
| 25 | 14 | 4 bars (16 beats) |
| 30 | 7 | 4 bars |

**85% are 8 beats.** Reach for 16 only for genuine boss-scale ideas.

---

## 2. Design for one button

This is measured, not asserted. Across all 141 entries in the ROM's master table:

- **129** bit-test the **A** button
- **52** read `gPressedKeys` (edge — a *tap*)
- **27** read `gCurrentKeys` (level — a *hold*)
- d-pad masks appear in **≤6** each
- **74** read no input at all in `updateFunc` (they resolve on a timer or a collision)

So the canonical microgame is: *one thing happens, you press A at the right moment.*

| your intent | condition to use | matches ROM style |
| --- | --- | --- |
| tap at the right moment | `Key pressed` | `gPressedKeys` — 52 games |
| hold to charge / steer | `Key held` | `gCurrentKeys` — 27 games |
| survive without acting | (no input event) | 74 games |

**Do not** build a microgame that needs two simultaneous inputs, or that teaches a
control scheme. You have ~3.5 seconds and the instruction is one word.

---

## 3. Structure of a microgame

Every microgame in the original resolves to one of three shapes. Recognising which
one you are building tells you what the timeout should do.

### A. Act — react inside a window
Something appears or arrives; press at the right time.
- **Timeout = lose.** Failing to act is failing.
- 40 of the ROM recreations.

```
[Player: Key pressed (space)] + [Player: Overlaps Target]
    -> Win
    -> Play sound "coin"
```

Note this is *two conditions on one event*. The collision narrows the picked set to
the target actually overlapping, so a following `Destroy Target` hits the right one.

### B. Avoid — survive to the end
A hazard moves; do not get hit.
- **Timeout = win.** Surviving is winning.
- 74 of the recreations.

```
[Player: Overlaps Hazard]  -> Lose, Play "hit", Screen shake 2
[Player: Key pressed]      -> Add velocity (0, -46)     // jump
```

### C. Aim — line something up and commit
Move or hold, then release/press.
- **Timeout = lose.**
- 27 of the recreations.

```
[Player: Key held (left)]  -> Add velocity (-40, 0)
[Player: Key pressed] + [Player: Overlaps Slot]  -> Win
```

---

## 4. Difficulty: three tiers, and what actually changes

**123 of 141** microgames branch on `gGameplayData.currentDifficulty`. Tiering is not
optional garnish — it is the norm.

Set the three tiers in the microgame's `difficulty` block and read them as scene
variables:

```ts
difficulty: {
  1: { speed: 20 },
  2: { speed: 30 },
  3: { speed: 42 },
}
```

```
[On game start] -> Set velocity  vx = 0 - {scene:speed}   (target: Hazard)
```

**What the original scales:** speed, count, and the size of the success window.
**What it does not scale:** the rules. Level 3 is never a different game; it is the
same game with less slack. Changing the win condition between tiers reads as unfair
because the player learned the rule at level 1.

---

## 5. Hit detection is deliberately tight

The original's collision is four early-out AABB comparisons, with no radius and no
forgiveness:

```c
if (xA >= xB + wB) return FALSE;
if (xB >= xA + wA) return FALSE;
if (yA >= yB + hB) return FALSE;
if (yB >= yA + hA) return FALSE;
return TRUE;
```

This engine uses the same test. **Resist the urge to be generous.** The tightness is
what makes a clear hit feel earned; a fuzzy test makes the whole game feel mushy, and
it is the most common reason clones feel "off" despite looking right.

If a microgame is too hard, make the *target bigger* or the *approach slower*. Do not
loosen the test.

---

## 6. Randomise variants, not values

Real RNG moduli from the ROM, by frequency:

```
rand(2) ×30   rand(3) ×17   rand(4) ×16   rand(128) ×12
rand(16) ×8   rand(6)  ×8   rand(8)  ×6   rand(192) ×5
```

The small moduli dominate. Microgames pick **which of 2-4 variants** (which side the
thing comes from, which of three doors), not a continuous value. `rand(128)`/`rand(192)`
are pixel coordinates on the 240-wide screen.

This matters for fairness: with 3 variants the player can learn all three in a few
plays. With a continuous random position they can only ever react, never anticipate —
which is a different, worse game.

```
[On game start] -> Set scene variable "variant" = randomInt(0, 2)
[variant = 0]   -> Set position (10, 50)   (target: Hazard)
[variant = 1]   -> Set position (50, 20)   (target: Hazard)
[variant = 2]   -> Set position (90, 50)   (target: Hazard)
```

---

## 7. The pre-roll: your microgame starts before the player does

The engine spawns a microgame **one beat before** the player gets control. `ctx.t`
runs `-1 → 0` while the doors open, and `ctx.control` is `false` for that beat.

This is not an implementation detail to work around — it is why WarioWare reads so
fast. By the time you can act, the ball is already falling and you have had a beat to
see it. Use it:

- let hazards move during the pre-roll (they do so automatically)
- gate *player* actions on `ctx.control` (behaviors already do)
- do not resolve win/lose before `t >= 0`

`On game start` fires on the first frame of control, not at `t = -1`, so it is safe
for "begin the challenge" logic.

---

## 8. Costumes, not sprite swaps

An actor has **costumes**; each costume is an animated sequence. The event sheet
switches between them by name.

```
[Player: Overlaps Goal]  -> Switch costume "celebrate"
[Player: Overlaps Spike] -> Switch costume "hurt"
```

- frame holds are in **beats** (`1/8`, `1/4`, `1/2`, `1`, `2`) so animation follows tempo
- playback modes: `loop`, `pingpong`, `once`, `onceHide`
- `Switch costume (keep frame)` preserves the cel index — use it for palette-swap or
  mood changes where a restart would visibly pop
- `{self:interrupted}` is 1 when a costume switch cut an unfinished animation short

The original worked exactly this way (`SET_ANIM` / `SET_PLAYBACK` / `SET_ANIM_CEL`
operations on its sprite handler), which is why costumes are a restoration rather
than an invention.

### Art is a reference, never baked-in text

Placeholder emoji are a `SpriteRef`, resolved through the same render path as pixels
and bitmaps:

```ts
{ kind: "emoji", char: "🐰" }     // placeholder
{ kind: "pixel", grid, palette, pixels }   // drawn in the editor
{ kind: "image", src }            // finished art
```

Swapping one for another is a single field change. Nothing downstream — renderer,
hit test, editor thumbnail, exporter — can tell the difference. **Never render a
glyph directly**; that was v1's mistake and it made placeholder art unswappable.

---

## 9. Instance picking: the thing that makes event sheets work

A condition does not merely return true/false — it **narrows** which instances the
rest of the event talks about.

```
[Player: Overlaps Ball]  ->  Destroy Ball
```

destroys **the ball that was hit**, not all of them. No instance picker, no loop, no
manual disambiguation. Same for expressions:

```
[Player: Overlaps Ball]  ->  Set scale to  Ball.width / 10
```

`Ball.width` is *that* ball's width.

Useful consequences:
- `count(Ball)` is the number of *picked* balls
- newly spawned instances join the picked set, so a later action in the same event
  can address what was just created
- sub-events inherit a clone of the parent's picked set, so siblings don't interfere
- `Pick a random one` / `Pick the Nth one` narrow deliberately

---

## 10. Expressions

Anywhere a number is wanted you can write an expression. v1's token syntax still
works; the cross-actor forms are new.

```
42                     literal
{self:x}               own property or variable
{scene:score}          scene variable
{scene:t}              beats elapsed in this microgame
{rnd:10,90}            uniform random in a range
Ball.x                 picked Ball's x          (cross-actor)
{Ball:width}           same, brace form
count(Ball)            how many Balls are picked
sin(t*90)*8 + 50       arithmetic and functions
```

Functions: `sin cos abs min max floor ceil round sign sqrt clamp lerp dist random
randomInt choose count`. Angles are degrees. A malformed expression evaluates to `0`
rather than throwing — a typo in a live editor should not kill the frame.

---

## 11. Canvas and fidelity

Canvas is **per microgame** (default 240×160, GBA native) because the original varies
its playfield. Actor coordinates stay 0-100 in both axes regardless, so a microgame
authored at one size still reads at another; the canvas changes aspect and pixel
density only.

Fidelity is **derived**, not asked. Small canvas ⇒ crisp nearest-neighbour and
position snapping; large ⇒ smoothing. It is overridable in Settings and there is
deliberately no "pixel art or photorealistic?" prompt anywhere — that question
belongs to the art you make, not to a modal.

---

## 12. Checklist before you call it done

- [ ] Reads in **one word**. If the instruction needs a clause, the game is too complex.
- [ ] Winnable on the **first sight** at difficulty 1, by someone who has never seen it.
- [ ] Uses **one button**, or none.
- [ ] All motion in **units per beat**, no `ctx.dt`.
- [ ] Three difficulty tiers that change *numbers*, not *rules*.
- [ ] Timeout outcome matches the shape (act/aim ⇒ lose, avoid ⇒ win).
- [ ] Something is already moving during the pre-roll beat.
- [ ] Success is **unambiguous** — sound + costume change + screen shake on impact.
- [ ] Still fair at tempo 220, where you have 2.2 seconds.
- [ ] No hardcoded art: every appearance is a costume reference.

---

## 13. Worked example

"Swat the fly." Fly crosses the screen; press A while the swatter overlaps it.

```
Actors
  Fly      costumes: buzz (2 cels, 1/8 beat, loop), splat (1 cel)
           behavior: static (we drive it from events)
  Swatter  costumes: up, down
           behavior: 8-direction, speed 40

Scene variables      speed = 24          (overridden per tier)
Difficulty           1:{speed:20}  2:{speed:30}  3:{speed:42}
Length               2 bars   Timeout: lose

Events
  [On game start]
      -> Set velocity  vx = 0 - {scene:speed},  vy = 0   (target: Fly)
      -> Set scene variable "lane" = randomInt(0, 2)

  [lane = 0] -> Set position (108, 30)  (target: Fly)
  [lane = 1] -> Set position (108, 50)  (target: Fly)
  [lane = 2] -> Set position (108, 70)  (target: Fly)

  [Fly: Off-screen]
      -> Set position (108, {rnd:26,74})

  [Swatter: Key pressed (space)]
      -> Switch costume "down"

  [Swatter: Key pressed (space)] + [Swatter: Overlaps Fly]
      -> Switch costume "splat"   (target: Fly)
      -> Stop animation           (target: Fly)
      -> Play sound "hit"
      -> Screen shake 2
      -> Win
```

Note what this gets for free: the fly's wing animation speeds up with the tempo
because holds are in beats; the swat picks *the* fly it overlapped; the three lanes
are learnable; and at difficulty 3 the fly is simply faster, not differently-ruled.

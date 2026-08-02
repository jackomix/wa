# Build guide: one faithful microgame

## 1. Create the data record

In the editor, choose the logical canvas first (240 × 160 is the native source
profile). Set the active playfield rectangle if the scene uses an inset or
shorter active region. Choose a short imperative instruction and a 2- or 4-bar
phrase. Do not encode stage lives or score in the microgame.

## 2. Add actor definitions and placed instances

An `ActorDef` contains a stable ID, collision size, z order, behavior, variables,
and `costumes`. A `Scene` places instances of that definition. Use behaviors
before custom logic:

- `platformer`: horizontal input, gravity, jump, floor/solid resolution;
- `8direction`: four-way movement and friction;
- `physics`: gravity, bounce, and solid collision;
- `dragdrop`: pointer grab and release.

The editor's Sprite tab stores `SpriteFrame` references inside named costumes.
A costume can have multiple frames, FPS, and loop/one-shot playback. The
placeholder `SpriteAsset` registry is deliberately replaceable by a real sprite
sheet importer later.

## 3. Write conditions → actions

A `GameEvent` is evaluated as conditions first, then actions. For actor events,
`forActor` is `self`. An overlap condition records the exact object it found as
`other`. Select `other (picked)` in the action target when you want the specific
instance:

```ts
{
  name: "catch the ball",
  forActor: hand.id,
  conditions: [{ kind: "collide", params: { other: ball.id } }],
  actions: [
    { kind: "destroy", params: {}, targetDef: "__other" },
    { kind: "switchCostume", params: { costume: "celebrating" } },
    { kind: "win", params: {} },
  ],
}
```

That is context-aware: if three balls exist, only the ball touched on this
frame is destroyed. A type-wide target remains available for deliberate actions
such as setting every meteor's velocity.

## 4. Tune in order

1. Play the command pre-roll until it is readable at a glance.
2. Make the clear window wide and verify the verb works.
3. Add the source-like collision rectangle and input edge (held, pressed, or
   released).
4. Record first-clear and late-clear beats at each difficulty.
5. Add fake-outs, retries, and costume changes only after the loop is correct.
6. Test the scene in Tester, then test it inside the stage controller.

Instruction text is a cue, not a tutorial card: it appears during the final
interlude beat and fades within the first active fraction of a beat.

## 5. Let the stage finish the job

The global engine keeps its beat clock continuous while a microgame runs. It
handles interlude presentation, score/lives, speed changes, and game over. This
is why a new authored scene can be added to the local library without adding a
new campaign branch.

## Current stress-test content

The current build keeps a 213-entry stage registry. The Introduction set has
13 authored mechanics covering platforming, catch/collision, lane dodge, key
reaction, shooting, charge/mash, survival, physics, and result timing; the other
stage entries are source-indexed scaffolds ready to be converted title by title.
Editable local presets cover drag/drop and event-sheet authoring. Use the
conversion process as a UX test: whenever a recreation needs a special
exception, promote the missing concept to a behavior, condition, action,
costume, or asset reference instead of hardcoding another screen.

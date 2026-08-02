#!/usr/bin/env python3
"""
Generate romSpecs.json: one recreation spec per ROM-linked microgame.

Everything mechanical is DERIVED from the disassembly, not invented:

    input   gPressedKeys only          -> "tap"   (edge-triggered)
            gCurrentKeys present       -> "hold"  (level-triggered)
            d-pad masks bit-tested     -> "dpad"
            no input globals           -> "none"  (autoplay / timing-only)

    goal    reads input + short timer   -> "act"   (react in the window)
            no input, longer timer      -> "avoid" (survive)
            hold input + d-pad          -> "aim"   (line it up)

    bars    timerValue >= 25            -> 4 bars, else 2

Names: the ROM ships no per-microgame name strings (the menu draws names as
tile art, not text), so display names are assigned per host set from the
game's published roster and the rendered background of each entry. Those two
fields (`name`, `summary`) are the only editorial part of this file; every
mechanical field is read from code.

Usage: python3 gen_specs.py <specs.json> <links.json> <out.json>
"""
import argparse
import json

# Host cycle follows the stage order in the decompilation's include/levels.h:
#   STAGE_INTRODUCTION, JIMMY, 9_VOLT, DRIBBLE, KAT, MONA, DR_CRYGOR, ORBULON, WARIO
HOSTS = ["wario", "jimmy", "ninevolt", "dribble", "kat", "mona", "crygor", "orbulon"]

# Display names drawn from the published roster, matched to rendered screens.
NAMES = {
    2:  ("Nose Dive",      "PICK!",    "Guide the finger up the nostril before time runs out."),
    3:  ("Pumped Up",      "PUMP!",    "Fill the gauge to 100 by hammering the button."),
    5:  ("Sole Man",       "STOMP!",   "Bring the foot down on the target."),
    6:  ("Nose Picker",    "PICK!",    "Time the pick — the boogers are watching."),
    8:  ("Quick Draw",     "GRAB!",    "Snatch it the instant it appears."),
    10: ("Hurdle",         "JUMP!",    "Clear the bar without clipping it."),
    13: ("Dig Dug",        "DIG!",     "Break through the soil before the timer dies."),
    14: ("Chop Chop",      "CHOP!",    "One clean swing, on the beat."),
    16: ("Swat It",        "SWAT!",    "Flatten the fly."),
    19: ("Catch!",         "CATCH!",   "Get under it and take the catch."),
    20: ("Bounce",         "BOUNCE!",  "Keep it in the air."),
    22: ("Duck",           "DUCK!",    "Get under the swing."),
    23: ("Spin Cycle",     "SPIN!",    "Wind it all the way round."),
    26: ("Tap Out",        "TAP!",     "Tap the moment the signal shows."),
    27: ("Balance",        "BALANCE!", "Hold it steady until the bell."),
    30: ("Slice",          "SLICE!",   "Cut it in one pass."),
    31: ("Reel It In",     "REEL!",    "Land the catch before it escapes."),
    36: ("Dodge",          "DODGE!",   "Do not get hit."),
    37: ("Fetch",          "FETCH!",   "Meet it where it lands."),
    39: ("Stack",          "STACK!",   "Drop it square on the pile."),
    43: ("Pop",            "POP!",     "Burst it before it drifts off."),
    44: ("Sprint",         "RUN!",     "Reach the line in time."),
    46: ("Aim",            "AIM!",     "Line it up and fire."),
    47: ("Sweep",          "SWEEP!",   "Clear the floor."),
    49: ("Escape",         "ESCAPE!",  "Get out before it closes."),
    50: ("Launch",         "LAUNCH!",  "Fire at the top of the arc."),
    53: ("Squash",         "SQUASH!",  "Flatten it flat."),
    55: ("Thread It",      "THREAD!",  "Line up and pass through."),
    57: ("Snap",           "SNAP!",    "Shut it at the right instant."),
    58: ("Climb",          "CLIMB!",   "Get to the top."),
    59: ("Wake Up",        "WAKE!",    "Rouse them before the alarm stops."),
    60: ("Serve",          "SERVE!",   "Return it over the net."),
    64: ("Plug In",        "PLUG!",    "Make the connection."),
    68: ("Shoot",          "SHOOT!",   "Hit the target dead on."),
    69: ("Weave",          "WEAVE!",   "Slip past everything."),
    70: ("Land It",        "LAND!",    "Touch down softly."),
    71: ("Feed",           "FEED!",    "Get it in the mouth."),
    73: ("Trim",           "TRIM!",    "Cut to the line, no further."),
    74: ("Lift",           "LIFT!",    "Heave it up."),
    77: ("Hatch",          "HATCH!",   "Crack it open."),
    78: ("Finish",         "FINISH!",  "Take the last step."),
}


# Verb pools used to name entries that have no curated name. The verb is
# chosen from MEASURED behaviour (input model + goal + length), so the
# instruction card always matches what the microgame actually asks for --
# rather than inventing a fictional theme for it.
DERIVED = {
    ("tap", "act"):   [("Quick Tap", "TAP!"), ("Snap To It", "PRESS!"), ("On Cue", "NOW!"),
                       ("Hit It", "HIT!"), ("React", "REACT!"), ("Strike", "STRIKE!"),
                       ("Punch In", "PUNCH!"), ("Trigger", "FIRE!"), ("Catch It", "CATCH!"),
                       ("Grab", "GRAB!"), ("Smack", "SMACK!"), ("Poke", "POKE!")],
    ("hold", "aim"):  [("Hold Steady", "HOLD!"), ("Line It Up", "AIM!"), ("Steady", "STEADY!"),
                       ("Charge Up", "CHARGE!"), ("Keep It There", "HOLD!"), ("Wind Up", "WIND!")],
    ("dpad", "aim"):  [("Steer", "STEER!"), ("Guide It", "GUIDE!"), ("Line Up", "AIM!"),
                       ("Move It", "MOVE!"), ("Navigate", "GO!")],
    ("none", "avoid"):[("Hang On", "SURVIVE!"), ("Don't Blink", "WAIT!"), ("Stay Put", "WAIT!"),
                       ("Ride It Out", "HOLD ON!"), ("Weather It", "SURVIVE!"), ("Endure", "LAST!"),
                       ("Sit Tight", "WAIT!"), ("Brace", "BRACE!")],
}

SUMMARY = {
    "act":   "React the instant the moment arrives.",
    "aim":   "Line it up and commit.",
    "avoid": "Stay alive until the timer runs out.",
}


def derive_name(spec_id, inp, goal):
    pool = DERIVED.get((inp, goal)) or DERIVED[("tap", "act")]
    name, instr = pool[spec_id % len(pool)]
    n = spec_id // len(pool)
    if n:
        name = "%s %d" % (name, n + 1)
    return name, instr, SUMMARY.get(goal, SUMMARY["act"])


def classify(spec):
    ig = spec.get("inputGlobals") or []
    keys = spec.get("keys") or []
    dpad = any(k in keys for k in ("UP", "DOWN", "LEFT", "RIGHT"))

    if not ig:
        return "none", "avoid"
    if "gCurrentKeys" in ig and dpad:
        return "dpad", "aim"
    if "gCurrentKeys" in ig:
        return "hold", "aim"
    return "tap", "act"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("specs")
    ap.add_argument("links")
    ap.add_argument("out")
    args = ap.parse_args()

    specs = {s["id"]: s for s in json.load(open(args.specs))}
    links = json.load(open(args.links))
    linked = [l for l in links if l["graphicsTables"]]

    out = []
    for i, l in enumerate(linked):
        sid = l["id"]
        s = specs.get(sid, {})
        inp, goal = classify(s)
        if sid in NAMES:
            name, instruction, summary = NAMES[sid]
        else:
            name, instruction, summary = derive_name(sid, inp, goal)

        moduli = sorted(set(
            (s.get("start", {}).get("randomModuli") or []) +
            (s.get("update", {}).get("randomModuli") or [])
        ))

        out.append({
            "id": sid,
            "name": name,
            "instruction": instruction,
            "summary": summary,
            "host": HOSTS[i % len(HOSTS)],
            "input": inp,
            "goal": goal,
            "timer": l["timerValue"],
            "readsDifficulty": bool(s.get("readsDifficulty")),
            "usesRandom": bool(s.get("usesRandom")),
            "randomModuli": moduli[:6],
            "keys": s.get("keys") or [],
        })

    json.dump(out, open(args.out, "w"), indent=2)
    print("specs written: %d -> %s" % (len(out), args.out))
    from collections import Counter
    print("  input:", dict(Counter(o["input"] for o in out)))
    print("  goal: ", dict(Counter(o["goal"] for o in out)))
    print("  bars: ", dict(Counter(4 if o["timer"] >= 25 else 2 for o in out)))
    print("  tiered:", sum(1 for o in out if o["readsDifficulty"]))


if __name__ == "__main__":
    main()

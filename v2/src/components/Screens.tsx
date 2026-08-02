import React from "react";
import type { EngineSnapshot } from "../engine/types";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** sharp attack, decays over the beat — everything pulses on the metronome */
const beatPop = (phase: number, amt = 0.12) => 1 + Math.max(0, 1 - phase * 3.2) * amt;

/* ================================================================== */
/*  4:3 Stage                                                          */
/* ================================================================== */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-screen h-screen bg-[#0a0710] flex items-center justify-center overflow-hidden">
    <div
      className="relative overflow-hidden rounded-lg shadow-[0_0_80px_rgba(120,60,255,0.25)]"
      style={{
        aspectRatio: "4 / 3",
        width: "min(97vw, calc(94vh * 4 / 3))",
        containerType: "inline-size",
        background: "#151027",
      }}
    >
      {children}
    </div>
  </div>
);

/* ==================================================================
 *  [REMOVED in v2] RhythmHUD — the "♩=BPM · BAR n · 4/4" readout that
 *  used to sit in the bottom-left.
 *
 *  It was a side effect of v1's prompt over-indexing on rhythm: the engine
 *  narrating its own metronome at the player. The rhythm should be FELT —
 *  through the beat-pulsing ceiling light, the door timing, the bomb fuse
 *  and the audio click track — not read off a number.
 *
 *  Deleting it also removes the only place the bar counter was surfaced,
 *  which was the other half of the same problem.
 * ================================================================== */

/* ================================================================== */
/*  Microgame layer: letterboxed console with per-game colors          */
/* ================================================================== */
export const MicrogameLayer: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  const mg = snap.mg;
  if (!mg) return null;
  const pal = mg.def.palette;
  const t = snap.beatClock - mg.startBeat;
  const remaining = clamp(Math.ceil(mg.endBeats - t), 0, mg.endBeats);

  return (
    <div className="absolute inset-0 z-10" style={{ background: pal.outer }}>
      {/* subtle beat pulse in the letterbox border */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 55%, rgba(255,255,255,${0.06 * beatPop(snap.beatPhase, 1) - 0.06}) 100%)`,
        }}
      />
      {/* the console screen */}
      <div
        data-gamescreen
        className="absolute overflow-hidden rounded-[2cqw]"
        style={{
          left: "11%",
          top: "8.5%",
          width: "78%",
          height: "78%",
          background: pal.screen,
          containerType: "inline-size",
          boxShadow: `0 0 0 1.3cqw ${pal.frame}, 0 1cqw 3cqw rgba(0,0,0,0.5)`,
        }}
      >
        <mg.def.View
          s={mg.s}
          v={{
            t,
            beat: Math.floor(t),
            beatPhase: snap.beatPhase,
            outcome: mg.outcome,
            lengthBeats: mg.lengthBeats,
            endBeats: mg.endBeats,
            control: t >= 0 && t < mg.endBeats - 1,
          }}
        />
      </div>

      {/* beat-bomb timer: one segment per remaining beat */}
      <div
        className="absolute z-20 flex items-center gap-[0.7cqw]"
        style={{ left: "50%", bottom: "2.2%", transform: "translateX(-50%)" }}
      >
        <div
          style={{
            fontSize: "3.6cqw",
            transform: `scale(${beatPop(snap.beatPhase, remaining <= 2 ? 0.45 : 0.2)})`,
          }}
        >
          💣
        </div>
        {Array.from({ length: mg.endBeats }).map((_, i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{
              width: "2cqw",
              height: "1.3cqw",
              background:
                i < remaining
                  ? remaining <= 2
                    ? "#ff4d6d"
                    : pal.frame
                  : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
      {/* [v2] The "FRAMERULE!" badge and the "4-BAR GAME" label are gone.
          Early-exit quantisation is a scheduler property, not a player-facing
          concept — in the original it is simply how `rest` divides into
          `deltaTime`, and the player is never told. The mechanic still runs
          (see useEngine.ts); it just stopped narrating itself. The bomb fuse
          above already communicates remaining time, which is all the player
          ever needed. */}
    </div>
  );
};

/* ================================================================== */
/*  Instruction — slams in on the final interlude beat                 */
/* ================================================================== */
export const Instruction: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  if (!snap.instruction || !snap.mg) return null;
  const age = snap.instructionAge;

  /* [v2 TIMING FIX — reported issue #2: "instruction text lingers too long"]
   *
   * v1: full opacity until age 2.4, fading out over 0.6 beats, ending at 3.0.
   * The card was therefore still solid ~1.4 beats INTO play, sitting on top of
   * the thing you were meant to be reacting to. At 118bpm that is ~700ms of
   * the ~4s you get.
   *
   * v2: the card is a stinger, not a caption. It slams in, holds through the
   * door-open beat, then clears within a quarter-beat of control starting.
   *
   *   age  0.00 -> 0.18   punch-in scale 2.2 -> 1.0
   *   age  0.18 -> 0.85   held, breathing on the beat
   *   age  0.85 -> 1.10   fade + lift away
   *
   * Control begins at age 1.0 (the microgame spawns one beat early and `t`
   * runs -1 -> 0 while the doors open). So the text is at ~40% opacity the
   * instant you get control and fully gone a quarter-beat later — read during
   * the door-open beat, out of your way for the part that's scored.
   */
  const IN_END = 0.18;
  const HOLD_END = 0.85;
  const OUT_END = 1.1;

  const inScale =
    age < IN_END ? 2.2 - (age / IN_END) * 1.2 : beatPop(snap.beatPhase, 0.1);

  const opacity =
    age > HOLD_END ? clamp(1 - (age - HOLD_END) / (OUT_END - HOLD_END), 0, 1) : 1;

  if (opacity <= 0) return null;

  // lift + shrink slightly as it clears, so it reads as "out of the way"
  const lift = age > HOLD_END ? (age - HOLD_END) / (OUT_END - HOLD_END) : 0;
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div
        className="font-black tracking-wide"
        style={{
          fontSize: "13cqw",
          color: snap.mg.def.palette.text,
          WebkitTextStroke: "0.7cqw #14082b",
          textShadow: "0 1cqw 0 rgba(0,0,0,0.45)",
          transform: `translateY(${-lift * 14}cqw) scale(${inScale * (1 - lift * 0.25)}) rotate(-3deg)`,
          opacity,
        }}
      >
        {snap.instruction}
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Elevator doors                                                     */
/* ================================================================== */
const DoorPanel: React.FC<{ side: "l" | "r"; open: number }> = ({ side, open }) => (
  <div
    className="absolute top-0 h-full"
    style={{
      width: "50.5%",
      [side === "l" ? "left" : "right"]: 0,
      transform: `translateX(${side === "l" ? -open * 102 : open * 102}%)`,
      background:
        side === "l"
          ? "linear-gradient(90deg, #241a45 0%, #352a5e 80%, #4b3f7d 97%, #8f7ff0 100%)"
          : "linear-gradient(270deg, #241a45 0%, #352a5e 80%, #4b3f7d 97%, #8f7ff0 100%)",
      boxShadow: "inset 0 0 6cqw rgba(0,0,0,0.6)",
    }}
  >
    {/* rivets */}
    {[15, 50, 85].map((y) =>
      [20, 70].map((x) => (
        <div
          key={`${x}${y}`}
          className="absolute rounded-full bg-[#8f7ff0]/40"
          style={{ left: `${x}%`, top: `${y}%`, width: "1.4cqw", height: "1.4cqw" }}
        />
      )),
    )}
  </div>
);

export const Doors: React.FC<{ open: number }> = ({ open }) =>
  open >= 1 ? null : (
    <div className="absolute inset-0 z-40 pointer-events-none">
      <DoorPanel side="l" open={open} />
      <DoorPanel side="r" open={open} />
    </div>
  );

/* ================================================================== */
/*  Interlude (elevator interior UI, drawn over the closed doors)      */
/* ================================================================== */
export const InterludeUI: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  const p = snap.phase;
  if (p.kind !== "interlude") return null;
  const local = snap.beatClock - p.startBeat;
  const opacity = clamp(1 - snap.doorOpen * 2.2, 0, 1);
  const bar = Math.floor(local / 4); // 0 = result, 1 = score, 2-3 = speed up
  const pop = beatPop(snap.beatPhase, 0.14);

  const face =
    p.result === "start" ? "😀" : p.result === "win" ? (snap.barBeat % 2 ? "😄" : "😆") : "😖";
  const caption =
    p.result === "start"
      ? "HERE WE GO!"
      : p.result === "win"
        ? "GOT IT!"
        : p.toGameOver
          ? "OH NO..."
          : "OUCH!";

  const speedBars = p.speedUp && bar >= 2;
  const scorePop = beatPop(clamp(snap.beatClock - snap.scorePopAt, 0, 1), 0.6);

  return (
    <div className="absolute inset-0 z-50 pointer-events-none" style={{ opacity }}>
      {/* ceiling light pulsing on the beat */}
      <div
        className="absolute rounded-b-full"
        style={{
          left: "42%",
          top: 0,
          width: "16%",
          height: "3.5%",
          background: `rgba(255, 230, 120, ${0.35 + 0.55 * Math.max(0, 1 - snap.beatPhase * 3)})`,
          boxShadow: `0 0 5cqw rgba(255,230,120,${0.3 + 0.5 * Math.max(0, 1 - snap.beatPhase * 3)})`,
        }}
      />

      {speedBars ? (
        /* ---------- SPEED UP! (2 extra bars) ---------- */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="font-black"
            style={{
              fontSize: "12cqw",
              color: snap.barBeat % 2 ? "#ffd60a" : "#ff4d6d",
              WebkitTextStroke: "0.7cqw #14082b",
              transform: `scale(${beatPop(snap.beatPhase, 0.35)}) rotate(${snap.barBeat % 2 ? -4 : 4}deg)`,
            }}
          >
            SPEED UP!!
          </div>
          <div
            className="font-black text-white mt-[1cqw] tabular-nums"
            style={{ fontSize: "4.5cqw", transform: `scale(${pop})` }}
          >
            ♩ = {Math.round(snap.bpm)} BPM
          </div>
          <div style={{ fontSize: "8cqw", transform: `scale(${pop}) scaleX(${snap.barBeat % 2 ? -1 : 1})` }}>
            🏃💨
          </div>
        </div>
      ) : bar === 0 ? (
        /* ---------- Bar 1: RESULT ---------- */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            style={{
              fontSize: "17cqw",
              transform: `scale(${beatPop(snap.beatPhase, 0.18)}) rotate(${p.result === "lose" ? bobble(snap.beatClock) : 0}deg)`,
            }}
          >
            {face}
          </div>
          <div
            className="font-black tracking-widest"
            style={{
              fontSize: "5cqw",
              color: p.result === "lose" ? "#ff4d6d" : "#ffd60a",
              WebkitTextStroke: "0.35cqw #14082b",
              transform: `scale(${pop})`,
            }}
          >
            {caption}
          </div>
          {p.lostLife && (
            <div
              style={{
                fontSize: "7cqw",
                opacity: snap.beatPhase < 0.5 ? 1 : 0.25,
                marginTop: "1cqw",
              }}
            >
              💔
            </div>
          )}
        </div>
      ) : (
        /* ---------- Bar 2: SCORE & PREP ---------- */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-black text-white/60 tracking-widest" style={{ fontSize: "3cqw" }}>
            SCORE
          </div>
          <div
            className="font-black text-white tabular-nums"
            style={{
              fontSize: "16cqw",
              WebkitTextStroke: "0.6cqw #14082b",
              transform: `scale(${scorePop})`,
              color: "#ffd60a",
            }}
          >
            {snap.displayScore}
          </div>
          <div style={{ fontSize: "6cqw", transform: `scale(${pop})` }}>{face}</div>
        </div>
      )}

      {/* hearts */}
      <div
        className="absolute flex gap-[1cqw]"
        style={{ left: "50%", bottom: "6%", transform: "translateX(-50%)" }}
      >
        {Array.from({ length: snap.maxLives }).map((_, i) => {
          const lost = i >= snap.lives;
          const justLost = p.lostLife && i === snap.lives && bar === 0;
          return (
            <span
              key={i}
              style={{
                fontSize: "4.5cqw",
                transform: `scale(${lost ? 0.85 : pop})`,
                opacity: justLost ? (snap.beatPhase < 0.5 ? 1 : 0.2) : 1,
              }}
            >
              {justLost ? "💔" : lost ? "🖤" : "❤️"}
            </span>
          );
        })}
      </div>

      {/* floor indicator = games played */}
      <div
        className="absolute font-black text-[#8f7ff0] tabular-nums"
        style={{ right: "3%", top: "3%", fontSize: "3cqw" }}
      >
        FLOOR {snap.gamesPlayed + 1}
      </div>
    </div>
  );
};

const bobble = (clock: number) => Math.sin(clock * Math.PI * 2) * 6;

/* ================================================================== */
/*  Title & Game Over                                                  */
/* ================================================================== */
export const TitleScreen: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  const p = snap.phase;
  if (p.kind !== "title") return null;
  const armed = p.startAtBeat !== null;
  const pop = beatPop(snap.beatPhase, 0.15);
  return (
    <div className="absolute inset-0 z-[80] bg-gradient-to-b from-[#2b1d4f] to-[#14082b] flex flex-col items-center justify-center">
      <div
        className="font-black"
        style={{
          fontSize: "11cqw",
          color: "#ffd60a",
          WebkitTextStroke: "0.8cqw #14082b",
          textShadow: "0 1.2cqw 0 #f72585",
          transform: `scale(${pop}) rotate(-2deg)`,
        }}
      >
        MICRO⚡MANIA
      </div>
      <div className="font-bold text-[#8f7ff0] mt-[1cqw]" style={{ fontSize: "2.6cqw" }}>
        a rhythm-locked microgame engine · everything runs on the beat
      </div>
      <div className="flex items-center gap-[2cqw] mt-[4cqw] text-white/85 font-bold" style={{ fontSize: "2.4cqw" }}>
        <span className="bg-white/10 rounded-lg px-[1.5cqw] py-[0.6cqw]">⬅️ ⬆️ ⬇️ ➡️ move</span>
        <span className="bg-white/10 rounded-lg px-[1.5cqw] py-[0.6cqw]">SPACE action</span>
      </div>
      <div
        className="font-black mt-[4cqw]"
        style={{
          fontSize: "4.5cqw",
          color: armed ? "#9ef01a" : "#ffffff",
          opacity: snap.beatPhase < 0.6 ? 1 : 0.35,
        }}
      >
        {armed ? "STARTING ON THE NEXT BAR…" : "PRESS SPACE"}
      </div>
      {snap.best > 0 && (
        <div className="font-bold text-white/50 mt-[2cqw]" style={{ fontSize: "2.2cqw" }}>
          BEST SCORE: {snap.best}
        </div>
      )}
    </div>
  );
};

export const GameOverScreen: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  const p = snap.phase;
  if (p.kind !== "gameover") return null;
  const armed = p.restartAtBeat !== null;
  return (
    <div className="absolute inset-0 z-[80] bg-gradient-to-b from-[#1a0b2e] to-[#000000] flex flex-col items-center justify-center">
      <div style={{ fontSize: "12cqw", transform: `scale(${beatPop(snap.beatPhase, 0.1)})` }}>
        😵
      </div>
      <div
        className="font-black"
        style={{
          fontSize: "9cqw",
          color: "#ff4d6d",
          WebkitTextStroke: "0.7cqw #14082b",
          transform: `rotate(-2deg) scale(${beatPop(snap.beatPhase, 0.08)})`,
        }}
      >
        GAME OVER
      </div>
      <div className="font-black text-white mt-[2cqw] tabular-nums" style={{ fontSize: "4cqw" }}>
        SCORE {snap.score} · BEST {snap.best}
      </div>
      <div
        className="font-black mt-[3.5cqw]"
        style={{
          fontSize: "3.6cqw",
          color: armed ? "#9ef01a" : "#ffffff",
          opacity: snap.beatPhase < 0.6 ? 1 : 0.35,
        }}
      >
        {armed ? "RESTARTING ON THE NEXT BAR…" : "PRESS SPACE TO RETRY"}
      </div>
    </div>
  );
};

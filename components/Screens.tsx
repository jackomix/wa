import React from "react";
import type { EngineSnapshot } from "../engine/types";
import { STAGES } from "../microgames";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** sharp attack, decays over the beat — everything pulses on the metronome */
const beatPop = (phase: number, amt = 0.12) => 1 + Math.max(0, 1 - phase * 3.2) * amt;
const bobble = (clock: number) => Math.sin(clock * Math.PI * 2) * 6;

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

/* ================================================================== */
/*  Rhythm HUD — the metronome made visible (always on, never pauses)  */
/* ================================================================== */
export const RhythmHUD: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => (
  <div
    className="absolute z-[70] flex items-center gap-[0.8cqw] pointer-events-none"
    style={{ left: "1.5cqw", bottom: "1.2cqw" }}
  >
    <div
      className="font-black text-white/70 tabular-nums"
      style={{ fontSize: "2.2cqw", transform: `scale(${beatPop(snap.beatPhase, 0.15)})` }}
    >
      ♩={Math.round(snap.bpm)}
    </div>
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        className="rounded-full"
        style={{
          width: "1.4cqw",
          height: "1.4cqw",
          background:
            i === snap.barBeat
              ? i === 0
                ? "#ffd60a"
                : "#f72585"
              : "rgba(255,255,255,0.18)",
          transform: i === snap.barBeat ? `scale(${beatPop(snap.beatPhase, 0.9)})` : "scale(1)",
        }}
      />
    ))}
    <div className="text-white/40 font-bold" style={{ fontSize: "1.7cqw" }}>
      BAR {Math.floor(snap.beatClock / 4) + 1} · 4/4
    </div>
  </div>
);

/* ================================================================== */
/*  Microgame layer: letterboxed console with per-game colors          */
/* ================================================================== */
export const MicrogameLayer: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  const mg = snap.mg;
  if (!mg) return null;
  const pal = mg.def.palette;
  const t = snap.beatClock - mg.startBeat;
  const remaining = clamp(Math.ceil(mg.endBeats - t), 0, mg.endBeats);
  const framerule = mg.endBeats < mg.lengthBeats;

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
        {framerule && (
          <div
            className="font-black tracking-widest"
            style={{ fontSize: "1.8cqw", color: pal.frame }}
          >
            FRAMERULE!
          </div>
        )}
      </div>

      {mg.lengthBeats === 16 && (
        <div
          className="absolute font-black text-white/50 tracking-widest"
          style={{ right: "2%", top: "2%", fontSize: "2cqw" }}
        >
          4-BAR GAME
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Instruction — slams in on the final interlude beat                 */
/* ================================================================== */
export const Instruction: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  if (!snap.instruction || !snap.mg) return null;
  const age = snap.instructionAge;
  const inScale = age < 0.25 ? 2.2 - (age / 0.25) * 1.2 : beatPop(snap.beatPhase, 0.1);
  const opacity = age > 2.4 ? clamp(1 - (age - 2.4) / 0.6, 0, 1) : 1;
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div
        className="font-black tracking-wide"
        style={{
          fontSize: "13cqw",
          color: snap.mg.def.palette.text,
          WebkitTextStroke: "0.7cqw #14082b",
          textShadow: "0 1cqw 0 rgba(0,0,0,0.45)",
          transform: `scale(${inScale}) rotate(-3deg)`,
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
/*  Character-Specific Interlude Scenes                                */
/*  Based on decompilation data from the original GBA game:            */
/*  - Wario: Boombox/radio interlude (STAGE_INTRODUCTION)             */
/*  - Jimmy T.: Elevator interlude (STAGE_JIMMY)                      */
/*  - 9-Volt: TV screen interlude (STAGE_9_VOLT)                      */
/*  - Dribble & Spitz: UFO/space interlude (STAGE_DRIBBLE)            */
/*  - Mona: TV show/stage interlude (STAGE_MONA)                      */
/*  - Dr. Crygor: Laboratory interlude (STAGE_DR_CRYGOR)              */
/*  - Orbulon: UFO cockpit interlude (STAGE_ORBULON)                  */
/*  - Kat & Ana: Crystal/dojo interlude (STAGE_KAT)                   */
/*  - Wario (Anything Goes): Boombox interlude (STAGE_WARIO)          */
/* ================================================================== */

/* Wario's Boombox */
const WarioBoombox: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  const warioFace = snap.phase.kind === 'interlude' && snap.phase.result === 'win'
    ? '😄' : snap.phase.kind === 'interlude' && snap.phase.result === 'lose'
    ? '😖' : '😈';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="relative" style={{ transform: `scale(${pop})` }}>
        <div className="bg-[#2a2a2a] rounded-xl border-4 border-[#444] flex flex-col items-center"
          style={{ width: '40cqw', height: '28cqw', padding: '2cqw' }}>
          <div className="flex gap-[4cqw] w-full justify-center">
            <div className="rounded-full bg-[#111] border-2 border-[#555] flex items-center justify-center"
              style={{ width: '12cqw', height: '12cqw' }}>
              <div className="rounded-full bg-[#1a1a1a] border border-[#333]" style={{ width: '6cqw', height: '6cqw' }} />
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="font-black text-[#eab308]" style={{ fontSize: '3cqw' }}>♩={Math.round(snap.bpm)}</div>
              <div className="flex gap-[0.5cqw] mt-[0.5cqw]">
                {[0,1,2,3].map(i => (
                  <div key={i} className="rounded-full" style={{
                    width: '1.5cqw', height: '1.5cqw',
                    background: i === snap.barBeat ? '#eab308' : '#333',
                    transform: i === snap.barBeat ? `scale(${beatPop(snap.beatPhase, 0.5)})` : 'scale(1)',
                  }} />
                ))}
              </div>
            </div>
            <div className="rounded-full bg-[#111] border-2 border-[#555] flex items-center justify-center"
              style={{ width: '12cqw', height: '12cqw' }}>
              <div className="rounded-full bg-[#1a1a1a] border border-[#333]" style={{ width: '6cqw', height: '6cqw' }} />
            </div>
          </div>
          <div className="bg-[#111] rounded mt-[1cqw]" style={{ width: '20cqw', height: '2cqw' }} />
          <div className="flex gap-[0.3cqw] mt-[1cqw]">
            {Array.from({ length: 8 }).map((_, i) => {
              const h = 0.5 + Math.random() * 2;
              return <div key={i} className="rounded-sm" style={{
                width: '1cqw', height: `${h}cqw`,
                background: h > 1.5 ? '#ff4d6d' : h > 1 ? '#ffd60a' : '#22c55e',
                transform: `scaleY(${beatPop(snap.beatPhase, 0.3)})`,
              }} />;
            })}
          </div>
        </div>
      </div>
      <div style={{ fontSize: '14cqw', transform: `scale(${pop}) rotate(${bobble(snap.beatClock)}deg)` }}>{warioFace}</div>
    </div>
  );
};

/* Jimmy T.'s Elevator */
const JimmyElevator: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  const floor = snap.gamesPlayed + 1;
  const doorOpen = bar === 0 ? 0 : bar === 1 ? 0.3 : 0.6;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="relative bg-[#2a1a3f] rounded-lg border-2 border-[#8f7ff0]" style={{ width: '50cqw', height: '60cqw' }}>
        <div className="absolute font-black text-[#8f7ff0] tabular-nums" style={{ top: '2cqw', right: '3cqw', fontSize: '4cqw' }}>{floor}F</div>
        <div className="absolute inset-0 flex overflow-hidden">
          <div className="bg-gradient-to-r from-[#4a3a6f] to-[#3a2a5f] h-full transition-transform" style={{ width: '50%', transform: `translateX(-${doorOpen * 100}%)` }} />
          <div className="bg-gradient-to-l from-[#4a3a6f] to-[#3a2a5f] h-full transition-transform" style={{ width: '50%', transform: `translateX(${doorOpen * 100}%)` }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: -1 }}>
          <div style={{ fontSize: '16cqw', transform: `scale(${pop})` }}>
            {snap.phase.kind === 'interlude' && snap.phase.result === 'win' ? '😎' : '🤩'}
          </div>
        </div>
        <div className="absolute flex flex-col gap-[0.5cqw]" style={{ right: '3cqw', top: '8cqw' }}>
          {[1,2,3,4].map(f => (
            <div key={f} className="rounded-full" style={{
              width: '2.5cqw', height: '2.5cqw',
              background: f === floor ? '#ffd60a' : '#333',
              border: f === floor ? '2px solid #fff' : '2px solid #555',
            }} />
          ))}
        </div>
      </div>
      <div className="font-black text-[#3b82f6] mt-[1cqw]" style={{ fontSize: '3cqw', transform: `scale(${pop})` }}>♩={Math.round(snap.bpm)} BPM</div>
    </div>
  );
};

/* 9-Volt's TV */
const NineVoltTV: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <div className="relative" style={{ transform: `scale(${pop})` }}>
      <div className="bg-[#1a1a2e] rounded-lg border-4 border-[#ef4444] overflow-hidden" style={{ width: '50cqw', height: '36cqw' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)' }} />
        <div className="flex items-center justify-center h-full">
          <div style={{ fontSize: '18cqw', transform: `rotate(${bobble(snap.beatClock)}deg)` }}>
            {snap.phase.kind === 'interlude' && snap.phase.result === 'win' ? '🎮' : '🕹️'}
          </div>
        </div>
        <div className="absolute font-black text-[#fbbf24]" style={{ top: '2cqw', left: '3cqw', fontSize: '3cqw' }}>SCORE: {snap.displayScore}</div>
        <div className="absolute font-black text-[#ef4444]" style={{ top: '2cqw', right: '3cqw', fontSize: '3cqw' }}>♩={Math.round(snap.bpm)}</div>
      </div>
      <div className="flex justify-center gap-[8cqw]">
        <div className="bg-[#ef4444] rounded" style={{ width: '4cqw', height: '3cqw' }} />
        <div className="bg-[#ef4444] rounded" style={{ width: '4cqw', height: '3cqw' }} />
      </div>
    </div>
    <div style={{ fontSize: '10cqw', transform: `scale(${pop})` }}>🧒</div>
  </div>
);

/* Dribble & Spitz's UFO */
const DribbleUFO: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <div className="absolute inset-0 bg-[#0a0a1a]">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute rounded-full bg-white" style={{
          width: `${0.3 + Math.random() * 0.5}cqw`, height: `${0.3 + Math.random() * 0.5}cqw`,
          left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
          opacity: 0.3 + Math.random() * 0.7,
          transform: `scale(${beatPop(snap.beatPhase, 0.3)})`,
        }} />
      ))}
    </div>
    <div className="relative" style={{ transform: `scale(${pop}) translateY(${bobble(snap.beatClock) * 2}cqw)` }}>
      <div className="bg-[#8b5cf6] rounded-full" style={{ width: '30cqw', height: '8cqw' }} />
      <div className="absolute bg-[#c4b5fd] rounded-full" style={{ left: '25%', top: '-4cqw', width: '50%', height: '10cqw' }} />
      <div className="absolute" style={{ left: '20%', top: '8cqw', width: '60%', height: '20cqw', background: 'linear-gradient(180deg, rgba(139,92,246,0.4) 0%, transparent 100%)', clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)' }} />
    </div>
    <div className="flex gap-[4cqw] mt-[2cqw]" style={{ transform: `scale(${pop})` }}>
      <span style={{ fontSize: '10cqw' }}>🐱</span>
      <span style={{ fontSize: '10cqw' }}>🟡</span>
    </div>
    <div className="font-black text-[#8b5cf6] mt-[1cqw]" style={{ fontSize: '3cqw' }}>♩={Math.round(snap.bpm)} BPM</div>
  </div>
);

/* Mona's Stage */
const MonaStage: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #7c2d12 0%, #9a3412 50%, #7c2d12 100%)' }}>
      <div className="absolute left-0 top-0 bottom-0 w-[15%]" style={{ background: 'linear-gradient(90deg, #5c1d02, #7c2d12, #5c1d02)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-[15%]" style={{ background: 'linear-gradient(270deg, #5c1d02, #7c2d12, #5c1d02)' }} />
    </div>
    <div className="absolute" style={{ width: '40cqw', height: '40cqw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,200,100,0.3) 0%, transparent 70%)', top: '10%', left: '30%' }} />
    <div className="relative" style={{ fontSize: '16cqw', transform: `scale(${pop})` }}>
      {snap.phase.kind === 'interlude' && snap.phase.result === 'win' ? '💃' : '😟'}
    </div>
    <div className="font-black text-[#f97316] mt-[1cqw]" style={{ fontSize: '3cqw' }}>♩={Math.round(snap.bpm)} BPM</div>
  </div>
);

/* Dr. Crygor's Lab */
const CrygorLab: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <div className="absolute inset-0 bg-[#0a1628]">
      <div className="absolute bg-[#22c55e]/20 rounded-lg border border-[#22c55e]/40" style={{ left: '5%', top: '10%', width: '20cqw', height: '30cqw' }}>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#22c55e]/30 rounded-b-lg" style={{ width: '60%', height: `${40 + Math.sin(snap.beatClock * 2) * 10}%` }} />
      </div>
      <div className="absolute bg-[#22c55e]/20 rounded-lg border border-[#22c55e]/40" style={{ right: '5%', top: '10%', width: '20cqw', height: '30cqw' }}>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#a855f7]/30 rounded-b-lg" style={{ width: '40%', height: `${50 + Math.cos(snap.beatClock * 2) * 15}%` }} />
      </div>
    </div>
    <div className="relative" style={{ fontSize: '16cqw', transform: `scale(${pop})` }}>
      {snap.phase.kind === 'interlude' && snap.phase.result === 'win' ? '🧑‍🔬' : '😰'}
    </div>
    <div className="font-black text-[#22c55e] mt-[1cqw]" style={{ fontSize: '3cqw' }}>♩={Math.round(snap.bpm)} BPM</div>
  </div>
);

/* Orbulon's Cockpit */
const OrbulonCockpit: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <div className="absolute inset-0 bg-[#0c4a6e]">
      <div className="absolute rounded-full" style={{ top: '5%', left: '10%', width: '80%', height: '50%', background: 'radial-gradient(ellipse, #0a0a2a 0%, #0c4a6e 100%)', border: '3px solid #06b6d4' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{ width: '0.5cqw', height: '0.5cqw', left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0.5 + Math.random() * 0.5 }} />
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-[#0a3a5a] border-t-2 border-[#06b6d4]" style={{ height: '35%' }}>
        <div className="flex gap-[1cqw] p-[2cqw]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-full" style={{ width: '3cqw', height: '3cqw', background: i === snap.barBeat ? '#06b6d4' : '#1a4a6a', boxShadow: i === snap.barBeat ? '0 0 1cqw #06b6d4' : 'none', transform: i === snap.barBeat ? `scale(${beatPop(snap.beatPhase, 0.3)})` : 'scale(1)' }} />
          ))}
        </div>
      </div>
    </div>
    <div className="relative" style={{ fontSize: '14cqw', transform: `scale(${pop})`, zIndex: 10 }}>👽</div>
  </div>
);

/* Kat & Ana's Dojo */
const KatAnaDojo: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #064e3b 0%, #0a3a2e 50%, #064e3b 100%)' }}>
      {[20, 40, 60, 80].map((x, i) => (
        <div key={i} className="absolute" style={{ left: `${x}%`, top: 0, bottom: 0, width: '2cqw', background: 'linear-gradient(90deg, #4a7c59, #2d5a3a, #4a7c59)' }} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="absolute" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 60}%`, fontSize: '2cqw', opacity: 0.7, transform: `rotate(${Math.random() * 360}deg) translateY(${bobble(snap.beatClock + i) * 2}cqw)` }}>🌸</div>
      ))}
    </div>
    <div className="relative flex gap-[2cqw]" style={{ transform: `scale(${pop})` }}>
      <span style={{ fontSize: '14cqw' }}>👧</span>
      <span style={{ fontSize: '14cqw' }}>👧</span>
    </div>
    <div className="font-black text-[#10b981] mt-[1cqw]" style={{ fontSize: '3cqw' }}>♩={Math.round(snap.bpm)} BPM</div>
  </div>
);

/* ================================================================== */
/*  Interlude (character-specific interlude UI)                        */
/* ================================================================== */
export const InterludeUI: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  const p = snap.phase;
  if (p.kind !== "interlude") return null;
  const local = snap.beatClock - p.startBeat;
  const opacity = clamp(1 - snap.doorOpen * 2.2, 0, 1);
  const bar = Math.floor(local / 4);
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
  
  // Determine which character-specific interlude to show
  const stageId = snap.currentStage || 'intro';
  const stage = STAGES[stageId];
  const interludeStyle = stage?.interludeStyle || 'boombox';

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
        /* ---------- Bar 1: RESULT with character-specific interlude ---------- */
        <>
          {/* Character-specific scene behind the result */}
          <div className="absolute inset-0 opacity-20">
            {interludeStyle === 'boombox' && <WarioBoombox snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'elevator' && <JimmyElevator snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'tv' && <NineVoltTV snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'ufo' && <DribbleUFO snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'cat' && <MonaStage snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'lab' && <CrygorLab snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'crystal' && <KatAnaDojo snap={snap} bar={bar} pop={pop} />}
          </div>
          {/* Result overlay */}
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
        </>
      ) : (
        /* ---------- Bar 2: SCORE & PREP with character scene ---------- */
        <>
          <div className="absolute inset-0 opacity-15">
            {interludeStyle === 'boombox' && <WarioBoombox snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'elevator' && <JimmyElevator snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'tv' && <NineVoltTV snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'ufo' && <DribbleUFO snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'cat' && <MonaStage snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'lab' && <CrygorLab snap={snap} bar={bar} pop={pop} />}
            {interludeStyle === 'crystal' && <KatAnaDojo snap={snap} bar={bar} pop={pop} />}
          </div>
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
        </>
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

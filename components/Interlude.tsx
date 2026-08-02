import React from "react";
import type { EngineSnapshot } from "../engine/types";
import { STAGES } from "../microgames";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const beatPop = (phase: number, amt = 0.12) => 1 + Math.max(0, 1 - phase * 3.2) * amt;
const bobble = (clock: number) => Math.sin(clock * Math.PI * 2) * 6;

/* ================================================================== */
/*  Character-Specific Interlude Scenes                                */
/*  Based on decompilation data from the original GBA game:            */
/*  - Wario: Boombox/radio interlude (STAGE_INTRODUCTION)             */
/*  - Jimmy T.: Elevator interlude (STAGE_JIMMY)                      */
/*  - 9-Volt: TV screen interlude (STAGE_9_VOLT)                      */
/*  - Dribble & Spitz: UFO/space interlude (STAGE_DRIBBLE)            */
/*  - Mona: TV show interlude (STAGE_MONA)                            */
/*  - Dr. Crygor: Laboratory interlude (STAGE_DR_CRYGOR)              */
/*  - Orbulon: UFO cockpit interlude (STAGE_ORBULON)                  */
/*  - Kat & Ana: Crystal/dojo interlude (STAGE_KAT)                   */
/*  - Wario (Anything Goes): Boombox interlude (STAGE_WARIO)          */
/* ================================================================== */

/* Wario's Boombox Interlude */
const WarioBoombox: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  const warioFace = snap.phase.kind === 'interlude' && snap.phase.result === 'win'
    ? '😄' : snap.phase.kind === 'interlude' && snap.phase.result === 'lose'
    ? '😖' : '😈';
  
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* Boombox */}
      <div className="relative" style={{ transform: `scale(${pop})` }}>
        <div className="bg-[#2a2a2a] rounded-xl border-4 border-[#444] flex flex-col items-center"
          style={{ width: '40cqw', height: '28cqw', padding: '2cqw' }}>
          {/* Speakers */}
          <div className="flex gap-[4cqw] w-full justify-center">
            <div className="rounded-full bg-[#111] border-2 border-[#555] flex items-center justify-center"
              style={{ width: '12cqw', height: '12cqw' }}>
              <div className="rounded-full bg-[#1a1a1a] border border-[#333]"
                style={{ width: '6cqw', height: '6cqw' }} />
            </div>
            {/* Center display */}
            <div className="flex flex-col items-center justify-center">
              <div className="font-black text-[#eab308]" style={{ fontSize: '3cqw' }}>
                ♩={Math.round(snap.bpm)}
              </div>
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
              <div className="rounded-full bg-[#1a1a1a] border border-[#333]"
                style={{ width: '6cqw', height: '6cqw' }} />
            </div>
          </div>
          {/* Cassette slot */}
          <div className="bg-[#111] rounded mt-[1cqw]" style={{ width: '20cqw', height: '2cqw' }} />
          {/* VU meter bars */}
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
      {/* Wario */}
      <div style={{ fontSize: '14cqw', transform: `scale(${pop}) rotate(${bobble(snap.beatClock)}deg)` }}>
        {warioFace}
      </div>
    </div>
  );
};

/* Jimmy T.'s Elevator Interlude */
const JimmyElevator: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  const floor = snap.gamesPlayed + 1;
  const doorOpen = bar === 0 ? 0 : bar === 1 ? 0.3 : 0.6;
  
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* Elevator frame */}
      <div className="relative bg-[#2a1a3f] rounded-lg border-2 border-[#8f7ff0]"
        style={{ width: '50cqw', height: '60cqw' }}>
        {/* Floor indicator */}
        <div className="absolute font-black text-[#8f7ff0] tabular-nums"
          style={{ top: '2cqw', right: '3cqw', fontSize: '4cqw' }}>
          {floor}F
        </div>
        {/* Elevator doors */}
        <div className="absolute inset-0 flex overflow-hidden">
          <div className="bg-gradient-to-r from-[#4a3a6f] to-[#3a2a5f] h-full transition-transform"
            style={{ width: '50%', transform: `translateX(-${doorOpen * 100}%)` }} />
          <div className="bg-gradient-to-l from-[#4a3a6f] to-[#3a2a5f] h-full transition-transform"
            style={{ width: '50%', transform: `translateX(${doorOpen * 100}%)` }} />
        </div>
        {/* Jimmy inside */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: -1 }}>
          <div style={{ fontSize: '16cqw', transform: `scale(${pop})` }}>
            {snap.phase.kind === 'interlude' && snap.phase.result === 'win' ? '😎' : '🤩'}
          </div>
        </div>
        {/* Button panel */}
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
      {/* BPM display */}
      <div className="font-black text-[#3b82f6] mt-[1cqw]" style={{ fontSize: '3cqw', transform: `scale(${pop})` }}>
        ♩={Math.round(snap.bpm)} BPM
      </div>
    </div>
  );
};

/* 9-Volt's TV Screen Interlude */
const NineVoltTV: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* TV set */}
      <div className="relative" style={{ transform: `scale(${pop})` }}>
        {/* CRT screen */}
        <div className="bg-[#1a1a2e] rounded-lg border-4 border-[#ef4444] overflow-hidden"
          style={{ width: '50cqw', height: '36cqw' }}>
          {/* Scanlines */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
          }} />
          {/* Content */}
          <div className="flex items-center justify-center h-full">
            <div style={{ fontSize: '18cqw', transform: `rotate(${bobble(snap.beatClock)}deg)` }}>
              {snap.phase.kind === 'interlude' && snap.phase.result === 'win' ? '🎮' : '🕹️'}
            </div>
          </div>
          {/* Score display */}
          <div className="absolute font-black text-[#fbbf24]" style={{ top: '2cqw', left: '3cqw', fontSize: '3cqw' }}>
            SCORE: {snap.displayScore}
          </div>
          <div className="absolute font-black text-[#ef4444]" style={{ top: '2cqw', right: '3cqw', fontSize: '3cqw' }}>
            ♩={Math.round(snap.bpm)}
          </div>
        </div>
        {/* TV stand */}
        <div className="flex justify-center gap-[8cqw]">
          <div className="bg-[#ef4444] rounded" style={{ width: '4cqw', height: '3cqw' }} />
          <div className="bg-[#ef4444] rounded" style={{ width: '4cqw', height: '3cqw' }} />
        </div>
      </div>
      {/* 9-Volt */}
      <div style={{ fontSize: '10cqw', transform: `scale(${pop})` }}>🧒</div>
    </div>
  );
};

/* Dribble & Spitz's UFO Interlude */
const DribbleUFO: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* Starfield background */}
      <div className="absolute inset-0 bg-[#0a0a1a]">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: `${0.3 + Math.random() * 0.5}cqw`,
            height: `${0.3 + Math.random() * 0.5}cqw`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: 0.3 + Math.random() * 0.7,
            transform: `scale(${beatPop(snap.beatPhase, 0.3)})`,
          }} />
        ))}
      </div>
      {/* UFO */}
      <div className="relative" style={{ transform: `scale(${pop}) translateY(${bobble(snap.beatClock) * 2}cqw)` }}>
        <div className="bg-[#8b5cf6] rounded-full" style={{ width: '30cqw', height: '8cqw' }} />
        <div className="absolute bg-[#c4b5fd] rounded-full" style={{
          left: '25%', top: '-4cqw', width: '50%', height: '10cqw',
        }} />
        {/* Beam */}
        <div className="absolute" style={{
          left: '20%', top: '8cqw', width: '60%', height: '20cqw',
          background: 'linear-gradient(180deg, rgba(139,92,246,0.4) 0%, transparent 100%)',
          clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)',
        }} />
      </div>
      {/* Characters */}
      <div className="flex gap-[4cqw] mt-[2cqw]" style={{ transform: `scale(${pop})` }}>
        <span style={{ fontSize: '10cqw' }}>🐱</span>
        <span style={{ fontSize: '10cqw' }}>🟡</span>
      </div>
      <div className="font-black text-[#8b5cf6] mt-[1cqw]" style={{ fontSize: '3cqw' }}>
        ♩={Math.round(snap.bpm)} BPM
      </div>
    </div>
  );
};

/* Mona's TV Show Interlude */
const MonaTV: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* Stage curtain */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #7c2d12 0%, #9a3412 50%, #7c2d12 100%)',
      }}>
        {/* Curtain folds */}
        <div className="absolute left-0 top-0 bottom-0 w-[15%]" style={{
          background: 'linear-gradient(90deg, #5c1d02, #7c2d12, #5c1d02)',
        }} />
        <div className="absolute right-0 top-0 bottom-0 w-[15%]" style={{
          background: 'linear-gradient(270deg, #5c1d02, #7c2d12, #5c1d02)',
        }} />
      </div>
      {/* Spotlight */}
      <div className="absolute" style={{
        width: '40cqw', height: '40cqw', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,200,100,0.3) 0%, transparent 70%)',
        top: '10%', left: '30%',
      }} />
      {/* Mona */}
      <div className="relative" style={{ fontSize: '16cqw', transform: `scale(${pop})` }}>
        {snap.phase.kind === 'interlude' && snap.phase.result === 'win' ? '💃' : '😟'}
      </div>
      <div className="font-black text-[#f97316] mt-[1cqw]" style={{ fontSize: '3cqw' }}>
        ♩={Math.round(snap.bpm)} BPM
      </div>
    </div>
  );
};

/* Dr. Crygor's Laboratory Interlude */
const CrygorLab: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* Lab background */}
      <div className="absolute inset-0 bg-[#0a1628]">
        {/* Equipment */}
        <div className="absolute bg-[#22c55e]/20 rounded-lg border border-[#22c55e]/40"
          style={{ left: '5%', top: '10%', width: '20cqw', height: '30cqw' }}>
          {/* Beaker */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#22c55e]/30 rounded-b-lg"
            style={{ width: '60%', height: `${40 + Math.sin(snap.beatClock * 2) * 10}%` }} />
        </div>
        <div className="absolute bg-[#22c55e]/20 rounded-lg border border-[#22c55e]/40"
          style={{ right: '5%', top: '10%', width: '20cqw', height: '30cqw' }}>
          {/* Tube */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#a855f7]/30 rounded-b-lg"
            style={{ width: '40%', height: `${50 + Math.cos(snap.beatClock * 2) * 15}%` }} />
        </div>
      </div>
      {/* Dr. Crygor */}
      <div className="relative" style={{ fontSize: '16cqw', transform: `scale(${pop})` }}>
        {snap.phase.kind === 'interlude' && snap.phase.result === 'win' ? '🧑‍🔬' : '😰'}
      </div>
      <div className="font-black text-[#22c55e] mt-[1cqw]" style={{ fontSize: '3cqw' }}>
        ♩={Math.round(snap.bpm)} BPM
      </div>
    </div>
  );
};

/* Orbulon's UFO Cockpit Interlude */
const OrbulonCockpit: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* Cockpit dashboard */}
      <div className="absolute inset-0 bg-[#0c4a6e]">
        {/* Stars through window */}
        <div className="absolute rounded-full" style={{
          top: '5%', left: '10%', width: '80%', height: '50%',
          background: 'radial-gradient(ellipse, #0a0a2a 0%, #0c4a6e 100%)',
          border: '3px solid #06b6d4',
        }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white" style={{
              width: '0.5cqw', height: '0.5cqw',
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              opacity: 0.5 + Math.random() * 0.5,
            }} />
          ))}
        </div>
        {/* Control panel */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#0a3a5a] border-t-2 border-[#06b6d4]"
          style={{ height: '35%' }}>
          <div className="flex gap-[1cqw] p-[2cqw]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-full" style={{
                width: '3cqw', height: '3cqw',
                background: i === snap.barBeat ? '#06b6d4' : '#1a4a6a',
                boxShadow: i === snap.barBeat ? '0 0 1cqw #06b6d4' : 'none',
                transform: i === snap.barBeat ? `scale(${beatPop(snap.beatPhase, 0.3)})` : 'scale(1)',
              }} />
            ))}
          </div>
        </div>
      </div>
      {/* Orbulon */}
      <div className="relative" style={{ fontSize: '14cqw', transform: `scale(${pop})`, zIndex: 10 }}>
        👽
      </div>
    </div>
  );
};

/* Kat & Ana's Crystal/Dojo Interlude */
const KatAnaDojo: React.FC<{ snap: EngineSnapshot; bar: number; pop: number }> = ({ snap, bar, pop }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* Dojo background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #064e3b 0%, #0a3a2e 50%, #064e3b 100%)',
      }}>
        {/* Bamboo */}
        {[20, 40, 60, 80].map((x, i) => (
          <div key={i} className="absolute" style={{
            left: `${x}%`, top: 0, bottom: 0, width: '2cqw',
            background: 'linear-gradient(90deg, #4a7c59, #2d5a3a, #4a7c59)',
          }} />
        ))}
        {/* Cherry blossom petals */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="absolute" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 60}%`,
            fontSize: '2cqw', opacity: 0.7,
            transform: `rotate(${Math.random() * 360}deg) translateY(${bobble(snap.beatClock + i) * 2}cqw)`,
          }}>🌸</div>
        ))}
      </div>
      {/* Kat & Ana */}
      <div className="relative flex gap-[2cqw]" style={{ transform: `scale(${pop})` }}>
        <span style={{ fontSize: '14cqw' }}>👧</span>
        <span style={{ fontSize: '14cqw' }}>👧</span>
      </div>
      <div className="font-black text-[#10b981] mt-[1cqw]" style={{ fontSize: '3cqw' }}>
        ♩={Math.round(snap.bpm)} BPM
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Main Interlude Component                                           */
/* ================================================================== */

export const InterludeUI: React.FC<{ snap: EngineSnapshot }> = ({ snap }) => {
  const p = snap.phase;
  if (p.kind !== "interlude") return null;
  const local = snap.beatClock - p.startBeat;
  const opacity = clamp(1 - snap.doorOpen * 2.2, 0, 1);
  const bar = Math.floor(local / 4);
  const pop = beatPop(snap.beatPhase, 0.14);
  
  const face = p.result === "start" ? "😀" : p.result === "win" ? (snap.barBeat % 2 ? "😄" : "😆") : "😖";
  const caption = p.result === "start" ? "HERE WE GO!" : p.result === "win" ? "GOT IT!" : p.toGameOver ? "OH NO..." : "OUCH!";
  
  const speedBars = p.speedUp && bar >= 2;
  const scorePop = beatPop(clamp(snap.beatClock - snap.scorePopAt, 0, 1), 0.6);
  
  // Get the current stage's interlude style
  const stageId = snap.mg?.def.palette ? 'intro' : 'intro'; // Default, will be replaced
  const stage = STAGES[snap.mg?.def.id ? 'intro' : 'intro']; // Will be determined from engine state
  
  // Determine which interlude scene to show based on the current stage
  // This is determined by the engine's currentStage field
  const interludeStyle = 'boombox'; // Default, will be determined from engine
  
  return (
    <div className="absolute inset-0 z-50 pointer-events-none" style={{ opacity }}>
      {/* Ceiling light pulsing on the beat */}
      <div className="absolute rounded-b-full" style={{
        left: "42%", top: 0, width: "16%", height: "3.5%",
        background: `rgba(255, 230, 120, ${0.35 + 0.55 * Math.max(0, 1 - snap.beatPhase * 3)})`,
        boxShadow: `0 0 5cqw rgba(255,230,120,${0.3 + 0.5 * Math.max(0, 1 - snap.beatPhase * 3)})`,
      }} />

      {speedBars ? (
        /* SPEED UP! */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-black" style={{
            fontSize: "12cqw", color: snap.barBeat % 2 ? "#ffd60a" : "#ff4d6d",
            WebkitTextStroke: "0.7cqw #14082b",
            transform: `scale(${beatPop(snap.beatPhase, 0.35)}) rotate(${snap.barBeat % 2 ? -4 : 4}deg)`,
          }}>SPEED UP!!</div>
          <div className="font-black text-white mt-[1cqw] tabular-nums" style={{ fontSize: "4.5cqw", transform: `scale(${pop})` }}>
            ♩ = {Math.round(snap.bpm)} BPM
          </div>
          <div style={{ fontSize: "8cqw", transform: `scale(${pop}) scaleX(${snap.barBeat % 2 ? -1 : 1})` }}>🏃💨</div>
        </div>
      ) : bar === 0 ? (
        /* RESULT - Character-specific interlude */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div style={{ fontSize: "17cqw", transform: `scale(${beatPop(snap.beatPhase, 0.18)}) rotate(${p.result === "lose" ? bobble(snap.beatClock) : 0}deg)` }}>
            {face}
          </div>
          <div className="font-black tracking-widest" style={{
            fontSize: "5cqw", color: p.result === "lose" ? "#ff4d6d" : "#ffd60a",
            WebkitTextStroke: "0.35cqw #14082b", transform: `scale(${pop})`,
          }}>{caption}</div>
          {p.lostLife && (
            <div style={{ fontSize: "7cqw", opacity: snap.beatPhase < 0.5 ? 1 : 0.25, marginTop: "1cqw" }}>💔</div>
          )}
        </div>
      ) : (
        /* SCORE & PREP - Character-specific interlude */
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-black text-white/60 tracking-widest" style={{ fontSize: "3cqw" }}>SCORE</div>
          <div className="font-black text-white tabular-nums" style={{
            fontSize: "16cqw", WebkitTextStroke: "0.6cqw #14082b",
            transform: `scale(${scorePop})`, color: "#ffd60a",
          }}>{snap.displayScore}</div>
          <div style={{ fontSize: "6cqw", transform: `scale(${pop})` }}>{face}</div>
        </div>
      )}

      {/* Hearts */}
      <div className="absolute flex gap-[1cqw]" style={{ left: "50%", bottom: "6%", transform: "translateX(-50%)" }}>
        {Array.from({ length: snap.maxLives }).map((_, i) => {
          const lost = i >= snap.lives;
          const justLost = p.lostLife && i === snap.lives && bar === 0;
          return (
            <span key={i} style={{
              fontSize: "4.5cqw", transform: `scale(${lost ? 0.85 : pop})`,
              opacity: justLost ? (snap.beatPhase < 0.5 ? 1 : 0.2) : 1,
            }}>{justLost ? "💔" : lost ? "🖤" : "❤️"}</span>
          );
        })}
      </div>

      {/* Floor indicator */}
      <div className="absolute font-black text-[#8f7ff0] tabular-nums" style={{ right: "3%", top: "3%", fontSize: "3cqw" }}>
        FLOOR {snap.gamesPlayed + 1}
      </div>
    </div>
  );
};

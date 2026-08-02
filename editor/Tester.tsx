import React, { useEffect, useMemo, useRef, useState } from "react";
import { AUDIO } from "../engine/audio";
import { compileMicrogame } from "./runtime";
import type { MgCtx, Outcome } from "../engine/types";
import type { MicrogameData } from "./schema";

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * Playtests a single MicrogameData in isolation: its own beat clock + metronome,
 * keyboard + pointer input, the letterboxed console, instruction, timer and
 * result. Mirrors how the global engine runs a compiled game.
 */
export const Tester: React.FC<{ data: MicrogameData; onClose: () => void }> = ({
  data,
  onClose,
}) => {
  const def = useMemo(() => compileMicrogame(data), [data]);
  const bpm = data.bpm ?? 124;
  const lengthBeats = def.lengthBars * 4;

  const [, force] = useState(0);
  const screenRef = useRef<HTMLDivElement>(null);
  const st = useRef({
    s: def.init(),
    clock: 0,
    nextBeat: 0,
    outcome: null as Outcome,
    endBeats: lengthBeats,
    over: false,
    started: false,
  });
  const input = useRef({
    held: new Set<string>(),
    pressed: new Set<string>(),
    pointer: { x: -99, y: -99, down: false, pressed: false },
  });

  const reset = () => {
    st.current = {
      s: def.init(),
      clock: 0,
      nextBeat: 0,
      outcome: null,
      endBeats: lengthBeats,
      over: false,
      started: false,
    };
    input.current.held.clear();
    input.current.pressed.clear();
    force((n) => n + 1);
  };

  useEffect(() => {
    AUDIO.unlock();
    const KEYMAP: Record<string, string> = {
      ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Space: "space",
    };
    const down = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      AUDIO.unlock();
      if (!e.repeat) {
        input.current.pressed.add(k);
        input.current.held.add(k);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (!k) return;
      input.current.held.delete(k);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cur = st.current;
      const dtBeats = (dt * bpm) / 60;

      if (!cur.over) {
        cur.clock += dtBeats;
        const t = cur.clock - 1; // first beat is the "0 beat" pre-roll
        const ctrl = t >= 0 && cur.outcome === null;

        const ctx: MgCtx = {
          dt, dtBeats, t, beat: Math.floor(t), beatPhase: cur.clock - Math.floor(cur.clock),
          lengthBeats, endBeats: cur.endBeats, bpm, control: ctrl,
          input: input.current as any,
          outcome: cur.outcome,
          win: () => { if (cur.outcome === null) { cur.outcome = "win"; AUDIO.winJingle(); } },
          lose: () => { if (cur.outcome === null) { cur.outcome = "lose"; AUDIO.loseJingle(); } },
        };
        def.update(cur.s, ctx);

        // framerules for 4-bar games
        if (lengthBeats === 16 && cur.outcome !== null && cur.endBeats === 16) {
          if (t <= 7) cur.endBeats = 8;
          else if (t <= 11) cur.endBeats = 12;
        }

        // soft metronome tick on each beat
        while (cur.clock >= cur.nextBeat) {
          AUDIO.metroTick(AUDIO.now + 0.001, cur.nextBeat);
          cur.nextBeat += 1;
        }

        if (t >= cur.endBeats) {
          if (cur.outcome === null) {
            cur.outcome = def.timeoutOutcome;
            if (cur.outcome === "win") AUDIO.winJingle();
            else AUDIO.loseJingle();
          }
          cur.over = true;
        }
      }

      input.current.pressed.clear();
      input.current.pointer.pressed = false;
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [def, bpm, lengthBeats]);

  // pointer mapping
  const mapP = (e: React.PointerEvent) => {
    const el = screenRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    input.current.pointer.x = ((e.clientX - r.left) / r.width) * 100;
    input.current.pointer.y = ((e.clientY - r.top) / r.height) * 100;
  };

  const cur = st.current;
  const t = cur.clock - 1;
  const pal = def.palette;
  const remaining = Math.max(0, Math.ceil(cur.endBeats - t));
  const phase: "ready" | "play" | "done" = cur.over ? "done" : t < 0 ? "ready" : "play";
  const doorOpen = cur.over ? ease(Math.min(1, (cur.endBeats - t) )) : t < 0 ? ease(t + 1) : 1;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center gap-3 p-4">
      <div className="flex items-center gap-3 text-white">
        <span className="font-black text-lg" style={{ color: pal.text }}>
          ▶ TEST — {data.name}
        </span>
        <span className="text-white/50 text-sm">♩ {Math.round(bpm)} · {data.instruction}</span>
      </div>

      <div
        className="relative overflow-hidden rounded-lg"
        style={{ aspectRatio: "4 / 3", width: "min(80vw, calc(70vh * 4 / 3))", background: pal.outer, containerType: "inline-size" }}
      >
        <div
          className="absolute overflow-hidden rounded-[1.6cqw]"
          ref={screenRef}
          data-gamescreen
          onPointerMove={mapP}
          onPointerDown={(e) => { mapP(e); input.current.pointer.down = true; input.current.pointer.pressed = true; }}
          onPointerUp={() => (input.current.pointer.down = false)}
          style={{ left: "9%", top: "8%", width: "82%", height: "82%", background: pal.screen, boxShadow: `0 0 0 1.4cqw ${pal.frame}` }}
        >
          <def.View
            s={cur.s}
            v={{ t, beat: Math.floor(t), beatPhase: cur.clock - Math.floor(cur.clock), outcome: cur.outcome, lengthBeats, endBeats: cur.endBeats, control: phase === "play" }}
          />
        </div>

        {/* timer */}
        {phase !== "done" && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-[0.5cqw]" style={{ bottom: "2%" }}>
            <span style={{ fontSize: "3cqw", transform: `scale(${remaining <= 2 ? 1.3 : 1})` }}>⏱️</span>
            {Array.from({ length: cur.endBeats }).map((_, i) => (
              <div key={i} className="rounded-sm" style={{ width: "1.8cqw", height: "1.1cqw", background: i < remaining ? pal.frame : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
        )}

        {/* ready / instruction */}
        {phase === "ready" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="font-black" style={{ fontSize: "11cqw", color: pal.text, WebkitTextStroke: "0.6cqw #14082b", transform: "rotate(-3deg)" }}>
              {data.instruction}
            </div>
          </div>
        )}

        {/* doors (purely cosmetic here) */}
        {doorOpen < 1 && (
          <>
            <div className="absolute top-0 bottom-0 left-0 z-40" style={{ width: "50%", background: "linear-gradient(90deg,#241a45,#4b3f7d)", transform: `translateX(${-doorOpen * 100}%)` }} />
            <div className="absolute top-0 bottom-0 right-0 z-40" style={{ width: "50%", background: "linear-gradient(270deg,#241a45,#4b3f7d)", transform: `translateX(${doorOpen * 100}%)` }} />
          </>
        )}

        {/* result */}
        {phase === "done" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/55">
            <div style={{ fontSize: "16cqw" }}>{cur.outcome === "win" ? "🎉" : "💀"}</div>
            <div className="font-black text-white" style={{ fontSize: "7cqw", color: cur.outcome === "win" ? "#9ef01a" : "#ff4d6d" }}>
              {cur.outcome === "win" ? "YOU WIN!" : "TRY AGAIN!"}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={reset} className="px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold">
          ↻ Retry
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold">
          ◀ Back to editor
        </button>
      </div>
    </div>
  );
};

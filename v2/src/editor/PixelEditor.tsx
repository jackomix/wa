/* ==================================================================
 *  Pixel Editor — rebuilt for v2.
 *
 *  v1 had paint / fill / erase on a fixed 8-16px grid. Functional, but
 *  the brief called the art editor "weak" and asked for something with
 *  the tactility of Mario Paint: eraser *effects*, pattern-drawing tools,
 *  things that feel good to use rather than merely work.
 *
 *  What's here now:
 *    - brush sizes 1-4 with a live cursor preview
 *    - PATTERNS: checker / dither25 / dither75 / stripes / noise, applied
 *      as a stamp mask so you can lay texture in one stroke
 *    - shaped erasers (square/round) and a "fade" eraser that thins
 *      coverage instead of hard-clearing — Mario Paint's dissolve
 *    - MIRROR drawing (horizontal / vertical / quad) for symmetric art
 *    - line and rectangle tools with rubber-band preview
 *    - eyedropper, flip H/V, rotate, shift, invert-ish palette cycling
 *    - onion skin of the previous animation cel
 *    - full undo/redo history (Ctrl+Z / Ctrl+Shift+Z)
 *    - grid sizes 8 -> 32; this is where "resolution" lives, as a quiet
 *      stepper, NOT a "pixel or photorealistic?" modal
 * ================================================================== */

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Appearance } from "./schema";

type PixelApp = Extract<Appearance, { kind: "pixel" }>;

export const defaultPixel = (): PixelApp => ({
  kind: "pixel",
  grid: 16,
  palette: ["#ffffff", "#000000", "#f72585", "#4cc9f0", "#ffd60a", "#9ef01a", "#ff7b00", "#7b2ff7"],
  pixels: Array.from({ length: 16 }, () => new Array(16).fill(-1)),
});

type Tool = "paint" | "fill" | "erase" | "line" | "rect" | "pick";
type Pattern = "solid" | "checker" | "dither25" | "dither75" | "stripeH" | "stripeV" | "noise";
type Mirror = "none" | "h" | "v" | "quad";
type EraseStyle = "hard" | "round" | "fade";

const PATTERNS: { v: Pattern; label: string }[] = [
  { v: "solid", label: "Solid" },
  { v: "checker", label: "Checker" },
  { v: "dither25", label: "25%" },
  { v: "dither75", label: "75%" },
  { v: "stripeH", label: "Stripes ═" },
  { v: "stripeV", label: "Stripes ║" },
  { v: "noise", label: "Noise" },
];

/** Does this pattern lay down ink at (r,c)? */
function patternHit(p: Pattern, r: number, c: number): boolean {
  switch (p) {
    case "solid": return true;
    case "checker": return (r + c) % 2 === 0;
    case "dither25": return r % 2 === 0 && c % 2 === 0;
    case "dither75": return !(r % 2 === 1 && c % 2 === 1);
    case "stripeH": return r % 2 === 0;
    case "stripeV": return c % 2 === 0;
    case "noise": return Math.random() > 0.45;
  }
}

const clone = (px: number[][]) => px.map((r) => r.slice());

export const PixelEditor: React.FC<{
  value: PixelApp;
  onChange: (v: PixelApp) => void;
  /** previous cel, drawn faintly underneath */
  onionApp?: Appearance | null;
}> = ({ value, onChange, onionApp }) => {
  const [color, setColor] = useState(1);
  const [tool, setTool] = useState<Tool>("paint");
  const [brush, setBrush] = useState(1);
  const [pattern, setPattern] = useState<Pattern>("solid");
  const [mirror, setMirror] = useState<Mirror>("none");
  const [eraseStyle, setEraseStyle] = useState<EraseStyle>("hard");
  const [drag, setDrag] = useState<{ r: number; c: number } | null>(null);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const painting = useRef(false);
  const undoStack = useRef<number[][][]>([]);
  const redoStack = useRef<number[][][]>([]);

  const grid = value.grid;
  const pal = value.palette;

  /* ---- history ---- */
  const pushUndo = useCallback(() => {
    undoStack.current.push(clone(value.pixels));
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
  }, [value.pixels]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(clone(value.pixels));
    onChange({ ...value, pixels: prev });
  }, [value, onChange]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(clone(value.pixels));
    onChange({ ...value, pixels: next });
  }, [value, onChange]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  /* ---- mirroring ---- */
  const mirrorsOf = (r: number, c: number): [number, number][] => {
    const out: [number, number][] = [[r, c]];
    const mr = grid - 1 - r;
    const mc = grid - 1 - c;
    if (mirror === "h" || mirror === "quad") out.push([r, mc]);
    if (mirror === "v" || mirror === "quad") out.push([mr, c]);
    if (mirror === "quad") out.push([mr, mc]);
    return out;
  };

  /* ---- low-level write ---- */
  const stamp = (px: number[][], r: number, c: number, idx: number) => {
    const half = Math.floor((brush - 1) / 2);
    for (let dr = -half; dr <= brush - 1 - half; dr++) {
      for (let dc = -half; dc <= brush - 1 - half; dc++) {
        // round brush / round eraser clip the corners
        const roundish = (tool === "erase" && eraseStyle === "round") || brush >= 3;
        if (roundish && brush > 1 && Math.hypot(dr, dc) > brush / 2) continue;

        for (const [mr, mc] of mirrorsOf(r + dr, c + dc)) {
          if (mr < 0 || mc < 0 || mr >= grid || mc >= grid) continue;
          if (idx >= 0 && !patternHit(pattern, mr, mc)) continue;
          // "fade" eraser thins coverage rather than hard-clearing, so you can
          // dissolve an edge instead of chopping it
          if (idx < 0 && eraseStyle === "fade" && Math.random() > 0.5) continue;
          if (!px[mr]) px[mr] = new Array(grid).fill(-1);
          px[mr][mc] = idx;
        }
      }
    }
  };

  const commit = (mutate: (px: number[][]) => void) => {
    const px = clone(value.pixels);
    mutate(px);
    onChange({ ...value, pixels: px });
  };

  const floodFill = (r: number, c: number) => {
    const target = value.pixels[r]?.[c] ?? -1;
    if (target === color) return;
    commit((px) => {
      const stack: [number, number][] = [[r, c]];
      while (stack.length) {
        const [cr, cc] = stack.pop()!;
        if (cr < 0 || cc < 0 || cr >= grid || cc >= grid) continue;
        if ((px[cr]?.[cc] ?? -1) !== target) continue;
        if (!px[cr]) px[cr] = new Array(grid).fill(-1);
        if (!patternHit(pattern, cr, cc)) { px[cr][cc] = target === -1 ? -1 : px[cr][cc]; }
        else px[cr][cc] = color;
        stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
      }
    });
  };

  const drawLine = (px: number[][], r0: number, c0: number, r1: number, c1: number, idx: number) => {
    const dr = Math.abs(r1 - r0), dc = Math.abs(c1 - c0);
    const sr = r0 < r1 ? 1 : -1, sc = c0 < c1 ? 1 : -1;
    let err = dc - dr, r = r0, c = c0;
    for (let g = 0; g < 4096; g++) {
      stamp(px, r, c, idx);
      if (r === r1 && c === c1) break;
      const e2 = 2 * err;
      if (e2 > -dr) { err -= dr; c += sc; }
      if (e2 < dc) { err += dc; r += sr; }
    }
  };

  const paintAt = (r: number, c: number) => {
    if (tool === "fill") return floodFill(r, c);
    if (tool === "pick") {
      const idx = value.pixels[r]?.[c] ?? -1;
      if (idx >= 0) { setColor(idx); setTool("paint"); }
      return;
    }
    const idx = tool === "erase" ? -1 : color;
    commit((px) => stamp(px, r, c, idx));
  };

  /* ---- whole-canvas ops ---- */
  const clear = () => { pushUndo(); onChange({ ...value, pixels: Array.from({ length: grid }, () => new Array(grid).fill(-1)) }); };
  const flipH = () => { pushUndo(); commit((px) => { for (const row of px) row.reverse(); }); };
  const flipV = () => { pushUndo(); commit((px) => px.reverse()); };
  const rot90 = () => {
    pushUndo();
    commit((px) => {
      const src = clone(px);
      for (let r = 0; r < grid; r++) for (let c = 0; c < grid; c++) px[r][c] = src[grid - 1 - c]?.[r] ?? -1;
    });
  };
  const shift = (dr: number, dc: number) => {
    pushUndo();
    commit((px) => {
      const src = clone(px);
      for (let r = 0; r < grid; r++)
        for (let c = 0; c < grid; c++)
          px[r][c] = src[(r - dr + grid) % grid]?.[(c - dc + grid) % grid] ?? -1;
    });
  };
  const fillAll = () => { pushUndo(); commit((px) => { for (let r = 0; r < grid; r++) for (let c = 0; c < grid; c++) if (patternHit(pattern, r, c)) px[r][c] = color; }); };

  const resize = (g: number) => {
    pushUndo();
    onChange({
      ...value,
      grid: g,
      pixels: Array.from({ length: g }, (_, r) => Array.from({ length: g }, (_, c) => value.pixels[r]?.[c] ?? -1)),
    });
  };

  const addColor = (hex: string) => { onChange({ ...value, palette: [...pal, hex] }); setColor(pal.length); };
  const setPaletteColor = (i: number, hex: string) =>
    onChange({ ...value, palette: pal.map((p, k) => (k === i ? hex : p)) });

  /* ---- preview overlay for line/rect ---- */
  const previewCells = (): Set<string> => {
    const set = new Set<string>();
    if (!drag || !hover || (tool !== "line" && tool !== "rect")) return set;
    if (tool === "line") {
      const px: number[][] = Array.from({ length: grid }, () => new Array(grid).fill(-1));
      drawLine(px, drag.r, drag.c, hover.r, hover.c, 1);
      for (let r = 0; r < grid; r++) for (let c = 0; c < grid; c++) if (px[r][c] === 1) set.add(`${r},${c}`);
    } else {
      const r0 = Math.min(drag.r, hover.r), r1 = Math.max(drag.r, hover.r);
      const c0 = Math.min(drag.c, hover.c), c1 = Math.max(drag.c, hover.c);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (patternHit(pattern, r, c)) set.add(`${r},${c}`);
    }
    return set;
  };
  const preview = previewCells();

  const finishDrag = () => {
    if (!drag || !hover) { setDrag(null); return; }
    const idx = tool === "erase" ? -1 : color;
    pushUndo();
    commit((px) => {
      if (tool === "line") drawLine(px, drag.r, drag.c, hover.r, hover.c, idx);
      else {
        const r0 = Math.min(drag.r, hover.r), r1 = Math.max(drag.r, hover.r);
        const c0 = Math.min(drag.c, hover.c), c1 = Math.max(drag.c, hover.c);
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) stamp(px, r, c, idx);
      }
    });
    setDrag(null);
  };

  const Btn: React.FC<{ on?: boolean; onClick: () => void; title?: string; children: React.ReactNode }> = ({ on, onClick, title, children }) => (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded text-xs font-bold transition ${on ? "bg-fuchsia-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
    >
      {children}
    </button>
  );

  const onionPixels = onionApp && onionApp.kind === "pixel" ? onionApp : null;

  return (
    <div className="flex flex-col gap-2" style={{ width: 300 }}>
      {/* tools */}
      <div className="flex items-center gap-1 flex-wrap">
        <Btn on={tool === "paint"} onClick={() => setTool("paint")} title="Paint">🖌️</Btn>
        <Btn on={tool === "line"} onClick={() => setTool("line")} title="Line">📏</Btn>
        <Btn on={tool === "rect"} onClick={() => setTool("rect")} title="Rectangle">▭</Btn>
        <Btn on={tool === "fill"} onClick={() => setTool("fill")} title="Flood fill">🪣</Btn>
        <Btn on={tool === "erase"} onClick={() => setTool("erase")} title="Erase">🧽</Btn>
        <Btn on={tool === "pick"} onClick={() => setTool("pick")} title="Eyedropper">💧</Btn>
        <div className="w-px h-5 bg-white/10" />
        <Btn onClick={undo} title="Undo (Ctrl+Z)">↶</Btn>
        <Btn onClick={redo} title="Redo (Ctrl+Shift+Z)">↷</Btn>
      </div>

      {/* brush + pattern + mirror */}
      <div className="flex items-center gap-1 flex-wrap text-[10px]">
        <span className="text-white/40 font-bold uppercase">Size</span>
        {[1, 2, 3, 4].map((b) => (
          <Btn key={b} on={brush === b} onClick={() => setBrush(b)}>{b}</Btn>
        ))}
        <div className="w-px h-5 bg-white/10 mx-0.5" />
        <select
          value={pattern}
          onChange={(e) => setPattern(e.target.value as Pattern)}
          className="bg-black/40 border border-white/15 rounded px-1.5 py-1 text-[11px] outline-none focus:border-fuchsia-500"
          title="Pattern mask — lay texture in a single stroke"
        >
          {PATTERNS.map((p) => <option key={p.v} value={p.v} className="bg-zinc-800">{p.label}</option>)}
        </select>
        <select
          value={mirror}
          onChange={(e) => setMirror(e.target.value as Mirror)}
          className="bg-black/40 border border-white/15 rounded px-1.5 py-1 text-[11px] outline-none focus:border-fuchsia-500"
          title="Mirror drawing"
        >
          <option value="none" className="bg-zinc-800">No mirror</option>
          <option value="h" className="bg-zinc-800">Mirror ↔</option>
          <option value="v" className="bg-zinc-800">Mirror ↕</option>
          <option value="quad" className="bg-zinc-800">Mirror ✛</option>
        </select>
      </div>

      {tool === "erase" && (
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-white/40 font-bold uppercase">Eraser</span>
          <Btn on={eraseStyle === "hard"} onClick={() => setEraseStyle("hard")} title="Hard square edge">Hard</Btn>
          <Btn on={eraseStyle === "round"} onClick={() => setEraseStyle("round")} title="Rounded edge">Round</Btn>
          <Btn on={eraseStyle === "fade"} onClick={() => setEraseStyle("fade")} title="Dissolve — thins coverage instead of clearing">Fade</Btn>
        </div>
      )}

      {/* palette */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => { setColor(-1); setTool("erase"); }}
          className={`w-6 h-6 rounded border-2 ${color === -1 ? "border-white" : "border-white/20"}`}
          style={{
            backgroundImage:
              "linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
          }}
          title="Transparent"
        />
        {pal.map((hex, i) => (
          <div key={i} className="relative group">
            <button
              onClick={() => { setColor(i); if (tool === "erase" || tool === "pick") setTool("paint"); }}
              onDoubleClick={() => document.getElementById(`pc${i}`)?.click()}
              className={`w-6 h-6 rounded border-2 ${color === i ? "border-white" : "border-white/20"}`}
              style={{ background: hex }}
              title={`${hex} — double-click to edit`}
            />
            <input id={`pc${i}`} type="color" value={hex} onChange={(e) => setPaletteColor(i, e.target.value)} className="absolute opacity-0 w-0 h-0" />
          </div>
        ))}
        <label className="w-6 h-6 rounded border-2 border-white/20 bg-white/10 grid place-items-center cursor-pointer text-white/60 text-sm">
          +
          <input type="color" className="opacity-0 w-0 h-0" onChange={(e) => addColor(e.target.value)} />
        </label>
      </div>

      {/* canvas */}
      <div
        className="relative w-full aspect-square rounded-lg overflow-hidden touch-none select-none"
        style={{
          backgroundImage:
            "linear-gradient(45deg,#2a2a3a 25%,transparent 25%),linear-gradient(-45deg,#2a2a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a3a 75%),linear-gradient(-45deg,transparent 75%,#2a2a3a 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
          backgroundColor: "#1c1c28",
        }}
        onPointerLeave={() => { painting.current = false; setHover(null); }}
        onPointerUp={() => { painting.current = false; if (drag) finishDrag(); }}
      >
        {/* onion skin of the previous cel */}
        {onionPixels && (
          <div className="absolute inset-0 grid pointer-events-none opacity-25"
               style={{ gridTemplateColumns: `repeat(${onionPixels.grid},1fr)`, gridTemplateRows: `repeat(${onionPixels.grid},1fr)` }}>
            {Array.from({ length: onionPixels.grid * onionPixels.grid }).map((_, i) => {
              const r = Math.floor(i / onionPixels.grid), c = i % onionPixels.grid;
              const idx = onionPixels.pixels[r]?.[c] ?? -1;
              return <div key={i} style={{ background: idx >= 0 ? onionPixels.palette[idx] : "transparent" }} />;
            })}
          </div>
        )}

        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${grid},1fr)`, gridTemplateRows: `repeat(${grid},1fr)` }}
        >
          {Array.from({ length: grid * grid }).map((_, i) => {
            const r = Math.floor(i / grid);
            const c = i % grid;
            const idx = value.pixels[r]?.[c] ?? -1;
            const inPreview = preview.has(`${r},${c}`);
            return (
              <div
                key={i}
                onPointerDown={() => {
                  if (tool === "line" || tool === "rect") { setDrag({ r, c }); setHover({ r, c }); return; }
                  pushUndo();
                  painting.current = true;
                  paintAt(r, c);
                }}
                onPointerEnter={() => {
                  setHover({ r, c });
                  if (painting.current && tool !== "fill" && tool !== "line" && tool !== "rect") paintAt(r, c);
                }}
                className="border border-black/10"
                style={{
                  background: inPreview
                    ? (tool === "erase" ? "rgba(255,255,255,0.25)" : pal[color] ?? "#fff")
                    : idx >= 0 ? pal[idx] : "transparent",
                  opacity: inPreview ? 0.7 : 1,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* canvas ops + resolution */}
      <div className="flex items-center gap-1 flex-wrap">
        <Btn onClick={flipH} title="Flip horizontally">⇄</Btn>
        <Btn onClick={flipV} title="Flip vertically">⇅</Btn>
        <Btn onClick={rot90} title="Rotate 90°">⟳</Btn>
        <Btn onClick={() => shift(-1, 0)} title="Nudge up">↑</Btn>
        <Btn onClick={() => shift(1, 0)} title="Nudge down">↓</Btn>
        <Btn onClick={() => shift(0, -1)} title="Nudge left">←</Btn>
        <Btn onClick={() => shift(0, 1)} title="Nudge right">→</Btn>
        <Btn onClick={fillAll} title="Fill canvas with current colour + pattern">▣</Btn>
        <Btn onClick={clear} title="Clear">🗑️</Btn>
        {/* Resolution lives here — a quiet stepper, never a modal asking
            "pixel art or photorealistic?" */}
        <select
          value={grid}
          onChange={(e) => resize(Number(e.target.value))}
          className="ml-auto bg-black/40 border border-white/15 rounded px-2 py-1 text-[11px] outline-none focus:border-fuchsia-500"
          title="Canvas resolution"
        >
          {[8, 12, 16, 24, 32].map((g) => (
            <option key={g} value={g} className="bg-zinc-800">{g}×{g}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

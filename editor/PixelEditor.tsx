import React, { useRef, useState } from "react";
import type { Appearance } from "./schema";

/**
 * A tiny pixel-art sprite painter (WarioWare D.I.Y. style).
 * Edits the "pixel" appearance of an actor: paint / erase / fill / clear,
 * a swatch palette you can extend, and an 8 / 12 / 16 grid.
 */
export const PixelEditor: React.FC<{
  value: Extract<Appearance, { kind: "pixel" }>;
  onChange: (v: Extract<Appearance, { kind: "pixel" }>) => void;
}> = ({ value, onChange }) => {
  const [color, setColor] = useState(0); // selected palette index, -1 = eraser
  const [tool, setTool] = useState<"paint" | "fill" | "erase">("paint");
  const painting = useRef(false);

  const grid = value.grid;
  const pal = value.palette;

  const setPx = (r: number, c: number, idx: number) => {
    const pixels = value.pixels.map((row) => row.slice());
    if (!pixels[r]) pixels[r] = new Array(grid).fill(-1);
    pixels[r][c] = idx;
    onChange({ ...value, pixels });
  };

  const paintAt = (r: number, c: number) => {
    if (tool === "fill") {
      floodFill(r, c);
      return;
    }
    const idx = tool === "erase" ? -1 : color;
    setPx(r, c, idx);
  };

  const floodFill = (r: number, c: number) => {
    const target = value.pixels[r]?.[c] ?? -1;
    const want = color;
    if (target === want) return;
    const pixels = value.pixels.map((row) => row.slice());
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      if (cr < 0 || cc < 0 || cr >= grid || cc >= grid) continue;
      if ((pixels[cr]?.[cc] ?? -1) !== target) continue;
      if (!pixels[cr]) pixels[cr] = new Array(grid).fill(-1);
      pixels[cr][cc] = want;
      stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
    }
    onChange({ ...value, pixels });
  };

  const clear = () =>
    onChange({ ...value, pixels: Array.from({ length: grid }, () => new Array(grid).fill(-1)) });

  const resize = (g: number) => {
    const pixels = Array.from({ length: g }, (_, r) =>
      Array.from({ length: g }, (_, c) => value.pixels[r]?.[c] ?? -1),
    );
    onChange({ ...value, grid: g, pixels });
  };

  const addColor = (hex: string) => {
    onChange({ ...value, palette: [...pal, hex] });
    setColor(pal.length);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* tools */}
      <div className="flex items-center gap-1 flex-wrap">
        {(["paint", "fill", "erase"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={`px-2 py-1 rounded text-xs font-bold capitalize ${
              tool === t ? "bg-fuchsia-500 text-white" : "bg-white/10 text-white/70"
            }`}
          >
            {t === "paint" ? "🖌️ Paint" : t === "fill" ? "🪣 Fill" : "🧽 Erase"}
          </button>
        ))}
        <button onClick={clear} className="px-2 py-1 rounded text-xs font-bold bg-white/10 text-white/70">
          🗑️ Clear
        </button>
        <select
          value={grid}
          onChange={(e) => resize(Number(e.target.value))}
          className="ml-auto bg-white/10 text-white/80 text-xs rounded px-2 py-1"
        >
          {[8, 12, 16].map((g) => (
            <option key={g} value={g} className="bg-zinc-800">
              {g}×{g}
            </option>
          ))}
        </select>
      </div>

      {/* palette */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setColor(-1)}
          className={`w-7 h-7 rounded border-2 ${
            color === -1 ? "border-white" : "border-white/20"
          }`}
          style={{
            backgroundImage:
              "linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
          }}
          title="Eraser / transparent"
        />
        {pal.map((hex, i) => (
          <button
            key={i}
            onClick={() => {
              setColor(i);
              setTool("paint");
            }}
            className={`w-7 h-7 rounded border-2 ${color === i ? "border-white" : "border-white/20"}`}
            style={{ background: hex }}
          />
        ))}
        <label className="w-7 h-7 rounded border-2 border-white/20 bg-white/10 flex items-center justify-center cursor-pointer text-white/60 text-sm">
          +
          <input
            type="color"
            className="opacity-0 w-0 h-0"
            onChange={(e) => addColor(e.target.value)}
          />
        </label>
      </div>

      {/* canvas */}
      <div
        className="relative w-full max-w-[260px] aspect-square rounded-lg overflow-hidden touch-none select-none"
        style={{
          backgroundImage:
            "linear-gradient(45deg,#2a2a3a 25%,transparent 25%),linear-gradient(-45deg,#2a2a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a3a 75%),linear-gradient(-45deg,transparent 75%,#2a2a3a 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
          backgroundColor: "#1c1c28",
        }}
        onPointerLeave={() => (painting.current = false)}
        onPointerUp={() => (painting.current = false)}
      >
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${grid},1fr)`, gridTemplateRows: `repeat(${grid},1fr)` }}
        >
          {Array.from({ length: grid * grid }).map((_, i) => {
            const r = Math.floor(i / grid);
            const c = i % grid;
            const idx = value.pixels[r]?.[c] ?? -1;
            return (
              <div
                key={i}
                onPointerDown={() => {
                  painting.current = true;
                  paintAt(r, c);
                }}
                onPointerEnter={() => painting.current && tool !== "fill" && paintAt(r, c)}
                className="border border-black/10"
                style={{ background: idx >= 0 ? pal[idx] : "transparent" }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

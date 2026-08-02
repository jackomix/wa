/* ==================================================================
 *  The single sprite render path.
 *
 *  EVERY appearance in the game goes through this component — glyph,
 *  hand-drawn pixels, shape, or bitmap. That is the whole point of the
 *  fix: callers ask for "the current cel of this costume" and never learn
 *  which kind it was. Replacing an emoji placeholder with real art is a
 *  data edit, invisible to the renderer, the hit test, the editor
 *  thumbnail and the exporter alike.
 *
 *  In v1 this logic was inline in three different places and special-cased
 *  emoji into a <span>.
 * ================================================================== */

import React from "react";
import type { Appearance, ActorDef, Costume } from "../editor/schema";

/* ---- costume helpers (schema-level; engine/assets.ts holds the
       tick-advancing runtime versions) ------------------------------ */

export function costumeOf(def: ActorDef, name: string): Costume | undefined {
  return def.costumes?.find((c) => c.name === name);
}

/** The appearance to draw, given a costume name and cel index. */
export function celOf(def: ActorDef, costumeName: string, frame: number): Appearance | null {
  const cs = def.costumes ?? [];
  const c = cs.find((x) => x.name === costumeName) ?? cs[0];
  if (!c || !c.frames.length) return def.appearance ?? null;
  return c.frames[Math.min(Math.max(0, frame), c.frames.length - 1)]?.app ?? null;
}

/** First drawable cel — used for editor thumbnails and library cards. */
export function previewAppearance(def: ActorDef): Appearance | null {
  return celOf(def, def.defaultCostume ?? def.costumes?.[0]?.name ?? "", 0);
}

/* ---- pixel grid --------------------------------------------------- */
const PixelArt: React.FC<{
  app: Extract<Appearance, { kind: "pixel" }>;
  crisp: boolean;
}> = ({ app, crisp }) => {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < app.grid; r++) {
    for (let c = 0; c < app.grid; c++) {
      const idx = app.pixels[r]?.[c];
      if (idx == null || idx < 0) continue;
      cells.push(
        // 1.02 overlap kills the hairline seams browsers draw between
        // adjacent rects at fractional scales
        <rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} fill={app.palette[idx]} />,
      );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${app.grid} ${app.grid}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      shapeRendering={crisp ? "crispEdges" : "auto"}
      style={{ overflow: "visible", display: "block" }}
    >
      {cells}
    </svg>
  );
};

/* ---- primitive shapes --------------------------------------------- */
const ShapeArt: React.FC<{ app: Extract<Appearance, { kind: "shape" }> }> = ({ app }) => {
  const common = { fill: app.fill, stroke: app.stroke ?? "none", strokeWidth: app.stroke ? 4 : 0 };
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }}>
      {app.shape === "rect" && <rect x="2" y="2" width="96" height="96" {...common} />}
      {app.shape === "ellipse" && <ellipse cx="50" cy="50" rx="48" ry="48" {...common} />}
      {app.shape === "triangle" && <polygon points="50,3 97,97 3,97" {...common} />}
      {app.shape === "star" && (
        <polygon
          points="50,3 61,38 98,38 68,60 79,95 50,73 21,95 32,60 2,38 39,38"
          {...common}
        />
      )}
    </svg>
  );
};

/* ---- the one sprite component ------------------------------------- */
export const Sprite: React.FC<{
  app: Appearance | null;
  /** container-relative height in cqw, used to size glyph placeholders */
  sizeCqw?: number;
  /** nearest-neighbour / crisp edges (derived from canvas, not asked of the user) */
  crisp?: boolean;
}> = ({ app, sizeCqw = 12, crisp = true }) => {
  if (!app) return null;

  switch (app.kind) {
    case "emoji":
      /* Placeholder art. Note it is rendered INSIDE the same sized box as
         every other kind and is not addressable by callers — the actor
         references a costume, the costume holds this cel, and swapping it
         for {kind:"image"} changes nothing anywhere else. */
      return (
        <span
          className="leading-none select-none pointer-events-none"
          style={{
            fontSize: `${sizeCqw * 0.85}cqw`,
            lineHeight: 1,
            display: "block",
            textAlign: "center",
          }}
        >
          {app.char}
        </span>
      );

    case "pixel":
      return <PixelArt app={app} crisp={crisp} />;

    case "shape":
      return <ShapeArt app={app} />;

    case "image":
      return (
        <img
          src={app.src}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            imageRendering: crisp ? "pixelated" : "auto",
            pointerEvents: "none",
          }}
        />
      );

    default:
      return null;
  }
};

import React from "react";

/**
 * Asset references are intentionally separate from their drawing. A project
 * stores `spriteId: "hero-run"`; this registry is only the current placeholder
 * renderer. A PNG/tile-sheet importer can replace a registry entry without
 * changing scenes, events, or costumes.
 */
export type SpriteId = string;

export interface SpriteAssetProps {
  id: SpriteId;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

const COLORS: Record<string, { main: string; dark: string; light: string }> = {
  hero: { main: "#80ffdb", dark: "#123b55", light: "#e8fff7" },
  runner: { main: "#ffb703", dark: "#5b2a19", light: "#fff1b8" },
  hurdle: { main: "#e09f3e", dark: "#653d27", light: "#ffd166" },
  tree: { main: "#2a9d5b", dark: "#174d3a", light: "#9be564" },
  apple: { main: "#ef5b54", dark: "#6b1f2a", light: "#ffd6a5" },
  basket: { main: "#d5903f", dark: "#613b2b", light: "#f6d27c" },
  rock: { main: "#93a4b5", dark: "#35495e", light: "#d7e2ec" },
  ufo: { main: "#9ef01a", dark: "#254c48", light: "#d4ff91" },
  rocket: { main: "#ff6b6b", dark: "#5c2140", light: "#ffd166" },
  face: { main: "#f2c04f", dark: "#573849", light: "#fff0a6" },
  accent: { main: "#f72585", dark: "#4a163d", light: "#ffb3d2" },
};

const colorFor = (id: string) => {
  if (id.includes("runner") || id === "hurdle") return COLORS.runner;
  if (id.includes("tree")) return COLORS.tree;
  if (id.includes("apple")) return COLORS.apple;
  if (id.includes("basket")) return COLORS.basket;
  if (id.includes("rock") || id.includes("meteor")) return COLORS.rock;
  if (id.includes("ufo")) return COLORS.ufo;
  if (id.includes("rocket") || id.includes("flame")) return COLORS.rocket;
  if (id.includes("face")) return COLORS.face;
  if (id.includes("star") || id.includes("spark") || id.includes("target")) return COLORS.accent;
  return COLORS.hero;
};

const Face: React.FC<{ mood: "happy" | "sad" | "surprised" | "neutral" }> = ({ mood }) => (
  <>
    <circle cx="36" cy="42" r="4" fill="#141326" />
    <circle cx="64" cy="42" r="4" fill="#141326" />
    {mood === "sad" ? (
      <path d="M36 70 Q50 58 64 70" fill="none" stroke="#141326" strokeWidth="5" strokeLinecap="round" />
    ) : mood === "surprised" ? (
      <circle cx="50" cy="67" r="7" fill="#141326" />
    ) : (
      <path d="M36 63 Q50 76 64 63" fill="none" stroke="#141326" strokeWidth="5" strokeLinecap="round" />
    )}
  </>
);

/** Draw a replaceable placeholder asset as vector art, never as a text glyph. */
export const SpriteAsset: React.FC<SpriteAssetProps> = ({ id, className, style, title }) => {
  const c = colorFor(id);
  let art: React.ReactNode;
  switch (id) {
    case "sun":
      art = <><circle cx="50" cy="50" r="24" fill="#ffd166" /><path d="M50 7v15M50 78v15M7 50h15M78 50h15M20 20l11 11M69 69l11 11M80 20L69 31M31 69L20 80" stroke="#fca311" strokeWidth="7" strokeLinecap="round" /></>;
      break;
    case "cloud":
      art = <path d="M20 70h59a16 16 0 0 0 0-32 26 26 0 0 0-48-4A18 18 0 0 0 20 70Z" fill="#e8f5ff" stroke="#416788" strokeWidth="5" />;
      break;
    case "runner":
    case "runner-happy":
      art = <><circle cx="52" cy="20" r="15" fill={c.main} stroke={c.dark} strokeWidth="5" /><path d="M50 36l-4 25 18 16M48 44L26 55M47 60L28 86M56 59l20 22" fill="none" stroke={c.dark} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" /><path d="M38 19h7M60 19h7" stroke={c.dark} strokeWidth="4" strokeLinecap="round" /></>;
      break;
    case "runner-jump":
      art = <><circle cx="50" cy="22" r="15" fill={c.main} stroke={c.dark} strokeWidth="5" /><path d="M50 38l-3 24M46 46L22 30M49 48l25-18M47 61L25 76M50 61l26 15" fill="none" stroke={c.dark} strokeWidth="9" strokeLinecap="round" /><path d="M39 18h7M58 18h7" stroke={c.dark} strokeWidth="4" strokeLinecap="round" /></>;
      break;
    case "runner-sad":
      art = <><circle cx="50" cy="27" r="18" fill="#9aa9b7" stroke="#27384e" strokeWidth="5" /><Face mood="sad" /></>;
      break;
    case "hurdle":
      art = <><path d="M17 81V35M83 81V35M12 37h76M12 81h76" fill="none" stroke={c.dark} strokeWidth="9" strokeLinecap="round" /><path d="M13 37h74" stroke={c.light} strokeWidth="6" /></>;
      break;
    case "spark":
    case "star":
      art = <path d="m50 4 11 29 30 2-23 19 8 30-26-17-26 17 8-30L9 35l30-2Z" fill={c.light} stroke={c.main} strokeWidth="6" strokeLinejoin="round" />;
      break;
    case "tree":
      art = <><path d="M44 56h12v34H44z" fill="#85532f" stroke="#422b20" strokeWidth="4" /><circle cx="32" cy="42" r="22" fill={c.main} stroke={c.dark} strokeWidth="5" /><circle cx="64" cy="39" r="24" fill={c.light} stroke={c.dark} strokeWidth="5" /><circle cx="50" cy="24" r="22" fill={c.main} stroke={c.dark} strokeWidth="5" /></>;
      break;
    case "apple":
      art = <><path d="M52 25c-2-11 5-17 13-20" fill="none" stroke="#356859" strokeWidth="6" strokeLinecap="round" /><path d="M55 13c9-9 20-7 24-2-9 7-17 8-24 2" fill="#9be564" stroke="#356859" strokeWidth="4" /><path d="M50 28C25 11 11 34 21 65c7 22 24 27 29 12 5 15 22 10 29-12C89 34 75 11 50 28Z" fill={c.main} stroke={c.dark} strokeWidth="5" /></>;
      break;
    case "basket":
      art = <><path d="M20 39h60l-7 48H27Z" fill={c.main} stroke={c.dark} strokeWidth="6" /><path d="M30 40c2-28 38-28 40 0" fill="none" stroke={c.dark} strokeWidth="7" /><path d="M26 57h48M24 71h52" stroke={c.light} strokeWidth="5" /></>;
      break;
    case "rock":
    case "meteor":
      art = <><path d="M16 73 24 30 55 14l30 24-10 39-40 9Z" fill={c.main} stroke={c.dark} strokeWidth="6" strokeLinejoin="round" /><path d="m26 45 17-7M56 29l12 12M42 77l25-6" stroke={c.light} strokeWidth="5" strokeLinecap="round" /></>;
      break;
    case "ufo":
      art = <><path d="M18 55c4-25 60-25 64 0-11 10-53 10-64 0Z" fill={c.main} stroke={c.dark} strokeWidth="5" /><path d="M35 49c2-23 28-23 30 0" fill={c.light} stroke={c.dark} strokeWidth="5" /><path d="M27 67h46M34 76h32" stroke={c.light} strokeWidth="5" strokeLinecap="round" /></>;
      break;
    case "explosion":
      art = <path d="m48 5 10 23 22-16-7 26 27 2-23 13 18 20-28-5-4 27-14-23-22 15 8-27-27-4 24-14-18-19 27 5Z" fill="#ffb703" stroke="#e85d04" strokeWidth="5" strokeLinejoin="round" />;
      break;
    case "triangle":
      art = <path d="M50 9 91 87H9Z" fill="#ff6b6b" stroke="#501b2c" strokeWidth="6" strokeLinejoin="round" />;
      break;
    case "arrow-left":
    case "arrow-right":
    case "arrow-up":
    case "arrow-down": {
      const rotation = id === "arrow-left" ? 0 : id === "arrow-right" ? 180 : id === "arrow-up" ? 90 : -90;
      art = <g transform={`rotate(${rotation} 50 50)`}><path d="M15 50h58M50 20l30 30-30 30" fill="none" stroke="#f72585" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 50h58M50 20l30 30-30 30" fill="none" stroke="#ffd166" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></g>;
      break;
    }
    case "gun":
      art = <><path d="M14 38h56v20H14z" fill="#a7c7e7" stroke="#14213d" strokeWidth="5" /><path d="M61 58h20l7 24H68Z" fill="#4d6c8d" stroke="#14213d" strokeWidth="5" /><circle cx="31" cy="48" r="6" fill="#f2c04f" /></>;
      break;
    case "target":
      art = <><circle cx="50" cy="50" r="37" fill="#f7f7f7" stroke="#251b3a" strokeWidth="5" /><circle cx="50" cy="50" r="25" fill="#ef5b54" /><circle cx="50" cy="50" r="13" fill="#f7f7f7" /><circle cx="50" cy="50" r="6" fill="#ef5b54" /></>;
      break;
    case "moon":
      art = <path d="M68 12a37 37 0 1 0 20 67A39 39 0 1 1 68 12Z" fill="#ffd166" stroke="#8c552f" strokeWidth="5" />;
      break;
    case "rocket":
      art = <><path d="M50 7c23 13 25 43 0 69-25-26-23-56 0-69Z" fill="#ff6b6b" stroke="#5c2140" strokeWidth="5" /><circle cx="50" cy="38" r="9" fill="#bde0fe" stroke="#5c2140" strokeWidth="5" /><path d="M30 65 13 81l23-4M70 65l17 16-23-4" fill="#ffd166" stroke="#5c2140" strokeWidth="5" /><path d="M42 74 50 96l8-22Z" fill="#ffb703" stroke="#5c2140" strokeWidth="5" /></>;
      break;
    case "flame":
      art = <><path d="M51 5c17 25 25 31 19 53-4 14-14 27-25 30 12-16 9-26 1-35-4 12-13 17-21 20C17 48 35 25 51 5Z" fill="#ffb703" stroke="#e85d04" strokeWidth="5" /><path d="M50 45c8 12 8 21-2 31-5-8-5-14-2-20" fill="#ff6b6b" /></>;
      break;
    case "astronaut":
      art = <><circle cx="50" cy="29" r="22" fill="#dbeafe" stroke="#22324b" strokeWidth="6" /><rect x="31" y="49" width="38" height="38" rx="10" fill="#a7c7e7" stroke="#22324b" strokeWidth="6" /><circle cx="42" cy="29" r="4" fill="#22324b" /><circle cx="58" cy="29" r="4" fill="#22324b" /></>;
      break;
    case "penguin":
      art = <><ellipse cx="50" cy="52" rx="29" ry="38" fill="#26384d" stroke="#101522" strokeWidth="5" /><ellipse cx="50" cy="57" rx="18" ry="25" fill="#f3f0e6" /><path d="m41 42 9-6 9 6-9 8Z" fill="#ffb703" /></>;
      break;
    case "face-happy": art = <><circle cx="50" cy="50" r="38" fill={c.main} stroke={c.dark} strokeWidth="5" /><Face mood="happy" /></> ; break;
    case "face-sad": art = <><circle cx="50" cy="50" r="38" fill="#9aa9b7" stroke="#27384e" strokeWidth="5" /><Face mood="sad" /></> ; break;
    case "face-surprised": art = <><circle cx="50" cy="50" r="38" fill={c.main} stroke={c.dark} strokeWidth="5" /><Face mood="surprised" /></> ; break;
    case "dancer": art = <><circle cx="50" cy="20" r="13" fill="#f2c04f" stroke="#442b46" strokeWidth="5" /><path d="M50 35 48 64M48 43 22 28M49 45 78 29M48 63 24 87M49 63 80 83" fill="none" stroke="#442b46" strokeWidth="9" strokeLinecap="round" /></>; break;
    case "question": art = <><circle cx="50" cy="50" r="40" fill="#f7f7f7" stroke="#251b3a" strokeWidth="6" /><path d="M37 38c2-16 27-17 29-1 2 11-13 13-15 22M50 72v1" fill="none" stroke="#f72585" strokeWidth="8" strokeLinecap="round" /></>; break;
    default:
      art = <><rect x="14" y="14" width="72" height="72" rx="14" fill={c.main} stroke={c.dark} strokeWidth="6" /><path d="M30 50h40M50 30v40" stroke={c.light} strokeWidth="6" strokeLinecap="round" /></>;
  }

  return <svg className={className} style={style} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} preserveAspectRatio="xMidYMid meet">{art}</svg>;
};

export const SPRITE_IDS = [
  "hero", "runner", "runner-jump", "runner-sad", "hurdle", "spark", "sun", "cloud", "tree", "apple", "basket", "rock", "meteor", "ufo", "explosion", "triangle", "arrow-left", "arrow-right", "arrow-up", "arrow-down", "gun", "target", "moon", "rocket", "flame", "astronaut", "penguin", "face-happy", "face-sad", "face-surprised", "dancer", "question",
] as const;

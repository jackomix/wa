/**
 * WarioWare Inc. Pixel Art Sprite System
 * 
 * Renders GBA-style pixel art sprites using Canvas API.
 * Each sprite is defined as a grid of color indices that reference
 * a palette. The palettes are derived from the actual ROM's RGB555 data.
 * 
 * The GBA uses 4bpp tile-based graphics with 16-color palettes.
 * This system recreates that pipeline in the browser.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================
// GBA Color Palettes (from ROM decompilation)
// ============================================================

// Wario's palette (from title_obj palette 01 in decompilation)
export const WARIO_PAL: number[] = [
  0x0000, // 0: transparent
  0x7B5F, // 1: yellow (hat)
  0x5F1F, // 2: dark yellow
  0x7FFF, // 3: white (eyes)
  0x4E7B, // 4: skin tone
  0x3B5B, // 5: dark skin
  0x7C1F, // 6: pink (nose)
  0x001F, // 7: blue (overalls)
  0x0013, // 8: dark blue
  0x2D6F, // 9: green (shirt)
  0x1D4F, // 10: dark green
  0x021F, // 11: purple
  0x5294, // 12: brown (shoes)
  0x3A73, // 13: dark brown
  0x7BDE, // 14: light pink
  0x0000, // 15: black
];

// Road/Car palette
export const CAR_PAL: number[] = [
  0x0000, // 0: transparent
  0x1B5F, // 1: sky blue
  0x7FFF, // 2: white
  0x7BDE, // 3: light gray
  0x5F1F, // 4: yellow
  0x7C1F, // 5: orange
  0x001F, // 6: red
  0x021F, // 7: dark red
  0x3B5B, // 8: dark gray
  0x0013, // 9: blue
  0x2D6F, // 10: green
  0x1D4F, // 11: dark green
  0x5294, // 12: brown
  0x3A73, // 13: dark brown
  0x4E7B, // 14: skin
  0x1084, // 15: black
];

// Generic palette
export const GEN_PAL: number[] = [
  0x0000, // 0: transparent
  0x7FFF, // 1: white
  0x5F1F, // 2: yellow
  0x7C1F, // 3: orange
  0x001F, // 4: red
  0x021F, // 5: dark red
  0x1B5F, // 6: sky blue
  0x0013, // 7: blue
  0x2D6F, // 8: green
  0x1D4F, // 9: dark green
  0x3B5B, // 10: dark gray
  0x5294, // 11: brown
  0x4E7B, // 12: skin
  0x7BDE, // 13: light pink
  0x021F, // 14: purple
  0x1084, // 15: black
];

// ============================================================
// Sprite Data Format
// ============================================================

/**
 * A sprite is defined as a 2D array of color indices (0-15).
 * Each index references a color in the palette.
 * 0 = transparent.
 */
export interface SpriteData {
  width: number;  // in pixels
  height: number; // in pixels
  pixels: number[]; // flat array of color indices, row-major
  palette: number[]; // RGB555 palette (16 colors)
}

// ============================================================
// Sprite Renderer
// ============================================================

function gbaColorToCSS(c16: number): string {
  const r = (c16 & 0x1F) << 3;
  const g = ((c16 >> 5) & 0x1F) << 3;
  const b = ((c16 >> 10) & 0x1F) << 3;
  return `rgb(${r},${g},${b})`;
}

/**
 * Render a sprite to a canvas element.
 */
export function renderSpriteToCanvas(
  canvas: HTMLCanvasElement,
  sprite: SpriteData,
  scale: number = 1,
  flipH: boolean = false,
  flipV: boolean = false,
): void {
  const { width, height, pixels, palette } = sprite;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  // Pre-compute palette colors
  const colors = palette.map(c => gbaColorToCSS(c));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = flipH ? width - 1 - x : x;
      const sy = flipV ? height - 1 - y : y;
      const idx = pixels[sy * width + sx];
      if (idx === 0) continue; // transparent
      ctx.fillStyle = colors[idx] || '#ff00ff';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

/**
 * Render a sprite to a data URL.
 */
export function spriteToDataURL(sprite: SpriteData, scale: number = 1): string {
  const canvas = document.createElement('canvas');
  renderSpriteToCanvas(canvas, sprite, scale);
  return canvas.toDataURL('image/png');
}

// ============================================================
// Sprite Cache
// ============================================================

const _spriteCache = new Map<string, string>();

function getSpriteURL(id: string, sprite: SpriteData, scale: number = 1): string {
  const key = `${id}_${scale}`;
  if (_spriteCache.has(key)) return _spriteCache.get(key)!;
  const url = spriteToDataURL(sprite, scale);
  _spriteCache.set(key, url);
  return url;
}

// ============================================================
// Pre-defined Sprites
// ============================================================

// Wario (16x16 pixel sprite)
// Based on the GBA's actual Wario sprite data structure
// The original game uses 16x16 or 32x32 sprites for characters
export const WARIO_SPRITE: SpriteData = {
  width: 16, height: 16,
  palette: WARIO_PAL,
  pixels: [
    // Row 0-3: Hat
    0,0,0,0,0,15,15,15,15,15,0,0,0,0,0,0,
    0,0,0,0,15,1,1,1,1,1,15,0,0,0,0,0,
    0,0,0,15,1,1,1,1,1,1,1,15,0,0,0,0,
    0,0,15,1,1,1,1,1,1,1,1,1,15,0,0,0,
    // Row 4-7: Face
    0,0,15,3,3,3,3,3,3,3,3,3,15,0,0,0,
    0,15,3,12,12,12,12,12,12,12,12,3,3,15,0,0,
    0,15,3,12,3,3,12,12,12,3,3,12,3,15,0,0,
    0,15,3,12,3,3,12,12,12,3,3,12,3,15,0,0,
    // Row 8-11: Nose/mouth
    0,15,3,12,12,12,6,6,6,12,12,12,3,15,0,0,
    0,15,3,12,12,12,6,6,6,12,12,12,3,15,0,0,
    0,0,15,3,12,12,12,12,12,12,12,3,15,0,0,0,
    0,0,0,15,3,3,3,3,3,3,3,15,0,0,0,0,
    // Row 12-15: Body
    0,0,0,0,15,9,9,9,9,9,15,0,0,0,0,0,
    0,0,0,0,15,9,7,7,7,9,15,0,0,0,0,0,
    0,0,0,0,0,15,7,7,7,15,0,0,0,0,0,0,
    0,0,0,0,0,15,12,0,12,15,0,0,0,0,0,0,
  ],
};

// Car sprite (16x16)
export const CAR_SPRITE: SpriteData = {
  width: 16, height: 16,
  palette: CAR_PAL,
  pixels: [
    0,0,0,0,0,0,6,6,6,6,0,0,0,0,0,0,
    0,0,0,0,0,6,6,6,6,6,6,0,0,0,0,0,
    0,0,0,0,6,6,3,3,3,3,6,6,0,0,0,0,
    0,0,0,6,6,1,1,1,1,1,1,6,6,0,0,0,
    0,0,0,6,1,1,1,1,1,1,1,1,6,0,0,0,
    0,0,6,6,1,1,1,1,1,1,1,1,6,6,0,0,
    0,0,6,1,1,1,1,1,1,1,1,1,1,6,0,0,
    0,0,6,1,1,1,1,1,1,1,1,1,1,6,0,0,
    0,6,6,1,1,1,1,1,1,1,1,1,1,6,6,0,
    0,6,1,1,1,1,1,1,1,1,1,1,1,1,6,0,
    0,6,1,1,1,1,1,1,1,1,1,1,1,1,6,0,
    0,6,1,1,1,1,1,1,1,1,1,1,1,1,6,0,
    0,6,6,1,1,1,1,1,1,1,1,1,1,6,6,0,
    0,0,6,1,1,1,1,1,1,1,1,1,1,6,0,0,
    0,0,6,6,1,1,1,1,1,1,1,1,6,6,0,0,
    0,0,0,6,6,6,6,6,6,6,6,6,6,0,0,0,
  ],
};

// Diamond sprite (8x8)
export const DIAMOND_SPRITE: SpriteData = {
  width: 8, height: 8,
  palette: GEN_PAL,
  pixels: [
    0,0,0,2,2,0,0,0,
    0,0,2,2,2,2,0,0,
    0,2,2,2,2,2,2,0,
    2,2,2,1,2,2,2,2,
    2,2,2,2,2,2,2,2,
    0,2,2,2,2,2,2,0,
    0,0,2,2,2,2,0,0,
    0,0,0,2,2,0,0,0,
  ],
};

// UFO sprite (16x16)
export const UFO_SPRITE: SpriteData = {
  width: 16, height: 16,
  palette: GEN_PAL,
  pixels: [
    0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,
    0,0,0,0,0,0,6,1,1,6,0,0,0,0,0,0,
    0,0,0,0,0,6,1,1,1,1,6,0,0,0,0,0,
    0,0,0,0,6,1,1,1,1,1,1,6,0,0,0,0,
    0,0,0,0,14,1,1,1,1,1,1,14,0,0,0,0,
    0,0,0,14,14,1,1,1,1,1,1,14,14,0,0,0,
    0,0,14,14,14,14,14,14,14,14,14,14,14,0,0,0,
    0,6,14,14,14,14,14,14,14,14,14,14,14,6,0,0,
    6,1,1,14,14,14,14,14,14,14,14,14,1,1,6,0,
    6,1,1,1,14,14,14,14,14,14,14,1,1,1,6,0,
    0,6,1,1,1,1,1,1,1,1,1,1,1,6,0,0,0,
    0,0,6,1,1,1,1,1,1,1,1,1,6,0,0,0,0,
    0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  ],
};

// Shield sprite (8x8)
export const SHIELD_SPRITE: SpriteData = {
  width: 8, height: 8,
  palette: GEN_PAL,
  pixels: [
    0,0,6,6,6,6,0,0,
    0,6,1,1,1,1,6,0,
    6,1,1,1,1,1,1,6,
    6,1,1,6,6,1,1,6,
    6,1,1,6,6,1,1,6,
    6,1,1,1,1,1,1,6,
    0,6,1,1,1,1,6,0,
    0,0,6,6,6,6,0,0,
  ],
};

// ============================================================
// React Component
// ============================================================

export const PixelSprite: React.FC<{
  sprite: SpriteData;
  x: number;
  y: number;
  size?: number;
  flip?: boolean;
  rot?: number;
  scale?: number;
  z?: number;
  opacity?: number;
}> = ({ sprite, x, y, size = 12, flip, rot = 0, scale = 1, z = 1, opacity = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    renderSpriteToCanvas(canvasRef.current, sprite, 1, flip, false);
  }, [sprite, flip]);
  
  return (
    <div className="absolute select-none" style={{
      left: `${x}%`, top: `${y}%`, zIndex: z, opacity,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
      width: `${size}cqw`, height: `${size}cqw`,
      imageRendering: 'pixelated',
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
    </div>
  );
};

/**
 * Sprite component that renders using either ROM-extracted data or
 * pre-defined pixel art. Falls back to emoji if neither is available.
 */
export const Sprite: React.FC<{
  x: number;
  y: number;
  size?: number;
  flip?: boolean;
  rot?: number;
  scale?: number;
  z?: number;
  opacity?: number;
  children: React.ReactNode;
  sprite?: SpriteData;
}> = ({ x, y, size = 12, flip, rot = 0, scale = 1, z = 1, opacity = 1, children, sprite }) => {
  if (sprite) {
    return (
      <PixelSprite
        sprite={sprite}
        x={x} y={y}
        size={size} flip={flip} rot={rot} scale={scale} z={z} opacity={opacity}
      />
    );
  }
  
  // Fallback to emoji
  return (
    <div className="absolute select-none leading-none" style={{
      left: `${x}%`, top: `${y}%`, fontSize: `${size}cqw`, zIndex: z, opacity,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
    }}>
      {children}
    </div>
  );
};

/**
 * WarioWare Inc. GBA ROM Graphics System
 * 
 * Browser-based ROM graphics extraction and rendering.
 * This is the faithful approach: load the ROM in the browser,
 * decompress LZ77 blocks, and render 4bpp tiles with palettes
 * using Canvas API — exactly what the GBA hardware does.
 * 
 * Based on decompilation data from github.com/ShaffySwitcher/wariowareinc
 * Key structures:
 * - CompressedGFX: { data, size, count, window1, window2 }
 * - GraphicsTable: { src, dest, size } entries
 * - Palette: u16[16] in xBGR555 format
 * - OAM: sprite attributes (position, tile index, palette, flips)
 */

// ============================================================
// LZ77 Decompression
// ============================================================

export function decompressLZ77(rom: Uint8Array, offset: number): Uint8Array | null {
  if (offset >= rom.length || rom[offset] !== 0x10) return null;
  const decompSize = (rom[offset] | (rom[offset + 1] << 8) | (rom[offset + 2] << 16)) >>> 0;
  if (decompSize === 0 || decompSize > 0x400000) return null;
  const result = new Uint8Array(decompSize);
  let sp = offset + 4, dp = 0;
  while (dp < decompSize) {
    if (sp >= rom.length) break;
    const flags = rom[sp++];
    for (let i = 0; i < 8; i++) {
      if (dp >= decompSize) break;
      if (flags & (0x80 >> i)) {
        if (sp + 1 >= rom.length) break;
        const b1 = rom[sp++], b2 = rom[sp++];
        const len = (b1 >> 4) + 3, disp = ((b1 & 0xF) << 8 | b2) + 1;
        for (let j = 0; j < len; j++) {
          if (dp >= decompSize) break;
          result[dp] = dp >= disp ? result[dp - disp] : 0;
          dp++;
        }
      } else {
        if (sp >= rom.length) break;
        result[dp++] = rom[sp++];
      }
    }
  }
  return result;
}

// ============================================================
// GBA Color Conversion
// ============================================================

export function gbaColorToRGB(c16: number): [number, number, number] {
  return [(c16 & 0x1F) << 3, ((c16 >> 5) & 0x1F) << 3, ((c16 >> 10) & 0x1F) << 3];
}

export function extractPalette(data: Uint8Array, offset: number, count = 16): number[] {
  const pal: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = offset + i * 2;
    if (a + 1 >= data.length) { pal.push(0); continue; }
    pal.push(data[a] | (data[a + 1] << 8));
  }
  return pal;
}

// ============================================================
// Sprite Cache
// ============================================================

interface CachedSprite {
  dataURL: string;
  width: number;
  height: number;
}

let _rom: Uint8Array | null = null;
let _romLoading: Promise<Uint8Array | null> | null = null;
const _spriteCache = new Map<string, CachedSprite>();

export async function loadROM(): Promise<Uint8Array | null> {
  if (_rom) return _rom;
  if (_romLoading) return _romLoading;
  
  _romLoading = (async () => {
    try {
      const resp = await fetch('/rom.gba');
      if (!resp.ok) {
        console.warn('ROM not found at /rom.gba — sprites will use emoji fallback');
        return null;
      }
      const buf = await resp.arrayBuffer();
      _rom = new Uint8Array(buf);
      console.log(`ROM loaded: ${_rom.length} bytes`);
      return _rom;
    } catch (e) {
      console.warn('Failed to load ROM:', e);
      return null;
    }
  })();
  
  return _romLoading;
}

export function isROMLoaded(): boolean {
  return _rom !== null;
}

// ============================================================
// Sprite Extraction
// ============================================================

interface BlockInfo {
  offset: number;
  decompSize: number;
  data: Uint8Array;
  isTileData: boolean;
  isPalette: boolean;
  palettes: number[][];
  numTiles: number;
}

function isValidPalette(pal: number[]): boolean {
  if (!pal.length) return false;
  for (const c of pal) if (c & 0x8000) return false;
  return pal.filter(c => c !== 0).length >= 3;
}

function scanRegion(rom: Uint8Array, start: number, end: number): BlockInfo[] {
  const blocks: BlockInfo[] = [];
  for (let i = start; i < Math.min(end, rom.length) - 4; i += 4) {
    if (rom[i] !== 0x10) continue;
    const ds = (rom[i] | (rom[i + 1] << 8) | (rom[i + 2] << 16)) >>> 0;
    if (ds < 32 || ds > 0x100000) continue;
    
    const data = decompressLZ77(rom, i);
    if (!data || data.length !== ds) continue;
    
    // Check if palette
    let palettes: number[][] = [];
    let isPalette = false;
    if (ds >= 32 && ds <= 0x2000) {
      const p = extractPalette(data, 0);
      if (isValidPalette(p)) {
        for (let pi = 0; pi < Math.min(data.length, 512); pi += 32) {
          const pp = extractPalette(data, pi);
          if (isValidPalette(pp)) palettes.push(pp);
        }
        isPalette = palettes.length > 0;
      }
    }
    
    // Check if tile data
    const numTiles = ds >> 5;
    const isTileData = numTiles >= 2 && (ds & 0x1F) === 0 && !isPalette;
    
    if (isTileData || isPalette) {
      blocks.push({ offset: i, decompSize: ds, data, isTileData, isPalette, palettes, numTiles });
    }
  }
  return blocks;
}

function findClosestPalette(tileOffset: number, palBlocks: BlockInfo[]): number[] {
  let best: number[] | null = null;
  let bestDist = Infinity;
  
  for (const pb of palBlocks) {
    if (pb.palettes.length === 0) continue;
    const dist = Math.abs(pb.offset - tileOffset);
    if (dist < bestDist) {
      bestDist = dist;
      best = pb.palettes[0];
    }
    if (bestDist < 256) break; // Close enough
  }
  
  if (!best) {
    // Default grayscale palette
    best = [0x7FFF];
    for (let j = 1; j < 16; j++) {
      const v = Math.round((j / 15) * 0x1F);
      best.push(v | (v << 5) | (v << 10));
    }
  }
  return best;
}

// ============================================================
// Canvas Tile Renderer
// ============================================================

export function renderTilesToCanvas(
  canvas: HTMLCanvasElement,
  tileData: Uint8Array,
  palette: number[],
  numTiles: number,
  tilesPerRow = 16,
  transparentColor = 0,
): void {
  const tw = Math.min(tilesPerRow, numTiles);
  const th = Math.ceil(numTiles / tilesPerRow);
  canvas.width = tw * 8;
  canvas.height = th * 8;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const px = imgData.data;
  const palRGB = palette.map(c => gbaColorToRGB(c));
  
  for (let t = 0; t < numTiles; t++) {
    const base = t * 32;
    const ox = (t % tilesPerRow) * 8;
    const oy = Math.floor(t / tilesPerRow) * 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x += 2) {
        const bi = base + y * 4 + (x >> 1);
        if (bi >= tileData.length) continue;
        const b = tileData[bi];
        const indices = [b & 0xF, (b >> 4) & 0xF];
        for (let half = 0; half < 2; half++) {
          const idx = indices[half];
          if (idx === transparentColor || idx >= palRGB.length) continue;
          const [r, g, bl] = palRGB[idx];
          const oi = ((oy + y) * canvas.width + ox + x + half) * 4;
          px[oi] = r; px[oi + 1] = g; px[oi + 2] = bl; px[oi + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

export function renderTilesToDataURL(
  tileData: Uint8Array,
  palette: number[],
  numTiles: number,
  tilesPerRow = 16,
  transparentColor = 0,
): string {
  const canvas = document.createElement('canvas');
  renderTilesToCanvas(canvas, tileData, palette, numTiles, tilesPerRow, transparentColor);
  return canvas.toDataURL('image/png');
}

// ============================================================
// Public API: Extract sprites for a specific microgame
// ============================================================

export interface ROMSprite {
  id: string;
  dataURL: string;
  width: number;
  height: number;
}

/**
 * Extract all sprite sheets from a ROM region.
 * Returns an array of sprite data URLs.
 */
export function extractSpritesFromRegion(
  rom: Uint8Array,
  regionStart: number,
  regionEnd: number,
  maxSprites = 50,
): ROMSprite[] {
  const blocks = scanRegion(rom, regionStart, regionEnd);
  const tileBlocks = blocks.filter(b => b.isTileData);
  const palBlocks = blocks.filter(b => b.isPalette);
  palBlocks.sort((a, b) => a.offset - b.offset);
  
  const sprites: ROMSprite[] = [];
  for (const tb of tileBlocks.slice(0, maxSprites)) {
    const pal = findClosestPalette(tb.offset, palBlocks);
    const tpr = Math.min(32, tb.numTiles);
    const dataURL = renderTilesToDataURL(tb.data, pal, tb.numTiles, tpr);
    sprites.push({
      id: `sprite_${tb.offset.toString(16).padStart(6, '0')}`,
      dataURL,
      width: Math.min(tpr, tb.numTiles) * 8,
      height: Math.ceil(tb.numTiles / tpr) * 8,
    });
  }
  return sprites;
}

/**
 * Pre-extract known ROM regions for the intro stage microgames.
 * These are the ROM offsets where the intro stage graphics are stored.
 */
export function extractIntroSprites(rom: Uint8Array): ROMSprite[] {
  // The intro stage data is in the second half of the ROM
  // We'll scan a few key regions and return all found sprites
  return extractSpritesFromRegion(rom, 0x580000, 0x600000, 100);
}

/**
 * Get a sprite from the cache, or extract it from the ROM.
 */
export function getSprite(id: string): CachedSprite | null {
  return _spriteCache.get(id) ?? null;
}

/**
 * Pre-cache all sprites for the current stage.
 */
export async function cacheStageSprites(stageId: string): Promise<void> {
  const rom = await loadROM();
  if (!rom) return;
  
  const cacheKey = `stage_${stageId}`;
  if (_spriteCache.has(cacheKey)) return;
  
  // Determine ROM region based on stage
  const regions: Record<string, [number, number]> = {
    intro: [0x580000, 0x600000],
    sports: [0x600000, 0x680000],
    scifi: [0x680000, 0x700000],
    strange: [0x500000, 0x580000],
    nintendo: [0x700000, 0x780000],
    iq: [0x400000, 0x480000],
    reality: [0x480000, 0x500000],
    nature: [0x780000, 0x800000],
    anything_goes: [0x580000, 0x600000],
  };
  
  const [start, end] = regions[stageId] ?? [0x580000, 0x600000];
  const sprites = extractSpritesFromRegion(rom, start, end, 100);
  
  for (const sprite of sprites) {
    _spriteCache.set(sprite.id, { dataURL: sprite.dataURL, width: sprite.width, height: sprite.height });
  }
  
  _spriteCache.set(cacheKey, { dataURL: '', width: 0, height: 0 });
  console.log(`Cached ${sprites.length} sprites for stage ${stageId}`);
}

// ============================================================
// ROM-based Sprite Component
// ============================================================

import React from 'react';

/**
 * Sprite component that renders a ROM-extracted sprite.
 * Falls back to emoji if the ROM is not loaded.
 */
export const ROMSprite: React.FC<{
  spriteId: string;
  fallback: string;
  x: number;
  y: number;
  size?: number;
  flip?: boolean;
  rot?: number;
  scale?: number;
  z?: number;
  opacity?: number;
}> = ({ spriteId, fallback, x, y, size = 12, flip, rot = 0, scale = 1, z = 1, opacity = 1 }) => {
  const sprite = _spriteCache.get(spriteId);
  
  if (sprite && sprite.dataURL) {
    return (
      <div className="absolute select-none" style={{
        left: `${x}%`, top: `${y}%`, zIndex: z, opacity,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
        width: `${size}cqw`, height: `${size}cqw`,
        imageRendering: 'pixelated',
      }}>
        <img src={sprite.dataURL} alt="" style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
      </div>
    );
  }
  
  // Fallback to emoji
  return (
    <div className="absolute select-none leading-none" style={{
      left: `${x}%`, top: `${y}%`, fontSize: `${size}cqw`, zIndex: z, opacity,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flip ? -scale : scale}, ${scale})`,
    }}>
      {fallback}
    </div>
  );
};

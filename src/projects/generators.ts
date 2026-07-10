import { createLayer, transparentPixels, uid } from "./factory";
import type { PixelAsset } from "./types";

export type EffectKind = "fire" | "smoke" | "magic" | "splash" | "impact" | "glow";
export type UiKitKind = "dialogue" | "button" | "health" | "cursor" | "inventory";

const pixel = (pixels: string[], width: number, height: number, x: number, y: number, color: string) => {
  if (x >= 0 && y >= 0 && x < width && y < height) pixels[y * width + x] = color;
};

const rect = (pixels: string[], width: number, height: number, x: number, y: number, w: number, h: number, color: string) => {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) pixel(pixels, width, height, xx, yy, color);
  }
};

const disc = (pixels: string[], width: number, height: number, cx: number, cy: number, radius: number, color: string) => {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) pixel(pixels, width, height, x, y, color);
    }
  }
};

const assetFromFrames = (name: string, width: number, height: number, framesPixels: string[][], durationMs = 110, tags: string[] = []) => {
  const layer = createLayer("Art", width, height);
  layer.pixels = [...(framesPixels[0] ?? transparentPixels(width, height))];
  return {
    id: uid("asset"),
    name,
    width,
    height,
    layers: [layer],
    frames: framesPixels.map((pixels, index) => ({
      id: uid("frame"),
      name: `Frame ${index + 1}`,
      durationMs,
      layerIds: [layer.id],
      cels: { [layer.id]: pixels },
      tags,
    })),
    tags,
    pivot: { x: Math.floor(width / 2), y: height - 1 },
  } satisfies PixelAsset;
};

export const createEffectAsset = (kind: EffectKind, primary = "#60a5fa", secondary = "#fef3c7"): PixelAsset => {
  const width = 24;
  const height = 24;
  const frames = Array.from({ length: 6 }, (_, frameIndex) => {
    const pixels = transparentPixels(width, height);
    const phase = frameIndex / 5;
    if (kind === "fire") {
      const wobble = frameIndex % 2 ? 1 : -1;
      for (let y = 7; y < 22; y += 1) {
        const half = Math.max(1, Math.floor((y - 5) * 0.42));
        rect(pixels, width, height, 12 - half + wobble, y, half * 2, 1, y > 15 ? "#ef4444" : "#fb923c");
      }
      rect(pixels, width, height, 10 + wobble, 12, 4, 9, "#fde047");
      pixel(pixels, width, height, 12 - wobble, 5 + (frameIndex % 3), "#fef3c7");
    } else if (kind === "smoke") {
      const rise = frameIndex * 2;
      disc(pixels, width, height, 10, 20 - rise, 4, "#64748b");
      disc(pixels, width, height, 15, 17 - rise, 3.5, "#94a3b8");
      disc(pixels, width, height, 11, 13 - rise, 3, "#cbd5e1");
    } else if (kind === "magic") {
      const radius = 3 + frameIndex * 1.6;
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = (ray / 8) * Math.PI * 2 + phase;
        const x = Math.round(12 + Math.cos(angle) * radius);
        const y = Math.round(12 + Math.sin(angle) * radius);
        pixel(pixels, width, height, x, y, ray % 2 ? primary : secondary);
        if (frameIndex % 2 === 0) pixel(pixels, width, height, x + 1, y, primary);
      }
      disc(pixels, width, height, 12, 12, Math.max(1, 3 - frameIndex * 0.3), secondary);
    } else if (kind === "splash") {
      const radius = 2 + frameIndex * 1.7;
      for (let ray = 0; ray < 7; ray += 1) {
        const angle = Math.PI + (ray / 6) * Math.PI;
        const x = Math.round(12 + Math.cos(angle) * radius);
        const y = Math.round(17 + Math.sin(angle) * radius * 0.75);
        pixel(pixels, width, height, x, y, ray % 2 ? "#bae6fd" : primary);
        pixel(pixels, width, height, x, y + 1, primary);
      }
      rect(pixels, width, height, 6 + frameIndex, 19, Math.max(2, 12 - frameIndex * 2), 2, "#38bdf8");
    } else if (kind === "impact") {
      const radius = 2 + frameIndex * 1.8;
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = (ray / 8) * Math.PI * 2;
        for (let step = Math.max(1, Math.floor(radius - 2)); step <= radius; step += 1) {
          pixel(pixels, width, height, Math.round(12 + Math.cos(angle) * step), Math.round(12 + Math.sin(angle) * step), ray % 2 ? primary : secondary);
        }
      }
      if (frameIndex < 3) disc(pixels, width, height, 12, 12, 3 - frameIndex, "#ffffff");
    } else {
      const radius = 4 + Math.round(Math.sin(phase * Math.PI) * 5);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const distance = Math.sqrt((x - 12) ** 2 + (y - 12) ** 2);
          if (Math.abs(distance - radius) < 1.1) pixel(pixels, width, height, x, y, primary);
        }
      }
      disc(pixels, width, height, 12, 12, 2, secondary);
    }
    return pixels;
  });
  const labels: Record<EffectKind, string> = { fire: "Fire Burst", smoke: "Smoke Puff", magic: "Magic Spark", splash: "Water Splash", impact: "Impact Flash", glow: "Pulse Glow" };
  return assetFromFrames(labels[kind], width, height, frames, kind === "smoke" ? 150 : 95, ["effect", kind, "generated"]);
};

export const createCharacterAsset = (
  name: string,
  colors: { skin: string; hair: string; shirt: string; trousers: string },
): PixelAsset => {
  const width = 32;
  const height = 32;
  const outline = "#20243a";
  const frames = Array.from({ length: 4 }, (_, frameIndex) => {
    const pixels = transparentPixels(width, height);
    const bob = frameIndex % 2;
    rect(pixels, width, height, 11, 4 + bob, 10, 9, outline);
    rect(pixels, width, height, 12, 5 + bob, 8, 7, colors.skin);
    rect(pixels, width, height, 11, 3 + bob, 10, 4, colors.hair);
    rect(pixels, width, height, 10, 13 + bob, 12, 10, outline);
    rect(pixels, width, height, 11, 14 + bob, 10, 8, colors.shirt);
    rect(pixels, width, height, 8, 15 + bob, 3, 8, colors.skin);
    rect(pixels, width, height, 21, 15 + bob, 3, 8, colors.skin);
    const leftStep = frameIndex === 0 ? -2 : frameIndex === 2 ? 2 : 0;
    const rightStep = -leftStep;
    rect(pixels, width, height, 11 + leftStep, 22, 4, 7, outline);
    rect(pixels, width, height, 12 + leftStep, 22, 3, 6, colors.trousers);
    rect(pixels, width, height, 17 + rightStep, 22, 4, 7, outline);
    rect(pixels, width, height, 17 + rightStep, 22, 3, 6, colors.trousers);
    pixel(pixels, width, height, 14, 8 + bob, outline);
    pixel(pixels, width, height, 18, 8 + bob, outline);
    return pixels;
  });
  return assetFromFrames(name || "Generated Character", width, height, frames, 140, ["character", "walk", "generated"]);
};

const drawPanel = (pixels: string[], width: number, height: number, accent: string) => {
  rect(pixels, width, height, 1, 1, width - 2, height - 2, "#111827");
  rect(pixels, width, height, 3, 3, width - 6, height - 6, accent);
  rect(pixels, width, height, 5, 5, width - 10, height - 10, "#f8fafc");
};

export const createUiKitAsset = (kind: UiKitKind, accent = "#60a5fa"): PixelAsset => {
  const sizes: Record<UiKitKind, [number, number]> = {
    dialogue: [64, 32],
    button: [48, 16],
    health: [64, 16],
    cursor: [16, 16],
    inventory: [64, 64],
  };
  const [width, height] = sizes[kind];
  const pixels = transparentPixels(width, height);
  if (kind === "dialogue" || kind === "button") {
    drawPanel(pixels, width, height, accent);
    if (kind === "dialogue") {
      for (let row = 0; row < 3; row += 1) rect(pixels, width, height, 9, 10 + row * 5, 36 - row * 4, 2, "#334155");
      rect(pixels, width, height, 51, 22, 4, 4, accent);
    }
  } else if (kind === "health") {
    drawPanel(pixels, width, height, accent);
    for (let heart = 0; heart < 5; heart += 1) {
      const x = 7 + heart * 10;
      rect(pixels, width, height, x, 6, 7, 5, "#ef4444");
      pixel(pixels, width, height, x, 6, "transparent");
      pixel(pixels, width, height, x + 6, 6, "transparent");
      pixel(pixels, width, height, x + 3, 11, "#ef4444");
    }
  } else if (kind === "cursor") {
    for (let y = 1; y < 13; y += 1) for (let x = 1; x <= Math.min(8, y); x += 1) pixel(pixels, width, height, x, y, x === 1 || x === y || y === 12 ? "#111827" : "#f8fafc");
    rect(pixels, width, height, 7, 10, 3, 5, accent);
  } else {
    drawPanel(pixels, width, height, accent);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        rect(pixels, width, height, 7 + col * 13, 7 + row * 13, 11, 11, "#1e293b");
        rect(pixels, width, height, 9 + col * 13, 9 + row * 13, 7, 7, "#cbd5e1");
      }
    }
  }
  const names: Record<UiKitKind, string> = { dialogue: "Dialogue Panel", button: "Pixel Button", health: "Health Bar", cursor: "Game Cursor", inventory: "Inventory Panel" };
  return assetFromFrames(names[kind], width, height, [pixels], 160, ["ui", kind, "generated"]);
};

export const createTerrainSetAssets = (source: PixelAsset): PixelAsset[] => {
  const slots = ["NW", "N", "NE", "W", "Center", "E", "SW", "S", "SE"];
  return slots.map((slot) => ({
    ...source,
    id: uid("asset"),
    name: `${source.name} ${slot}`,
    favorite: false,
    tags: [...new Set([...(source.tags ?? []), "terrain", `terrain-set:${source.id}`, slot.toLowerCase()])],
    layers: source.layers.map((layer) => ({ ...layer, id: uid("layer"), pixels: [...layer.pixels] })),
    frames: [],
  })).map((asset) => {
    const layerIds = asset.layers.map((layer) => layer.id);
    const sourceFrame = source.frames[0];
    return {
      ...asset,
      frames: [{
        id: uid("frame"),
        name: "Frame 1",
        durationMs: sourceFrame?.durationMs ?? 160,
        layerIds,
        cels: Object.fromEntries(asset.layers.map((layer, index) => {
          const sourceLayer = source.layers[index];
          const sourcePixels = sourceLayer ? sourceFrame?.cels?.[sourceLayer.id] ?? sourceLayer.pixels : layer.pixels;
          return [layer.id, [...sourcePixels]];
        })),
      }],
    };
  });
};

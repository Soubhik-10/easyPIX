import type { PixelAsset, PixelLayer, PixelProject, Scene, Tileset } from "./types";

export const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;

export const transparentPixels = (width: number, height: number) =>
  Array.from({ length: width * height }, () => "transparent");

export const createLayer = (name = "Layer 1", width = 32, height = 32): PixelLayer => ({
  id: uid("layer"),
  name,
  visible: true,
  locked: false,
  opacity: 1,
  pixels: transparentPixels(width, height),
});

export const createAsset = (name = "Untitled Sprite", width = 64, height = 64): PixelAsset => {
  const layer = createLayer("Ink", width, height);
  return {
    id: uid("asset"),
    name,
    width,
    height,
    layers: [layer],
    frames: [{ id: uid("frame"), name: "Frame 1", durationMs: 160, layerIds: [layer.id] }],
  };
};

export type TemplateKind = "grass" | "flower" | "water" | "path" | "coin" | "hero";

const putPixel = (pixels: string[], width: number, x: number, y: number, color: string) => {
  pixels[y * width + x] = color;
};

const fillRect = (pixels: string[], width: number, x: number, y: number, rectWidth: number, rectHeight: number, color: string) => {
  for (let yy = y; yy < y + rectHeight; yy += 1) {
    for (let xx = x; xx < x + rectWidth; xx += 1) putPixel(pixels, width, xx, yy, color);
  }
};

export const createTemplateAsset = (kind: TemplateKind): PixelAsset => {
  const size = 16;
  const pixels = transparentPixels(size, size);
  const names: Record<TemplateKind, string> = {
    grass: "Template Grass Tile",
    flower: "Template Flower Tile",
    water: "Template Water Tile",
    path: "Template Dirt Path",
    coin: "Template Coin",
    hero: "Template Tiny Hero",
  };

  if (kind === "grass" || kind === "flower") {
    pixels.fill("#5a8f3d");
    for (let i = 0; i < pixels.length; i += 1) if ((i + Math.floor(i / size)) % 5 === 0) pixels[i] = "#9bd16f";
    if (kind === "flower") {
      fillRect(pixels, size, 7, 6, 2, 5, "#3f6f34");
      putPixel(pixels, size, 7, 5, "#e36f8c");
      putPixel(pixels, size, 8, 5, "#e36f8c");
      putPixel(pixels, size, 6, 6, "#f0a3a3");
      putPixel(pixels, size, 9, 6, "#f0a3a3");
      putPixel(pixels, size, 8, 6, "#f5c16c");
    }
  }

  if (kind === "water") {
    pixels.fill("#4f7cc8");
    for (let y = 2; y < size; y += 5) {
      for (let x = 1; x < size - 1; x += 1) if ((x + y) % 3 !== 0) putPixel(pixels, size, x, y, "#88c7e8");
    }
    for (let x = 0; x < size; x += 4) putPixel(pixels, size, x, 13, "#2f5fa8");
  }

  if (kind === "path") {
    pixels.fill("#5a8f3d");
    for (let y = 0; y < size; y += 1) {
      const left = Math.max(0, 4 - Math.floor(y / 6));
      const right = Math.min(size - 1, 11 + Math.floor(y / 6));
      for (let x = left; x <= right; x += 1) putPixel(pixels, size, x, y, (x + y) % 4 === 0 ? "#f5c16c" : "#c77d3b");
    }
  }

  if (kind === "coin") {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 6.5) putPixel(pixels, size, x, y, d > 5.2 ? "#c77d3b" : "#f5c16c");
      }
    }
    fillRect(pixels, size, 7, 4, 2, 8, "#fff2a8");
    putPixel(pixels, size, 5, 5, "#fff2a8");
  }

  if (kind === "hero") {
    fillRect(pixels, size, 6, 2, 4, 4, "#f0a3a3");
    fillRect(pixels, size, 5, 1, 6, 2, "#1f1f29");
    fillRect(pixels, size, 5, 6, 6, 5, "#4f7cc8");
    fillRect(pixels, size, 4, 7, 2, 4, "#88c7e8");
    fillRect(pixels, size, 10, 7, 2, 4, "#88c7e8");
    fillRect(pixels, size, 5, 11, 2, 3, "#6b3f2a");
    fillRect(pixels, size, 9, 11, 2, 3, "#6b3f2a");
    putPixel(pixels, size, 7, 4, "#1f1f29");
    putPixel(pixels, size, 9, 4, "#1f1f29");
  }

  const layer = { ...createLayer("Template", size, size), pixels };
  return {
    id: uid("asset"),
    name: names[kind],
    width: size,
    height: size,
    layers: [layer],
    frames: [{ id: uid("frame"), name: "Frame 1", durationMs: 160, layerIds: [layer.id] }],
  };
};

export const createScene = (tileSize = 32): Scene => ({
  id: uid("scene"),
  name: "Sandbox Scene",
  width: 20,
  height: 14,
  tileSize,
  activeLayer: "ground",
  layers: {
    ground: Array.from({ length: 160 }, () => null),
    objects: Array.from({ length: 160 }, () => null),
    overlay: Array.from({ length: 160 }, () => null),
  },
});

export const createTileset = (assetId: string): Tileset => ({
  id: uid("tileset"),
  name: "Main Tileset",
  tileWidth: 64,
  tileHeight: 64,
  assetIds: [assetId],
});

export const createProject = (name = "New Pixel Project"): PixelProject => {
  const asset = createAsset("Sprite 1", 64, 64);
  const palette = {
    id: uid("palette"),
    name: "Starter Palette",
    colors: [
      "#1f1f29",
      "#ffffff",
      "#6b3f2a",
      "#c77d3b",
      "#f5c16c",
      "#5a8f3d",
      "#9bd16f",
      "#4f7cc8",
      "#88c7e8",
      "#b86acb",
      "#e36f8c",
      "#f0a3a3",
    ],
  };
  return {
    id: uid("project"),
    name,
    version: 1,
    palettes: [palette],
    assets: [{ ...asset, paletteId: palette.id }],
    tilesets: [createTileset(asset.id)],
    scenes: [createScene(32)],
    updatedAt: new Date().toISOString(),
  };
};

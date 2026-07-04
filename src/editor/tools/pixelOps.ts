import type { PixelLayer, Selection } from "../../projects/types";

export type StampKind = "heart" | "star" | "leaf" | "flower" | "sparkle" | "rock" | "mushroom" | "fence" | "window" | "door" | "bottle" | "lamp" | "book" | "chair" | "sign";
export type CozyBrushKind = "grass" | "flower" | "dirt" | "water" | "stars" | "fireflies" | "snow" | "rain";
export type PixelEffect = "outline" | "shadow" | "clean" | "readable" | "contrast" | "highlight" | "cozy" | "reduceColors";
export type StampColors = { primary: string; accent: string; outline?: string };

export const indexAt = (x: number, y: number, width: number) => y * width + x;

export const setPixel = (pixels: string[], width: number, height: number, x: number, y: number, color: string) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return pixels;
  const next = [...pixels];
  next[indexAt(x, y, width)] = color;
  return next;
};

export const adjustColor = (color: string, amount: number) => {
  if (!color.startsWith("#") || color.length !== 7) return color;
  const value = Number.parseInt(color.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, channel + amount)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};

const isSolid = (color: string | undefined) => Boolean(color && color !== "transparent");

const normalizeSelection = (width: number, height: number, selection?: Selection) => ({
  x: Math.max(0, selection?.x ?? 0),
  y: Math.max(0, selection?.y ?? 0),
  width: Math.max(1, Math.min(width, selection?.width ?? width)),
  height: Math.max(1, Math.min(height, selection?.height ?? height)),
});

export const drawBrush = (
  pixels: string[],
  width: number,
  height: number,
  x: number,
  y: number,
  color: string,
  size: number,
  shape: "square" | "circle",
) => {
  let next = [...pixels];
  const radius = Math.floor(size / 2);
  for (let yy = -radius; yy <= radius; yy += 1) {
    for (let xx = -radius; xx <= radius; xx += 1) {
      if (shape === "circle" && Math.sqrt(xx * xx + yy * yy) > radius + 0.25) continue;
      next = setPixel(next, width, height, x + xx, y + yy, color);
    }
  }
  return next;
};

export const sprayBrush = (
  pixels: string[],
  width: number,
  height: number,
  x: number,
  y: number,
  color: string,
  size: number,
) => {
  let next = [...pixels];
  const radius = Math.max(2, size);
  for (let i = 0; i < radius * 3; i += 1) {
    const angle = ((x * 31 + y * 17 + i * 53) % 360) * (Math.PI / 180);
    const distance = ((x * 13 + y * 29 + i * 7) % (radius * 10)) / 10;
    next = setPixel(next, width, height, Math.round(x + Math.cos(angle) * distance), Math.round(y + Math.sin(angle) * distance), color);
  }
  return next;
};

export const ditherBrush = (
  pixels: string[],
  width: number,
  height: number,
  x: number,
  y: number,
  color: string,
  size: number,
  shape: "square" | "circle",
) => {
  let next = [...pixels];
  const radius = Math.floor(size / 2);
  for (let yy = -radius; yy <= radius; yy += 1) {
    for (let xx = -radius; xx <= radius; xx += 1) {
      if ((x + xx + y + yy) % 2 !== 0) continue;
      if (shape === "circle" && Math.sqrt(xx * xx + yy * yy) > radius + 0.25) continue;
      next = setPixel(next, width, height, x + xx, y + yy, color);
    }
  }
  return next;
};

export const magicInkBrush = (pixels: string[], width: number, height: number, x: number, y: number, color: string, size: number, shape: "square" | "circle") => {
  let next = drawBrush(pixels, width, height, x, y, color, size, shape);
  next = drawBrush(next, width, height, x - 1, y - 1, adjustColor(color, 38), Math.max(1, Math.floor(size / 2)), shape);
  return drawBrush(next, width, height, x + 1, y + 1, adjustColor(color, -46), Math.max(1, Math.floor(size / 2)), shape);
};

export const colorRampBrush = (pixels: string[], width: number, height: number, x: number, y: number, color: string, size: number, shape: "square" | "circle") => {
  let next = drawBrush(pixels, width, height, x, y, color, size, shape);
  next = drawBrush(next, width, height, x - 1, y - 1, adjustColor(color, 48), 1, "square");
  next = drawBrush(next, width, height, x + 1, y + 1, adjustColor(color, -56), 1, "square");
  return next;
};

export const cozyBrush = (pixels: string[], width: number, height: number, x: number, y: number, color: string, size: number, kind: CozyBrushKind) => {
  let next = [...pixels];
  const radius = Math.max(2, size + 1);
  const marks = radius * 3;
  const palette: Record<CozyBrushKind, string[]> = {
    grass: [color, adjustColor(color, 34), adjustColor(color, -28)],
    flower: [color, "#f472b6", "#facc15", "#86efac"],
    dirt: [color, "#8b5a2b", "#c08457", "#5f3b24"],
    water: [color, "#38bdf8", "#0ea5e9", "#dbeafe"],
    stars: [color, "#ffffff", "#fde68a", "#bae6fd"],
    fireflies: [color, "#fef08a", "#bef264", "#ffffff"],
    snow: [color, "#ffffff", "#dbeafe", "#bfdbfe"],
    rain: [color, "#93c5fd", "#38bdf8", "#dbeafe"],
  };
  for (let i = 0; i < marks; i += 1) {
    const px = x + (((x * 13 + y * 7 + i * 5) % (radius * 2 + 1)) - radius);
    const py = y + (((x * 5 + y * 17 + i * 3) % (radius * 2 + 1)) - radius);
    const c = palette[kind][i % palette[kind].length];
    if (kind === "rain") {
      next = setPixel(next, width, height, px, py, c);
      next = setPixel(next, width, height, px, py + 1, c);
    } else if (kind === "flower" && i % 4 === 0) {
      next = setPixel(next, width, height, px, py, c);
      next = setPixel(next, width, height, px + 1, py, c);
    } else {
      next = setPixel(next, width, height, px, py, c);
    }
  }
  return next;
};

const stampPatterns: Record<StampKind, string[]> = {
  heart: ["0011001100", "0111111110", "1112222111", "1122222211", "1112222111", "0111221110", "0011111100", "0001111000", "0000110000"],
  star: ["00100", "10101", "01110", "10101", "00100"],
  leaf: ["0010", "0111", "1110", "0100"],
  flower: ["010", "121", "010"],
  sparkle: ["010", "111", "010"],
  rock: ["0110", "1221", "1111", "0110"],
  mushroom: ["01110", "11111", "02220", "00200"],
  fence: ["10101", "11111", "10101", "10101"],
  window: ["1111", "1221", "1221", "1111"],
  door: ["111", "122", "122", "121", "111"],
  bottle: ["010", "111", "121", "121", "111"],
  lamp: ["010", "111", "222", "010", "010"],
  book: ["11110", "12210", "12210", "11110"],
  chair: ["101", "111", "010", "010"],
  sign: ["11111", "12221", "11111", "00100", "00100"],
};

export const drawStamp = (pixels: string[], width: number, height: number, x: number, y: number, colors: StampColors, kind: StampKind) => {
  let next = [...pixels];
  const pattern = stampPatterns[kind];
  const originY = y - Math.floor(pattern.length / 2);
  const originX = x - Math.floor(pattern[0].length / 2);
  const swatches = { "1": colors.primary, "2": colors.accent || adjustColor(colors.primary, 45), "3": colors.outline || "#1f1f29" } as Record<string, string>;
  pattern.forEach((row, yy) => {
    [...row].forEach((cell, xx) => {
      if (cell !== "0") next = setPixel(next, width, height, originX + xx, originY + yy, swatches[cell] ?? colors.primary);
    });
  });
  return next;
};

export const autoOutlinePixels = (pixels: string[], width: number, height: number, color = "#1f1f29", selection?: Selection) => {
  const area = normalizeSelection(width, height, selection);
  let next = [...pixels];
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      if (!isSolid(pixels[indexAt(x, y, width)])) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) return;
        if (!isSolid(pixels[indexAt(tx, ty, width)])) next = setPixel(next, width, height, tx, ty, color);
      });
    }
  }
  return next;
};

export const dropShadowPixels = (pixels: string[], width: number, height: number, color = "rgba(31, 41, 55, 0.30)", selection?: Selection) => {
  const area = normalizeSelection(width, height, selection);
  let next = [...pixels];
  for (let y = area.y + area.height - 1; y >= area.y; y -= 1) {
    for (let x = area.x + area.width - 1; x >= area.x; x -= 1) {
      if (!isSolid(pixels[indexAt(x, y, width)])) continue;
      if (!isSolid(pixels[indexAt(x + 2, y + 2, width)])) next = setPixel(next, width, height, x + 2, y + 2, color);
    }
  }
  return next;
};

export const cleanPixelNoise = (pixels: string[], width: number, height: number, selection?: Selection) => {
  const area = normalizeSelection(width, height, selection);
  const next = [...pixels];
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const idx = indexAt(x, y, width);
      if (!isSolid(pixels[idx])) continue;
      const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isSolid(pixels[indexAt(x + dx, y + dy, width)])).length;
      if (neighbors === 0) next[idx] = "transparent";
    }
  }
  return next;
};

export const applyBeginnerEffect = (pixels: string[], width: number, height: number, effect: PixelEffect, selection?: Selection): string[] => {
  if (effect === "outline") return autoOutlinePixels(pixels, width, height, "#1f1f29", selection);
  if (effect === "shadow") return dropShadowPixels(pixels, width, height, "rgba(31, 41, 55, 0.30)", selection);
  if (effect === "clean") return cleanPixelNoise(pixels, width, height, selection);
  const area = normalizeSelection(width, height, selection);
  if (effect === "readable") return autoOutlinePixels(pixels.map((pixel) => (isSolid(pixel) ? adjustColor(pixel, 8) : pixel)), width, height, "#1f1f29", selection);
  if (effect === "contrast") return pixels.map((pixel) => (isSolid(pixel) ? adjustColor(pixel, pixel > "#888888" ? 24 : -24) : pixel));
  if (effect === "highlight") {
    let next = [...pixels];
    for (let y = area.y; y < area.y + area.height; y += 1) {
      for (let x = area.x; x < area.x + area.width; x += 1) if (isSolid(pixels[indexAt(x, y, width)]) && (x + y) % 4 === 0) next = setPixel(next, width, height, x, y, adjustColor(pixels[indexAt(x, y, width)], 36));
    }
    return next;
  }
  if (effect === "cozy") {
    let next = [...pixels];
    for (let y = area.y; y < area.y + area.height; y += 1) {
      for (let x = area.x; x < area.x + area.width; x += 1) if (isSolid(pixels[indexAt(x, y, width)]) && (x + y) % 4 === 0) next = setPixel(next, width, height, x, y, adjustColor(pixels[indexAt(x, y, width)], 36));
    }
    return dropShadowPixels(next, width, height, "rgba(31, 41, 55, 0.22)", selection);
  }
  if (effect === "reduceColors") {
    const colors = [...new Set(pixels.filter(isSolid))].slice(0, 16);
    return pixels.map((pixel) => (!isSolid(pixel) || colors.includes(pixel) ? pixel : colors[0] ?? pixel));
  }
  return pixels;
};

export const replaceColor = (pixels: string[], target: string, replacement: string) =>
  pixels.map((color) => (color === target ? replacement : color));

export const resizePixels = (pixels: string[], oldWidth: number, oldHeight: number, newWidth: number, newHeight: number) =>
  Array.from({ length: newWidth * newHeight }, (_, index) => {
    const x = index % newWidth;
    const y = Math.floor(index / newWidth);
    if (x >= oldWidth || y >= oldHeight) return "transparent";
    return pixels[y * oldWidth + x] ?? "transparent";
  });

export const clearSelectionPixels = (pixels: string[], width: number, selection: NonNullable<Selection>) => {
  const next = [...pixels];
  for (let y = 0; y < selection.height; y += 1) {
    for (let x = 0; x < selection.width; x += 1) {
      next[indexAt(selection.x + x, selection.y + y, width)] = "transparent";
    }
  }
  return next;
};

export const floodFill = (
  pixels: string[],
  width: number,
  height: number,
  startX: number,
  startY: number,
  color: string,
) => {
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return pixels;
  const target = pixels[indexAt(startX, startY, width)];
  if (target === color) return pixels;
  const next = [...pixels];
  const stack = [[startX, startY]];
  while (stack.length) {
    const point = stack.pop();
    if (!point) continue;
    const [x, y] = point;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = indexAt(x, y, width);
    if (next[idx] !== target) continue;
    next[idx] = color;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return next;
};

export const drawLine = (
  pixels: string[],
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
) => {
  let next = [...pixels];
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    next = setPixel(next, width, height, x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return next;
};

export const pixelPerfectPoints = (points: { x: number; y: number }[]) => {
  if (points.length < 3) return points;
  const cleaned: { x: number; y: number }[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = cleaned[cleaned.length - 1];
    const current = points[i];
    const next = points[i + 1];
    const turnsCorner = prev.x !== current.x && current.y !== next.y && prev.y !== current.y && current.x !== next.x;
    if (!turnsCorner) cleaned.push(current);
  }
  cleaned.push(points[points.length - 1]);
  return cleaned;
};

export const magicWandSelection = (pixels: string[], width: number, height: number, startX: number, startY: number): Selection => {
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return null;
  const target = pixels[indexAt(startX, startY, width)];
  const seen = new Set<number>();
  const stack = [[startX, startY]];
  let left = startX;
  let right = startX;
  let top = startY;
  let bottom = startY;
  while (stack.length) {
    const point = stack.pop();
    if (!point) continue;
    const [x, y] = point;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const index = indexAt(x, y, width);
    if (seen.has(index) || pixels[index] !== target) continue;
    seen.add(index);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

export const drawRect = (
  pixels: string[],
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
) => {
  let next = [...pixels];
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  for (let x = left; x <= right; x += 1) {
    next = setPixel(next, width, height, x, top, color);
    next = setPixel(next, width, height, x, bottom, color);
  }
  for (let y = top; y <= bottom; y += 1) {
    next = setPixel(next, width, height, left, y, color);
    next = setPixel(next, width, height, right, y, color);
  }
  return next;
};

export const drawEllipse = (
  pixels: string[],
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
) => {
  let next = [...pixels];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max(1, Math.abs(x1 - x0) / 2);
  const ry = Math.max(1, Math.abs(y1 - y0) / 2);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const value = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
      if (value > 0.78 && value < 1.2) next = setPixel(next, width, height, x, y, color);
    }
  }
  return next;
};

export const copySelection = (layer: PixelLayer, width: number, selection: NonNullable<Selection>) => {
  const pixels: string[] = [];
  for (let y = 0; y < selection.height; y += 1) {
    for (let x = 0; x < selection.width; x += 1) {
      pixels.push(layer.pixels[indexAt(selection.x + x, selection.y + y, width)] ?? "transparent");
    }
  }
  return { width: selection.width, height: selection.height, pixels };
};

export const pastePixels = (
  layer: PixelLayer,
  canvasWidth: number,
  canvasHeight: number,
  x: number,
  y: number,
  clip: { width: number; height: number; pixels: string[] },
) => {
  let next = [...layer.pixels];
  for (let yy = 0; yy < clip.height; yy += 1) {
    for (let xx = 0; xx < clip.width; xx += 1) {
      const color = clip.pixels[indexAt(xx, yy, clip.width)];
      if (color !== "transparent") next = setPixel(next, canvasWidth, canvasHeight, x + xx, y + yy, color);
    }
  }
  return next;
};

export const flipClipX = (clip: { width: number; height: number; pixels: string[] }) => ({
  ...clip,
  pixels: clip.pixels.map((_, i) => {
    const x = i % clip.width;
    const y = Math.floor(i / clip.width);
    return clip.pixels[indexAt(clip.width - 1 - x, y, clip.width)];
  }),
});

export const flipClipY = (clip: { width: number; height: number; pixels: string[] }) => ({
  ...clip,
  pixels: clip.pixels.map((_, i) => {
    const x = i % clip.width;
    const y = Math.floor(i / clip.width);
    return clip.pixels[indexAt(x, clip.height - 1 - y, clip.width)];
  }),
});

export const rotateClip = (clip: { width: number; height: number; pixels: string[] }) => ({
  width: clip.height,
  height: clip.width,
  pixels: Array.from({ length: clip.width * clip.height }, (_, i) => {
    const x = i % clip.height;
    const y = Math.floor(i / clip.height);
    return clip.pixels[indexAt(y, clip.height - 1 - x, clip.width)];
  }),
});

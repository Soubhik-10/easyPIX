import type { PixelLayer, Selection } from "../../projects/types";

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

export const rotatePixels = (pixels: string[], width: number, height: number, direction: "cw" | "ccw") =>
  Array.from({ length: width * height }, (_, i) => {
    const newWidth = height;
    const x = i % newWidth;
    const y = Math.floor(i / newWidth);
    return direction === "cw"
      ? pixels[indexAt(y, height - 1 - x, width)] ?? "transparent"
      : pixels[indexAt(width - 1 - y, x, width)] ?? "transparent";
  });

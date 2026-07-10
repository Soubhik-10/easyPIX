import { uid } from "../projects/factory";
import type { PixelAsset, PixelFrame } from "../projects/types";
import { offsetPixels, resizePixels } from "../editor/tools/pixelOps";

export type MotionRecipe = "float" | "bounce" | "shake" | "blink" | "pulse";

const centeredScale = (pixels: string[], width: number, height: number, scale: number) => {
  if (scale === 1) return [...pixels];
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  const scaled = resizePixels(pixels, width, height, scaledWidth, scaledHeight);
  const output = Array.from({ length: width * height }, () => "transparent");
  const offsetX = Math.floor((width - scaledWidth) / 2);
  const offsetY = height - scaledHeight;
  for (let y = 0; y < scaledHeight; y += 1) {
    for (let x = 0; x < scaledWidth; x += 1) {
      const targetX = x + offsetX;
      const targetY = y + offsetY;
      if (targetX >= 0 && targetY >= 0 && targetX < width && targetY < height) output[targetY * width + targetX] = scaled[y * scaledWidth + x];
    }
  }
  return output;
};

export const buildMotionFrames = (asset: PixelAsset, sourceFrameId: string | null | undefined, recipe: MotionRecipe): PixelFrame[] => {
  const source = asset.frames.find((frame) => frame.id === sourceFrameId) ?? asset.frames[0];
  const offsets: Record<Exclude<MotionRecipe, "pulse">, Array<[number, number]>> = {
    float: [[0, 0], [0, -1], [0, -2], [0, -1], [0, 0], [0, 1]],
    bounce: [[0, 0], [0, -2], [0, -4], [0, -2], [0, 0], [0, -1]],
    shake: [[0, 0], [-1, 0], [1, 0], [-1, 0], [1, 0], [0, 0]],
    blink: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
  };
  const scales = [1, 0.92, 1, 1.08, 1, 0.96];
  return Array.from({ length: 6 }, (_, frameIndex) => ({
    id: uid("frame"),
    name: `${recipe[0].toUpperCase()}${recipe.slice(1)} ${frameIndex + 1}`,
    durationMs: recipe === "blink" ? (frameIndex === 2 || frameIndex === 4 ? 70 : 140) : 100,
    layerIds: asset.layers.map((layer) => layer.id),
    tags: [recipe, "generated"],
    cels: Object.fromEntries(asset.layers.map((layer) => {
      const pixels = source?.cels?.[layer.id] ?? layer.pixels;
      if (recipe === "blink" && (frameIndex === 2 || frameIndex === 4)) {
        return [layer.id, Array.from({ length: asset.width * asset.height }, () => "transparent")];
      }
      if (recipe === "pulse") return [layer.id, centeredScale(pixels, asset.width, asset.height, scales[frameIndex])];
      const [dx, dy] = offsets[recipe][frameIndex];
      return [layer.id, offsetPixels(pixels, asset.width, asset.height, dx, dy)];
    })),
  }));
};

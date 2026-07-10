import type { MovePreview, PixelAsset, PixelLayer, Scene, SceneCell, Selection } from "../../projects/types";

export const layerPixelsForFrame = (asset: PixelAsset, frameId: string | null | undefined, layer: PixelLayer) => {
  const frame = asset.frames.find((entry) => entry.id === frameId) ?? asset.frames[0];
  return frame?.cels?.[layer.id] ?? layer.pixels;
};

export const layersForFrame = (asset: PixelAsset, frameId: string | null | undefined, layerIds?: string[]) => {
  const frame = asset.frames.find((entry) => entry.id === frameId) ?? asset.frames[0];
  const ids = layerIds ?? frame?.layerIds ?? asset.layers.map((layer) => layer.id);
  return asset.layers
    .filter((layer) => ids.includes(layer.id))
    .map((layer) => ({ ...layer, pixels: layerPixelsForFrame(asset, frame?.id, layer) }));
};

export const drawCheckerboard = (ctx: CanvasRenderingContext2D, width: number, height: number, scale: number) => {
  const size = Math.max(4, scale);
  for (let y = 0; y < height * scale; y += size) {
    for (let x = 0; x < width * scale; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#f1f4f0" : "#dfe5dc";
      ctx.fillRect(x, y, size, size);
    }
  }
};

export const drawPixelLayer = (
  ctx: CanvasRenderingContext2D,
  layer: PixelLayer,
  width: number,
  height: number,
  scale: number,
) => {
  if (!layer.visible) return;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = layer.pixels[y * width + x];
      if (color && color !== "transparent") {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  ctx.restore();
};

const visiblePixelMask = (layers: PixelLayer[], width: number, height: number) => {
  const mask = Array.from({ length: width * height }, () => false);
  layers.forEach((layer) => {
    if (!layer.visible || layer.opacity <= 0) return;
    layer.pixels.forEach((color, index) => {
      if (color && color !== "transparent") mask[index] = true;
    });
  });
  return mask;
};

export const drawAssetFrame = (
  ctx: CanvasRenderingContext2D,
  asset: PixelAsset,
  scale: number,
  frameId?: string | null,
  layerIds?: string[],
) => {
  const layers = layersForFrame(asset, frameId, layerIds);
  const effects = asset.effects;
  const mask = visiblePixelMask(layers, asset.width, asset.height);
  if (effects?.shadow?.enabled) {
    ctx.save();
    ctx.fillStyle = effects.shadow.color;
    for (let y = 0; y < asset.height; y += 1) {
      for (let x = 0; x < asset.width; x += 1) {
        if (mask[y * asset.width + x]) ctx.fillRect((x + effects.shadow.offsetX) * scale, (y + effects.shadow.offsetY) * scale, scale, scale);
      }
    }
    ctx.restore();
  }
  if (effects?.outline?.enabled) {
    ctx.save();
    ctx.fillStyle = effects.outline.color;
    for (let y = 0; y < asset.height; y += 1) {
      for (let x = 0; x < asset.width; x += 1) {
        if (mask[y * asset.width + x]) continue;
        let neighbor = false;
        for (let yy = -1; yy <= 1 && !neighbor; yy += 1) {
          for (let xx = -1; xx <= 1; xx += 1) {
            const nx = x + xx;
            const ny = y + yy;
            if (nx >= 0 && ny >= 0 && nx < asset.width && ny < asset.height && mask[ny * asset.width + nx]) {
              neighbor = true;
              break;
            }
          }
        }
        if (neighbor) ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    ctx.restore();
  }
  layers.forEach((layer) => drawPixelLayer(ctx, layer, asset.width, asset.height, scale));
  if (effects?.tint?.enabled && effects.tint.amount > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = Math.max(0, Math.min(1, effects.tint.amount));
    ctx.fillStyle = effects.tint.color;
    ctx.fillRect(0, 0, asset.width * scale, asset.height * scale);
    ctx.restore();
  }
};

const drawMovedPixelLayer = (
  ctx: CanvasRenderingContext2D,
  layer: PixelLayer,
  width: number,
  height: number,
  scale: number,
  movePreview: NonNullable<MovePreview>,
) => {
  if (!layer.visible) return;
  const { selection, dx, dy } = movePreview;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const insideSelection = x >= selection.x && y >= selection.y && x < selection.x + selection.width && y < selection.y + selection.height;
      if (insideSelection) continue;
      const color = layer.pixels[y * width + x];
      if (color && color !== "transparent") {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  for (let y = 0; y < selection.height; y += 1) {
    for (let x = 0; x < selection.width; x += 1) {
      const color = layer.pixels[(selection.y + y) * width + selection.x + x];
      if (color && color !== "transparent") {
        ctx.fillStyle = color;
        ctx.fillRect((selection.x + dx + x) * scale, (selection.y + dy + y) * scale, scale, scale);
      }
    }
  }
  ctx.restore();
};

export const renderAsset = (
  canvas: HTMLCanvasElement,
  asset: PixelAsset,
  scale: number,
  options: { grid?: boolean; selection?: Selection; movePreview?: MovePreview; activeLayerIds?: string[]; frameId?: string | null } = {},
) => {
  canvas.width = asset.width * scale;
  canvas.height = asset.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  drawCheckerboard(ctx, asset.width, asset.height, scale);
  const layers = layersForFrame(asset, options.frameId, options.activeLayerIds);
  if (!options.movePreview) drawAssetFrame(ctx, asset, scale, options.frameId, options.activeLayerIds);
  else layers.forEach((layer) => {
    if (layer.id === options.movePreview?.layerId) drawMovedPixelLayer(ctx, layer, asset.width, asset.height, scale, options.movePreview);
    else drawPixelLayer(ctx, layer, asset.width, asset.height, scale);
  });
  if (options.grid && scale >= 8) {
    ctx.strokeStyle = "rgba(31, 41, 55, 0.16)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= asset.width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * scale + 0.5, 0);
      ctx.lineTo(x * scale + 0.5, asset.height * scale);
      ctx.stroke();
    }
    for (let y = 0; y <= asset.height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale + 0.5);
      ctx.lineTo(asset.width * scale, y * scale + 0.5);
      ctx.stroke();
    }
  }
  if (options.selection) {
    const selection = options.movePreview ? { ...options.movePreview.selection, x: options.movePreview.selection.x + options.movePreview.dx, y: options.movePreview.selection.y + options.movePreview.dy } : options.selection;
    ctx.strokeStyle = "#1b6ef3";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(selection.x * scale + 1, selection.y * scale + 1, selection.width * scale - 2, selection.height * scale - 2);
    ctx.setLineDash([]);
  }
};

export const renderAnimationFrame = (
  canvas: HTMLCanvasElement,
  asset: PixelAsset,
  scale: number,
  options: {
    frameId?: string | null;
    background?: "checker" | "solid" | "scene";
    color?: string;
    scene?: Scene | null;
    sceneAssets?: PixelAsset[];
    timeMs?: number;
  } = {},
) => {
  canvas.width = asset.width * scale;
  canvas.height = asset.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const background = options.background ?? asset.preview?.background ?? "checker";
  if (background === "scene" && options.scene) {
    const sceneCanvas = document.createElement("canvas");
    renderScene(sceneCanvas, options.scene, options.sceneAssets ?? [], 1, {
      grid: false,
      camera: false,
      timeMs: options.timeMs,
    });
    ctx.drawImage(sceneCanvas, 0, 0, sceneCanvas.width, sceneCanvas.height, 0, 0, canvas.width, canvas.height);
  } else if (background === "solid") {
    ctx.fillStyle = options.color ?? asset.preview?.color ?? "#7dd3c7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    drawCheckerboard(ctx, asset.width, asset.height, scale);
  }
  drawAssetFrame(ctx, asset, scale, options.frameId);
};

export const renderRepeatPreview = (canvas: HTMLCanvasElement, asset: PixelAsset, scale = 3) => {
  canvas.width = asset.width * 5 * scale;
  canvas.height = asset.height * 5 * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  drawCheckerboard(ctx, asset.width * 5, asset.height * 5, scale);
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      ctx.save();
      ctx.translate(col * asset.width * scale, row * asset.height * scale);
      drawAssetFrame(ctx, asset, scale, asset.frames[0]?.id);
      ctx.restore();
    }
  }
};

export const renderTilesheet = (canvas: HTMLCanvasElement, assets: PixelAsset[], tileWidth: number, tileHeight: number, scale = 2) => {
  const columns = Math.max(1, Math.ceil(Math.sqrt(assets.length)));
  const rows = Math.max(1, Math.ceil(assets.length / columns));
  canvas.width = columns * tileWidth * scale;
  canvas.height = rows * tileHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  drawCheckerboard(ctx, columns * tileWidth, rows * tileHeight, scale);
  assets.forEach((asset, index) => {
    ctx.save();
    ctx.translate((index % columns) * tileWidth * scale, Math.floor(index / columns) * tileHeight * scale);
    drawAssetFrame(ctx, asset, scale, asset.frames[0]?.id);
    ctx.restore();
  });
};

const backgroundColors = (scene: Scene) => {
  const background = scene.background ?? { preset: "plain" as const, color: "#e8eadb", accent: "#cbd5cb" };
  const colors: readonly [string, string] = background.preset === "transparent" ? ["transparent", "transparent"] : [background.color, background.accent];
  return { background, colors };
};

const drawSceneBackground = (ctx: CanvasRenderingContext2D, scene: Scene, width: number, height: number) => {
  const { background, colors } = backgroundColors(scene);
  if (background.preset === "transparent") {
    drawCheckerboard(ctx, width, height, 1);
    return;
  }
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, width, height);
  if (background.preset !== "plain") {
    ctx.fillStyle = colors[1];
    ctx.fillRect(0, Math.floor(height * 0.58), width, Math.ceil(height * 0.42));
    if (background.preset === "night") {
      const pixelScale = Math.max(1, width / Math.max(1, scene.width * scene.tileSize));
      ctx.fillStyle = "#f8fafc";
      for (let index = 0; index < Math.min(36, scene.width * 2); index += 1) {
        const x = ((index * 83 + 17) % Math.max(1, width - 2 * pixelScale));
        const y = ((index * 47 + 11) % Math.max(1, Math.floor(height * 0.5)));
        ctx.fillRect(x, y, pixelScale, pixelScale);
      }
    }
  }
};

const frameForTime = (asset: PixelAsset, timeMs: number) => {
  if (asset.frames.length <= 1) return asset.frames[0];
  const total = asset.frames.reduce((sum, frame) => sum + Math.max(40, frame.durationMs), 0);
  let cursor = ((timeMs % total) + total) % total;
  for (const frame of asset.frames) {
    cursor -= Math.max(40, frame.durationMs);
    if (cursor < 0) return frame;
  }
  return asset.frames[0];
};

const drawEnvironment = (ctx: CanvasRenderingContext2D, scene: Scene, width: number, height: number, scale: number, timeMs: number) => {
  const environment = scene.environment ?? { effect: "none" as const, density: 35, speed: 50 };
  if (environment.effect === "none") return;
  const count = Math.max(8, Math.min(180, Math.round((environment.density / 100) * 150)));
  const speed = Math.max(0.1, environment.speed / 50);
  const pixel = Math.max(1, Math.round(scale));
  for (let index = 0; index < count; index += 1) {
    const seedX = (index * 977 + scene.width * 41) % Math.max(1, width);
    const seedY = (index * 619 + scene.height * 53) % Math.max(1, height);
    const phase = timeMs * 0.02 * speed + index * 17;
    let x = seedX;
    let y = seedY;
    if (environment.effect === "rain") {
      x = (seedX + phase * 0.35) % width;
      y = (seedY + phase * 2.2) % height;
      ctx.fillStyle = "rgba(186, 230, 253, 0.72)";
      ctx.fillRect(x, y, pixel, pixel * 5);
    } else if (environment.effect === "snow") {
      x = (seedX + Math.sin(phase * 0.025) * 14) % width;
      y = (seedY + phase * 0.45) % height;
      ctx.fillStyle = "rgba(248, 250, 252, 0.9)";
      ctx.fillRect(x, y, pixel * (index % 4 === 0 ? 2 : 1), pixel * (index % 4 === 0 ? 2 : 1));
    } else if (environment.effect === "fireflies") {
      x = (seedX + Math.sin(phase * 0.018) * 18) % width;
      y = (seedY + Math.cos(phase * 0.014) * 12) % height;
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(phase * 0.03));
      ctx.fillStyle = "#fde047";
      ctx.fillRect(x, y, pixel * 2, pixel * 2);
      ctx.globalAlpha = 1;
    } else if (environment.effect === "leaves") {
      x = (seedX + phase * 0.55) % width;
      y = (seedY + phase * 0.28 + Math.sin(phase * 0.02) * 8) % height;
      ctx.fillStyle = index % 2 ? "#84cc16" : "#f59e0b";
      ctx.fillRect(x, y, pixel * 2, pixel);
    } else if (environment.effect === "embers") {
      x = (seedX + Math.sin(phase * 0.03) * 8) % width;
      y = (seedY - phase * 0.5 + height * 20) % height;
      ctx.globalAlpha = 0.45 + 0.5 * Math.abs(Math.sin(phase * 0.04));
      ctx.fillStyle = index % 3 ? "#fb923c" : "#fde047";
      ctx.fillRect(x, y, pixel, pixel * 2);
      ctx.globalAlpha = 1;
    }
  }
};

export const renderScene = (
  canvas: HTMLCanvasElement,
  scene: Scene,
  assets: PixelAsset[],
  scale = 2,
  options: { grid?: boolean; timeMs?: number; camera?: boolean; environment?: boolean } = {},
) => {
  canvas.width = scene.width * scene.tileSize * scale;
  canvas.height = scene.height * scene.tileSize * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  drawSceneBackground(ctx, scene, canvas.width, canvas.height);
  const timeMs = options.timeMs ?? 0;
  (["ground", "objects", "overlay"] as const).forEach((layerName) => {
    if (scene.layerVisibility?.[layerName] === false) return;
    scene.layers[layerName].forEach((cell: SceneCell, index) => {
      if (!cell) return;
      const tile = typeof cell === "string" ? { assetId: cell, rotation: 0 as const } : cell;
      const asset = assets.find((entry) => entry.id === tile.assetId);
      if (!asset) return;
      const x = (index % scene.width) * scene.tileSize * scale;
      const y = Math.floor(index / scene.width) * scene.tileSize * scale;
      const assetScale = Math.max(0.5, (scene.tileSize / Math.max(asset.width, asset.height)) * scale * (tile.scale ?? 1));
      ctx.save();
      ctx.translate(x + (scene.tileSize * scale) / 2, y + (scene.tileSize * scale) / 2);
      ctx.rotate(((tile.rotation ?? 0) * Math.PI) / 180);
      ctx.scale(tile.flipX ? -1 : 1, tile.flipY ? -1 : 1);
      ctx.translate(-(asset.width * assetScale) / 2, -(asset.height * assetScale) / 2);
      const frame = frameForTime(asset, timeMs);
      drawAssetFrame(ctx, asset, assetScale, frame?.id);
      ctx.restore();
    });
  });
  if (options.environment !== false) drawEnvironment(ctx, scene, canvas.width, canvas.height, scale, timeMs);
  if (options.grid !== false) {
    ctx.strokeStyle = "rgba(31, 41, 55, 0.16)";
    for (let x = 0; x <= scene.width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * scene.tileSize * scale + 0.5, 0);
      ctx.lineTo(x * scene.tileSize * scale + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= scene.height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * scene.tileSize * scale + 0.5);
      ctx.lineTo(canvas.width, y * scene.tileSize * scale + 0.5);
      ctx.stroke();
    }
  }
  if (options.camera !== false && scene.camera?.visible) {
    const camera = scene.camera;
    ctx.save();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = Math.max(2, scale);
    ctx.setLineDash([8 * scale, 5 * scale]);
    ctx.strokeRect(
      camera.x * scene.tileSize * scale,
      camera.y * scene.tileSize * scale,
      Math.min(camera.width, scene.width) * scene.tileSize * scale,
      Math.min(camera.height, scene.height) * scene.tileSize * scale,
    );
    ctx.setLineDash([]);
    ctx.restore();
  }
};

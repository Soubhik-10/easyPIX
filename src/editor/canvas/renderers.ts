import type { PixelAsset, PixelLayer, Scene, Selection } from "../../projects/types";

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

export const renderAsset = (
  canvas: HTMLCanvasElement,
  asset: PixelAsset,
  scale: number,
  options: { grid?: boolean; selection?: Selection; activeLayerIds?: string[]; frameId?: string | null } = {},
) => {
  canvas.width = asset.width * scale;
  canvas.height = asset.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  drawCheckerboard(ctx, asset.width, asset.height, scale);
  const layers = layersForFrame(asset, options.frameId, options.activeLayerIds);
  layers.forEach((layer) => drawPixelLayer(ctx, layer, asset.width, asset.height, scale));
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
    const selection = options.selection;
    ctx.strokeStyle = "#1b6ef3";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(selection.x * scale + 1, selection.y * scale + 1, selection.width * scale - 2, selection.height * scale - 2);
    ctx.setLineDash([]);
  }
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
      layersForFrame(asset, asset.frames[0]?.id).forEach((layer) => drawPixelLayer(ctx, layer, asset.width, asset.height, scale));
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
    layersForFrame(asset, asset.frames[0]?.id).forEach((layer) => drawPixelLayer(ctx, layer, asset.width, asset.height, scale));
    ctx.restore();
  });
};

export const renderScene = (canvas: HTMLCanvasElement, scene: Scene, assets: PixelAsset[], scale = 2, options: { grid?: boolean } = {}) => {
  canvas.width = scene.width * scene.tileSize * scale;
  canvas.height = scene.height * scene.tileSize * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#e8eadb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  (["ground", "objects", "overlay"] as const).forEach((layerName) => {
    scene.layers[layerName].forEach((assetId, index) => {
      if (!assetId) return;
      const asset = assets.find((entry) => entry.id === assetId);
      if (!asset) return;
      const x = (index % scene.width) * scene.tileSize * scale;
      const y = Math.floor(index / scene.width) * scene.tileSize * scale;
      const assetScale = Math.max(1, (scene.tileSize / Math.max(asset.width, asset.height)) * scale);
      ctx.save();
      ctx.translate(x, y);
      layersForFrame(asset, asset.frames[0]?.id).forEach((layer) => drawPixelLayer(ctx, layer, asset.width, asset.height, assetScale));
      ctx.restore();
    });
  });
  if (options.grid === false) return;
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
};

import JSZip from "jszip";
import type { PixelAsset, PixelLayer, PixelProject } from "../types";

const compositeAssetToDataUrl = (asset: PixelAsset, layerIds?: string[], scale = 1) => {
  const canvas = document.createElement("canvas");
  canvas.width = asset.width * scale;
  canvas.height = asset.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  const ids = layerIds ?? asset.layers.map((layer) => layer.id);
  ids.forEach((id) => {
    const layer = asset.layers.find((entry) => entry.id === id);
    if (!layer || !layer.visible) return;
    drawLayer(ctx, layer, asset.width, asset.height);
  });
  return canvas.toDataURL("image/png").split(",")[1];
};

const drawLayer = (ctx: CanvasRenderingContext2D, layer: PixelLayer, width: number, height: number) => {
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = layer.pixels[y * width + x];
      if (color && color !== "transparent") {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.restore();
};

export const exportProjectZip = async (project: PixelProject) => {
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(project, null, 2));
  project.palettes.forEach((palette) => {
    zip.file(`palettes/${palette.id}.json`, JSON.stringify(palette, null, 2));
  });
  project.assets.forEach((asset) => {
    zip.file(`assets/${asset.id}.json`, JSON.stringify(asset, null, 2));
    zip.file(`images/${asset.id}.png`, compositeAssetToDataUrl(asset), { base64: true });
  });
  project.tilesets.forEach((tileset) => {
    zip.file(`tilesets/${tileset.id}.json`, JSON.stringify(tileset, null, 2));
  });
  project.scenes.forEach((scene) => {
    zip.file(`scenes/${scene.id}.json`, JSON.stringify(scene, null, 2));
  });
  return zip.generateAsync({ type: "blob" });
};

export const importProjectZip = async (file: File) => {
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file("project.json");
  if (!projectFile) throw new Error("project.json is missing");
  return JSON.parse(await projectFile.async("string")) as PixelProject;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportAssetPng = (asset: PixelAsset, scale = 1) => {
  const base64 = compositeAssetToDataUrl(asset, undefined, scale);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
};

export const exportTilesheetPng = (assets: PixelAsset[], tileWidth: number, tileHeight: number, scale = 1) => {
  const columns = Math.max(1, Math.ceil(Math.sqrt(assets.length)));
  const rows = Math.max(1, Math.ceil(assets.length / columns));
  const canvas = document.createElement("canvas");
  canvas.width = columns * tileWidth * scale;
  canvas.height = rows * tileHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  assets.forEach((asset, index) => {
    ctx.save();
    ctx.translate((index % columns) * tileWidth, Math.floor(index / columns) * tileHeight);
    asset.layers.forEach((layer) => {
      if (layer.visible) drawLayer(ctx, layer, asset.width, asset.height);
    });
    ctx.restore();
  });
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
};

import JSZip from "jszip";
import type { PixelAsset, PixelLayer, PixelProject } from "../types";
import { layersForFrame } from "../../editor/canvas/renderers";

export const DEFAULT_PNG_EXPORT_SCALE = 4;

const compositeAssetToDataUrl = (asset: PixelAsset, layerIds?: string[], scale = 1, frameId?: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = asset.width * scale;
  canvas.height = asset.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  layersForFrame(asset, frameId ?? asset.frames[0]?.id, layerIds).forEach((layer) => {
    if (!layer.visible) return;
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

export const validateProjectForExport = (project: PixelProject) => {
  const errors: string[] = [];
  if (!project.name.trim()) errors.push("Project name is empty.");
  if (!project.assets.length) errors.push("Project has no assets.");
  project.assets.forEach((asset) => {
    if (asset.width < 1 || asset.height < 1) errors.push(`${asset.name} has an invalid canvas size.`);
    if (!asset.layers.length) errors.push(`${asset.name} has no layers.`);
    asset.layers.forEach((layer) => {
      if (layer.pixels.length !== asset.width * asset.height) {
        errors.push(`${asset.name} / ${layer.name} has ${layer.pixels.length} pixels, expected ${asset.width * asset.height}.`);
      }
    });
    asset.frames.forEach((frame) => {
      Object.entries(frame.cels ?? {}).forEach(([layerId, pixels]) => {
        if (pixels.length !== asset.width * asset.height) {
          errors.push(`${asset.name} / ${frame.name} / ${layerId} has ${pixels.length} pixels, expected ${asset.width * asset.height}.`);
        }
      });
    });
  });
  return errors;
};

export const exportProjectZip = async (project: PixelProject) => {
  const errors = validateProjectForExport(project);
  if (errors.length) throw new Error(errors.join("\n"));
  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(project, null, 2));
  project.palettes.forEach((palette) => {
    zip.file(`palettes/${palette.id}.json`, JSON.stringify(palette, null, 2));
  });
  project.assets.forEach((asset) => {
    zip.file(`assets/${asset.id}.json`, JSON.stringify(asset, null, 2));
    zip.file(`images/${asset.id}.png`, compositeAssetToDataUrl(asset), { base64: true });
    asset.frames.forEach((frame, index) => {
      zip.file(`images/${asset.id}-frame-${index + 1}.png`, compositeAssetToDataUrl(asset, frame.layerIds, 1, frame.id), { base64: true });
    });
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportAssetPng = (asset: PixelAsset, scale = DEFAULT_PNG_EXPORT_SCALE) => {
  const base64 = compositeAssetToDataUrl(asset, undefined, scale, asset.frames[0]?.id);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
};

export const exportAssetFramePng = (asset: PixelAsset, frameId: string, scale = DEFAULT_PNG_EXPORT_SCALE) => {
  const frame = asset.frames.find((entry) => entry.id === frameId) ?? asset.frames[0];
  const base64 = compositeAssetToDataUrl(asset, frame?.layerIds, scale, frame?.id);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
};

export const exportAnimationJson = (asset: PixelAsset) =>
  new Blob(
    [
      JSON.stringify(
        {
          type: "easyPIX-animation",
          version: 1,
          asset: { id: asset.id, name: asset.name, width: asset.width, height: asset.height },
          frames: asset.frames.map((frame, index) => ({
            id: frame.id,
            name: frame.name,
            index,
            durationMs: frame.durationMs,
            x: index * asset.width,
            y: 0,
            width: asset.width,
            height: asset.height,
          })),
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );

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
    layersForFrame(asset, asset.frames[0]?.id).forEach((layer) => {
      if (layer.visible) drawLayer(ctx, layer, asset.width, asset.height);
    });
    ctx.restore();
  });
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
};

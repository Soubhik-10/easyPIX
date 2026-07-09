import JSZip from "jszip";
import type { PixelAsset, PixelLayer, PixelProject } from "../types";
import { layersForFrame } from "../../editor/canvas/renderers";

export const DEFAULT_PNG_EXPORT_SCALE = 4;
const EXPORT_METADATA = {
  software: "easyPIX",
  source: "https://github.com/Soubhik-10/easyPIX",
  comment: "Created with easyPIX.",
};

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

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
};

const uint32Bytes = (value: number) => new Uint8Array([
  (value >>> 24) & 255,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
]);

const textChunk = (keyword: string, text: string) => {
  const type = new TextEncoder().encode("tEXt");
  const data = new TextEncoder().encode(`${keyword}\0${text}`);
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type);
  crcInput.set(data, type.length);
  const chunk = new Uint8Array(4 + type.length + data.length + 4);
  chunk.set(uint32Bytes(data.length), 0);
  chunk.set(type, 4);
  chunk.set(data, 8);
  chunk.set(uint32Bytes(crc32(crcInput)), 8 + data.length);
  return chunk;
};

const addPngMetadata = (bytes: Uint8Array) => {
  const iendType = new TextEncoder().encode("IEND");
  let iendOffset = bytes.length - 12;
  for (let index = 8; index < bytes.length - 12; ) {
    const length = (bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3];
    const typeOffset = index + 4;
    const isIend = iendType.every((byte, offset) => bytes[typeOffset + offset] === byte);
    if (isIend) {
      iendOffset = index;
      break;
    }
    index += 12 + length;
  }
  const chunks = [
    textChunk("Software", EXPORT_METADATA.software),
    textChunk("Source", EXPORT_METADATA.source),
    textChunk("Comment", EXPORT_METADATA.comment),
  ];
  const metadataLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const next = new Uint8Array(bytes.length + metadataLength);
  next.set(bytes.slice(0, iendOffset), 0);
  let cursor = iendOffset;
  chunks.forEach((chunk) => {
    next.set(chunk, cursor);
    cursor += chunk.length;
  });
  next.set(bytes.slice(iendOffset), cursor);
  return next;
};

const pngBytesFromBase64 = (base64: string) => addPngMetadata(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));

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
    zip.file(`images/${asset.id}.png`, pngBytesFromBase64(compositeAssetToDataUrl(asset)));
    asset.frames.forEach((frame, index) => {
      zip.file(`images/${asset.id}-frame-${index + 1}.png`, pngBytesFromBase64(compositeAssetToDataUrl(asset, frame.layerIds, 1, frame.id)));
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

export const importProjectFile = async (file: File) => {
  if (file.name.toLowerCase().endsWith(".json") || file.type === "application/json") {
    return JSON.parse(await file.text()) as PixelProject;
  }
  return importProjectZip(file);
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
  const bytes = pngBytesFromBase64(base64);
  return new Blob([bytes], { type: "image/png" });
};

export const exportAssetFramePng = (asset: PixelAsset, frameId: string, scale = DEFAULT_PNG_EXPORT_SCALE) => {
  const frame = asset.frames.find((entry) => entry.id === frameId) ?? asset.frames[0];
  const base64 = compositeAssetToDataUrl(asset, frame?.layerIds, scale, frame?.id);
  const bytes = pngBytesFromBase64(base64);
  return new Blob([bytes], { type: "image/png" });
};

export const exportAnimationJson = (asset: PixelAsset) =>
  new Blob(
    [
      JSON.stringify(
        {
          type: "easyPIX-animation",
          version: 1,
          generatedBy: EXPORT_METADATA,
          asset: { id: asset.id, name: asset.name, width: asset.width, height: asset.height },
          frames: asset.frames.map((frame, index) => ({
            id: frame.id,
            name: frame.name,
            index,
            durationMs: frame.durationMs,
            tags: frame.tags ?? [],
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

export const exportEngineJson = (project: PixelProject, target: "generic" | "godot" | "phaser" | "unity") =>
  new Blob(
    [
      JSON.stringify(
        {
          type: `easyPIX-${target}-export`,
          version: 1,
          generatedBy: EXPORT_METADATA,
          project: { id: project.id, name: project.name, updatedAt: project.updatedAt },
          assets: project.assets.map((asset) => ({
            id: asset.id,
            name: asset.name,
            width: asset.width,
            height: asset.height,
            pivot: asset.pivot ?? { x: Math.floor(asset.width / 2), y: Math.floor(asset.height / 2) },
            tags: asset.tags ?? [],
            image: `images/${asset.id}.png`,
            frames: asset.frames.map((frame, index) => ({
              id: frame.id,
              name: frame.name,
              index,
              durationMs: frame.durationMs,
              tags: frame.tags ?? [],
              rect: { x: index * asset.width, y: 0, w: asset.width, h: asset.height },
            })),
          })),
          tilesets: project.tilesets.map((tileset) => ({
            id: tileset.id,
            name: tileset.name,
            tileWidth: tileset.tileWidth,
            tileHeight: tileset.tileHeight,
            assetIds: tileset.assetIds,
          })),
          scenes: project.scenes.map((scene) => ({
            id: scene.id,
            name: scene.name,
            width: scene.width,
            height: scene.height,
            tileSize: scene.tileSize,
            layers: scene.layers,
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
  const bytes = pngBytesFromBase64(base64);
  return new Blob([bytes], { type: "image/png" });
};

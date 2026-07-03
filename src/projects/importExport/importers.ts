import { createLayer, uid } from "../factory";
import type { PixelAsset, PixelFrame, PixelLayer } from "../types";

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

const imageToPixels = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const pixels = Array.from({ length: bitmap.width * bitmap.height }, (_, index) => {
    const offset = index * 4;
    return data[offset + 3] === 0 ? "transparent" : hex(data[offset], data[offset + 1], data[offset + 2]);
  });
  return { width: bitmap.width, height: bitmap.height, pixels };
};

const cropImagePixels = async (file: File, x: number, y: number, width: number, height: number) => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  return Array.from({ length: width * height }, (_, index) => {
    const offset = index * 4;
    return data[offset + 3] === 0 ? "transparent" : hex(data[offset], data[offset + 1], data[offset + 2]);
  });
};

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const cropBlobPixels = async (blob: Blob, x: number, y: number, width: number, height: number) => {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  return Array.from({ length: width * height }, (_, index) => {
    const offset = index * 4;
    return data[offset + 3] === 0 ? "transparent" : hex(data[offset], data[offset + 1], data[offset + 2]);
  });
};

const colorFromPiskelCell = (cell: unknown) => {
  if (typeof cell === "string") return cell === "0" || cell === "transparent" ? "transparent" : cell;
  if (typeof cell !== "number" || cell === 0) return "transparent";
  const r = cell & 255;
  const g = (cell >> 8) & 255;
  const b = (cell >> 16) & 255;
  const a = (cell >> 24) & 255;
  return a === 0 ? "transparent" : hex(r, g, b);
};

const flattenPiskelLayout = (layout: unknown, width: number, height: number) => {
  const rows = Array.isArray(layout) ? layout : [];
  const flat = rows.flat(Infinity).map(colorFromPiskelCell);
  return Array.from({ length: width * height }, (_, index) => flat[index] ?? "transparent");
};

const piskelFramePixelsByIndex = async (layer: any, width: number, height: number) => {
  const frames = new Map<number, string[]>();
  for (const chunk of layer.chunks ?? []) {
    if (!chunk.base64PNG) continue;
    const blob = await dataUrlToBlob(chunk.base64PNG);
    const bitmap = await createImageBitmap(blob);
    const columns = Math.max(1, Math.floor(bitmap.width / width));
    const frameIndexes = (Array.isArray(chunk.layout) ? chunk.layout : [])
      .flat(Infinity)
      .filter((value: unknown): value is number => typeof value === "number");
    for (const [tileIndex, frameIndex] of frameIndexes.entries()) {
      const sx = (tileIndex % columns) * width;
      const sy = Math.floor(tileIndex / columns) * height;
      frames.set(frameIndex as number, await cropBlobPixels(blob, sx, sy, width, height));
    }
  }
  return frames;
};

export const importPiskel = async (file: File): Promise<PixelAsset> => {
  const json = JSON.parse(await file.text());
  const piskel = json.piskel ?? json;
  const width = Number(piskel.width ?? piskel.canvasWidth ?? 64);
  const height = Number(piskel.height ?? piskel.canvasHeight ?? 64);
  const rawLayers = Array.isArray(piskel.layers) ? piskel.layers : [];
  const parsedLayers = rawLayers.map((layer: unknown) => (typeof layer === "string" ? JSON.parse(layer) : layer));
  const frameCount = Math.max(1, ...parsedLayers.map((layer: any) => Number(layer.frameCount ?? 1)));
  const layers: PixelLayer[] = [];
  const frames: PixelFrame[] = [];
  const layerFramePixels = await Promise.all(parsedLayers.map((layer: any) => piskelFramePixelsByIndex(layer, width, height)));
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameLayerIds: string[] = [];
    parsedLayers.forEach((layer: any, layerIndex: number) => {
      const fallbackChunk = layer.chunks?.[0] ?? layer.frames?.[0] ?? layer;
      const importedLayer = {
        ...createLayer(`${layer.name ?? `Layer ${layerIndex + 1}`} F${frameIndex + 1}`, width, height),
        pixels: layerFramePixels[layerIndex].get(frameIndex) ?? flattenPiskelLayout(fallbackChunk.layout ?? fallbackChunk.pixels ?? [], width, height),
        opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
        visible: layer.hidden ? false : true,
      };
      layers.push(importedLayer);
      frameLayerIds.push(importedLayer.id);
    });
    frames.push({
      id: uid("frame"),
      name: `Frame ${frameIndex + 1}`,
      durationMs: Math.round(1000 / Number(piskel.fps ?? 8)),
      layerIds: frameLayerIds,
    });
  }
  const safeLayers = layers.length ? layers : [createLayer("Imported", width, height)];
  return {
    id: uid("asset"),
    name: piskel.name ?? file.name.replace(/\.piskel$/i, ""),
    width,
    height,
    layers: safeLayers,
    frames: frames.length ? frames : [{ id: uid("frame"), name: "Frame 1", durationMs: Math.round(1000 / Number(piskel.fps ?? 8)), layerIds: safeLayers.map((layer) => layer.id) }],
  };
};

export const importPngAsset = async (file: File): Promise<PixelAsset> => {
  const image = await imageToPixels(file);
  const layer = createLayer("Imported PNG", image.width, image.height);
  return {
    id: uid("asset"),
    name: file.name.replace(/\.png$/i, ""),
    width: image.width,
    height: image.height,
    layers: [{ ...layer, pixels: image.pixels }],
    frames: [{ id: uid("frame"), name: "Frame 1", durationMs: 160, layerIds: [layer.id] }],
  };
};

export const importAsepriteJson = async (jsonFile: File, imageFile: File): Promise<PixelAsset> => {
  const json = JSON.parse(await jsonFile.text());
  const frameEntries = Array.isArray(json.frames) ? json.frames : Object.values(json.frames ?? {});
  if (!frameEntries.length) throw new Error("Aseprite JSON has no frames.");
  const first: any = frameEntries[0];
  const width = Number(first.frame?.w ?? first.sourceSize?.w ?? 64);
  const height = Number(first.frame?.h ?? first.sourceSize?.h ?? 64);
  const layers: PixelLayer[] = [];
  const frames: PixelFrame[] = [];
  for (const [index, entry] of frameEntries.entries()) {
    const frame: any = (entry as any).frame ?? entry;
    const layer = createLayer(`Frame ${index + 1}`, width, height);
    layers.push({
      ...layer,
      pixels: await cropImagePixels(imageFile, Number(frame.x), Number(frame.y), Number(frame.w), Number(frame.h)),
      visible: true,
    });
    frames.push({
      id: uid("frame"),
      name: (entry as any).filename ?? `Frame ${index + 1}`,
      durationMs: Number((entry as any).duration ?? 160),
      layerIds: [layer.id],
    });
  }
  return {
    id: uid("asset"),
    name: json.meta?.app ? jsonFile.name.replace(/\.json$/i, "") : "Aseprite Import",
    width,
    height,
    layers,
    frames,
  };
};

export const importPixelFiles = async (files: File[]) => {
  const piskelFiles = files.filter((file) => file.name.toLowerCase().endsWith(".piskel"));
  const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith(".json"));
  const pngFiles = files.filter((file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
  const assets: PixelAsset[] = [];
  const usedCompanionPngs = new Set<string>();

  for (const file of piskelFiles) assets.push(await importPiskel(file));
  for (const file of jsonFiles) {
    const json = JSON.parse(await file.text());
    const isAseprite = json.frames && json.meta;
    const companion = pngFiles.find((png) => json.meta?.image ? png.name === json.meta.image : pngFiles.length === 1);
    if (isAseprite && companion) {
      usedCompanionPngs.add(companion.name);
      assets.push(await importAsepriteJson(new File([JSON.stringify(json)], file.name, { type: "application/json" }), companion));
    }
  }
  for (const file of pngFiles.filter((png) => !usedCompanionPngs.has(png.name))) assets.push(await importPngAsset(file));

  return assets;
};

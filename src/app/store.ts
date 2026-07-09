import { create } from "zustand";
import { createAsset, createLayer, createProject, createTemplateAsset, uid, type TemplateKind } from "../projects/factory";
import { deleteProject, listProjects, loadProject, saveProject } from "../projects/storage/db";
import { chooseFileSystemProjectFolder, disconnectFileSystemProjectFolder, fileSystemProjectSaveSupported, importFileSystemProjectFolder, writeProjectToFileSystem } from "../projects/storage/fileSystem";
import type { MovePreview, PixelAsset, PixelLayer, PixelProject, SceneCell, SceneLayer, Selection, ThemePreference, ToolId, Workspace } from "../projects/types";
import { palettePresetById, setDefaultPalettePresetId } from "../palettes/presets";
import {
  adjustColor,
  clearSelectionPixels,
  copySelection,
  ditherBrush,
  drawBrush,
  drawEllipse,
  drawLine,
  drawRect,
  flipClipX,
  flipClipY,
  floodFill,
  magicWandSelection,
  pastePixels,
  pixelPerfectPoints,
  replaceColor,
  resizePixels,
  rotateClip,
  setPixel,
  sprayBrush,
} from "../editor/tools/pixelOps";
import { drawPixelText } from "../editor/tools/pixelFont";

type Clip = { width: number; height: number; pixels: string[] };
type SaveStatus = "idle" | "saving" | "saved" | "error";
type FileSaveStatus = "unsupported" | "disconnected" | "connected" | "saving" | "error";
type SceneBrush = "asset" | "erase" | "grass" | "path" | "water" | "tree" | "bush" | "flower" | "rock" | "shadow";
type SceneRotation = 0 | 90 | 180 | 270;

type AppState = {
  projects: PixelProject[];
  project: PixelProject | null;
  workspace: Workspace;
  activeAssetId: string | null;
  activeLayerId: string | null;
  activeFrameId: string | null;
  activeTilesetId: string | null;
  activeSceneId: string | null;
  sceneBrush: SceneBrush;
  sceneFlipX: boolean;
  sceneFlipY: boolean;
  sceneRotation: SceneRotation;
  tool: ToolId;
  theme: ThemePreference;
  color: string;
  secondaryColor: string;
  brushSize: number;
  brushShape: "square" | "circle";
  blendAmount: number;
  shadowStrength: number;
  pixelPerfect: boolean;
  brushStabilizer: number;
  mirrorX: boolean;
  mirrorY: boolean;
  zoom: number;
  showGrid: boolean;
  selection: Selection;
  movePreview: MovePreview;
  clipboard: Clip | null;
  history: PixelProject[];
  future: PixelProject[];
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  saveError: string | null;
  fileSaveSupported: boolean;
  fileSaveStatus: FileSaveStatus;
  fileSaveFolderName: string | null;
  fileSaveError: string | null;
  isPlaying: boolean;
  onionSkin: boolean;
  fps: number;
  strokeStart: { x: number; y: number } | null;
  strokeLast: { x: number; y: number } | null;
  lassoMoveActive: boolean;
  lassoPoints: { x: number; y: number }[];
  strokeHistoryBase: PixelProject | null;
  refreshProjects: () => Promise<void>;
  createNewProject: (name: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  persist: () => Promise<void>;
  chooseProjectFolder: () => Promise<void>;
  disconnectProjectFolder: () => void;
  importProjectFolder: () => Promise<void>;
  setWorkspace: (workspace: Workspace) => void;
  setTool: (tool: ToolId) => void;
  setTheme: (theme: ThemePreference) => void;
  setColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setBrushShape: (shape: "square" | "circle") => void;
  setBlendAmount: (amount: number) => void;
  setShadowStrength: (amount: number) => void;
  togglePixelPerfect: () => void;
  setBrushStabilizer: (value: number) => void;
  toggleMirrorX: () => void;
  toggleMirrorY: () => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  setSelection: (selection: Selection) => void;
  beginStroke: (x: number, y: number) => void;
  applyToolAt: (x: number, y: number) => void;
  endStroke: (x: number, y: number) => void;
  selectAsset: (id: string) => void;
  addAsset: () => void;
  addAssetWithSize: (name: string, width: number, height: number) => void;
  addTemplateAsset: (kind: TemplateKind) => void;
  addAssetToTileset: (assetId: string) => void;
  addImportedAssets: (assets: PixelAsset[]) => void;
  duplicateAsset: (id: string) => void;
  resizeActiveAsset: (width: number, height: number) => void;
  renameAsset: (id: string, name: string) => void;
  addLayer: () => void;
  updateLayer: (id: string, patch: Partial<PixelLayer>) => void;
  removeLayer: (id: string) => void;
  mergeLayerDown: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayer: (id: string, direction: -1 | 1) => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  selectAll: () => void;
  selectVisiblePixels: () => void;
  deselect: () => void;
  deleteSelection: () => void;
  moveSelection: (dx: number, dy: number) => void;
  clearActiveLayer: () => void;
  addPixelText: (text: string, scale: number) => void;
  flipSelectionX: () => void;
  flipSelectionY: () => void;
  rotateSelection: () => void;
  undo: () => void;
  redo: () => void;
  addPaletteColor: (color: string) => void;
  removePaletteColor: (color: string) => void;
  addPaletteShades: (color: string) => void;
  addPaletteRamp: (color: string) => void;
  sortPalette: () => void;
  applyPalettePreset: (presetId: string, mode: "replace" | "append") => void;
  setDefaultPalettePreset: (presetId: string) => void;
  exportPaletteJson: () => string;
  importPaletteJson: (text: string) => void;
  importPaletteText: (text: string) => void;
  remapColor: (from: string, to: string) => void;
  remapArtToPalette: (paletteId?: string) => void;
  addFrame: () => void;
  duplicateFrame: () => void;
  addAssetAsFrame: (sourceAssetId: string) => void;
  removeFrame: (id: string) => void;
  moveFrame: (id: string, direction: -1 | 1) => void;
  setFrameDuration: (id: string, durationMs: number) => void;
  setActiveFrame: (id: string) => void;
  togglePlayback: () => void;
  toggleOnionSkin: () => void;
  setFps: (fps: number) => void;
  paintSceneTile: (x: number, y: number) => void;
  paintSceneBrush: (x: number, y: number) => void;
  setSceneBrush: (brush: SceneBrush) => void;
  setSceneLayer: (layer: SceneLayer) => void;
  toggleSceneFlipX: () => void;
  toggleSceneFlipY: () => void;
  rotateSceneBrush: () => void;
  importProject: (project: PixelProject) => Promise<void>;
};

const withProject = (state: AppState, recipe: (project: PixelProject) => PixelProject, historyBase?: PixelProject | null) => {
  if (!state.project) return {};
  const base = historyBase ?? state.project;
  const history = state.history[0] === base ? state.history : [base, ...state.history].slice(0, 80);
  return {
    project: recipe(state.project),
    history,
    future: [],
    saveStatus: "idle" as const,
    saveError: null,
  };
};

const updateActiveAsset = (project: PixelProject, assetId: string | null, recipe: (asset: PixelAsset) => PixelAsset) => ({
  ...project,
  assets: project.assets.map((asset) => (asset.id === assetId ? recipe(asset) : asset)),
  updatedAt: new Date().toISOString(),
});

const activeAsset = (state: AppState) => state.project?.assets.find((asset) => asset.id === state.activeAssetId) ?? null;
const activeLayer = (state: AppState) => activeAsset(state)?.layers.find((layer) => layer.id === state.activeLayerId) ?? null;
const strokeTools: ToolId[] = ["pencil", "eraser", "shadow", "spray", "dither", "replace", "lighten", "darken"];
const mutatingPointerTools: ToolId[] = [...strokeTools, "fill", "line", "rect", "ellipse", "move"];

const pixelsForLayer = (asset: PixelAsset, frameId: string | null, layer: PixelLayer) => {
  const frame = asset.frames.find((entry) => entry.id === frameId) ?? asset.frames[0];
  return frame?.cels?.[layer.id] ?? layer.pixels;
};

const setFrameLayerPixels = (asset: PixelAsset, frameId: string | null, layerId: string, pixels: string[]) => ({
  ...asset,
  frames: asset.frames.map((frame, index) =>
    frame.id === frameId || (!frameId && index === 0)
      ? { ...frame, cels: { ...(frame.cels ?? {}), [layerId]: pixels } }
      : frame,
  ),
});

const restoredIds = (snapshot: PixelProject, state: AppState) => {
  const asset = snapshot.assets.find((entry) => entry.id === state.activeAssetId) ?? snapshot.assets[0] ?? null;
  const layer = asset?.layers.find((entry) => entry.id === state.activeLayerId) ?? asset?.layers[0] ?? null;
  const frame = asset?.frames.find((entry) => entry.id === state.activeFrameId) ?? asset?.frames[0] ?? null;
  return {
    activeAssetId: asset?.id ?? null,
    activeLayerId: layer?.id ?? null,
    activeFrameId: frame?.id ?? null,
    activeTilesetId: snapshot.tilesets.find((entry) => entry.id === state.activeTilesetId)?.id ?? snapshot.tilesets[0]?.id ?? null,
    activeSceneId: snapshot.scenes.find((entry) => entry.id === state.activeSceneId)?.id ?? snapshot.scenes[0]?.id ?? null,
  };
};

const ensureTemplateAsset = (project: PixelProject, kind: TemplateKind) => {
  const template = createTemplateAsset(kind);
  const existing = project.assets.find((asset) => asset.name === template.name);
  if (existing) return { project, assetId: existing.id };
  const asset = { ...template, paletteId: project.palettes[0]?.id };
  return {
    project: {
      ...project,
      assets: [...project.assets, asset],
      tilesets: project.tilesets.map((tileset, index) =>
        index === 0 ? { ...tileset, assetIds: [...new Set([...tileset.assetIds, asset.id])] } : tileset,
      ),
    },
    assetId: asset.id,
  };
};

const layerForSceneBrush = (brush: SceneBrush, activeLayer: SceneLayer): SceneLayer => {
  if (brush === "asset" || brush === "erase") return activeLayer;
  if (brush === "grass" || brush === "path" || brush === "water") return "ground";
  if (brush === "shadow") return "overlay";
  return "objects";
};

const brushNeedsShadow = (brush: SceneBrush) => brush === "tree" || brush === "bush" || brush === "rock";
const sceneCells = (scene: { width: number; height: number }, cells: SceneCell[]) =>
  Array.from({ length: scene.width * scene.height }, (_, index) => cells[index] ?? null);

const sceneTileRef = (assetId: string, transform: { sceneFlipX: boolean; sceneFlipY: boolean; sceneRotation: SceneRotation }): SceneCell => ({
  assetId,
  flipX: transform.sceneFlipX || undefined,
  flipY: transform.sceneFlipY || undefined,
  rotation: transform.sceneRotation || undefined,
});

const lassoBounds = (points: { x: number; y: number }[]): Selection => {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

const selectionContains = (selection: Selection, x: number, y: number) =>
  Boolean(selection && x >= selection.x && y >= selection.y && x < selection.x + selection.width && y < selection.y + selection.height);

const clampedSelectionDelta = (asset: PixelAsset, selection: NonNullable<Selection>, dx: number, dy: number) => {
  const targetX = Math.max(0, Math.min(asset.width - selection.width, selection.x + dx));
  const targetY = Math.max(0, Math.min(asset.height - selection.height, selection.y + dy));
  return { dx: targetX - selection.x, dy: targetY - selection.y };
};

const linePoints = (x0: number, y0: number, x1: number, y1: number) => {
  const points: { x: number; y: number }[] = [];
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    points.push({ x: x0, y: y0 });
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
  return points;
};

const shadeColor = (hex: string, amount: number) => {
  if (!hex.startsWith("#") || hex.length !== 7) return "rgba(0,0,0,0.28)";
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((value >> 16) & 255) - amount);
  const g = Math.max(0, ((value >> 8) & 255) - amount);
  const b = Math.max(0, (value & 255) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const normalizeHex = (color: string) => color.trim().toLowerCase();

const validHex = (color: string) => /^#[0-9a-f]{6}$/i.test(color);

const uniqueColors = (colors: string[]) => [...new Set(colors.map(normalizeHex).filter(validHex))];

const hexChannels = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const luminance = (hex: string) => {
  const { r, g, b } = hexChannels(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const channelDistance = (a: string, b: string) => {
  const left = hexChannels(a);
  const right = hexChannels(b);
  return Math.sqrt((left.r - right.r) ** 2 + (left.g - right.g) ** 2 + (left.b - right.b) ** 2);
};

const nearestColor = (color: string, palette: string[]) =>
  palette.reduce((best, candidate) => (channelDistance(color, candidate) < channelDistance(color, best) ? candidate : best), palette[0] ?? color);

const remapPixelsToPalette = (pixels: string[], palette: string[]) =>
  pixels.map((pixel) => (!pixel || pixel === "transparent" || !validHex(pixel) || !palette.length ? pixel : nearestColor(normalizeHex(pixel), palette)));

const buildPaletteRamp = (color: string) =>
  uniqueColors([adjustColor(color, -64), adjustColor(color, -36), adjustColor(color, -16), color, adjustColor(color, 20), adjustColor(color, 44), adjustColor(color, 68)]);

const extractPalettePayload = (text: string) => {
  try {
    const parsed = JSON.parse(text) as unknown;
    const value =
      Array.isArray(parsed)
        ? { name: "Imported Palette", colors: parsed }
        : parsed && typeof parsed === "object" && "palette" in parsed
          ? (parsed as { palette?: unknown }).palette
          : parsed;
    if (value && typeof value === "object" && "colors" in value && Array.isArray((value as { colors: unknown[] }).colors)) {
      const candidate = value as { name?: unknown; colors: unknown[] };
      return {
        name: typeof candidate.name === "string" ? candidate.name : "Imported Palette",
        colors: uniqueColors(candidate.colors.filter((entry): entry is string => typeof entry === "string")),
      };
    }
  } catch {
    // Plain text and GPL palette files fall through to the hex extractor.
  }
  return {
    name: "Imported Palette",
    colors: uniqueColors([...text.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((match) => match[0])),
  };
};

const paintAt = (pixels: string[], width: number, height: number, x: number, y: number, state: AppState) => {
  if (state.tool === "fill") return floodFill(pixels, width, height, x, y, state.color);
  const points = [{ x, y }];
  if (state.mirrorX) points.push({ x: width - 1 - x, y });
  if (state.mirrorY) points.push({ x, y: height - 1 - y });
  if (state.mirrorX && state.mirrorY) points.push({ x: width - 1 - x, y: height - 1 - y });

  return points.reduce((next, point) => {
    if (state.tool === "eraser") return drawBrush(next, width, height, point.x, point.y, "transparent", state.brushSize, state.brushShape);
    if (state.tool === "spray") return sprayBrush(next, width, height, point.x, point.y, state.color, state.brushSize);
    if (state.tool === "dither") return ditherBrush(next, width, height, point.x, point.y, state.color, state.brushSize, state.brushShape);
    if (state.tool === "replace") {
      const target = next[point.y * width + point.x];
      return target ? replaceColor(next, target, state.color) : next;
    }
    if (state.tool === "shadow") return drawBrush(next, width, height, point.x, point.y, shadeColor(state.color, state.shadowStrength), state.brushSize, state.brushShape);
    if (state.tool === "lighten" || state.tool === "darken") {
      const existing = next[point.y * width + point.x];
      const adjusted = existing && existing !== "transparent" ? adjustColor(existing, state.tool === "lighten" ? state.blendAmount : -state.blendAmount) : existing;
      return adjusted ? drawBrush(next, width, height, point.x, point.y, adjusted, state.brushSize, state.brushShape) : next;
    }
    return drawBrush(next, width, height, point.x, point.y, state.color, state.brushSize, state.brushShape);
  }, pixels);
};

const compositeAssetPixels = (asset: PixelAsset, frameId?: string | null) => {
  const pixels = Array.from({ length: asset.width * asset.height }, () => "transparent");
  asset.layers.forEach((layer) => {
    if (!layer.visible) return;
    const layerPixels = pixelsForLayer(asset, frameId ?? asset.frames[0]?.id ?? null, layer);
    layerPixels.forEach((color, index) => {
      if (color && color !== "transparent") pixels[index] = color;
    });
  });
  return pixels;
};

const visiblePixelBounds = (pixels: string[], width: number, height: number): Selection => {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  pixels.forEach((color, index) => {
    if (!color || color === "transparent") return;
    const x = index % width;
    const y = Math.floor(index / width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  });
  if (right < left || bottom < top) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  project: null,
  workspace: "editor",
  activeAssetId: null,
  activeLayerId: null,
  activeFrameId: null,
  activeTilesetId: null,
  activeSceneId: null,
  sceneBrush: "asset",
  sceneFlipX: false,
  sceneFlipY: false,
  sceneRotation: 0,
  tool: "pencil",
  theme: (localStorage.getItem("pixel-editor-theme") as ThemePreference | null) ?? "system",
  color: "#1f1f29",
  secondaryColor: "transparent",
  brushSize: 1,
  brushShape: "square",
  blendAmount: 18,
  shadowStrength: 42,
  pixelPerfect: false,
  brushStabilizer: 0,
  mirrorX: false,
  mirrorY: false,
  zoom: 12,
  showGrid: true,
  selection: null,
  movePreview: null,
  clipboard: null,
  history: [],
  future: [],
  saveStatus: "idle",
  lastSavedAt: null,
  saveError: null,
  fileSaveSupported: fileSystemProjectSaveSupported(),
  fileSaveStatus: fileSystemProjectSaveSupported() ? "disconnected" : "unsupported",
  fileSaveFolderName: null,
  fileSaveError: null,
  isPlaying: false,
  onionSkin: true,
  fps: 8,
  strokeStart: null,
  strokeLast: null,
  lassoMoveActive: false,
  lassoPoints: [],
  strokeHistoryBase: null,

  refreshProjects: async () => set({ projects: await listProjects() }),
  createNewProject: async (name) => {
    const project = createProject(name || "New Pixel Project");
    disconnectFileSystemProjectFolder();
    await saveProject(project);
    set({
      project,
      projects: await listProjects(),
      activeAssetId: project.assets[0]?.id ?? null,
      activeLayerId: project.assets[0]?.layers[0]?.id ?? null,
      activeFrameId: project.assets[0]?.frames[0]?.id ?? null,
      activeTilesetId: project.tilesets[0]?.id ?? null,
      activeSceneId: project.scenes[0]?.id ?? null,
      history: [],
      future: [],
      movePreview: null,
      saveStatus: "saved",
      lastSavedAt: project.updatedAt,
      saveError: null,
      fileSaveSupported: fileSystemProjectSaveSupported(),
      fileSaveStatus: fileSystemProjectSaveSupported() ? "disconnected" : "unsupported",
      fileSaveFolderName: null,
      fileSaveError: null,
    });
  },
  openProject: async (id) => {
    const project = await loadProject(id);
    if (!project) return;
    disconnectFileSystemProjectFolder();
    set({
      project,
      activeAssetId: project.assets[0]?.id ?? null,
      activeLayerId: project.assets[0]?.layers[0]?.id ?? null,
      activeFrameId: project.assets[0]?.frames[0]?.id ?? null,
      activeTilesetId: project.tilesets[0]?.id ?? null,
      activeSceneId: project.scenes[0]?.id ?? null,
      history: [],
      future: [],
      movePreview: null,
      saveStatus: "saved",
      lastSavedAt: project.updatedAt,
      saveError: null,
      fileSaveSupported: fileSystemProjectSaveSupported(),
      fileSaveStatus: fileSystemProjectSaveSupported() ? "disconnected" : "unsupported",
      fileSaveFolderName: null,
      fileSaveError: null,
    });
  },
  removeProject: async (id) => {
    await deleteProject(id);
    set({ projects: await listProjects(), project: get().project?.id === id ? null : get().project });
  },
  persist: async () => {
    const project = get().project;
    if (!project) return;
    set({ saveStatus: "saving", saveError: null });
    try {
      await saveProject(project);
      const savedAt = new Date().toISOString();
      const nextState: Partial<AppState> = { projects: await listProjects(), saveStatus: "saved", lastSavedAt: savedAt, saveError: null };
      if (get().fileSaveStatus === "connected" || get().fileSaveStatus === "saving") {
        try {
          set({ fileSaveStatus: "saving", fileSaveError: null });
          const fileState = await writeProjectToFileSystem(project);
          nextState.fileSaveStatus = fileState?.connected ? "connected" : "disconnected";
          nextState.fileSaveFolderName = fileState?.folderName ?? null;
          nextState.fileSaveError = null;
        } catch (error) {
          nextState.fileSaveStatus = "error";
          nextState.fileSaveError = error instanceof Error ? error.message : "Folder autosave failed";
        }
      }
      set(nextState);
    } catch (error) {
      set({ saveStatus: "error", saveError: error instanceof Error ? error.message : "Save failed" });
      throw error;
    }
  },
  chooseProjectFolder: async () => {
    const project = get().project;
    if (!project) return;
    if (!fileSystemProjectSaveSupported()) {
      set({ fileSaveSupported: false, fileSaveStatus: "unsupported", fileSaveError: "Folder autosave needs Chrome or Edge on desktop." });
      return;
    }
    set({ fileSaveSupported: true, fileSaveStatus: "saving", fileSaveError: null });
    try {
      const fileState = await chooseFileSystemProjectFolder(project);
      set({ fileSaveStatus: "connected", fileSaveFolderName: fileState.folderName, fileSaveError: null });
      await get().persist();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        set({ fileSaveStatus: "disconnected", fileSaveFolderName: null, fileSaveError: null });
        return;
      }
      set({
        fileSaveStatus: "error",
        fileSaveFolderName: null,
        fileSaveError: error instanceof Error ? error.message : "Could not connect project folder",
      });
    }
  },
  disconnectProjectFolder: () => {
    disconnectFileSystemProjectFolder();
    set({
      fileSaveSupported: fileSystemProjectSaveSupported(),
      fileSaveStatus: fileSystemProjectSaveSupported() ? "disconnected" : "unsupported",
      fileSaveFolderName: null,
      fileSaveError: null,
    });
  },
  importProjectFolder: async () => {
    if (!fileSystemProjectSaveSupported()) {
      set({ fileSaveSupported: false, fileSaveStatus: "unsupported", fileSaveError: "Project folder import needs Chrome or Edge on desktop." });
      return;
    }
    set({ fileSaveSupported: true, fileSaveStatus: "saving", fileSaveError: null });
    try {
      const imported = await importFileSystemProjectFolder();
      const project = imported.project;
      await saveProject(project);
      set({
        project,
        projects: await listProjects(),
        activeAssetId: project.assets[0]?.id ?? null,
        activeLayerId: project.assets[0]?.layers[0]?.id ?? null,
        activeFrameId: project.assets[0]?.frames[0]?.id ?? null,
        activeTilesetId: project.tilesets[0]?.id ?? null,
        activeSceneId: project.scenes[0]?.id ?? null,
        history: [],
        future: [],
        movePreview: null,
        saveStatus: "saved",
        lastSavedAt: project.updatedAt,
        saveError: null,
        fileSaveSupported: true,
        fileSaveStatus: "connected",
        fileSaveFolderName: imported.folderName,
        fileSaveError: null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        set({ fileSaveStatus: "disconnected", fileSaveFolderName: null, fileSaveError: null });
        return;
      }
      set({
        fileSaveStatus: "error",
        fileSaveFolderName: null,
        fileSaveError: error instanceof Error ? error.message : "Could not import project folder",
      });
    }
  },
  setWorkspace: (workspace) => set({ workspace }),
  setTool: (tool) => set({ tool, movePreview: null, strokeStart: null, strokeLast: null, lassoMoveActive: false, lassoPoints: [] }),
  setTheme: (theme) => {
    localStorage.setItem("pixel-editor-theme", theme);
    set({ theme });
  },
  setColor: (color) => set({ color }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setBrushShape: (brushShape) => set({ brushShape }),
  setBlendAmount: (blendAmount) => set({ blendAmount }),
  setShadowStrength: (shadowStrength) => set({ shadowStrength }),
  togglePixelPerfect: () => set({ pixelPerfect: !get().pixelPerfect }),
  setBrushStabilizer: (brushStabilizer) => set({ brushStabilizer }),
  toggleMirrorX: () => set({ mirrorX: !get().mirrorX }),
  toggleMirrorY: () => set({ mirrorY: !get().mirrorY }),
  setZoom: (zoom) => set({ zoom }),
  toggleGrid: () => set({ showGrid: !get().showGrid }),
  setSelection: (selection) => set({ selection }),
  beginStroke: (x, y) => {
    const state = get();
    const lassoMoveActive = state.tool === "lasso" && selectionContains(state.selection, x, y);
    const movePreviewActive = (state.tool === "move" || lassoMoveActive) && state.selection && selectionContains(state.selection, x, y) && state.activeLayerId;
    set({
      strokeStart: { x, y },
      strokeLast: { x, y },
      lassoMoveActive,
      lassoPoints: state.tool === "lasso" && !lassoMoveActive ? [{ x, y }] : [],
      movePreview: movePreviewActive ? { selection: state.selection!, dx: 0, dy: 0, layerId: state.activeLayerId! } : null,
      strokeHistoryBase: state.project && (mutatingPointerTools.includes(state.tool) || lassoMoveActive) ? state.project : null,
    });
  },
  applyToolAt: (x, y) => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer || layer.locked) return;
    const color = state.tool === "eraser" ? "transparent" : state.color;
    if (state.tool === "picker") {
      const picked = pixelsForLayer(asset, state.activeFrameId, layer)[y * asset.width + x];
      if (picked && picked !== "transparent") set({ color: picked });
      return;
    }
    if (state.tool === "select") {
      const start = state.strokeStart ?? { x, y };
      const left = Math.min(start.x, x);
      const top = Math.min(start.y, y);
      set({ selection: { x: left, y: top, width: Math.abs(x - start.x) + 1, height: Math.abs(y - start.y) + 1 } });
      return;
    }
    if (state.tool === "magic") {
      set({ selection: magicWandSelection(pixelsForLayer(asset, state.activeFrameId, layer), asset.width, asset.height, x, y) });
      return;
    }
    if (state.tool === "lasso") {
      if (state.lassoMoveActive) {
        if (state.strokeStart && state.movePreview) {
          const delta = clampedSelectionDelta(asset, state.movePreview.selection, x - state.strokeStart.x, y - state.strokeStart.y);
          set({ movePreview: { ...state.movePreview, ...delta }, strokeLast: { x, y } });
        }
        return;
      }
      const points = [...state.lassoPoints, { x, y }];
      set({ lassoPoints: points, selection: lassoBounds(points) });
      return;
    }
    if (state.tool === "move") {
      if (state.strokeStart && state.movePreview) {
        const delta = clampedSelectionDelta(asset, state.movePreview.selection, x - state.strokeStart.x, y - state.strokeStart.y);
        set({ movePreview: { ...state.movePreview, ...delta }, strokeLast: { x, y } });
      }
      return;
    }
    if (state.tool === "fill") {
      if (x < 0 || y < 0 || x >= asset.width || y >= asset.height) return;
      set({
        ...withProject(state, (project) =>
          updateActiveAsset(project, state.activeAssetId, (entry) => ({
            ...setFrameLayerPixels(
              entry,
              state.activeFrameId,
              layer.id,
              floodFill(pixelsForLayer(entry, state.activeFrameId, layer), entry.width, entry.height, x, y, state.color),
            ),
          })),
        state.strokeHistoryBase),
        strokeLast: { x, y },
      });
      return;
    }
    if (!strokeTools.includes(state.tool)) return;
    if (state.strokeLast && state.brushStabilizer > 0 && Math.abs(x - state.strokeLast.x) + Math.abs(y - state.strokeLast.y) < state.brushStabilizer) return;
    const rawPoints = state.strokeLast && strokeTools.includes(state.tool) ? linePoints(state.strokeLast.x, state.strokeLast.y, x, y) : [{ x, y }];
    const points = state.pixelPerfect && state.tool === "pencil" && state.brushSize === 1 ? pixelPerfectPoints(rawPoints) : rawPoints;
    set({
      ...withProject(state, (project) =>
        updateActiveAsset(project, state.activeAssetId, (entry) => ({
          ...setFrameLayerPixels(
            entry,
            state.activeFrameId,
            layer.id,
            points.reduce((pixels, point) => paintAt(pixels, entry.width, entry.height, point.x, point.y, state), pixelsForLayer(entry, state.activeFrameId, layer)),
          ),
        })),
      state.strokeHistoryBase),
      strokeLast: { x, y },
    });
  },
  endStroke: (x, y) => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    const start = state.strokeStart;
    if (!asset || !layer || !start) return set({ strokeStart: null, strokeLast: null, lassoMoveActive: false, strokeHistoryBase: null });
    if (state.tool === "select") {
      const left = Math.min(start.x, x);
      const top = Math.min(start.y, y);
      set({ selection: { x: left, y: top, width: Math.abs(x - start.x) + 1, height: Math.abs(y - start.y) + 1 }, strokeStart: null, strokeLast: null, lassoMoveActive: false, strokeHistoryBase: null });
      return;
    }
    if (state.tool === "lasso") {
      if (state.lassoMoveActive) {
        if (state.movePreview && (state.movePreview.dx || state.movePreview.dy)) get().moveSelection(state.movePreview.dx, state.movePreview.dy);
        set({ lassoMoveActive: false, lassoPoints: [], movePreview: null, strokeStart: null, strokeLast: null, strokeHistoryBase: null });
        return;
      }
      const points = [...state.lassoPoints, { x, y }];
      set({ selection: lassoBounds(points), lassoPoints: [], movePreview: null, strokeStart: null, strokeLast: null, lassoMoveActive: false, strokeHistoryBase: null });
      return;
    }
    if (state.tool === "move") {
      if (state.movePreview && (state.movePreview.dx || state.movePreview.dy)) get().moveSelection(state.movePreview.dx, state.movePreview.dy);
      set({ movePreview: null, strokeStart: null, strokeLast: null, lassoMoveActive: false, strokeHistoryBase: null });
      return;
    }
    const drawTools = ["line", "rect", "ellipse"];
    if (!drawTools.includes(state.tool)) return set({ strokeStart: null, strokeLast: null, lassoMoveActive: false, strokeHistoryBase: null });
    set({
      ...withProject(state, (project) =>
        updateActiveAsset(project, state.activeAssetId, (entry) => ({
          ...setFrameLayerPixels(
            entry,
            state.activeFrameId,
            layer.id,
            state.tool === "line"
              ? drawLine(pixelsForLayer(entry, state.activeFrameId, layer), entry.width, entry.height, start.x, start.y, x, y, state.color)
              : state.tool === "rect"
                ? drawRect(pixelsForLayer(entry, state.activeFrameId, layer), entry.width, entry.height, start.x, start.y, x, y, state.color)
                : drawEllipse(pixelsForLayer(entry, state.activeFrameId, layer), entry.width, entry.height, start.x, start.y, x, y, state.color),
          ),
        })),
      state.strokeHistoryBase),
      strokeStart: null,
      strokeLast: null,
      lassoMoveActive: false,
      movePreview: null,
      strokeHistoryBase: null,
    });
  },
  selectAsset: (id) => {
    const asset = get().project?.assets.find((entry) => entry.id === id);
    set({ activeAssetId: id, activeLayerId: asset?.layers[0]?.id ?? null, activeFrameId: asset?.frames[0]?.id ?? null });
  },
  addAsset: () =>
    set(
      withProject(get(), (project) => {
        const asset = createAsset(`Asset ${project.assets.length + 1}`, 64, 64);
        return {
          ...project,
          assets: [...project.assets, asset],
          tilesets: project.tilesets.map((tileset, index) => (index === 0 ? { ...tileset, assetIds: [...tileset.assetIds, asset.id] } : tileset)),
        };
      }),
    ),
  addAssetWithSize: (name, width, height) =>
    set(
      withProject(get(), (project) => {
        const asset = createAsset(name || `Asset ${project.assets.length + 1}`, width, height);
        setTimeout(() => set({ activeAssetId: asset.id, activeLayerId: asset.layers[0]?.id ?? null, activeFrameId: asset.frames[0]?.id ?? null }), 0);
        return {
          ...project,
          assets: [...project.assets, asset],
          tilesets: project.tilesets.map((tileset, index) => (index === 0 ? { ...tileset, assetIds: [...tileset.assetIds, asset.id] } : tileset)),
        };
      }),
    ),
  addTemplateAsset: (kind) =>
    set(
      withProject(get(), (project) => {
        const asset = { ...createTemplateAsset(kind), paletteId: project.palettes[0]?.id };
        setTimeout(() => set({ activeAssetId: asset.id, activeLayerId: asset.layers[0]?.id ?? null, activeFrameId: asset.frames[0]?.id ?? null }), 0);
        return {
          ...project,
          assets: [...project.assets, asset],
          tilesets: project.tilesets.map((tileset, index) =>
            index === 0 ? { ...tileset, assetIds: [...new Set([...tileset.assetIds, asset.id])] } : tileset,
          ),
        };
      }),
    ),
  addAssetToTileset: (assetId) =>
    set(
      withProject(get(), (project) => ({
        ...project,
        tilesets: project.tilesets.map((tileset, index) =>
          index === 0 ? { ...tileset, assetIds: [...new Set([...tileset.assetIds, assetId])] } : tileset,
        ),
      })),
    ),
  addImportedAssets: (assets) =>
    set(
      withProject(get(), (project) => {
        const imported = assets.map((asset) => ({
          ...asset,
          paletteId: asset.paletteId ?? project.palettes[0]?.id,
        }));
        const first = imported[0];
        if (first) {
          setTimeout(() => set({ activeAssetId: first.id, activeLayerId: first.layers[0]?.id ?? null, activeFrameId: first.frames[0]?.id ?? null }), 0);
        }
        return {
          ...project,
          assets: [...project.assets, ...imported],
          tilesets: project.tilesets.map((tileset, index) =>
            index === 0 ? { ...tileset, assetIds: [...tileset.assetIds, ...imported.map((asset) => asset.id)] } : tileset,
          ),
        };
      }),
    ),
  duplicateAsset: (id) =>
    set(
      withProject(get(), (project) => {
        const source = project.assets.find((asset) => asset.id === id);
        if (!source) return project;
        const layerIdMap = new Map<string, string>();
        const layers = source.layers.map((layer) => {
          const nextId = uid("layer");
          layerIdMap.set(layer.id, nextId);
          return { ...layer, id: nextId, pixels: [...layer.pixels] };
        });
        const asset = {
          ...source,
          id: uid("asset"),
          name: `${source.name} Copy`,
          layers,
          frames: source.frames.map((frame) => ({
            ...frame,
            id: uid("frame"),
            layerIds: frame.layerIds.map((layerId) => layerIdMap.get(layerId)).filter((layerId): layerId is string => Boolean(layerId)),
            cels: Object.fromEntries(
              Object.entries(frame.cels ?? {}).flatMap(([layerId, pixels]) => {
                const nextLayerId = layerIdMap.get(layerId);
                return nextLayerId ? [[nextLayerId, [...pixels]]] : [];
              }),
            ),
          })),
        };
        setTimeout(() => set({ activeAssetId: asset.id, activeLayerId: asset.layers[0]?.id ?? null, activeFrameId: asset.frames[0]?.id ?? null }), 0);
        return {
          ...project,
          assets: [...project.assets, asset],
          tilesets: project.tilesets.map((tileset, index) => (index === 0 ? { ...tileset, assetIds: [...tileset.assetIds, asset.id] } : tileset)),
        };
      }),
    ),
  resizeActiveAsset: (width, height) =>
    set(
      withProject(get(), (project) =>
        updateActiveAsset(project, get().activeAssetId, (asset) => ({
          ...asset,
          width,
          height,
          layers: asset.layers.map((layer) => ({
            ...layer,
            pixels: resizePixels(layer.pixels, asset.width, asset.height, width, height),
          })),
          frames: asset.frames.map((frame) => ({
            ...frame,
            cels: Object.fromEntries(
              Object.entries(frame.cels ?? {}).map(([layerId, pixels]) => [layerId, resizePixels(pixels, asset.width, asset.height, width, height)]),
            ),
          })),
        })),
      ),
    ),
  renameAsset: (id, name) => set(withProject(get(), (project) => ({ ...project, assets: project.assets.map((asset) => (asset.id === id ? { ...asset, name } : asset)) }))),
  addLayer: () =>
    set(
      withProject(get(), (project) =>
        updateActiveAsset(project, get().activeAssetId, (asset) => {
          const layer = createLayer(`Layer ${asset.layers.length + 1}`, asset.width, asset.height);
          setTimeout(() => set({ activeLayerId: layer.id }), 0);
          return {
            ...asset,
            layers: [...asset.layers, layer],
            frames: asset.frames.map((frame) => ({
              ...frame,
              layerIds: [...new Set([...frame.layerIds, layer.id])],
              cels: { ...(frame.cels ?? {}), [layer.id]: [...layer.pixels] },
            })),
          };
        }),
      ),
    ),
  updateLayer: (id, patch) =>
    set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => ({ ...asset, layers: asset.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) })))),
  removeLayer: (id) =>
    set(
      withProject(get(), (project) =>
        updateActiveAsset(project, get().activeAssetId, (asset) => {
          if (asset.layers.length <= 1) return asset;
          const layers = asset.layers.filter((layer) => layer.id !== id);
          setTimeout(() => set({ activeLayerId: layers[0]?.id ?? null }), 0);
          return {
            ...asset,
            layers,
            frames: asset.frames.map((frame) => {
              const { [id]: _removed, ...cels } = frame.cels ?? {};
              return { ...frame, layerIds: frame.layerIds.filter((layerId) => layerId !== id), cels };
            }),
          };
        }),
      ),
    ),
  mergeLayerDown: (id) =>
    set(
      withProject(get(), (project) =>
        updateActiveAsset(project, get().activeAssetId, (asset) => {
          const index = asset.layers.findIndex((layer) => layer.id === id);
          if (index <= 0) return asset;
          const top = asset.layers[index];
          const bottom = asset.layers[index - 1];
          const pixels = bottom.pixels.map((color, pixelIndex) => (top.pixels[pixelIndex] !== "transparent" ? top.pixels[pixelIndex] : color));
          const layers = [...asset.layers];
          layers.splice(index - 1, 2, { ...bottom, pixels, name: `${bottom.name} + ${top.name}` });
          return {
            ...asset,
            layers,
            frames: asset.frames.map((frame) => {
              const topPixels = frame.cels?.[top.id] ?? top.pixels;
              const bottomPixels = frame.cels?.[bottom.id] ?? bottom.pixels;
              const merged = bottomPixels.map((color, pixelIndex) => (topPixels[pixelIndex] !== "transparent" ? topPixels[pixelIndex] : color));
              const { [top.id]: _removed, ...cels } = frame.cels ?? {};
              return {
                ...frame,
                layerIds: frame.layerIds.filter((layerId) => layerId !== top.id),
                cels: { ...cels, [bottom.id]: merged },
              };
            }),
          };
        }),
      ),
    ),
  duplicateLayer: (id) =>
    set(
      withProject(get(), (project) =>
        updateActiveAsset(project, get().activeAssetId, (asset) => {
          const source = asset.layers.find((layer) => layer.id === id);
          if (!source) return asset;
          const layer = { ...source, id: uid("layer"), name: `${source.name} Copy`, pixels: [...source.pixels] };
          setTimeout(() => set({ activeLayerId: layer.id }), 0);
          return {
            ...asset,
            layers: [...asset.layers, layer],
            frames: asset.frames.map((frame) => ({
              ...frame,
              layerIds: [...new Set([...frame.layerIds, layer.id])],
              cels: { ...(frame.cels ?? {}), [layer.id]: [...(frame.cels?.[source.id] ?? source.pixels)] },
            })),
          };
        }),
      ),
    ),
  moveLayer: (id, direction) =>
    set(
      withProject(get(), (project) =>
        updateActiveAsset(project, get().activeAssetId, (asset) => {
          const index = asset.layers.findIndex((layer) => layer.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= asset.layers.length) return asset;
          const layers = [...asset.layers];
          [layers[index], layers[target]] = [layers[target], layers[index]];
          return { ...asset, layers };
        }),
      ),
    ),
  copy: () => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer || !state.selection) return;
    set({ clipboard: copySelection({ ...layer, pixels: pixelsForLayer(asset, state.activeFrameId, layer) }, asset.width, state.selection) });
  },
  cut: () => {
    get().copy();
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer || !state.selection) return;
    set(
      withProject(state, (project) =>
        updateActiveAsset(project, state.activeAssetId, (entry) => ({
          ...setFrameLayerPixels(
            entry,
            state.activeFrameId,
            layer.id,
            (() => {
              const pixels = [...pixelsForLayer(entry, state.activeFrameId, layer)];
              for (let yy = 0; yy < state.selection!.height; yy += 1) {
                for (let xx = 0; xx < state.selection!.width; xx += 1) pixels[(state.selection!.y + yy) * entry.width + state.selection!.x + xx] = "transparent";
              }
              return pixels;
            })(),
          ),
        })),
      ),
    );
  },
  paste: () => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer || !state.clipboard) return;
    const x = state.selection?.x ?? 0;
    const y = state.selection?.y ?? 0;
    set(withProject(state, (project) => updateActiveAsset(project, state.activeAssetId, (entry) => ({
      ...setFrameLayerPixels(
        entry,
        state.activeFrameId,
        layer.id,
        pastePixels({ ...layer, pixels: pixelsForLayer(entry, state.activeFrameId, layer) }, entry.width, entry.height, x, y, state.clipboard!),
      ),
    }))));
  },
  selectAll: () => {
    const asset = activeAsset(get());
    if (asset) set({ selection: { x: 0, y: 0, width: asset.width, height: asset.height } });
  },
  selectVisiblePixels: () => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer) return;
    set({ selection: visiblePixelBounds(pixelsForLayer(asset, state.activeFrameId, layer), asset.width, asset.height) });
  },
  deselect: () => set({ selection: null, movePreview: null }),
  deleteSelection: () => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer || !state.selection) return;
    set(withProject(state, (project) => updateActiveAsset(project, state.activeAssetId, (entry) => ({
      ...setFrameLayerPixels(entry, state.activeFrameId, layer.id, clearSelectionPixels(pixelsForLayer(entry, state.activeFrameId, layer), entry.width, state.selection!)),
    }))));
  },
  moveSelection: (dx, dy) => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    const selection = state.selection;
    if (!asset || !layer || layer.locked || !selection || (!dx && !dy)) return;
    const delta = clampedSelectionDelta(asset, selection, dx, dy);
    const targetX = selection.x + delta.dx;
    const targetY = selection.y + delta.dy;
    if (targetX === selection.x && targetY === selection.y) return;
    const nextSelection = { ...selection, x: targetX, y: targetY };
    set({
      ...withProject(state, (project) =>
        updateActiveAsset(project, state.activeAssetId, (entry) => {
          const currentPixels = pixelsForLayer(entry, state.activeFrameId, layer);
          const clip = copySelection({ ...layer, pixels: currentPixels }, entry.width, selection);
          const cleared = clearSelectionPixels(currentPixels, entry.width, selection);
          return {
            ...setFrameLayerPixels(
              entry,
              state.activeFrameId,
              layer.id,
              pastePixels({ ...layer, pixels: cleared }, entry.width, entry.height, targetX, targetY, clip),
            ),
          };
        }),
      state.strokeHistoryBase),
      selection: nextSelection,
      movePreview: null,
    });
  },
  clearActiveLayer: () => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer || layer.locked) return;
    set(withProject(state, (project) => updateActiveAsset(project, state.activeAssetId, (entry) => ({
      ...setFrameLayerPixels(entry, state.activeFrameId, layer.id, Array.from({ length: entry.width * entry.height }, () => "transparent")),
    }))));
  },
  addPixelText: (text, scale) => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").slice(0, 240);
    if (!asset || !layer || layer.locked || !cleanText.trim()) return;
    const x = state.selection?.x ?? 0;
    const y = state.selection?.y ?? 0;
    const color = state.color && state.color !== "transparent" ? state.color : "#111827";
    set(withProject(state, (project) => updateActiveAsset(project, state.activeAssetId, (entry) => ({
      ...setFrameLayerPixels(
        entry,
        state.activeFrameId,
        layer.id,
        drawPixelText(pixelsForLayer(entry, state.activeFrameId, layer), entry.width, entry.height, x, y, cleanText, color, scale),
      ),
    }))));
  },
  flipSelectionX: () => set({ clipboard: get().clipboard ? flipClipX(get().clipboard!) : get().clipboard }),
  flipSelectionY: () => set({ clipboard: get().clipboard ? flipClipY(get().clipboard!) : get().clipboard }),
  rotateSelection: () => set({ clipboard: get().clipboard ? rotateClip(get().clipboard!) : get().clipboard }),
  undo: () => {
    const state = get();
    const previous = state.history[0];
    if (!previous || !state.project) return;
    set({
      project: previous,
      ...restoredIds(previous, state),
      history: state.history.slice(1),
      future: [state.project, ...state.future],
      strokeStart: null,
      strokeLast: null,
      lassoMoveActive: false,
      movePreview: null,
      strokeHistoryBase: null,
      saveStatus: "idle",
      saveError: null,
    });
  },
  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next || !state.project) return;
    set({
      project: next,
      ...restoredIds(next, state),
      future: state.future.slice(1),
      history: [state.project, ...state.history],
      strokeStart: null,
      strokeLast: null,
      lassoMoveActive: false,
      movePreview: null,
      strokeHistoryBase: null,
      saveStatus: "idle",
      saveError: null,
    });
  },
  addPaletteColor: (color) =>
    set(withProject(get(), (project) => ({ ...project, palettes: project.palettes.map((palette, index) => (index === 0 ? { ...palette, colors: [...new Set([...palette.colors, color])] } : palette)) }))),
  removePaletteColor: (color) =>
    set(withProject(get(), (project) => ({ ...project, palettes: project.palettes.map((palette, index) => (index === 0 ? { ...palette, colors: palette.colors.filter((entry) => entry !== color) } : palette)) }))),
  addPaletteShades: (color) =>
    set(withProject(get(), (project) => ({ ...project, palettes: project.palettes.map((palette, index) => (index === 0 ? { ...palette, colors: [...new Set([...palette.colors, adjustColor(color, -48), adjustColor(color, -24), color, adjustColor(color, 24), adjustColor(color, 48)])] } : palette)) }))),
  addPaletteRamp: (color) =>
    set(withProject(get(), (project) => ({ ...project, palettes: project.palettes.map((palette, index) => (index === 0 ? { ...palette, colors: uniqueColors([...palette.colors, ...buildPaletteRamp(color)]) } : palette)) }))),
  sortPalette: () =>
    set(withProject(get(), (project) => ({ ...project, palettes: project.palettes.map((palette, index) => (index === 0 ? { ...palette, colors: [...palette.colors].sort((a, b) => luminance(a) - luminance(b)) } : palette)) }))),
  applyPalettePreset: (presetId, mode) => {
    const preset = palettePresetById(presetId);
    if (!preset) return;
    set(
      withProject(get(), (project) => ({
        ...project,
        palettes: project.palettes.map((palette, index) =>
          index === 0
            ? {
                ...palette,
                name: mode === "replace" ? preset.name : palette.name,
                colors: mode === "replace" ? uniqueColors(preset.colors) : uniqueColors([...palette.colors, ...preset.colors]),
              }
            : palette,
        ),
      })),
    );
  },
  setDefaultPalettePreset: (presetId) => {
    setDefaultPalettePresetId(presetId);
    get().applyPalettePreset(presetId, "replace");
  },
  exportPaletteJson: () => {
    const palette = get().project?.palettes[0];
    if (!palette) return "";
    return JSON.stringify({ type: "easyPIX-palette", version: 1, palette }, null, 2);
  },
  importPaletteJson: (text) => {
    const imported = extractPalettePayload(text);
    if (!imported.colors.length) return;
    set(
      withProject(get(), (project) => ({
        ...project,
        palettes: project.palettes.map((palette, index) =>
          index === 0
            ? {
                ...palette,
                name: imported.name || palette.name,
                colors: uniqueColors([...palette.colors, ...imported.colors]),
              }
            : palette,
        ),
      })),
    );
  },
  importPaletteText: (text) => {
    const colors = extractPalettePayload(text).colors;
    if (!colors.length) return;
    set(withProject(get(), (project) => ({ ...project, palettes: project.palettes.map((palette, index) => (index === 0 ? { ...palette, colors: uniqueColors([...palette.colors, ...colors]) } : palette)) })));
  },
  remapColor: (from, to) => {
    const source = normalizeHex(from);
    const target = normalizeHex(to);
    if (!validHex(source) || !validHex(target) || source === target) return;
    set(
      withProject(get(), (project) => ({
        ...project,
        palettes: project.palettes.map((palette, index) =>
          index === 0 ? { ...palette, colors: uniqueColors(palette.colors.map((entry) => (normalizeHex(entry) === source ? target : entry))) } : palette,
        ),
        assets: project.assets.map((asset) => ({
          ...asset,
          layers: asset.layers.map((layer) => ({
            ...layer,
            pixels: layer.pixels.map((pixel) => (normalizeHex(pixel) === source ? target : pixel)),
          })),
          frames: asset.frames.map((frame) => ({
            ...frame,
            cels: Object.fromEntries(
              Object.entries(frame.cels ?? {}).map(([layerId, pixels]) => [layerId, pixels.map((pixel) => (normalizeHex(pixel) === source ? target : pixel))]),
            ),
          })),
        })),
      })),
    );
  },
  remapArtToPalette: (paletteId) => {
    const state = get();
    const palette = state.project?.palettes.find((entry) => entry.id === paletteId) ?? state.project?.palettes[0];
    const colors = uniqueColors(palette?.colors ?? []);
    if (!colors.length) return;
    set(
      withProject(state, (project) => ({
        ...project,
        assets: project.assets.map((asset) => ({
          ...asset,
          layers: asset.layers.map((layer) => ({ ...layer, pixels: remapPixelsToPalette(layer.pixels, colors) })),
          frames: asset.frames.map((frame) => ({
            ...frame,
            cels: Object.fromEntries(Object.entries(frame.cels ?? {}).map(([layerId, pixels]) => [layerId, remapPixelsToPalette(pixels, colors)])),
          })),
        })),
      })),
    );
  },
  addFrame: () =>
    set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => {
      const frame = {
        id: uid("frame"),
        name: `Frame ${asset.frames.length + 1}`,
        durationMs: 160,
        layerIds: asset.layers.map((layer) => layer.id),
        cels: Object.fromEntries(asset.layers.map((layer) => [layer.id, Array.from({ length: asset.width * asset.height }, () => "transparent")])),
      };
      setTimeout(() => set({ activeFrameId: frame.id }), 0);
      return { ...asset, frames: [...asset.frames, frame] };
    }))),
  duplicateFrame: () =>
    set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => {
      const source = asset.frames.find((frame) => frame.id === get().activeFrameId) ?? asset.frames[0];
      const frame = {
        ...source,
        id: uid("frame"),
        name: `Frame ${asset.frames.length + 1}`,
        cels: Object.fromEntries(asset.layers.map((layer) => [layer.id, [...pixelsForLayer(asset, source?.id ?? null, layer)]])),
      };
      setTimeout(() => set({ activeFrameId: frame.id }), 0);
      return { ...asset, frames: [...asset.frames, frame] };
    }))),
  addAssetAsFrame: (sourceAssetId) =>
    set(withProject(get(), (project) => {
      const source = project.assets.find((entry) => entry.id === sourceAssetId);
      if (!source) return project;
      return updateActiveAsset(project, get().activeAssetId, (asset) => {
        const layer = asset.layers[0];
        if (!layer) return asset;
        const framePixels =
          source.width === asset.width && source.height === asset.height
            ? compositeAssetPixels(source, source.frames[0]?.id)
            : resizePixels(compositeAssetPixels(source, source.frames[0]?.id), source.width, source.height, asset.width, asset.height);
        const frame = {
          id: uid("frame"),
          name: source.name,
          durationMs: 160,
          layerIds: asset.layers.map((entry) => entry.id),
          cels: {
            ...Object.fromEntries(asset.layers.map((entry) => [entry.id, Array.from({ length: asset.width * asset.height }, () => "transparent")])),
            [layer.id]: framePixels,
          },
        };
        setTimeout(() => set({ activeFrameId: frame.id }), 0);
        return { ...asset, frames: [...asset.frames, frame] };
      });
    })),
  removeFrame: (id) => set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => {
    if (asset.frames.length <= 1) return asset;
    const frames = asset.frames.filter((frame) => frame.id !== id);
    if (get().activeFrameId === id) setTimeout(() => set({ activeFrameId: frames[0]?.id ?? null }), 0);
    return { ...asset, frames };
  }))),
  moveFrame: (id, direction) =>
    set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => {
      const index = asset.frames.findIndex((frame) => frame.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= asset.frames.length) return asset;
      const frames = [...asset.frames];
      [frames[index], frames[target]] = [frames[target], frames[index]];
      return { ...asset, frames };
    }))),
  setFrameDuration: (id, durationMs) => set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => ({ ...asset, frames: asset.frames.map((frame) => (frame.id === id ? { ...frame, durationMs } : frame)) })))),
  setActiveFrame: (id) => set({ activeFrameId: id }),
  togglePlayback: () => set({ isPlaying: !get().isPlaying }),
  toggleOnionSkin: () => set({ onionSkin: !get().onionSkin }),
  setFps: (fps) => set({ fps }),
  paintSceneTile: (x, y) =>
    set(
      withProject(get(), (project) => ({
        ...project,
        scenes: project.scenes.map((scene) => {
          if (scene.id !== get().activeSceneId) return scene;
          if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return scene;
          const index = y * scene.width + x;
          const activeCells = sceneCells(scene, scene.layers[scene.activeLayer]);
          return { ...scene, layers: { ...scene.layers, [scene.activeLayer]: activeCells.map((value, i) => (i === index && get().activeAssetId ? sceneTileRef(get().activeAssetId!, get()) : value)) } };
        }),
      })),
    ),
  paintSceneBrush: (x, y) =>
    set(
      withProject(get(), (project) => {
        const state = get();
        const sceneBrush = state.sceneBrush;
        let nextProject = project;
        let assetId = state.activeAssetId;
        let shadowAssetId: string | null = null;

        if (sceneBrush !== "asset" && sceneBrush !== "erase") {
          const ensured = ensureTemplateAsset(nextProject, sceneBrush);
          nextProject = ensured.project;
          assetId = ensured.assetId;
        }
        if (brushNeedsShadow(sceneBrush)) {
          const ensuredShadow = ensureTemplateAsset(nextProject, "shadow");
          nextProject = ensuredShadow.project;
          shadowAssetId = ensuredShadow.assetId;
        }

        if (!assetId) return nextProject;

        return {
          ...nextProject,
          scenes: nextProject.scenes.map((scene) => {
            if (scene.id !== state.activeSceneId) return scene;
            if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return scene;
            const index = y * scene.width + x;
            const targetLayer = layerForSceneBrush(sceneBrush, scene.activeLayer);
            const normalizedLayers = {
              ground: sceneCells(scene, scene.layers.ground),
              objects: sceneCells(scene, scene.layers.objects),
              overlay: sceneCells(scene, scene.layers.overlay),
            };
            if (sceneBrush === "erase") {
              return {
                ...scene,
                layers: {
                  ...normalizedLayers,
                  [scene.activeLayer]: normalizedLayers[scene.activeLayer].map((value, i) => (i === index ? null : value)),
                },
              };
            }
            const layers = {
              ...normalizedLayers,
              [targetLayer]: normalizedLayers[targetLayer].map((value, i) => (i === index ? sceneTileRef(assetId, state) : value)),
            };
            if (shadowAssetId) layers.overlay = layers.overlay.map((value, i) => (i === index ? sceneTileRef(shadowAssetId, { sceneFlipX: false, sceneFlipY: false, sceneRotation: 0 }) : value));
            return { ...scene, activeLayer: targetLayer, layers };
          }),
        };
      }),
    ),
  setSceneBrush: (sceneBrush) => set({ sceneBrush }),
  setSceneLayer: (layer) => set(withProject(get(), (project) => ({ ...project, scenes: project.scenes.map((scene) => (scene.id === get().activeSceneId ? { ...scene, activeLayer: layer } : scene)) }))),
  toggleSceneFlipX: () => set({ sceneFlipX: !get().sceneFlipX }),
  toggleSceneFlipY: () => set({ sceneFlipY: !get().sceneFlipY }),
  rotateSceneBrush: () => {
    const next: Record<SceneRotation, SceneRotation> = { 0: 90, 90: 180, 180: 270, 270: 0 };
    set({ sceneRotation: next[get().sceneRotation] });
  },
  importProject: async (project) => {
    disconnectFileSystemProjectFolder();
    await saveProject(project);
    set({
      project,
      projects: await listProjects(),
      activeAssetId: project.assets[0]?.id ?? null,
      activeLayerId: project.assets[0]?.layers[0]?.id ?? null,
      activeFrameId: project.assets[0]?.frames[0]?.id ?? null,
      activeTilesetId: project.tilesets[0]?.id ?? null,
      activeSceneId: project.scenes[0]?.id ?? null,
      history: [],
      future: [],
      movePreview: null,
      saveStatus: "saved",
      lastSavedAt: project.updatedAt,
      saveError: null,
      fileSaveSupported: fileSystemProjectSaveSupported(),
      fileSaveStatus: fileSystemProjectSaveSupported() ? "disconnected" : "unsupported",
      fileSaveFolderName: null,
      fileSaveError: null,
    });
  },
}));

export const projectHealthWarnings = (project: PixelProject) => {
  const warnings: string[] = [];
  if (!project.assets.length) warnings.push("No drawable assets yet.");
  if (!project.tilesets.length) warnings.push("No tileset exists for tile checking.");
  if (!project.scenes.length) warnings.push("No sandbox scene exists for checking art in context.");
  project.assets.forEach((asset) => {
    if (asset.width > 256 || asset.height > 256) warnings.push(`${asset.name} is large for a pixel editor canvas; performance may drop on mobile.`);
    if (asset.frames.length > 1 && asset.frames.some((frame) => frame.layerIds.length !== asset.layers.length)) {
      warnings.push(`${asset.name} has animation frames with different layer coverage.`);
    }
    const expected = asset.width * asset.height;
    asset.layers.forEach((layer) => {
      if (layer.pixels.length !== expected) warnings.push(`${asset.name}/${layer.name} pixel data has the wrong size.`);
    });
    asset.frames.forEach((frame) => {
      Object.entries(frame.cels ?? {}).forEach(([layerId, pixels]) => {
        if (pixels.length !== expected) warnings.push(`${asset.name}/${frame.name}/${layerId} cel data has the wrong size.`);
      });
    });
  });
  return [...new Set(warnings)].slice(0, 12);
};

import { create } from "zustand";
import { createAsset, createLayer, createProject, createTemplateAsset, uid, type TemplateKind } from "../projects/factory";
import { deleteProject, listProjects, loadProject, saveProject } from "../projects/storage/db";
import type { Palette, PixelAsset, PixelLayer, PixelProject, SceneLayer, Selection, ThemePreference, ToolId, Workspace } from "../projects/types";
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
  pastePixels,
  replaceColor,
  resizePixels,
  rotateClip,
  setPixel,
  sprayBrush,
} from "../editor/tools/pixelOps";

type Clip = { width: number; height: number; pixels: string[] };
type SaveStatus = "idle" | "saving" | "saved" | "error";
type SceneBrush = "asset" | "grass" | "path" | "water" | "tree" | "bush" | "flower" | "rock" | "shadow";

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
  tool: ToolId;
  theme: ThemePreference;
  color: string;
  secondaryColor: string;
  brushSize: number;
  brushShape: "square" | "circle";
  mirrorX: boolean;
  mirrorY: boolean;
  zoom: number;
  showGrid: boolean;
  selection: Selection;
  clipboard: Clip | null;
  history: PixelProject[];
  future: PixelProject[];
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  saveError: string | null;
  isPlaying: boolean;
  onionSkin: boolean;
  fps: number;
  strokeStart: { x: number; y: number } | null;
  strokeLast: { x: number; y: number } | null;
  strokeHistoryBase: PixelProject | null;
  refreshProjects: () => Promise<void>;
  createNewProject: (name: string) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  persist: () => Promise<void>;
  setWorkspace: (workspace: Workspace) => void;
  setTool: (tool: ToolId) => void;
  setTheme: (theme: ThemePreference) => void;
  setColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setBrushShape: (shape: "square" | "circle") => void;
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
  deselect: () => void;
  deleteSelection: () => void;
  flipSelectionX: () => void;
  flipSelectionY: () => void;
  rotateSelection: () => void;
  undo: () => void;
  redo: () => void;
  addPaletteColor: (color: string) => void;
  removePaletteColor: (color: string) => void;
  addPaletteShades: (color: string) => void;
  sortPalette: () => void;
  importPaletteText: (text: string) => void;
  addFrame: () => void;
  duplicateFrame: () => void;
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
const mutatingPointerTools: ToolId[] = [...strokeTools, "fill", "line", "rect", "ellipse"];

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
  if (brush === "asset") return activeLayer;
  if (brush === "grass" || brush === "path" || brush === "water") return "ground";
  if (brush === "shadow") return "overlay";
  return "objects";
};

const brushNeedsShadow = (brush: SceneBrush) => brush === "tree" || brush === "bush" || brush === "rock";
const sceneCells = (scene: { width: number; height: number }, cells: (string | null)[]) =>
  Array.from({ length: scene.width * scene.height }, (_, index) => cells[index] ?? null);

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

const shadeColor = (hex: string) => {
  if (!hex.startsWith("#") || hex.length !== 7) return "rgba(0,0,0,0.28)";
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((value >> 16) & 255) - 42);
  const g = Math.max(0, ((value >> 8) & 255) - 42);
  const b = Math.max(0, (value & 255) - 42);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
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
    if (state.tool === "shadow") return drawBrush(next, width, height, point.x, point.y, shadeColor(state.color), state.brushSize, state.brushShape);
    if (state.tool === "lighten" || state.tool === "darken") {
      const existing = next[point.y * width + point.x];
      const adjusted = existing && existing !== "transparent" ? adjustColor(existing, state.tool === "lighten" ? 18 : -18) : existing;
      return adjusted ? drawBrush(next, width, height, point.x, point.y, adjusted, state.brushSize, state.brushShape) : next;
    }
    return drawBrush(next, width, height, point.x, point.y, state.color, state.brushSize, state.brushShape);
  }, pixels);
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
  tool: "pencil",
  theme: (localStorage.getItem("pixel-editor-theme") as ThemePreference | null) ?? "system",
  color: "#1f1f29",
  secondaryColor: "transparent",
  brushSize: 1,
  brushShape: "square",
  mirrorX: false,
  mirrorY: false,
  zoom: 12,
  showGrid: true,
  selection: null,
  clipboard: null,
  history: [],
  future: [],
  saveStatus: "idle",
  lastSavedAt: null,
  saveError: null,
  isPlaying: false,
  onionSkin: true,
  fps: 8,
  strokeStart: null,
  strokeLast: null,
  strokeHistoryBase: null,

  refreshProjects: async () => set({ projects: await listProjects() }),
  createNewProject: async (name) => {
    const project = createProject(name || "New Pixel Project");
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
      saveStatus: "saved",
      lastSavedAt: project.updatedAt,
      saveError: null,
    });
  },
  openProject: async (id) => {
    const project = await loadProject(id);
    if (!project) return;
    set({
      project,
      activeAssetId: project.assets[0]?.id ?? null,
      activeLayerId: project.assets[0]?.layers[0]?.id ?? null,
      activeFrameId: project.assets[0]?.frames[0]?.id ?? null,
      activeTilesetId: project.tilesets[0]?.id ?? null,
      activeSceneId: project.scenes[0]?.id ?? null,
      history: [],
      future: [],
      saveStatus: "saved",
      lastSavedAt: project.updatedAt,
      saveError: null,
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
      set({ projects: await listProjects(), saveStatus: "saved", lastSavedAt: new Date().toISOString(), saveError: null });
    } catch (error) {
      set({ saveStatus: "error", saveError: error instanceof Error ? error.message : "Save failed" });
      throw error;
    }
  },
  setWorkspace: (workspace) => set({ workspace }),
  setTool: (tool) => set({ tool }),
  setTheme: (theme) => {
    localStorage.setItem("pixel-editor-theme", theme);
    set({ theme });
  },
  setColor: (color) => set({ color }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setBrushShape: (brushShape) => set({ brushShape }),
  toggleMirrorX: () => set({ mirrorX: !get().mirrorX }),
  toggleMirrorY: () => set({ mirrorY: !get().mirrorY }),
  setZoom: (zoom) => set({ zoom }),
  toggleGrid: () => set({ showGrid: !get().showGrid }),
  setSelection: (selection) => set({ selection }),
  beginStroke: (x, y) => {
    const state = get();
    set({
      strokeStart: { x, y },
      strokeLast: { x, y },
      strokeHistoryBase: state.project && mutatingPointerTools.includes(state.tool) ? state.project : null,
    });
  },
  applyToolAt: (x, y) => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer || layer.locked) return;
    const color = state.tool === "eraser" ? "transparent" : state.color;
    if (state.tool === "picker") {
      const picked = layer.pixels[y * asset.width + x];
      if (picked && picked !== "transparent") set({ color: picked });
      return;
    }
    if (state.tool === "select") {
      set({ selection: { x, y, width: 1, height: 1 } });
      return;
    }
    if (![...strokeTools, "fill"].includes(state.tool)) return;
    const points = state.strokeLast && strokeTools.includes(state.tool) ? linePoints(state.strokeLast.x, state.strokeLast.y, x, y) : [{ x, y }];
    set({
      ...withProject(state, (project) =>
        updateActiveAsset(project, state.activeAssetId, (entry) => ({
          ...entry,
          layers: entry.layers.map((item) =>
            item.id === layer.id
              ? { ...item, pixels: points.reduce((pixels, point) => paintAt(pixels, entry.width, entry.height, point.x, point.y, state), item.pixels) }
              : item,
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
    if (!asset || !layer || !start) return set({ strokeStart: null, strokeLast: null, strokeHistoryBase: null });
    if (state.tool === "select") {
      const left = Math.min(start.x, x);
      const top = Math.min(start.y, y);
      set({ selection: { x: left, y: top, width: Math.abs(x - start.x) + 1, height: Math.abs(y - start.y) + 1 }, strokeStart: null, strokeLast: null, strokeHistoryBase: null });
      return;
    }
    const drawTools = ["line", "rect", "ellipse"];
    if (!drawTools.includes(state.tool)) return set({ strokeStart: null, strokeLast: null, strokeHistoryBase: null });
    set({
      ...withProject(state, (project) =>
        updateActiveAsset(project, state.activeAssetId, (entry) => ({
          ...entry,
          layers: entry.layers.map((item) => {
            if (item.id !== layer.id) return item;
            const pixels =
              state.tool === "line"
                ? drawLine(item.pixels, entry.width, entry.height, start.x, start.y, x, y, state.color)
                : state.tool === "rect"
                  ? drawRect(item.pixels, entry.width, entry.height, start.x, start.y, x, y, state.color)
                  : drawEllipse(item.pixels, entry.width, entry.height, start.x, start.y, x, y, state.color);
            return { ...item, pixels };
          }),
        })),
      state.strokeHistoryBase),
      strokeStart: null,
      strokeLast: null,
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
        const asset = {
          ...source,
          id: uid("asset"),
          name: `${source.name} Copy`,
          layers: source.layers.map((layer) => ({ ...layer, id: uid("layer"), pixels: [...layer.pixels] })),
          frames: source.frames.map((frame) => ({ ...frame, id: uid("frame") })),
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
          return { ...asset, layers: [...asset.layers, layer] };
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
          return { ...asset, layers };
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
          return { ...asset, layers };
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
          return { ...asset, layers: [...asset.layers, layer] };
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
    set({ clipboard: copySelection(layer, asset.width, state.selection) });
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
          ...entry,
          layers: entry.layers.map((item) => {
            if (item.id !== layer.id) return item;
            const pixels = [...item.pixels];
            for (let yy = 0; yy < state.selection!.height; yy += 1) {
              for (let xx = 0; xx < state.selection!.width; xx += 1) pixels[(state.selection!.y + yy) * entry.width + state.selection!.x + xx] = "transparent";
            }
            return { ...item, pixels };
          }),
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
    set(withProject(state, (project) => updateActiveAsset(project, state.activeAssetId, (entry) => ({ ...entry, layers: entry.layers.map((item) => (item.id === layer.id ? { ...item, pixels: pastePixels(item, entry.width, entry.height, x, y, state.clipboard!) } : item)) }))));
  },
  selectAll: () => {
    const asset = activeAsset(get());
    if (asset) set({ selection: { x: 0, y: 0, width: asset.width, height: asset.height } });
  },
  deselect: () => set({ selection: null }),
  deleteSelection: () => {
    const state = get();
    const asset = activeAsset(state);
    const layer = activeLayer(state);
    if (!asset || !layer || !state.selection) return;
    set(withProject(state, (project) => updateActiveAsset(project, state.activeAssetId, (entry) => ({ ...entry, layers: entry.layers.map((item) => (item.id === layer.id ? { ...item, pixels: clearSelectionPixels(item.pixels, entry.width, state.selection!) } : item)) }))));
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
  sortPalette: () =>
    set(withProject(get(), (project) => ({ ...project, palettes: project.palettes.map((palette, index) => (index === 0 ? { ...palette, colors: [...palette.colors].sort() } : palette)) }))),
  importPaletteText: (text) => {
    const colors = [...text.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((match) => match[0].toLowerCase());
    if (!colors.length) return;
    set(withProject(get(), (project) => ({ ...project, palettes: project.palettes.map((palette, index) => (index === 0 ? { ...palette, colors: [...new Set([...palette.colors, ...colors])] } : palette)) })));
  },
  addFrame: () =>
    set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => ({ ...asset, frames: [...asset.frames, { id: uid("frame"), name: `Frame ${asset.frames.length + 1}`, durationMs: 160, layerIds: asset.layers.map((layer) => layer.id) }] })))),
  duplicateFrame: () =>
    set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => ({ ...asset, frames: [...asset.frames, { ...(asset.frames.find((frame) => frame.id === get().activeFrameId) ?? asset.frames[0]), id: uid("frame"), name: `Frame ${asset.frames.length + 1}` }] })))),
  removeFrame: (id) => set(withProject(get(), (project) => updateActiveAsset(project, get().activeAssetId, (asset) => ({ ...asset, frames: asset.frames.length <= 1 ? asset.frames : asset.frames.filter((frame) => frame.id !== id) })))),
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
          return { ...scene, layers: { ...scene.layers, [scene.activeLayer]: activeCells.map((value, i) => (i === index ? get().activeAssetId : value)) } };
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

        if (sceneBrush !== "asset") {
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
            const layers = {
              ...normalizedLayers,
              [targetLayer]: normalizedLayers[targetLayer].map((value, i) => (i === index ? assetId : value)),
            };
            if (shadowAssetId) layers.overlay = layers.overlay.map((value, i) => (i === index ? shadowAssetId : value));
            return { ...scene, activeLayer: targetLayer, layers };
          }),
        };
      }),
    ),
  setSceneBrush: (sceneBrush) => set({ sceneBrush }),
  setSceneLayer: (layer) => set(withProject(get(), (project) => ({ ...project, scenes: project.scenes.map((scene) => (scene.id === get().activeSceneId ? { ...scene, activeLayer: layer } : scene)) }))),
  importProject: async (project) => {
    await saveProject(project);
    set({
      project,
      projects: await listProjects(),
      activeAssetId: project.assets[0]?.id ?? null,
      activeLayerId: project.assets[0]?.layers[0]?.id ?? null,
      saveStatus: "saved",
      lastSavedAt: project.updatedAt,
      saveError: null,
    });
  },
}));

export const paletteWarnings = (palette: Palette) => {
  const warnings: string[] = [];
  if (palette.colors.length > 32) warnings.push("Large palettes can be harder to keep consistent.");
  if (palette.colors.length < 4) warnings.push("Add a few midtones and highlights for cleaner sprites.");
  return warnings;
};

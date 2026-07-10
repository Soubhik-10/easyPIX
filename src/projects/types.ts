export type Palette = {
  id: string;
  name: string;
  colors: string[];
};

export type PixelFrame = {
  id: string;
  name: string;
  durationMs: number;
  layerIds: string[];
  cels?: Record<string, string[]>;
  tags?: string[];
};

export type PixelLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked?: boolean;
  opacity: number;
  pixels: string[];
};

export type PixelAsset = {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: PixelLayer[];
  frames: PixelFrame[];
  paletteId?: string;
  tags?: string[];
  pivot?: { x: number; y: number };
  collision?: { x: number; y: number; width: number; height: number; kind: "solid" | "trigger" };
  favorite?: boolean;
  preview?: {
    background: "checker" | "solid" | "scene";
    color?: string;
    sceneId?: string;
  };
  effects?: {
    outline?: { enabled: boolean; color: string };
    shadow?: { enabled: boolean; color: string; offsetX: number; offsetY: number };
    tint?: { enabled: boolean; color: string; amount: number };
  };
};

export type Tileset = {
  id: string;
  name: string;
  tileWidth: number;
  tileHeight: number;
  assetIds: string[];
};

export type SceneLayer = "ground" | "objects" | "overlay";

export type SceneTileRef = {
  assetId: string;
  flipX?: boolean;
  flipY?: boolean;
  rotation?: 0 | 90 | 180 | 270;
  scale?: number;
};

export type SceneCell = string | SceneTileRef | null;

export type Scene = {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  activeLayer: SceneLayer;
  layers: Record<SceneLayer, SceneCell[]>;
  layerVisibility?: Record<SceneLayer, boolean>;
  background?: {
    preset: "plain" | "sky" | "sunset" | "night" | "dungeon" | "transparent";
    color: string;
    accent: string;
  };
  environment?: {
    effect: "none" | "rain" | "snow" | "fireflies" | "leaves" | "embers";
    density: number;
    speed: number;
  };
  camera?: {
    visible: boolean;
    width: number;
    height: number;
    x: number;
    y: number;
  };
};

export type PixelProject = {
  id: string;
  name: string;
  version: 1;
  palettes: Palette[];
  assets: PixelAsset[];
  tilesets: Tileset[];
  scenes: Scene[];
  updatedAt: string;
};

export type ToolId =
  | "pencil"
  | "eraser"
  | "fill"
  | "picker"
  | "spray"
  | "dither"
  | "replace"
  | "lighten"
  | "darken"
  | "line"
  | "rect"
  | "ellipse"
  | "move"
  | "select"
  | "magic"
  | "lasso"
  | "shadow";

export type Workspace = "editor" | "studio" | "import" | "palettes" | "animation" | "tileset" | "sandbox" | "help";

export type ThemePreference = "system" | "light" | "dark";

export type Selection = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

export type MovePreview = {
  selection: NonNullable<Selection>;
  dx: number;
  dy: number;
  layerId: string;
} | null;

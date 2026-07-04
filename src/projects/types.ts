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
};

export type Tileset = {
  id: string;
  name: string;
  tileWidth: number;
  tileHeight: number;
  assetIds: string[];
};

export type SceneLayer = "ground" | "objects" | "overlay";

export type Scene = {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  activeLayer: SceneLayer;
  layers: Record<SceneLayer, (string | null)[]>;
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
  | "shadow";

export type Workspace = "editor" | "import" | "palettes" | "animation" | "tileset" | "sandbox" | "help";

export type ThemePreference = "system" | "light" | "dark";

export type Selection = {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

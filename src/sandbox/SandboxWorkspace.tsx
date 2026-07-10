import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CopyPlus,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Flower2,
  Grid2X2,
  Image as ImageIcon,
  Layers3,
  Leaf,
  Mountain,
  PaintBucket,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  TreePine,
  Waves,
  Wind,
} from "lucide-react";
import { useAppStore } from "../app/store";
import { renderAsset, renderScene } from "../editor/canvas/renderers";
import { DEFAULT_PNG_EXPORT_SCALE, downloadBlob } from "../projects/importExport/zip";
import type { PixelAsset, SceneLayer } from "../projects/types";

const sceneBrushes = [
  { id: "erase", label: "Erase", icon: Eraser },
  { id: "grass", label: "Grass", icon: Leaf },
  { id: "path", label: "Path", icon: Mountain },
  { id: "sand", label: "Sand", icon: Mountain },
  { id: "water", label: "Water", icon: Waves },
  { id: "tree", label: "Tree", icon: TreePine },
  { id: "bush", label: "Bush", icon: Leaf },
  { id: "flower", label: "Flower", icon: Flower2 },
  { id: "rock", label: "Rock", icon: Mountain },
  { id: "mushroom", label: "Mushroom", icon: Flower2 },
  { id: "fence", label: "Fence", icon: Grid2X2 },
  { id: "stump", label: "Stump", icon: TreePine },
  { id: "sparkle", label: "Sparkle", icon: Sparkles },
  { id: "shadow", label: "Shadow", icon: Mountain },
] as const;

const sceneSizePresets = [
  { label: "Room", width: 12, height: 8, tileSize: 32 },
  { label: "Screen", width: 16, height: 9, tileSize: 32 },
  { label: "Map", width: 24, height: 16, tileSize: 24 },
  { label: "World", width: 40, height: 28, tileSize: 24 },
] as const;

const backgroundPresets = [
  { id: "plain", label: "Plain" },
  { id: "sky", label: "Day sky" },
  { id: "sunset", label: "Sunset" },
  { id: "night", label: "Night" },
  { id: "dungeon", label: "Dungeon" },
  { id: "transparent", label: "Transparent" },
] as const;

const backgroundPresetColors = {
  plain: { color: "#e8eadb", accent: "#cbd5cb" },
  sky: { color: "#8bd5f7", accent: "#d8f3ff" },
  sunset: { color: "#f59e8b", accent: "#fbd38d" },
  night: { color: "#101a35", accent: "#26355f" },
  dungeon: { color: "#1d2635", accent: "#39475a" },
  transparent: { color: "#000000", accent: "#000000" },
} as const;

const environmentEffects = ["none", "rain", "snow", "fireflies", "leaves", "embers"] as const;

const AssetThumb = ({ asset }: { asset: PixelAsset }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) renderAsset(ref.current, asset, Math.max(1, Math.floor(48 / Math.max(asset.width, asset.height))), { grid: false, frameId: asset.frames[0]?.id });
  }, [asset]);
  return <canvas ref={ref} className="asset-thumb" />;
};

export const SandboxWorkspace = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastCellRef = useRef(-1);
  const project = useAppStore((state) => state.project)!;
  const activeSceneId = useAppStore((state) => state.activeSceneId);
  const scene = project.scenes.find((entry) => entry.id === activeSceneId) ?? project.scenes[0];
  const activeAssetId = useAppStore((state) => state.activeAssetId);
  const sceneBrush = useAppStore((state) => state.sceneBrush);
  const sceneFlipX = useAppStore((state) => state.sceneFlipX);
  const sceneFlipY = useAppStore((state) => state.sceneFlipY);
  const sceneRotation = useAppStore((state) => state.sceneRotation);
  const sceneScale = useAppStore((state) => state.sceneScale);
  const [sceneWidth, setSceneWidth] = useState(scene.width);
  const [sceneHeight, setSceneHeight] = useState(scene.height);
  const [sceneTileSize, setSceneTileSize] = useState(scene.tileSize);
  const [sceneZoom, setSceneZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [assetQuery, setAssetQuery] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);

  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    return [...project.assets]
      .filter((asset) => !query || `${asset.name} ${(asset.tags ?? []).join(" ")}`.toLowerCase().includes(query))
      .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name));
  }, [assetQuery, project.assets]);

  useEffect(() => {
    let animationFrame = 0;
    const draw = (time: number) => {
      if (canvasRef.current) renderScene(canvasRef.current, scene, project.assets, 1, { grid: showGrid, timeMs: time, camera: true });
      const animated = scene.environment?.effect !== "none" || project.assets.some((asset) => asset.frames.length > 1);
      if (animated) animationFrame = window.requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [project.assets, scene, showGrid]);

  useEffect(() => {
    setSceneWidth(scene.width);
    setSceneHeight(scene.height);
    setSceneTileSize(scene.tileSize);
    setClearConfirm(false);
  }, [scene.height, scene.id, scene.tileSize, scene.width]);

  const paint = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * scene.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * scene.height);
    const index = y * scene.width + x;
    if (index === lastCellRef.current) return;
    lastCellRef.current = index;
    useAppStore.getState().paintSceneBrush(x, y);
  };

  const exportScenePng = () => {
    const canvas = document.createElement("canvas");
    renderScene(canvas, scene, project.assets, DEFAULT_PNG_EXPORT_SCALE, { grid: false, camera: false, timeMs: performance.now() });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${scene.name.replace(/\s+/g, "-").toLowerCase()}-${DEFAULT_PNG_EXPORT_SCALE}x.png`);
    }, "image/png");
  };

  const exportCameraPng = () => {
    const camera = scene.camera ?? { visible: false, width: 16, height: 9, x: 0, y: 0 };
    const source = document.createElement("canvas");
    renderScene(source, scene, project.assets, 1, { grid: false, camera: false, timeMs: performance.now() });
    const width = Math.min(camera.width, scene.width - camera.x) * scene.tileSize;
    const height = Math.min(camera.height, scene.height - camera.y) * scene.tileSize;
    const output = document.createElement("canvas");
    output.width = width * DEFAULT_PNG_EXPORT_SCALE;
    output.height = height * DEFAULT_PNG_EXPORT_SCALE;
    const ctx = output.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, camera.x * scene.tileSize, camera.y * scene.tileSize, width, height, 0, 0, output.width, output.height);
    output.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${scene.name.replace(/\s+/g, "-").toLowerCase()}-camera.png`);
    }, "image/png");
  };

  const exportSceneJson = () => {
    const body = { type: "easyPIX-scene", version: 1, generatedBy: "easyPIX", scene };
    downloadBlob(new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }), `${scene.name.replace(/\s+/g, "-").toLowerCase()}.json`);
  };

  const background = scene.background ?? { preset: "plain" as const, color: "#e8eadb", accent: "#cbd5cb" };
  const environment = scene.environment ?? { effect: "none" as const, density: 35, speed: 50 };
  const camera = scene.camera ?? { visible: false, width: 16, height: 9, x: 2, y: 2 };

  return (
    <section className="workspace sandbox-layout scene-composer">
      <aside className="panel scene-controls">
        <div className="panel-title-row">
          <h2><Layers3 size={17} /> Scenes</h2>
          <span className="status-pill">{project.scenes.length}</span>
        </div>
        <select value={scene.id} onChange={(event) => useAppStore.getState().selectScene(event.target.value)} aria-label="Active scene">
          {project.scenes.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
        </select>
        <input value={scene.name} onChange={(event) => useAppStore.getState().renameActiveScene(event.target.value)} aria-label="Scene name" />
        <div className="button-row scene-management-actions">
          <button onClick={() => useAppStore.getState().createScene()} title="New scene"><Plus size={15} /> New</button>
          <button onClick={() => useAppStore.getState().duplicateActiveScene()} title="Duplicate scene"><CopyPlus size={15} /></button>
          <button onClick={() => useAppStore.getState().removeActiveScene()} disabled={project.scenes.length <= 1} title="Delete scene"><Trash2 size={15} /></button>
        </div>

        <details open>
          <summary>Brushes</summary>
          <div className="scene-brush-grid">
            {sceneBrushes.map((brush) => {
              const Icon = brush.icon;
              return (
                <button key={brush.id} className={sceneBrush === brush.id ? "active scene-brush" : "scene-brush"} onClick={() => useAppStore.getState().setSceneBrush(brush.id)} title={brush.label}>
                  <Icon size={16} />
                  <span>{brush.label}</span>
                </button>
              );
            })}
          </div>
          <button className={sceneBrush === "asset" ? "active asset-row" : "asset-row"} onClick={() => useAppStore.getState().setSceneBrush("asset")}>
            <ImageIcon size={16} /> Current project asset
          </button>
          <div className="button-row">
            <button onClick={() => useAppStore.getState().fillActiveScene()} title="Fill active layer with current brush"><PaintBucket size={15} /> Fill layer</button>
            <button onClick={() => useAppStore.getState().clearActiveScene(scene.activeLayer)}><Eraser size={15} /> Clear layer</button>
          </div>
          {clearConfirm ? (
            <div className="inline-danger-confirm">
              <span>Clear every layer?</span>
              <button className="danger-action" onClick={() => { useAppStore.getState().clearActiveScene("all"); setClearConfirm(false); }}>Clear all</button>
              <button onClick={() => setClearConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button className="danger-quiet" onClick={() => setClearConfirm(true)}><Trash2 size={15} /> Clear entire scene</button>
          )}
        </details>

        <details>
          <summary>Canvas and layers</summary>
          <div className="scene-size-grid">
            <label>Width<input type="number" min={4} max={80} value={sceneWidth} onChange={(event) => setSceneWidth(Number(event.target.value))} /></label>
            <label>Height<input type="number" min={4} max={80} value={sceneHeight} onChange={(event) => setSceneHeight(Number(event.target.value))} /></label>
            <label>Tile<select value={sceneTileSize} onChange={(event) => setSceneTileSize(Number(event.target.value))}>{[16, 24, 32, 48, 64].map((size) => <option key={size} value={size}>{size}px</option>)}</select></label>
          </div>
          <button onClick={() => useAppStore.getState().resizeActiveScene(sceneWidth, sceneHeight, sceneTileSize)}>Apply size</button>
          <div className="scene-preset-row">
            {sceneSizePresets.map((preset) => (
              <button key={preset.label} onClick={() => {
                setSceneWidth(preset.width);
                setSceneHeight(preset.height);
                setSceneTileSize(preset.tileSize);
                useAppStore.getState().resizeActiveScene(preset.width, preset.height, preset.tileSize);
              }}>{preset.label}</button>
            ))}
          </div>
          <div className="scene-layer-list">
            {(["ground", "objects", "overlay"] as SceneLayer[]).map((layer) => {
              const visible = scene.layerVisibility?.[layer] !== false;
              return (
                <div className={scene.activeLayer === layer ? "active scene-layer-row" : "scene-layer-row"} key={layer}>
                  <button onClick={() => useAppStore.getState().setSceneLayer(layer)}>{layer}</button>
                  <button onClick={() => useAppStore.getState().toggleSceneLayerVisibility(layer)} title={`${visible ? "Hide" : "Show"} ${layer}`}>
                    {visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="segmented">
            <button className={sceneFlipX ? "active" : ""} onClick={() => useAppStore.getState().toggleSceneFlipX()} title="Flip tile horizontally"><FlipHorizontal size={16} /></button>
            <button className={sceneFlipY ? "active" : ""} onClick={() => useAppStore.getState().toggleSceneFlipY()} title="Flip tile vertically"><FlipVertical size={16} /></button>
            <button onClick={() => useAppStore.getState().rotateSceneBrush()} title="Rotate tile brush 90 degrees"><RotateCw size={16} /> {sceneRotation} deg</button>
          </div>
          <label>Stamp size<select value={sceneScale} onChange={(event) => useAppStore.getState().setSceneScale(Number(event.target.value))}>{[0.5, 0.75, 1, 1.5, 2, 3, 4].map((value) => <option value={value} key={value}>{value}x</option>)}</select></label>
        </details>

        <details>
          <summary>World look</summary>
          <label>Background<select value={background.preset} onChange={(event) => {
            const preset = event.target.value as typeof background.preset;
            useAppStore.getState().updateSceneBackground({ preset, ...backgroundPresetColors[preset] });
          }}>{backgroundPresets.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}</select></label>
          <div className="color-input-row">
            <label>Base<input type="color" value={background.color} onChange={(event) => useAppStore.getState().updateSceneBackground({ color: event.target.value })} /></label>
            <label>Accent<input type="color" value={background.accent} onChange={(event) => useAppStore.getState().updateSceneBackground({ accent: event.target.value })} /></label>
          </div>
          <label><Wind size={15} /> Environment<select value={environment.effect} onChange={(event) => useAppStore.getState().updateSceneEnvironment({ effect: event.target.value as typeof environment.effect })}>{environmentEffects.map((effect) => <option value={effect} key={effect}>{effect}</option>)}</select></label>
          <label>Density<input type="range" min={5} max={100} value={environment.density} onChange={(event) => useAppStore.getState().updateSceneEnvironment({ density: Number(event.target.value) })} /><span>{environment.density}</span></label>
          <label>Speed<input type="range" min={10} max={100} value={environment.speed} onChange={(event) => useAppStore.getState().updateSceneEnvironment({ speed: Number(event.target.value) })} /><span>{environment.speed}</span></label>
        </details>

        <details>
          <summary>Camera and export</summary>
          <label className="check-row"><input type="checkbox" checked={camera.visible} onChange={(event) => useAppStore.getState().updateSceneCamera({ visible: event.target.checked })} /> Show game camera</label>
          <div className="scene-camera-grid">
            <label>X<input type="number" min={0} max={scene.width - 1} value={camera.x} onChange={(event) => useAppStore.getState().updateSceneCamera({ x: Number(event.target.value) })} /></label>
            <label>Y<input type="number" min={0} max={scene.height - 1} value={camera.y} onChange={(event) => useAppStore.getState().updateSceneCamera({ y: Number(event.target.value) })} /></label>
            <label>W<input type="number" min={1} max={scene.width} value={camera.width} onChange={(event) => useAppStore.getState().updateSceneCamera({ width: Number(event.target.value) })} /></label>
            <label>H<input type="number" min={1} max={scene.height} value={camera.height} onChange={(event) => useAppStore.getState().updateSceneCamera({ height: Number(event.target.value) })} /></label>
          </div>
          <div className="export-actions">
            <button onClick={exportScenePng}><Download size={16} /> Full PNG</button>
            <button onClick={exportCameraPng}><Camera size={16} /> Camera PNG</button>
            <button onClick={exportSceneJson}><Download size={16} /> Scene JSON</button>
          </div>
        </details>
      </aside>

      <div className="sandbox-stage scene-stage">
        <div className="scene-stage-toolbar">
          <strong>{scene.name}</strong>
          <span>{scene.width}x{scene.height} tiles</span>
          <label>Zoom<select value={sceneZoom} onChange={(event) => setSceneZoom(Number(event.target.value))}>{[0.5, 0.75, 1, 1.5, 2].map((zoom) => <option value={zoom} key={zoom}>{Math.round(zoom * 100)}%</option>)}</select></label>
          <button className={showGrid ? "active" : ""} onClick={() => setShowGrid(!showGrid)} title="Toggle grid"><Grid2X2 size={15} /></button>
          {environment.effect !== "none" ? <span className="status-pill status-ok">Live {environment.effect}</span> : null}
        </div>
        <div className="scene-canvas-scroll">
          <canvas
            ref={canvasRef}
            style={{ width: scene.width * scene.tileSize * sceneZoom, height: scene.height * scene.tileSize * sceneZoom }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              lastCellRef.current = -1;
              paint(event);
            }}
            onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && paint(event)}
            onPointerUp={(event) => {
              lastCellRef.current = -1;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={(event) => {
              lastCellRef.current = -1;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onContextMenu={(event) => event.preventDefault()}
          />
        </div>
      </div>

      <aside className="panel scene-asset-panel">
        <div className="panel-title-row"><h2><ImageIcon size={17} /> Project Assets</h2><span>{filteredAssets.length}</span></div>
        <label className="search-field"><Search size={15} /><input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Search art and tags" /></label>
        <div className="scene-asset-list">
          {filteredAssets.map((asset) => (
            <button key={asset.id} className={sceneBrush === "asset" && asset.id === activeAssetId ? "active scene-asset-row" : "scene-asset-row"} onClick={() => { useAppStore.getState().setSceneBrush("asset"); useAppStore.getState().selectAsset(asset.id); }}>
              <AssetThumb asset={asset} />
              <span><strong>{asset.name}</strong><small>{asset.width}x{asset.height}{asset.frames.length > 1 ? ` - ${asset.frames.length} animated frames` : ""}</small></span>
              {asset.favorite ? <Sparkles size={14} /> : null}
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
};

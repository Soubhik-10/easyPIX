import { PointerEvent, useEffect, useRef, useState } from "react";
import { Download, Eraser, FlipHorizontal, FlipVertical, Flower2, Leaf, Mountain, RotateCw, Sparkles, TreePine, Waves } from "lucide-react";
import { useAppStore } from "../app/store";
import { renderScene } from "../editor/canvas/renderers";
import { DEFAULT_PNG_EXPORT_SCALE, downloadBlob } from "../projects/importExport/zip";
import type { SceneLayer } from "../projects/types";

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
  { id: "fence", label: "Fence", icon: Mountain },
  { id: "stump", label: "Stump", icon: TreePine },
  { id: "sparkle", label: "Sparkle", icon: Sparkles },
  { id: "shadow", label: "Shadow", icon: Mountain },
] as const;

const sceneSizePresets = [
  { label: "Tiny", width: 12, height: 8, tileSize: 32 },
  { label: "Cozy", width: 20, height: 14, tileSize: 32 },
  { label: "Wide", width: 32, height: 18, tileSize: 24 },
  { label: "Big", width: 40, height: 28, tileSize: 24 },
] as const;

export const SandboxWorkspace = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const project = useAppStore((state) => state.project)!;
  const scene = project.scenes.find((entry) => entry.id === useAppStore.getState().activeSceneId) ?? project.scenes[0];
  const activeAssetId = useAppStore((state) => state.activeAssetId);
  const sceneBrush = useAppStore((state) => state.sceneBrush);
  const sceneFlipX = useAppStore((state) => state.sceneFlipX);
  const sceneFlipY = useAppStore((state) => state.sceneFlipY);
  const sceneRotation = useAppStore((state) => state.sceneRotation);
  const [sceneWidth, setSceneWidth] = useState(scene.width);
  const [sceneHeight, setSceneHeight] = useState(scene.height);
  const [sceneTileSize, setSceneTileSize] = useState(scene.tileSize);

  useEffect(() => {
    if (canvasRef.current) renderScene(canvasRef.current, scene, project.assets, 2);
  }, [project.assets, scene]);

  useEffect(() => {
    setSceneWidth(scene.width);
    setSceneHeight(scene.height);
    setSceneTileSize(scene.tileSize);
  }, [scene.height, scene.id, scene.tileSize, scene.width]);

  const paint = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (scene.tileSize * 2));
    const y = Math.floor((event.clientY - rect.top) / (scene.tileSize * 2));
    useAppStore.getState().paintSceneBrush(x, y);
  };

  const exportScenePng = () => {
    const canvas = document.createElement("canvas");
    renderScene(canvas, scene, project.assets, DEFAULT_PNG_EXPORT_SCALE, { grid: false });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${scene.name.replace(/\s+/g, "-").toLowerCase()}-${DEFAULT_PNG_EXPORT_SCALE}x.png`);
    }, "image/png");
  };

  const exportSceneJson = () => {
    downloadBlob(new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" }), `${scene.name.replace(/\s+/g, "-").toLowerCase()}.json`);
  };

  return (
    <section className="workspace sandbox-layout">
      <aside className="panel asset-browser">
        <h2>Scene Creator</h2>
        <div className="scene-brush-grid">
          {sceneBrushes.map((brush) => {
            const Icon = brush.icon;
            return (
              <button key={brush.id} className={sceneBrush === brush.id ? "active scene-brush" : "scene-brush"} onClick={() => useAppStore.getState().setSceneBrush(brush.id)}>
                <Icon size={16} />
                {brush.label}
              </button>
            );
          })}
        </div>
        <button className={sceneBrush === "asset" ? "active asset-row" : "asset-row"} onClick={() => useAppStore.getState().setSceneBrush("asset")}>
          Current asset brush
        </button>
        <p className="hint">Ground brushes paint ground. Props paint objects and add simple shadows automatically.</p>
        <h2>Scene Size</h2>
        <div className="scene-size-grid">
          <label>
            Width
            <input type="number" min={4} max={80} value={sceneWidth} onChange={(event) => setSceneWidth(Number(event.target.value))} />
          </label>
          <label>
            Height
            <input type="number" min={4} max={80} value={sceneHeight} onChange={(event) => setSceneHeight(Number(event.target.value))} />
          </label>
          <label>
            Tile
            <select value={sceneTileSize} onChange={(event) => setSceneTileSize(Number(event.target.value))}>
              {[16, 24, 32, 48, 64].map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="scene-preset-row">
          <button onClick={() => useAppStore.getState().resizeActiveScene(sceneWidth, sceneHeight, sceneTileSize)}>Apply</button>
          {sceneSizePresets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setSceneWidth(preset.width);
                setSceneHeight(preset.height);
                setSceneTileSize(preset.tileSize);
                useAppStore.getState().resizeActiveScene(preset.width, preset.height, preset.tileSize);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <h2>Tile Transform</h2>
        <div className="segmented">
          <button className={sceneFlipX ? "active" : ""} onClick={() => useAppStore.getState().toggleSceneFlipX()} title="Flip tile horizontally">
            <FlipHorizontal size={16} /> X
          </button>
          <button className={sceneFlipY ? "active" : ""} onClick={() => useAppStore.getState().toggleSceneFlipY()} title="Flip tile vertically">
            <FlipVertical size={16} /> Y
          </button>
          <button onClick={() => useAppStore.getState().rotateSceneBrush()} title="Rotate tile brush 90 degrees">
            <RotateCw size={16} /> {sceneRotation}°
          </button>
        </div>
        <p className="hint">New tilemap cells store asset id, flip, and rotation in scene JSON.</p>

        <h2>Layers</h2>
        <div className="segmented">
          {(["ground", "objects", "overlay"] as SceneLayer[]).map((layer) => (
            <button key={layer} className={scene.activeLayer === layer ? "active" : ""} onClick={() => useAppStore.getState().setSceneLayer(layer)}>
              {layer}
            </button>
          ))}
        </div>

        <div className="export-actions">
          <button onClick={exportScenePng}>
            <Download size={16} /> Scene PNG
          </button>
          <button onClick={exportSceneJson}>
            <Download size={16} /> Scene JSON
          </button>
        </div>

        <h2>Project Assets</h2>
        {project.assets.map((asset) => (
          <button key={asset.id} className={sceneBrush === "asset" && asset.id === activeAssetId ? "active asset-row" : "asset-row"} onClick={() => { useAppStore.getState().setSceneBrush("asset"); useAppStore.getState().selectAsset(asset.id); }}>
            {asset.name}
          </button>
        ))}
      </aside>
      <div className="sandbox-stage">
        <canvas
          ref={canvasRef}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            paint(event);
          }}
          onPointerMove={(event) => event.buttons === 1 && paint(event)}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
    </section>
  );
};

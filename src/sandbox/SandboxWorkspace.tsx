import { MouseEvent, useEffect, useRef } from "react";
import { useAppStore } from "../app/store";
import { renderScene } from "../editor/canvas/renderers";
import type { SceneLayer } from "../projects/types";

export const SandboxWorkspace = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const project = useAppStore((state) => state.project)!;
  const scene = project.scenes.find((entry) => entry.id === useAppStore.getState().activeSceneId) ?? project.scenes[0];
  const activeAssetId = useAppStore((state) => state.activeAssetId);

  useEffect(() => {
    if (canvasRef.current) renderScene(canvasRef.current, scene, project.assets, 2);
  }, [project.assets, scene]);

  const paint = (event: MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / (scene.tileSize * 2));
    const y = Math.floor((event.clientY - rect.top) / (scene.tileSize * 2));
    useAppStore.getState().paintSceneTile(x, y);
  };

  return (
    <section className="workspace sandbox-layout">
      <aside className="panel asset-browser">
        <h2>Scene</h2>
        <div className="segmented">
          {(["ground", "objects", "overlay"] as SceneLayer[]).map((layer) => (
            <button key={layer} className={scene.activeLayer === layer ? "active" : ""} onClick={() => useAppStore.getState().setSceneLayer(layer)}>
              {layer}
            </button>
          ))}
        </div>
        <h2>Brush Asset</h2>
        {project.assets.map((asset) => (
          <button key={asset.id} className={asset.id === activeAssetId ? "active asset-row" : "asset-row"} onClick={() => useAppStore.getState().selectAsset(asset.id)}>
            {asset.name}
          </button>
        ))}
      </aside>
      <div className="sandbox-stage">
        <canvas ref={canvasRef} onMouseDown={paint} onMouseMove={(event) => event.buttons === 1 && paint(event)} />
      </div>
    </section>
  );
};

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../app/store";
import { drawPixelLayer, renderAsset } from "../editor/canvas/renderers";
import { downloadBlob } from "../projects/importExport/zip";

const rangeStyle = (value: number, min: number, max: number) =>
  ({ "--range-progress": `${Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}%` }) as CSSProperties;

export const AnimationWorkspace = () => {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const project = useAppStore((state) => state.project)!;
  const asset = project.assets.find((entry) => entry.id === useAppStore.getState().activeAssetId) ?? project.assets[0];
  const activeFrameId = useAppStore((state) => state.activeFrameId);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const onionSkin = useAppStore((state) => state.onionSkin);
  const fps = useAppStore((state) => state.fps);
  const [frameIndex, setFrameIndex] = useState(Math.max(0, asset.frames.findIndex((frame) => frame.id === activeFrameId)));

  const exportSpritesheet = () => {
    const canvas = document.createElement("canvas");
    canvas.width = asset.width * asset.frames.length;
    canvas.height = asset.height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    asset.frames.forEach((frame, index) => {
      ctx.save();
      ctx.translate(index * asset.width, 0);
      asset.layers.filter((layer) => frame.layerIds.includes(layer.id)).forEach((layer) => drawPixelLayer(ctx, layer, asset.width, asset.height, 1));
      ctx.restore();
    });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${asset.name}-spritesheet.png`);
    }, "image/png");
  };

  useEffect(() => {
    if (!isPlaying) return;
    const handle = window.setInterval(() => setFrameIndex((current) => (current + 1) % asset.frames.length), 1000 / fps);
    return () => window.clearInterval(handle);
  }, [asset.frames.length, fps, isPlaying]);

  useEffect(() => {
    const frame = asset.frames[frameIndex] ?? asset.frames[0];
    if (previewRef.current) renderAsset(previewRef.current, asset, 10, { grid: false, activeLayerIds: frame.layerIds });
  }, [asset, frameIndex]);

  return (
    <section className="workspace animation-layout">
      <aside className="panel animation-controls">
        <h2>Animation</h2>
        <button onClick={() => useAppStore.getState().togglePlayback()}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? "Pause" : "Play"}
        </button>
        <label>
          FPS
          <input className="range-fill" style={rangeStyle(fps, 1, 24)} type="range" min="1" max="24" value={fps} onChange={(event) => useAppStore.getState().setFps(Number(event.target.value))} />
          <span>{fps}</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={onionSkin} onChange={() => useAppStore.getState().toggleOnionSkin()} />
          Onion skin
        </label>
        <button onClick={() => useAppStore.getState().addFrame()}>
          <Plus size={16} /> Add frame
        </button>
        <button onClick={() => useAppStore.getState().duplicateFrame()}>Duplicate frame</button>
        <button onClick={exportSpritesheet}>
          <Download size={16} /> Spritesheet
        </button>
      </aside>
      <div className="animation-preview">
        <canvas ref={previewRef} className="pixel-canvas" />
        {onionSkin && <p className="hint">Onion skin is enabled for workflow state; multi-frame overlay can be extended from this base.</p>}
      </div>
      <footer className="timeline">
        {asset.frames.map((frame, index) => (
          <button
            key={frame.id}
            className={index === frameIndex ? "active frame-cell" : "frame-cell"}
            onClick={() => {
              setFrameIndex(index);
              useAppStore.getState().setActiveFrame(frame.id);
            }}
          >
            <span>{frame.name}</span>
            <label className="frame-duration" onClick={(event) => event.stopPropagation()} title="Frame duration in milliseconds">
              <input type="number" min="40" value={frame.durationMs} onChange={(event) => useAppStore.getState().setFrameDuration(frame.id, Number(event.target.value))} />
              <span>ms</span>
            </label>
            <ArrowLeft size={14} onClick={(event) => { event.stopPropagation(); useAppStore.getState().moveFrame(frame.id, -1); }} />
            <ArrowRight size={14} onClick={(event) => { event.stopPropagation(); useAppStore.getState().moveFrame(frame.id, 1); }} />
            <Trash2 size={14} onClick={(event) => { event.stopPropagation(); useAppStore.getState().removeFrame(frame.id); }} />
          </button>
        ))}
      </footer>
    </section>
  );
};

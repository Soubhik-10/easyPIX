import { type CSSProperties, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CopyPlus, Download, Edit3, ExternalLink, FileJson, ImagePlus, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../app/store";
import { drawPixelLayer, layersForFrame, renderAsset } from "../editor/canvas/renderers";
import { downloadBlob, exportAnimationJson, exportAssetFramePng } from "../projects/importExport/zip";
import type { PixelAsset } from "../projects/types";

const rangeStyle = (value: number, min: number, max: number) =>
  ({ "--range-progress": `${Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}%` }) as CSSProperties;

const FrameThumb = ({ asset, frameId, active }: { asset: PixelAsset; frameId: string; active: boolean }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) renderAsset(ref.current, asset, 2, { grid: false, frameId });
  }, [asset, frameId]);
  return <canvas ref={ref} className={active ? "active frame-thumb" : "frame-thumb"} />;
};

const AssetThumb = ({ asset }: { asset: PixelAsset }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) renderAsset(ref.current, asset, Math.max(1, Math.floor(48 / Math.max(asset.width, asset.height))), { grid: false, frameId: asset.frames[0]?.id });
  }, [asset]);
  return <canvas ref={ref} className="asset-thumb" />;
};

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
      layersForFrame(asset, frame.id, frame.layerIds).forEach((layer) => drawPixelLayer(ctx, layer, asset.width, asset.height, 1));
      ctx.restore();
    });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${asset.name}-spritesheet.png`);
    }, "image/png");
  };

  const activeFrame = asset.frames.find((frame) => frame.id === activeFrameId) ?? asset.frames[frameIndex] ?? asset.frames[0];
  const sourceAssets = project.assets.filter((entry) => entry.id !== asset.id);
  const drawFrame = (frameId: string) => {
    useAppStore.getState().setActiveFrame(frameId);
    useAppStore.getState().setWorkspace("editor");
  };

  useEffect(() => {
    if (!isPlaying) return;
    const handle = window.setInterval(() => setFrameIndex((current) => (current + 1) % asset.frames.length), 1000 / fps);
    return () => window.clearInterval(handle);
  }, [asset.frames.length, fps, isPlaying]);

  useEffect(() => {
    const index = asset.frames.findIndex((frame) => frame.id === activeFrameId);
    if (index >= 0) setFrameIndex(index);
  }, [activeFrameId, asset.frames]);

  useEffect(() => {
    const frame = asset.frames[frameIndex] ?? asset.frames[0];
    if (previewRef.current) renderAsset(previewRef.current, asset, 10, { grid: false, activeLayerIds: frame.layerIds, frameId: frame.id });
  }, [asset, frameIndex]);

  return (
    <section className="workspace animation-layout professional-animation">
      <aside className="panel animation-controls">
        <h2>Animation</h2>
        <label>
          Animation asset
          <select value={asset.id} onChange={(event) => useAppStore.getState().selectAsset(event.target.value)}>
            {project.assets.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
        </label>
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
        <button onClick={() => useAppStore.getState().duplicateFrame()}><CopyPlus size={16} /> Duplicate frame</button>
        {activeFrame ? (
          <button onClick={() => drawFrame(activeFrame.id)}>
            <Edit3 size={16} /> Draw selected frame
          </button>
        ) : null}
        {activeFrame ? (
          <button onClick={() => downloadBlob(exportAssetFramePng(asset, activeFrame.id, 1), `${asset.name}-${activeFrame.name}.png`)}>
            <Download size={16} /> Active frame PNG
          </button>
        ) : null}
        <button onClick={exportSpritesheet}>
          <Download size={16} /> Spritesheet
        </button>
        <button onClick={() => downloadBlob(exportAnimationJson(asset), `${asset.name}-animation.json`)}>
          <FileJson size={16} /> Animation JSON
        </button>
        <button onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}>
          <ExternalLink size={16} /> Open clone tab
        </button>
        <p className="hint">Draw each frame in the normal Draw workspace, then return here for timing, preview, spritesheets, and engine JSON.</p>
      </aside>
      <aside className="panel frame-source-panel">
        <h2><ImagePlus size={16} /> Add Project Art As Frames</h2>
        <p className="hint">Made 6 drawings already? Add each one here and easyPIX converts it into animation frames on the selected asset.</p>
        <div className="frame-source-list">
          {sourceAssets.length ? sourceAssets.map((entry) => (
            <button key={entry.id} className="frame-source-row" onClick={() => useAppStore.getState().addAssetAsFrame(entry.id)}>
              <AssetThumb asset={entry} />
              <span>
                <strong>{entry.name}</strong>
                <small>{entry.width}x{entry.height} · {entry.frames.length} frame{entry.frames.length === 1 ? "" : "s"}</small>
              </span>
              <ImagePlus size={16} />
            </button>
          )) : <p className="hint">Import PNGs or create separate frame assets in Draw, then they will appear here.</p>}
        </div>
      </aside>
      <div className="animation-preview">
        <div className="animation-preview-header">
          <div>
            <h1>{asset.name}</h1>
            <p>{asset.frames.length} frames · {asset.width}x{asset.height}px · selected {activeFrame?.name ?? "none"}</p>
          </div>
          {activeFrame ? <button onClick={() => drawFrame(activeFrame.id)}><Edit3 size={16} /> Edit in Draw</button> : null}
        </div>
        <canvas ref={previewRef} className="pixel-canvas" />
        {onionSkin && <p className="hint">Onion skin is tracked for frame drawing; use Draw to edit the selected frame, and the selected frame stays active across workspaces.</p>}
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
            <FrameThumb asset={asset} frameId={frame.id} active={index === frameIndex} />
            <span className="frame-name">{index + 1}. {frame.name}</span>
            <label className="frame-duration" onClick={(event) => event.stopPropagation()} title="Frame duration in milliseconds">
              <input type="number" min="40" value={frame.durationMs} onChange={(event) => useAppStore.getState().setFrameDuration(frame.id, Number(event.target.value))} />
              <span>ms</span>
            </label>
            <Edit3 size={14} onClick={(event) => { event.stopPropagation(); drawFrame(frame.id); }} />
            <ArrowLeft size={14} onClick={(event) => { event.stopPropagation(); useAppStore.getState().moveFrame(frame.id, -1); }} />
            <ArrowRight size={14} onClick={(event) => { event.stopPropagation(); useAppStore.getState().moveFrame(frame.id, 1); }} />
            <Trash2 size={14} onClick={(event) => { event.stopPropagation(); useAppStore.getState().removeFrame(frame.id); }} />
          </button>
        ))}
      </footer>
    </section>
  );
};

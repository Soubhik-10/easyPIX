import { type CSSProperties, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CopyPlus, Download, Edit3, ExternalLink, FileJson, ImagePlus, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../app/store";
import { drawPixelLayer, layersForFrame, renderAsset } from "../editor/canvas/renderers";
import { DEFAULT_PNG_EXPORT_SCALE, downloadBlob, exportAnimationJson, exportAssetFramePng } from "../projects/importExport/zip";
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
  const [playbackMode, setPlaybackMode] = useState<"loop" | "pingpong">("loop");
  const [videoStatus, setVideoStatus] = useState<"idle" | "exporting" | "ready" | "error">("idle");
  const [videoMessage, setVideoMessage] = useState("");

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

  const drawFrameToCanvas = (canvas: HTMLCanvasElement, frameId: string, scale: number) => {
    canvas.width = asset.width * scale;
    canvas.height = asset.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    const frame = asset.frames.find((entry) => entry.id === frameId) ?? asset.frames[0];
    layersForFrame(asset, frame?.id, frame?.layerIds).forEach((layer) => drawPixelLayer(ctx, layer, asset.width, asset.height, 1));
    ctx.restore();
  };

  const exportVideo = async () => {
    if (!("MediaRecorder" in window)) {
      setVideoStatus("error");
      setVideoMessage("Video export is not supported in this browser.");
      return;
    }
    setVideoStatus("exporting");
    setVideoMessage("Rendering animation video...");
    const mimeType = [
      "video/mp4;codecs=avc1.42E01E",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      setVideoStatus("error");
      setVideoMessage("No browser video encoder was found.");
      return;
    }
    const extension = mimeType.includes("mp4") ? "mp4" : "webm";
    const canvas = document.createElement("canvas");
    const scale = Math.max(1, Math.min(8, Math.floor(512 / Math.max(asset.width, asset.height))));
    drawFrameToCanvas(canvas, asset.frames[0]?.id, scale);
    const stream = canvas.captureStream(Math.max(1, Math.min(60, fps)));
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("Video encoding failed"));
    });
    try {
      recorder.start();
      const videoFrames = playbackMode === "pingpong" && asset.frames.length > 2 ? [...asset.frames, ...asset.frames.slice(1, -1).reverse()] : asset.frames;
      for (const frame of videoFrames) {
        drawFrameToCanvas(canvas, frame.id, scale);
        await new Promise((resolve) => window.setTimeout(resolve, Math.max(40, frame.durationMs)));
      }
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      downloadBlob(new Blob(chunks, { type: mimeType }), `${asset.name}-animation.${extension}`);
      setVideoStatus("ready");
      setVideoMessage(extension === "mp4" ? "MP4 downloaded." : "MP4 is not supported here, downloaded WebM instead.");
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      setVideoStatus("error");
      setVideoMessage(error instanceof Error ? error.message : "Video export failed");
    }
  };

  const activeFrame = asset.frames.find((frame) => frame.id === activeFrameId) ?? asset.frames[frameIndex] ?? asset.frames[0];
  const sourceAssets = project.assets.filter((entry) => entry.id !== asset.id);
  const playbackOrder = playbackMode === "pingpong" && asset.frames.length > 2
    ? [...asset.frames.map((_, index) => index), ...asset.frames.slice(1, -1).map((_, index) => asset.frames.length - 2 - index)]
    : asset.frames.map((_, index) => index);
  const drawFrame = (frameId: string) => {
    useAppStore.getState().setActiveFrame(frameId);
    useAppStore.getState().setWorkspace("editor");
  };
  const addAllProjectArtAsFrames = () => {
    sourceAssets.forEach((entry) => useAppStore.getState().addAssetAsFrame(entry.id));
  };
  const setAllFrameDurations = (durationMs: number) => {
    asset.frames.forEach((frame) => useAppStore.getState().setFrameDuration(frame.id, durationMs));
  };

  useEffect(() => {
    if (!isPlaying) return;
    const handle = window.setInterval(() => setFrameIndex((current) => {
      const orderIndex = playbackOrder.indexOf(current);
      return playbackOrder[(orderIndex + 1) % playbackOrder.length] ?? 0;
    }), 1000 / fps);
    return () => window.clearInterval(handle);
  }, [fps, isPlaying, playbackOrder]);

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
        <div className="animation-preset-row" aria-label="Animation timing presets">
          <button onClick={() => setAllFrameDurations(80)}>Fast</button>
          <button onClick={() => setAllFrameDurations(140)}>Normal</button>
          <button onClick={() => setAllFrameDurations(220)}>Slow</button>
          <button className={playbackMode === "pingpong" ? "active" : ""} onClick={() => setPlaybackMode(playbackMode === "loop" ? "pingpong" : "loop")}>
            {playbackMode === "loop" ? "Loop" : "Ping-pong"}
          </button>
        </div>
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
          <button onClick={() => downloadBlob(exportAssetFramePng(asset, activeFrame.id, DEFAULT_PNG_EXPORT_SCALE), `${asset.name}-${activeFrame.name}-${DEFAULT_PNG_EXPORT_SCALE}x.png`)}>
            <Download size={16} /> Active frame {DEFAULT_PNG_EXPORT_SCALE}x PNG
          </button>
        ) : null}
        <button onClick={exportSpritesheet}>
          <Download size={16} /> Spritesheet
        </button>
        <button onClick={() => void exportVideo()} disabled={videoStatus === "exporting"}>
          <Download size={16} /> {videoStatus === "exporting" ? "Rendering video" : "MP4 video"}
        </button>
        <button onClick={() => downloadBlob(exportAnimationJson(asset), `${asset.name}-animation.json`)}>
          <FileJson size={16} /> Animation JSON
        </button>
        <button onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}>
          <ExternalLink size={16} /> Open clone tab
        </button>
        <p className="hint">Draw each frame in the normal Draw workspace, then return here for timing, preview, spritesheets, and engine JSON.</p>
        {videoMessage ? <p className={videoStatus === "error" ? "hint status-error-text" : "hint"}>{videoMessage}</p> : null}
      </aside>
      <aside className="panel frame-source-panel">
        <h2><ImagePlus size={16} /> Add Project Art As Frames</h2>
        <p className="hint">Add any drawing here and easyPIX converts it into an animation frame on the selected asset.</p>
        <button onClick={addAllProjectArtAsFrames} disabled={!sourceAssets.length}>
          <ImagePlus size={16} /> Add all project art
        </button>
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
            <span className="frame-thumb-wrap"><FrameThumb asset={asset} frameId={frame.id} active={index === frameIndex} /></span>
            <span className="frame-name">{index + 1}. {frame.name}</span>
            <label className="frame-duration" onClick={(event) => event.stopPropagation()} title="Frame duration in milliseconds">
              <input type="number" min="40" value={frame.durationMs} onChange={(event) => useAppStore.getState().setFrameDuration(frame.id, Number(event.target.value))} />
              <span>ms</span>
            </label>
            <input
              className="frame-tag-input"
              value={(frame.tags ?? []).join(", ")}
              placeholder="idle, walk"
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => useAppStore.getState().setFrameTags(frame.id, event.target.value.split(","))}
              title="Comma-separated frame tags"
            />
            <span className="frame-actions">
              <span role="button" tabIndex={0} title="Edit frame" onClick={(event) => { event.stopPropagation(); drawFrame(frame.id); }}><Edit3 size={14} /></span>
              <span role="button" tabIndex={0} title="Move frame left" onClick={(event) => { event.stopPropagation(); useAppStore.getState().moveFrame(frame.id, -1); }}><ArrowLeft size={14} /></span>
              <span role="button" tabIndex={0} title="Move frame right" onClick={(event) => { event.stopPropagation(); useAppStore.getState().moveFrame(frame.id, 1); }}><ArrowRight size={14} /></span>
              <span role="button" tabIndex={0} title="Delete frame" onClick={(event) => { event.stopPropagation(); useAppStore.getState().removeFrame(frame.id); }}><Trash2 size={14} /></span>
            </span>
          </button>
        ))}
      </footer>
    </section>
  );
};

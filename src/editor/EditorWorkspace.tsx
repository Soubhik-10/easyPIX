import { ChangeEvent, PointerEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Brush,
  Circle,
  Copy,
  CopyPlus,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Flower2,
  FileJson,
  FlipHorizontal,
  FlipVertical,
  Grid2X2,
  Layers,
  Lock,
  Maximize,
  Move,
  MousePointer2,
  PaintBucket,
  Palette as PaletteIcon,
  PanelBottom,
  PenLine,
  Pipette,
  Search,
  RotateCw,
  Scissors,
  Square,
  Trash2,
  Unlock,
  Upload,
  WandSparkles,
} from "lucide-react";
import { useAppStore, paletteWarnings } from "../app/store";
import { renderAsset } from "./canvas/renderers";
import { downloadBlob, exportAssetPng } from "../projects/importExport/zip";
import { importPixelFiles } from "../projects/importExport/importers";
import { palettePresets, palettePresetById } from "../palettes/presets";
import type { TemplateKind } from "../projects/factory";
import type { ToolId } from "../projects/types";
import type { CozyBrushKind, PixelEffect, StampKind } from "./tools/pixelOps";

const tools: { id: ToolId; label: string; icon: typeof Brush }[] = [
  { id: "pencil", label: "Pencil", icon: Brush },
  { id: "eraser", label: "Eraser", icon: Eraser },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "picker", label: "Picker", icon: Pipette },
  { id: "spray", label: "Spray", icon: Brush },
  { id: "dither", label: "Dither", icon: Grid2X2 },
  { id: "magicInk", label: "Magic Ink", icon: WandSparkles },
  { id: "stamp", label: "Stamp", icon: Flower2 },
  { id: "cozy", label: "Cozy Brush", icon: Flower2 },
  { id: "ramp", label: "Ramp Brush", icon: PaletteIcon },
  { id: "replace", label: "Replace color", icon: PaintBucket },
  { id: "lighten", label: "Lighten", icon: PaletteIcon },
  { id: "darken", label: "Darken", icon: PaletteIcon },
  { id: "line", label: "Line", icon: PenLine },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "select", label: "Selection", icon: MousePointer2 },
  { id: "move", label: "Move", icon: Move },
  { id: "magic", label: "Magic wand", icon: WandSparkles },
  { id: "lasso", label: "Lasso", icon: MousePointer2 },
];

const rangeStyle = (value: number, min: number, max: number) =>
  ({ "--range-progress": `${Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))}%` }) as CSSProperties;

const playfulTemplates: TemplateKind[] = ["grass", "flower", "water", "path", "tree", "bush", "rock", "coin", "hero"];
const stamps: { id: StampKind; label: string }[] = [
  { id: "heart", label: "Heart" },
  { id: "star", label: "Star" },
  { id: "leaf", label: "Leaf" },
  { id: "flower", label: "Flower" },
  { id: "sparkle", label: "Sparkle" },
  { id: "rock", label: "Rock" },
  { id: "mushroom", label: "Mushroom" },
  { id: "fence", label: "Fence" },
  { id: "window", label: "Window" },
  { id: "door", label: "Door" },
  { id: "bottle", label: "Bottle" },
  { id: "lamp", label: "Lamp" },
  { id: "book", label: "Book" },
  { id: "chair", label: "Chair" },
  { id: "sign", label: "Sign" },
];
const cozyBrushes: { id: CozyBrushKind; label: string }[] = [
  { id: "grass", label: "Grass" },
  { id: "flower", label: "Flowers" },
  { id: "dirt", label: "Dirt" },
  { id: "water", label: "Water shine" },
  { id: "stars", label: "Stars" },
  { id: "fireflies", label: "Fireflies" },
  { id: "snow", label: "Snow" },
  { id: "rain", label: "Rain" },
];
const drawingEffects: { id: PixelEffect; label: string }[] = [
  { id: "readable", label: "Make readable" },
  { id: "contrast", label: "Add contrast" },
  { id: "outline", label: "Add outline" },
  { id: "shadow", label: "Drop shadow" },
  { id: "highlight", label: "Add highlight" },
  { id: "cozy", label: "Make cozy" },
  { id: "clean", label: "Clean pixels" },
  { id: "reduceColors", label: "Reduce colors" },
];

export const EditorWorkspace = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pendingTouch = useRef<{ id: number; x: number; y: number; point: { x: number; y: number }; tool: ToolId; timer: number } | null>(null);
  const pinchState = useRef<{ distance: number; zoom: number; scrollLeft: number; scrollTop: number; centerX: number; centerY: number } | null>(null);
  const project = useAppStore((state) => state.project)!;
  const activeAssetId = useAppStore((state) => state.activeAssetId);
  const activeLayerId = useAppStore((state) => state.activeLayerId);
  const tool = useAppStore((state) => state.tool);
  const color = useAppStore((state) => state.color);
  const zoom = useAppStore((state) => state.zoom);
  const brushSize = useAppStore((state) => state.brushSize);
  const brushShape = useAppStore((state) => state.brushShape);
  const stampKind = useAppStore((state) => state.stampKind);
  const cozyBrushKind = useAppStore((state) => state.cozyBrushKind);
  const pixelPerfect = useAppStore((state) => state.pixelPerfect);
  const brushStabilizer = useAppStore((state) => state.brushStabilizer);
  const mirrorX = useAppStore((state) => state.mirrorX);
  const mirrorY = useAppStore((state) => state.mirrorY);
  const showGrid = useAppStore((state) => state.showGrid);
  const selection = useAppStore((state) => state.selection);
  const clipboard = useAppStore((state) => state.clipboard);
  const activeFrameId = useAppStore((state) => state.activeFrameId);
  const [customColor, setCustomColor] = useState(color);
  const [assetName, setAssetName] = useState("New Asset");
  const [assetWidth, setAssetWidth] = useState(64);
  const [assetHeight, setAssetHeight] = useState(64);
  const [exportScale, setExportScale] = useState(1);
  const [paletteText, setPaletteText] = useState("");
  const [palettePresetId, setPalettePresetId] = useState(palettePresets[0]?.id ?? "");
  const [rampColor, setRampColor] = useState(color);
  const [swapFrom, setSwapFrom] = useState(color);
  const [swapTo, setSwapTo] = useState(customColor);
  const [paletteExportText, setPaletteExportText] = useState("");
  const [mobileMode, setMobileMode] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [precisionMode, setPrecisionMode] = useState(true);
  const [panMode, setPanMode] = useState(false);
  const [mobileNudgeLarge, setMobileNudgeLarge] = useState(false);
  const [precisionCursor, setPrecisionCursor] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const asset = project.assets.find((entry) => entry.id === activeAssetId) ?? project.assets[0];
  const palette = project.palettes.find((entry) => entry.id === asset.paletteId) ?? project.palettes[0];
  const activeLayer = asset.layers.find((layer) => layer.id === activeLayerId) ?? asset.layers[0];
  const selectedPreset = palettePresetById(palettePresetId) ?? palettePresets[0];
  const warnings = useMemo(() => (palette ? paletteWarnings(palette) : []), [palette]);

  useEffect(() => {
    if (canvasRef.current && asset) renderAsset(canvasRef.current, asset, zoom, { grid: showGrid, selection, frameId: activeFrameId });
  }, [asset, zoom, showGrid, selection, activeFrameId]);

  const pixelFromEvent = (event: PointerEvent<HTMLCanvasElement>, options: { precision?: boolean } = {}) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clientY = options.precision && event.pointerType === "touch" ? event.clientY - 44 : event.clientY;
    return {
      x: Math.floor((event.clientX - rect.left) / zoom),
      y: Math.floor((clientY - rect.top) / zoom),
    };
  };

  const precisionCursorFromEvent = (event: PointerEvent<HTMLCanvasElement>, point: { x: number; y: number }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: point.x,
      y: point.y,
      px: rect.left + point.x * zoom + zoom / 2,
      py: rect.top + point.y * zoom + zoom / 2,
    };
  };

  const startStroke = (point: { x: number; y: number }) => {
    useAppStore.getState().beginStroke(point.x, point.y);
    useAppStore.getState().applyToolAt(point.x, point.y);
  };

  const cancelPendingTouch = () => {
    if (!pendingTouch.current) return;
    window.clearTimeout(pendingTouch.current.timer);
    pendingTouch.current = null;
  };

  const pointerDistance = () => {
    const points = [...activePointers.current.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const pointerCenter = () => {
    const points = [...activePointers.current.values()];
    if (points.length < 2) return { x: 0, y: 0 };
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  };

  const nudgeAmount = mobileNudgeLarge ? 8 : 1;

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerType === "touch" && activePointers.current.size >= 2) {
      cancelPendingTouch();
      pinchState.current = {
        distance: pointerDistance(),
        zoom,
        scrollLeft: canvasScrollRef.current?.scrollLeft ?? 0,
        scrollTop: canvasScrollRef.current?.scrollTop ?? 0,
        centerX: pointerCenter().x,
        centerY: pointerCenter().y,
      };
      return;
    }
    if (panMode && event.pointerType === "touch") return;
    const point = pixelFromEvent(event, { precision: mobileMode && precisionMode });
    if (event.pointerType === "touch") setPrecisionCursor(precisionCursorFromEvent(event, point));
    if (event.pointerType === "touch" && mobileMode) {
      const toolAtStart = tool;
      pendingTouch.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        point,
        tool: toolAtStart,
        timer: window.setTimeout(() => {
          if (!pendingTouch.current || pendingTouch.current.id !== event.pointerId) return;
          useAppStore.getState().setTool("picker");
          useAppStore.getState().applyToolAt(point.x, point.y);
          useAppStore.getState().setTool(toolAtStart);
          pendingTouch.current = null;
        }, 480),
      };
      return;
    }
    startStroke(point);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const previousPointer = activePointers.current.get(event.pointerId);
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerType === "touch" && activePointers.current.size >= 2 && pinchState.current) {
      const nextDistance = pointerDistance();
      const center = pointerCenter();
      if (nextDistance > 0 && pinchState.current.distance > 0) {
        useAppStore.getState().setZoom(Math.max(4, Math.min(80, Math.round(pinchState.current.zoom * (nextDistance / pinchState.current.distance)))));
      }
      if (canvasScrollRef.current) {
        canvasScrollRef.current.scrollLeft = pinchState.current.scrollLeft - (center.x - pinchState.current.centerX);
        canvasScrollRef.current.scrollTop = pinchState.current.scrollTop - (center.y - pinchState.current.centerY);
      }
      return;
    }
    if (panMode && event.pointerType === "touch" && previousPointer && canvasScrollRef.current) {
      canvasScrollRef.current.scrollLeft -= event.clientX - previousPointer.x;
      canvasScrollRef.current.scrollTop -= event.clientY - previousPointer.y;
      return;
    }
    if (event.buttons !== 1) return;
    const point = pixelFromEvent(event, { precision: mobileMode && precisionMode });
    if (event.pointerType === "touch") setPrecisionCursor(precisionCursorFromEvent(event, point));
    if (pendingTouch.current && pendingTouch.current.id === event.pointerId) {
      const moved = Math.hypot(event.clientX - pendingTouch.current.x, event.clientY - pendingTouch.current.y);
      if (moved < 7) return;
      const start = pendingTouch.current.point;
      cancelPendingTouch();
      startStroke(start);
    }
    if (["pencil", "eraser", "shadow", "spray", "dither", "magicInk", "stamp", "cozy", "ramp", "replace", "lighten", "darken", "lasso"].includes(tool)) useAppStore.getState().applyToolAt(point.x, point.y);
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const pending = pendingTouch.current;
    if (pending && pending.id === event.pointerId) {
      cancelPendingTouch();
      startStroke(pending.point);
    }
    const point = pixelFromEvent(event, { precision: mobileMode && precisionMode });
    useAppStore.getState().endStroke(point.x, point.y);
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) pinchState.current = null;
    if (event.pointerType === "touch") window.setTimeout(() => setPrecisionCursor(null), 280);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onImportAssets = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const assets = await importPixelFiles(files);
    if (assets.length) useAppStore.getState().addImportedAssets(assets);
    event.target.value = "";
  };

  return (
    <section className={mobileMode ? "workspace editor-layout detailed-tools mobile-editor-mode" : "workspace editor-layout detailed-tools"}>
      <aside className="tool-rail" data-label-mode="detailed">
        {tools.map((entry) => {
          const Icon = entry.icon;
          return (
            <button key={entry.id} className={tool === entry.id ? "active icon-button" : "icon-button"} onClick={() => useAppStore.getState().setTool(entry.id)} title={entry.label}>
              <Icon size={18} />
              <span>{entry.label}</span>
            </button>
          );
        })}
        <button className={tool === "shadow" ? "active icon-button" : "icon-button"} onClick={() => useAppStore.getState().setTool("shadow")} title="Shadow helper">
          <Layers size={18} />
          <span>Shadow</span>
        </button>
      </aside>
      <section className="canvas-stage">
        <div className="stage-toolbar">
          <select value={asset.id} onChange={(event) => useAppStore.getState().selectAsset(event.target.value)}>
            {project.assets.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <select value={activeFrameId ?? asset.frames[0]?.id ?? ""} onChange={(event) => useAppStore.getState().setActiveFrame(event.target.value)} title="Animation frame">
            {asset.frames.map((frame, index) => (
              <option key={frame.id} value={frame.id}>
                F{index + 1} {frame.name}
              </option>
            ))}
          </select>
          <label>
            Zoom
            <input className="range-fill" style={rangeStyle(zoom, 4, 80)} type="range" min="4" max="80" value={zoom} onChange={(event) => useAppStore.getState().setZoom(Number(event.target.value))} />
            <span>{zoom}x</span>
          </label>
          <label>
            Brush
            <input className="range-fill" style={rangeStyle(brushSize, 1, 12)} type="range" min="1" max="12" value={brushSize} onChange={(event) => useAppStore.getState().setBrushSize(Number(event.target.value))} />
            <span>{brushSize}px</span>
          </label>
          <select value={brushShape} onChange={(event) => useAppStore.getState().setBrushShape(event.target.value as "square" | "circle")} title="Brush shape">
            <option value="square">Square</option>
            <option value="circle">Circle</option>
          </select>
          <button className={pixelPerfect ? "active" : ""} onClick={() => useAppStore.getState().togglePixelPerfect()} title="Clean single-pixel pencil corners">
            Pixel Perfect
          </button>
          <label>
            Stabilizer
            <input className="range-fill" style={rangeStyle(brushStabilizer, 0, 4)} type="range" min="0" max="4" value={brushStabilizer} onChange={(event) => useAppStore.getState().setBrushStabilizer(Number(event.target.value))} />
            <span>{brushStabilizer}</span>
          </label>
          <button className={mirrorX ? "active" : ""} onClick={() => useAppStore.getState().toggleMirrorX()} title="Mirror horizontally (M)">
            Mirror X
          </button>
          <button className={mirrorY ? "active" : ""} onClick={() => useAppStore.getState().toggleMirrorY()} title="Mirror vertically">
            Mirror Y
          </button>
          <button onClick={() => useAppStore.getState().toggleGrid()}>
            <Grid2X2 size={16} /> Grid
          </button>
          <button onClick={() => useAppStore.getState().copy()}>
            <Copy size={16} /> Copy
          </button>
          <button onClick={() => useAppStore.getState().cut()}>
            <Scissors size={16} /> Cut
          </button>
          <button onClick={() => useAppStore.getState().paste()} disabled={!clipboard}>
            Paste
          </button>
          <button onClick={() => useAppStore.getState().selectAll()}>Select all</button>
          <button onClick={() => useAppStore.getState().selectVisiblePixels()}>Select artwork</button>
          <button onClick={() => useAppStore.getState().deselect()}>Deselect</button>
          <button onClick={() => useAppStore.getState().deleteSelection()} disabled={!selection}>Delete selection</button>
          <button onClick={() => useAppStore.getState().moveSelection(-1, 0)} disabled={!selection} title="Move selection left">
            <ArrowLeft size={16} />
          </button>
          <button onClick={() => useAppStore.getState().moveSelection(1, 0)} disabled={!selection} title="Move selection right">
            <ArrowRight size={16} />
          </button>
          <button onClick={() => useAppStore.getState().moveSelection(0, -1)} disabled={!selection} title="Move selection up">
            <ArrowUp size={16} />
          </button>
          <button onClick={() => useAppStore.getState().moveSelection(0, 1)} disabled={!selection} title="Move selection down">
            <ArrowDown size={16} />
          </button>
          <button onClick={() => useAppStore.getState().clearActiveLayer()} title="Clear active layer on this frame">
            <Trash2 size={16} /> Clear canvas
          </button>
          <button onClick={() => useAppStore.getState().flipSelectionX()} disabled={!clipboard} title="Flip copied pixels horizontally">
            <FlipHorizontal size={16} />
          </button>
          <button onClick={() => useAppStore.getState().flipSelectionY()} disabled={!clipboard} title="Flip copied pixels vertically">
            <FlipVertical size={16} />
          </button>
          <button onClick={() => useAppStore.getState().rotateSelection()} disabled={!clipboard} title="Rotate copied pixels">
            <RotateCw size={16} />
          </button>
        </div>
        <div className="canvas-scroll" ref={canvasScrollRef}>
          <canvas
            ref={canvasRef}
            className="pixel-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(event) => event.preventDefault()}
          />
          {precisionCursor && mobileMode && precisionMode ? (
            <div className="precision-cursor" style={{ left: precisionCursor.px, top: precisionCursor.py }}>
              <span />
              <strong>{precisionCursor.x}, {precisionCursor.y}</strong>
            </div>
          ) : null}
        </div>
        <div className="actual-preview">
          <span>Actual size</span>
          <canvas
            ref={(node) => {
              if (node) renderAsset(node, asset, 1, { grid: false, frameId: activeFrameId });
            }}
          />
        </div>
      </section>
      <aside className="inspector">
        <section className="panel">
          <h2><Maximize size={16} /> Asset</h2>
          <input value={asset.name} onChange={(event) => useAppStore.getState().renameAsset(asset.id, event.target.value)} aria-label="Active asset name" />
          <div className="compact-grid">
            <input type="number" min="1" max="512" value={assetWidth} onChange={(event) => setAssetWidth(Number(event.target.value))} aria-label="New asset width" />
            <input type="number" min="1" max="512" value={assetHeight} onChange={(event) => setAssetHeight(Number(event.target.value))} aria-label="New asset height" />
          </div>
          <input value={assetName} onChange={(event) => setAssetName(event.target.value)} aria-label="New asset name" />
          <div className="button-row">
            <button onClick={() => useAppStore.getState().addAssetWithSize(assetName, assetWidth, assetHeight)}>New</button>
            <button onClick={() => useAppStore.getState().duplicateAsset(asset.id)}><CopyPlus size={15} /> Duplicate</button>
            <button onClick={() => useAppStore.getState().resizeActiveAsset(assetWidth, assetHeight)}>Resize</button>
          </div>
          <div className="button-row">
            <button onClick={() => importRef.current?.click()}>
              <Upload size={15} /> Import
            </button>
            <input ref={importRef} type="file" multiple hidden accept=".png,.piskel,.json,image/png,application/json" onChange={onImportAssets} />
          </div>
          <p className="hint">Imports PNG, Piskel .piskel, and Aseprite JSON with its spritesheet PNG selected together.</p>
          <div className="button-row">
            <select value={exportScale} onChange={(event) => setExportScale(Number(event.target.value))}>
              <option value={1}>1x PNG</option>
              <option value={2}>2x PNG</option>
              <option value={4}>4x PNG</option>
              <option value={8}>8x PNG</option>
            </select>
            <button onClick={() => downloadBlob(exportAssetPng(asset, exportScale), `${asset.name}-${exportScale}x.png`)}>
              <Download size={15} /> PNG
            </button>
          </div>
        </section>
        <section className="panel">
          <h2><WandSparkles size={16} /> Starter Templates</h2>
          <p className="hint">Drop in a tiny base, edit it, then check repeats in Tile Check or paint it in Sandbox.</p>
          <div className="template-grid">
            <button onClick={() => useAppStore.getState().addTemplateAsset("grass")}>Grass</button>
            <button onClick={() => useAppStore.getState().addTemplateAsset("flower")}>Flower</button>
            <button onClick={() => useAppStore.getState().addTemplateAsset("water")}>Water</button>
            <button onClick={() => useAppStore.getState().addTemplateAsset("path")}>Path</button>
            <button onClick={() => useAppStore.getState().addTemplateAsset("coin")}>Coin</button>
            <button onClick={() => useAppStore.getState().addTemplateAsset("hero")}>Tiny Hero</button>
            <button className="template-random" onClick={() => useAppStore.getState().addTemplateAsset(playfulTemplates[Math.floor(Math.random() * playfulTemplates.length)])}>
              Surprise
            </button>
          </div>
        </section>
        <section className="panel">
          <h2><Flower2 size={16} /> Fun Drawing Helpers</h2>
          <p className="hint">Stamps and cozy brushes are deterministic little pixel helpers, not AI. Pick one, then draw on the canvas.</p>
          <label className="compact-label">
            Shape stamp
            <select value={stampKind} onChange={(event) => { useAppStore.getState().setStampKind(event.target.value as StampKind); useAppStore.getState().setTool("stamp"); }}>
              {stamps.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          <div className="stamp-grid">
            {stamps.slice(0, 10).map((entry) => (
              <button key={entry.id} className={stampKind === entry.id ? "active" : ""} onClick={() => { useAppStore.getState().setStampKind(entry.id); useAppStore.getState().setTool("stamp"); }}>{entry.label}</button>
            ))}
          </div>
          <label className="compact-label">
            Cozy brush
            <select value={cozyBrushKind} onChange={(event) => { useAppStore.getState().setCozyBrushKind(event.target.value as CozyBrushKind); useAppStore.getState().setTool("cozy"); }}>
              {cozyBrushes.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          <div className="button-row">
            <button onClick={() => useAppStore.getState().setTool("magicInk")}>Magic Ink</button>
            <button onClick={() => useAppStore.getState().setTool("ramp")}>Ramp Brush</button>
          </div>
        </section>
        <section className="panel">
          <h2><WandSparkles size={16} /> Beginner Fix Buttons</h2>
          <p className="hint">Select art first, or let easyPIX use the visible pixels on this layer.</p>
          <div className="effect-grid">
            {drawingEffects.map((entry) => (
              <button key={entry.id} onClick={() => useAppStore.getState().applyDrawingEffect(entry.id)}>{entry.label}</button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2><PaletteIcon size={16} /> Palette</h2>
          <div className="palette-preset-row">
            <select value={palettePresetId} onChange={(event) => setPalettePresetId(event.target.value)} aria-label="Palette preset">
              {palettePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button onClick={() => useAppStore.getState().applyPalettePreset(palettePresetId, "replace")}>Use</button>
            <button onClick={() => useAppStore.getState().applyPalettePreset(palettePresetId, "append")}>Append</button>
          </div>
          {selectedPreset ? (
            <p className="hint palette-credit">
              {selectedPreset.credit}. {selectedPreset.note}
            </p>
          ) : null}
          <div className="swatches">
            {palette.colors.map((entry) => (
              <button key={entry} className={entry === color ? "active swatch" : "swatch"} style={{ background: entry }} onClick={() => useAppStore.getState().setColor(entry)} title={entry} />
            ))}
          </div>
          <div className="color-row">
            <input type="color" value={customColor} onChange={(event) => setCustomColor(event.target.value)} />
            <button onClick={() => useAppStore.getState().addPaletteColor(customColor)}>Add</button>
            <button onClick={() => useAppStore.getState().removePaletteColor(color)}>Remove</button>
          </div>
          <div className="button-row">
            <button onClick={() => useAppStore.getState().addPaletteShades(color)}>Shades</button>
            <button onClick={() => { useAppStore.getState().addPaletteRamp(rampColor); useAppStore.getState().setColor(rampColor); }}>Ramp</button>
            <button onClick={() => useAppStore.getState().sortPalette()}>Sort</button>
          </div>
          <div className="palette-mini-tools">
            <label>
              Ramp base
              <input type="color" value={rampColor} onChange={(event) => setRampColor(event.target.value)} />
            </label>
            <label>
              From
              <input type="color" value={swapFrom} onChange={(event) => setSwapFrom(event.target.value)} />
            </label>
            <label>
              To
              <input type="color" value={swapTo} onChange={(event) => setSwapTo(event.target.value)} />
            </label>
            <button onClick={() => useAppStore.getState().remapColor(swapFrom, swapTo)}>Remap art</button>
          </div>
          <div className="ramp-preview" aria-label="Generated ramp preview">
            {[...palette.colors].slice(-8).map((entry) => (
              <i key={entry} style={{ background: entry }} />
            ))}
          </div>
          <textarea value={paletteText} onChange={(event) => setPaletteText(event.target.value)} placeholder='Paste easyPIX palette JSON, Lospec/GPL text, or hex colors like #112233 #445566' />
          <div className="button-row">
            <button onClick={() => { useAppStore.getState().importPaletteJson(paletteText); setPaletteText(""); }}>
              <Upload size={15} /> Import palette
            </button>
            <button
              onClick={() => {
                const json = useAppStore.getState().exportPaletteJson();
                setPaletteExportText(json);
                downloadBlob(new Blob([json], { type: "application/json" }), `${palette.name || "palette"}.palette.json`);
              }}
            >
              <FileJson size={15} /> Export JSON
            </button>
          </div>
          {paletteExportText ? <textarea readOnly value={paletteExportText} aria-label="Exported palette JSON" /> : null}
          {warnings.map((warning) => (
            <p className="hint" key={warning}>{warning}</p>
          ))}
        </section>
        <section className="panel">
          <h2>Shortcuts</h2>
          <div className="shortcut-grid">
            <span>B</span><p>Pencil</p>
            <span>E</span><p>Eraser</p>
            <span>G</span><p>Fill</p>
            <span>I</span><p>Picker</p>
            <span>A</span><p>Spray</p>
            <span>R</span><p>Replace color</p>
            <span>L</span><p>Lighten</p>
            <span>D</span><p>Darken</p>
            <span>W</span><p>Magic wand</p>
            <span>V</span><p>Lasso</p>
            <span>O</span><p>Move</p>
            <span>Arrows</span><p>Nudge selection</p>
            <span>M</span><p>Mirror X</p>
            <span>[ ]</span><p>Brush size</p>
          </div>
        </section>
        <section className="panel">
          <h2><Layers size={16} /> Layers</h2>
          <button onClick={() => useAppStore.getState().addLayer()}>Add layer</button>
          <div className="layer-list">
            {[...asset.layers].reverse().map((layer) => (
              <div key={layer.id} className={layer.id === activeLayer.id ? "active layer-row" : "layer-row"} onClick={() => useAppStore.setState({ activeLayerId: layer.id })}>
                <button title="Toggle visibility" onClick={(event) => { event.stopPropagation(); useAppStore.getState().updateLayer(layer.id, { visible: !layer.visible }); }}>
                  {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <input value={layer.name} onChange={(event) => useAppStore.getState().updateLayer(layer.id, { name: event.target.value })} />
                <input className="range-fill" style={rangeStyle(layer.opacity, 0, 1)} type="range" min="0" max="1" step="0.05" value={layer.opacity} onChange={(event) => useAppStore.getState().updateLayer(layer.id, { opacity: Number(event.target.value) })} />
                <button title="Lock layer" onClick={() => useAppStore.getState().updateLayer(layer.id, { locked: !layer.locked })}>{layer.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
                <button title="Move layer up" onClick={() => useAppStore.getState().moveLayer(layer.id, 1)}><ArrowUp size={15} /></button>
                <button title="Move layer down" onClick={() => useAppStore.getState().moveLayer(layer.id, -1)}><ArrowDown size={15} /></button>
                <button title="Duplicate layer" onClick={() => useAppStore.getState().duplicateLayer(layer.id)}><Copy size={15} /></button>
                <button title="Merge down" onClick={() => useAppStore.getState().mergeLayerDown(layer.id)}>Merge</button>
                <button title="Delete layer" onClick={() => useAppStore.getState().removeLayer(layer.id)}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </section>
      </aside>
      <nav className="mobile-editor-bar" aria-label="Mobile editor controls">
        <button className={mobileMode ? "active" : ""} onClick={() => setMobileMode(!mobileMode)} title="Mobile drawing layout">
          <PanelBottom size={17} /> Mobile
        </button>
        <button className={precisionMode ? "active" : ""} onClick={() => setPrecisionMode(!precisionMode)} title="Offset precision cursor">
          <Search size={17} /> Precision
        </button>
        <button className={panMode ? "active" : ""} onClick={() => setPanMode(!panMode)} title="One-finger pan mode">
          <Move size={17} /> Pan
        </button>
        <button onClick={() => useAppStore.getState().setZoom(8)}>8x</button>
        <button onClick={() => useAppStore.getState().setZoom(16)}>16x</button>
        <button onClick={() => useAppStore.getState().setZoom(32)}>32x</button>
        <button onClick={() => useAppStore.getState().undo()}>Undo</button>
        <button onClick={() => useAppStore.getState().redo()}>Redo</button>
        <div className="mobile-nudge-pad">
          <button onClick={() => useAppStore.getState().moveSelection(0, -nudgeAmount)} disabled={!selection}><ArrowUp size={15} /></button>
          <button onClick={() => useAppStore.getState().moveSelection(-nudgeAmount, 0)} disabled={!selection}><ArrowLeft size={15} /></button>
          <button className={mobileNudgeLarge ? "active" : ""} onClick={() => setMobileNudgeLarge(!mobileNudgeLarge)}>{mobileNudgeLarge ? "8px" : "1px"}</button>
          <button onClick={() => useAppStore.getState().moveSelection(nudgeAmount, 0)} disabled={!selection}><ArrowRight size={15} /></button>
          <button onClick={() => useAppStore.getState().moveSelection(0, nudgeAmount)} disabled={!selection}><ArrowDown size={15} /></button>
        </div>
      </nav>
    </section>
  );
};

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Download,
  Film,
  Gamepad2,
  Grid3X3,
  Heart,
  History,
  Image,
  LayoutGrid,
  Palette,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useAppStore } from "../app/store";
import { drawAssetFrame, renderAsset } from "../editor/canvas/renderers";
import { DEFAULT_PNG_EXPORT_SCALE, downloadBlob, exportAssetFramePng, exportGamePackZip, exportProjectZip, exportTilesheetPng } from "../projects/importExport/zip";
import type { PixelAsset, Workspace } from "../projects/types";
import type { EffectKind, UiKitKind } from "../projects/generators";

const effectKinds: EffectKind[] = ["fire", "smoke", "magic", "splash", "impact", "glow"];
const uiKinds: UiKitKind[] = ["dialogue", "button", "health", "cursor", "inventory"];
type AssetFilter = "all" | "favorites" | "animated" | "tiles" | "characters" | "ui" | "effects";

const AssetThumb = ({ asset, large = false }: { asset: PixelAsset; large?: boolean }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const size = large ? 96 : 48;
    if (ref.current) renderAsset(ref.current, asset, Math.max(1, Math.floor(size / Math.max(asset.width, asset.height))), { grid: false, frameId: asset.frames[0]?.id });
  }, [asset, large]);
  return <canvas ref={ref} className={large ? "studio-asset-thumb large" : "studio-asset-thumb"} />;
};

const GameScalePreview = ({ asset }: { asset: PixelAsset }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 480;
    canvas.height = 288;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#8bd5f7";
    ctx.fillRect(0, 0, 480, 192);
    ctx.fillStyle = "#4f8a38";
    ctx.fillRect(0, 192, 480, 96);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
    for (let x = 0; x <= 480; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, 288);
      ctx.stroke();
    }
    for (let y = 0; y <= 288; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(480, y + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(15, 23, 42, 0.28)";
    ctx.fillRect(48, 128, 64, 96);
    ctx.fillRect(376, 176, 32, 48);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "12px monospace";
    ctx.fillText("door", 62, 151);
    ctx.fillText("32x48", 372, 170);
    const scale = Math.max(1, Math.min(6, Math.floor(120 / Math.max(asset.width, asset.height))));
    const x = Math.floor((480 - asset.width * scale) / 2);
    const y = 224 - asset.height * scale;
    ctx.save();
    ctx.translate(x, y);
    drawAssetFrame(ctx, asset, scale, asset.frames[0]?.id);
    ctx.restore();
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(164, 248, 152, 24);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(`${asset.width}x${asset.height}px at ${scale}x`, 178, 264);
  }, [asset]);
  return <canvas ref={ref} className="game-scale-canvas" />;
};

export const StudioWorkspace = () => {
  const project = useAppStore((state) => state.project)!;
  const activeAssetId = useAppStore((state) => state.activeAssetId);
  const revisions = useAppStore((state) => state.revisions);
  const asset = project.assets.find((entry) => entry.id === activeAssetId) ?? project.assets[0];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [characterName, setCharacterName] = useState("Player Character");
  const [skin, setSkin] = useState("#efb8a5");
  const [hair, setHair] = useState("#3f2d2a");
  const [shirt, setShirt] = useState("#4f7cc8");
  const [trousers, setTrousers] = useState("#334155");
  const [effectPrimary, setEffectPrimary] = useState("#60a5fa");
  const [effectSecondary, setEffectSecondary] = useState("#fef3c7");
  const [uiAccent, setUiAccent] = useState("#60a5fa");
  const [restoreId, setRestoreId] = useState<string | null>(null);

  useEffect(() => {
    void useAppStore.getState().loadRevisions();
  }, [project.id]);

  const filteredAssets = useMemo(() => {
    const text = query.trim().toLowerCase();
    return [...project.assets].filter((entry) => {
      const tags = entry.tags ?? [];
      const matchesText = !text || `${entry.name} ${tags.join(" ")}`.toLowerCase().includes(text);
      const matchesFilter = filter === "all"
        || (filter === "favorites" && entry.favorite)
        || (filter === "animated" && entry.frames.length > 1)
        || (filter === "tiles" && project.tilesets.some((tileset) => tileset.assetIds.includes(entry.id)))
        || (filter === "characters" && tags.includes("character"))
        || (filter === "ui" && tags.includes("ui"))
        || (filter === "effects" && tags.includes("effect"));
      return matchesText && matchesFilter;
    }).sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name));
  }, [filter, project.assets, project.tilesets, query]);

  const openAssetIn = (workspace: Workspace) => {
    useAppStore.getState().selectAsset(asset.id);
    if (workspace === "sandbox") useAppStore.getState().setSceneBrush("asset");
    useAppStore.getState().setWorkspace(workspace);
  };

  const effects = {
    outline: { enabled: false, color: "#111827", ...(asset.effects?.outline ?? {}) },
    shadow: { enabled: false, color: "rgba(15, 23, 42, 0.55)", offsetX: 2, offsetY: 2, ...(asset.effects?.shadow ?? {}) },
    tint: { enabled: false, color: "#60a5fa", amount: 0.25, ...(asset.effects?.tint ?? {}) },
  };

  const updateEffects = (next: Partial<typeof effects>) => useAppStore.getState().setAssetEffects(asset.id, { ...effects, ...next });

  const exportProject = async () => {
    await useAppStore.getState().persist();
    const blob = await exportProjectZip(useAppStore.getState().project ?? project);
    downloadBlob(blob, `${project.name.replace(/\s+/g, "-").toLowerCase()}.pixelzip`);
  };

  const exportGamePack = async (target: "godot" | "unity" | "phaser") => {
    const blob = await exportGamePackZip(project, target);
    downloadBlob(blob, `${project.name.replace(/\s+/g, "-").toLowerCase()}-${target}-pack.zip`);
  };

  return (
    <section className="workspace studio-layout">
      <header className="studio-header">
        <div>
          <p className="hero-kicker">Creative Studio</p>
          <h1>Build, organize, preview, and ship your game art.</h1>
        </div>
        <div className="studio-header-stats">
          <span><Image size={15} /> {project.assets.length} assets</span>
          <span><Film size={15} /> {project.assets.reduce((sum, entry) => sum + entry.frames.length, 0)} frames</span>
          <span><LayoutGrid size={15} /> {project.scenes.length} scenes</span>
        </div>
      </header>

      <div className="studio-main-grid">
        <aside className="panel studio-library-panel">
          <div className="panel-title-row"><h2><Boxes size={17} /> Asset Library</h2><span>{filteredAssets.length}</span></div>
          <label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets and tags" /></label>
          <div className="studio-filter-row">
            {(["all", "favorites", "animated", "tiles", "characters", "ui", "effects"] as AssetFilter[]).map((entry) => <button key={entry} className={filter === entry ? "active" : ""} onClick={() => setFilter(entry)}>{entry}</button>)}
          </div>
          <div className="studio-asset-grid">
            {filteredAssets.map((entry) => (
              <button key={entry.id} className={entry.id === asset.id ? "active studio-asset-card" : "studio-asset-card"} onClick={() => useAppStore.getState().selectAsset(entry.id)} draggable onDragStart={(event) => event.dataTransfer.setData("application/easypix-asset", entry.id)}>
                <AssetThumb asset={entry} />
                <span><strong>{entry.name}</strong><small>{entry.width}x{entry.height} - {entry.frames.length}f</small></span>
                <Star className={entry.favorite ? "favorite-star" : ""} size={14} fill={entry.favorite ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </aside>

        <main className="studio-workbench">
          <section className="panel active-asset-hub">
            <div className="active-asset-summary">
              <AssetThumb asset={asset} large />
              <div>
                <p className="hero-kicker">Selected asset</p>
                <h2>{asset.name}</h2>
                <p>{asset.width}x{asset.height}px - {asset.layers.length} layers - {asset.frames.length} frames</p>
                <input value={(asset.tags ?? []).join(", ")} onChange={(event) => useAppStore.getState().setAssetTags(asset.id, event.target.value.split(","))} placeholder="character, player, outdoor" aria-label="Asset tags" />
              </div>
              <button className={asset.favorite ? "active" : ""} onClick={() => useAppStore.getState().toggleAssetFavorite(asset.id)} title="Favorite asset"><Star size={18} fill={asset.favorite ? "currentColor" : "none"} /></button>
            </div>
            <div className="asset-destination-row">
              <button onClick={() => openAssetIn("editor")}><Image size={16} /> Draw</button>
              <button onClick={() => openAssetIn("animation")}><Play size={16} /> Animate</button>
              <button onClick={() => openAssetIn("tileset")}><Grid3X3 size={16} /> Tile Check</button>
              <button onClick={() => openAssetIn("sandbox")}><LayoutGrid size={16} /> Place in Scene</button>
              <button onClick={() => useAppStore.getState().setWorkspace("palettes")}><Palette size={16} /> Recolor</button>
            </div>
            <div className="asset-metadata-row">
              <span><Gamepad2 size={15} /> Collision: {asset.collision ? `${asset.collision.kind} ${asset.collision.width}x${asset.collision.height}` : "none"}</span>
              <button onClick={() => useAppStore.getState().setAssetCollision(asset.id, { x: 0, y: 0, width: asset.width, height: asset.height, kind: "solid" })}>Full solid</button>
              <button onClick={() => useAppStore.getState().setAssetCollision(asset.id, { x: Math.floor(asset.width * 0.25), y: Math.floor(asset.height * 0.7), width: Math.max(1, Math.ceil(asset.width * 0.5)), height: Math.max(1, Math.ceil(asset.height * 0.3)), kind: "solid" })}>Feet solid</button>
              <button onClick={() => useAppStore.getState().setAssetCollision(asset.id, { x: 0, y: 0, width: asset.width, height: asset.height, kind: "trigger" })}>Trigger</button>
              <button onClick={() => useAppStore.getState().setAssetCollision(asset.id, undefined)}>None</button>
            </div>
          </section>

          <div className="studio-card-grid">
            <section className="panel studio-tool-card">
              <h2><WandSparkles size={17} /> Pixel Effects Studio</h2>
              <p className="hint">Creates a normal editable six-frame effect asset.</p>
              <div className="color-input-row"><label>Main<input type="color" value={effectPrimary} onChange={(event) => setEffectPrimary(event.target.value)} /></label><label>Light<input type="color" value={effectSecondary} onChange={(event) => setEffectSecondary(event.target.value)} /></label></div>
              <div className="generator-button-grid">
                {effectKinds.map((kind) => <button key={kind} onClick={() => useAppStore.getState().addGeneratedEffect(kind, effectPrimary, effectSecondary)}><Sparkles size={14} /> {kind}</button>)}
              </div>
            </section>

            <section className="panel studio-tool-card">
              <h2><Gamepad2 size={17} /> Character Workshop</h2>
              <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} aria-label="Character name" />
              <div className="character-color-grid">
                <label>Skin<input type="color" value={skin} onChange={(event) => setSkin(event.target.value)} /></label>
                <label>Hair<input type="color" value={hair} onChange={(event) => setHair(event.target.value)} /></label>
                <label>Shirt<input type="color" value={shirt} onChange={(event) => setShirt(event.target.value)} /></label>
                <label>Legs<input type="color" value={trousers} onChange={(event) => setTrousers(event.target.value)} /></label>
              </div>
              <button onClick={() => useAppStore.getState().addGeneratedCharacter(characterName, { skin, hair, shirt, trousers })}><Plus size={15} /> Create editable walk character</button>
            </section>

            <section className="panel studio-tool-card">
              <h2><Heart size={17} /> Game UI Creator</h2>
              <label>Accent<input type="color" value={uiAccent} onChange={(event) => setUiAccent(event.target.value)} /></label>
              <div className="generator-button-grid">
                {uiKinds.map((kind) => <button key={kind} onClick={() => useAppStore.getState().addGeneratedUi(kind, uiAccent)}>{kind}</button>)}
              </div>
            </section>

            <section className="panel studio-tool-card nondestructive-effects">
              <h2><Sparkles size={17} /> Live Asset Effects</h2>
              <p className="hint">Saved as adjustable settings. Original pixels stay untouched and exports include the result.</p>
              <label className="effect-control"><input type="checkbox" checked={effects.outline.enabled} onChange={(event) => updateEffects({ outline: { ...effects.outline, enabled: event.target.checked } })} /> Outline<input type="color" value={effects.outline.color} onChange={(event) => updateEffects({ outline: { ...effects.outline, color: event.target.value } })} /></label>
              <label className="effect-control"><input type="checkbox" checked={effects.shadow.enabled} onChange={(event) => updateEffects({ shadow: { ...effects.shadow, enabled: event.target.checked } })} /> Shadow<input type="color" value={effects.shadow.color.startsWith("#") ? effects.shadow.color : "#1f2937"} onChange={(event) => updateEffects({ shadow: { ...effects.shadow, color: event.target.value } })} /></label>
              <div className="effect-offset-row"><label>X<input type="number" min={-8} max={8} value={effects.shadow.offsetX} onChange={(event) => updateEffects({ shadow: { ...effects.shadow, offsetX: Number(event.target.value) } })} /></label><label>Y<input type="number" min={-8} max={8} value={effects.shadow.offsetY} onChange={(event) => updateEffects({ shadow: { ...effects.shadow, offsetY: Number(event.target.value) } })} /></label></div>
              <label className="effect-control"><input type="checkbox" checked={effects.tint.enabled} onChange={(event) => updateEffects({ tint: { ...effects.tint, enabled: event.target.checked } })} /> Tint<input type="color" value={effects.tint.color} onChange={(event) => updateEffects({ tint: { ...effects.tint, color: event.target.value } })} /></label>
              <label>Amount<input type="range" min={0} max={1} step={0.05} value={effects.tint.amount} onChange={(event) => updateEffects({ tint: { ...effects.tint, amount: Number(event.target.value) } })} /><span>{Math.round(effects.tint.amount * 100)}%</span></label>
            </section>
          </div>

          <section className="panel scale-preview-panel">
            <div><h2><Gamepad2 size={17} /> Game-Scale Preview</h2><p className="hint">Check the selected asset against a 32px world grid, a door, and a common character footprint.</p></div>
            <GameScalePreview asset={asset} />
          </section>

          <div className="studio-bottom-grid">
            <section className="panel export-center-panel">
              <h2><Download size={17} /> Export Center</h2>
              <div className="export-preset-grid">
                <button onClick={() => downloadBlob(exportAssetFramePng(asset, asset.frames[0]?.id, DEFAULT_PNG_EXPORT_SCALE), `${asset.name}-${DEFAULT_PNG_EXPORT_SCALE}x.png`)}><Image size={15} /> Active PNG</button>
                <button onClick={() => downloadBlob(exportTilesheetPng(project.assets, project.tilesets[0]?.tileWidth ?? 32, project.tilesets[0]?.tileHeight ?? 32, 1), `${project.name}-tilesheet.png`)}><Grid3X3 size={15} /> Tilesheet</button>
                <button onClick={() => void exportProject()}><Download size={15} /> Full backup</button>
                <button onClick={() => void exportGamePack("godot")}><Gamepad2 size={15} /> Godot Pack</button>
                <button onClick={() => void exportGamePack("unity")}>Unity Pack</button>
                <button onClick={() => void exportGamePack("phaser")}>Web Pack</button>
              </div>
            </section>

            <section className="panel revision-panel">
              <div className="panel-title-row"><h2><History size={17} /> Local History</h2><button onClick={() => void useAppStore.getState().createRevision()}><Plus size={14} /> Snapshot</button></div>
              <p className="hint">Automatic snapshots are kept locally. Manual snapshots are useful before large edits.</p>
              <div className="revision-list">
                {revisions.length ? revisions.slice(0, 8).map((revision) => (
                  <div className="revision-row" key={revision.id}>
                    <span><strong>{revision.label}</strong><small>{new Date(revision.createdAt).toLocaleString()}</small></span>
                    {restoreId === revision.id ? (
                      <span className="revision-confirm"><button onClick={() => void useAppStore.getState().restoreRevision(revision.id)}>Restore</button><button onClick={() => setRestoreId(null)}>Cancel</button></span>
                    ) : <button onClick={() => setRestoreId(revision.id)} title="Restore snapshot"><RotateCcw size={14} /></button>}
                    <button onClick={() => void useAppStore.getState().removeRevision(revision.id)} title="Delete snapshot"><Trash2 size={14} /></button>
                  </div>
                )) : <p className="hint">Your first automatic snapshot appears after working for a little while.</p>}
              </div>
            </section>
          </div>
        </main>
      </div>
    </section>
  );
};

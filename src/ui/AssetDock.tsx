import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Grid3X3, Image, LayoutGrid, Play, Search, Star, X } from "lucide-react";
import { useAppStore } from "../app/store";
import { renderAsset } from "../editor/canvas/renderers";
import type { PixelAsset, Workspace } from "../projects/types";

const DockThumb = ({ asset }: { asset: PixelAsset }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) renderAsset(ref.current, asset, Math.max(1, Math.floor(42 / Math.max(asset.width, asset.height))), { grid: false, frameId: asset.frames[0]?.id });
  }, [asset]);
  return <canvas ref={ref} />;
};

export const AssetDock = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const project = useAppStore((state) => state.project)!;
  const activeAssetId = useAppStore((state) => state.activeAssetId);
  const assets = useMemo(() => {
    const text = query.trim().toLowerCase();
    return [...project.assets]
      .filter((asset) => !text || `${asset.name} ${(asset.tags ?? []).join(" ")}`.toLowerCase().includes(text))
      .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name));
  }, [project.assets, query]);

  const openIn = (workspace: Workspace) => {
    if (workspace === "sandbox") useAppStore.getState().setSceneBrush("asset");
    useAppStore.getState().setWorkspace(workspace);
    setOpen(false);
  };

  return (
    <>
      <button className="asset-dock-trigger" onClick={() => setOpen(!open)} title="Open universal asset tray" aria-label="Open asset tray"><Boxes size={19} /></button>
      {open ? (
        <aside className="asset-dock" aria-label="Universal asset tray">
          <header><div><Boxes size={18} /><strong>Asset Tray</strong><span>{assets.length}</span></div><button onClick={() => setOpen(false)} title="Close"><X size={17} /></button></header>
          <label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find any project asset" autoFocus /></label>
          <div className="asset-dock-destinations">
            <button onClick={() => openIn("editor")} title="Open selected asset in Draw"><Image size={16} /></button>
            <button onClick={() => openIn("animation")} title="Open selected asset in Animate"><Play size={16} /></button>
            <button onClick={() => openIn("tileset")} title="Open selected asset in Tile Check"><Grid3X3 size={16} /></button>
            <button onClick={() => openIn("sandbox")} title="Use selected asset in Sandbox"><LayoutGrid size={16} /></button>
          </div>
          <div className="asset-dock-list">
            {assets.map((asset) => (
              <button key={asset.id} className={asset.id === activeAssetId ? "active" : ""} onClick={() => useAppStore.getState().selectAsset(asset.id)} draggable onDragStart={(event) => event.dataTransfer.setData("application/easypix-asset", asset.id)}>
                <DockThumb asset={asset} />
                <span><strong>{asset.name}</strong><small>{asset.width}x{asset.height} - {asset.frames.length}f</small></span>
                {asset.favorite ? <Star size={13} fill="currentColor" /> : null}
              </button>
            ))}
          </div>
        </aside>
      ) : null}
    </>
  );
};

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useAppStore } from "../app/store";
import { renderRepeatPreview, renderTilesheet } from "../editor/canvas/renderers";
import { DEFAULT_PNG_EXPORT_SCALE, downloadBlob, exportAssetPng, exportTilesheetPng } from "../projects/importExport/zip";

export const TilesetWorkspace = () => {
  const sheetRef = useRef<HTMLCanvasElement | null>(null);
  const repeatRef = useRef<HTMLCanvasElement | null>(null);
  const neighborRef = useRef<HTMLCanvasElement | null>(null);
  const project = useAppStore((state) => state.project)!;
  const activeAssetId = useAppStore((state) => state.activeAssetId);
  const [tileSize, setTileSize] = useState(32);
  const [exportScale, setExportScale] = useState(DEFAULT_PNG_EXPORT_SCALE);
  const tileset = project.tilesets.find((entry) => entry.id === useAppStore.getState().activeTilesetId) ?? project.tilesets[0];
  const assets = tileset.assetIds
    .map((id) => project.assets.find((asset) => asset.id === id))
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
  const activeAsset = project.assets.find((asset) => asset.id === activeAssetId) ?? assets[0] ?? project.assets[0];

  useEffect(() => {
    if (sheetRef.current) renderTilesheet(sheetRef.current, assets, tileset.tileWidth, tileset.tileHeight, 3);
    if (repeatRef.current && activeAsset) renderRepeatPreview(repeatRef.current, activeAsset, 3);
    if (neighborRef.current && activeAsset) renderTilesheet(neighborRef.current, [activeAsset, activeAsset, activeAsset, activeAsset, activeAsset, activeAsset, activeAsset, activeAsset, activeAsset], activeAsset.width, activeAsset.height, 3);
  }, [activeAsset, assets, tileset.tileHeight, tileset.tileWidth]);

  return (
    <section className="workspace tileset-layout">
      <aside className="panel asset-browser">
        <h2>Tiles</h2>
        <button onClick={() => useAppStore.getState().addAsset()}>Add tile asset</button>
        <button onClick={() => useAppStore.getState().addAssetToTileset(activeAsset.id)}>Add active to tileset</button>
        {project.assets.map((asset) => (
          <button key={asset.id} className={asset.id === activeAssetId ? "active asset-row" : "asset-row"} onClick={() => useAppStore.getState().selectAsset(asset.id)}>
            {asset.name}
          </button>
        ))}
      </aside>
      <section className="preview-grid">
        <article className="panel preview-panel">
          <h2>Tilesheet Preview</h2>
          <canvas ref={sheetRef} />
        </article>
        <article className="panel preview-panel">
          <h2>Repeat Preview</h2>
          <canvas ref={repeatRef} />
        </article>
        <article className="panel preview-panel">
          <h2>Neighbor Preview</h2>
          <canvas ref={neighborRef} />
        </article>
        <article className="panel">
          <h2>Export</h2>
          <div className="export-controls">
            <label>
              <span>Tile size</span>
              <select value={tileSize} onChange={(event) => setTileSize(Number(event.target.value))}>
                <option value={8}>8 px</option>
                <option value={16}>16 px</option>
                <option value={24}>24 px</option>
                <option value={32}>32 px</option>
                <option value={64}>64 px</option>
              </select>
            </label>
            <label>
              <span>Scale</span>
              <select value={exportScale} onChange={(event) => setExportScale(Number(event.target.value))}>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
                <option value={8}>8x</option>
                <option value={16}>16x</option>
              </select>
            </label>
          </div>
          <div className="export-actions">
            <button onClick={() => downloadBlob(exportAssetPng(activeAsset, exportScale), `${activeAsset.name}-${exportScale}x.png`)}>
              <Download size={16} /> Active {exportScale}x PNG
            </button>
            <button onClick={() => downloadBlob(exportTilesheetPng(assets, tileSize, tileSize, exportScale), `${tileset.name}-${exportScale}x.png`)}>
              <Download size={16} /> Tilesheet PNG
            </button>
          </div>
          <p className="hint">Check repeats and neighbor seams here before exporting the tilesheet.</p>
        </article>
      </section>
    </section>
  );
};

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, FileJson, Palette, Plus, RefreshCw, Upload, WandSparkles } from "lucide-react";
import { palettePresets, type PalettePreset } from "./presets";
import { useAppStore } from "../app/store";
import { downloadBlob } from "../projects/importExport/zip";
import { renderAsset } from "../editor/canvas/renderers";
import type { PixelAsset } from "../projects/types";

const categoryLabels: Record<PalettePreset["category"] | "all", string> = {
  all: "All",
  "game-dev": "Game dev",
  "fantasy-console": "Fantasy console",
  limited: "Limited",
  "retro-hardware": "Retro hardware",
};

const PaletteArtPreview = ({ asset, label }: { asset: PixelAsset | null; label: string }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current && asset) renderAsset(ref.current, asset, Math.max(1, Math.floor(96 / Math.max(asset.width, asset.height))), { grid: false, frameId: asset.frames[0]?.id });
  }, [asset]);
  return (
    <div className="palette-art-preview">
      <span>{label}</span>
      {asset ? <canvas ref={ref} /> : <p className="hint">No art yet</p>}
    </div>
  );
};

export const PalettesWorkspace = () => {
  const project = useAppStore((state) => state.project)!;
  const [category, setCategory] = useState<PalettePreset["category"] | "all">("all");
  const [query, setQuery] = useState("");
  const [paletteText, setPaletteText] = useState("");
  const [exportText, setExportText] = useState("");
  const [compareLeft, setCompareLeft] = useState(palettePresets[0]?.id ?? "");
  const [compareRight, setCompareRight] = useState(palettePresets[1]?.id ?? palettePresets[0]?.id ?? "");
  const activePalette = project.palettes[0];
  const activeAsset = project.assets.find((entry) => entry.id === useAppStore.getState().activeAssetId) ?? project.assets[0] ?? null;
  const presets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return palettePresets.filter((preset) => {
      const matchesCategory = category === "all" || preset.category === category;
      const matchesQuery = !normalizedQuery || `${preset.name} ${preset.credit} ${preset.note} ${(preset.tags ?? []).join(" ")}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);
  const leftPreset = palettePresets.find((preset) => preset.id === compareLeft) ?? palettePresets[0];
  const rightPreset = palettePresets.find((preset) => preset.id === compareRight) ?? palettePresets[1] ?? palettePresets[0];

  const exportCurrent = () => {
    const json = useAppStore.getState().exportPaletteJson();
    setExportText(json);
    downloadBlob(new Blob([json], { type: "application/json" }), `${activePalette.name || "palette"}.palette.json`);
  };

  return (
    <section className="workspace palettes-layout">
      <header className="palette-page-hero">
        <div>
          <p className="hero-kicker">Palette library</p>
          <h1>Pick colors that already know how to behave.</h1>
        </div>
        <p>
          Use a proven palette, append it to your current set, import a JSON/GPL/hex palette, or export your own colors for reuse in another project.
        </p>
      </header>

      <section className="palette-workbench">
        <aside className="panel palette-active-panel">
          <h2>
            <Palette size={16} /> Active Palette
          </h2>
          <div className="large-swatches">
            {activePalette.colors.map((color) => (
              <button key={color} className="large-swatch" style={{ background: color }} onClick={() => useAppStore.getState().setColor(color)} title={color} />
            ))}
          </div>
          <div className="palette-stat-grid">
            <span>{activePalette.colors.length}</span>
            <p>colors</p>
            <span>{activePalette.name}</span>
            <p>current set</p>
          </div>
          <div className="button-row">
            <button onClick={exportCurrent}>
              <FileJson size={15} /> Export JSON
            </button>
            <button onClick={() => useAppStore.getState().sortPalette()}>Sort by value</button>
          </div>
          <button onClick={() => useAppStore.getState().remapArtToPalette()} title="Replace every art color with the closest active palette color">
            <WandSparkles size={15} /> Recolor art to active palette
          </button>
          <textarea value={paletteText} onChange={(event) => setPaletteText(event.target.value)} placeholder="Paste easyPIX palette JSON, Lospec/GPL text, or hex colors." />
          <button onClick={() => { useAppStore.getState().importPaletteJson(paletteText); setPaletteText(""); }}>
            <Upload size={15} /> Import palette
          </button>
          {exportText ? <textarea readOnly value={exportText} aria-label="Exported palette JSON" /> : null}
        </aside>

        <main className="palette-browser">
          <section className="panel palette-compare-panel">
            <div>
              <h2>Compare Palettes</h2>
              <p className="hint">Preview two real palettes side by side, then use one, append it, or recolor the whole project to your active palette.</p>
            </div>
            <div className="palette-compare-grid">
              {[leftPreset, rightPreset].map((preset, index) => (
                <div className="palette-compare-card" key={`${preset.id}-${index}`}>
                  <select value={index === 0 ? compareLeft : compareRight} onChange={(event) => (index === 0 ? setCompareLeft(event.target.value) : setCompareRight(event.target.value))}>
                    {palettePresets.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
                  </select>
                  <div className="palette-card-swatches compact">
                    {preset.colors.map((color) => <i key={color} style={{ background: color }} title={color} />)}
                  </div>
                  <div className="button-row">
                    <button onClick={() => useAppStore.getState().applyPalettePreset(preset.id, "replace")}><Palette size={15} /> Use</button>
                    <button onClick={() => useAppStore.getState().applyPalettePreset(preset.id, "append")}><Plus size={15} /> Append</button>
                  </div>
                </div>
              ))}
              <PaletteArtPreview asset={activeAsset} label="Current art" />
            </div>
          </section>
          <div className="palette-browser-toolbar">
            <div className="palette-filter-row">
              {(Object.keys(categoryLabels) as Array<PalettePreset["category"] | "all">).map((entry) => (
                <button key={entry} className={category === entry ? "active" : ""} onClick={() => setCategory(entry)}>
                  {categoryLabels[entry]}
                </button>
              ))}
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search palettes" aria-label="Search palettes" />
            <span className="status-pill">{presets.length} shown</span>
          </div>
          <a className="palette-more-link" href="https://lospec.com/palette-list" target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            Browse more palettes on Lospec
          </a>
          <div className="palette-card-grid">
            {presets.map((preset) => (
              <article className="panel palette-card" key={preset.id}>
                <div className="palette-card-heading">
                  <div>
                    <h2>{preset.name}</h2>
                    <p>{preset.credit}</p>
                  </div>
                  <span>{preset.colors.length}</span>
                </div>
                <div className="palette-card-swatches">
                  {preset.colors.map((color) => (
                    <i key={color} style={{ background: color }} title={color} />
                  ))}
                </div>
                {preset.tags?.length ? (
                  <div className="palette-tags">
                    {preset.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                ) : null}
                <p className="hint">{preset.note}</p>
                <div className="palette-card-actions">
                  <button onClick={() => useAppStore.getState().applyPalettePreset(preset.id, "replace")} title={`Use ${preset.name}`}>
                    <Palette size={15} />
                  </button>
                  <button onClick={() => useAppStore.getState().setDefaultPalettePreset(preset.id)} title={`Set ${preset.name} as the default for new projects`}>
                    Default
                  </button>
                  <button onClick={() => useAppStore.getState().applyPalettePreset(preset.id, "append")} title={`Append ${preset.name}`}>
                    <Plus size={15} />
                  </button>
                  <a href={preset.sourceUrl} target="_blank" rel="noreferrer" title={`${preset.name} source`}>
                    <ExternalLink size={15} />
                  </a>
                  <button
                    title={`Download ${preset.name} JSON`}
                    onClick={() => {
                      const json = JSON.stringify({ type: "easyPIX-palette", version: 1, palette: { id: preset.id, name: preset.name, colors: preset.colors } }, null, 2);
                      downloadBlob(new Blob([json], { type: "application/json" }), `${preset.name.toLowerCase().replace(/\s+/g, "-")}.palette.json`);
                    }}
                  >
                    <Download size={15} />
                  </button>
                  <button onClick={() => { useAppStore.getState().applyPalettePreset(preset.id, "replace"); useAppStore.getState().remapArtToPalette(); }} title={`Use ${preset.name} and recolor art`}>
                    <RefreshCw size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      </section>
    </section>
  );
};

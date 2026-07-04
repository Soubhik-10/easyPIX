import { useMemo, useState } from "react";
import { Download, ExternalLink, FileJson, Palette, Plus, Upload } from "lucide-react";
import { palettePresets, type PalettePreset } from "./presets";
import { paletteWarnings, useAppStore } from "../app/store";
import { downloadBlob } from "../projects/importExport/zip";

const categoryLabels: Record<PalettePreset["category"] | "all", string> = {
  all: "All",
  "game-dev": "Game dev",
  "fantasy-console": "Fantasy console",
  limited: "Limited",
  "retro-hardware": "Retro hardware",
};

export const PalettesWorkspace = () => {
  const project = useAppStore((state) => state.project)!;
  const [category, setCategory] = useState<PalettePreset["category"] | "all">("all");
  const [query, setQuery] = useState("");
  const [paletteText, setPaletteText] = useState("");
  const [exportText, setExportText] = useState("");
  const activePalette = project.palettes[0];
  const warnings = useMemo(() => paletteWarnings(activePalette), [activePalette]);
  const presets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return palettePresets.filter((preset) => {
      const matchesCategory = category === "all" || preset.category === category;
      const matchesQuery = !normalizedQuery || `${preset.name} ${preset.credit} ${preset.note}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

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
          <textarea value={paletteText} onChange={(event) => setPaletteText(event.target.value)} placeholder="Paste easyPIX palette JSON, Lospec/GPL text, or hex colors." />
          <button onClick={() => { useAppStore.getState().importPaletteJson(paletteText); setPaletteText(""); }}>
            <Upload size={15} /> Import palette
          </button>
          {exportText ? <textarea readOnly value={exportText} aria-label="Exported palette JSON" /> : null}
          {warnings.map((warning) => (
            <p className="hint" key={warning}>{warning}</p>
          ))}
        </aside>

        <main className="palette-browser">
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
                <p className="hint">{preset.note}</p>
                <div className="palette-card-actions">
                  <button onClick={() => useAppStore.getState().applyPalettePreset(preset.id, "replace")} title={`Use ${preset.name}`}>
                    <Palette size={15} />
                    <span>Use</span>
                  </button>
                  <button onClick={() => useAppStore.getState().applyPalettePreset(preset.id, "append")} title={`Append ${preset.name}`}>
                    <Plus size={15} />
                    <span>Append</span>
                  </button>
                  <a href={preset.sourceUrl} target="_blank" rel="noreferrer" title={`${preset.name} source`}>
                    <ExternalLink size={15} />
                    <span>Source</span>
                  </a>
                  <button
                    title={`Download ${preset.name} JSON`}
                    onClick={() => {
                      const json = JSON.stringify({ type: "easyPIX-palette", version: 1, palette: { id: preset.id, name: preset.name, colors: preset.colors } }, null, 2);
                      downloadBlob(new Blob([json], { type: "application/json" }), `${preset.name.toLowerCase().replace(/\s+/g, "-")}.palette.json`);
                    }}
                  >
                    <Download size={15} />
                    <span>JSON</span>
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

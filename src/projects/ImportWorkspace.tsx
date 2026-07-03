import { ChangeEvent, useRef, useState } from "react";
import { FileJson, FileImage, PackageOpen, Upload } from "lucide-react";
import { useAppStore } from "../app/store";
import { importPixelFiles } from "./importExport/importers";

export const ImportWorkspace = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const project = useAppStore((state) => state.project)!;
  const [message, setMessage] = useState("Select PNG, Piskel, or Aseprite JSON plus PNG files.");

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    try {
      const assets = await importPixelFiles(files);
      if (!assets.length) {
        setMessage("No supported assets found in that selection.");
        return;
      }
      useAppStore.getState().addImportedAssets(assets);
      setMessage(`Imported ${assets.length} asset${assets.length === 1 ? "" : "s"}.`);
      useAppStore.getState().setWorkspace("tileset");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="workspace import-layout">
      <section className="import-hero-panel">
        <div>
          <h1>Import Studio</h1>
          <p>Bring in existing pixel art, inspect it, then jump straight into tile checking or editing.</p>
        </div>
        <button className="primary-action" onClick={() => inputRef.current?.click()}>
          <Upload size={18} /> Import files
        </button>
        <input ref={inputRef} type="file" multiple hidden accept=".png,.piskel,.json,image/png,application/json" onChange={onImport} />
      </section>
      <section className="import-grid">
        <article className="panel">
          <h2><FileImage size={16} /> PNG</h2>
          <p className="hint">Imports single images as editable pixel assets with transparent pixels preserved.</p>
        </article>
        <article className="panel">
          <h2><PackageOpen size={16} /> Piskel</h2>
          <p className="hint">Imports `.piskel` project files into layers and frames where the source data is available.</p>
        </article>
        <article className="panel">
          <h2><FileJson size={16} /> Aseprite JSON</h2>
          <p className="hint">Select exported JSON and its spritesheet PNG together to rebuild frame assets.</p>
        </article>
        <article className="panel">
          <h2>Current Project</h2>
          <p className="hint">{project.assets.length} assets available. Imported assets are added to the main tileset automatically.</p>
        </article>
      </section>
      <p className="import-status">{message}</p>
    </section>
  );
};

import { useEffect, useState } from "react";
import { BookOpen, Download, FolderOpen, Grid3X3, Image, LayoutGrid, Moon, Play, Plus, Save, Sparkles, Upload } from "lucide-react";
import { useAppStore } from "./store";
import { ProjectLibrary } from "../projects/ProjectLibrary";
import { EditorWorkspace } from "../editor/EditorWorkspace";
import { AnimationWorkspace } from "../animation/AnimationWorkspace";
import { TilesetWorkspace } from "../tilesets/TilesetWorkspace";
import { SandboxWorkspace } from "../sandbox/SandboxWorkspace";
import { ImportWorkspace } from "../projects/ImportWorkspace";
import { HelpWorkspace } from "../help/HelpWorkspace";
import { downloadBlob, exportProjectZip, validateProjectForExport } from "../projects/importExport/zip";

export const App = () => {
  const project = useAppStore((state) => state.project);
  const workspace = useAppStore((state) => state.workspace);
  const theme = useAppStore((state) => state.theme);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const persist = useAppStore((state) => state.persist);
  const saveStatus = useAppStore((state) => state.saveStatus);
  const lastSavedAt = useAppStore((state) => state.lastSavedAt);
  const saveError = useAppStore((state) => state.saveError);
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "exported" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const applyTheme = () => {
      const resolved = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themePreference = theme;
    };
    applyTheme();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    useAppStore.getState().refreshProjects();
  }, []);

  useEffect(() => {
    if (!project) return;
    const handle = window.setTimeout(() => void persist(), 650);
    return () => window.clearTimeout(handle);
  }, [project, persist]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const store = useAppStore.getState();
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      if (isTyping && !(event.ctrlKey || event.metaKey)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? store.redo() : store.undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        store.redo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") store.copy();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") store.cut();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") store.paste();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        store.selectAll();
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        store.setZoom(Math.min(80, store.zoom + 4));
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        store.setZoom(Math.max(4, store.zoom - 4));
      }
      if (event.key === "Escape") store.deselect();
      if (event.key === "Delete" || event.key === "Backspace") store.deleteSelection();
      if (event.key.toLowerCase() === "b") store.setTool("pencil");
      if (event.key.toLowerCase() === "e") store.setTool("eraser");
      if (event.key.toLowerCase() === "g") store.setTool("fill");
      if (event.key.toLowerCase() === "i") store.setTool("picker");
      if (event.key.toLowerCase() === "a") store.setTool("spray");
      if (event.key.toLowerCase() === "r") store.setTool("replace");
      if (event.key.toLowerCase() === "l") store.setTool("lighten");
      if (event.key.toLowerCase() === "d") store.setTool("darken");
      if (event.key.toLowerCase() === "m") store.toggleMirrorX();
      if (event.key === "[") store.setBrushSize(Math.max(1, store.brushSize - 1));
      if (event.key === "]") store.setBrushSize(Math.min(12, store.brushSize + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project) return <ProjectLibrary />;

  const exportZip = async () => {
    setExportStatus("exporting");
    setExportError(null);
    try {
      const errors = validateProjectForExport(project);
      if (errors.length) throw new Error(errors.join("\n"));
      await persist();
      const blob = await exportProjectZip(useAppStore.getState().project ?? project);
      downloadBlob(blob, `${project.name.replace(/\s+/g, "-").toLowerCase()}.pixelzip`);
      setExportStatus("exported");
    } catch (error) {
      setExportStatus("error");
      setExportError(error instanceof Error ? error.message : "Export failed");
    }
  };

  const saveLabel =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "saved" && lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : saveStatus === "error"
          ? "Save failed"
          : "Unsaved changes";

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={() => useAppStore.setState({ project: null })} title="Go home">
          <Sparkles size={18} />
          <span>easyPIX</span>
        </button>
        <nav className="workspace-tabs">
          <button className={workspace === "editor" ? "active" : ""} onClick={() => setWorkspace("editor")} title="Draw and edit pixels">
            <Image size={16} /> Draw
          </button>
          <button className={workspace === "import" ? "active" : ""} onClick={() => setWorkspace("import")} title="Import popular pixel art files">
            <Upload size={16} /> Import
          </button>
          <button className={workspace === "animation" ? "active" : ""} onClick={() => setWorkspace("animation")} title="Animation timeline">
            <Play size={16} /> Animate
          </button>
          <button className={workspace === "tileset" ? "active" : ""} onClick={() => setWorkspace("tileset")} title="Tileset previews">
            <Grid3X3 size={16} /> Tile Check
          </button>
          <button className={workspace === "sandbox" ? "active" : ""} onClick={() => setWorkspace("sandbox")} title="Sandbox scene">
            <LayoutGrid size={16} /> Sandbox
          </button>
          <button className={workspace === "help" ? "active" : ""} onClick={() => setWorkspace("help")} title="Manual and beginner help">
            <BookOpen size={16} /> Manual
          </button>
        </nav>
        <div className="topbar-actions">
          <button onClick={() => void persist()} title="Save now">
            <Save size={16} /> Save
          </button>
          <span className={saveStatus === "error" ? "status-pill status-error" : "status-pill"} title={saveError ?? "Local autosave status"}>
            {saveLabel}
          </span>
          <button onClick={() => void exportZip()} disabled={exportStatus === "exporting"} title={exportError ?? "Export project bundle"}>
            <Download size={16} /> {exportStatus === "exporting" ? "Exporting" : "Export"}
          </button>
          {exportStatus === "exported" && <span className="status-pill">Export ready</span>}
          {exportStatus === "error" && <span className="status-pill status-error" title={exportError ?? undefined}>Export failed</span>}
          <select value={theme} onChange={(event) => useAppStore.getState().setTheme(event.target.value as "system" | "light" | "dark")} title="Theme">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <Moon size={16} aria-hidden="true" />
          <button onClick={() => useAppStore.setState({ project: null })} title="Back to projects">
            <FolderOpen size={16} /> Projects
          </button>
        </div>
      </header>
      {workspace === "editor" && <EditorWorkspace />}
      {workspace === "import" && <ImportWorkspace />}
      {workspace === "animation" && <AnimationWorkspace />}
      {workspace === "tileset" && <TilesetWorkspace />}
      {workspace === "sandbox" && <SandboxWorkspace />}
      {workspace === "help" && <HelpWorkspace />}
      <button className="floating-add" onClick={() => useAppStore.getState().addAsset()} title="Add asset">
        <Plus size={20} />
      </button>
    </main>
  );
};

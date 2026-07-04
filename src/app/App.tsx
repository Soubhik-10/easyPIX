import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, FolderOpen, Grid3X3, Image, LayoutGrid, Moon, Palette, Play, Plus, Redo2, Save, Sparkles, Undo2, Upload } from "lucide-react";
import { useAppStore } from "./store";
import { ProjectLibrary } from "../projects/ProjectLibrary";
import { EditorWorkspace } from "../editor/EditorWorkspace";
import { AnimationWorkspace } from "../animation/AnimationWorkspace";
import { TilesetWorkspace } from "../tilesets/TilesetWorkspace";
import { SandboxWorkspace } from "../sandbox/SandboxWorkspace";
import { ImportWorkspace } from "../projects/ImportWorkspace";
import { HelpWorkspace } from "../help/HelpWorkspace";
import { PalettesWorkspace } from "../palettes/PalettesWorkspace";
import { downloadBlob, exportAssetFramePng, exportProjectZip, validateProjectForExport } from "../projects/importExport/zip";

export const App = () => {
  const project = useAppStore((state) => state.project);
  const workspace = useAppStore((state) => state.workspace);
  const theme = useAppStore((state) => state.theme);
  const setWorkspace = useAppStore((state) => state.setWorkspace);
  const persist = useAppStore((state) => state.persist);
  const saveStatus = useAppStore((state) => state.saveStatus);
  const lastSavedAt = useAppStore((state) => state.lastSavedAt);
  const saveError = useAppStore((state) => state.saveError);
  const canUndo = useAppStore((state) => state.history.length > 0);
  const canRedo = useAppStore((state) => state.future.length > 0);
  const activeAssetId = useAppStore((state) => state.activeAssetId);
  const activeFrameId = useAppStore((state) => state.activeFrameId);
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "exported" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const browserBackArmed = useRef(false);

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
    const handle = window.setTimeout(() => void persist(), 350);
    return () => window.clearTimeout(handle);
  }, [project, persist]);

  useEffect(() => {
    if (!project) return;
    const handle = window.setInterval(() => void useAppStore.getState().persist(), 5000);
    return () => window.clearInterval(handle);
  }, [project?.id]);

  useEffect(() => {
    if (!project) return;
    const saveNow = () => {
      const current = useAppStore.getState();
      if (current.project) void current.persist();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      saveNow();
      const current = useAppStore.getState();
      if (!current.project || current.saveStatus === "saved") return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", saveNow);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", saveNow);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [project?.id]);

  useEffect(() => {
    if (!project) {
      browserBackArmed.current = false;
      return;
    }
    if (!browserBackArmed.current) {
      window.history.pushState({ easyPixProjectGuard: true }, "", window.location.href);
      browserBackArmed.current = true;
    }
    const onPopState = () => {
      if (!useAppStore.getState().project) return;
      window.history.pushState({ easyPixProjectGuard: true }, "", window.location.href);
      void useAppStore.getState().persist();
      setLeavePromptOpen(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [project?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const store = useAppStore.getState();
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      const key = event.key.toLowerCase();
      if (isTyping && !(event.ctrlKey || event.metaKey)) return;
      if ((event.ctrlKey || event.metaKey) && (key === "z" || event.code === "KeyZ")) {
        event.preventDefault();
        event.shiftKey ? store.redo() : store.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (key === "y" || event.code === "KeyY")) {
        event.preventDefault();
        store.redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "c") {
        event.preventDefault();
        store.copy();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "x") {
        event.preventDefault();
        store.cut();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "v") {
        event.preventDefault();
        store.paste();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "a") {
        event.preventDefault();
        store.selectAll();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        store.setZoom(Math.min(80, store.zoom + 4));
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        store.setZoom(Math.max(4, store.zoom - 4));
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && store.selection) {
        event.preventDefault();
        const amount = event.shiftKey ? 8 : 1;
        const dx = event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0;
        const dy = event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0;
        store.moveSelection(dx, dy);
        return;
      }
      if (event.key === "Escape") store.deselect();
      if (event.key === "Delete" || event.key === "Backspace") store.deleteSelection();
      if (key === "b") store.setTool("pencil");
      if (key === "e") store.setTool("eraser");
      if (key === "g") store.setTool("fill");
      if (key === "i") store.setTool("picker");
      if (key === "a") store.setTool("spray");
      if (key === "r") store.setTool("replace");
      if (key === "l") store.setTool("lighten");
      if (key === "d") store.setTool("darken");
      if (key === "w") store.setTool("magic");
      if (key === "v") store.setTool("lasso");
      if (key === "o") store.setTool("move");
      if (key === "m") store.toggleMirrorX();
      if (event.key === "[") store.setBrushSize(Math.max(1, store.brushSize - 1));
      if (event.key === "]") store.setBrushSize(Math.min(12, store.brushSize + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project) return <ProjectLibrary />;

  const requestProjectExit = () => {
    void persist();
    setLeavePromptOpen(true);
  };

  const saveAndCloseProject = async () => {
    await persist();
    browserBackArmed.current = false;
    setLeavePromptOpen(false);
    useAppStore.setState({ project: null });
  };

  const activeAsset = project.assets.find((entry) => entry.id === activeAssetId) ?? project.assets[0];
  const activeFrame = activeAsset?.frames.find((entry) => entry.id === activeFrameId) ?? activeAsset?.frames[0];

  const exportActivePng = async () => {
    setExportStatus("exporting");
    setExportError(null);
    try {
      await persist();
      if (!activeAsset || !activeFrame) throw new Error("No active art to export.");
      downloadBlob(exportAssetFramePng(activeAsset, activeFrame.id, 1), `${activeAsset.name}-${activeFrame.name}.png`);
      setExportStatus("exported");
    } catch (error) {
      setExportStatus("error");
      setExportError(error instanceof Error ? error.message : "PNG export failed");
    }
  };

  const exportProjectBundle = async () => {
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
      setExportError(error instanceof Error ? error.message : "Project bundle export failed");
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
        <button className="brand brand-button" onClick={requestProjectExit} title="Go home">
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
          <button className={workspace === "palettes" ? "active" : ""} onClick={() => setWorkspace("palettes")} title="Palette presets and color management">
            <Palette size={16} /> Palettes
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
          <button onClick={() => useAppStore.getState().undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 size={16} /> Undo
          </button>
          <button onClick={() => useAppStore.getState().redo()} disabled={!canRedo} title="Redo (Ctrl+Y)">
            <Redo2 size={16} /> Redo
          </button>
          <button onClick={() => void persist()} title="Save now">
            <Save size={16} /> Save
          </button>
          <span className={saveStatus === "error" ? "status-pill status-error" : "status-pill"} title={saveError ?? "Local autosave status"}>
            {saveLabel}
          </span>
          <button onClick={() => void exportActivePng()} disabled={exportStatus === "exporting"} title={exportError ?? "Export active frame as PNG"}>
            <Download size={16} /> {exportStatus === "exporting" ? "Exporting" : "PNG"}
          </button>
          <button onClick={() => void exportProjectBundle()} disabled={exportStatus === "exporting"} title={exportError ?? "Backup full project as .pixelzip"}>
            <Download size={16} /> Project backup
          </button>
          {exportStatus === "exported" && <span className="status-pill">Export ready</span>}
          {exportStatus === "error" && <span className="status-pill status-error" title={exportError ?? undefined}>Export failed</span>}
          <select value={theme} onChange={(event) => useAppStore.getState().setTheme(event.target.value as "system" | "light" | "dark")} title="Theme">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <Moon size={16} aria-hidden="true" />
          <button onClick={requestProjectExit} title="Back to projects">
            <FolderOpen size={16} /> Projects
          </button>
        </div>
      </header>
      {workspace === "editor" && <EditorWorkspace />}
      {workspace === "import" && <ImportWorkspace />}
      {workspace === "palettes" && <PalettesWorkspace />}
      {workspace === "animation" && <AnimationWorkspace />}
      {workspace === "tileset" && <TilesetWorkspace />}
      {workspace === "sandbox" && <SandboxWorkspace />}
      {workspace === "help" && <HelpWorkspace />}
      <button className="floating-add" onClick={() => useAppStore.getState().addAsset()} title="Add asset">
        <Plus size={20} />
      </button>
      {leavePromptOpen ? (
        <div className="leave-guard" role="dialog" aria-modal="true" aria-labelledby="leave-guard-title">
          <section className="leave-guard-panel">
            <h2 id="leave-guard-title">Save before leaving?</h2>
            <p>
              easyPIX autosaves locally, but your latest strokes may still be saving. Save now before going back to Projects.
            </p>
            <div className="leave-guard-actions">
              <button className="primary-action" onClick={() => void saveAndCloseProject()}>
                <Save size={16} /> Save and go
              </button>
              <button onClick={() => { setLeavePromptOpen(false); void persist(); }}>Stay here</button>
              <button className="danger-action" onClick={() => { browserBackArmed.current = false; setLeavePromptOpen(false); useAppStore.setState({ project: null }); }}>
                Go without saving
              </button>
            </div>
            <span className={saveStatus === "error" ? "status-pill status-error" : "status-pill"}>{saveLabel}</span>
          </section>
        </div>
      ) : null}
    </main>
  );
};

import { ChangeEvent, PointerEvent, useRef, useState } from "react";
import { Eraser, FolderOpen, Grid3X3, HardDrive, Image, Import, LayoutGrid, Moon, Palette, Play, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { useAppStore } from "../app/store";
import { importProjectFile } from "./importExport/zip";
import type { Workspace } from "./types";

const quickStarts: Array<{
  workspace: Workspace;
  title: string;
  description: string;
  icon: typeof Image;
}> = [
  { workspace: "editor", title: "Draw", description: "Create sprites with layers, brushes, selection, and palettes.", icon: Image },
  { workspace: "import", title: "Import", description: "Bring in PNG, Piskel, or Aseprite JSON plus spritesheet PNG.", icon: Upload },
  { workspace: "palettes", title: "Palettes", description: "Browse credited presets, import palettes, export JSON, and manage colors.", icon: Palette },
  { workspace: "tileset", title: "Tile Check", description: "Preview repeated tiles, neighbors, sheets, and seams.", icon: Grid3X3 },
  { workspace: "animation", title: "Animate", description: "Build frame timelines, preview playback, export spritesheets.", icon: Play },
  { workspace: "sandbox", title: "Sandbox", description: "Paint a small scene to see how assets work together.", icon: LayoutGrid },
];

const heroColors = ["#111827", "#ffffff", "#38bdf8", "#22c55e", "#facc15", "#fb7185", "#a855f7", "#f97316"];
const heroSeed = Array.from({ length: 14 * 12 }, (_, index) => {
  const x = index % 14;
  const y = Math.floor(index / 14);
  if (y === 8 && x > 1 && x < 12) return "#22c55e";
  if (y === 7 && x > 3 && x < 10) return "#22c55e";
  if (x > 5 && x < 9 && y > 3 && y < 8) return "#facc15";
  if ((x === 5 || x === 9) && y > 4 && y < 7) return "#fb7185";
  if (x > 5 && x < 9 && y === 3) return "#111827";
  if ((x === 6 || x === 8) && y === 5) return "#111827";
  return "transparent";
});

const HeroPixelPad = () => {
  const [pixels, setPixels] = useState<string[]>(heroSeed);
  const [activeColor, setActiveColor] = useState<string>(heroColors[2]);
  const [isDrawing, setIsDrawing] = useState(false);

  const paint = (index: number) => {
    setPixels((current) => current.map((color, pixelIndex) => (pixelIndex === index ? activeColor : color)));
  };

  const startPaint = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault();
    setIsDrawing(true);
    paint(index);
  };

  return (
    <div className="hero-doodle" aria-label="Mini drawable pixel board">
      <div className="hero-doodle-board">
        {pixels.map((color, index) => (
          <button
            key={index}
            className="hero-doodle-pixel"
            style={{ background: color === "transparent" ? undefined : color }}
            onPointerDown={(event) => startPaint(event, index)}
            onPointerEnter={() => {
              if (isDrawing) paint(index);
            }}
            onPointerUp={() => setIsDrawing(false)}
            onPointerCancel={() => setIsDrawing(false)}
            onPointerLeave={() => {
              if (!isDrawing) setIsDrawing(false);
            }}
            aria-label={`Paint pixel ${index + 1}`}
          />
        ))}
      </div>
      <div className="hero-doodle-tools">
        {heroColors.map((color) => (
          <button
            key={color}
            className={activeColor === color ? "active hero-swatch" : "hero-swatch"}
            style={{ background: color }}
            onClick={() => setActiveColor(color)}
            title={color}
            aria-label={`Use ${color}`}
          />
        ))}
        <button className="hero-clear" onClick={() => setPixels(Array.from({ length: 14 * 12 }, () => "transparent"))}>
          <Eraser size={15} /> Clear
        </button>
      </div>
    </div>
  );
};

export const ProjectLibrary = () => {
  const projects = useAppStore((state) => state.projects);
  const createNewProject = useAppStore((state) => state.createNewProject);
  const openProject = useAppStore((state) => state.openProject);
  const removeProject = useAppStore((state) => state.removeProject);
  const importProject = useAppStore((state) => state.importProject);
  const importProjectFolder = useAppStore((state) => state.importProjectFolder);
  const fileSaveSupported = useAppStore((state) => state.fileSaveSupported);
  const fileSaveError = useAppStore((state) => state.fileSaveError);
  const theme = useAppStore((state) => state.theme);
  const [name, setName] = useState("Untitled Pixel Project");
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const start = async (workspace: Workspace) => {
    await createNewProject(name.trim() || "Untitled Pixel Project");
    useAppStore.getState().setWorkspace(workspace);
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const project = await importProjectFile(file);
      await importProject(project);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Project import failed.");
    } finally {
      event.target.value = "";
    }
  };

  const onImportFolder = async () => {
    setImportError(null);
    await importProjectFolder();
    const latestError = useAppStore.getState().fileSaveError;
    if (latestError) setImportError(latestError);
  };

  return (
    <main className="launcher easypix-home">
      <header className="easypix-hero">
        <nav className="home-nav" aria-label="Home navigation">
          <div className="home-brand">
            <Sparkles size={18} />
            <strong>easyPIX</strong>
          </div>
          <div className="launcher-theme">
            <select value={theme} onChange={(event) => useAppStore.getState().setTheme(event.target.value as "system" | "light" | "dark")} title="Theme">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <Moon size={16} aria-hidden="true" />
          </div>
        </nav>

        <div className="hero-content">
          <section className="hero-copy-block">
            <span className="hero-kicker">Free pixel art tools, local-first</span>
            <h1><span>easy</span><span>PIX</span></h1>
            <p>Draw sprites, import existing art, check tiles, animate frames, and test scenes without paywalls or locked files.</p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => void start("editor")}>
                <Image size={17} /> Start drawing
              </button>
              <button onClick={() => void start("import")}>
                <Upload size={17} /> Import art
              </button>
              <button onClick={() => void start("tileset")}>
                <Grid3X3 size={17} /> Check tiles
              </button>
            </div>
          </section>

          <section className="pixel-showcase">
            <div className="floating-pixels">
              {["#38bdf8", "#22c55e", "#facc15", "#fb7185", "#a855f7", "#f97316"].map((color, index) => (
                <i key={color} style={{ background: color, animationDelay: `${index * 180}ms` }} />
              ))}
            </div>
            <div className="pixel-sun"></div>
            <HeroPixelPad />
            <div className="tiny-pixel-sprite">
              {Array.from({ length: 64 }, (_, index) => (
                <i key={index} className={`sprite-pixel sprite-${(index + Math.floor(index / 8) * 3) % 9}`} />
              ))}
            </div>
            <div className="palette-strip">
              {["#1d4ed8", "#38bdf8", "#22c55e", "#facc15", "#fb7185", "#a855f7", "#111827"].map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
            </div>
          </section>
        </div>
      </header>

      <section className="workflow-ribbon">
        {quickStarts.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.workspace} onClick={() => void start(item.workspace)}>
              <Icon size={18} />
              <strong>{item.title}</strong>
            </button>
          );
        })}
      </section>

      <section className="launcher-main">
        <section className="launcher-left-stack">
          <section className="start-panel">
            <div className="panel-heading">
              <h2><Palette size={16} /> Start a workspace</h2>
            </div>
            <div className="project-name-row">
              <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Project name" />
              <button className="primary-action" onClick={() => void start("editor")}>
                <Plus size={17} /> New
              </button>
              <button onClick={() => inputRef.current?.click()}>
                <Import size={17} /> Import
              </button>
              <button onClick={() => void onImportFolder()} disabled={!fileSaveSupported} title={fileSaveSupported ? "Import an easyPIX folder containing project.json" : "Folder import needs Chrome or Edge desktop"}>
                <HardDrive size={17} /> Folder
              </button>
              <input ref={inputRef} type="file" accept=".pixelzip,.zip,.json,application/json" onChange={onImport} hidden />
            </div>
            {(importError || fileSaveError) && <p className="hint status-error-text">{importError ?? fileSaveError}</p>}
          </section>

          <section className="pixel-garden-panel" aria-label="Tiny pixel garden">
            <div className="pixel-garden-clouds">
              <i />
              <i />
            </div>
            <div className="pixel-garden-pixels">
              {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
            </div>
            <div className="pixel-garden-sky">
              {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
            </div>
            <div className="pixel-garden-ground">
              {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
            </div>
            <div className="pixel-garden-plants">
              {["flower", "sprout", "flower", "grass", "sprout", "flower", "grass"].map((kind, index) => (
                <span key={`${kind}-${index}`} className={`garden-plant ${kind}`} />
              ))}
            </div>
            <div className="pixel-garden-sign" aria-hidden="true" />
            <div className="pixel-garden-tools" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </section>
        </section>

        <aside className="recent-panel">
          <div className="panel-heading">
            <h2>Recent Projects</h2>
            <span>{projects.length}</span>
          </div>
          {projects.length === 0 && (
            <div className="empty-state compact-empty">
              <FolderOpen size={24} />
              <h2>No projects yet</h2>
              <p>Create a project or import a .pixelzip backup or folder-saved project.json.</p>
            </div>
          )}
          <div className="recent-list">
            {projects.map((project) => (
              <article className="recent-project" key={project.id}>
                <button className="recent-open" onClick={() => void openProject(project.id)}>
                  <strong>{project.name}</strong>
                  <span>{project.assets.length} assets · {project.tilesets.length} tilesets · {new Date(project.updatedAt).toLocaleString()}</span>
                </button>
                <button className="icon-danger" onClick={() => void removeProject(project.id)} title="Delete project">
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
};

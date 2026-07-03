import { ChangeEvent, useRef, useState } from "react";
import { FolderOpen, Grid3X3, Image, Import, LayoutGrid, Moon, Palette, Play, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { useAppStore } from "../app/store";
import { importProjectZip } from "./importExport/zip";
import type { Workspace } from "./types";

const quickStarts: Array<{
  workspace: Workspace;
  title: string;
  description: string;
  icon: typeof Image;
}> = [
  { workspace: "editor", title: "Draw", description: "Create sprites with layers, brushes, selection, and palettes.", icon: Image },
  { workspace: "import", title: "Import", description: "Bring in PNG, Piskel, or Aseprite JSON plus spritesheet PNG.", icon: Upload },
  { workspace: "tileset", title: "Tile Check", description: "Preview repeated tiles, neighbors, sheets, and seams.", icon: Grid3X3 },
  { workspace: "animation", title: "Animate", description: "Build frame timelines, preview playback, export spritesheets.", icon: Play },
  { workspace: "sandbox", title: "Sandbox", description: "Paint a small scene to see how assets work together.", icon: LayoutGrid },
];

export const ProjectLibrary = () => {
  const projects = useAppStore((state) => state.projects);
  const createNewProject = useAppStore((state) => state.createNewProject);
  const openProject = useAppStore((state) => state.openProject);
  const removeProject = useAppStore((state) => state.removeProject);
  const importProject = useAppStore((state) => state.importProject);
  const theme = useAppStore((state) => state.theme);
  const [name, setName] = useState("Untitled Pixel Project");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const start = async (workspace: Workspace) => {
    await createNewProject(name.trim() || "Untitled Pixel Project");
    useAppStore.getState().setWorkspace(workspace);
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const project = await importProjectZip(file);
    await importProject(project);
    event.target.value = "";
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

          <section className="pixel-showcase" aria-hidden="true">
            <div className="floating-pixels">
              {["#38bdf8", "#22c55e", "#facc15", "#fb7185", "#a855f7", "#f97316"].map((color, index) => (
                <i key={color} style={{ background: color, animationDelay: `${index * 180}ms` }} />
              ))}
            </div>
            <div className="pixel-sun"></div>
            <div className="pixel-card-art">
              {Array.from({ length: 168 }, (_, index) => (
                <span key={index} className={`art-pixel art-${(index * 5 + Math.floor(index / 14)) % 11}`} />
              ))}
            </div>
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
              <Import size={17} /> Import project
            </button>
            <input ref={inputRef} type="file" accept=".pixelzip,.zip" onChange={onImport} hidden />
          </div>

          <div className="quick-start-list">
            {quickStarts.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.workspace} onClick={() => void start(item.workspace)}>
                  <Icon size={20} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
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
              <p>Create a project or import a .pixelzip bundle.</p>
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

import { type CSSProperties, ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import {
  Boxes,
  CloudRain,
  CloudSun,
  Dice5,
  Eraser,
  FolderOpen,
  Grid3X3,
  HardDrive,
  Image,
  Import,
  LayoutGrid,
  Moon,
  Palette,
  Play,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useAppStore } from "../app/store";
import { renderAsset } from "../editor/canvas/renderers";
import { importProjectFile } from "./importExport/zip";
import type { PixelProject, Workspace } from "./types";

const quickStarts: Array<{
  workspace: Workspace;
  title: string;
  description: string;
  icon: typeof Image;
  tone: string;
}> = [
  { workspace: "studio", title: "Studio", description: "Build characters, effects, UI, and game-ready packs.", icon: Boxes, tone: "blue" },
  { workspace: "editor", title: "Draw", description: "Pixel-perfect brushes, layers, selection, and fixes.", icon: Image, tone: "green" },
  { workspace: "animation", title: "Animate", description: "Frames, motion recipes, timing, and live previews.", icon: Play, tone: "violet" },
  { workspace: "tileset", title: "Tile Check", description: "Repeat tests, terrain sets, neighbors, and seams.", icon: Grid3X3, tone: "yellow" },
  { workspace: "sandbox", title: "Scenes", description: "Compose maps with weather, cameras, and animated art.", icon: LayoutGrid, tone: "pink" },
  { workspace: "palettes", title: "Palettes", description: "Credited color sets, ramps, swaps, and remapping.", icon: Palette, tone: "orange" },
  { workspace: "import", title: "Import", description: "Open PNG, Piskel, Aseprite JSON, or project backups.", icon: Upload, tone: "cyan" },
];

const modePatterns: Record<string, string[]> = {
  studio: ["..BB....", ".BWWB...", "BWPWB...", "BWWWB...", ".BBBB.G.", "...GGGG.", "..GYYG..", "...GG..."],
  editor: ["........", ".KK.....", ".KPP....", "..PPG...", "...GGG..", "..GGGGG.", ".GGGGGG.", "........"],
  animation: ["........", ".KK.KK..", ".KCYKC..", ".KCYKC..", ".KK.KK..", "..V.V...", ".VV.VV..", "........"],
  tileset: ["GGYGGYGG", "GYGGGYGG", "GGGGGGYG", "YGGYGGGG", "GGYGGYGG", "GYGGGYGG", "GGGGGGYG", "YGGYGGGG"],
  sandbox: ["CCCCCCCC", "CWWCCWWC", "CCCCCCCC", "..G.G...", ".GGGGG..", "GGYGGGGG", "GGGGGBBG", "GGGGGBBG"],
  palettes: ["KKWWBBGG", "KKWWBBGG", "YYPPOOVV", "YYPPOOVV", "CCGGBBKK", "CCGGBBKK", "PPOOYYWW", "PPOOYYWW"],
  import: ["........", ".BBBB...", ".BWWB...", ".BWWBBB.", ".BWWBGB.", ".BBBBGB.", "....BBB.", "........"],
};

const modeColors: Record<string, string> = {
  K: "#111827",
  W: "#ffffff",
  B: "#3b82f6",
  C: "#38bdf8",
  G: "#22c55e",
  Y: "#facc15",
  P: "#fb7185",
  V: "#a855f7",
  O: "#f97316",
  ".": "transparent",
};

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

const sparkPrompts = [
  "A machine with a secret",
  "A place just after rain",
  "Something worth guarding",
  "A doorway at midnight",
  "A tiny but serious rival",
  "A useful travelling companion",
  "An object from another world",
  "A forgotten room still running",
];

const ModePixelArt = ({ workspace }: { workspace: Workspace }) => (
  <div className="mode-pixel-art" aria-hidden="true">
    {(modePatterns[workspace] ?? modePatterns.editor).flatMap((row, y) =>
      [...row].map((color, x) => <i key={`${x}-${y}`} style={{ background: modeColors[color] }} />),
    )}
  </div>
);

const ProjectThumb = ({ project }: { project: PixelProject }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const asset = project.assets.find((entry) =>
    entry.layers.some((layer) => layer.pixels.some((pixel) => pixel && pixel !== "transparent"))
    || entry.frames.some((frame) => Object.values(frame.cels ?? {}).some((pixels) => pixels.some((pixel) => pixel && pixel !== "transparent"))),
  ) ?? project.assets[0];
  useEffect(() => {
    if (ref.current && asset) renderAsset(ref.current, asset, Math.max(1, Math.floor(72 / Math.max(asset.width, asset.height))), { grid: false, frameId: asset.frames[0]?.id });
  }, [asset]);
  return asset ? <canvas ref={ref} className="home-project-thumb" /> : <div className="home-project-thumb empty"><Image size={24} /></div>;
};

const relativeTime = (value: string) => {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "recently";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString();
};

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
    <div className="hero-doodle" aria-label="Mini drawable pixel board" onPointerUp={() => setIsDrawing(false)} onPointerLeave={() => setIsDrawing(false)}>
      <div className="hero-doodle-board">
        {pixels.map((color, index) => (
          <button
            key={index}
            className="hero-doodle-pixel"
            style={{ background: color === "transparent" ? undefined : color }}
            onPointerDown={(event) => startPaint(event, index)}
            onPointerEnter={() => { if (isDrawing) paint(index); }}
            aria-label={`Paint pixel ${index + 1}`}
          />
        ))}
      </div>
      <div className="hero-doodle-tools">
        {heroColors.map((color) => (
          <button key={color} className={activeColor === color ? "active hero-swatch" : "hero-swatch"} style={{ background: color }} onClick={() => setActiveColor(color)} title={color} aria-label={`Use ${color}`} />
        ))}
        <button className="hero-clear" onClick={() => setPixels(Array.from({ length: 14 * 12 }, () => "transparent"))}><Eraser size={15} /> Clear</button>
      </div>
    </div>
  );
};

const LivingPixelWorld = () => {
  const [mood, setMood] = useState<"day" | "dusk" | "night" | "rain">("day");
  return (
    <section className={`living-pixel-world mood-${mood}`}>
      <header>
        <div><Sparkles size={16} /><strong>Living scene</strong></div>
        <div className="world-mood-controls" aria-label="Scene mood">
          <button className={mood === "day" ? "active" : ""} onClick={() => setMood("day")} title="Day"><Sun size={15} /></button>
          <button className={mood === "dusk" ? "active" : ""} onClick={() => setMood("dusk")} title="Dusk"><CloudSun size={15} /></button>
          <button className={mood === "night" ? "active" : ""} onClick={() => setMood("night")} title="Night"><Moon size={15} /></button>
          <button className={mood === "rain" ? "active" : ""} onClick={() => setMood("rain")} title="Rain"><CloudRain size={15} /></button>
        </div>
      </header>
      <div className="living-world-stage" aria-hidden="true">
        <div className="world-sun" />
        <div className="world-stars">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
        <div className="world-cloud cloud-one" /><div className="world-cloud cloud-two" />
        <div className="world-mountains"><i /><i /><i /></div>
        <div className="world-water">{Array.from({ length: 14 }, (_, index) => <i key={index} />)}</div>
        <div className="world-ground">{Array.from({ length: 24 }, (_, index) => <i key={index} />)}</div>
        <div className="world-house"><i className="roof" /><i className="wall" /><i className="door" /><i className="window" /></div>
        <div className="world-tree tree-one" /><div className="world-tree tree-two" /><div className="world-tree tree-three" />
        <div className="world-hero"><i className="head" /><i className="body" /><i className="leg left" /><i className="leg right" /></div>
        <div className="world-slime"><i /><i /></div>
        <div className="world-weather">{Array.from({ length: 22 }, (_, index) => <i key={index} />)}</div>
      </div>
    </section>
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
  const [promptIndex, setPromptIndex] = useState(0);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
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

  const visibleProjects = showAllProjects ? projects : projects.slice(0, 8);

  return (
    <main className="launcher easypix-home">
      <header className="easypix-hero">
        <nav className="home-nav" aria-label="Home navigation">
          <div className="home-brand"><Sparkles size={18} /><strong>easyPIX</strong></div>
          <div className="launcher-theme">
            <select value={theme} onChange={(event) => useAppStore.getState().setTheme(event.target.value as "system" | "light" | "dark")} title="Theme">
              <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
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
              <button className="primary-action" onClick={() => void start("editor")}><Image size={17} /> Start drawing</button>
              <button onClick={() => void start("import")}><Upload size={17} /> Import art</button>
              <button onClick={() => void start("tileset")}><Grid3X3 size={17} /> Check tiles</button>
            </div>
          </section>

          <section className="pixel-showcase">
            <div className="floating-pixels">
              {["#38bdf8", "#22c55e", "#facc15", "#fb7185", "#a855f7", "#f97316"].map((color, index) => <i key={color} style={{ background: color, animationDelay: `${index * 180}ms` }} />)}
            </div>
            <div className="pixel-sun" />
            <HeroPixelPad />
            <div className="tiny-pixel-sprite">{Array.from({ length: 64 }, (_, index) => <i key={index} className={`sprite-pixel sprite-${(index + Math.floor(index / 8) * 3) % 9}`} />)}</div>
            <div className="palette-strip">{["#1d4ed8", "#38bdf8", "#22c55e", "#facc15", "#fb7185", "#a855f7", "#111827"].map((color) => <i key={color} style={{ background: color }} />)}</div>
          </section>
        </div>
      </header>

      <section className="home-mode-section">
        <header className="home-section-heading">
          <div><span className="hero-kicker">One project, every tool</span><h2>Choose your way in</h2></div>
          <p>Start anywhere. Your art stays available everywhere.</p>
        </header>
        <div className="workflow-ribbon">
          {quickStarts.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.workspace} className={`mode-card tone-${item.tone}`} style={{ "--mode-index": quickStarts.indexOf(item) } as CSSProperties} onClick={() => void start(item.workspace)}>
                <span className="mode-card-copy"><span className="mode-card-title"><Icon size={17} /><strong>{item.title}</strong></span><small>{item.description}</small></span>
                <ModePixelArt workspace={item.workspace} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="home-creative-dashboard">
        <LivingPixelWorld />

        <section className="home-launch-panel">
          <div className="panel-heading"><div><span className="hero-kicker">Fresh canvas</span><h2>Start something</h2></div><span>32x32</span></div>
          <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Project name" />
          <div className="home-launch-primary">
            <button className="primary-action" onClick={() => void start("editor")}><Plus size={17} /> New drawing</button>
            <button onClick={() => void start("studio")}><Boxes size={17} /> Studio</button>
          </div>
          <div className="home-launch-imports">
            <button onClick={() => inputRef.current?.click()}><Import size={16} /> Project file</button>
            <button onClick={() => void onImportFolder()} disabled={!fileSaveSupported} title={fileSaveSupported ? "Import an easyPIX folder containing project.json" : "Folder import needs Chrome or Edge desktop"}><HardDrive size={16} /> Project folder</button>
            <input ref={inputRef} type="file" accept=".pixelzip,.zip,.json,application/json" onChange={onImport} hidden />
          </div>
          {(importError || fileSaveError) && <p className="hint status-error-text">{importError ?? fileSaveError}</p>}
        </section>

        <section className="home-spark-panel">
          <div className="spark-pixels" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} />)}</div>
          <span className="hero-kicker">Need a direction?</span>
          <h2>{sparkPrompts[promptIndex]}</h2>
          <p>Interpret it as a sprite, place, item, animation, or tiny scene.</p>
          <button onClick={() => setPromptIndex((current) => (current + 1 + Math.floor(Math.random() * (sparkPrompts.length - 1))) % sparkPrompts.length)}><Dice5 size={16} /> Another spark</button>
        </section>
      </section>

      <section className="home-recent-section">
        <header className="home-section-heading recent-heading">
          <div><span className="hero-kicker">Your desk</span><h2>Continue creating</h2></div>
          <div className="recent-heading-actions"><span>{projects.length} local project{projects.length === 1 ? "" : "s"}</span>{projects.length > 8 ? <button onClick={() => setShowAllProjects(!showAllProjects)}>{showAllProjects ? "Show less" : "Show all"}</button> : null}</div>
        </header>
        {projects.length === 0 ? (
          <div className="empty-state home-empty-projects"><FolderOpen size={28} /><h2>Your first project will appear here</h2><p>Create a drawing or import a backup to begin.</p></div>
        ) : (
          <div className="home-project-grid">
            {visibleProjects.map((project) => (
              <article className="home-project-card" key={project.id}>
                <button className="home-project-open" onClick={() => void openProject(project.id)}>
                  <ProjectThumb project={project} />
                  <span className="home-project-info"><strong>{project.name}</strong><small>Edited {relativeTime(project.updatedAt)}</small><span>{project.assets.length} art - {project.assets.reduce((sum, asset) => sum + asset.frames.length, 0)} frames - {project.scenes.length} scenes</span></span>
                </button>
                {pendingDelete === project.id ? (
                  <div className="home-delete-confirm"><strong>Delete?</strong><button className="icon-danger" onClick={() => { void removeProject(project.id); setPendingDelete(null); }}>Yes</button><button onClick={() => setPendingDelete(null)}>No</button></div>
                ) : <button className="home-project-delete icon-danger" onClick={() => setPendingDelete(project.id)} title="Delete project"><Trash2 size={15} /></button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

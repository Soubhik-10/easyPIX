import { BookOpen, Download, Grid3X3, Image, Layers, Paintbrush, Play, Upload } from "lucide-react";

const manualSections = [
  {
    icon: Paintbrush,
    title: "Draw",
    body: "Use Pencil, Eraser, Fill, Picker, shape tools, spray, dither, lighten, darken, and shadow helper. Raise zoom for precision, keep grid on for tile work, and use mirror mode for symmetric sprites.",
  },
  {
    icon: Layers,
    title: "Layers",
    body: "Keep sketch, color, highlight, and shadow on separate layers. Hide layers to compare ideas, lower opacity for guides, duplicate before risky edits, and merge only when you are happy.",
  },
  {
    icon: Image,
    title: "Templates",
    body: "Starter templates create editable 16x16 tiles and sprites. Add one, repaint the colors, copy chunks, then use Tile Check to see if the result repeats cleanly.",
  },
  {
    icon: Upload,
    title: "Import",
    body: "Import PNG, Piskel files, and Aseprite JSON plus spritesheet PNG. Imported art becomes normal assets, so it can be edited, animated, exported, or used as tiles.",
  },
  {
    icon: Grid3X3,
    title: "Tile Check",
    body: "Tilesheet preview shows the set, Repeat preview shows one tile tiled many times, and Neighbor preview reveals edges. Add the active asset to the tileset if it is missing.",
  },
  {
    icon: Play,
    title: "Animate",
    body: "Add or duplicate frames, set duration in milliseconds, preview playback with FPS, and export a spritesheet. Use duplicate frame first, then make small pixel changes.",
  },
  {
    icon: BookOpen,
    title: "Sandbox",
    body: "Paint your current assets into ground, object, and overlay layers to test how sprites, props, paths, water, and shadows look together in a scene.",
  },
  {
    icon: Download,
    title: "Export",
    body: "Export a project as .pixelzip for backup or sharing. Export active PNGs for single sprites, tilesheet PNGs for tile sets, and spritesheets for animations.",
  },
];

export const HelpWorkspace = () => (
  <section className="workspace help-layout">
    <header className="manual-hero">
      <div>
        <p className="hero-kicker">easyPIX Manual</p>
        <h1>Make tiny art without needing to already be an artist.</h1>
      </div>
      <p>
        Start from templates, draw at high zoom, check tiles before exporting, and use Sandbox whenever a sprite looks good alone but strange in a scene.
      </p>
    </header>
    <div className="manual-grid">
      {manualSections.map((section) => {
        const Icon = section.icon;
        return (
          <article className="panel manual-card" key={section.title}>
            <h2>
              <Icon size={17} /> {section.title}
            </h2>
            <p>{section.body}</p>
          </article>
        );
      })}
    </div>
    <section className="panel shortcut-manual">
      <h2>Shortcuts</h2>
      <div className="shortcut-grid">
        <span>Ctrl Z</span><p>Undo</p>
        <span>Ctrl Y</span><p>Redo</p>
        <span>Ctrl C</span><p>Copy selection</p>
        <span>Ctrl X</span><p>Cut selection</p>
        <span>Ctrl V</span><p>Paste</p>
        <span>B/E/G/I</span><p>Pencil, Eraser, Fill, Picker</p>
        <span>A/R/L/D</span><p>Spray, Replace, Lighten, Darken</p>
        <span>[ ]</span><p>Brush size down/up</p>
      </div>
    </section>
  </section>
);

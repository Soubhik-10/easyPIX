import { BookOpen, Boxes, Download, Grid3X3, Image, Layers, Palette, Paintbrush, Play, Sparkles, Upload } from "lucide-react";

const manualSections = [
  {
    icon: Boxes,
    title: "Creative Studio",
    body: "Use the searchable asset library to favorite and tag art, send one asset directly to Draw, Animate, Tile Check, Sandbox, or Palettes, generate characters, effects, and game UI, preview game scale, export engine packs, and restore local snapshots.",
  },
  {
    icon: Paintbrush,
    title: "Draw",
    body: "Use Pencil, Eraser, Fill, Picker, shape tools, spray, dither, lighten, darken, shadow helper, Magic Wand, Lasso, and Move. Select artwork grabs the visible drawing so you can nudge it into place.",
  },
  {
    icon: Image,
    title: "Mobile",
    body: "Use the bottom mobile bar for precision cursor, pan mode, zoom presets, undo/redo, and selection nudging. Long-press the canvas to pick a color, and use two fingers to pinch zoom and pan.",
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
    icon: Palette,
    title: "Palettes",
    body: "Use credited presets like PICO-8, DawnBringer 32, Endesga 32, or a small handheld-style set. Import/export palette JSON, build ramps from one base color, and remap art colors when a sprite needs a new mood.",
  },
  {
    icon: Upload,
    title: "Import",
    body: "Import PNG, Piskel files, and Aseprite JSON plus spritesheet PNG. Imported art becomes normal assets, so it can be edited, animated, exported, or used as tiles.",
  },
  {
    icon: Grid3X3,
    title: "Tile Check",
    body: "Tilesheet preview shows the set, Repeat preview shows one tile tiled many times, and Neighbor preview reveals edges. Smart Terrain Starter creates nine named editable corner, edge, and center tiles from the selected art.",
  },
  {
    icon: Play,
    title: "Animate",
    body: "Add blank frames, project drawings, or duplicate the active frame. Motion Assist creates editable float, bounce, shake, blink, and pulse loops. Preview against a color or live Sandbox scene, then export spritesheets, JSON, or browser-supported MP4/WebM video.",
  },
  {
    icon: Sparkles,
    title: "Live Effects",
    body: "Creative Studio can add adjustable outlines, shadows, and tints without changing the original pixels. These settings remain editable, appear in previews, and are included when the asset is exported.",
  },
  {
    icon: BookOpen,
    title: "Scene Creator",
    body: "Create multiple maps, paint or fill three scene layers, place any project asset, hide layers, flip and rotate cells, resize the world, and clear one layer or everything. Add sky, sunset, night, rain, snow, fireflies, leaves, or embers; animated sprite assets play directly in the scene.",
  },
  {
    icon: Download,
    title: "Save Safety",
    body: "Chrome/Edge desktop users can choose a real project folder. easyPIX writes project.json plus the previous project.backup.json there. Creative Studio also keeps recoverable local snapshots; use Folder import from Home to reopen a protected folder.",
  },
  {
    icon: Download,
    title: "Export",
    body: "PNG is the default export for finished art. Use .pixelzip as a full editable backup, or export Godot, Unity, and web game packs containing still images, spritesheets, tilesets, scenes, pivots, effects, and metadata.",
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
        <span>W/V</span><p>Magic Wand, Lasso</p>
        <span>O</span><p>Move selected pixels</p>
        <span>Arrows</span><p>Nudge selection, Shift for 8px</p>
        <span>[ ]</span><p>Brush size down/up</p>
      </div>
    </section>
  </section>
);

# easyPIX Store Refactor Map

The app still uses `src/app/store.ts` as the live Zustand store. Split it into these slices gradually, one slice per PR/commit, while keeping behavior covered by tests and builds.

Suggested slice boundaries:

- `projectSlice.ts`: project library, create/open/delete/import, persistence flags.
- `drawingSlice.ts`: active tool, brush settings, draw/fill/shape operations.
- `selectionSlice.ts`: selection, lasso/move, copy/cut/paste/flip/rotate.
- `historySlice.ts`: undo/redo and bounded history helpers.
- `paletteSlice.ts`: palette import/export, presets, default palette, remap/ramp tools.
- `animationSlice.ts`: frames, playback, onion skin, frame import/export helpers.
- `tilesetSlice.ts`: tileset membership, tile sizing, tilesheet metadata.
- `sandboxSlice.ts`: scene brush, scene layers, transforms, scene painting.
- `uiSlice.ts`: workspace, theme, zoom, grid, mobile-specific UI state.

Refactor rule: move state and actions only after extracting pure helpers first. The exported `useAppStore` API should remain stable until each UI area is migrated.

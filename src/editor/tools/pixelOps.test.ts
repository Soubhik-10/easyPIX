import { describe, expect, it } from "vitest";
import { adjustColor, clearSelectionPixels, copySelection, ditherBrush, drawBrush, drawLine, flipClipX, floodFill, magicWandSelection, pastePixels, pixelPerfectPoints, replaceColor, resizePixels, rotateClip, setPixel } from "./pixelOps";
import type { PixelLayer } from "../../projects/types";

const blank = (width: number, height: number) => Array.from({ length: width * height }, () => "transparent");

describe("pixel operations", () => {
  it("sets a pixel within bounds", () => {
    const pixels = setPixel(blank(4, 4), 4, 4, 2, 1, "#ffffff");
    expect(pixels[6]).toBe("#ffffff");
  });

  it("flood fills connected transparent pixels", () => {
    let pixels = blank(3, 3);
    pixels = setPixel(pixels, 3, 3, 1, 1, "#000000");
    const filled = floodFill(pixels, 3, 3, 0, 0, "#ff0000");
    expect(filled.filter((color) => color === "#ff0000")).toHaveLength(8);
    expect(filled[4]).toBe("#000000");
  });

  it("ignores fill starts outside the canvas", () => {
    const pixels = ["a", "b", "c", "d"];
    expect(floodFill(pixels, 2, 2, -1, 0, "#ff0000")).toBe(pixels);
  });

  it("draws a diagonal line", () => {
    const pixels = drawLine(blank(3, 3), 3, 3, 0, 0, 2, 2, "#00ff00");
    expect([pixels[0], pixels[4], pixels[8]]).toEqual(["#00ff00", "#00ff00", "#00ff00"]);
  });

  it("draws larger brushes and adjusts colors", () => {
    const pixels = drawBrush(blank(5, 5), 5, 5, 2, 2, "#888888", 3, "square");
    expect(pixels.filter((color) => color === "#888888")).toHaveLength(9);
    expect(adjustColor("#202020", 16)).toBe("#303030");
  });

  it("supports dither, replace, resize, and clear selection", () => {
    const dithered = ditherBrush(blank(5, 5), 5, 5, 2, 2, "#fff", 3, "square");
    expect(dithered.filter((color) => color === "#fff").length).toBeGreaterThan(3);
    expect(replaceColor(["#111", "#222", "#111"], "#111", "#333")).toEqual(["#333", "#222", "#333"]);
    expect(resizePixels(["#111"], 1, 1, 2, 2)).toEqual(["#111", "transparent", "transparent", "transparent"]);
    expect(clearSelectionPixels(["#1", "#2", "#3", "#4"], 2, { x: 0, y: 0, width: 1, height: 2 })).toEqual(["transparent", "#2", "transparent", "#4"]);
  });

  it("copies, flips, rotates, and pastes selected pixels", () => {
    const layer: PixelLayer = {
      id: "layer",
      name: "Layer",
      visible: true,
      opacity: 1,
      pixels: ["#111111", "#222222", "transparent", "transparent"],
    };
    const clip = copySelection(layer, 2, { x: 0, y: 0, width: 2, height: 1 });
    expect(flipClipX(clip).pixels).toEqual(["#222222", "#111111"]);
    expect(rotateClip(clip)).toMatchObject({ width: 1, height: 2 });
    const pasted = pastePixels({ ...layer, pixels: blank(2, 2) }, 2, 2, 0, 1, clip);
    expect(pasted.slice(2, 4)).toEqual(["#111111", "#222222"]);
  });

  it("selects connected same-color pixels with magic wand bounds", () => {
    const pixels = [
      "#111111", "#111111", "transparent",
      "#111111", "transparent", "#222222",
      "transparent", "#222222", "#222222",
    ];
    expect(magicWandSelection(pixels, 3, 3, 0, 0)).toEqual({ x: 0, y: 0, width: 2, height: 2 });
  });

  it("keeps pixel-perfect point cleanup stable", () => {
    const points = pixelPerfectPoints([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 1, y: 1 });
  });
});

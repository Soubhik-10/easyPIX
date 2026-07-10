import { describe, expect, it } from "vitest";
import { buildMotionFrames } from "./motionRecipes";
import { createAsset } from "../projects/factory";

describe("motion recipes", () => {
  it("creates six editable frames without mutating the source", () => {
    const asset = createAsset("Dot", 8, 8);
    const layer = asset.layers[0];
    const pixels = [...layer.pixels];
    pixels[4 * 8 + 4] = "#ffffff";
    asset.frames[0].cels = { [layer.id]: pixels };
    const before = JSON.stringify(asset);
    const frames = buildMotionFrames(asset, asset.frames[0].id, "bounce");
    expect(frames).toHaveLength(6);
    expect(frames.some((frame) => frame.cels?.[layer.id][2 * 8 + 4] === "#ffffff")).toBe(true);
    expect(JSON.stringify(asset)).toBe(before);
  });

  it("creates transparent flash frames for blink", () => {
    const asset = createAsset("Flash", 4, 4);
    asset.frames[0].cels = { [asset.layers[0].id]: Array(16).fill("#fff") };
    const frames = buildMotionFrames(asset, asset.frames[0].id, "blink");
    expect(frames[2].cels?.[asset.layers[0].id].every((pixel) => pixel === "transparent")).toBe(true);
  });
});

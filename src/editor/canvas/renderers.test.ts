import { describe, expect, it } from "vitest";
import { layersForFrame } from "./renderers";
import type { PixelAsset } from "../../projects/types";

const asset: PixelAsset = {
  id: "asset",
  name: "Anim",
  width: 1,
  height: 1,
  layers: [
    {
      id: "ink",
      name: "Ink",
      visible: true,
      opacity: 1,
      pixels: ["#111111"],
    },
  ],
  frames: [
    {
      id: "frame-1",
      name: "Frame 1",
      durationMs: 160,
      layerIds: ["ink"],
      cels: { ink: ["#222222"] },
    },
    {
      id: "frame-2",
      name: "Frame 2",
      durationMs: 160,
      layerIds: ["ink"],
      cels: { ink: ["#333333"] },
    },
  ],
};

describe("animation frame cels", () => {
  it("returns frame-specific layer pixels", () => {
    expect(layersForFrame(asset, "frame-1")[0].pixels).toEqual(["#222222"]);
    expect(layersForFrame(asset, "frame-2")[0].pixels).toEqual(["#333333"]);
  });

  it("falls back to layer pixels for older projects without cels", () => {
    expect(layersForFrame({ ...asset, frames: [{ ...asset.frames[0], cels: undefined }] }, "frame-1")[0].pixels).toEqual(["#111111"]);
  });
});

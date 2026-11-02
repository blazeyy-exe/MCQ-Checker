import assert from "node:assert/strict";
import test from "node:test";
import { detectDocument } from "../src/vision/documentDetector.ts";

function image(width, height, background, paper) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const insidePaper =
        paper &&
        x >= paper.left &&
        x < paper.right &&
        y >= paper.top &&
        y < paper.bottom;
      const value = insidePaper ? 245 : background;
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

test("detects an inset paper boundary from a captured frame", () => {
  const result = detectDocument(image(240, 320, 55, {
    left: 24,
    top: 28,
    right: 216,
    bottom: 292,
  }));

  assert.equal(result.found, true, JSON.stringify(result));
  assert.ok(result.quad);
  assert.ok(result.coverage > 0.6 && result.coverage < 0.9);
});

test("rejects a frame with no paper and a frame with no visible paper edges", () => {
  assert.equal(detectDocument(image(240, 320, 128)).found, false);
  const fullFrame = detectDocument(image(240, 320, 245));
  assert.equal(fullFrame.found, false);
  assert.match(fullFrame.message, /visible margin|entire paper/i, JSON.stringify(fullFrame));
});

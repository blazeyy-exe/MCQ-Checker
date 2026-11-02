import assert from "node:assert/strict";
import test from "node:test";
import {
  correctedPageToFrame,
  frameToPreview,
  orientPaperQuad,
  previewCanvasSize,
  projectPageRectCenter,
} from "../src/vision/arCoordinates.ts";

test("projects corrected-page coordinates through a perspective warp to camera pixels", () => {
  const quad = {
    tl: { x: 100, y: 60 },
    tr: { x: 520, y: 100 },
    br: { x: 480, y: 700 },
    bl: { x: 80, y: 650 },
  };
  assert.deepEqual(correctedPageToFrame({ x: 0, y: 0 }, quad, 400, 600), quad.tl);
  const bottomRight = correctedPageToFrame({ x: 399, y: 599 }, quad, 400, 600);
  assert.ok(Math.abs(bottomRight.x - quad.br.x) < 1e-8);
  assert.ok(Math.abs(bottomRight.y - quad.br.y) < 1e-8);
  const center = correctedPageToFrame({ x: 199.5, y: 299.5 }, quad, 400, 600);
  assert.ok(center.x > 250 && center.x < 350);
  assert.ok(center.y > 300 && center.y < 450);
});

test("keeps live orientation consistent with landscape-to-portrait recognition warping", () => {
  const landscapeQuad = {
    tl: { x: 20, y: 30 },
    tr: { x: 620, y: 50 },
    br: { x: 600, y: 420 },
    bl: { x: 10, y: 400 },
  };
  assert.deepEqual(orientPaperQuad(landscapeQuad), {
    tl: landscapeQuad.tr,
    tr: landscapeQuad.br,
    br: landscapeQuad.bl,
    bl: landscapeQuad.tl,
  });
});

test("maps object-fit cover cropping and optional horizontal mirroring into preview CSS pixels", () => {
  const metrics = {
    sourceWidth: 1920,
    sourceHeight: 1080,
    previewWidth: 360,
    previewHeight: 480,
  };
  assert.deepEqual(frameToPreview({ x: 960, y: 540 }, metrics), { x: 180, y: 240 });
  const leftEdge = frameToPreview({ x: 0, y: 540 }, metrics);
  assert.ok(Math.abs(leftEdge.x + 246.66666666666666) < 1e-8);
  const mirrored = frameToPreview({ x: 0, y: 540 }, { ...metrics, mirrored: true });
  assert.ok(Math.abs(mirrored.x - 606.6666666666667) < 1e-8);
  assert.equal(mirrored.y, 240);
});

test("uses device pixel ratio only for the canvas backing resolution", () => {
  assert.deepEqual(previewCanvasSize(360, 480, 2), { width: 720, height: 960 });
  assert.deepEqual(previewCanvasSize(360, 480, 1), { width: 360, height: 480 });
});

test("combines perspective projection with display cropping for a grading region", () => {
  const projected = projectPageRectCenter(
    { x: 40, y: 50, width: 20, height: 20 },
    {
      tl: { x: 100, y: 100 },
      tr: { x: 500, y: 100 },
      br: { x: 500, y: 700 },
      bl: { x: 100, y: 700 },
    },
    400,
    600,
    { sourceWidth: 600, sourceHeight: 800, previewWidth: 300, previewHeight: 400 },
  );
  assert.ok(projected.x > 70 && projected.x < 80);
  assert.ok(projected.y > 70 && projected.y < 90);
});

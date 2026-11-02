import assert from "node:assert/strict";
import test from "node:test";
import { updateTrackingSnapshot } from "../src/vision/paperTracker.ts";
import { PaperFrameTracker } from "../src/vision/paperTracker.ts";
import { startFrameLoop } from "../src/vision/frameLoop.ts";

const quad = {
  tl: { x: 20, y: 30 },
  tr: { x: 220, y: 35 },
  br: { x: 210, y: 300 },
  bl: { x: 25, y: 295 },
};

function snapshot(overrides = {}) {
  return {
    found: false,
    quad: null,
    method: null,
    sharpness: 0,
    state: "lost",
    sourceWidth: 0,
    sourceHeight: 0,
    timestamp: 0,
    ...overrides,
  };
}

test("clears tracking immediately on loss and reports reacquisition as a fresh state", () => {
  const acquired = updateTrackingSnapshot(
    snapshot(),
    { found: true, quad, method: "detector", sharpness: 80 },
    240,
    320,
    100,
  );
  assert.equal(acquired.state, "acquired");
  assert.equal(acquired.event, undefined);
  const lost = updateTrackingSnapshot(
    acquired,
    { found: false, quad: null, method: null, sharpness: 0, reason: "Paper not detected." },
    240,
    320,
    120,
  );
  assert.equal(lost.found, false);
  assert.equal(lost.quad, null);
  assert.equal(lost.event, "lost");
  const recovered = updateTrackingSnapshot(
    lost,
    { found: true, quad, method: "detector", sharpness: 80 },
    240,
    320,
    180,
  );
  assert.equal(recovered.event, "reacquired");
});

test("rejects low-quality optical flow and smooths acceptable corner movement", () => {
  const acquired = updateTrackingSnapshot(
    snapshot(),
    { found: true, quad, method: "detector", sharpness: 80 },
    240,
    320,
    100,
  );
  const lowQuality = updateTrackingSnapshot(
    acquired,
    {
      found: true,
      quad,
      method: "optical-flow",
      sharpness: 80,
      inliers: 5,
      inlierRatio: 0.9,
    },
    240,
    320,
    120,
  );
  assert.equal(lowQuality.found, false);
  const moved = {
    ...quad,
    tl: { x: 30, y: 40 },
  };
  const smoothed = updateTrackingSnapshot(
    acquired,
    {
      found: true,
      quad: moved,
      method: "optical-flow",
      sharpness: 80,
      inliers: 20,
      inlierRatio: 0.8,
    },
    240,
    320,
    140,
  );
  assert.equal(smoothed.state, "tracked");
  assert.equal(smoothed.quad.tl.x, 27.2);
  assert.equal(smoothed.quad.tl.y, 37.2);
});

test("cancels the scheduled camera frame callback during scanner cleanup", () => {
  let nextHandle = 0;
  const scheduled = new Map();
  const cancelled = [];
  let frames = 0;
  const schedule = (callback) => {
    const handle = ++nextHandle;
    scheduled.set(handle, callback);
    return handle;
  };
  const cancel = (handle) => {
    cancelled.push(handle);
    scheduled.delete(handle);
  };
  const dispose = startFrameLoop(schedule, cancel, () => { frames++; });
  const [handle, callback] = [...scheduled.entries()][0];
  scheduled.delete(handle);
  callback(16);
  assert.equal(frames, 1);
  assert.equal(scheduled.size, 1);
  dispose();
  assert.equal(scheduled.size, 0);
  assert.equal(cancelled.length, 1);
  assert.equal(frames, 1);
});

test("releases retained OpenCV frame memory when the tracker is disposed", () => {
  let liveMats = 0;
  class FakeMat {
    rows = 0;
    cols = 0;
    data = new Uint8Array();
    data32F = new Float32Array();
    data32S = new Int32Array();
    constructor() { liveMats++; }
    delete() { liveMats--; }
    clone() { return new FakeMat(); }
  }
  class FakeMatVector {
    constructor() { liveMats++; }
    size() { return 0; }
    delete() { liveMats--; }
  }
  const cv = {
    Mat: FakeMat,
    MatVector: FakeMatVector,
    Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    COLOR_RGBA2GRAY: 1,
    RETR_LIST: 1,
    CHAIN_APPROX_SIMPLE: 1,
    MORPH_RECT: 1,
    matFromImageData: () => new FakeMat(),
    cvtColor: () => {},
    GaussianBlur: () => {},
    Canny: () => {},
    dilate: () => {},
    findContours: () => {},
    getStructuringElement: () => new FakeMat(),
  };
  const width = 120;
  const height = 160;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = x > 10 && x < 110 && y > 10 && y < 150
        ? ((x + y) % 8 < 2 ? 40 : 245)
        : 35;
      const index = (y * width + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  const tracker = new PaperFrameTracker();
  const observation = tracker.update({ width, height, data }, cv);
  assert.equal(observation.found, true);
  assert.ok(liveMats > 0);
  tracker.dispose();
  assert.equal(liveMats, 0);
});

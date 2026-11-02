import assert from "node:assert/strict";
import test from "node:test";
import { layoutFromQuestions } from "../src/vision/layoutFromRecognition.ts";

test("saves option label bounds so a reusable layout scores circles at the printed labels", () => {
  const layout = layoutFromQuestions([{
    number: 1,
    box: { x: 10, y: 10, width: 180, height: 100 },
    options: [{
      label: "A",
      labelBox: { x: 25, y: 60, width: 12, height: 15 },
      box: { x: 45, y: 60, width: 100, height: 15 },
      markScore: 0,
      ringInk: 0,
      interiorInk: 0,
      gutterInk: 0,
    }],
    selected: [],
    status: "unanswered",
    confidence: "medium",
  }], 200, 200, "key-1", false);

  assert.deepEqual(layout.questions[0].options[0].box, {
    x: 0.125,
    y: 0.3,
    w: 0.06,
    h: 0.075,
  });
});

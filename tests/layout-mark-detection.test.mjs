import assert from "node:assert/strict";
import test from "node:test";
import { applyLayout } from "../src/grading/layoutMarkDetector.ts";

test("keeps answers from an unconfirmed saved layout unresolved", () => {
  const layout = {
    id: "layout-1",
    answerKeyId: "key-1",
    name: "Detected layout",
    pageAspect: 1.5,
    columns: 1,
    confirmed: false,
    createdAt: 1,
    questions: [{
      number: 1,
      questionBox: { x: 0.1, y: 0.1, w: 0.8, h: 0.3 },
      numberBox: { x: 0.1, y: 0.1, w: 0.05, h: 0.05 },
      options: ["A", "B", "C", "D"].map((label, index) => ({
        label,
        box: { x: 0.1 + index * 0.2, y: 0.2, w: 0.05, h: 0.05 },
      })),
    }],
  };
  const questions = applyLayout(layout, new Uint8Array(100 * 100).fill(245), 100, 100);

  assert.equal(questions[0].status, "uncertain");
  assert.ok(questions[0].uncertaintyReasons?.includes("Saved layout has not been confirmed by a teacher."));
});

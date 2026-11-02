import assert from "node:assert/strict";
import test from "node:test";
import { gradingMarkers, projectGradingMarkers, shouldShowGradingOverlay } from "../src/vision/liveOverlay.ts";

function resultWith(question, issues = []) {
  return {
    verified: false,
    questions: [question],
    debug: {
      paperQuad: {
        tl: { x: 10, y: 10 },
        tr: { x: 410, y: 10 },
        br: { x: 410, y: 610 },
        bl: { x: 10, y: 610 },
      },
      pageWidth: 400,
      pageHeight: 600,
      issues,
    },
  };
}

function question(status, overrides = {}) {
  const optionBoxes = ["A", "B", "C", "D"].map((label, index) => ({
    label,
    labelBox: { x: 30 + index * 80, y: 80, width: 20, height: 20 },
    box: { x: 30 + index * 80, y: 80, width: 50, height: 20 },
  }));
  return {
    number: 2,
    keyAnswer: "B",
    detectedAnswers: status === "multiple" ? ["A", "B"] : ["B"],
    effectiveAnswer: "B",
    status,
    confidence: status === "correct" || status === "incorrect" ? "high" : "low",
    optionBoxes,
    box: { x: 20, y: 50, width: 300, height: 100 },
    ...overrides,
  };
}

test("only projects high-confidence grading or recognized unresolved states for a confirmed key", () => {
  const result = resultWith(question("correct"));
  assert.equal(gradingMarkers(result, true)[0].color, "green");
  assert.deepEqual(gradingMarkers(result, false), []);
  assert.deepEqual(gradingMarkers(resultWith(question("correct", { confidence: "low" })), true), []);
  assert.equal(gradingMarkers(resultWith(question("unanswered")), true)[0].color, "blue");
  assert.equal(gradingMarkers(resultWith(question("multiple")), true)[0].color, "orange");
});

test("withholds every marker when the saved paper layout is not confirmed", () => {
  assert.deepEqual(
    gradingMarkers(resultWith(question("correct"), [{ code: "unconfirmed_layout" }]), true),
    [],
  );
});

test("clears stale or lost overlays and permits a fresh reacquired tracking snapshot", () => {
  const result = resultWith(question("correct"));
  const tracking = {
    found: true,
    quad: {
      tl: { x: 10, y: 10 },
      tr: { x: 410, y: 10 },
      br: { x: 410, y: 610 },
      bl: { x: 10, y: 610 },
    },
    timestamp: 100,
  };
  assert.equal(shouldShowGradingOverlay(result, true, tracking, 200), true);
  assert.equal(shouldShowGradingOverlay(result, true, tracking, 451), false);
  assert.equal(shouldShowGradingOverlay(result, true, { ...tracking, found: false, quad: null }, 200), false);
  assert.equal(shouldShowGradingOverlay(result, true, { ...tracking, timestamp: 500 }, 520), true);
});

test("maps marker points through the current paper perspective and preview cropping", () => {
  const result = resultWith(question("incorrect"));
  const markers = projectGradingMarkers(
    result,
    true,
    {
      tl: { x: 100, y: 50 },
      tr: { x: 500, y: 80 },
      br: { x: 460, y: 700 },
      bl: { x: 80, y: 680 },
    },
    {
      sourceWidth: 600,
      sourceHeight: 800,
      previewWidth: 300,
      previewHeight: 400,
      devicePixelRatio: 2,
    },
  );
  assert.equal(markers.length, 1);
  assert.equal(markers[0].color, "red");
  assert.ok(Number.isFinite(markers[0].point.x));
  assert.ok(Number.isFinite(markers[0].point.y));
});

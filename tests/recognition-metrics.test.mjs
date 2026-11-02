import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRecognitionCases, parseGroundTruth } from "../src/evaluation/recognitionMetrics.ts";

function detected(number, status, selected, recognizedOptions = ["A", "B", "C", "D"]) {
  return {
    number,
    status,
    selected,
    recognizedOptions,
    options: recognizedOptions.map((label) => ({ label })),
  };
}

test("parses explicit ground truth answers, blanks, multiple marks, and uncertainty", () => {
  assert.deepEqual(parseGroundTruth("1:B, 2:blank, 3:A+C, 4:?"), [
    { number: 1, selected: ["B"], status: "selected" },
    { number: 2, selected: [], status: "unanswered" },
    { number: 3, selected: ["A", "C"], status: "multiple" },
    { number: 4, selected: [], status: "uncertain" },
  ]);
  assert.throws(() => parseGroundTruth("1:B, 1:C"), /repeated/);
});

test("measures question, option, answer, blank, multiple, false-positive, and false-negative results", () => {
  const metrics = evaluateRecognitionCases([{
    filename: "sample-page.jpg",
    groundTruth: [
      { number: 1, selected: ["B"], status: "selected" },
      { number: 2, selected: [], status: "unanswered" },
      { number: 3, selected: ["A", "D"], status: "multiple" },
      { number: 4, selected: ["C"], status: "selected" },
    ],
    recognition: {
      processingMs: 980,
      questions: [
        detected(1, "selected", ["B"]),
        detected(2, "unanswered", []),
        detected(3, "multiple", ["A", "C"]),
        detected(5, "selected", ["D"], ["A", "B", "D"]),
      ],
    },
  }]);

  assert.deepEqual(metrics, {
    cases: 1,
    expectedQuestions: 4,
    detectedQuestions: 3,
    questionDetectionAccuracy: 75,
    expectedOptionLabels: 16,
    recognizedOptionLabels: 12,
    optionAssociationAccuracy: 75,
    exactAnswerAccuracy: 50,
    unansweredQuestions: 1,
    unansweredDetectionAccuracy: 100,
    multipleQuestions: 1,
    multipleDetectionAccuracy: 100,
    falsePositiveSelections: 1,
    falseNegativeSelections: 2,
    averageProcessingMs: 980,
  });
});

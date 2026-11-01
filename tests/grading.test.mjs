import assert from "node:assert/strict";
import test from "node:test";
import { applyOverride, buildResult, summarize } from "../src/grading/gradingEngine.ts";

function question({
  number,
  keyAnswer,
  detectedAnswers,
  status,
  confidence = "high",
}) {
  return {
    number,
    keyAnswer,
    detectedAnswers,
    effectiveAnswer:
      status === "correct" || status === "incorrect" ? detectedAnswers[0] ?? null : null,
    status,
    confidence,
    detectedStatus: status,
    detectedConfidence: confidence,
    optionBoxes: [],
    box: { x: 20, y: number * 60, width: 300, height: 40 },
  };
}

test("scores correct, incorrect, and blank answers", () => {
  const result = summarize([
    question({ number: 1, keyAnswer: "B", detectedAnswers: ["B"], status: "correct" }),
    question({ number: 2, keyAnswer: "C", detectedAnswers: ["A"], status: "incorrect" }),
    question({ number: 3, keyAnswer: "D", detectedAnswers: [], status: "unanswered" }),
  ]);

  assert.deepEqual(
    {
      total: result.total,
      correct: result.correct,
      incorrect: result.incorrect,
      unanswered: result.unanswered,
      score: result.score,
      percentage: result.percentage,
      verified: result.verified,
    },
    { total: 3, correct: 1, incorrect: 1, unanswered: 1, score: 1, percentage: 33.3, verified: true },
  );
});

test("does not verify multiple, uncertain, missing, or unset-key answers", () => {
  const result = summarize([
    question({ number: 1, keyAnswer: "B", detectedAnswers: ["B"], status: "correct" }),
    question({ number: 2, keyAnswer: "C", detectedAnswers: ["A", "C"], status: "multiple" }),
    question({ number: 3, keyAnswer: "D", detectedAnswers: ["D"], status: "uncertain", confidence: "low" }),
    question({ number: 4, keyAnswer: "A", detectedAnswers: [], status: "missing", confidence: "low" }),
    question({ number: 5, keyAnswer: null, detectedAnswers: ["A"], status: "uncertain", confidence: "low" }),
  ]);

  assert.equal(result.multiple, 1);
  assert.equal(result.uncertain, 2);
  assert.equal(result.missing, 1);
  assert.equal(result.verified, false);
  assert.equal(summarize([]).verified, false);
});

test("does not verify a graded status that still carries low confidence", () => {
  const result = summarize([
    question({
      number: 1,
      keyAnswer: "B",
      detectedAnswers: ["A"],
      status: "incorrect",
      confidence: "low",
    }),
  ]);
  assert.equal(result.verified, false);
});

test("restores original multiple/uncertain detection after applying and clearing overrides", () => {
  const multiple = question({
    number: 1,
    keyAnswer: "B",
    detectedAnswers: ["B", "D"],
    status: "multiple",
    confidence: "medium",
  });
  const uncertain = question({
    number: 2,
    keyAnswer: "A",
    detectedAnswers: ["D"],
    status: "uncertain",
    confidence: "low",
  });
  const overridden = applyOverride([multiple, uncertain], 1, "B");
  const corrected = applyOverride(overridden, 2, "A");
  assert.equal(corrected[0].status, "correct");
  assert.equal(corrected[1].status, "correct");

  const reset = applyOverride(applyOverride(corrected, 1, undefined), 2, undefined);
  assert.deepEqual(
    reset.map(({ status, effectiveAnswer, confidence }) => ({ status, effectiveAnswer, confidence })),
    [
      { status: "multiple", effectiveAnswer: null, confidence: "medium" },
      { status: "uncertain", effectiveAnswer: null, confidence: "low" },
    ],
  );
  assert.equal(buildResult({
    id: "result",
    sessionId: "session",
    answerKeyId: "key",
    studentLabel: "",
    createdAt: 1,
    questions: reset,
    originalDataUrl: "",
    warpedDataUrl: "",
    annotatedDataUrl: "",
    ocrText: "",
    warnings: [],
    processingMs: 1,
    usedLayout: false,
  }).verified, false);
});

test("a teacher-confirmed blank is resolved but an unset answer key is not", () => {
  const resolvedBlank = applyOverride([
    question({ number: 1, keyAnswer: "C", detectedAnswers: ["A"], status: "incorrect" }),
  ], 1, "unanswered");
  assert.equal(summarize(resolvedBlank).verified, true);

  const unsetKey = question({
    number: 1,
    keyAnswer: null,
    detectedAnswers: ["A"],
    status: "uncertain",
    confidence: "low",
  });
  assert.equal(summarize([unsetKey]).verified, false);
});

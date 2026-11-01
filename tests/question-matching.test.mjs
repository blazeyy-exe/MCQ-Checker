import assert from "node:assert/strict";
import test from "node:test";
import { matchQuestions } from "../src/grading/questionMatcher.ts";

const labels = ["A", "B", "C", "D"];

function makeKey(answers, questionTexts = []) {
  return {
    id: "key-fixture",
    name: "Science mid-term",
    subject: "Science",
    className: "8A",
    questionCount: answers.length,
    options: labels,
    items: answers.map((answer, index) => ({
      number: index + 1,
      answer,
      questionText: questionTexts[index],
      confidence: answer ? "high" : "low",
      needsReview: answer === null,
    })),
    source: "manual",
    createdAt: 1,
    updatedAt: 1,
  };
}

function detectedQuestion({
  number,
  selected,
  status = selected.length > 1 ? "multiple" : selected.length === 0 ? "unanswered" : "selected",
  confidence = "high",
  questionText,
}) {
  return {
    number,
    questionText,
    box: { x: 30, y: number * 100, width: 500, height: 80 },
    options: labels.map((label, index) => ({
      label,
      box: { x: 50 + index * 80, y: number * 100 + 50, width: 60, height: 24 },
      markScore: selected.includes(label) ? 0.32 : 0.01,
      ringInk: 0,
      interiorInk: selected.includes(label) ? 0.4 : 0,
      gutterInk: 0,
    })),
    selected,
    status,
    confidence,
  };
}

test("matches numbered questions and grades correct, incorrect, and blank responses", () => {
  const key = makeKey(["B", "C", "D"]);
  const detected = [
    detectedQuestion({ number: 1, selected: ["B"] }),
    detectedQuestion({ number: 2, selected: ["A"] }),
    detectedQuestion({ number: 3, selected: [] }),
  ];

  const result = matchQuestions(key, detected);

  assert.deepEqual(result.map((question) => question.status), ["correct", "incorrect", "unanswered"]);
  assert.deepEqual(result.map((question) => question.effectiveAnswer), ["B", "A", null]);
  assert.equal(result[0].optionBoxes[1].label, "B");
});

test("matches a renumbered question by text", () => {
  const key = makeKey(["C"], ["Which planet is known as the red planet?"]);
  const detected = detectedQuestion({
    number: 7,
    selected: ["C"],
    questionText: "Which planet is known as the red planet?",
  });

  const [result] = matchQuestions(key, [detected]);

  assert.equal(result.number, 1);
  assert.equal(result.status, "correct");
  assert.deepEqual(result.optionBoxes, detected.options);
  assert.deepEqual(result.box, detected.box);
});

test("multiple, medium/low-confidence, and unset-key answers remain unresolved", () => {
  const key = makeKey(["B", "A", "D", null]);
  const detected = [
    detectedQuestion({ number: 1, selected: ["A", "B"] }),
    detectedQuestion({ number: 2, selected: ["D"], confidence: "medium" }),
    detectedQuestion({ number: 3, selected: ["D"], confidence: "low" }),
    detectedQuestion({ number: 4, selected: ["C"] }),
  ];

  const result = matchQuestions(key, detected);

  assert.deepEqual(result.map((question) => question.status), [
    "multiple",
    "uncertain",
    "uncertain",
    "uncertain",
  ]);
  assert.equal(result[3].effectiveAnswer, null);
});

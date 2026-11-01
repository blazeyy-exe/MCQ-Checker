import assert from "node:assert/strict";
import test from "node:test";
import {
  areAnswerKeyItemsComplete,
  assertAnswerKeyComplete,
  blankItems,
  createManualKey,
  isAnswerKeyComplete,
  parseBulkAnswers,
} from "../src/grading/answerKeyModel.ts";

test("new answer-key questions are unset until an answer is selected", () => {
  const items = blankItems(3);

  assert.deepEqual(items.map((item) => item.answer), [null, null, null]);
  assert.ok(items.every((item) => item.needsReview));
  assert.equal(areAnswerKeyItemsComplete(items, 3), false);
  assert.equal(areAnswerKeyItemsComplete([], 0), false);
});

test("every extracted answer must be deliberately confirmed", () => {
  const extracted = [
    { number: 1, answer: "B", confidence: "medium", needsReview: true },
    { number: 2, answer: null, confidence: "low", needsReview: true },
  ];
  assert.equal(areAnswerKeyItemsComplete(extracted, 2), false);

  const confirmed = extracted.map((item, index) => ({
    ...item,
    answer: index === 0 ? "B" : "D",
    confidence: "high",
    needsReview: false,
  }));
  assert.equal(areAnswerKeyItemsComplete(confirmed, 2), true);
  assert.equal(areAnswerKeyItemsComplete(confirmed.slice(0, 1), 2), false);
});

test("bulk entry preserves intentionally blank positions instead of shifting answers", () => {
  assert.deepEqual(parseBulkAnswers("A, ,C;D"), ["A", null, "C", "D"]);
  assert.deepEqual(parseBulkAnswers("ABCD"), ["A", "B", "C", "D"]);
  assert.deepEqual(parseBulkAnswers(""), []);
});

test("manual keys preserve missing answers and cannot pass the persistence guard", () => {
  const key = createManualKey({
    name: "Science mid-term",
    subject: "Science",
    className: "8A",
    answers: ["B", null],
  });

  assert.deepEqual(key.items.map((item) => item.answer), ["B", null]);
  assert.equal(key.items[1].needsReview, true);
  assert.equal(isAnswerKeyComplete(key), false);
  assert.throws(
    () => assertAnswerKeyComplete(key),
    { message: "Confirm an answer for every question before saving this answer key." },
  );
});

test("a complete answer set is still unusable until the teacher confirms the whole key", () => {
  const key = createManualKey({
    name: "Science mid-term",
    subject: "Science",
    className: "8A",
    answers: ["B", "D"],
  });

  assert.equal(areAnswerKeyItemsComplete(key.items, key.questionCount), true);
  assert.equal(isAnswerKeyComplete(key), false);
  assert.throws(() => assertAnswerKeyComplete(key));

  const confirmedKey = { ...key, confirmed: true };
  assert.equal(isAnswerKeyComplete(confirmedKey), true);
  assert.doesNotThrow(() => assertAnswerKeyComplete(confirmedKey));
  assert.equal(isAnswerKeyComplete({ ...confirmedKey, confirmed: undefined }), false);
});

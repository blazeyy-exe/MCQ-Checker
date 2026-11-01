import assert from "node:assert/strict";
import test from "node:test";
import { attachMarks, parseQuestionsFromLines, wordsToLines } from "../src/ocr/questionParser.ts";

function word(text, x, y, width = Math.max(12, text.length * 8)) {
  return { text, confidence: 91, bbox: { x, y, width, height: 16 } };
}

const paperWords = [
  word("1.", 40, 50), word("Which", 62, 50), word("planet", 112, 50), word("is", 160, 50),
  word("known", 180, 50), word("as", 229, 50), word("the", 250, 50), word("red", 279, 50),
  word("planet?", 308, 50), word("A.", 48, 82), word("Venus", 70, 82), word("B.", 48, 112),
  word("Mars", 70, 112), word("C.", 48, 142), word("Jupiter", 70, 142), word("D.", 48, 172),
  word("Mercury", 70, 172), word("2.", 40, 220), word("Which", 62, 220), word("gas", 112, 220),
  word("do", 143, 220), word("plants", 166, 220), word("absorb?", 214, 220), word("A.", 48, 252),
  word("Oxygen", 70, 252), word("B.", 48, 282), word("Nitrogen", 70, 282), word("C.", 48, 312),
  word("Carbon", 70, 312), word("dioxide", 122, 312), word("D.", 48, 342), word("Hydrogen", 70, 342),
];

test("groups representative OCR word boxes into questions and option regions", () => {
  const questions = parseQuestionsFromLines(wordsToLines(paperWords, 8), 800, 500);

  assert.equal(questions.length, 2);
  assert.deepEqual(questions.map((question) => question.number), [1, 2]);
  assert.equal(questions[0].questionText, "Which planet is known as the red planet?");
  assert.equal(questions[1].questionText, "Which gas do plants absorb?");
  assert.deepEqual(questions[0].optionRegions.map((option) => option.label), ["A", "B", "C", "D"]);
  assert.ok(questions[1].optionRegions[2].box.width > 50);
});

test("attaches a clear marked option to the corresponding question region", () => {
  const parsed = parseQuestionsFromLines(wordsToLines(paperWords, 8), 800, 500);
  const width = 800;
  const height = 500;
  const gray = new Uint8Array(width * height).fill(255);
  const marked = parsed[0].optionRegions[1].box;
  for (let y = Math.round(marked.y + marked.height * 0.2); y < Math.round(marked.y + marked.height * 0.8); y++) {
    for (let x = Math.round(marked.x + marked.width * 0.2); x < Math.round(marked.x + marked.width * 0.8); x++) {
      gray[y * width + x] = 15;
    }
  }

  const detected = attachMarks(parsed, gray, width, height);
  assert.deepEqual(detected[0].options.map((option) => option.label), ["A", "B", "C", "D"]);
  assert.deepEqual(detected[0].selected, ["B"]);
  assert.deepEqual(detected[1].selected, []);
});

import assert from "node:assert/strict";
import test from "node:test";
import { classifyQuestionMarks, detectMarksForRegions } from "../src/vision/markDetector.ts";

const width = 260;
const height = 150;
const labels = ["A", "B", "C", "D"];
const regions = labels.map((label, index) => {
  const labelBox = { x: 25 + index * 55, y: 65, width: 18, height: 20 };
  return { label, labelBox, box: { ...labelBox }, text: `option ${label}` };
});

function blankPage() {
  const gray = new Uint8Array(width * height).fill(248);
  for (const { labelBox } of regions) {
    const x = Math.round(labelBox.x + labelBox.width / 2);
    const y = Math.round(labelBox.y + labelBox.height / 2);
    gray[y * width + x - 3] = 35;
    gray[y * width + x + 3] = 35;
    gray[(y - 4) * width + x] = 35;
    gray[(y + 4) * width + x] = 35;
  }
  return gray;
}

function drawEllipse(gray, box, color, start = 0, end = Math.PI * 2) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = 15;
  const ry = 13;
  for (let angle = start; angle < end; angle += 0.01) {
    const x = Math.round(cx + Math.cos(angle) * rx);
    const y = Math.round(cy + Math.sin(angle) * ry);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        gray[(y + dy) * width + x + dx] = color;
      }
    }
  }
}

function detect(gray) {
  return detectMarksForRegions(gray, width, height, regions);
}

test("recognizes a dark pen circle around one option without treating printed letters as marks", () => {
  const gray = blankPage();
  drawEllipse(gray, regions[1].labelBox, 25);

  const result = detect(gray);
  const classified = classifyQuestionMarks(result);

  assert.deepEqual(classified, { selected: ["B"], status: "selected" });
  assert.ok(result[1].circleCoverage >= 0.42);
  assert.ok(result[0].circleCoverage < 0.23);
});

test("recognizes a faint pencil circle around one option", () => {
  const gray = blankPage();
  drawEllipse(gray, regions[2].labelBox, 198);

  const classified = classifyQuestionMarks(detect(gray));
  assert.deepEqual(classified, { selected: ["C"], status: "selected" });
});

test("reports multiple circles, a blank question, and a partial circle as distinct statuses", () => {
  const multiple = blankPage();
  drawEllipse(multiple, regions[0].labelBox, 35);
  drawEllipse(multiple, regions[3].labelBox, 35);
  assert.deepEqual(classifyQuestionMarks(detect(multiple)), {
    selected: ["A", "D"],
    status: "multiple",
  });

  assert.deepEqual(classifyQuestionMarks(detect(blankPage())), {
    selected: [],
    status: "unanswered",
  });

  const partial = blankPage();
  drawEllipse(partial, regions[1].labelBox, 150, 0, Math.PI * 1.05);
  assert.deepEqual(classifyQuestionMarks(detect(partial)), {
    selected: ["B"],
    status: "uncertain",
  });
});

test("requires all four option regions before reporting an answer", () => {
  const detected = detectMarksForRegions(blankPage(), width, height, regions.slice(0, 3));
  assert.deepEqual(classifyQuestionMarks(detected), { selected: [], status: "uncertain" });
});

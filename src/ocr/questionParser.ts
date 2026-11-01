import type { DetectedQuestion, OptionLabel, Rect } from "../types";
import { OPTION_LABELS } from "../types";
import { inflateRect, unionRect } from "../lib/geometry";
import { classifyQuestionMarks, detectMarksForRegions } from "../vision/markDetector";

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: Rect;
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
  bbox: Rect;
}

const QUESTION_RE = /^(\d{1,3})(?:[\.\)\:]|\/)/;
const OPTION_RE = /^[\(\[]?([A-Da-d])(?:[\)\]\.\:\-]|\/)\s*(.*)$/;
const INLINE_OPTION_RE = /(?:^|\s)[\(\[]?([A-Da-d])[\)\]\.\:\-]\s*/g;

export function wordsToLines(words: OcrWord[], yTol = 10): OcrLine[] {
  const sorted = [...words].filter((w) => w.text.trim()).sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
  const lines: OcrWord[][] = [];
  for (const word of sorted) {
    const last = lines[lines.length - 1];
    if (!last) {
      lines.push([word]);
      continue;
    }
    const lastY = last.reduce((s, w) => s + w.bbox.y + w.bbox.height / 2, 0) / last.length;
    const y = word.bbox.y + word.bbox.height / 2;
    if (Math.abs(y - lastY) <= Math.max(yTol, word.bbox.height * 0.6)) last.push(word);
    else lines.push([word]);
  }
  return lines.map((ws) => {
    const ordered = [...ws].sort((a, b) => a.bbox.x - b.bbox.x);
    const first = ordered[0];
    return {
      words: ordered,
      text: ordered.map((w) => w.text).join(" "),
      bbox: ordered.slice(1).reduce<Rect>((acc, w) => unionRect(acc, w.bbox), first.bbox),
    };
  });
}

function splitColumns(lines: OcrLine[], pageWidth: number): OcrLine[][] {
  const starts = lines
    .filter((l) => QUESTION_RE.test(l.text.trim()))
    .map((l) => l.bbox.x);
  if (starts.length < 4) return [lines];
  const left = starts.filter((x) => x < pageWidth * 0.42);
  const right = starts.filter((x) => x > pageWidth * 0.42);
  if (left.length >= 2 && right.length >= 2) {
    const leftLines = lines.filter((l) => l.bbox.x + l.bbox.width / 2 < pageWidth * 0.5);
    const rightLines = lines.filter((l) => l.bbox.x + l.bbox.width / 2 >= pageWidth * 0.5);
    return [leftLines, rightLines];
  }
  return [lines];
}

function parseOptionsFromLine(line: OcrLine): Array<{ label: OptionLabel; box: Rect; text: string }> {
  const found: Array<{ label: OptionLabel; box: Rect; text: string }> = [];
  const indexes: Array<{ label: OptionLabel; wordIndex: number }> = [];
  line.words.forEach((word, i) => {
    const match = word.text.trim().match(/^[\(\[]?([A-Da-d])[\)\]\.\:\-]?$/);
    if (match) indexes.push({ label: match[1].toUpperCase() as OptionLabel, wordIndex: i });
  });
  if (indexes.length >= 2) {
    for (let i = 0; i < indexes.length; i++) {
      const start = indexes[i].wordIndex;
      const end = i + 1 < indexes.length ? indexes[i + 1].wordIndex : line.words.length;
      const slice = line.words.slice(start, end);
      const first = slice[0];
      found.push({
        label: indexes[i].label,
        text: slice.map((w) => w.text).join(" "),
        box: slice.slice(1).reduce<Rect>((acc, w) => unionRect(acc, w.bbox), first.bbox),
      });
    }
    return found;
  }
  const m = line.text.trim().match(OPTION_RE);
  if (m && OPTION_LABELS.includes(m[1].toUpperCase() as OptionLabel)) {
    found.push({
      label: m[1].toUpperCase() as OptionLabel,
      text: line.text,
      box: line.bbox,
    });
  }
  return found;
}

export function parseQuestionsFromLines(
  lines: OcrLine[],
  pageWidth: number,
  pageHeight: number,
): Array<{
  number: number;
  questionText?: string;
  box: Rect;
  optionRegions: Array<{ label: OptionLabel; box: Rect }>;
}> {
  const columns = splitColumns(lines, pageWidth);
  const questions: Array<{
    number: number;
    questionText?: string;
    box: Rect;
    optionRegions: Array<{ label: OptionLabel; box: Rect }>;
  }> = [];

  for (const col of columns) {
    let current: (typeof questions)[number] | null = null;
    for (const line of col) {
      const trimmed = line.text.trim();
      const qMatch = trimmed.match(QUESTION_RE);
      if (qMatch) {
        const number = Number(qMatch[1]);
        if (number >= 1 && number <= 200) {
          current = {
            number,
            questionText: trimmed.replace(QUESTION_RE, "").trim(),
            box: line.bbox,
            optionRegions: [],
          };
          questions.push(current);
        }
      }
      const optionBits = parseOptionsFromLine(line);
      if (optionBits.length && current) {
        current.box = unionRect(current.box, line.bbox);
        for (const bit of optionBits) {
          const existing = current.optionRegions.find((o) => o.label === bit.label);
          if (existing) existing.box = unionRect(existing.box, bit.box);
          else current.optionRegions.push({ label: bit.label, box: bit.box });
        }
      } else if (current && !qMatch) {
        current.box = unionRect(current.box, line.bbox);
        if (current.questionText && current.questionText.length < 180) {
          current.questionText = `${current.questionText} ${trimmed}`.trim();
        }
      }
    }
  }

  return questions.map((q) => ({
    ...q,
    box: inflateRect(q.box, 4, 3),
    optionRegions: q.optionRegions.map((o) => ({
      ...o,
      box: inflateRect(o.box, Math.min(18, pageWidth * 0.012), Math.min(10, pageHeight * 0.008)),
    })),
  }));
}

export function attachMarks(
  parsed: Array<{
    number: number;
    questionText?: string;
    box: Rect;
    optionRegions: Array<{ label: OptionLabel; box: Rect }>;
  }>,
  gray: Uint8Array,
  width: number,
  height: number,
): DetectedQuestion[] {
  return parsed.map((q) => {
    const filled = OPTION_LABELS.map((label) => {
      const region = q.optionRegions.find((o) => o.label === label);
      return region ?? { label, box: { x: q.box.x, y: q.box.y, width: 8, height: 8 } };
    });
    const options = detectMarksForRegions(gray, width, height, filled);
    const { selected, status } = classifyQuestionMarks(options);
    const top = Math.max(...options.map((o) => o.markScore), 0);
    const confidence =
      status === "selected" && top > 0.16 ? "high" : status === "unanswered" ? "medium" : "low";
    return {
      number: q.number,
      questionText: q.questionText,
      box: q.box,
      options,
      selected,
      status,
      confidence,
    };
  });
}

export { INLINE_OPTION_RE };

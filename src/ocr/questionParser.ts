import type { DetectedQuestion, OptionLabel, Rect } from "../types";
import { OPTION_LABELS } from "../types";
import { inflateRect, unionRect } from "../lib/geometry";
import {
  classifyQuestionMarks,
  detectMarksForRegions,
  SELECTED_CIRCLE_THRESHOLD,
} from "../vision/markDetector";

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

export interface ParsedOptionRegion {
  label: OptionLabel;
  text: string;
  labelBox: Rect;
  box: Rect;
}

export interface ParsedQuestionRegion {
  number: number;
  questionText?: string;
  box: Rect;
  optionRegions: ParsedOptionRegion[];
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

function parseOptionsFromLine(line: OcrLine): ParsedOptionRegion[] {
  const found: ParsedOptionRegion[] = [];
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
      const body = slice.slice(1);
      const labelBox = slice[0].bbox;
      found.push({
        label: indexes[i].label,
        text: body.map((w) => w.text).join(" "),
        labelBox,
        box: body.length
          ? body.slice(1).reduce<Rect>((acc, w) => unionRect(acc, w.bbox), body[0].bbox)
          : labelBox,
      });
    }
    return found;
  }

  if (indexes.length === 1 && indexes[0].wordIndex === 0) {
    const body = line.words.slice(1);
    const labelBox = line.words[0].bbox;
    return [{
      label: indexes[0].label,
      text: body.map((word) => word.text).join(" "),
      labelBox,
      box: body.length
        ? body.slice(1).reduce<Rect>((acc, word) => unionRect(acc, word.bbox), body[0].bbox)
        : labelBox,
    }];
  }

  const m = line.text.trim().match(OPTION_RE);
  if (m && line.words.length > 0 && OPTION_LABELS.includes(m[1].toUpperCase() as OptionLabel)) {
    const body = line.words.slice(1);
    const labelBox = line.words[0].bbox;
    found.push({
      label: m[1].toUpperCase() as OptionLabel,
      text: body.map((word) => word.text).join(" ") || m[2],
      labelBox,
      box: body.length
        ? body.slice(1).reduce<Rect>((acc, word) => unionRect(acc, word.bbox), body[0].bbox)
        : labelBox,
    });
  }
  return found;
}

export function parseQuestionsFromLines(
  lines: OcrLine[],
  pageWidth: number,
  pageHeight: number,
): ParsedQuestionRegion[] {
  const columns = splitColumns(lines, pageWidth);
  const questions: ParsedQuestionRegion[] = [];

  for (const col of columns) {
    let current: (typeof questions)[number] | null = null;
    let lastOption: ParsedOptionRegion | null = null;
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
          lastOption = null;
        }
      }
      const optionBits = parseOptionsFromLine(line);
      if (optionBits.length && current) {
        current.box = unionRect(current.box, line.bbox);
        for (const bit of optionBits) {
          const existing = current.optionRegions.find((o) => o.label === bit.label);
          if (existing) {
            existing.box = unionRect(existing.box, bit.box);
            existing.labelBox = unionRect(existing.labelBox, bit.labelBox);
            existing.text = [existing.text, bit.text].filter(Boolean).join(" ");
            lastOption = existing;
          } else {
            current.optionRegions.push(bit);
            lastOption = bit;
          }
        }
      } else if (current && !qMatch) {
        current.box = unionRect(current.box, line.bbox);
        const continuesOption =
          lastOption !== null &&
          line.bbox.y <= lastOption.box.y + lastOption.box.height + line.bbox.height * 1.5 &&
          line.bbox.x >= lastOption.box.x - line.bbox.height;
        if (continuesOption && lastOption) {
          lastOption.box = unionRect(lastOption.box, line.bbox);
          lastOption.text = [lastOption.text, line.text].filter(Boolean).join(" ");
        } else if (current.optionRegions.length === 0 && (current.questionText?.length ?? 0) < 180) {
          current.questionText = `${current.questionText ?? ""} ${trimmed}`.trim();
        }
      }
    }
  }

  return questions.map((q) => ({
    ...q,
    box: inflateRect(q.box, 4, 3),
    optionRegions: q.optionRegions.map((o) => ({
      ...o,
      labelBox: inflateRect(o.labelBox, 3, 3),
      box: inflateRect(o.box, Math.min(18, pageWidth * 0.012), Math.min(10, pageHeight * 0.008)),
    })),
  }));
}

export function attachMarks(
  parsed: ParsedQuestionRegion[],
  gray: Uint8Array,
  width: number,
  height: number,
): DetectedQuestion[] {
  return parsed.map((q) => {
    const options = detectMarksForRegions(gray, width, height, q.optionRegions);
    const recognizedOptions = q.optionRegions.map((region) => region.label);
    const reasons: string[] = [];
    if (
      recognizedOptions.length !== OPTION_LABELS.length ||
      OPTION_LABELS.some((label) => !recognizedOptions.includes(label))
    ) {
      reasons.push("Could not confidently locate all four option labels.");
    }
    const classified = classifyQuestionMarks(options);
    const selected = classified.selected;
    const status = reasons.length > 0 ? "uncertain" : classified.status;
    if (classified.status === "uncertain") reasons.push("Circle evidence is ambiguous.");
    if (classified.status === "multiple") reasons.push("More than one option appears to be circled.");
    const top = Math.max(...options.map((o) => o.markScore), 0);
    const confidence =
      status === "selected" && top > SELECTED_CIRCLE_THRESHOLD ? "high" : status === "unanswered" ? "medium" : "low";
    return {
      number: q.number,
      questionText: q.questionText,
      box: q.box,
      options,
      selected,
      status,
      confidence,
      recognizedOptions,
      uncertaintyReasons: reasons,
    };
  });
}

export { INLINE_OPTION_RE };

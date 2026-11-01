import type { DetectedOption, DetectionStatus, OptionLabel, Rect } from "../types";
import { OPTION_LABELS } from "../types";
import { clampRect, inflateRect } from "../lib/geometry";

function inkRatio(
  gray: Uint8Array,
  w: number,
  h: number,
  rect: Rect,
  threshold: number,
): number {
  const r = clampRect(rect, w, h);
  const x0 = Math.round(r.x);
  const y0 = Math.round(r.y);
  const x1 = Math.round(r.x + r.width);
  const y1 = Math.round(r.y + r.height);
  let dark = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * w;
    for (let x = x0; x < x1; x++) {
      total++;
      if (gray[row + x] < threshold) dark++;
    }
  }
  return total ? dark / total : 0;
}

function localThreshold(gray: Uint8Array, w: number, h: number, rect: Rect): number {
  const r = clampRect(inflateRect(rect, 18, 12), w, h);
  const x0 = Math.round(r.x);
  const y0 = Math.round(r.y);
  const x1 = Math.round(r.x + r.width);
  const y1 = Math.round(r.y + r.height);
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    const row = y * w;
    for (let x = x0; x < x1; x += 2) {
      sum += gray[row + x];
      n++;
    }
  }
  const mean = n ? sum / n : 180;
  return mean - 28;
}

function ringInk(
  gray: Uint8Array,
  w: number,
  h: number,
  rect: Rect,
  threshold: number,
): number {
  const outer = inflateRect(rect, Math.max(10, rect.width * 0.85), Math.max(8, rect.height * 0.7));
  const inner = inflateRect(rect, 2, 2);
  const outerRatio = inkRatio(gray, w, h, outer, threshold);
  const innerRatio = inkRatio(gray, w, h, inner, threshold);
  return Math.max(0, outerRatio - innerRatio * 0.35);
}

function gutterInk(
  gray: Uint8Array,
  w: number,
  h: number,
  rect: Rect,
  threshold: number,
): number {
  const gutter = {
    x: rect.x - Math.max(16, rect.width * 1.4),
    y: rect.y - 4,
    width: Math.max(14, rect.width * 1.1),
    height: rect.height + 8,
  };
  return inkRatio(gray, w, h, gutter, threshold);
}

export function scoreOption(
  gray: Uint8Array,
  w: number,
  h: number,
  box: Rect,
): { markScore: number; ringInk: number; interiorInk: number; gutterInk: number } {
  const threshold = localThreshold(gray, w, h, box);
  const interior = inkRatio(gray, w, h, box, threshold);
  const ring = ringInk(gray, w, h, box, threshold);
  const gutter = gutterInk(gray, w, h, box, threshold);
  const markScore = ring * 1.35 + Math.max(0, interior - 0.22) * 1.1 + gutter * 1.15;
  return { markScore, ringInk: ring, interiorInk: interior, gutterInk: gutter };
}

export function classifyQuestionMarks(options: DetectedOption[]): {
  selected: OptionLabel[];
  status: DetectionStatus;
} {
  if (!options.length) return { selected: [], status: "uncertain" };
  const scores = options.map((o) => o.markScore);
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const max = Math.max(...scores);
  const high = options.filter((o) => o.markScore > Math.max(0.085, median * 1.55 + 0.03));
  const strong = options.filter((o) => o.markScore === max && max > Math.max(0.1, median * 1.7));

  if (high.length >= 2) {
    const top = [...options].sort((a, b) => b.markScore - a.markScore);
    if (top[0].markScore > top[1].markScore * 1.35) {
      return { selected: [top[0].label], status: "selected" };
    }
    return { selected: high.map((o) => o.label), status: "multiple" };
  }
  if (strong.length === 1 && max - median > 0.04) {
    return { selected: [strong[0].label], status: "selected" };
  }
  if (max < 0.07) return { selected: [], status: "unanswered" };
  if (max - median < 0.035) return { selected: [], status: "unanswered" };
  return { selected: strong.map((o) => o.label), status: "uncertain" };
}

export function detectMarksForRegions(
  gray: Uint8Array,
  width: number,
  height: number,
  regions: Array<{ label: OptionLabel; box: Rect }>,
): DetectedOption[] {
  return regions.map((region) => {
    const scored = scoreOption(gray, width, height, region.box);
    return { label: region.label, box: region.box, ...scored };
  });
}

export function emptyOptions(): DetectedOption[] {
  return OPTION_LABELS.map((label) => ({
    label,
    box: { x: 0, y: 0, width: 0, height: 0 },
    markScore: 0,
    ringInk: 0,
    interiorInk: 0,
    gutterInk: 0,
  }));
}

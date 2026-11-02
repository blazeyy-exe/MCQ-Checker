import type { DetectedOption, DetectionStatus, OptionLabel, Rect } from "../types";
import { OPTION_LABELS } from "../types";
import { clampRect, inflateRect } from "../lib/geometry";

const ANGLE_BINS = 48;
export const SELECTED_CIRCLE_THRESHOLD = 0.62;
export const UNCERTAIN_CIRCLE_THRESHOLD = 0.23;

function inkRatio(gray: Uint8Array, w: number, h: number, rect: Rect, threshold: number): number {
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
  const r = clampRect(inflateRect(rect, 24, 18), w, h);
  const x0 = Math.round(r.x);
  const y0 = Math.round(r.y);
  const x1 = Math.round(r.x + r.width);
  const y1 = Math.round(r.y + r.height);
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 2) {
    const row = y * w;
    for (let x = x0; x < x1; x += 2) {
      sum += gray[row + x];
      count++;
    }
  }
  const mean = count ? sum / count : 220;
  return Math.max(100, Math.min(mean - 8, mean - Math.max(10, (255 - mean) * 0.55)));
}

function ellipseCoverage(
  gray: Uint8Array,
  w: number,
  h: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  threshold: number,
): number {
  let occupied = 0;
  const bins = new Uint8Array(ANGLE_BINS);
  for (let bin = 0; bin < ANGLE_BINS; bin++) {
    const angle = (bin / ANGLE_BINS) * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const x = centerX + radiusX * nx;
    const y = centerY + radiusY * ny;
    let hasInk = false;
    for (const offset of [-1.5, 0, 1.5]) {
      const sampleX = Math.round(x + offset * nx);
      const sampleY = Math.round(y + offset * ny);
      if (
        sampleX >= 0 &&
        sampleX < w &&
        sampleY >= 0 &&
        sampleY < h &&
        gray[sampleY * w + sampleX] < threshold
      ) {
        hasInk = true;
        break;
      }
    }
    if (hasInk) {
      bins[bin] = 1;
      occupied++;
    }
  }

  if (occupied === 0) return 0;
  let longestGap = 0;
  let gap = 0;
  for (let i = 0; i < ANGLE_BINS * 2; i++) {
    if (bins[i % ANGLE_BINS]) gap = 0;
    else {
      gap++;
      longestGap = Math.max(longestGap, gap);
    }
  }
  longestGap = Math.min(longestGap, ANGLE_BINS);
  const coverage = occupied / ANGLE_BINS;
  return coverage * (1 - (longestGap / ANGLE_BINS) * 0.4);
}

function candidateCircleCoverage(
  gray: Uint8Array,
  w: number,
  h: number,
  box: Rect,
  labelBox: Rect | undefined,
  threshold: number,
): number {
  let best = 0;
  if (labelBox) {
    const centerX = labelBox.x + labelBox.width / 2;
    const centerY = labelBox.y + labelBox.height / 2;
    const baseRadius = Math.max(labelBox.width * 0.75, labelBox.height * 0.7, 6);
    for (const xScale of [0.85, 1.1, 1.4, 1.8]) {
      for (const yScale of [0.85, 1.1, 1.4, 1.8]) {
        best = Math.max(
          best,
          ellipseCoverage(gray, w, h, centerX, centerY, baseRadius * xScale, baseRadius * yScale, threshold),
        );
      }
    }
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  for (const padding of [2, 5, 9]) {
    best = Math.max(
      best,
      ellipseCoverage(
        gray,
        w,
        h,
        centerX,
        centerY,
        Math.max(6, box.width / 2 + padding),
        Math.max(6, box.height / 2 + padding),
        threshold,
      ),
    );
  }
  return best;
}

export function scoreOption(
  gray: Uint8Array,
  w: number,
  h: number,
  box: Rect,
  labelBox?: Rect,
): { markScore: number; ringInk: number; interiorInk: number; gutterInk: number; circleCoverage: number } {
  const threshold = localThreshold(gray, w, h, labelBox ?? box);
  const circleCoverage = candidateCircleCoverage(gray, w, h, box, labelBox, threshold);
  const interiorInk = inkRatio(gray, w, h, labelBox ?? box, threshold);
  const ringInk = circleCoverage;
  const gutter = {
    x: (labelBox ?? box).x - Math.max(12, (labelBox ?? box).width),
    y: (labelBox ?? box).y - 4,
    width: Math.max(10, (labelBox ?? box).width),
    height: (labelBox ?? box).height + 8,
  };
  const gutterInk = inkRatio(gray, w, h, gutter, threshold);
  return {
    markScore: circleCoverage,
    ringInk,
    interiorInk,
    gutterInk,
    circleCoverage,
  };
}

export function classifyQuestionMarks(options: DetectedOption[]): {
  selected: OptionLabel[];
  status: DetectionStatus;
} {
  if (options.length !== OPTION_LABELS.length || OPTION_LABELS.some((label) => !options.some((o) => o.label === label))) {
    return { selected: [], status: "uncertain" };
  }
  const sorted = [...options].sort((a, b) => b.markScore - a.markScore);
  const selected = sorted.filter((option) => option.markScore >= SELECTED_CIRCLE_THRESHOLD);
  if (selected.length > 1) {
    return { selected: selected.map((option) => option.label), status: "multiple" };
  }
  if (selected.length === 1) {
    return { selected: [selected[0].label], status: "selected" };
  }
  if (sorted[0].markScore >= UNCERTAIN_CIRCLE_THRESHOLD) {
    return { selected: [sorted[0].label], status: "uncertain" };
  }
  return { selected: [], status: "unanswered" };
}

export function detectMarksForRegions(
  gray: Uint8Array,
  width: number,
  height: number,
  regions: Array<{ label: OptionLabel; text?: string; box: Rect; labelBox?: Rect }>,
): DetectedOption[] {
  return regions.map((region) => {
    const scored = scoreOption(gray, width, height, region.box, region.labelBox);
    let uncertaintyReason: string | undefined;
    if (
      scored.circleCoverage >= UNCERTAIN_CIRCLE_THRESHOLD &&
      scored.circleCoverage < SELECTED_CIRCLE_THRESHOLD
    ) {
      uncertaintyReason = "Possible partial or faint circle; review this option.";
    }
    return { label: region.label, text: region.text, box: region.box, labelBox: region.labelBox, ...scored, uncertaintyReason };
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

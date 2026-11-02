import type { GradingResult, GradedQuestion, OptionLabel, Point, Quad, Rect } from "../types";
import { correctedPageToFrame, frameToPreview, orientPaperQuad, type PreviewMetrics } from "./arCoordinates";
import type { TrackingSnapshot } from "./paperTracker";

export type OverlayColor = "green" | "red" | "blue" | "orange";

export interface GradingMarker {
  questionNumber: number;
  label: string;
  point: Point;
  color: OverlayColor;
  status: GradedQuestion["status"];
}

function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function optionPoint(question: GradedQuestion, label: OptionLabel): Point | null {
  const option = question.optionBoxes.find((region) => region.label === label);
  return option ? center(option.labelBox ?? option.box) : null;
}

function answerRegionCenter(question: GradedQuestion): Point | null {
  const regions = question.optionBoxes
    .filter((option) => option.labelBox ?? option.box)
    .map((option) => center(option.labelBox ?? option.box));
  if (!regions.length) return null;
  return {
    x: regions.reduce((sum, point) => sum + point.x, 0) / regions.length,
    y: regions.reduce((sum, point) => sum + point.y, 0) / regions.length,
  };
}

export function gradingMarkers(
  result: GradingResult | null,
  answerKeyConfirmed: boolean,
): GradingMarker[] {
  const debug = result?.debug;
  if (
    !result ||
    !answerKeyConfirmed ||
    !debug?.paperQuad ||
    !Number.isFinite(debug.pageWidth) ||
    !Number.isFinite(debug.pageHeight) ||
    debug.pageWidth <= 0 ||
    debug.pageHeight <= 0 ||
    debug.issues?.some((issue) => issue.code === "unconfirmed_layout")
  ) return [];

  const markers: GradingMarker[] = [];
  for (const question of result.questions) {
    if (question.status === "correct" || question.status === "incorrect") {
      if (question.confidence !== "high" && question.teacherOverride === undefined) continue;
      const label = question.teacherOverride && question.teacherOverride !== "unanswered"
        ? question.teacherOverride
        : question.effectiveAnswer ?? question.detectedAnswers[0];
      if (!label) continue;
      const point = optionPoint(question, label);
      if (point) {
        markers.push({
          questionNumber: question.number,
          label: String(question.number),
          point,
          color: question.status === "correct" ? "green" : "red",
          status: question.status,
        });
      }
      continue;
    }

    if (question.status === "multiple") {
      for (const label of question.detectedAnswers) {
        const point = optionPoint(question, label);
        if (point) {
          markers.push({
            questionNumber: question.number,
            label: `${question.number} ${label}`,
            point,
            color: "orange",
            status: question.status,
          });
        }
      }
      continue;
    }

    if (question.status === "uncertain" && question.detectedAnswers.length === 1) {
      const point = optionPoint(question, question.detectedAnswers[0]);
      if (point) {
        markers.push({
          questionNumber: question.number,
          label: `${question.number} ?`,
          point,
          color: "orange",
          status: question.status,
        });
        continue;
      }
    }

    if (question.status === "unanswered" || question.status === "uncertain") {
      const point = answerRegionCenter(question);
      if (!point || question.optionBoxes.length < 4) continue;
      markers.push({
        questionNumber: question.number,
        label: question.status === "unanswered" ? `${question.number} · blank` : `${question.number} · review`,
        point,
        color: question.status === "unanswered" ? "blue" : "orange",
        status: question.status,
      });
    }
  }
  return markers;
}

export function shouldShowGradingOverlay(
  result: GradingResult | null,
  answerKeyConfirmed: boolean,
  tracking: TrackingSnapshot,
  now: number,
  maxAgeMs = 350,
): boolean {
  const age = now - tracking.timestamp;
  return Boolean(
    tracking.found &&
    tracking.quad &&
    age >= 0 &&
    age < maxAgeMs &&
    gradingMarkers(result, answerKeyConfirmed).length > 0,
  );
}

export function projectGradingMarkers(
  result: GradingResult | null,
  answerKeyConfirmed: boolean,
  trackingQuad: Quad,
  metrics: PreviewMetrics,
): GradingMarker[] {
  const debug = result?.debug;
  if (!debug) return [];
  return gradingMarkers(result, answerKeyConfirmed).map((marker) => ({
    ...marker,
    point: frameToPreview(
      correctedPageToFrame(marker.point, orientPaperQuad(trackingQuad), debug.pageWidth, debug.pageHeight),
      metrics,
    ),
  }));
}

export function orientedTrackingQuad(quad: Quad): Quad {
  return orientPaperQuad(quad);
}

import type { DetectedQuestion, PaperLayout } from "../types";
import { OPTION_LABELS } from "../types";
import { relToAbs } from "../lib/geometry";
import {
  classifyQuestionMarks,
  detectMarksForRegions,
  SELECTED_CIRCLE_THRESHOLD,
} from "../vision/markDetector";

export function applyLayout(
  layout: PaperLayout,
  gray: Uint8Array,
  width: number,
  height: number,
): DetectedQuestion[] {
  return layout.questions.map((question) => {
    const box = relToAbs(question.questionBox, width, height);
    const regions = question.options.map((saved) => ({
      label: saved.label,
      box: relToAbs(saved.box, width, height),
    }));
    const options = detectMarksForRegions(gray, width, height, regions);
    const recognizedOptions = regions.map((region) => region.label);
    const reasons: string[] = [];
    if (!layout.confirmed) {
      reasons.push("Saved layout has not been confirmed by a teacher.");
    }
    if (
      recognizedOptions.length !== OPTION_LABELS.length ||
      OPTION_LABELS.some((label) => !recognizedOptions.includes(label))
    ) {
      reasons.push("Saved layout does not contain all four option regions.");
    }
    const classified = classifyQuestionMarks(options);
    const selected = classified.selected;
    const status = reasons.length > 0 ? "uncertain" : classified.status;
    if (classified.status === "uncertain") reasons.push("Circle evidence is ambiguous.");
    if (classified.status === "multiple") reasons.push("More than one option appears to be circled.");
    const top = Math.max(...options.map((option) => option.markScore), 0);
    return {
      number: question.number,
      box,
      options,
      selected,
      status,
      confidence:
        status === "selected" && top > SELECTED_CIRCLE_THRESHOLD
          ? "high"
          : status === "unanswered"
            ? "medium"
            : "low",
      recognizedOptions,
      uncertaintyReasons: reasons,
    };
  });
}

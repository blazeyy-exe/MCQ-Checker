import type { ConfidenceLevel, DetectedQuestion } from "../types";

export function overallConfidence(questions: DetectedQuestion[]): ConfidenceLevel {
  if (!questions.length) return "low";
  const low = questions.filter((q) => q.confidence === "low" || q.status !== "selected").length;
  if (low === 0) return "high";
  if (low <= questions.length * 0.25) return "medium";
  return "low";
}

export function needsLayoutConfirmation(detectedCount: number, expectedCount: number): boolean {
  if (expectedCount <= 0) return detectedCount < 3;
  return detectedCount < Math.max(3, Math.floor(expectedCount * 0.6));
}

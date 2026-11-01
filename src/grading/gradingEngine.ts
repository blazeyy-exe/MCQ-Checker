import type { GradedQuestion, GradingResult } from "../types";

export function summarize(questions: GradedQuestion[]) {
  const total = questions.length;
  const correct = questions.filter((q) => q.status === "correct").length;
  const incorrect = questions.filter((q) => q.status === "incorrect").length;
  const unanswered = questions.filter((q) => q.status === "unanswered").length;
  const multiple = questions.filter((q) => q.status === "multiple").length;
  const uncertain = questions.filter((q) => q.status === "uncertain").length;
  const missing = questions.filter((q) => q.status === "missing").length;
  const score = correct;
  const percentage = total ? Math.round((score / total) * 1000) / 10 : 0;
  const verified =
    total > 0 &&
    questions.every(
      (question) =>
        question.keyAnswer !== null &&
        (question.status === "unanswered" ||
          (["correct", "incorrect"].includes(question.status) &&
            (question.confidence === "high" || question.teacherOverride !== undefined))),
    );
  return { total, correct, incorrect, unanswered, multiple, uncertain, missing, score, percentage, verified };
}

function detectedStatus(question: GradedQuestion): GradedQuestion["status"] {
  if (question.detectedStatus) return question.detectedStatus;
  if (question.status === "missing") return "missing";
  if (question.detectedAnswers.length > 1) return "multiple";
  if (question.detectedAnswers.length === 0) {
    return question.status === "uncertain" ? "uncertain" : "unanswered";
  }
  if (question.keyAnswer === null || question.confidence === "low") return "uncertain";
  return question.detectedAnswers[0] === question.keyAnswer ? "correct" : "incorrect";
}

export function applyOverride(questions: GradedQuestion[], number: number, override: GradedQuestion["teacherOverride"]): GradedQuestion[] {
  return questions.map((q) => {
    if (q.number !== number) return q;
    if (!override) {
      const status = detectedStatus(q);
      const effectiveAnswer =
        status === "correct" || status === "incorrect" ? q.detectedAnswers[0] ?? null : null;
      return {
        ...q,
        teacherOverride: undefined,
        status,
        effectiveAnswer,
        confidence: q.detectedConfidence ?? q.confidence,
      };
    }
    const originalStatus = q.detectedStatus ?? detectedStatus(q);
    const originalConfidence = q.detectedConfidence ?? q.confidence;
    if (override === "unanswered") {
      return {
        ...q,
        detectedStatus: originalStatus,
        detectedConfidence: originalConfidence,
        teacherOverride: override,
        effectiveAnswer: null,
        status: "unanswered",
        confidence: "high",
      };
    }
    const status = q.keyAnswer === override ? "correct" : "incorrect";
    return {
      ...q,
      detectedStatus: originalStatus,
      detectedConfidence: originalConfidence,
      teacherOverride: override,
      effectiveAnswer: override,
      status,
      confidence: "high",
    };
  });
}

export function buildResult(
  partial: Omit<
    GradingResult,
    | "total"
    | "correct"
    | "incorrect"
    | "unanswered"
    | "multiple"
    | "uncertain"
    | "missing"
    | "score"
    | "percentage"
    | "verified"
  >,
): GradingResult {
  return { ...partial, ...summarize(partial.questions) };
}

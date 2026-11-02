import type { DetectionStatus, OptionLabel, StudentPaperRecognition } from "../types";

export interface GroundTruthQuestion {
  number: number;
  selected: OptionLabel[];
  status: DetectionStatus;
}

export interface RecognitionEvaluationCase {
  filename: string;
  groundTruth: GroundTruthQuestion[];
  recognition: Pick<StudentPaperRecognition, "questions" | "processingMs">;
}

export interface RecognitionMetrics {
  cases: number;
  expectedQuestions: number;
  detectedQuestions: number;
  questionDetectionAccuracy: number;
  expectedOptionLabels: number;
  recognizedOptionLabels: number;
  optionAssociationAccuracy: number;
  exactAnswerAccuracy: number;
  unansweredQuestions: number;
  unansweredDetectionAccuracy: number;
  multipleQuestions: number;
  multipleDetectionAccuracy: number;
  falsePositiveSelections: number;
  falseNegativeSelections: number;
  averageProcessingMs: number;
}

function rate(correct: number, total: number): number {
  return total ? Math.round((correct / total) * 10000) / 100 : 0;
}

export function evaluateRecognitionCases(cases: RecognitionEvaluationCase[]): RecognitionMetrics {
  let expectedQuestions = 0;
  let detectedQuestions = 0;
  let expectedOptionLabels = 0;
  let recognizedOptionLabels = 0;
  let exactAnswers = 0;
  let unansweredQuestions = 0;
  let unansweredCorrect = 0;
  let multipleQuestions = 0;
  let multipleCorrect = 0;
  let falsePositiveSelections = 0;
  let falseNegativeSelections = 0;
  let processingMs = 0;

  for (const evaluationCase of cases) {
    processingMs += evaluationCase.recognition.processingMs;
    const detectedByNumber = new Map(
      evaluationCase.recognition.questions.map((question) => [question.number, question]),
    );
    for (const expected of evaluationCase.groundTruth) {
      expectedQuestions++;
      const actual = detectedByNumber.get(expected.number);
      if (!actual) {
        falseNegativeSelections += expected.selected.length;
        expectedOptionLabels += 4;
        if (expected.status === "unanswered") unansweredQuestions++;
        if (expected.status === "multiple") multipleQuestions++;
        continue;
      }

      detectedQuestions++;
      const actualLabels = actual.recognizedOptions ?? actual.options.map((option) => option.label);
      expectedOptionLabels += 4;
      recognizedOptionLabels += ["A", "B", "C", "D"].filter((label) =>
        actualLabels.includes(label as OptionLabel),
      ).length;

      const expectedSet = new Set(expected.selected);
      const actualSet = new Set(actual.selected);
      if (expected.status !== "uncertain") {
        for (const label of actualSet) if (!expectedSet.has(label)) falsePositiveSelections++;
        for (const label of expectedSet) if (!actualSet.has(label)) falseNegativeSelections++;
      }
      if (
        actual.status === expected.status &&
        expectedSet.size === actualSet.size &&
        [...expectedSet].every((label) => actualSet.has(label))
      ) {
        exactAnswers++;
      }
      if (expected.status === "unanswered") {
        unansweredQuestions++;
        if (actual.status === "unanswered" && actual.selected.length === 0) unansweredCorrect++;
      }
      if (expected.status === "multiple") {
        multipleQuestions++;
        if (actual.status === "multiple" && actualSet.size > 1) multipleCorrect++;
      }
    }
  }

  return {
    cases: cases.length,
    expectedQuestions,
    detectedQuestions,
    questionDetectionAccuracy: rate(detectedQuestions, expectedQuestions),
    expectedOptionLabels,
    recognizedOptionLabels,
    optionAssociationAccuracy: rate(recognizedOptionLabels, expectedOptionLabels),
    exactAnswerAccuracy: rate(exactAnswers, expectedQuestions),
    unansweredQuestions,
    unansweredDetectionAccuracy: rate(unansweredCorrect, unansweredQuestions),
    multipleQuestions,
    multipleDetectionAccuracy: rate(multipleCorrect, multipleQuestions),
    falsePositiveSelections,
    falseNegativeSelections,
    averageProcessingMs: cases.length ? Math.round(processingMs / cases.length) : 0,
  };
}

export function parseGroundTruth(value: string): GroundTruthQuestion[] {
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const questions: GroundTruthQuestion[] = [];
  const seen = new Set<number>();
  for (const entry of entries) {
    const match = entry.match(/^(\d+)\s*:\s*(blank|multiple|uncertain|\?|[ABCD](?:\s*\+\s*[ABCD])*)$/i);
    if (!match) throw new Error(`Invalid ground truth entry "${entry}". Use e.g. 1:B, 2:blank, 3:A+C.`);
    const number = Number(match[1]);
    if (number < 1 || seen.has(number)) throw new Error(`Question number ${match[1]} is invalid or repeated.`);
    seen.add(number);
    const answer = match[2].toUpperCase();
    const selected = answer === "BLANK" || answer === "UNCERTAIN" || answer === "?"
      ? []
      : answer === "MULTIPLE"
        ? []
        : answer.split("+").map((label) => label.trim() as OptionLabel);
    const status: DetectionStatus =
      answer === "BLANK"
        ? "unanswered"
        : answer === "UNCERTAIN" || answer === "?"
          ? "uncertain"
          : answer === "MULTIPLE" || selected.length > 1
            ? "multiple"
            : "selected";
    questions.push({ number, selected, status });
  }
  return questions.sort((a, b) => a.number - b.number);
}

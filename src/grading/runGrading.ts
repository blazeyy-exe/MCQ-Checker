import type { AnswerKey, GradingResult, PaperLayout } from "../types";
import { matchQuestions } from "./questionMatcher";
import { buildResult } from "./gradingEngine";
import { debugFromRecognition, recognizeStudentPaper, suggestedLayout } from "./studentPaperEngine";
import { renderAnnotatedPaper } from "../vision/annotationRenderer";
import { createId } from "../lib/ids";
import { saveLayout, saveResult } from "../services/storageService";
import { isAnswerKeyComplete } from "./answerKeyModel";

export async function gradePaperSource(input: {
  source: HTMLCanvasElement | HTMLImageElement | ImageData;
  key: AnswerKey;
  sessionId: string;
  layout?: PaperLayout | null;
  studentLabel?: string;
}): Promise<GradingResult> {
  if (!isAnswerKeyComplete(input.key)) {
    throw new Error("Confirm every answer in the answer key before grading.");
  }
  const recognition = await recognizeStudentPaper({
    source: input.source,
    layout: input.layout,
  });
  if (!recognition.questions.length) {
    throw new Error("No questions could be recognized. Review the paper or confirm its layout before grading.");
  }
  const questions = matchQuestions(input.key, recognition.questions);
  const annotatedDataUrl = await renderAnnotatedPaper(recognition.warpedDataUrl, questions);
  const result = buildResult({
    id: createId("result"),
    sessionId: input.sessionId,
    answerKeyId: input.key.id,
    studentLabel: input.studentLabel ?? "",
    createdAt: Date.now(),
    questions,
    originalDataUrl: recognition.originalDataUrl,
    warpedDataUrl: recognition.warpedDataUrl,
    annotatedDataUrl,
    ocrText: recognition.ocrText,
    warnings: recognition.warnings,
    processingMs: recognition.processingMs,
    usedLayout: recognition.usedLayout,
    debug: debugFromRecognition(recognition),
  });
  if (!input.layout && recognition.questions.length >= Math.max(3, Math.floor(input.key.questionCount * 0.5))) {
    const layout = suggestedLayout(recognition, input.key.id, false);
    await saveLayout(layout);
  }
  await saveResult(result);
  return result;
}

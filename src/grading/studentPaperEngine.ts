import type { DetectedQuestion, PaperLayout, Quad, RecognitionDebug, StudentPaperRecognition } from "../types";
import { detectDocument } from "../vision/documentDetector";
import { loadOpenCV } from "../vision/opencvLoader";
import { layoutFromQuestions } from "../vision/layoutFromRecognition";
import { applyLayout } from "./layoutMarkDetector";
import { attachMarks, parseQuestionsFromLines, wordsToLines, type OcrWord } from "../ocr/questionParser";
import { extractWords } from "../ocr/ocrLoader";
import {
  canvasToImageData,
  createCanvas,
  downscaleImageData,
  enhanceContrast,
  getContext,
  imageDataToCanvas,
  loadImageElement,
  targetWarpSize,
  toGrayscale,
  warpQuadToImage,
} from "../lib/image";
import { dist, quadFromRect } from "../lib/geometry";

export interface ProcessPaperInput {
  source: HTMLCanvasElement | HTMLImageElement | ImageData;
  layout?: PaperLayout | null;
  allowFullFrame?: boolean;
}

export async function imageDataFromSource(
  source: HTMLCanvasElement | HTMLImageElement | ImageData,
): Promise<ImageData> {
  if (source instanceof ImageData) return source;
  const canvas = createCanvas(source.width, source.height);
  getContext(canvas).drawImage(source, 0, 0);
  return canvasToImageData(canvas);
}

export async function warpPaper(data: ImageData, allowFullFrame = false): Promise<{
  warped: ImageData;
  originalDataUrl: string;
  warpedCanvas: HTMLCanvasElement;
  quad?: Quad;
  detectionMessage: string;
}> {
  const cv = await loadOpenCV();
  const small = downscaleImageData(data, 480);
  const detection = detectDocument(small, cv);
  const sx = data.width / small.width;
  const sy = data.height / small.height;
  let quad = detection.quad
    ? {
        tl: { x: detection.quad.tl.x * sx, y: detection.quad.tl.y * sy },
        tr: { x: detection.quad.tr.x * sx, y: detection.quad.tr.y * sy },
        br: { x: detection.quad.br.x * sx, y: detection.quad.br.y * sy },
        bl: { x: detection.quad.bl.x * sx, y: detection.quad.bl.y * sy },
      }
    : undefined;
  if ((!quad || !detection.found) && allowFullFrame) {
    quad = quadFromRect(data.width, data.height);
  }
  const originalDataUrl = imageDataToCanvas(data).toDataURL("image/jpeg", 0.85);
  if (!quad || (!detection.found && !allowFullFrame)) {
    throw new Error(detection.message || "Could not find the examination paper.");
  }
  const horizontalLength = (dist(quad.tl, quad.tr) + dist(quad.bl, quad.br)) / 2;
  const verticalLength = (dist(quad.tl, quad.bl) + dist(quad.tr, quad.br)) / 2;
  const orientedQuad =
    horizontalLength > verticalLength
      ? { tl: quad.tr, tr: quad.br, br: quad.bl, bl: quad.tl }
      : quad;
  const orientedSize = targetWarpSize(orientedQuad);
  const warped = warpQuadToImage(data, orientedQuad, orientedSize.width, orientedSize.height);
  const enhanced = enhanceContrast(warped);
  return {
    warped: enhanced,
    originalDataUrl,
    warpedCanvas: imageDataToCanvas(enhanced),
    quad: orientedQuad,
    detectionMessage: detection.message,
  };
}

export async function recognizeStudentPaper(input: ProcessPaperInput): Promise<StudentPaperRecognition> {
  const t0 = performance.now();
  const timings: Record<string, number> = {};
  const data = await imageDataFromSource(input.source);
  const tWarp = performance.now();
  const warped = await warpPaper(data, input.allowFullFrame ?? false);
  timings.warp = performance.now() - tWarp;
  const gray = toGrayscale(warped.warped);
  const warnings: string[] = [];
  if (warped.detectionMessage.includes("closer") || warped.detectionMessage.includes("blurry")) {
    warnings.push(warped.detectionMessage);
  }

  let questions: DetectedQuestion[] = [];
  let ocrText = "";
  let ocrWords: OcrWord[] = [];
  let usedLayout = false;
  const issues: StudentPaperRecognition["issues"] = [];

  if (input.layout && input.layout.questions.length) {
    const tMarks = performance.now();
    questions = applyLayout(input.layout, gray, warped.warped.width, warped.warped.height);
    timings.marks = performance.now() - tMarks;
    usedLayout = true;
  } else {
    const tOcr = performance.now();
    const { words, text } = await extractWords(warped.warpedCanvas);
    ocrWords = words;
    ocrText = text;
    timings.ocr = performance.now() - tOcr;
    const lines = wordsToLines(words);
    const parsed = parseQuestionsFromLines(lines, warped.warped.width, warped.warped.height);
    const tMarks = performance.now();
    questions = attachMarks(parsed, gray, warped.warped.width, warped.warped.height);
    timings.marks = performance.now() - tMarks;
    if (questions.length === 0) {
      warnings.push("Some questions could not be identified. Confirm the layout before trusting this score.");
      issues.push({
        code: "no_questions",
        message: "No numbered questions were recognized in the corrected paper.",
      });
    }
  }

  if (!input.layout && !ocrWords.length) {
    warnings.push("OCR did not return usable word boxes; review the paper before grading.");
  }
  for (const question of questions) {
    for (const reason of question.uncertaintyReasons ?? []) {
      warnings.push(`Question ${question.number}: ${reason}`);
      issues.push({
        code: reason.includes("layout")
          ? "unconfirmed_layout"
          : reason.includes("option")
            ? "incomplete_options"
            : "ambiguous_mark",
        message: reason,
        questionNumber: question.number,
      });
    }
  }
  const processingMs = performance.now() - t0;
  return {
    questions,
    ocrText,
    processingMs,
    warnings,
    issues,
    sourceDataUrl: warped.originalDataUrl,
    warpedDataUrl: warped.warpedCanvas.toDataURL("image/jpeg", 0.9),
    originalDataUrl: warped.originalDataUrl,
    ocrWords,
    sourceWidth: data.width,
    sourceHeight: data.height,
    pageWidth: warped.warped.width,
    pageHeight: warped.warped.height,
    usedLayout,
    paperQuad: warped.quad,
  };
}

export async function recognizeFromDataUrl(dataUrl: string, layout?: PaperLayout | null, allowFullFrame = false) {
  const img = await loadImageElement(dataUrl);
  return recognizeStudentPaper({ source: img, layout, allowFullFrame });
}

export function suggestedLayout(recognition: StudentPaperRecognition, answerKeyId: string, confirmed: boolean) {
  return layoutFromQuestions(
    recognition.questions,
    recognition.pageWidth,
    recognition.pageHeight,
    answerKeyId,
    confirmed,
  );
}

export function debugFromRecognition(recognition: StudentPaperRecognition, extraTimings?: Record<string, number>): RecognitionDebug {
  return {
    sourceDataUrl: recognition.sourceDataUrl,
    warpedDataUrl: recognition.warpedDataUrl,
    ocrText: recognition.ocrText,
    ocrWords: recognition.ocrWords,
    questionBoxes: recognition.questions.map((q) => ({ number: q.number, box: q.box })),
    optionBoxes: recognition.questions.flatMap((q) =>
      q.options.map((o) => ({
        number: q.number,
        label: o.label,
        text: o.text,
        labelBox: o.labelBox,
        box: o.box,
        markScore: o.markScore,
        circleCoverage: o.circleCoverage,
        uncertaintyReason: o.uncertaintyReason,
      })),
    ),
    questions: recognition.questions,
    issues: recognition.issues,
    timings: { processing: recognition.processingMs, ...extraTimings },
  };
}

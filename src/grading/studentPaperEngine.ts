import type { DetectedQuestion, PaperLayout, Quad, RecognitionDebug, StudentPaperRecognition } from "../types";
import { detectDocument } from "../vision/documentDetector";
import { loadOpenCV } from "../vision/opencvLoader";
import { classifyQuestionMarks, detectMarksForRegions } from "../vision/markDetector";
import { layoutFromQuestions } from "../vision/layoutFromRecognition";
import { attachMarks, parseQuestionsFromLines, wordsToLines } from "../ocr/questionParser";
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
import { quadFromRect, relToAbs } from "../lib/geometry";
import { OPTION_LABELS } from "../types";

export interface ProcessPaperInput {
  source: HTMLCanvasElement | HTMLImageElement | ImageData;
  layout?: PaperLayout | null;
  assumeFullFrame?: boolean;
}

export async function imageDataFromSource(
  source: HTMLCanvasElement | HTMLImageElement | ImageData,
): Promise<ImageData> {
  if (source instanceof ImageData) return source;
  const canvas = createCanvas(source.width, source.height);
  getContext(canvas).drawImage(source, 0, 0);
  return canvasToImageData(canvas);
}

export async function warpPaper(data: ImageData, assumeFullFrame = false): Promise<{
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
  if ((!quad || !detection.found) && assumeFullFrame) {
    quad = quadFromRect(data.width, data.height);
  }
  const originalDataUrl = imageDataToCanvas(data).toDataURL("image/jpeg", 0.85);
  if (!quad) {
    throw new Error(detection.message || "Could not find the examination paper.");
  }
  const size = targetWarpSize(quad);
  const warped = warpQuadToImage(data, quad, size.width, size.height);
  const enhanced = enhanceContrast(warped);
  return {
    warped: enhanced,
    originalDataUrl,
    warpedCanvas: imageDataToCanvas(enhanced),
    quad,
    detectionMessage: detection.message,
  };
}

function applyLayout(
  layout: PaperLayout,
  gray: Uint8Array,
  width: number,
  height: number,
): DetectedQuestion[] {
  return layout.questions.map((q) => {
    const box = relToAbs(q.questionBox, width, height);
    const regions = OPTION_LABELS.map((label) => {
      const saved = q.options.find((o) => o.label === label);
      return {
        label,
        box: saved ? relToAbs(saved.box, width, height) : box,
      };
    });
    const options = detectMarksForRegions(gray, width, height, regions);
    const { selected, status } = classifyQuestionMarks(options);
    const top = Math.max(...options.map((o) => o.markScore), 0);
    return {
      number: q.number,
      box,
      options,
      selected,
      status,
      confidence: status === "selected" && top > 0.16 ? "high" : status === "unanswered" ? "medium" : "low",
    };
  });
}

export async function recognizeStudentPaper(input: ProcessPaperInput): Promise<StudentPaperRecognition> {
  const t0 = performance.now();
  const timings: Record<string, number> = {};
  const data = await imageDataFromSource(input.source);
  const tWarp = performance.now();
  const warped = await warpPaper(data, input.assumeFullFrame ?? true);
  timings.warp = performance.now() - tWarp;
  const gray = toGrayscale(warped.warped);
  const warnings: string[] = [];
  if (warped.detectionMessage.includes("closer") || warped.detectionMessage.includes("blurry")) {
    warnings.push(warped.detectionMessage);
  }

  let questions: DetectedQuestion[] = [];
  let ocrText = "";
  let usedLayout = false;

  if (input.layout && input.layout.questions.length) {
    const tMarks = performance.now();
    questions = applyLayout(input.layout, gray, warped.warped.width, warped.warped.height);
    timings.marks = performance.now() - tMarks;
    usedLayout = true;
  } else {
    const tOcr = performance.now();
    const { words, text } = await extractWords(warped.warpedCanvas);
    ocrText = text;
    timings.ocr = performance.now() - tOcr;
    const lines = wordsToLines(words);
    const parsed = parseQuestionsFromLines(lines, warped.warped.width, warped.warped.height);
    const tMarks = performance.now();
    questions = attachMarks(parsed, gray, warped.warped.width, warped.warped.height);
    timings.marks = performance.now() - tMarks;
    if (questions.length === 0) {
      warnings.push("Some questions could not be identified. Confirm the layout before trusting this score.");
    }
  }

  const processingMs = performance.now() - t0;
  return {
    questions,
    ocrText,
    processingMs,
    warnings,
    warpedDataUrl: warped.warpedCanvas.toDataURL("image/jpeg", 0.9),
    originalDataUrl: warped.originalDataUrl,
    pageWidth: warped.warped.width,
    pageHeight: warped.warped.height,
    usedLayout,
    paperQuad: warped.quad,
  };
}

export async function recognizeFromDataUrl(dataUrl: string, layout?: PaperLayout | null, assumeFullFrame = true) {
  const img = await loadImageElement(dataUrl);
  return recognizeStudentPaper({ source: img, layout, assumeFullFrame });
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
    warpedDataUrl: recognition.warpedDataUrl,
    ocrText: recognition.ocrText,
    questionBoxes: recognition.questions.map((q) => ({ number: q.number, box: q.box })),
    optionBoxes: recognition.questions.flatMap((q) =>
      q.options.map((o) => ({ number: q.number, label: o.label, box: o.box, markScore: o.markScore })),
    ),
    timings: { processing: recognition.processingMs, ...extraTimings },
  };
}

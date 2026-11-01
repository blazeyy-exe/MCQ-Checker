import type { AnswerKey, AnswerKeyItem, ConfidenceLevel } from "../types";
import { OPTION_LABELS } from "../types";
import { createId } from "../lib/ids";
import { recognizeStudentPaper, suggestedLayout } from "./studentPaperEngine";
import { pdfFileToCanvases } from "../ocr/pdfReader";
import { fileToDataUrl, loadImageElement } from "../lib/image";
import { saveAnswerKey, saveLayout } from "../services/storageService";
import { assertAnswerKeyComplete } from "./answerKeyModel";

export {
  areAnswerKeyItemsComplete,
  blankItems,
  createManualKey,
  isAnswerKeyComplete,
  parseBulkAnswers,
} from "./answerKeyModel";

function confidenceFrom(status: string, mark: number): ConfidenceLevel {
  if (status === "selected" && mark > 0.18) return "high";
  if (status === "selected") return "medium";
  return "low";
}

export async function extractAnswerKeyFromFile(file: File): Promise<{
  key: AnswerKey;
  previewUrl: string;
  warnings: string[];
}> {
  let canvas: HTMLCanvasElement;
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pages = await pdfFileToCanvases(file, 1);
    if (!pages.length) throw new Error("Could not read that PDF.");
    canvas = pages[0];
  } else {
    const url = await fileToDataUrl(file);
    const img = await loadImageElement(url);
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Could not read that image.");
    ctx.drawImage(img, 0, 0);
    canvas = c;
  }

  const recognition = await recognizeStudentPaper({ source: canvas, assumeFullFrame: true });
  const items: AnswerKeyItem[] = recognition.questions
    .sort((a, b) => a.number - b.number)
    .map((q) => {
      const answer = q.status === "selected" && q.selected.length === 1 ? q.selected[0] : null;
      return {
        number: q.number,
        answer,
        questionText: q.questionText,
        confidence: confidenceFrom(q.status, Math.max(...q.options.map((o) => o.markScore))),
        needsReview: true,
      };
    });

  const warnings = [...recognition.warnings];
  if (!items.length) {
    warnings.push("No questions could be read. Enter the answer key manually.");
  } else if (items.some((i) => i.needsReview)) {
    warnings.push("Some answers need confirmation before grading.");
  }

  const now = Date.now();
  const key: AnswerKey = {
    id: createId("key"),
    name: file.name.replace(/\.[^.]+$/, ""),
    subject: "",
    className: "",
    questionCount: items.length,
    options: OPTION_LABELS,
    items,
    source: "upload",
    confirmed: false,
    createdAt: now,
    updatedAt: now,
  };

  if (recognition.questions.length) {
    const layout = suggestedLayout(recognition, key.id, false);
    key.layoutId = layout.id;
    await saveLayout(layout);
  }

  return {
    key,
    previewUrl: recognition.warpedDataUrl,
    warnings,
  };
}

export async function persistKey(key: AnswerKey): Promise<AnswerKey> {
  assertAnswerKeyComplete(key);
  const saved = { ...key, updatedAt: Date.now() };
  await saveAnswerKey(saved);
  return saved;
}

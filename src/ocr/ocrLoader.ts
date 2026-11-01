import { createWorker, PSM, type Worker } from "tesseract.js";
import type { OcrWord } from "./questionParser";

let workerPromise: Promise<Worker> | null = null;

export async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker("eng", 1, {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function extractWords(canvas: HTMLCanvasElement): Promise<{ words: OcrWord[]; text: string }> {
  const worker = await getOcrWorker();
  const result = await worker.recognize(canvas);
  const words: OcrWord[] = (result.data.words ?? [])
    .filter((w) => w.text && (w.confidence ?? 0) > 35)
    .map((w) => ({
      text: w.text,
      confidence: w.confidence ?? 0,
      bbox: {
        x: w.bbox.x0,
        y: w.bbox.y0,
        width: w.bbox.x1 - w.bbox.x0,
        height: w.bbox.y1 - w.bbox.y0,
      },
    }));
  return { words, text: result.data.text ?? "" };
}

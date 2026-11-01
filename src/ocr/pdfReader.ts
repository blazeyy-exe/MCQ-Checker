import * as pdfjs from "pdfjs-dist";
import { createCanvas, getContext } from "../lib/image";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export async function pdfFileToCanvases(file: File, maxPages = 6): Promise<HTMLCanvasElement[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = getContext(canvas);
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

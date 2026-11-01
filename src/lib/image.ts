import type { Quad } from "../types";
import { getPerspectiveTransform, invertHomography, applyHomography, dist } from "./geometry";

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return ctx;
}

export function videoFrameToCanvas(
  video: HTMLVideoElement,
  maxWidth = 1280,
): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
  const canvas = createCanvas(video.videoWidth * scale, video.videoHeight * scale);
  getContext(canvas).drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function drawImageToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  getContext(canvas).drawImage(source, 0, 0, width, height);
  return canvas;
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  return getContext(canvas).getImageData(0, 0, canvas.width, canvas.height);
}

export function imageDataToCanvas(data: ImageData): HTMLCanvasElement {
  const canvas = createCanvas(data.width, data.height);
  getContext(canvas).putImageData(data, 0, 0);
  return canvas;
}

export function toGrayscale(data: ImageData): Uint8Array {
  const g = new Uint8Array(data.width * data.height);
  const d = data.data;
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) | 0;
  }
  return g;
}

export function grayscaleVariance(gray: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const mean = sum / gray.length;
  let v = 0;
  for (let i = 0; i < gray.length; i++) {
    const d = gray[i] - mean;
    v += d * d;
  }
  return v / gray.length;
}

export function laplacianSharpness(gray: Uint8Array, w: number, h: number): number {
  let sum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap * lap;
      count++;
    }
  }
  return count ? sum / count : 0;
}

export function warpQuadToImage(source: ImageData, quad: Quad, outW: number, outH: number): ImageData {
  const dstQuad = {
    tl: { x: 0, y: 0 },
    tr: { x: outW - 1, y: 0 },
    br: { x: outW - 1, y: outH - 1 },
    bl: { x: 0, y: outH - 1 },
  };
  const forward = getPerspectiveTransform(quad, dstQuad);
  const inv = invertHomography(forward);
  const out = new ImageData(outW, outH);
  const src = source.data;
  const sw = source.width;
  const sh = source.height;
  const dst = out.data;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const p = applyHomography(inv, x, y);
      const x0 = Math.floor(p.x);
      const y0 = Math.floor(p.y);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const di = (y * outW + x) * 4;
      if (x0 < 0 || y0 < 0 || x1 >= sw || y1 >= sh) {
        dst[di] = dst[di + 1] = dst[di + 2] = 255;
        dst[di + 3] = 255;
        continue;
      }
      const fx = p.x - x0;
      const fy = p.y - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          src[i00 + c] * (1 - fx) * (1 - fy) +
          src[i10 + c] * fx * (1 - fy) +
          src[i01 + c] * (1 - fx) * fy +
          src[i11 + c] * fx * fy;
        dst[di + c] = v;
      }
      dst[di + 3] = 255;
    }
  }
  return out;
}

export function targetWarpSize(quad: Quad): { width: number; height: number } {
  const w = Math.round((dist(quad.tl, quad.tr) + dist(quad.bl, quad.br)) / 2);
  const h = Math.round((dist(quad.tl, quad.bl) + dist(quad.tr, quad.br)) / 2);
  const aspect = h / Math.max(1, w);
  const width = Math.min(1400, Math.max(900, w));
  const height = Math.round(width * Math.min(1.6, Math.max(1.2, aspect)));
  return { width, height };
}

export function downscaleImageData(data: ImageData, maxWidth: number): ImageData {
  if (data.width <= maxWidth) return data;
  const scale = maxWidth / data.width;
  const canvas = imageDataToCanvas(data);
  const out = createCanvas(data.width * scale, data.height * scale);
  getContext(out).drawImage(canvas, 0, 0, out.width, out.height);
  return canvasToImageData(out);
}

export function averageHash(data: ImageData, size = 16): string {
  const small = createCanvas(size, size);
  const tmp = imageDataToCanvas(data);
  getContext(small).drawImage(tmp, 0, 0, size, size);
  const pixels = canvasToImageData(small);
  const gray = toGrayscale(pixels);
  let avg = 0;
  for (const v of gray) avg += v;
  avg /= gray.length;
  return Array.from(gray, (v) => (v > avg ? "1" : "0")).join("");
}

export function hamming(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d + Math.abs(a.length - b.length);
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function imageSourceToImageData(source: HTMLImageElement | HTMLCanvasElement): Promise<ImageData> {
  const canvas = createCanvas(
    "videoWidth" in source ? 0 : source.width,
    "videoHeight" in source ? 0 : source.height,
  );
  canvas.width = source.width;
  canvas.height = source.height;
  getContext(canvas).drawImage(source, 0, 0);
  return canvasToImageData(canvas);
}

export function enhanceContrast(data: ImageData): ImageData {
  const out = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
  const d = out.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = ((d[i] - min) * 255) / range;
    d[i + 1] = ((d[i + 1] - min) * 255) / range;
    d[i + 2] = ((d[i + 2] - min) * 255) / range;
  }
  return out;
}

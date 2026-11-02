import type { PaperDetection, Point, Quad } from "../types";
import {
  convexHull,
  douglasPeucker,
  orderCorners,
  quadArea,
} from "../lib/geometry";
import { laplacianSharpness, toGrayscale } from "../lib/image";
import { imageDataToMat } from "./opencvLoader";

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let thresh = 180;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      thresh = i;
    }
  }
  return thresh;
}

function largestBrightBlob(gray: Uint8Array, w: number, h: number, thresh: number): Point[] {
  const visited = new Uint8Array(gray.length);
  let best: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < gray.length; i++) {
    if (visited[i] || gray[i] < thresh) continue;
    stack.length = 0;
    stack.push(i);
    visited[i] = 1;
    const cells: number[] = [];
    while (stack.length) {
      const idx = stack.pop()!;
      cells.push(idx);
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x > 0 && !visited[idx - 1] && gray[idx - 1] >= thresh) {
        visited[idx - 1] = 1;
        stack.push(idx - 1);
      }
      if (x + 1 < w && !visited[idx + 1] && gray[idx + 1] >= thresh) {
        visited[idx + 1] = 1;
        stack.push(idx + 1);
      }
      if (y > 0 && !visited[idx - w] && gray[idx - w] >= thresh) {
        visited[idx - w] = 1;
        stack.push(idx - w);
      }
      if (y + 1 < h && !visited[idx + w] && gray[idx + w] >= thresh) {
        visited[idx + w] = 1;
        stack.push(idx + w);
      }
    }
    if (cells.length > best.length) best = cells;
  }
  const step = Math.max(1, Math.floor(best.length / 800));
  const points: Point[] = [];
  for (let i = 0; i < best.length; i += step) {
    points.push({ x: best[i] % w, y: (best[i] / w) | 0 });
  }
  return points;
}

function detectWithOpenCV(cv: OpenCV, data: ImageData): Quad | null {
  const src = imageDataToMat(cv, data);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 40, 120);
    cv.dilate(edges, edges, kernel);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const imgArea = data.width * data.height;
    let bestPts: Point[] | null = null;
    let bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const area = Math.abs(cv.contourArea(approx));
        if (area > bestArea && area > imgArea * 0.16) {
          const pts: Point[] = [];
          const raw = approx.data32S?.length ? approx.data32S : approx.data32F;
          for (let r = 0; r < 4; r++) {
            pts.push({ x: raw[r * 2], y: raw[r * 2 + 1] });
          }
          bestPts = pts;
          bestArea = area;
        }
      }
      approx.delete();
      cnt.delete();
    }
    if (!bestPts) return null;
    return orderCorners(bestPts);
  } finally {
    src.delete();
    gray.delete();
    blur.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    kernel.delete();
  }
}

function staysInsideFrame(quad: Quad, width: number, height: number): boolean {
  const margin = Math.max(2, Math.min(width, height) * 0.012);
  return [quad.tl, quad.tr, quad.br, quad.bl].every(
    (point) =>
      point.x >= margin &&
      point.y >= margin &&
      point.x <= width - margin &&
      point.y <= height - margin,
  );
}

export function detectDocument(data: ImageData, cv?: OpenCV | null): PaperDetection {
  const gray = toGrayscale(data);
  const sharpness = laplacianSharpness(gray, data.width, data.height);
  const imgArea = data.width * data.height;
  let quad: Quad | null = null;

  if (cv?.Mat) {
    try {
      quad = detectWithOpenCV(cv, data);
    } catch {
      quad = null;
    }
  }

  if (!quad) {
    const thresh = Math.max(140, otsuThreshold(gray) - 12);
    const blob = largestBrightBlob(gray, data.width, data.height, thresh);
    if (blob.length > 20) {
      const hull = convexHull(blob);
      const peri =
        hull.reduce((acc, p, i) => {
          const n = hull[(i + 1) % hull.length];
          return acc + Math.hypot(p.x - n.x, p.y - n.y);
        }, 0) || 1;
      const approx = douglasPeucker([...hull, hull[0]], 0.03 * peri).slice(0, -1);
      if (approx.length === 4) {
        quad = orderCorners(approx);
      } else if (approx.length > 4) {
        const byCorner = [
          [...approx].sort((a, b) => a.x + a.y - (b.x + b.y))[0],
          [...approx].sort((a, b) => b.x - a.x + (a.y - b.y))[0],
          [...approx].sort((a, b) => b.x + b.y - (a.x + a.y))[0],
          [...approx].sort((a, b) => a.x - b.x + (a.y - b.y))[0],
        ];
        quad = orderCorners(byCorner);
      } else if (blob.length > 0) {
        const bounds = blob.reduce(
          (rect, point) => ({
            left: Math.min(rect.left, point.x),
            top: Math.min(rect.top, point.y),
            right: Math.max(rect.right, point.x),
            bottom: Math.max(rect.bottom, point.y),
          }),
          { left: data.width, top: data.height, right: 0, bottom: 0 },
        );
        quad = {
          tl: { x: bounds.left, y: bounds.top },
          tr: { x: bounds.right, y: bounds.top },
          br: { x: bounds.right, y: bounds.bottom },
          bl: { x: bounds.left, y: bounds.bottom },
        };
      }
    }
  }

  if (!quad) {
    return {
      found: false,
      coverage: 0,
      sharpness,
      message: "Position the student's paper inside the frame.",
    };
  }

  const coverage = quadArea(quad) / imgArea;
  const withinFrame = staysInsideFrame(quad, data.width, data.height);
  let message = "Paper detected.";
  if (coverage < 0.28) message = "Move the paper closer.";
  else if (coverage > 0.98) message = "Keep the entire paper inside the frame.";
  else if (!withinFrame) message = "Show the paper edges with a visible margin around the page.";
  else if (sharpness < 18) message = "Hold steady — the image is a little blurry.";
  const found = coverage >= 0.18 && coverage <= 0.98 && withinFrame && sharpness >= 8;

  return {
    found,
    quad,
    coverage,
    sharpness,
    message,
  };
}

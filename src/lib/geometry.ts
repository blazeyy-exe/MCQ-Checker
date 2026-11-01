import type { Point, Quad, Rect, RelRect } from "../types";

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function orderCorners(points: Point[]): Quad {
  const sorted = [...points].sort((p, q) => p.y - q.y);
  const top = sorted.slice(0, 2).sort((p, q) => p.x - q.x);
  const bottom = sorted.slice(2).sort((p, q) => p.x - q.x);
  return { tl: top[0], tr: top[1], bl: bottom[0], br: bottom[1] };
}

export function quadArea(q: Quad): number {
  const pts = [q.tl, q.tr, q.br, q.bl];
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export function quadFromRect(w: number, h: number): Quad {
  return { tl: { x: 0, y: 0 }, tr: { x: w, y: 0 }, br: { x: w, y: h }, bl: { x: 0, y: h } };
}

export function scaleQuad(q: Quad, sx: number, sy: number): Quad {
  const s = (p: Point): Point => ({ x: p.x * sx, y: p.y * sy });
  return { tl: s(q.tl), tr: s(q.tr), br: s(q.br), bl: s(q.bl) };
}

export function meanQuadDelta(a: Quad, b: Quad): number {
  return (
    (dist(a.tl, b.tl) + dist(a.tr, b.tr) + dist(a.br, b.br) + dist(a.bl, b.bl)) / 4
  );
}

export function inflateRect(r: Rect, padX: number, padY = padX): Rect {
  return {
    x: r.x - padX,
    y: r.y - padY,
    width: r.width + padX * 2,
    height: r.height + padY * 2,
  };
}

export function clampRect(r: Rect, w: number, h: number): Rect {
  const x = Math.max(0, Math.min(w - 1, r.x));
  const y = Math.max(0, Math.min(h - 1, r.y));
  const width = Math.max(1, Math.min(w - x, r.width));
  const height = Math.max(1, Math.min(h - y, r.height));
  return { x, y, width, height };
}

export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

export function relToAbs(r: RelRect, w: number, h: number): Rect {
  return { x: r.x * w, y: r.y * h, width: r.w * w, height: r.h * h };
}

export function absToRel(r: Rect, w: number, h: number): RelRect {
  return { x: r.x / w, y: r.y / h, w: r.width / w, h: r.height / h };
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (pts.length <= 3) return pts;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / mag;
}

export function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  let maxD = 0;
  let idx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilon) {
    const left = douglasPeucker(points.slice(0, idx + 1), epsilon);
    const right = douglasPeucker(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let j = i; j <= n; j++) M[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = M[k][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  return M.map((row) => row[n]);
}

export function getPerspectiveTransform(src: Quad, dst: Quad): number[] {
  const s = [src.tl, src.tr, src.br, src.bl];
  const d = [dst.tl, dst.tr, dst.br, dst.bl];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const x = s[i].x;
    const y = s[i].y;
    const u = d[i].x;
    const v = d[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinearSystem(A, b);
  h.push(1);
  return h;
}

export function applyHomography(h: number[], x: number, y: number): Point {
  const w = h[6] * x + h[7] * y + h[8] || 1e-6;
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

export function invertHomography(h: number[]): number[] {
  const a = h[0], b = h[1], c = h[2];
  const d = h[3], e = h[4], f = h[5];
  const g = h[6], hh = h[7], i = h[8];
  const A = e * i - f * hh;
  const B = f * g - d * i;
  const C = d * hh - e * g;
  const D = c * hh - b * i;
  const E = a * i - c * g;
  const F = b * g - a * hh;
  const G = b * f - c * e;
  const H = c * d - a * f;
  const I = a * e - b * d;
  const det = a * A + b * B + c * C || 1e-8;
  return [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det];
}

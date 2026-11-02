import type { Point, Quad, Rect } from "../types";
import { applyHomography, dist, getPerspectiveTransform } from "../lib/geometry";

export function orientPaperQuad(quad: Quad): Quad {
  const horizontalLength = (dist(quad.tl, quad.tr) + dist(quad.bl, quad.br)) / 2;
  const verticalLength = (dist(quad.tl, quad.bl) + dist(quad.tr, quad.br)) / 2;
  return horizontalLength > verticalLength
    ? { tl: quad.tr, tr: quad.br, br: quad.bl, bl: quad.tl }
    : quad;
}

export interface PreviewMetrics {
  sourceWidth: number;
  sourceHeight: number;
  previewWidth: number;
  previewHeight: number;
  devicePixelRatio: number;
  mirrored?: boolean;
}

export function correctedPageToFrameHomography(
  quad: Quad,
  pageWidth: number,
  pageHeight: number,
): number[] {
  return getPerspectiveTransform(
    {
      tl: { x: 0, y: 0 },
      tr: { x: pageWidth - 1, y: 0 },
      br: { x: pageWidth - 1, y: pageHeight - 1 },
      bl: { x: 0, y: pageHeight - 1 },
    },
    quad,
  );
}

export function correctedPageToFrame(
  point: Point,
  quad: Quad,
  pageWidth: number,
  pageHeight: number,
): Point {
  return applyHomography(
    correctedPageToFrameHomography(quad, pageWidth, pageHeight),
    point.x,
    point.y,
  );
}

export function frameToPreview(point: Point, metrics: PreviewMetrics): Point {
  const scale = Math.max(
    metrics.previewWidth / metrics.sourceWidth,
    metrics.previewHeight / metrics.sourceHeight,
  );
  const cropX = (metrics.previewWidth - metrics.sourceWidth * scale) / 2;
  const cropY = (metrics.previewHeight - metrics.sourceHeight * scale) / 2;
  const x = point.x * scale + cropX;
  return {
    x: metrics.mirrored ? metrics.previewWidth - x : x,
    y: point.y * scale + cropY,
  };
}

export function previewCanvasSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): { width: number; height: number } {
  const ratio = Math.max(1, devicePixelRatio);
  return {
    width: Math.round(cssWidth * ratio),
    height: Math.round(cssHeight * ratio),
  };
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function projectPageRectCenter(
  rect: Rect,
  quad: Quad,
  pageWidth: number,
  pageHeight: number,
  metrics: PreviewMetrics,
): Point {
  return frameToPreview(
    correctedPageToFrame(rectCenter(rect), quad, pageWidth, pageHeight),
    metrics,
  );
}

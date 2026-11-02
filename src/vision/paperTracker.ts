import type { Point, Quad } from "../types";
import { dist, quadArea } from "../lib/geometry";
import { imageDataToMat } from "./opencvLoader";
import { detectDocument } from "./documentDetector";
import { laplacianSharpness, toGrayscale } from "../lib/image";

export type TrackingMethod = "detector" | "optical-flow";

export interface PaperObservation {
  found: boolean;
  quad: Quad | null;
  method: TrackingMethod | null;
  sharpness: number;
  inliers?: number;
  inlierRatio?: number;
  reason?: string;
}

export interface TrackingSnapshot extends PaperObservation {
  state: "lost" | "acquired" | "tracked";
  sourceWidth: number;
  sourceHeight: number;
  timestamp: number;
  event?: "lost" | "reacquired";
}

function pointInQuad(point: Point, quad: Quad): boolean {
  const vertices = [quad.tl, quad.tr, quad.br, quad.bl];
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i];
    const b = vertices[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function validQuad(quad: Quad, width: number, height: number): boolean {
  const points = [quad.tl, quad.tr, quad.br, quad.bl];
  if (!points.every((point) =>
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= -width * 0.08 &&
    point.x <= width * 1.08 &&
    point.y >= -height * 0.08 &&
    point.y <= height * 1.08
  )) return false;
  const area = quadArea(quad);
  return area >= width * height * 0.16 && area <= width * height * 0.99;
}

function flowTrack(
  cv: OpenCV,
  previousGray: CvMat,
  currentGray: CvMat,
  quad: Quad,
): { quad: Quad; inliers: number; inlierRatio: number } | null {
  const methods = [
    cv.goodFeaturesToTrack,
    cv.calcOpticalFlowPyrLK,
    cv.findHomography,
    cv.perspectiveTransform,
    cv.TermCriteria,
  ];
  if (methods.some((method) => typeof method !== "function")) return null;

  const corners = new cv.Mat();
  let oldPoints: CvMat | null = null;
  let nextPoints: CvMat | null = null;
  let status: CvMat | null = null;
  let errors: CvMat | null = null;
  let inlierMask: CvMat | null = null;
  let transform: CvMat | null = null;
  let paperPoints: CvMat | null = null;
  let nextPaperPoints: CvMat | null = null;
  try {
    cv.goodFeaturesToTrack!(previousGray, corners, 120, 0.01, 5, null, 3, false, 0.04);
    const values = corners.data32F;
    const points: Point[] = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      const point = { x: values[i], y: values[i + 1] };
      if (pointInQuad(point, quad)) points.push(point);
    }
    if (points.length < 8) return null;

    oldPoints = cv.matFromArray(
      points.length,
      1,
      cv.CV_32FC2,
      points.flatMap((point) => [point.x, point.y]),
    );
    nextPoints = new cv.Mat();
    status = new cv.Mat();
    errors = new cv.Mat();
    const criteria = new cv.TermCriteria(
      cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT,
      30,
      0.01,
    );
    cv.calcOpticalFlowPyrLK!(
      previousGray,
      currentGray,
      oldPoints,
      nextPoints,
      status,
      errors,
      new cv.Size(21, 21),
      3,
      criteria,
      0,
      0.001,
    );
    const goodFrom: number[] = [];
    const goodTo: number[] = [];
    const trackedValues = nextPoints.data32F;
    for (let i = 0; i < points.length; i++) {
      if (!status.data[i]) continue;
      const x = trackedValues[i * 2];
      const y = trackedValues[i * 2 + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      goodFrom.push(points[i].x, points[i].y);
      goodTo.push(x, y);
    }
    if (goodFrom.length / 2 < 6) return null;

    const count = goodFrom.length / 2;
    const from = cv.matFromArray(count, 1, cv.CV_32FC2, goodFrom);
    const to = cv.matFromArray(count, 1, cv.CV_32FC2, goodTo);
    inlierMask = new cv.Mat();
    try {
      transform = cv.findHomography!(from, to, cv.RANSAC, 3, inlierMask);
    } finally {
      from.delete();
      to.delete();
    }
    const inliers = Array.from(inlierMask.data).reduce((sum, value) => sum + Number(value > 0), 0);
    const inlierRatio = inliers / count;
    if (inliers < 6 || inlierRatio < 0.55 || !transform.rows) return null;

    const cornersInOrder = [quad.tl, quad.tr, quad.br, quad.bl];
    paperPoints = cv.matFromArray(
      4,
      1,
      cv.CV_32FC2,
      cornersInOrder.flatMap((point) => [point.x, point.y]),
    );
    nextPaperPoints = new cv.Mat();
    cv.perspectiveTransform!(paperPoints, nextPaperPoints, transform);
    const projected = nextPaperPoints.data32F;
    const trackedQuad: Quad = {
      tl: { x: projected[0], y: projected[1] },
      tr: { x: projected[2], y: projected[3] },
      br: { x: projected[4], y: projected[5] },
      bl: { x: projected[6], y: projected[7] },
    };
    return { quad: trackedQuad, inliers, inlierRatio };
  } finally {
    corners.delete();
    oldPoints?.delete();
    nextPoints?.delete();
    status?.delete();
    errors?.delete();
    inlierMask?.delete();
    transform?.delete();
    paperPoints?.delete();
    nextPaperPoints?.delete();
  }
}

export class PaperFrameTracker {
  private previousGray: CvMat | null = null;
  private quad: Quad | null = null;
  private framesSinceDetection = 0;
  private width = 0;
  private height = 0;

  update(data: ImageData, cv: OpenCV | null): PaperObservation {
    const sharpness = laplacianSharpness(toGrayscale(data), data.width, data.height);
    if (sharpness < 16) {
      this.reset();
      return { found: false, quad: null, method: null, sharpness, reason: "Image is too blurry to track." };
    }

    let rgba: CvMat | null = null;
    let currentGray: CvMat | null = null;
    let flow: ReturnType<typeof flowTrack> = null;
    try {
      if (cv?.Mat && cv.cvtColor) {
        rgba = imageDataToMat(cv, data);
        currentGray = new cv.Mat();
        cv.cvtColor(rgba, currentGray, cv.COLOR_RGBA2GRAY);
        if (this.previousGray && this.quad && this.width === data.width && this.height === data.height) {
          flow = flowTrack(cv, this.previousGray, currentGray, this.quad);
        }
      }

      const checkDetection =
        !flow || this.framesSinceDetection >= 10 || !this.quad;
      let detectorQuad: Quad | null = null;
      if (checkDetection) {
        const detection = detectDocument(data, cv);
        if (detection.found && detection.quad) detectorQuad = detection.quad;
        if (!detectorQuad) {
          this.reset();
          return {
            found: false,
            quad: null,
            method: null,
            sharpness,
            reason: detection.message || "Paper not detected.",
          };
        }
      }

      let nextQuad: Quad;
      let method: TrackingMethod;
      let inliers: number | undefined;
      let inlierRatio: number | undefined;
      if (flow) {
        nextQuad = flow.quad;
        method = "optical-flow";
        inliers = flow.inliers;
        inlierRatio = flow.inlierRatio;
        if (
          detectorQuad &&
          Math.max(
            dist(detectorQuad.tl, nextQuad.tl),
            dist(detectorQuad.tr, nextQuad.tr),
            dist(detectorQuad.br, nextQuad.br),
            dist(detectorQuad.bl, nextQuad.bl),
          ) > Math.max(14, Math.hypot(data.width, data.height) * 0.08)
        ) {
          this.reset();
          return {
            found: false,
            quad: null,
            method: null,
            sharpness,
            inliers,
            inlierRatio,
            reason: "Tracking and document detection disagree; reacquiring.",
          };
        }
        this.framesSinceDetection = detectorQuad ? 0 : this.framesSinceDetection + 1;
      } else {
        if (!detectorQuad) {
          this.reset();
          return { found: false, quad: null, method: null, sharpness, reason: "Paper not detected." };
        }
        nextQuad = detectorQuad;
        method = "detector";
        this.framesSinceDetection = 0;
      }

      if (!validQuad(nextQuad, data.width, data.height)) {
        this.reset();
        return { found: false, quad: null, method: null, sharpness, reason: "Paper tracking became unreliable." };
      }
      this.quad = nextQuad;
      this.width = data.width;
      this.height = data.height;
      if (currentGray) {
        this.previousGray?.delete();
        this.previousGray = currentGray;
        currentGray = null;
      }
      return { found: true, quad: nextQuad, method, sharpness, inliers, inlierRatio };
    } catch (error) {
      this.reset();
      return {
        found: false,
        quad: null,
        method: null,
        sharpness,
        reason: error instanceof Error ? `Tracking failed: ${error.message}` : "Tracking failed.",
      };
    } finally {
      rgba?.delete();
      currentGray?.delete();
    }
  }

  reset(): void {
    this.previousGray?.delete();
    this.previousGray = null;
    this.quad = null;
    this.framesSinceDetection = 0;
    this.width = 0;
    this.height = 0;
  }

  dispose(): void {
    this.reset();
  }
}

export function updateTrackingSnapshot(
  previous: TrackingSnapshot,
  observation: PaperObservation,
  sourceWidth: number,
  sourceHeight: number,
  timestamp: number,
): TrackingSnapshot {
  const acceptable =
    observation.found &&
    observation.quad !== null &&
    observation.sharpness >= 16 &&
    (observation.method === "detector" ||
      (observation.inliers !== undefined &&
        observation.inliers >= 6 &&
        (observation.inlierRatio ?? 0) >= 0.55));
  if (!acceptable || !observation.quad) {
    return {
      found: false,
      quad: null,
      method: null,
      sharpness: observation.sharpness,
      reason: observation.reason ?? "Paper not detected.",
      state: "lost",
      sourceWidth,
      sourceHeight,
      timestamp,
      event: previous.found ? "lost" : undefined,
    };
  }
  const reacquired = !previous.found;
  const quad = previous.found && previous.quad
    ? smoothQuad(previous.quad, observation.quad, 0.72)
    : observation.quad;
  return {
    ...observation,
    found: true,
    quad,
    state: reacquired ? "acquired" : "tracked",
    sourceWidth,
    sourceHeight,
    timestamp,
    event: reacquired && previous.timestamp > 0 && previous.state === "lost" ? "reacquired" : undefined,
  };
}

function smoothQuad(previous: Quad, next: Quad, alpha: number): Quad {
  const mix = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
  });
  return {
    tl: mix(previous.tl, next.tl),
    tr: mix(previous.tr, next.tr),
    br: mix(previous.br, next.br),
    bl: mix(previous.bl, next.bl),
  };
}

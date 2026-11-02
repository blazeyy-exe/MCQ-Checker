import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { GradingResult, Point } from "../../types";
import { correctedPageToFrameHomography, frameToPreview, type PreviewMetrics } from "../../vision/arCoordinates";
import {
  gradingMarkers,
  orientedTrackingQuad,
  projectGradingMarkers,
  shouldShowGradingOverlay,
  type OverlayColor,
} from "../../vision/liveOverlay";
import type { TrackingEvent } from "../../hooks/useScanner";
import type { TrackingSnapshot } from "../../vision/paperTracker";

interface Props {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  trackingRef: MutableRefObject<TrackingSnapshot>;
  tracking: TrackingSnapshot;
  result: GradingResult | null;
  answerKeyConfirmed: boolean;
  lastRecognitionAt: number | null;
  trackingEvents: TrackingEvent[];
  overlayVisible: boolean;
  mirrored?: boolean;
}

const COLORS: Record<OverlayColor, string> = {
  green: "#16A34A",
  red: "#E5484D",
  blue: "#1E90FF",
  orange: "#F59E0B",
};
const TINTS: Record<OverlayColor, string> = {
  green: "rgba(22, 163, 74, 0.22)",
  red: "rgba(229, 72, 77, 0.22)",
  blue: "rgba(30, 144, 255, 0.22)",
  orange: "rgba(245, 158, 11, 0.22)",
};
const SYMBOLS: Record<OverlayColor, string> = {
  green: "✓",
  red: "×",
  blue: "—",
  orange: "?",
};
const TEXT_COLORS: Record<OverlayColor, string> = {
  green: "#0F6B30",
  red: "#B4232A",
  blue: "#005A9C",
  orange: "#8A4B04",
};

function drawMarker(
  context: CanvasRenderingContext2D,
  point: Point,
  label: string,
  color: string,
  tint: string,
  textColor: string,
  symbol: string,
  scale: number,
): void {
  context.save();
  context.translate(point.x, point.y);
  context.scale(scale, scale);
  context.lineWidth = 3;
  context.strokeStyle = color;
  context.fillStyle = "#FFFFFF";
  context.beginPath();
  context.arc(0, 0, 13, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = tint;
  context.fill();
  context.stroke();
  context.fillStyle = textColor;
  context.font = '700 12px "Plus Jakarta Sans", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(`${symbol} ${label.match(/^\d+/)?.[0] ?? ""}`.trim(), 0, 0);
  context.restore();
}

export function LiveGradingOverlay({
  videoRef,
  trackingRef,
  tracking,
  result,
  answerKeyConfirmed,
  lastRecognitionAt,
  trackingEvents,
  overlayVisible: hookOverlayVisible,
  mirrored = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const markerStartedAtRef = useRef(new Map<string, number>());

  useEffect(() => {
    let active = true;
    let animationFrame = 0;
    const render = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        animationFrame = requestAnimationFrame(render);
        return;
      }
      const canvasRect = canvas.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(canvasRect.width * ratio));
      const height = Math.max(1, Math.round(canvasRect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        animationFrame = requestAnimationFrame(render);
        return;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, canvasRect.width, canvasRect.height);

      const current = trackingRef.current;
      const trackingFresh =
        current.found &&
        current.quad !== null &&
        performance.now() - current.timestamp < 350 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0;
      if (trackingFresh && current.quad) {
        const metrics: PreviewMetrics = {
          sourceWidth: video.videoWidth,
          sourceHeight: video.videoHeight,
          previewWidth: videoRect.width,
          previewHeight: videoRect.height,
          devicePixelRatio: ratio,
          mirrored,
        };
        const previewOffset = {
          x: videoRect.left - canvasRect.left,
          y: videoRect.top - canvasRect.top,
        };
        const previewPoint = (point: Point) => {
          const mapped = frameToPreview(point, metrics);
          return { x: mapped.x + previewOffset.x, y: mapped.y + previewOffset.y };
        };
        const corners = [current.quad.tl, current.quad.tr, current.quad.br, current.quad.bl].map(previewPoint);
        context.beginPath();
        corners.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.closePath();
        context.strokeStyle = "#FFC531";
        context.lineWidth = 3;
        context.setLineDash([8, 6]);
        context.stroke();
        context.setLineDash([]);

        const markers = projectGradingMarkers(result, answerKeyConfirmed, current.quad, metrics);
        const activeMarkers = new Set(markers.map((marker) => `${marker.questionNumber}:${marker.status}`));
        for (const key of markerStartedAtRef.current.keys()) {
          if (!activeMarkers.has(key)) markerStartedAtRef.current.delete(key);
        }
        for (const marker of markers) {
          const key = `${marker.questionNumber}:${marker.status}`;
          const startedAt = markerStartedAtRef.current.get(key) ?? performance.now();
          markerStartedAtRef.current.set(key, startedAt);
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const scale = reducedMotion ? 1 : Math.min(1, 0.75 + (performance.now() - startedAt) / 600);
          drawMarker(
            context,
            { x: marker.point.x + previewOffset.x, y: marker.point.y + previewOffset.y },
            marker.label,
            COLORS[marker.color],
            TINTS[marker.color],
            TEXT_COLORS[marker.color],
            SYMBOLS[marker.color],
            scale,
          );
        }
      } else {
        markerStartedAtRef.current.clear();
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [answerKeyConfirmed, mirrored, result, trackingRef, videoRef]);

  const current = trackingRef.current;
  const videoElement = videoRef.current;
  const videoRect = videoElement?.getBoundingClientRect();
  const previewScale = videoElement?.videoWidth && videoRect
    ? Math.max(videoRect.width / videoElement.videoWidth, videoRect.height / videoElement.videoHeight)
    : null;
  const cropX = previewScale && videoElement && videoRect
    ? (videoRect.width - videoElement.videoWidth * previewScale) / 2
    : null;
  const cropY = previewScale && videoElement && videoRect
    ? (videoRect.height - videoElement.videoHeight * previewScale) / 2
    : null;
  const debugMatrix =
    current.found && current.quad && result?.debug
      ? correctedPageToFrameHomography(orientedTrackingQuad(current.quad), result.debug.pageWidth, result.debug.pageHeight)
      : null;
  const markerCount = gradingMarkers(result, answerKeyConfirmed).length;
  const debugProjectedMarkers =
    current.found && current.quad && videoElement?.videoWidth && videoRect && result
      ? projectGradingMarkers(result, answerKeyConfirmed, current.quad, {
          sourceWidth: videoElement.videoWidth,
          sourceHeight: videoElement.videoHeight,
          previewWidth: videoRect.width,
          previewHeight: videoRect.height,
          devicePixelRatio: window.devicePixelRatio || 1,
          mirrored,
        })
      : [];
  const visible =
    tracking.found &&
    shouldShowGradingOverlay(result, answerKeyConfirmed, current, performance.now());

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        role="img"
        aria-label="Live grading overlay: tick means correct, cross means incorrect, dash means unanswered, and question mark means review."
      />
      <div className="absolute right-4 top-14 z-20">
        <label className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] text-white">
          <input type="checkbox" checked={debugEnabled} onChange={(event) => setDebugEnabled(event.target.checked)} />
          Tracking debug
        </label>
      </div>
      {debugEnabled && (
        <div className="absolute inset-x-3 bottom-20 z-20 max-h-36 overflow-auto rounded-xl bg-black/75 p-3 font-mono text-[10px] text-white">
          <p>Detection: {current.found ? `${current.state} via ${current.method}` : current.reason ?? "lost"}</p>
          <p>Tracked corners (video px): {current.quad ? JSON.stringify(current.quad) : "none"}</p>
          <p>Flow inliers: {current.inliers ?? "detector acquisition"} · quality {current.inlierRatio?.toFixed(2) ?? "n/a"}</p>
          <p>Last recognition: {lastRecognitionAt ? new Date(lastRecognitionAt).toLocaleTimeString() : "none"}</p>
          <p>Overlay visible: {visible && hookOverlayVisible ? "yes" : "no"} · markers: {markerCount}</p>
          <p>Coordinate map: page pixels → projective camera-frame homography → cover crop → CSS pixels → DPR canvas</p>
          {debugMatrix && <p>Current homography: {debugMatrix.map((value) => value.toFixed(4)).join(", ")}</p>}
          {previewScale !== null && <p>Cover scale: {previewScale.toFixed(4)} · crop offset: ({cropX?.toFixed(1)}, {cropY?.toFixed(1)}) CSS px</p>}
          <p>Projected markers (video-element CSS px): {debugProjectedMarkers.map((marker) => `${marker.label}@${marker.point.x.toFixed(1)},${marker.point.y.toFixed(1)}`).join(" · ") || "none"}</p>
          <p>Recent tracking events: {trackingEvents.slice(0, 4).map((event) => `${event.kind}@${new Date(event.at).toLocaleTimeString()}`).join(", ") || "none"}</p>
          <p>Preview mirrored: {mirrored ? "yes" : "no"} · DPR: {window.devicePixelRatio || 1}</p>
        </div>
      )}
    </>
  );
}

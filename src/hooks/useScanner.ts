import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { AnswerKey, GradingResult, PaperLayout, Quad, ScannerPhase } from "../types";
import { canvasToImageData, downscaleImageData, hamming, averageHash, videoFrameToCanvas } from "../lib/image";
import { meanQuadDelta, quadArea, scaleQuad } from "../lib/geometry";
import { gradePaperSource } from "../grading/runGrading";
import { isAnswerKeyComplete } from "../grading/answerKeyModel";
import { useOpenCV } from "./useOpenCV";
import { PaperFrameTracker, updateTrackingSnapshot, type TrackingSnapshot } from "../vision/paperTracker";
import { startFrameLoop } from "../vision/frameLoop";
import { shouldShowGradingOverlay } from "../vision/liveOverlay";

interface ScannerOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  autoScan: boolean;
  key: AnswerKey | null;
  sessionId: string | null;
  layout: PaperLayout | null;
}

export interface TrackingEvent {
  kind: "lost" | "reacquired";
  at: number;
  message: string;
}

function emptyTrackingSnapshot(): TrackingSnapshot {
  return {
    found: false,
    quad: null,
    method: null,
    sharpness: 0,
    state: "lost",
    sourceWidth: 0,
    sourceHeight: 0,
    timestamp: 0,
  };
}

export function useScanner({ videoRef, enabled, autoScan, key, sessionId, layout }: ScannerOptions) {
  const { cv } = useOpenCV();
  const [phase, setPhase] = useState<ScannerPhase>("waiting");
  const [message, setMessage] = useState("Position the student's paper inside the frame.");
  const [coverage, setCoverage] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<GradingResult | null>(null);
  const [overlayResult, setOverlayResult] = useState<GradingResult | null>(null);
  const [tracking, setTracking] = useState<TrackingSnapshot>(emptyTrackingSnapshot);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [lastRecognitionAt, setLastRecognitionAt] = useState<number | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const trackingRef = useRef<TrackingSnapshot>(emptyTrackingSnapshot());
  const cvRef = useRef(cv);
  cvRef.current = cv;
  const trackerRef = useRef<PaperFrameTracker | null>(null);
  if (!trackerRef.current) trackerRef.current = new PaperFrameTracker();
  const stableRef = useRef<{ quad: Quad | null; since: number }>({ quad: null, since: 0 });
  const lastPreviewInspectRef = useRef(0);
  const lastHashRef = useRef<string>("");
  const paperPresentRef = useRef(false);
  const gradedOnceRef = useRef(false);
  const runningRef = useRef(false);
  const trackingGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const phaseRef = useRef<ScannerPhase>("waiting");
  const lastResultRef = useRef<GradingResult | null>(null);
  const overlayResultRef = useRef<GradingResult | null>(null);
  const lastReactUpdateRef = useRef(0);
  const captureRef = useRef<() => Promise<void>>(async () => {});
  const optionsRef = useRef({ autoScan, key, sessionId });
  phaseRef.current = phase;
  lastResultRef.current = lastResult;
  overlayResultRef.current = overlayResult;
  optionsRef.current = { autoScan, key, sessionId };

  const captureAndGrade = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !key || !sessionId || runningRef.current) return;
    runningRef.current = true;
    const generation = trackingGenerationRef.current;
    setBusy(true);
    setPhase("scanning");
    setMessage("Reading the paper…");
    try {
      const canvas = videoFrameToCanvas(video, 1600);
      const data = canvasToImageData(canvas);
      const hash = averageHash(downscaleImageData(data, 64), 16);
      if (lastHashRef.current && hamming(hash, lastHashRef.current) < 18) {
        setMessage("This paper was already graded. Move it out of view, then capture again.");
        setPhase("ready");
        return;
      }
      const result = await gradePaperSource({
        source: canvas,
        key,
        sessionId,
        layout,
      });
      if (!mountedRef.current) return;
      if (generation !== trackingGenerationRef.current) {
        paperPresentRef.current = false;
        setPhase("waiting");
        setMessage("The paper moved during grading. Reposition it and capture again.");
        return;
      }
      lastHashRef.current = hash;
      gradedOnceRef.current = true;
      lastResultRef.current = result;
      setLastResult(result);
      const currentOverlayResult = trackingRef.current.found ? result : null;
      overlayResultRef.current = currentOverlayResult;
      setOverlayResult(currentOverlayResult);
      setLastRecognitionAt(Date.now());
      const supported = isAnswerKeyComplete(key) && key.confirmed;
      setOverlayVisible(shouldShowGradingOverlay(currentOverlayResult, supported, trackingRef.current, performance.now()));
      setPhase("graded");
      setMessage(result.verified ? `${result.score} / ${result.total}` : "Graded — some answers need review.");
    } catch (err) {
      if (mountedRef.current) {
        setPhase("waiting");
        setMessage(err instanceof Error ? err.message : "Could not grade this paper.");
      }
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, [videoRef, key, sessionId, layout]);
  captureRef.current = captureAndGrade;

  const scanNext = useCallback(() => {
    paperPresentRef.current = trackingRef.current.found;
    gradedOnceRef.current = false;
    lastHashRef.current = "";
    lastResultRef.current = null;
    overlayResultRef.current = null;
    setLastResult(null);
    setOverlayResult(null);
    setOverlayVisible(false);
    setPhase("waiting");
    setMessage("Remove the current paper, then position the next paper inside the frame.");
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      trackerRef.current?.dispose();
      trackingGenerationRef.current++;
      const wasFound = trackingRef.current.found;
      trackingRef.current = emptyTrackingSnapshot();
      setTracking(trackingRef.current);
      lastResultRef.current = null;
      overlayResultRef.current = null;
      setLastResult(null);
      setOverlayResult(null);
      setOverlayVisible(false);
      if (wasFound) setMessage("Camera paused. Reposition the paper when scanning resumes.");
      return;
    }

    let active = true;
    const tracker = trackerRef.current;
    if (!tracker) return;
    const video = videoRef.current;
    if (!video) return;
    const videoWithFrameCallback = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: (now: number) => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    const useVideoFrameCallback =
      typeof videoWithFrameCallback.requestVideoFrameCallback === "function" &&
      typeof videoWithFrameCallback.cancelVideoFrameCallback === "function";
    const schedule = (callback: (now: number) => void) =>
      useVideoFrameCallback
        ? videoWithFrameCallback.requestVideoFrameCallback(callback)
        : requestAnimationFrame(callback);
    const cancel = (handle: number) => {
      if (useVideoFrameCallback) {
        videoWithFrameCallback.cancelVideoFrameCallback(handle);
      } else {
        cancelAnimationFrame(handle);
      }
    };

    const stopLoop = startFrameLoop(schedule, cancel, (frameTime) => {
      if (!active) return;
      const currentVideo = videoRef.current;
      if (!currentVideo?.videoWidth || currentVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const now = Number.isFinite(frameTime) ? frameTime : performance.now();
      if (now - lastPreviewInspectRef.current < 65) return;
      lastPreviewInspectRef.current = now;

      const frame = videoFrameToCanvas(currentVideo, 360);
      const data = canvasToImageData(frame);
      let previous = trackingRef.current;
      if (previous.found && now - previous.timestamp >= 350) {
        tracker.reset();
        trackingGenerationRef.current++;
        paperPresentRef.current = false;
        overlayResultRef.current = null;
        setOverlayResult(null);
        setOverlayVisible(false);
        previous = {
          ...previous,
          found: false,
          quad: null,
          method: null,
          reason: "Tracking frame became stale; reacquiring the paper.",
          state: "lost",
          event: "lost",
        };
        trackingRef.current = previous;
        const staleEvent: TrackingEvent = {
          kind: "lost",
          at: Date.now(),
          message: "Camera frames paused; overlay cleared before reacquisition.",
        };
        setTrackingEvents((events) => [staleEvent, ...events].slice(0, 12));
        setMessage("Tracking paused; reacquiring the paper.");
      }
      const observation = tracker.update(data, cvRef.current);
      const sourceQuad = observation.quad
        ? scaleQuad(
            observation.quad,
            currentVideo.videoWidth / data.width,
            currentVideo.videoHeight / data.height,
          )
        : null;
      const snapshot = updateTrackingSnapshot(
        previous,
        { ...observation, quad: sourceQuad },
        currentVideo.videoWidth,
        currentVideo.videoHeight,
        now,
      );
      trackingRef.current = snapshot;

      if (snapshot.event) {
        const event: TrackingEvent = {
          kind: snapshot.event,
          at: Date.now(),
          message: snapshot.event === "lost"
            ? snapshot.reason ?? "Paper tracking lost; overlay cleared."
            : "Paper reacquired; checking alignment.",
        };
        setTrackingEvents((events) => [event, ...events].slice(0, 12));
      }

      if (previous.found && !snapshot.found) {
        setTracking(snapshot);
        trackingGenerationRef.current++;
        paperPresentRef.current = false;
        lastHashRef.current = "";
        overlayResultRef.current = null;
        setOverlayResult(null);
        setOverlayVisible(false);
        stableRef.current = { quad: null, since: 0 };
        setCoverage(0);
        setSharpness(snapshot.sharpness);
        setPhase("waiting");
        setMessage(snapshot.reason ?? "Paper not detected. Reposition the paper.");
      } else if (snapshot.found && snapshot.quad) {
        const analysisQuad = observation.quad;
        const previousAnalysis = stableRef.current.quad;
        const delta = previousAnalysis && analysisQuad ? meanQuadDelta(previousAnalysis, analysisQuad) : Infinity;
        if (delta < 7) {
          if (!stableRef.current.since) stableRef.current.since = now;
        } else {
          stableRef.current = { quad: analysisQuad, since: now };
        }
        stableRef.current.quad = analysisQuad;
        const stableFor = now - stableRef.current.since;
        if (snapshot.event === "reacquired" && gradedOnceRef.current) {
          setMessage("Paper reacquired. Capture again to refresh its live grading overlay.");
        }
        if (!runningRef.current && phaseRef.current !== "graded") {
          setPhase(stableFor > 420 ? "stabilizing" : "detecting");
          setMessage(stableFor > 420 ? "Paper detected. Hold still or capture." : "Tracking paper…");
        }
        if (
          stableFor > 420 &&
          optionsRef.current.autoScan &&
          optionsRef.current.key &&
          optionsRef.current.sessionId &&
          !paperPresentRef.current &&
          !gradedOnceRef.current &&
          !runningRef.current
        ) {
          paperPresentRef.current = true;
          void captureRef.current();
        }
      }

      if (now - lastReactUpdateRef.current >= 140) {
        lastReactUpdateRef.current = now;
        setTracking(snapshot);
        setSharpness(snapshot.sharpness);
        setCoverage(
          snapshot.quad
            ? quadArea(snapshot.quad) / (currentVideo.videoWidth * currentVideo.videoHeight)
            : 0,
        );
        if (lastResultRef.current) {
          const currentKey = optionsRef.current.key;
          const supported = Boolean(currentKey && isAnswerKeyComplete(currentKey) && currentKey.confirmed);
          setOverlayVisible(shouldShowGradingOverlay(overlayResultRef.current, supported, snapshot, now));
        }
      }
    });

    return () => {
      active = false;
      stopLoop();
      tracker.dispose();
      trackingGenerationRef.current++;
      trackingRef.current = emptyTrackingSnapshot();
    };
  }, [enabled, videoRef]);

  return {
    phase,
    message,
    coverage,
    sharpness,
    busy,
    lastResult,
    overlayResult,
    captureAndGrade,
    scanNext,
    setLastResult,
    trackingRef,
    tracking,
    trackingEvents,
    lastRecognitionAt,
    overlayVisible,
  };
}

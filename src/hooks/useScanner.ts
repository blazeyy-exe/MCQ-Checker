import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { AnswerKey, GradingResult, PaperLayout, Quad, ScannerPhase } from "../types";
import { detectDocument } from "../vision/documentDetector";
import { canvasToImageData, downscaleImageData, hamming, averageHash, videoFrameToCanvas } from "../lib/image";
import { meanQuadDelta } from "../lib/geometry";
import { gradePaperSource } from "../grading/runGrading";
import { useOpenCV } from "./useOpenCV";

interface ScannerOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  autoScan: boolean;
  key: AnswerKey | null;
  sessionId: string | null;
  layout: PaperLayout | null;
}

export function useScanner({ videoRef, enabled, autoScan, key, sessionId, layout }: ScannerOptions) {
  const { cv } = useOpenCV();
  const [phase, setPhase] = useState<ScannerPhase>("waiting");
  const [message, setMessage] = useState("Position the student's paper inside the frame.");
  const [quad, setQuad] = useState<Quad | null>(null);
  const [coverage, setCoverage] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<GradingResult | null>(null);
  const stableRef = useRef<{ quad: Quad | null; since: number }>({ quad: null, since: 0 });
  const lastHashRef = useRef<string>("");
  const paperPresentRef = useRef(false);
  const runningRef = useRef(false);
  const phaseRef = useRef<ScannerPhase>("waiting");
  phaseRef.current = phase;

  const captureAndGrade = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !key || !sessionId || runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    setPhase("scanning");
    setMessage("Reading the paper…");
    try {
      const canvas = videoFrameToCanvas(video, 1600);
      const data = canvasToImageData(canvas);
      const hash = averageHash(downscaleImageData(data, 64), 16);
      if (lastHashRef.current && hamming(hash, lastHashRef.current) < 18) {
        setMessage("This paper was already graded. Move to the next student.");
        setPhase("ready");
        return;
      }
      const result = await gradePaperSource({
        source: canvas,
        key,
        sessionId,
        layout,
        assumeFullFrame: true,
      });
      lastHashRef.current = hash;
      setLastResult(result);
      setPhase("graded");
      setMessage(result.verified ? `${result.score} / ${result.total}` : "Graded — some answers need review.");
    } catch (err) {
      setPhase("waiting");
      setMessage(err instanceof Error ? err.message : "Could not grade this paper.");
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  }, [videoRef, key, sessionId, layout]);

  const scanNext = useCallback(() => {
    paperPresentRef.current = false;
    setLastResult(null);
    setPhase("waiting");
    setMessage("Position the next student's paper inside the frame.");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let raf = 0;
    let timeout = 0;

    const inspect = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const currentPhase = phaseRef.current;
      if (!video?.videoWidth) return;
      if (runningRef.current || currentPhase === "graded" || currentPhase === "scanning") return;
      const frame = videoFrameToCanvas(video, 360);
      const data = canvasToImageData(frame);
      const detection = detectDocument(data, cv);
      setCoverage(detection.coverage);
      setSharpness(detection.sharpness);
      if (!detection.found || !detection.quad) {
        paperPresentRef.current = false;
        stableRef.current = { quad: null, since: 0 };
        setQuad(null);
        setPhase("waiting");
        setMessage(detection.message);
        return;
      }
      setQuad(detection.quad);
      const prev = stableRef.current.quad;
      const delta = prev ? meanQuadDelta(prev, detection.quad) : 999;
      const now = performance.now();
      if (delta < 7) {
        if (!stableRef.current.since) stableRef.current.since = now;
      } else {
        stableRef.current = { quad: detection.quad, since: now };
      }
      stableRef.current.quad = detection.quad;
      const stableFor = now - (stableRef.current.since || now);
      setPhase("detecting");
      setMessage(detection.message);
      const sharpEnough = detection.sharpness > 16;
      const closeEnough = detection.coverage > 0.32 && detection.coverage < 0.97;
      if (closeEnough && sharpEnough && stableFor > 420) {
        setPhase("stabilizing");
        setMessage("Hold still…");
        if (autoScan && key && sessionId && !paperPresentRef.current) {
          paperPresentRef.current = true;
          void captureAndGrade();
        }
      }
    };

    const loop = () => {
      inspect();
      const video = videoRef.current as (HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }) | null;
      if (video?.requestVideoFrameCallback) {
        raf = video.requestVideoFrameCallback(() => loop());
      } else {
        timeout = window.setTimeout(() => {
          raf = requestAnimationFrame(loop);
        }, 110);
      }
    };
    loop();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [enabled, videoRef, cv, autoScan, key, sessionId, captureAndGrade]);

  return {
    phase,
    message,
    quad,
    coverage,
    sharpness,
    busy,
    lastResult,
    captureAndGrade,
    scanNext,
    setLastResult,
  };
}

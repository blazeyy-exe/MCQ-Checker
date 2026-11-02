import type { RefObject, MutableRefObject } from "react";
import type { CameraDevice } from "../../hooks/useCamera";
import type { GradingResult, ScannerPhase } from "../../types";
import { Flashlight } from "lucide-react";
import { Link } from "react-router-dom";
import { LiveGradingOverlay } from "./LiveGradingOverlay";
import type { TrackingEvent } from "../../hooks/useScanner";
import type { TrackingSnapshot } from "../../vision/paperTracker";
import { TickdMark } from "../UI/TickdMark";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  phase: ScannerPhase;
  message: string;
  devices: CameraDevice[];
  deviceId: string;
  torchOn: boolean;
  torchSupported: boolean;
  coverage: number;
  sharpness: number;
  onSwitch: (id: string) => void;
  onTorch: () => void;
  onCapture: () => void;
  busy?: boolean;
  trackingRef: MutableRefObject<TrackingSnapshot>;
  tracking: TrackingSnapshot;
  trackingEvents: TrackingEvent[];
  result: GradingResult | null;
  overlayResult: GradingResult | null;
  answerKeyConfirmed: boolean;
  lastRecognitionAt: number | null;
  overlayVisible: boolean;
  overlayEnabled: boolean;
  onScanNext: () => void;
  mirrored?: boolean;
  answerKeyName: string;
  liveOverlay: boolean;
  onToggleOverlay: () => void;
  autoScan: boolean;
  onToggleAutoScan: () => void;
  studentLabel: string;
  onStudentLabelChange: (value: string) => void;
  onUploadFile: (file: File) => void;
  uploadBusy: boolean;
}

const PHASE_COPY: Record<ScannerPhase, string> = {
  waiting: "WAITING",
  detecting: "DETECTING",
  stabilizing: "STABILIZING",
  analyzing: "ANALYZING",
  scanning: "SCANNING",
  graded: "GRADED",
  ready: "READY FOR NEXT",
};

export function CameraScanner({
  videoRef,
  phase,
  message,
  devices,
  deviceId,
  torchOn,
  torchSupported,
  coverage,
  sharpness,
  onSwitch,
  onTorch,
  onCapture,
  busy,
  trackingRef,
  tracking,
  trackingEvents,
  result,
  overlayResult,
  answerKeyConfirmed,
  lastRecognitionAt,
  overlayVisible,
  overlayEnabled,
  onScanNext,
  mirrored = false,
  answerKeyName,
  liveOverlay,
  onToggleOverlay,
  autoScan,
  onToggleAutoScan,
  studentLabel,
  onStudentLabelChange,
  onUploadFile,
  uploadBusy,
}: Props) {
  const toReview = result
    ? result.multiple + result.uncertain + result.questions.filter((question) => question.status === "missing").length
    : 0;

  return (
    <div className="camera-scanner fixed inset-0 z-40 overflow-hidden bg-navy">
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
        playsInline
        muted
        autoPlay
      />
      {overlayEnabled && (
        <LiveGradingOverlay
          videoRef={videoRef}
          trackingRef={trackingRef}
          tracking={tracking}
          result={overlayResult}
          answerKeyConfirmed={answerKeyConfirmed}
          lastRecognitionAt={lastRecognitionAt}
          trackingEvents={trackingEvents}
          overlayVisible={overlayVisible}
          mirrored={mirrored}
        />
      )}
      <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 text-white">
        <div className="flex items-center gap-2 rounded-full bg-navy/85 px-3 py-2">
          <TickdMark className="h-8 w-8" />
          <span className="font-extrabold tracking-[-0.03em]">Tickd</span>
        </div>
        <div className="max-w-[65%] rounded-full bg-navy/85 px-4 py-2 text-sm font-bold">
          {answerKeyName}
        </div>
        <span className="sr-only">{PHASE_COPY[phase]}: {message}</span>
      </header>
      <section className="absolute inset-x-0 bottom-0 max-h-[50dvh] overflow-y-auto rounded-t-[28px] bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-navy shadow-2xl sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 truncate text-sm font-semibold text-slate" role="status" title={message}>{message}</p>
          <div className="grid grid-cols-4 gap-2">
            <Count label="Correct" value={result?.correct ?? 0} symbol="✓" color="correct" />
            <Count label="Incorrect" value={result?.incorrect ?? 0} symbol="×" color="incorrect" />
            <Count label="Blank" value={result?.unanswered ?? 0} symbol="—" color="unanswered" />
            <Count label="To review" value={toReview} symbol="?" color="review" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              aria-label="Camera"
              value={deviceId}
              onChange={(e) => onSwitch(e.target.value)}
              className="min-w-0 flex-1 border border-rule bg-white px-3 py-2 text-sm"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
            {torchSupported && (
              <button
                type="button"
                onClick={onTorch}
                aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
                className={`flex h-11 w-11 items-center justify-center rounded-full ${torchOn ? "bg-yellow text-navy" : "bg-white text-navy"}`}
              >
                <Flashlight size={20} strokeWidth={2} strokeLinecap="round" />
              </button>
            )}
            <button type="button" onClick={onCapture} disabled={busy} className="primary-button px-5 disabled:opacity-50">
              {busy ? "Checking…" : "Capture"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="flex min-h-11 items-center gap-2 font-semibold">
              <input type="checkbox" checked={liveOverlay} onChange={onToggleOverlay} />
              Live overlay
            </label>
            <label className="flex min-h-11 items-center gap-2 font-semibold">
              <input type="checkbox" checked={autoScan} onChange={onToggleAutoScan} />
              Auto-capture
            </label>
            <span className="text-slate">Paper {Math.round(coverage * 100)}% · focus {Math.round(sharpness)}</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="sr-only" htmlFor="student-label">Student name or roll number</label>
            <input
              id="student-label"
              value={studentLabel}
              onChange={(event) => onStudentLabelChange(event.target.value)}
              placeholder="Student name or roll number"
              className="w-full border border-rule bg-white px-4 py-2"
            />
            <label className="secondary-button inline-flex cursor-pointer items-center justify-center px-4 text-sm">
              {uploadBusy ? "Reading…" : "Upload photo or PDF"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                className="sr-only"
                disabled={uploadBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadFile(file);
                }}
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {result ? (
              <>
                <Link to={`/results/${result.id}`} className="primary-button primary-button--large flex-1 text-center leading-[52px]">
                  Review results
                </Link>
                <button type="button" onClick={onScanNext} className="secondary-button px-4 text-sm">
                  Next paper
                </button>
              </>
            ) : (
              <button type="button" disabled className="primary-button primary-button--large flex-1 opacity-50">
                Review results
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Count({
  label,
  value,
  symbol,
  color,
}: {
  label: string;
  value: number;
  symbol: string;
  color: "correct" | "incorrect" | "unanswered" | "review";
}) {
  return (
    <div className={`rounded-xl bg-white px-2 py-2 text-center status-${color}`}>
      <p className="text-sm font-extrabold" aria-label={`${label} symbol`}>{symbol} <span className="text-lg">{value}</span></p>
      <p className="text-[10px] font-bold leading-tight">{label}</p>
    </div>
  );
}

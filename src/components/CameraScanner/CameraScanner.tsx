import type { RefObject } from "react";
import type { CameraDevice } from "../../hooks/useCamera";
import type { Quad, ScannerPhase } from "../../types";
import { Flashlight } from "lucide-react";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  phase: ScannerPhase;
  message: string;
  quad: Quad | null;
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
  quad,
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
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-black">
      <video
        ref={videoRef}
        className="aspect-[3/4] w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
        <div className="scan-cutout h-[72%] w-[78%] rounded-sm border border-white/70" />
        {quad && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 480" preserveAspectRatio="none">
            <polygon
              points={`${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`}
              fill="none"
              stroke="#7CFFB2"
              strokeWidth="3"
            />
          </svg>
        )}
      </div>
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 text-white">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em]">{PHASE_COPY[phase]}</p>
          <p className="mt-1 max-w-[16rem] text-sm">{message}</p>
        </div>
        <div className="rounded-full bg-black/40 px-3 py-1 text-[11px]">
          fill {Math.round(coverage * 100)}% · focus {Math.round(sharpness)}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent p-4">
        <select
          value={deviceId}
          onChange={(e) => onSwitch(e.target.value)}
          className="max-w-[42%] rounded-full bg-white/15 px-3 py-2 text-xs text-white"
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId} className="text-ink">
              {d.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          {torchSupported && (
            <button
              type="button"
              onClick={onTorch}
              className={`rounded-full p-3 ${torchOn ? "bg-amber-300 text-ink" : "bg-white/15 text-white"}`}
            >
              <Flashlight size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onCapture}
            disabled={busy}
            className="rounded-full bg-paper px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}

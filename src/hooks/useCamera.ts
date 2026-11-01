import { useCallback, useEffect, useRef, useState } from "react";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
    setTorchOn(false);
  }, []);

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const cams = all
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
    setDevices(cams);
    return cams;
  }, []);

  const start = useCallback(
    async (preferredId?: string) => {
      setError(null);
      stop();
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: preferredId
            ? { deviceId: { exact: preferredId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play();
        }
        const track = stream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(Boolean(capabilities.torch));
        const cams = await refreshDevices();
        const currentId = track.getSettings().deviceId;
        if (currentId) setDeviceId(currentId);
        else if (cams[0]) setDeviceId(cams[0].deviceId);
        setReady(true);
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission is required to scan papers."
            : "Could not start the camera.",
        );
      }
    },
    [refreshDevices, stop],
  );

  const switchCamera = useCallback(
    async (id: string) => {
      setDeviceId(id);
      await start(id);
    },
    [start],
  );

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] as unknown as MediaTrackConstraintSet[] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    videoRef,
    devices,
    deviceId,
    error,
    ready,
    torchOn,
    torchSupported,
    start,
    stop,
    switchCamera,
    toggleTorch,
  };
}

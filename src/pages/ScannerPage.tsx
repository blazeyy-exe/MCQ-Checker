import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CameraScanner } from "../components/CameraScanner/CameraScanner";
import { TopBrand } from "../components/UI/AppShell";
import { useCamera } from "../hooks/useCamera";
import { useScanner } from "../hooks/useScanner";
import { gradePaperSource } from "../grading/runGrading";
import { isAnswerKeyComplete } from "../grading/answerKeyModel";
import { pdfFileToCanvases } from "../ocr/pdfReader";
import { getAnswerKey, getLayoutForKey, getPrefs, getSession, listSessions } from "../services/storageService";
import type { AnswerKey, GradingSession, PaperLayout } from "../types";

export function ScannerPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const camera = useCamera();
  const [session, setSession] = useState<GradingSession | null>(null);
  const [key, setKey] = useState<AnswerKey | null>(null);
  const [layout, setLayout] = useState<PaperLayout | null>(null);
  const [autoScan, setAutoScan] = useState(true);
  const [studentLabel, setStudentLabel] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [liveOverlay, setLiveOverlay] = useState(true);

  useEffect(() => {
    void (async () => {
      const prefs = await getPrefs();
      setAutoScan(prefs.autoScan);
      const sessionId = params.get("session") ?? prefs.lastSessionId;
      const sessions = await listSessions();
      const current = sessionId ? await getSession(sessionId) : sessions[0];
      if (!current) return;
      setSession(current);
      const answerKey = await getAnswerKey(current.answerKeyId);
      setKey(answerKey ?? null);
      if (answerKey) setLayout((await getLayoutForKey(answerKey.id)) ?? null);
    })();
  }, [params]);

  useEffect(() => {
    void camera.start();
  }, [camera.start]);

  const scanner = useScanner({
    videoRef: camera.videoRef,
    enabled: camera.ready,
    autoScan,
    key,
    sessionId: session?.id ?? null,
    layout,
  });

  useEffect(() => {
    if (scanner.lastResult && !liveOverlay) {
      navigate(`/results/${scanner.lastResult.id}`);
    }
  }, [scanner.lastResult, navigate, liveOverlay]);

  const onUpload = async (file: File) => {
    if (!key || !session) return;
    setUploadBusy(true);
    try {
      let source: HTMLCanvasElement | HTMLImageElement;
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const pages = await pdfFileToCanvases(file, 1);
        if (!pages[0]) throw new Error("Could not read that PDF.");
        source = pages[0];
      } else {
        const url = URL.createObjectURL(file);
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        source = img;
      }
      const result = await gradePaperSource({
        source,
        key,
        sessionId: session.id,
        layout,
        studentLabel,
      });
      navigate(`/results/${result.id}`);
    } finally {
      setUploadBusy(false);
    }
  };

  if (!session || !key) {
    return (
      <div>
        <TopBrand />
        <div className="rounded-3xl border border-rule bg-white p-8">
          <h2 className="font-extrabold tracking-[-0.03em] text-3xl">No answer key yet</h2>
          <p className="mt-3 text-slate">Create an answer key before scanning student papers.</p>
          <Link to="/session/new" className="mt-6 inline-block rounded-full bg-ink px-5 py-3 text-paper">
            Create answer key
          </Link>
        </div>
      </div>
    );
  }

  if (camera.error) {
    return (
      <div>
        <TopBrand />
        <div className="rounded-3xl border border-rule bg-white p-6">
          <p>{camera.error}</p>
          <button type="button" onClick={() => void camera.start()} className="primary-button mt-4 px-4">
            Try camera again
          </button>
        </div>
      </div>
    );
  }

  return (
    <CameraScanner
      videoRef={camera.videoRef}
      phase={scanner.phase}
      message={scanner.message}
      devices={camera.devices}
      deviceId={camera.deviceId}
      torchOn={camera.torchOn}
      torchSupported={camera.torchSupported}
      coverage={scanner.coverage}
      sharpness={scanner.sharpness}
      onSwitch={(id) => void camera.switchCamera(id)}
      onTorch={() => void camera.toggleTorch()}
      onCapture={() => void scanner.captureAndGrade()}
      busy={scanner.busy}
      trackingRef={scanner.trackingRef}
      tracking={scanner.tracking}
      trackingEvents={scanner.trackingEvents}
      result={scanner.lastResult}
      overlayResult={scanner.overlayResult}
      answerKeyConfirmed={isAnswerKeyComplete(key) && key.confirmed}
      lastRecognitionAt={scanner.lastRecognitionAt}
      overlayVisible={scanner.overlayVisible}
      overlayEnabled={liveOverlay}
      onScanNext={scanner.scanNext}
      answerKeyName={key.name}
      liveOverlay={liveOverlay}
      onToggleOverlay={() => setLiveOverlay((enabled) => !enabled)}
      autoScan={autoScan}
      onToggleAutoScan={() => setAutoScan((enabled) => !enabled)}
      studentLabel={studentLabel}
      onStudentLabelChange={setStudentLabel}
      onUploadFile={(file) => void onUpload(file)}
      uploadBusy={uploadBusy}
    />
  );
}

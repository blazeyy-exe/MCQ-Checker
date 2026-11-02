import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CameraScanner } from "../components/CameraScanner/CameraScanner";
import { TopBrand } from "../components/UI/AppShell";
import { useCamera } from "../hooks/useCamera";
import { useScanner } from "../hooks/useScanner";
import { gradePaperSource } from "../grading/runGrading";
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
    if (scanner.lastResult) {
      navigate(`/results/${scanner.lastResult.id}`);
    }
  }, [scanner.lastResult, navigate]);

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
          <h2 className="font-serif text-3xl">No answer key yet</h2>
          <p className="mt-3 text-ink/65">Create an answer key before scanning student papers.</p>
          <Link to="/session/new" className="mt-6 inline-block rounded-full bg-ink px-5 py-3 text-paper">
            Create answer key
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBrand />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink/50">Live scanner</p>
          <h2 className="font-serif text-3xl">{key.name}</h2>
          <p className="text-sm text-ink/60">{key.questionCount} questions · layout {layout?.confirmed ? "confirmed" : layout ? "detected" : "will be learned"}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoScan} onChange={(e) => setAutoScan(e.target.checked)} />
          Auto-scan
        </label>
      </div>

      {camera.error ? (
        <div className="rounded-3xl border border-rule bg-white p-6">
          <p>{camera.error}</p>
          <button type="button" onClick={() => void camera.start()} className="mt-4 rounded-full bg-ink px-4 py-2 text-paper">
            Try camera again
          </button>
        </div>
      ) : (
        <CameraScanner
          videoRef={camera.videoRef}
          phase={scanner.phase}
          message={scanner.message}
          quad={scanner.quad}
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
        />
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          value={studentLabel}
          onChange={(e) => setStudentLabel(e.target.value)}
          placeholder="Student name or roll number"
          className="rounded-2xl border border-rule bg-white px-4 py-3"
        />
        <label className="rounded-2xl border border-dashed border-rule bg-white px-4 py-3 text-sm">
          Upload photo or PDF page
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            className="mt-2 block"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
        </label>
      </div>
      {uploadBusy && <p className="mt-3 text-sm">Grading uploaded paper…</p>}
    </div>
  );
}

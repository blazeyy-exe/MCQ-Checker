import { useState } from "react";
import { Link } from "react-router-dom";
import { TopBrand } from "../components/UI/AppShell";
import { evaluateRecognitionCases, parseGroundTruth, type RecognitionEvaluationCase } from "../evaluation/recognitionMetrics";
import { fileToDataUrl, loadImageElement } from "../lib/image";
import { recognizeStudentPaper } from "../grading/studentPaperEngine";
import { SELECTED_CIRCLE_THRESHOLD } from "../vision/markDetector";
import type { StudentPaperRecognition } from "../types";

export function RecognitionDebugPage() {
  const [file, setFile] = useState<File | null>(null);
  const [recognition, setRecognition] = useState<StudentPaperRecognition | null>(null);
  const [groundTruthInput, setGroundTruthInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWords, setShowWords] = useState(true);
  const [showQuestions, setShowQuestions] = useState(true);
  const [showOptions, setShowOptions] = useState(true);

  const runRecognition = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setRecognition(null);
    try {
      const sourceDataUrl = await fileToDataUrl(file);
      const image = await loadImageElement(sourceDataUrl);
      const result = await recognizeStudentPaper({ source: image });
      setRecognition({ ...result, sourceDataUrl });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not process this paper.");
    } finally {
      setBusy(false);
    }
  };

  let evaluationCase: RecognitionEvaluationCase | null = null;
  let metricError: string | null = null;
  if (recognition && groundTruthInput.trim()) {
    try {
      evaluationCase = {
        filename: file?.name ?? "uploaded-paper",
        groundTruth: parseGroundTruth(groundTruthInput),
        recognition,
      };
    } catch (reason) {
      metricError = reason instanceof Error ? reason.message : "Ground truth is invalid.";
    }
  }
  const metrics = evaluationCase ? evaluateRecognitionCases([evaluationCase]) : null;

  const downloadCase = () => {
    if (!evaluationCase) return;
    const blob = new Blob([JSON.stringify(evaluationCase, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${file?.name.replace(/\.[^.]+$/, "") ?? "paper"}-recognition-case.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <TopBrand />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mark-orange">Developer tool</p>
          <h2 className="font-extrabold tracking-[-0.03em] text-3xl">Recognition debug</h2>
        </div>
        <Link to="/lab" className="text-sm underline">Back to lab</Link>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        Inspect one ordinary, single-column paper at a time. This tool is for diagnosis and labeled-case collection; one sample does not establish accuracy.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        For live camera tracking and projected grading markers, open the <Link to="/scan" className="underline">scanner</Link> and enable “Tracking debug” over the preview.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-white p-4">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setRecognition(null);
            setError(null);
          }}
        />
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => void runRecognition()}
          className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
        >
          {busy ? "Recognizing…" : "Run recognition"}
        </button>
        {error && <p className="w-full text-sm text-mark-red">{error}</p>}
      </div>

      {recognition && (
        <>
          <div className="mt-4 flex flex-wrap gap-4 rounded-2xl border border-rule bg-white p-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={showWords} onChange={(e) => setShowWords(e.target.checked)} /> OCR word boxes</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showQuestions} onChange={(e) => setShowQuestions(e.target.checked)} /> Question regions</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showOptions} onChange={(e) => setShowOptions(e.target.checked)} /> Option/mark regions</label>
            <span className="ml-auto">Processing: {Math.round(recognition.processingMs)} ms</span>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <ImagePanel
              title="Original upload"
              src={recognition.sourceDataUrl}
              quad={recognition.paperQuad}
              width={recognition.sourceWidth}
              height={recognition.sourceHeight}
            />
            <div>
              <h3 className="mb-2 font-extrabold tracking-[-0.03em] text-xl">Perspective-corrected image and regions</h3>
              <div className="relative overflow-hidden rounded-2xl border border-rule bg-white">
                <img src={recognition.warpedDataUrl} alt="Perspective-corrected examination paper" className="block h-auto w-full" />
                <div className="pointer-events-none absolute inset-0">
                  {showWords && recognition.ocrWords.map((word, index) => (
                    <Box key={`word-${index}`} box={word.bbox} width={recognition.pageWidth} height={recognition.pageHeight} color="var(--unanswered)" />
                  ))}
                  {showQuestions && recognition.questions.map((question) => (
                    <Box key={`question-${question.number}`} box={question.box} width={recognition.pageWidth} height={recognition.pageHeight} color="var(--correct)" label={`Q${question.number}`} />
                  ))}
                  {showOptions && recognition.questions.flatMap((question) => question.options.map((option) => (
                    <Box
                      key={`option-${question.number}-${option.label}`}
                      box={option.labelBox ?? option.box}
                      width={recognition.pageWidth}
                      height={recognition.pageHeight}
                      color={option.markScore >= SELECTED_CIRCLE_THRESHOLD ? "var(--incorrect)" : "var(--review)"}
                      label={`${question.number}:${option.label} ${option.markScore.toFixed(2)}`}
                    />
                  )))}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate">Blue: OCR words · green: question · orange/red: option and circle score</p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-rule bg-white p-4">
              <h3 className="font-extrabold tracking-[-0.03em] text-xl">OCR output</h3>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs">{recognition.ocrText || "No OCR text."}</pre>
              <p className="mt-2 text-xs text-slate">{recognition.ocrWords.length} word boxes retained</p>
            </section>
            <section className="rounded-2xl border border-rule bg-white p-4">
              <h3 className="font-extrabold tracking-[-0.03em] text-xl">Structured recognition</h3>
              {recognition.questions.length === 0 ? (
                <p className="mt-2 text-sm text-mark-orange">No question regions recognized.</p>
              ) : (
                <ul className="mt-2 space-y-3 text-sm">
                  {recognition.questions.map((question) => (
                    <li key={question.number} className="border-b border-rule pb-3 last:border-0">
                      <p className="font-semibold">
                        Q{question.number}: {question.status} · {question.selected.join("+") || "no selection"}
                        {" · "}{question.confidence} confidence
                      </p>
                      <p className="text-xs text-slate">{question.questionText || "Question text not read."}</p>
                      <p className="text-xs text-slate">
                        Options: {question.options.map((option) => `${option.label}. ${option.text || "?"}`).join(" | ") || "none"}
                      </p>
                      {(question.uncertaintyReasons ?? []).map((reason) => (
                        <p key={reason} className="text-xs text-mark-orange">{reason}</p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
              {recognition.warnings.map((warning) => (
                <p key={warning} className="mt-2 text-xs text-mark-orange">{warning}</p>
              ))}
              {recognition.issues.map((issue, index) => (
                <p key={`${issue.code}-${issue.questionNumber ?? index}`} className="mt-2 text-xs text-mark-orange">
                  {issue.code}: {issue.message}
                </p>
              ))}
            </section>
          </div>

          <section className="mt-5 rounded-2xl border border-rule bg-white p-4">
            <h3 className="font-extrabold tracking-[-0.03em] text-xl">Label this paper for evaluation</h3>
            <p className="mt-1 text-xs text-slate">Enter every question as `number:answer`: `1:B, 2:blank, 3:A+C, 4:?`.</p>
            <textarea
              value={groundTruthInput}
              onChange={(event) => setGroundTruthInput(event.target.value)}
              placeholder="1:B, 2:blank, 3:A+C"
              className="mt-3 min-h-20 w-full rounded-xl border border-rule p-3 text-sm"
            />
            {metricError && <p className="mt-2 text-sm text-mark-red">{metricError}</p>}
            {metrics && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Question detection" value={`${metrics.questionDetectionAccuracy}%`} detail={`${metrics.detectedQuestions}/${metrics.expectedQuestions}`} />
                  <Metric label="Option association" value={`${metrics.optionAssociationAccuracy}%`} detail={`${metrics.recognizedOptionLabels}/${metrics.expectedOptionLabels}`} />
                  <Metric label="Exact answer" value={`${metrics.exactAnswerAccuracy}%`} detail={`${metrics.exactAnswerAccuracy}% for this case only`} />
                  <Metric label="Average time" value={`${metrics.averageProcessingMs} ms`} detail={`${metrics.cases} case`} />
                  <Metric label="Unanswered detection" value={`${metrics.unansweredDetectionAccuracy}%`} detail={`${metrics.unansweredQuestions} blank questions`} />
                  <Metric label="Multiple detection" value={`${metrics.multipleDetectionAccuracy}%`} detail={`${metrics.multipleQuestions} multiple questions`} />
                  <Metric label="False positives" value={String(metrics.falsePositiveSelections)} detail="Extra selected options" />
                  <Metric label="False negatives" value={String(metrics.falseNegativeSelections)} detail="Missed selected options" />
                </div>
                <button type="button" onClick={downloadCase} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm text-paper">
                  Download labeled evaluation case
                </button>
                <p className="mt-2 text-xs text-slate">
                  One-paper metrics are diagnostic only. See evaluation/README.md for aggregate evaluation.
                </p>
              </>
            )}
          </section>

          <details className="mt-5 rounded-2xl border border-rule bg-white p-4">
            <summary className="cursor-pointer font-extrabold tracking-[-0.03em] text-lg">Raw structured recognition JSON</summary>
            <pre className="mt-3 max-h-96 overflow-auto text-xs">{JSON.stringify(recognition, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}

function ImagePanel({
  title,
  src,
  quad,
  width,
  height,
}: {
  title: string;
  src: string;
  quad?: StudentPaperRecognition["paperQuad"];
  width?: number;
  height?: number;
}) {
  return (
    <div>
      <h3 className="mb-2 font-extrabold tracking-[-0.03em] text-xl">{title}</h3>
      <div className="relative">
        <img src={src} alt={title} className="h-auto w-full rounded-2xl border border-rule" />
        {quad && width && height && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon
              points={[quad.tl, quad.tr, quad.br, quad.bl].map((point) => `${(point.x / width) * 100},${(point.y / height) * 100}`).join(" ")}
              fill="none"
              stroke="var(--incorrect)"
              strokeWidth="0.7"
            />
          </svg>
        )}
      </div>
      {quad && <p className="mt-1 text-xs text-slate">Red outline: detected paper boundary</p>}
    </div>
  );
}

function Box({
  box,
  width,
  height,
  color,
  label,
}: {
  box: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
  color: string;
  label?: string;
}) {
  return (
    <div
      title={label}
      className="absolute border"
      style={{
        left: `${(box.x / width) * 100}%`,
        top: `${(box.y / height) * 100}%`,
        width: `${(box.width / width) * 100}%`,
        height: `${(box.height / height) * 100}%`,
        borderColor: color,
      }}
    >
      {label && <span className="absolute left-0 top-0 whitespace-nowrap bg-black/70 px-1 text-[9px] text-white">{label}</span>}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl bg-paper p-3">
      <p className="text-xs text-slate">{label}</p>
      <p className="mt-1 font-extrabold tracking-[-0.03em] text-2xl">{value}</p>
      <p className="text-xs text-slate">{detail}</p>
    </div>
  );
}

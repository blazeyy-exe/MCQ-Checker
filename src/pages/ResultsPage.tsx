import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnnotatedPaper } from "../components/AnnotatedPaper/AnnotatedPaper";
import { QuestionBreakdown, ScoreHero } from "../components/ResultCard/ResultCard";
import { TopBrand } from "../components/UI/AppShell";
import { applyOverride, buildResult } from "../grading/gradingEngine";
import { renderAnnotatedPaper } from "../vision/annotationRenderer";
import { downloadDataUrl, exportResultPdf } from "../services/pdfService";
import { getAnswerKey, getResult, saveLayout, saveResult } from "../services/storageService";
import { getLayoutForKey } from "../services/storageService";
import type { GradingResult, OptionLabel } from "../types";

export function ResultsPage() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<GradingResult | null>(null);
  const [examName, setExamName] = useState("Examination");

  useEffect(() => {
    if (!resultId) return;
    void (async () => {
      const row = await getResult(resultId);
      setResult(row ?? null);
      if (row) {
        const key = await getAnswerKey(row.answerKeyId);
        if (key) setExamName(key.name);
      }
    })();
  }, [resultId]);

  if (!result) {
    return (
      <div>
        <TopBrand />
        <p>Result not found.</p>
      </div>
    );
  }

  const override = async (number: number, value: string) => {
    const nextQuestions = applyOverride(
      result.questions,
      number,
      value ? (value as OptionLabel | "unanswered") : undefined,
    );
    const annotatedDataUrl = await renderAnnotatedPaper(result.warpedDataUrl, nextQuestions);
    const next = buildResult({ ...result, questions: nextQuestions, annotatedDataUrl });
    await saveResult(next);
    setResult(next);
  };

  const confirmLayout = async () => {
    const layout = await getLayoutForKey(result.answerKeyId);
    if (!layout) return;
    await saveLayout({ ...layout, confirmed: true });
  };

  return (
    <div>
      <TopBrand />
      <ScoreHero result={result} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/scan?session=${result.sessionId}`} className="primary-button inline-flex items-center px-4">
          Scan next student
        </Link>
        <button
          type="button"
          onClick={() => void exportResultPdf(result, examName)}
          className="secondary-button px-4"
        >
          Export PDF
        </button>
        <button
          type="button"
          onClick={() => downloadDataUrl(result.annotatedDataUrl, "annotated-paper.jpg")}
          className="secondary-button px-4"
        >
          Download image
        </button>
        <Link to={`/review/${result.id}`} className="secondary-button inline-flex items-center px-4">
          Recognition review
        </Link>
        <button type="button" onClick={() => void confirmLayout()} className="secondary-button px-4">
          Reuse this layout
        </button>
      </div>

      {result.warnings.map((w) => (
        <p key={w} className="review-callout mt-3 p-3 text-sm font-semibold">
          {w}
        </p>
      ))}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-extrabold tracking-[-0.03em] text-2xl">Original</h3>
          <AnnotatedPaper src={result.originalDataUrl} alt="Original paper" />
        </div>
        <div>
          <h3 className="mb-2 font-extrabold tracking-[-0.03em] text-2xl">Marked paper</h3>
          <AnnotatedPaper src={result.annotatedDataUrl} alt="Annotated paper" />
        </div>
      </div>

      {result.questions.some((question) => ["multiple", "uncertain", "missing"].includes(question.status)) && (
        <section className="review-callout mt-6 p-4">
          <h3 className="font-bold">Needs your review</h3>
          <p className="mt-1 text-sm">These ambiguous or multiple marks are not graded until you decide.</p>
          <ul className="mt-3 space-y-2">
            {result.questions
              .filter((question) => ["multiple", "uncertain", "missing"].includes(question.status))
              .map((question) => (
                <li key={question.number} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
                  <span className="font-bold">Question {question.number}</span>
                  <span>{question.status === "multiple" ? "Multiple marks" : question.status === "missing" ? "Not recognized" : "Uncertain mark"}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <h3 className="mt-8 font-extrabold tracking-[-0.03em] text-2xl">Question by question</h3>
      <p className="mb-3 mt-1 text-sm text-slate">Correct a detection and the score recalculates immediately.</p>
      <QuestionBreakdown result={result} onOverride={(n, v) => void override(n, v)} />
      <p className="mt-4 text-xs text-slate">Processed in {Math.round(result.processingMs)} ms on this device. Nothing was uploaded.</p>
      <button type="button" className="mt-4 text-sm text-slate" onClick={() => navigate("/history")}>
        View history
      </button>
    </div>
  );
}

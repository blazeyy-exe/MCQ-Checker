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
        <Link to={`/scan?session=${result.sessionId}`} className="rounded-full bg-ink px-4 py-2 text-paper">
          Scan next student
        </Link>
        <button
          type="button"
          onClick={() => void exportResultPdf(result, examName)}
          className="rounded-full border border-rule px-4 py-2"
        >
          Export PDF
        </button>
        <button
          type="button"
          onClick={() => downloadDataUrl(result.annotatedDataUrl, "annotated-paper.jpg")}
          className="rounded-full border border-rule px-4 py-2"
        >
          Download image
        </button>
        <Link to={`/review/${result.id}`} className="rounded-full border border-rule px-4 py-2">
          Recognition review
        </Link>
        <button type="button" onClick={() => void confirmLayout()} className="rounded-full border border-rule px-4 py-2">
          Reuse this layout
        </button>
      </div>

      {result.warnings.map((w) => (
        <p key={w} className="mt-3 text-sm text-mark-orange">
          {w}
        </p>
      ))}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-serif text-2xl">Original</h3>
          <AnnotatedPaper src={result.originalDataUrl} alt="Original paper" />
        </div>
        <div>
          <h3 className="mb-2 font-serif text-2xl">Marked paper</h3>
          <AnnotatedPaper src={result.annotatedDataUrl} alt="Annotated paper" />
        </div>
      </div>

      <h3 className="mt-8 font-serif text-2xl">Question by question</h3>
      <p className="mb-3 mt-1 text-sm text-ink/60">Correct a detection and the score recalculates immediately.</p>
      <QuestionBreakdown result={result} onOverride={(n, v) => void override(n, v)} />
      <p className="mt-4 text-xs text-ink/45">Processed in {Math.round(result.processingMs)} ms on this device. Nothing was uploaded.</p>
      <button type="button" className="mt-4 text-sm text-ink/50" onClick={() => navigate("/history")}>
        View history
      </button>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { TopBrand } from "../components/UI/AppShell";
import { generateTestPaper, type SyntheticPaper } from "../lab/testPaper";
import { recognizeStudentPaper } from "../grading/studentPaperEngine";
import { matchQuestions } from "../grading/questionMatcher";
import { createManualKey } from "../grading/answerKeyEngine";
import { summarize } from "../grading/gradingEngine";
import { renderAnnotatedPaper } from "../vision/annotationRenderer";
import type { OptionLabel } from "../types";

interface Trial {
  name: string;
  detected: string;
  expected: string;
  matched: number;
  total: number;
  ms: number;
  annotated?: string;
}

export function LabPage() {
  const [paper, setPaper] = useState<SyntheticPaper | null>(null);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [busy, setBusy] = useState(false);

  const make = (mark: SyntheticPaper["mark"], layout: SyntheticPaper["layout"]) => {
    setPaper(generateTestPaper({ count: 8, mark, layout }));
    setTrial(null);
  };

  const run = async () => {
    if (!paper) return;
    setBusy(true);
    try {
      const recognition = await recognizeStudentPaper({ source: paper.canvas, allowFullFrame: true });
      const key = createManualKey({
        name: "Lab exam",
        subject: "Science",
        className: "8",
        answers: paper.answers as OptionLabel[],
      });
      const graded = matchQuestions(key, recognition.questions);
      const stats = summarize(graded);
      const annotated = await renderAnnotatedPaper(recognition.warpedDataUrl, graded);
      setTrial({
        name: `${paper.layout} / ${paper.mark}`,
        expected: paper.answers.join(""),
        detected: recognition.questions
          .sort((a, b) => a.number - b.number)
          .map((q) => q.selected[0] ?? "-")
          .join(""),
        matched: stats.correct,
        total: stats.total,
        ms: recognition.processingMs,
        annotated,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TopBrand />
      <h2 className="font-extrabold tracking-[-0.03em] text-3xl">Recognition lab</h2>
      <p className="mt-2 max-w-2xl text-slate">
        These generated papers have known answers. Use them to see where detection succeeds or needs layout confirmation. Figures here are from the run you just performed, not claimed product accuracy.
      </p>
      <Link to="/lab/debug" className="mt-4 inline-block rounded-full border border-rule px-4 py-2 text-sm">
        Open real-paper recognition debug and evaluation
      </Link>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-full bg-ink px-4 py-2 text-paper" onClick={() => make("circle", "single")}>
          Circled, one column
        </button>
        <button className="rounded-full border border-rule px-4 py-2" onClick={() => make("tick", "single")}>
          Ticked
        </button>
        <button className="rounded-full border border-rule px-4 py-2" onClick={() => make("fill", "single")}>
          Filled
        </button>
        <button className="rounded-full border border-rule px-4 py-2" onClick={() => make("circle", "two-column")}>
          Two columns
        </button>
        <button className="rounded-full border border-rule px-4 py-2" onClick={() => make("blank", "single")}>
          Unanswered
        </button>
        <button className="rounded-full border border-rule px-4 py-2" onClick={() => make("multiple", "single")}>
          Multiple marks
        </button>
      </div>
      {paper && (
        <div className="mt-6">
          <img src={paper.canvas.toDataURL("image/jpeg", 0.9)} alt="Synthetic exam paper" className="max-w-xl rounded-3xl border border-rule" />
          <p className="mt-2 text-sm">Known key: {paper.answers.join(" ")}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run()}
            className="mt-3 rounded-full bg-ink px-4 py-2 text-paper disabled:opacity-50"
          >
            {busy ? "Running recognition…" : "Run recognition"}
          </button>
        </div>
      )}
      {trial && (
        <div className="mt-6 rounded-3xl border border-rule bg-white p-5">
          <p className="font-semibold">{trial.name}</p>
          <p className="mt-2 text-sm">Expected: {trial.expected}</p>
          <p className="text-sm">Detected: {trial.detected}</p>
          <p className="mt-2 font-extrabold tracking-[-0.03em] text-3xl">
            {trial.matched}/{trial.total}
          </p>
          <p className="text-sm text-slate">{Math.round(trial.ms)} ms</p>
          {trial.annotated && <img src={trial.annotated} alt="Annotated lab paper" className="mt-4 rounded-2xl" />}
        </div>
      )}
    </div>
  );
}

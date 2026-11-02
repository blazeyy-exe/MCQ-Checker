import type { ReactNode } from "react";
import type { GradingResult } from "../../types";

const STATUS_LABEL: Record<string, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Unanswered",
  multiple: "Multiple",
  uncertain: "Uncertain",
  missing: "Not found",
};
const STATUS_SYMBOL: Record<string, string> = {
  correct: "✓",
  incorrect: "×",
  unanswered: "—",
  multiple: "?",
  uncertain: "?",
  missing: "?",
};

export function ScoreHero({ result }: { result: GradingResult }) {
  return (
    <section className="rounded-3xl bg-indigo px-6 py-7 text-white">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white">
        {result.verified ? "Verified score" : "Needs review"}
      </p>
      <p className="mt-2 text-5xl font-extrabold leading-none tracking-[-0.03em]">
        {result.score} <span className="text-3xl text-white">/ {result.total}</span>
      </p>
      <p className="mt-3 text-lg">{result.percentage}% score</p>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <Pill className="status-correct">✓ {result.correct} correct</Pill>
        <Pill className="status-incorrect">× {result.incorrect} incorrect</Pill>
        <Pill className="status-unanswered">— {result.unanswered} unanswered</Pill>
      </div>
      {!result.verified && (
        <p className="review-callout mt-4 p-4 text-sm font-semibold">
          Some questions are uncertain. Do not treat this as a final official mark until they are reviewed.
        </p>
      )}
    </section>
  );
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`status-pill ${className}`}>{children}</span>;
}

export function QuestionBreakdown({
  result,
  onOverride,
}: {
  result: GradingResult;
  onOverride?: (number: number, value: string) => void;
}) {
  return (
    <div className="divide-y divide-rule overflow-hidden rounded-3xl border border-rule bg-white">
      {result.questions.map((q) => (
        <div key={q.number} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="w-12 font-semibold">Q{q.number}</div>
          <div className="flex-1 text-sm text-slate">
            Key {q.keyAnswer ?? "—"} · Detected {q.detectedAnswers.join("/") || "—"}
          </div>
          <span className={`status-pill status-${q.status === "correct" ? "correct" : q.status === "incorrect" ? "incorrect" : q.status === "unanswered" ? "unanswered" : "review"}`}>
            <span aria-hidden="true">{STATUS_SYMBOL[q.status]}</span>
            {STATUS_LABEL[q.status]}
          </span>
          {onOverride && (
            <select
              value={q.teacherOverride ?? ""}
              onChange={(e) => onOverride(q.number, e.target.value)}
              className="rounded-lg border border-rule px-2 py-1 text-xs"
            >
              <option value="">Detected</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="unanswered">Blank</option>
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

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

export function ScoreHero({ result }: { result: GradingResult }) {
  return (
    <section className="paper-grain rounded-3xl border border-rule px-6 py-7">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
        {result.verified ? "Verified score" : "Needs review"}
      </p>
      <p className="mt-2 font-serif text-6xl leading-none">
        {result.score} <span className="text-3xl text-ink/40">/ {result.total}</span>
      </p>
      <p className="mt-3 text-lg">{result.percentage}% score</p>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <Pill>{result.correct} correct</Pill>
        <Pill>{result.incorrect} incorrect</Pill>
        <Pill>{result.unanswered} unanswered</Pill>
        {result.multiple > 0 && <Pill>{result.multiple} multiple</Pill>}
        {result.uncertain > 0 && <Pill>{result.uncertain} uncertain</Pill>}
      </div>
      {!result.verified && (
        <p className="mt-4 text-sm text-mark-red">
          Some questions are uncertain. Do not treat this as a final official mark until they are reviewed.
        </p>
      )}
    </section>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/80 px-3 py-1">{children}</span>;
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
          <div className="flex-1 text-sm text-ink/70">
            Key {q.keyAnswer ?? "—"} · Detected {q.detectedAnswers.join("/") || "—"}
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              q.status === "correct"
                ? "bg-green-100 text-stamp"
                : q.status === "incorrect"
                  ? "bg-red-100 text-mark-red"
                  : q.status === "unanswered" || q.status === "missing"
                    ? "bg-blue-100 text-mark-blue"
                    : "bg-orange-100 text-mark-orange"
            }`}
          >
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

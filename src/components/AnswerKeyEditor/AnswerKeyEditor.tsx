import { useEffect, useMemo, useState } from "react";
import type { AnswerKeyItem, OptionLabel } from "../../types";
import { OPTION_LABELS } from "../../types";
import { parseBulkAnswers } from "../../grading/answerKeyModel";

interface Props {
  items: AnswerKeyItem[];
  onChange: (items: AnswerKeyItem[]) => void;
}

export function AnswerKeyEditor({ items, onChange }: Props) {
  const bulk = useMemo(() => items.map((i) => i.answer).join(""), [items]);
  const [bulkDraft, setBulkDraft] = useState(bulk);

  useEffect(() => setBulkDraft(bulk), [bulk]);

  const setAnswer = (index: number, answer: OptionLabel) => {
    const next = items.map((item, i) =>
      i === index ? { ...item, answer, needsReview: false, confidence: "high" as const } : item,
    );
    onChange(next);
  };
  const needsConfirmation = items.filter((item) => item.needsReview || item.answer === null).length;

  const setCount = (count: number) => {
    const n = Math.max(1, Math.min(100, Math.floor(count) || 1));
    const next = Array.from({ length: n }, (_, i) => items[i] ?? {
      number: i + 1,
      answer: null,
      confidence: "low" as const,
      needsReview: true,
    }).map((item, i) => ({ ...item, number: i + 1 }));
    onChange(next);
  };

  const applyBulk = (value: string) => {
    const answers = parseBulkAnswers(value);
    const next = (answers.length ? answers : Array.from({ length: items.length }, () => null))
      .map((answer, i) => ({
      number: i + 1,
      answer,
      confidence: answer ? ("high" as const) : ("low" as const),
      needsReview: answer === null,
    }));
    onChange(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate">Questions</span>
          <input
            type="number"
            min={1}
            max={100}
            value={items.length}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-24 rounded-xl border border-rule bg-white px-3 py-2"
          />
        </label>
        <label className="min-w-60 flex-1 text-sm">
          <span className="mb-1 block text-slate">Bulk answers (e.g. ACBDAC…)</span>
          <input
            value={bulkDraft}
            onChange={(e) => setBulkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyBulk(bulkDraft);
              }
            }}
            className="w-full rounded-xl border border-rule bg-white px-3 py-2 tracking-[0.2em]"
          />
          <span className="mt-1 block text-xs text-slate">Press Enter to apply; leave empty comma-separated slots blank.</span>
        </label>
      </div>
      {needsConfirmation > 0 && (
        <div className="review-callout flex items-start gap-3 p-4" role="status">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow font-extrabold text-navy" aria-hidden="true">?</span>
          <p className="text-sm font-semibold">
            {needsConfirmation} {needsConfirmation === 1 ? "answer needs" : "answers need"} confirming. Choose the correct option for every item before saving.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item, index) => (
          <div
            key={item.number}
            className={`flex items-center justify-between rounded-2xl border px-3 py-2 ${
              item.needsReview ? "border-review bg-review/22" : "border-rule bg-white"
            }`}
          >
            <div>
              <p className="text-sm font-semibold">Q{item.number}</p>
              <p className={`text-xs ${item.needsReview ? "font-bold text-review" : "text-slate"}`}>
                {item.needsReview
                  ? item.answer
                    ? `Detected ${item.answer} · choose an answer to confirm`
                    : "Choose an answer"
                  : `Confirmed ${item.answer}`}
              </p>
            </div>
            <div
              className="flex gap-1"
              tabIndex={0}
              onKeyDown={(e) => {
                const key = e.key.toUpperCase();
                if (OPTION_LABELS.includes(key as OptionLabel)) {
                  e.preventDefault();
                  setAnswer(index, key as OptionLabel);
                }
              }}
            >
              {OPTION_LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setAnswer(index, label)}
                  aria-pressed={item.answer === label && !item.needsReview}
                  aria-label={`Question ${item.number}, answer ${label}${item.answer === label && !item.needsReview ? ", selected" : ""}`}
                  className={`h-11 min-w-11 rounded-xl border-2 text-sm font-bold transition-colors ${
                    item.answer === label && !item.needsReview
                      ? "border-indigo bg-indigo text-white"
                      : "border-navy/20 bg-white text-navy"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

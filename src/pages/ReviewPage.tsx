import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TopBrand } from "../components/UI/AppShell";
import { getLayoutForKey, getResult, saveLayout } from "../services/storageService";
import type { GradingResult, PaperLayout } from "../types";

export function ReviewPage() {
  const { resultId } = useParams();
  const [result, setResult] = useState<GradingResult | null>(null);
  const [layout, setLayout] = useState<PaperLayout | null>(null);

  useEffect(() => {
    if (!resultId) return;
    void (async () => {
      const row = await getResult(resultId);
      setResult(row ?? null);
      if (row) setLayout((await getLayoutForKey(row.answerKeyId)) ?? null);
    })();
  }, [resultId]);

  if (!result) {
    return (
      <div>
        <TopBrand />
        <p>Nothing to review.</p>
      </div>
    );
  }

  const uncertain = result.questions.filter((q) =>
    ["uncertain", "missing", "multiple"].includes(q.status),
  );

  return (
    <div>
      <TopBrand />
      <h2 className="font-serif text-3xl">Recognition review</h2>
      <p className="mt-2 max-w-2xl text-ink/65">
        Use this only when automatic reading is unsure. Confirming the layout makes the next papers from this exam faster and more stable.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <img src={result.warpedDataUrl} alt="Corrected paper" className="rounded-3xl border border-rule" />
        <div className="rounded-3xl border border-rule bg-white p-4">
          <h3 className="font-serif text-xl">Questions needing help</h3>
          {uncertain.length === 0 ? (
            <p className="mt-3 text-sm text-stamp">No uncertain questions on this paper.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {uncertain.map((q) => (
                <li key={q.number}>
                  Q{q.number}: {q.status} · detected {q.detectedAnswers.join("/") || "none"}
                </li>
              ))}
            </ul>
          )}
          <Link to={`/results/${result.id}`} className="mt-4 inline-block text-sm underline">
            Correct answers on the results page
          </Link>
          {layout && (
            <button
              type="button"
              className="mt-4 block rounded-full bg-ink px-4 py-2 text-paper"
              onClick={() => void saveLayout({ ...layout, confirmed: true })}
            >
              Confirm layout for this exam
            </button>
          )}
        </div>
      </div>

      <section className="mt-8 rounded-3xl border border-rule bg-white p-4">
        <h3 className="font-serif text-xl">OCR text</h3>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-ink/70">
          {result.ocrText || "OCR was skipped because a saved layout was reused."}
        </pre>
      </section>
    </div>
  );
}

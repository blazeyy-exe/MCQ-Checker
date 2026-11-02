import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TopBrand } from "../components/UI/AppShell";
import { deleteResult, listResults } from "../services/storageService";
import type { GradingResult } from "../types";

export function HistoryPage() {
  const [results, setResults] = useState<GradingResult[]>([]);

  const reload = () => {
    void listResults().then(setResults);
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <TopBrand />
      <h2 className="font-extrabold tracking-[-0.03em] text-3xl">History</h2>
      <p className="mt-2 text-slate">Papers stay on this device. Nothing is sent to a server.</p>
      {results.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-rule p-8 text-slate">No graded papers yet.</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {results.map((result) => (
            <div key={result.id} className="flex items-center justify-between gap-3 rounded-2xl border border-rule bg-white px-4 py-3">
              <Link to={`/results/${result.id}`} className="min-w-0 flex-1">
                <p className="font-semibold">{result.studentLabel || "Unnamed student"}</p>
                <p className="text-sm text-slate">
                  {new Date(result.createdAt).toLocaleString()} · {result.verified ? "verified" : "needs review"}
                </p>
              </Link>
              <p className="font-extrabold tracking-[-0.03em] text-2xl">
                {result.score}/{result.total}
              </p>
              <button
                type="button"
                onClick={() => void deleteResult(result.id).then(reload)}
                className="text-sm text-mark-red"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

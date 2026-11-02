import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TopBrand } from "../components/UI/AppShell";
import { TickdMark } from "../components/UI/TickdMark";
import { dashboardStats } from "../services/storageService";
import type { AnswerKey, GradingResult, GradingSession } from "../types";

export function DashboardPage() {
  const [keys, setKeys] = useState<AnswerKey[]>([]);
  const [sessions, setSessions] = useState<GradingSession[]>([]);
  const [results, setResults] = useState<GradingResult[]>([]);
  const [totalPapers, setTotalPapers] = useState(0);
  const [averageScore, setAverageScore] = useState<number | null>(null);

  useEffect(() => {
    void dashboardStats().then((stats) => {
      setKeys(stats.keys);
      setSessions(stats.sessions);
      setResults(stats.results.slice(0, 6));
      setTotalPapers(stats.totalPapers);
      setAverageScore(stats.averageScore);
    });
  }, []);

  return (
    <div>
      <TopBrand />
      <section className="grid items-center gap-8 overflow-hidden rounded-3xl bg-white p-6 md:grid-cols-2 md:p-10">
        <div>
          <p className="text-sm font-bold text-slate">Paper marking, made clearer</p>
          <h2 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-[-0.03em] text-navy md:text-6xl">
            Point your phone. <span className="text-indigo">Tick</span> the paper.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate">
            Check ordinary printed MCQ papers with your camera. Unclear marks are flagged for you, never guessed.
          </p>
          <Link to="/session/new" className="primary-button primary-button--large mt-7 inline-flex items-center justify-center px-6">
            Start scanning
          </Link>
        </div>
        <div className="flex min-h-72 items-center justify-center bg-paper py-8">
          <div className="relative w-48 rotate-[-6deg] rounded-[30px] border-[7px] border-navy bg-navy p-2 shadow-xl">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[21px] bg-white p-3">
              <div className="flex items-center gap-1.5">
                <TickdMark className="h-5 w-5" />
                <span className="text-[8px] font-bold text-navy">Tickd</span>
              </div>
              <div className="mt-5 space-y-3">
                {[1, 2, 3].map((number) => (
                  <div key={number} className="rounded-lg border border-navy/20 p-2">
                    <p className="text-[7px] font-bold text-navy">Question {number}</p>
                    <div className="mt-2 flex gap-1">
                      {["A", "B", "C", "D"].map((letter) => (
                        <span
                          key={letter}
                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[7px] font-bold ${
                            letter === (number === 2 ? "C" : "B")
                              ? "border-indigo bg-indigo text-white"
                              : "border-navy/20 text-slate"
                          }`}
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute right-4 top-[95px] flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-correct bg-correct/20 text-xs font-extrabold text-correct-text" aria-label="Correct answer">✓</div>
              <div className="absolute bottom-3 left-2 right-2 rounded-lg bg-paper p-2 text-[7px] font-bold text-navy">Paper detected</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Link
          to="/session/new"
          className="rounded-3xl border border-rule bg-white p-6 md:col-span-2"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">Answer key</p>
          <h2 className="mt-3 font-extrabold tracking-[-0.03em] text-3xl">Create a grading session</h2>
          <p className="mt-3 max-w-lg text-slate">
            Enter an answer key or upload a solved copy, then check student papers one at a time.
          </p>
        </Link>
        <Link to="/scan" className="rounded-3xl bg-indigo p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">Scanner</p>
          <h2 className="mt-3 font-extrabold tracking-[-0.03em] text-3xl">Open camera</h2>
          <p className="mt-3 text-white">Check a paper using your confirmed answer key.</p>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Stat label="Papers graded" value={String(totalPapers)} />
        <Stat label="Average score" value={averageScore === null ? "—" : `${averageScore}%`} />
      </div>

      <section className="mt-10">
        <h3 className="font-extrabold tracking-[-0.03em] text-2xl">Recent answer keys</h3>
        {keys.length === 0 ? (
          <Empty text="No answer keys yet. Create one to begin grading." />
        ) : (
          <div className="mt-4 grid gap-3">
            {keys.slice(0, 5).map((key) => (
              <Link
                key={key.id}
                to={`/session/new?key=${key.id}`}
                className="flex items-center justify-between rounded-2xl border border-rule bg-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{key.name}</p>
                  <p className="text-sm text-slate">
                    {key.questionCount} questions
                    {key.subject ? ` · ${key.subject}` : ""}
                  </p>
                </div>
                <span className="text-sm text-slate">Reuse</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h3 className="font-extrabold tracking-[-0.03em] text-2xl">Recent sessions</h3>
        {sessions.length === 0 ? (
          <Empty text="Sessions will appear here after you save an answer key." />
        ) : (
          <div className="mt-4 grid gap-3">
            {sessions.slice(0, 5).map((session) => (
              <Link
                key={session.id}
                to={`/scan?session=${session.id}`}
                className="flex items-center justify-between rounded-2xl border border-rule bg-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{session.name}</p>
                  <p className="text-sm text-slate">{session.paperCount} papers</p>
                </div>
                <span className="text-sm text-slate">Scan</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h3 className="font-extrabold tracking-[-0.03em] text-2xl">Latest papers</h3>
        {results.length === 0 ? (
          <Empty text="No papers have been graded on this device yet." />
        ) : (
          <div className="mt-4 grid gap-3">
            {results.map((result) => (
              <Link
                key={result.id}
                to={`/results/${result.id}`}
                className="flex items-center justify-between rounded-2xl border border-rule bg-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{result.studentLabel || "Unnamed student"}</p>
                  <p className="text-sm text-slate">{new Date(result.createdAt).toLocaleString()}</p>
                </div>
                <p className="font-extrabold tracking-[-0.03em] text-2xl">
                  {result.score}/{result.total}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-rule bg-white px-5 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-slate">{label}</p>
      <p className="mt-2 font-extrabold tracking-[-0.03em] text-4xl">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 rounded-2xl border border-dashed border-rule px-4 py-8 text-slate">{text}</p>;
}

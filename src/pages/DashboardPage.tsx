import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TopBrand } from "../components/UI/AppShell";
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
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          to="/session/new"
          className="paper-grain rounded-3xl border border-rule p-6 md:col-span-2"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Start</p>
          <h2 className="mt-3 font-serif text-3xl">Create a grading session</h2>
          <p className="mt-3 max-w-lg text-ink/70">
            Enter an answer key or upload a solved paper, then point the camera at each student script.
          </p>
        </Link>
        <Link to="/scan" className="rounded-3xl bg-ink p-6 text-paper">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-paper/60">Scanner</p>
          <h2 className="mt-3 font-serif text-3xl">Open camera</h2>
          <p className="mt-3 text-paper/70">Keep the camera running and move from paper to paper.</p>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Stat label="Papers graded" value={String(totalPapers)} />
        <Stat label="Average score" value={averageScore === null ? "—" : `${averageScore}%`} />
      </div>

      <section className="mt-10">
        <h3 className="font-serif text-2xl">Recent answer keys</h3>
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
                  <p className="text-sm text-ink/55">
                    {key.questionCount} questions
                    {key.subject ? ` · ${key.subject}` : ""}
                  </p>
                </div>
                <span className="text-sm text-ink/50">Reuse</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h3 className="font-serif text-2xl">Recent sessions</h3>
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
                  <p className="text-sm text-ink/55">{session.paperCount} papers</p>
                </div>
                <span className="text-sm text-ink/50">Scan</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h3 className="font-serif text-2xl">Latest papers</h3>
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
                  <p className="text-sm text-ink/55">{new Date(result.createdAt).toLocaleString()}</p>
                </div>
                <p className="font-serif text-2xl">
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
      <p className="text-xs uppercase tracking-[0.16em] text-ink/50">{label}</p>
      <p className="mt-2 font-serif text-4xl">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 rounded-2xl border border-dashed border-rule px-4 py-8 text-ink/55">{text}</p>;
}

import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TopBrand } from "../components/UI/AppShell";
import { AnswerKeyEditor } from "../components/AnswerKeyEditor/AnswerKeyEditor";
import {
  areAnswerKeyItemsComplete,
  blankItems,
  createManualKey,
  extractAnswerKeyFromFile,
  persistKey,
} from "../grading/answerKeyEngine";
import { generateOmrSheet } from "../services/pdfService";
import { createId } from "../lib/ids";
import { getAnswerKey, savePrefs, saveSession } from "../services/storageService";
import type { AnswerKey, AnswerKeyItem } from "../types";

export function CreateSessionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<"manual" | "upload">("manual");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [items, setItems] = useState<AnswerKeyItem[]>(blankItems(10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState<AnswerKey | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const keyId = params.get("key");
    if (!keyId) return;
    void getAnswerKey(keyId).then((key) => {
      if (!key) return;
      applyKey(key);
    });
  }, [params]);

  const applyKey = (key: AnswerKey) => {
    setDraftKey(key);
    setConfirmed(false);
    setName(key.name);
    setSubject(key.subject);
    setClassName(key.className);
    setItems(key.items);
    setTab("manual");
  };

  const onUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const extracted = await extractAnswerKeyFromFile(file);
      applyKey(extracted.key);
      setPreview(extracted.previewUrl);
      setWarnings(extracted.warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  };

  const updateItems = (next: AnswerKeyItem[]) => {
    setItems(next);
    setConfirmed(false);
  };

  const answersComplete = areAnswerKeyItemsComplete(items, items.length);

  const save = async () => {
    setError(null);
    if (!answersComplete) {
      setError("Choose and confirm an answer for every question before saving.");
      return;
    }
    if (!confirmed) {
      setError("Confirm that the answer key is correct before saving.");
      return;
    }

    setSaving(true);
    try {
      const key = draftKey
        ? {
            ...draftKey,
            name: name.trim() || "Untitled exam",
            subject,
            className,
            questionCount: items.length,
            items,
            confirmed,
            updatedAt: Date.now(),
          }
        : createManualKey({
            name,
            subject,
            className,
            answers: items.map((item) => item.answer),
          });
      key.confirmed = confirmed;
      const saved = await persistKey(key);
      const session = {
        id: createId("session"),
        name: saved.name,
        answerKeyId: saved.id,
        createdAt: Date.now(),
        paperCount: 0,
      };
      await saveSession(session);
      await savePrefs({ autoScan: true, lastAnswerKeyId: saved.id, lastSessionId: session.id });
      navigate(`/scan?session=${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this answer key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <TopBrand />
      <h2 className="font-serif text-3xl">Answer key</h2>
      <p className="mt-2 max-w-2xl text-ink/65">
        Teachers keep their existing papers. Enter the correct answers, or upload a solved copy and confirm what was detected.
      </p>

      <div className="mt-6 flex gap-2">
        <Tab active={tab === "manual"} onClick={() => setTab("manual")}>
          Type answers
        </Tab>
        <Tab active={tab === "upload"} onClick={() => setTab("upload")}>
          Upload solved paper
        </Tab>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Field label="Exam name" value={name} onChange={setName} placeholder="Science mid-term" />
        <Field label="Subject" value={subject} onChange={setSubject} placeholder="Science" />
        <Field label="Class" value={className} onChange={setClassName} placeholder="8A" />
      </div>

      {tab === "upload" && (
        <div className="mt-6 rounded-3xl border border-dashed border-rule bg-white p-5">
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
          <p className="mt-2 text-sm text-ink/55">JPG, PNG or PDF. Detection is confirmed before it is trusted.</p>
          {busy && <p className="mt-3 text-sm">Reading the paper…</p>}
          {preview && <img src={preview} alt="Uploaded paper" className="mt-4 max-h-80 rounded-2xl" />}
        </div>
      )}

      {warnings.map((w) => (
        <p key={w} className="mt-3 text-sm text-mark-orange">
          {w}
        </p>
      ))}
      {error && <p className="mt-3 text-sm text-mark-red">{error}</p>}

      <div className="mt-8 rounded-3xl border border-rule bg-white p-5">
        <h3 className="mb-4 font-serif text-2xl">Confirm answers</h3>
        <AnswerKeyEditor items={items} onChange={updateItems} />
      </div>

      <label className="mt-5 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!answersComplete || saving}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span>I have checked and confirm every answer in this answer key.</span>
      </label>
      {!answersComplete && (
        <p className="mt-2 text-sm text-mark-orange">
          Confirm each answer before saving ({items.filter((item) => item.answer !== null && !item.needsReview).length}/{items.length} complete).
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!answersComplete || !confirmed || saving}
          className="rounded-full bg-ink px-5 py-3 text-paper disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save and open scanner"}
        </button>
        <button
          type="button"
          onClick={() =>
            generateOmrSheet({
              id: draftKey?.id ?? "preview",
              name: name || "Exam",
              subject,
              className,
              questionCount: items.length,
              options: ["A", "B", "C", "D"],
              items,
              source: "manual",
              confirmed,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
          }
          className="rounded-full border border-rule px-5 py-3"
        >
          Download optional OMR sheet
        </button>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm ${active ? "bg-ink text-paper" : "bg-paper-dark text-ink/70"}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-ink/60">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-rule bg-white px-3 py-2"
      />
    </label>
  );
}

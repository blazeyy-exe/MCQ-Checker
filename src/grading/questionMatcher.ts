import type { AnswerKey, DetectedQuestion, GradedQuestion, OptionLabel } from "../types";

function similarText(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const na = a.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wa = new Set(na.split(/\s+/).filter((w) => w.length > 2));
  const wb = new Set(nb.split(/\s+/).filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.max(wa.size, wb.size);
}

export function matchQuestions(key: AnswerKey, detected: DetectedQuestion[]): GradedQuestion[] {
  const byNumber = new Map(detected.map((q) => [q.number, q]));
  return key.items.map((item) => {
    let found = byNumber.get(item.number);
    if (!found && item.questionText) {
      let best: DetectedQuestion | undefined;
      let bestScore = 0.45;
      for (const q of detected) {
        const s = similarText(item.questionText, q.questionText);
        if (s > bestScore) {
          bestScore = s;
          best = q;
        }
      }
      found = best;
    }

    if (!found) {
      return {
        number: item.number,
        keyAnswer: item.answer,
        detectedAnswers: [],
        effectiveAnswer: null,
        status: "missing",
        confidence: "low",
        questionText: item.questionText,
        optionBoxes: [],
        box: { x: 0, y: 0, width: 0, height: 0 },
      };
    }

    const selected = found.selected;
    let status: GradedQuestion["status"];
    let effective: OptionLabel | null = null;
    if (item.answer === null) status = "uncertain";
    else if (found.status === "multiple" || selected.length > 1) status = "multiple";
    else if (found.status === "uncertain") status = "uncertain";
    else if (found.status === "selected" && found.confidence !== "high") status = "uncertain";
    else if (found.status === "unanswered" || selected.length === 0) status = "unanswered";
    else {
      effective = selected[0];
      status = effective === item.answer ? "correct" : "incorrect";
    }
    const confidence = item.answer === null ? "low" : found.confidence;

    return {
      number: item.number,
      keyAnswer: item.answer,
      detectedAnswers: selected,
      effectiveAnswer: effective,
      status,
      confidence,
      detectedStatus: status,
      detectedConfidence: confidence,
      questionText: found.questionText ?? item.questionText,
      optionBoxes: found.options,
      box: found.box,
    };
  });
}

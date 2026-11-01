import type { AnswerKey, AnswerKeyItem, ConfidenceLevel, OptionLabel } from "../types";
import { OPTION_LABELS } from "../types";
import { createId } from "../lib/ids";

export function blankItems(count: number): AnswerKeyItem[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    answer: null,
    confidence: "low" as ConfidenceLevel,
    needsReview: true,
  }));
}

export function areAnswerKeyItemsComplete(items: AnswerKeyItem[], questionCount: number): boolean {
  return (
    questionCount > 0 &&
    items.length === questionCount &&
    items.every((item, index) =>
      item.number === index + 1 &&
      item.answer !== null &&
      OPTION_LABELS.includes(item.answer) &&
      !item.needsReview,
    )
  );
}

export function isAnswerKeyComplete(key: AnswerKey): boolean {
  return key.confirmed === true && areAnswerKeyItemsComplete(key.items, key.questionCount);
}

export function parseBulkAnswers(value: string, maxQuestions = 100): Array<OptionLabel | null> {
  const normalized = value.toUpperCase().trim();
  if (!normalized) return [];
  const tokens = /[,;]/.test(normalized)
    ? normalized.split(/[,;]/).map((part) => part.replace(/\s+/g, ""))
    : [normalized.replace(/\s+/g, "")];

  return tokens
    .flatMap((token) => (token ? [...token] : [""]))
    .slice(0, maxQuestions)
    .map((token) => (OPTION_LABELS.includes(token as OptionLabel) ? (token as OptionLabel) : null));
}

export function assertAnswerKeyComplete(key: AnswerKey): void {
  if (!isAnswerKeyComplete(key)) {
    throw new Error("Confirm an answer for every question before saving this answer key.");
  }
}

export function createManualKey(input: {
  name: string;
  subject: string;
  className: string;
  answers: Array<OptionLabel | null>;
}): AnswerKey {
  const now = Date.now();
  return {
    id: createId("key"),
    name: input.name.trim() || "Untitled exam",
    subject: input.subject.trim(),
    className: input.className.trim(),
    questionCount: input.answers.length,
    options: OPTION_LABELS,
    items: input.answers.map((answer, i) => ({
      number: i + 1,
      answer,
      confidence: answer === null ? "low" : "high",
      needsReview: answer === null,
    })),
    source: "manual",
    confirmed: false,
    createdAt: now,
    updatedAt: now,
  };
}

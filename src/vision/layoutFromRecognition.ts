import type { DetectedQuestion, PaperLayout } from "../types";
import { absToRel } from "../lib/geometry";
import { createId } from "../lib/ids";

export function layoutFromQuestions(
  questions: DetectedQuestion[],
  pageWidth: number,
  pageHeight: number,
  answerKeyId: string,
  confirmed: boolean,
): PaperLayout {
  const xs = questions.map((q) => q.box.x);
  const columns: 1 | 2 =
    xs.length >= 4 && Math.max(...xs) - Math.min(...xs) > pageWidth * 0.28 ? 2 : 1;
  return {
    id: createId("layout"),
    answerKeyId,
    name: "Detected layout",
    pageAspect: pageHeight / pageWidth,
    columns,
    confirmed,
    createdAt: Date.now(),
    questions: questions.map((q) => ({
      number: q.number,
      numberBox: absToRel(q.box, pageWidth, pageHeight),
      questionBox: absToRel(q.box, pageWidth, pageHeight),
      options: q.options.map((o) => ({
        label: o.label,
        box: absToRel(o.labelBox ?? o.box, pageWidth, pageHeight),
      })),
    })),
  };
}

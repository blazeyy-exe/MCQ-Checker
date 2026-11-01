import { jsPDF } from "jspdf";
import type { AnswerKey, GradingResult } from "../types";
import { OPTION_LABELS } from "../types";

export async function exportResultPdf(result: GradingResult, examName: string): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 39, 68);
  doc.rect(0, 0, width, 72, "F");
  doc.setTextColor(246, 241, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MCQ Checker", 40, 32);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(examName || "Examination result", 40, 52);

  doc.setTextColor(26, 39, 68);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(`${result.score} / ${result.total}`, 40, 120);
  doc.setFontSize(14);
  doc.text(`${result.percentage}%  ·  ${result.studentLabel || "Unnamed student"}`, 40, 144);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const summary = [
    `${result.correct} correct`,
    `${result.incorrect} incorrect`,
    `${result.unanswered} unanswered`,
    `${result.multiple} multiple`,
    `${result.uncertain} uncertain`,
  ].join("   ·   ");
  doc.text(summary, 40, 168);
  if (!result.verified) {
    doc.setTextColor(196, 60, 60);
    doc.text("This score includes uncertain detections and needs teacher review.", 40, 188);
    doc.setTextColor(26, 39, 68);
  }

  let y = 220;
  doc.setFont("helvetica", "bold");
  doc.text("Question breakdown", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const q of result.questions) {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }
    const detected = q.detectedAnswers.join("/") || "—";
    const line = `Q${q.number}  key ${q.keyAnswer ?? "—"}   detected ${detected}   ${q.status}`;
    doc.text(line, 40, y);
    y += 14;
  }

  if (result.annotatedDataUrl) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Annotated paper", 40, 40);
    const imgW = width - 80;
    const imgH = 680;
    try {
      doc.addImage(result.annotatedDataUrl, "JPEG", 40, 56, imgW, imgH);
    } catch {
      doc.setFont("helvetica", "normal");
      doc.text("Could not embed the annotated image.", 40, 80);
    }
  }

  doc.save(`${examName || "mcq"}-${result.studentLabel || "student"}.pdf`.replace(/\s+/g, "-"));
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function generateOmrSheet(key: AnswerKey): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 39, 68);
  doc.rect(0, 0, width, 64, "F");
  doc.setTextColor(246, 241, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MCQ Checker — optional answer sheet", 40, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${key.name}  ·  ${key.questionCount} questions  ·  Name: ____________________`, 40, 50);

  doc.setTextColor(26, 39, 68);
  let y = 96;
  const colWidth = (width - 80) / 2;
  const perCol = Math.ceil(key.questionCount / 2);
  for (let i = 0; i < key.questionCount; i++) {
    const col = i < perCol ? 0 : 1;
    const row = i < perCol ? i : i - perCol;
    const x = 40 + col * colWidth;
    y = 96 + row * 28;
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, x, y);
    OPTION_LABELS.forEach((label, idx) => {
      const cx = x + 36 + idx * 36;
      doc.setDrawColor(26, 39, 68);
      doc.circle(cx, y - 3, 7, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(label, cx - 3, y - 12);
      doc.setFontSize(10);
    });
  }
  doc.setFontSize(9);
  doc.text("This sheet is optional. MCQ Checker can also grade ordinary question papers.", 40, 800);
  doc.save(`${key.name || "mcq"}-omr-sheet.pdf`.replace(/\s+/g, "-"));
}

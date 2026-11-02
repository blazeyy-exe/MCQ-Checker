import type { GradedQuestion, OptionLabel } from "../types";
import { createCanvas, getContext, loadImageElement } from "../lib/image";
import { inflateRect } from "../lib/geometry";

const COLORS: Record<string, string> = {
  correct: "#16A34A",
  incorrect: "#E5484D",
  unanswered: "#1E90FF",
  multiple: "#F59E0B",
  uncertain: "#F59E0B",
  missing: "#1E90FF",
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function renderAnnotatedPaper(
  warpedDataUrl: string,
  questions: GradedQuestion[],
): Promise<string> {
  const img = await loadImageElement(warpedDataUrl);
  const canvas = createCanvas(img.width, img.height);
  const ctx = getContext(canvas);
  ctx.drawImage(img, 0, 0);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const q of questions) {
    const color = COLORS[q.status];
    const selected = new Set(
      q.teacherOverride && q.teacherOverride !== "unanswered"
        ? [q.teacherOverride]
        : q.detectedAnswers,
    );

    if (q.status === "unanswered" || q.status === "missing") {
      const box = q.box.width ? q.box : { x: 24, y: 24 + q.number * 8, width: 80, height: 28 };
      ctx.strokeStyle = color;
      ctx.fillStyle = "rgba(30, 144, 255, 0.22)";
      ctx.lineWidth = Math.max(3, img.width / 400);
      roundRect(ctx, box.x, box.y, Math.max(48, box.width * 0.22), Math.max(22, box.height * 0.18), 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `700 ${Math.max(16, img.width / 52)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(`${q.status === "unanswered" ? "—" : "?"} Q${q.number}`, box.x + 8, box.y + Math.max(18, box.height * 0.14));
      continue;
    }

    for (const opt of q.optionBoxes) {
      if (!selected.has(opt.label as OptionLabel) && q.status !== "multiple") continue;
      if (q.status === "multiple" && !q.detectedAnswers.includes(opt.label)) continue;
      const box = inflateRect(opt.box, 8, 6);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(4, img.width / 280);
      roundRect(ctx, box.x, box.y, box.width, box.height, box.height / 2);
      ctx.stroke();
    }

    if (q.status === "incorrect" && q.keyAnswer) {
      const keyBox = q.optionBoxes.find((o) => o.label === q.keyAnswer);
      if (keyBox) {
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = "#16A34A";
        ctx.lineWidth = Math.max(3, img.width / 360);
        const box = inflateRect(keyBox.box, 6, 4);
        roundRect(ctx, box.x, box.y, box.width, box.height, box.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

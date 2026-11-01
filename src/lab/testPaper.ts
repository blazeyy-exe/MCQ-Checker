import { OPTION_LABELS, type OptionLabel } from "../types";
import { createCanvas, getContext } from "../lib/image";

export interface SyntheticPaper {
  canvas: HTMLCanvasElement;
  answers: OptionLabel[];
  layout: "single" | "two-column";
  mark: "circle" | "tick" | "fill" | "blank" | "multiple";
}

const BANK = [
  ["The capital of Nepal is", "Pokhara", "Kathmandu", "Hetauda", "Biratnagar"],
  ["Which planet is known as the red planet?", "Venus", "Mars", "Jupiter", "Mercury"],
  ["H2O is the chemical formula of", "Salt", "Water", "Oxygen", "Ozone"],
  ["The smallest prime number is", "0", "1", "2", "3"],
  ["Photosynthesis occurs in the", "Root", "Stem", "Leaf", "Flower"],
  ["The square root of 64 is", "6", "7", "8", "9"],
  ["Which gas do plants absorb?", "Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
  ["The Himalayas lie in", "Africa", "Australia", "Asia", "Europe"],
  ["A triangle has how many sides?", "2", "3", "4", "5"],
  ["The boiling point of water is", "90°C", "80°C", "100°C", "120°C"],
];

export function generateTestPaper(options: {
  count?: number;
  layout?: "single" | "two-column";
  mark?: SyntheticPaper["mark"];
  answers?: OptionLabel[];
  seed?: number;
}): SyntheticPaper {
  const count = options.count ?? 10;
  const layout = options.layout ?? "single";
  const mark = options.mark ?? "circle";
  const answers =
    options.answers ??
    Array.from({ length: count }, (_, i) => OPTION_LABELS[(i * 3 + 1) % 4]);

  const canvas = createCanvas(layout === "two-column" ? 1400 : 1100, layout === "two-column" ? 1600 : 1550);
  const ctx = getContext(canvas);
  ctx.fillStyle = "#f7f4ec";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a2744";
  ctx.font = "700 34px Georgia";
  ctx.fillText("Mid-Term Examination", 64, 70);
  ctx.font = "16px Georgia";
  ctx.fillText("Science  ·  Class 8  ·  Time: 45 minutes", 64, 98);
  ctx.strokeStyle = "#d7cdb8";
  ctx.beginPath();
  ctx.moveTo(64, 118);
  ctx.lineTo(canvas.width - 64, 118);
  ctx.stroke();

  const colCount = layout === "two-column" ? 2 : 1;
  const perCol = Math.ceil(count / colCount);
  const colWidth = (canvas.width - 120) / colCount;

  for (let i = 0; i < count; i++) {
    const item = BANK[i % BANK.length];
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = 64 + col * colWidth;
    const y = 150 + row * (layout === "two-column" ? 260 : 132);
    ctx.fillStyle = "#1a2744";
    ctx.font = "600 18px Georgia";
    ctx.fillText(`${i + 1}. ${item[0]}`, x, y);
    const chosen = answers[i];
    for (let o = 0; o < 4; o++) {
      const label = OPTION_LABELS[o];
      const ox = layout === "two-column" ? x : x + o * 230;
      const oy = layout === "two-column" ? y + 28 + o * 28 : y + 36;
      ctx.font = "16px Georgia";
      ctx.fillStyle = "#1a2744";
      const text = `${label}. ${item[o + 1]}`;
      ctx.fillText(text, ox, oy);
      const selected = mark === "multiple" ? label === "A" || label === "C" : label === chosen;
      if (!selected || mark === "blank") continue;
      ctx.strokeStyle = "#1a2744";
      ctx.lineWidth = 2.4;
      if (mark === "circle" || mark === "multiple") {
        ctx.beginPath();
        ctx.ellipse(ox + 10, oy - 5, 16, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (mark === "tick") {
        ctx.beginPath();
        ctx.moveTo(ox - 18, oy - 4);
        ctx.lineTo(ox - 10, oy + 4);
        ctx.lineTo(ox - 2, oy - 12);
        ctx.stroke();
      } else if (mark === "fill") {
        ctx.beginPath();
        ctx.arc(ox - 14, oy - 5, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return { canvas, answers, layout, mark };
}

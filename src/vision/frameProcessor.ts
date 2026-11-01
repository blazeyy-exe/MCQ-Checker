import type { PaperDetection } from "../types";
import { detectDocument } from "./documentDetector";
import { downscaleImageData } from "../lib/image";

export function processPreviewFrame(data: ImageData, cv?: OpenCV | null): PaperDetection {
  return detectDocument(downscaleImageData(data, 360), cv);
}

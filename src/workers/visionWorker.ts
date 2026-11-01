import { detectDocument } from "../vision/documentDetector";
import { downscaleImageData } from "../lib/image";

type Request = {
  id: number;
  type: "detect";
  width: number;
  height: number;
  buffer: ArrayBuffer;
};

self.onmessage = (event: MessageEvent<Request>) => {
  const msg = event.data;
  if (msg.type !== "detect") return;
  const data = new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height);
  const small = downscaleImageData(data, 360);
  const detection = detectDocument(small);
  self.postMessage({ id: msg.id, detection });
};

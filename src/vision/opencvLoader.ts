const OPENCV_URLS = [
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.1/dist/opencv.js",
  "https://docs.opencv.org/4.9.0/opencv.js",
];

let loading: Promise<OpenCV | null> | null = null;

function waitForCv(timeoutMs = 20000): Promise<OpenCV | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (window.cv?.Mat) {
        resolve(window.cv);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve(window.cv?.Mat ? window.cv : null);
        return;
      }
      requestAnimationFrame(tick);
    };
    if (window.cv && typeof window.cv.onRuntimeInitialized !== "undefined") {
      window.cv.onRuntimeInitialized = () => resolve(window.cv ?? null);
    }
    tick();
  });
}

function inject(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.opencv = "true";
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load OpenCV from ${url}`));
    document.head.appendChild(script);
  });
}

export function loadOpenCV(): Promise<OpenCV | null> {
  if (typeof window !== "undefined" && window.cv?.Mat) {
    return Promise.resolve(window.cv);
  }
  if (loading) return loading;
  loading = (async () => {
    if (document.querySelector("script[data-opencv]")) {
      return waitForCv();
    }
    for (const url of OPENCV_URLS) {
      try {
        await inject(url);
        const runtime = await waitForCv();
        if (runtime) return runtime;
      } catch {
        document.querySelector("script[data-opencv]")?.remove();
      }
    }
    return null;
  })();
  return loading;
}

export function imageDataToMat(cv: OpenCV, data: ImageData): CvMat {
  if (typeof cv.matFromImageData === "function") {
    return cv.matFromImageData(data);
  }
  const holder = document.createElement("canvas");
  holder.width = data.width;
  holder.height = data.height;
  const ctx = holder.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.putImageData(data, 0, 0);
  return cv.imread(holder);
}

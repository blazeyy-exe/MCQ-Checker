/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENCV_URL?: string;
}

interface Window {
  cv?: OpenCV;
}

type OpenCV = {
  Mat: new () => CvMat;
  MatVector: new () => { size: () => number; get: (i: number) => CvMat; delete: () => void };
  Size: new (w: number, h: number) => { width: number; height: number };
  Point: new (x: number, y: number) => { x: number; y: number };
  Scalar: new (a: number, b?: number, c?: number, d?: number) => unknown;
  COLOR_RGBA2GRAY: number;
  COLOR_RGB2GRAY: number;
  COLOR_GRAY2RGBA: number;
  RETR_LIST: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_8UC1: number;
  CV_8UC4: number;
  CV_32FC2: number;
  BORDER_DEFAULT: number;
  MORPH_RECT: number;
  MORPH_CLOSE: number;
  THRESH_BINARY: number;
  THRESH_OTSU: number;
  INTER_LINEAR: number;
  imread: (el: HTMLCanvasElement | HTMLImageElement) => CvMat;
  imshow: (el: HTMLCanvasElement | string, mat: CvMat) => void;
  cvtColor: (src: CvMat, dst: CvMat, code: number) => void;
  GaussianBlur: (src: CvMat, dst: CvMat, ksize: { width: number; height: number }, sigma: number) => void;
  Canny: (src: CvMat, dst: CvMat, t1: number, t2: number) => void;
  findContours: (src: CvMat, contours: unknown, hierarchy: CvMat, mode: number, method: number) => void;
  approxPolyDP: (curve: CvMat, approx: CvMat, epsilon: number, closed: boolean) => void;
  arcLength: (curve: CvMat, closed: boolean) => number;
  contourArea: (curve: CvMat) => number;
  isContourConvex: (curve: CvMat) => boolean;
  getPerspectiveTransform: (src: CvMat, dst: CvMat) => CvMat;
  warpPerspective: (src: CvMat, dst: CvMat, m: CvMat, size: { width: number; height: number }) => void;
  matFromArray: (rows: number, cols: number, type: number, array: number[]) => CvMat;
  matFromImageData: (data: ImageData) => CvMat;
  Laplacian: (src: CvMat, dst: CvMat, ddepth: number) => void;
  meanStdDev: (src: CvMat, mean: CvMat, std: CvMat) => void;
  cvtColor?: (src: CvMat, dst: CvMat, code: number) => void;
  dilate: (src: CvMat, dst: CvMat, kernel: CvMat) => void;
  getStructuringElement: (shape: number, ksize: { width: number; height: number }) => CvMat;
  adaptiveThreshold: (
    src: CvMat,
    dst: CvMat,
    maxValue: number,
    adaptiveMethod: number,
    thresholdType: number,
    blockSize: number,
    C: number,
  ) => void;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;
  morphologyEx: (src: CvMat, dst: CvMat, op: number, kernel: CvMat) => void;
  onRuntimeInitialized?: () => void;
  ready?: Promise<void>;
};

type CvMat = {
  rows: number;
  cols: number;
  data: Uint8Array;
  data32F: Float32Array;
  data32S: Int32Array;
  delete: () => void;
  clone: () => CvMat;
};

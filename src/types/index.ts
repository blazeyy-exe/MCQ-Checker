export type OptionLabel = "A" | "B" | "C" | "D";

export const OPTION_LABELS: OptionLabel[] = ["A", "B", "C", "D"];

export type ConfidenceLevel = "high" | "medium" | "low";

export type QuestionStatus =
  | "correct"
  | "incorrect"
  | "unanswered"
  | "multiple"
  | "uncertain"
  | "missing";

export type DetectionStatus =
  | "selected"
  | "unanswered"
  | "multiple"
  | "uncertain";

export type ScannerPhase =
  | "waiting"
  | "detecting"
  | "stabilizing"
  | "analyzing"
  | "scanning"
  | "graded"
  | "ready";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Quad {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

export interface AnswerKeyItem {
  number: number;
  answer: OptionLabel | null;
  questionText?: string;
  confidence: ConfidenceLevel;
  needsReview: boolean;
}

export interface AnswerKey {
  id: string;
  name: string;
  subject: string;
  className: string;
  questionCount: number;
  options: OptionLabel[];
  items: AnswerKeyItem[];
  source: "manual" | "upload";
  confirmed: boolean;
  createdAt: number;
  updatedAt: number;
  layoutId?: string;
}

export interface LayoutOptionRegion {
  label: OptionLabel;
  box: RelRect;
}

export interface LayoutQuestionRegion {
  number: number;
  numberBox: RelRect;
  questionBox: RelRect;
  options: LayoutOptionRegion[];
}

export interface PaperLayout {
  id: string;
  answerKeyId: string;
  name: string;
  pageAspect: number;
  columns: 1 | 2;
  questions: LayoutQuestionRegion[];
  confirmed: boolean;
  createdAt: number;
}

export interface DetectedOption {
  label: OptionLabel;
  text?: string;
  labelBox?: Rect;
  box: Rect;
  markScore: number;
  ringInk: number;
  interiorInk: number;
  gutterInk: number;
  circleCoverage?: number;
  uncertaintyReason?: string;
}

export interface DetectedQuestion {
  number: number;
  questionText?: string;
  box: Rect;
  options: DetectedOption[];
  selected: OptionLabel[];
  status: DetectionStatus;
  confidence: ConfidenceLevel;
  recognizedOptions?: OptionLabel[];
  uncertaintyReasons?: string[];
}

export interface StudentPaperRecognition {
  questions: DetectedQuestion[];
  ocrText: string;
  processingMs: number;
  warnings: string[];
  issues: RecognitionIssue[];
  sourceDataUrl: string;
  warpedDataUrl: string;
  originalDataUrl: string;
  ocrWords: Array<{ text: string; confidence: number; bbox: Rect }>;
  sourceWidth: number;
  sourceHeight: number;
  pageWidth: number;
  pageHeight: number;
  usedLayout: boolean;
  paperQuad?: Quad;
}

export interface RecognitionIssue {
  code: "no_questions" | "incomplete_options" | "ambiguous_mark" | "unconfirmed_layout";
  message: string;
  questionNumber?: number;
}

export interface GradedQuestion {
  number: number;
  keyAnswer: OptionLabel | null;
  detectedAnswers: OptionLabel[];
  effectiveAnswer: OptionLabel | null;
  teacherOverride?: OptionLabel | "unanswered";
  detectedStatus?: QuestionStatus;
  detectedConfidence?: ConfidenceLevel;
  status: QuestionStatus;
  confidence: ConfidenceLevel;
  questionText?: string;
  optionBoxes: DetectedOption[];
  box: Rect;
}

export interface GradingResult {
  id: string;
  sessionId: string;
  answerKeyId: string;
  studentLabel: string;
  createdAt: number;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  multiple: number;
  uncertain: number;
  missing: number;
  score: number;
  percentage: number;
  verified: boolean;
  questions: GradedQuestion[];
  originalDataUrl: string;
  warpedDataUrl: string;
  annotatedDataUrl: string;
  ocrText: string;
  warnings: string[];
  processingMs: number;
  usedLayout: boolean;
  debug?: RecognitionDebug;
}

export interface RecognitionDebug {
  sourceDataUrl: string;
  warpedDataUrl: string;
  ocrText: string;
  ocrWords: Array<{ text: string; confidence: number; bbox: Rect }>;
  questionBoxes: Array<{ number: number; box: Rect }>;
  optionBoxes: Array<{
    number: number;
    label: OptionLabel;
    text?: string;
    labelBox?: Rect;
    box: Rect;
    markScore: number;
    circleCoverage?: number;
    uncertaintyReason?: string;
  }>;
  questions: DetectedQuestion[];
  issues: RecognitionIssue[];
  timings: Record<string, number>;
}

export interface GradingSession {
  id: string;
  name: string;
  answerKeyId: string;
  createdAt: number;
  paperCount: number;
}

export interface PaperDetection {
  found: boolean;
  quad?: Quad;
  coverage: number;
  sharpness: number;
  message: string;
}

export interface AppPreferences {
  autoScan: boolean;
  lastAnswerKeyId?: string;
  lastSessionId?: string;
}

# Tickd - MCQ Checker

**A camera-powered examination grading tool built with computer vision.**

Tickd helps teachers check physical multiple-choice examination papers using a camera. It detects student answers then compares them against a confirmed answer key and displays grading results directly over the paper through a live camera overlay.

The goal is to make MCQ checking faster without requiring specialized OMR sheets or scanning equipment.

## How it works

1. **Create an answer key** — Enter answers manually or upload a solved question paper for OCR-based extraction and review.
2. **Scan a paper** — Use a phone camera to detect and process a printed MCQ examination paper.
3. **Recognize answers** — Detect questions, options and student markings using OCR and computer vision.
4. **Grade automatically** — Compare recognized answers with the confirmed answer key.
5. **View live results** — Display color-coded grading indicators over the paper in the camera preview.

| Indicator | Meaning |
|---|---|
| 🟢 Green | Correct |
| 🔴 Red | Incorrect |
| 🔵 Blue | Unanswered |
| 🟠 Orange | Ambiguous or multiple selections |

## Technical Highlights

- **Computer Vision:** Paper detection, perspective correction, image normalization and answer-mark analysis using OpenCV.
- **OCR:** Text extraction and question recognition using Tesseract.js.
- **Document Tracking:** Lucas–Kanade optical flow and RANSAC-based homography updates for tracking paper movement across camera frames.
- **AR Coordinate Mapping:** Projective transformations to map recognized answer locations onto the live camera preview.
- **Canvas Rendering:** Real-time grading overlays synchronized with the camera feed.
- **Browser Camera API:** Live video capture using `getUserMedia`.
- **PDF Processing:** Extract and render uploaded examination papers using PDF.js.
- **Local Data Storage:** Persistent browser-side storage using IndexedDB and Dexie.
- **Testing:** Automated tests for recognition, grading, document tracking and coordinate transformations.

## Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Computer Vision | OpenCV.js |
| OCR | Tesseract.js |
| Camera | MediaDevices API |
| AR Overlays | Canvas API |
| PDF Processing | PDF.js |
| Local Storage | IndexedDB, Dexie |
| Testing | Node.js Test Runner, esbuild |

## Getting Started

### Prerequisites

- Node.js
- npm
- A modern browser with camera access

### Installation

```bash
git clone <your-repository-url>
cd mcq-checker
npm install
npm run dev
```

Open the local URL provided by Vite.

For camera testing on a phone, use HTTPS or a secure local development setup. Browser camera access is generally restricted to secure contexts.

### Available Commands

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run test      # Run automated tests
```

## Project Status

The core application, answer-key workflow, recognition pipeline, grading engine and live AR overlay infrastructure have been implemented.

**Latest automated verification:**
- 38 tests passing
- Production build successful
- Git diff checks passing

Real-world recognition accuracy and live camera tracking are still undergoing physical-device validation. Performance under different lighting conditions, camera angles, paper layouts and handwriting or marking styles has not yet been established.

The initial recognition target is printed, single-column MCQ papers with four options (A–D). Support for more varied layouts and marking styles remains an area for improvement.

## Engineering Approach

A key design decision is to keep uncertain recognition separate from verified grading.

Extracted answer keys require teacher confirmation. Ambiguous student markings are flagged rather than silently treated as correct or incorrect. Tracking loss clears the live overlay to prevent outdated grading indicators from appearing in the wrong position.

The application is designed around browser-based processing and local data storage, avoiding a mandatory paid AI API.

---

**Built as an exploration of computer vision, real-time document tracking and practical human-computer interaction.**
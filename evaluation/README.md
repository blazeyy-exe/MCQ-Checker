# Ordinary-paper recognition evaluation

There are currently no real examination-paper images or manually labeled examples in this repository. Synthetic lab pages are useful for deterministic development tests only and must not be reported as real-paper accuracy.

## Capture a labeled case

1. Open the developer route `/lab/debug` in the running app.
2. Upload an ordinary single-column paper image and run recognition.
3. Enter ground truth using `question:answer` entries, for example:

   ```text
   1:B, 2:blank, 3:A+C, 4:?
   ```

   Use `A`, `B`, `C`, or `D` for one selected answer; `blank` for an unanswered question; `A+C` for multiple circled options; and `?` for a manually judged uncertain mark.
4. Download the evaluation-case JSON. Keep the original image, case file, and annotation provenance together outside the source tree when the paper contains student data.
5. Add exported cases to a JSON array and evaluate them with:

   ```powershell
   npm run evaluate -- .\path\to\labeled-cases.json
   ```

The evaluator reports per-question detection, option-label association, exact answer, unanswered, multiple-selection, false-positive/negative selection, and average processing-time metrics. `exactAnswerAccuracy` and the classification metrics are percentages. False positive and false negative values are counts.

The page's single-case metrics are a debugging aid, not an accuracy claim. Report aggregate scores only on a documented, held-out set of real papers with verified labels. Do not put identifiable student papers in the repository.

## Case format

Each case contains `filename`, `groundTruth` (question number, selected labels, and expected status), and `recognition` (the recognizer's `processingMs` and structured `questions`). The browser debug page exports this format.

## Live AR tracking manual test

Use a real phone with a rear camera and a real printed, single-column MCQ paper (four labeled options per question). Serve the app from an HTTPS origin or `localhost`; mobile browsers generally block camera access from an insecure LAN URL. Create and confirm a complete answer key first.

1. Open the scanner, leave **Live AR overlay** enabled, and allow camera access. Turn on **Tracking debug** in the camera preview.
2. Place the paper fully in frame with a visible margin and hold it steady until the scanner detects it and grading finishes. Check that the paper outline follows all four page edges. Green/red markers should appear only for high-confidence graded answers, blue for recognized blanks, and orange for recognized multiple/uncertain answers. Confirm the Results link still opens the normal review page.
3. Slowly translate, rotate, and tilt the page and then move the phone. Check that markers remain attached to the same printed option labels. Compare the debug corners, homography, cover scale/crop, preview mirroring, and overlay visibility while moving.
4. Briefly blur the page, then fully remove it. The outline and all answer markers must disappear promptly and the status must report loss/repositioning. Point the camera at another bright object or a different paper; the old result must not appear on it.
5. Reintroduce the same paper at a different scale and perspective. Tracking should reacquire with a fresh mapping; the old grading overlay remains cleared until the teacher captures/regrades. Use **Next paper** to explicitly arm another scan; the scanner does not silently reuse the previous student's result.
6. Repeat with the paper near the preview edges, with a portrait and landscape camera stream if available, and with a mirrored preview only if the host explicitly enables mirroring. Compare positions against the physical printed labels, not just the camera boundary.
7. Switch cameras and navigate away from the scanner. Confirm tracking stops, the camera is released on unmount, and no canvas overlay remains.

Record device/browser, camera resolution, paper orientation, lighting, observed drift/loss/reacquisition, and any incorrect or hidden indicators. This is a manual smoke procedure, not evidence of general tracking accuracy; automated fixtures test transformations and lifecycle policy only.

## Coordinate model used by the live overlay

### Audit of the pre-overlay scanner

Before this phase, preview document detection ran on a frame canvas capped at 360 px wide, while a captured image was independently capped at 1600 px for recognition. Detected paper corners from a capture were therefore in capture-canvas pixels; parsed question/option rectangles were in the perspective-corrected page pixels. Neither coordinate set was inherently in preview pixels. The camera UI drew detector corners in a fixed 360×480 SVG despite the video-derived detector canvas keeping the camera's source aspect ratio, and there was no frame-to-frame tracker. Preview crop, DPR, and optional mirroring were not included in that SVG mapping. OCR and grading were performed only during a capture; preview document detection did not call OCR.

The live scanner now maintains a tracked quad in native video-frame pixels. For a corrected-page point `p=(x,y)`, construct projective homography `Hpage→frame` from page corners `(0,0)`, `(Wp−1,0)`, `(Wp−1,Hp−1)`, `(0,Hp−1)` to the currently tracked camera-frame corners. Project with homogeneous division:

```text
u = (h00*x + h01*y + h02) / (h20*x + h21*y + h22)
v = (h10*x + h11*y + h12) / (h20*x + h21*y + h22)
```

For an `object-fit: cover` preview of CSS size `Wc×Hc` from video source size `Wv×Hv`, use `s=max(Wc/Wv,Hc/Hv)`, offsets `ox=(Wc−sWv)/2`, `oy=(Hc−sHv)/2`, then `(xcss,ycss)=(s*u+ox,s*v+oy)`. If the preview is mirrored, use `xcss=Wc−xcss`. The canvas backing dimensions are `round(Wc×DPR)` by `round(Hc×DPR)` and its drawing context is scaled by DPR; DPR is not included in the geometric coordinate transform.

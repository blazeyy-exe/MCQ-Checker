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

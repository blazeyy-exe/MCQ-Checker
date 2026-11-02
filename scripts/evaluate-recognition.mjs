import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const manifestPath = process.argv[2];
if (!manifestPath) {
  throw new Error("Usage: npm run evaluate -- <labeled-cases.json>");
}

const cases = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
if (!Array.isArray(cases) || cases.length === 0) {
  throw new Error("The evaluation manifest must be a non-empty JSON array of labeled cases.");
}

const projectDirectory = fileURLToPath(new URL("..", import.meta.url));
const outputFile = join(tmpdir(), `mcq-recognition-metrics-${process.pid}.mjs`);
try {
  await build({
    absWorkingDir: projectDirectory,
    entryPoints: ["src/evaluation/recognitionMetrics.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    outfile: outputFile,
  });
  const { evaluateRecognitionCases } = await import(pathToFileURL(outputFile).href);
  console.log(JSON.stringify(evaluateRecognitionCases(cases), null, 2));
} finally {
  const { rm } = await import("node:fs/promises");
  await rm(outputFile, { force: true });
}

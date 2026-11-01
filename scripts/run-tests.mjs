import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectDirectory = fileURLToPath(new URL("..", import.meta.url));
const testDirectory = join(projectDirectory, "tests");
const tests = (await readdir(testDirectory))
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => join(testDirectory, name));

if (tests.length === 0) {
  throw new Error("No test files found in tests/.");
}

const outputDirectory = await mkdtemp(join(tmpdir(), "mcq-checker-tests-"));
try {
  await build({
    absWorkingDir: projectDirectory,
    entryPoints: tests,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    outdir: outputDirectory,
    entryNames: "[name]",
  });
  const outputFiles = (await readdir(outputDirectory)).map((name) => join(outputDirectory, name));
  const result = spawnSync(process.execPath, ["--test", ...outputFiles], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}

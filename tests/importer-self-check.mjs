import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildCatalog } from "../tools/build-catalog.mjs";

const temporary = await mkdtemp(path.join(os.tmpdir(), "paradigm-importer-"));
const packages = path.join(temporary, "packages");
const output = path.join(temporary, "catalog.generated.js");

try {
  const stroop = path.join(packages, "stroop-demo");
  const unknown = path.join(packages, "mystery-task");
  const ready = path.join(packages, "simple-reaction");
  await mkdir(stroop, { recursive: true });
  await mkdir(unknown, { recursive: true });
  await mkdir(ready, { recursive: true });
  await writeFile(path.join(stroop, "index.html"), "<title>Stroop Demo</title><script src='experiment.js'></script>");
  await writeFile(path.join(stroop, "experiment.js"), "const psychoJS = new PsychoJS(); fetch('https://example.test/session');");
  await writeFile(path.join(stroop, "README.md"), "# Stroop Demo\nA colour-word interference task for attention.");
  await writeFile(path.join(ready, "index.html"), "<title>Simple Reaction Time</title><button>Start</button>");
  await writeFile(path.join(ready, "bridge.js"), "parent.postMessage({type:'cognition-lab:complete', trials:[]}, '*');");
  await writeFile(path.join(ready, "description.md"), "# Simple Reaction Time\n\n## Learning goal\n\nA teaching task.");
  await writeFile(path.join(ready, "manifest.json"), JSON.stringify({
    name: "Simple Reaction Time",
    shortDescription: "Press a key when the target appears.",
    approved: true,
    license: "MIT",
    dataExport: "adapter",
    result: { profile: "generic", fields: { correct: "correct", rt: "rt", condition: "condition" }, levels: [] },
  }));

  const found = await buildCatalog({ packagesDir: packages, output });
  assert.equal(found.length, 3);

  const detected = found.find((item) => item.id === "stroop-demo");
  assert.equal(detected.name, "Stroop Demo");
  assert.equal(detected.category, "注意与执行控制");
  assert.equal(detected.platform, "PsychoJS");
  assert.equal(detected.status, "review");
  assert.ok(detected.issues.includes("检测到可能的数据联网代码，尚未明确允许"));

  const blocked = found.find((item) => item.id === "mystery-task");
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.category, "待整理");

  const launchable = found.find((item) => item.id === "simple-reaction");
  assert.equal(launchable.status, "ready");
  assert.equal(launchable.category, "基础反应");
  assert.equal(launchable.dataExport, "adapter");
  assert.equal(launchable.descriptionPath, "./paradigms/packages/simple-reaction/description.md");
  console.log("importer self-check passed: discovery, classification, and safety states");
} finally {
  await rm(temporary, { recursive: true, force: true });
}

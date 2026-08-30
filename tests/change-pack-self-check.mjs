import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applyChanges } from "../tools/apply-changes.mjs";

const temporary = await mkdtemp(path.join(os.tmpdir(), "cognition-changes-"));
const project = path.join(temporary, "project");
const changeRoot = path.join(temporary, "changes");
try {
  await mkdir(path.join(project, "paradigms", "packages", "old-task"), { recursive: true });
  await writeFile(path.join(project, "paradigms", "packages", "old-task", "index.html"), "old");
  await mkdir(path.join(changeRoot, "packages", "new-task"), { recursive: true });
  await writeFile(path.join(changeRoot, "packages", "new-task", "index.html"), "new");
  await writeFile(path.join(changeRoot, "changes.json"), JSON.stringify({ add: ["new-task"], replace: [], delete: ["old-task"] }));

  const preview = await applyChanges(changeRoot, { projectRoot: project });
  assert.equal(preview.applied, false);
  const result = await applyChanges(changeRoot, { projectRoot: project, apply: true });
  assert.equal(result.applied, true);
  assert.equal(await readFile(path.join(project, "paradigms", "packages", "new-task", "index.html"), "utf8"), "new");
  await assert.rejects(readFile(path.join(project, "paradigms", "packages", "old-task", "index.html")));
  assert.ok(result.backupRoot);
  console.log("change-pack self-check passed: preview, scoped add, recoverable delete");
} finally {
  await rm(temporary, { recursive: true, force: true });
}

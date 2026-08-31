import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAssistantServer, findChangeRoot, parsePavloviaUrl, safeChild } from "../tools/import-assistant-server.mjs";

const source = parsePavloviaUrl("https://gitlab.pavlovia.org/demos/bart");
assert.equal(source.cloneUrl, "https://gitlab.pavlovia.org/demos/bart.git");
assert.equal(source.repo, "bart");
assert.throws(() => parsePavloviaUrl("https://example.com/demos/bart"), /只接受/);

const root = path.resolve(os.tmpdir(), "assistant-safe-root");
assert.equal(safeChild(root, "nested/file.zip"), path.join(root, "nested", "file.zip"));
assert.throws(() => safeChild(root, "../outside.zip"), /超出/);

const temporary = await mkdtemp(path.join(os.tmpdir(), "assistant-change-root-"));
try {
  const wrapped = path.join(temporary, "exported-change-pack");
  await mkdir(wrapped);
  await writeFile(path.join(wrapped, "changes.json"), "{}");
  assert.equal(await findChangeRoot(temporary), wrapped);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

const { server, url } = await createAssistantServer({ openBrowser: false });
try {
  const script = await (await fetch(`${url}/app.js`)).text();
  const token = script.match(/const token = "([a-f0-9]+)"/)?.[1];
  assert.ok(token);
  const rejected = await fetch(`${url}/api/pavlovia`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-assistant-token": token },
    body: JSON.stringify({ url: "https://example.com/not-allowed" }),
  });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /只接受/);
  assert.equal((await fetch(url)).status, 200, "a rejected API request must not crash the local server");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("import-assistant self-check passed: URL boundary, path boundary, wrapped change pack, recoverable API error");

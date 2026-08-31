import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { adaptPsychoJsPackage, createAssistantServer, findChangeRoot, parsePavloviaUrl, safeChild } from "../tools/import-assistant-server.mjs";

const source = parsePavloviaUrl("https://gitlab.pavlovia.org/demos/bart");
assert.equal(source.cloneUrl, "https://gitlab.pavlovia.org/demos/bart.git");
assert.equal(source.repo, "bart");
assert.throws(() => parsePavloviaUrl("https://example.com/demos/bart"), /只接受/);

const launcher = await readFile(new URL("../启动范式导入发布助手.cmd", import.meta.url));
const launcherText = launcher.toString("utf8");
assert.equal([...launcher].some((byte) => byte > 127), false, "the cmd launcher must stay ASCII-safe");
assert.equal(launcherText.replaceAll("\r\n", "").includes("\n"), false, "the cmd launcher must use CRLF line endings");

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

const psychoJsRoot = await mkdtemp(path.join(os.tmpdir(), "assistant-psychojs-"));
try {
  await writeFile(path.join(psychoJsRoot, "index.html"), '<html><head><link rel="stylesheet" href="./lib/psychojs-2024.2.4.css"></head><body><script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script><script src="./task.js" type="module"></script></body></html>');
  await writeFile(path.join(psychoJsRoot, "task.js"), "import { core } from './lib/psychojs-2024.2.4.js'; async function quitPsychoJS(){ psychoJS.window.close(); }");
  const adapted = await adaptPsychoJsPackage(psychoJsRoot, { fetchImpl: async () => new Response("runtime") });
  assert.ok(adapted.count >= 5);
  assert.equal(await readFile(path.join(psychoJsRoot, "lib", "psychojs-2024.2.4.js"), "utf8"), "runtime");
  assert.equal(await readFile(path.join(psychoJsRoot, "lib", "psychojs-2024.2.4.css"), "utf8"), "runtime");
  assert.match(await readFile(path.join(psychoJsRoot, "index.html"), "utf8"), /vendor\/jquery-3\.6\.0\.min\.js/);
  assert.match(await readFile(path.join(psychoJsRoot, "task.js"), "utf8"), /cognition-lab:complete/);
} finally {
  await rm(psychoJsRoot, { recursive: true, force: true });
}

const { server, url } = await createAssistantServer({ openBrowser: false });
try {
  const script = await (await fetch(`${url}/app.js`)).text();
  assert.match(script, /本地导入发布助手已断开/);
  const token = script.match(/const token = "([a-f0-9]+)"/)?.[1];
  assert.ok(token);
  const rejected = await fetch(`${url}/api/pavlovia`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-assistant-token": token },
    body: JSON.stringify({ url: "https://example.com/not-allowed" }),
  });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /只接受/);

  const archiveContext = vm.createContext({ window: {}, TextEncoder, TextDecoder, DataView, Uint8Array, Blob, Response, DecompressionStream });
  vm.runInContext(await readFile(new URL("../archive.js", import.meta.url), "utf8"), archiveContext);
  const changePack = archiveContext.window.CognitionArchive.createZip(new Map([
    ["changes.json", JSON.stringify({ add: [], replace: [], delete: ["missing-test-package"] })],
  ]));
  const uploaded = await fetch(`${url}/api/upload`, {
    method: "POST",
    headers: { "content-type": "application/zip", "x-file-name": "real-change-pack.zip", "x-assistant-token": token },
    body: Buffer.from(await changePack.arrayBuffer()),
  });
  assert.equal(uploaded.status, 200);
  assert.deepEqual((await uploaded.json()).actions.delete, ["missing-test-package"]);

  const sourcePack = archiveContext.window.CognitionArchive.createZip(new Map([
    ["index.html", "<!doctype html><title>Source package</title>"],
    ["experiment.js", "console.log('source')"],
  ]));
  const detectedSource = await fetch(`${url}/api/upload`, {
    method: "POST",
    headers: { "content-type": "application/zip", "x-file-name": "1788180867379-change_detection.zip", "x-assistant-token": token },
    body: Buffer.from(await sourcePack.arrayBuffer()),
  });
  assert.equal(detectedSource.status, 422);
  const sourceResult = await detectedSource.json();
  assert.equal(sourceResult.kind, "source-package");
  assert.match(sourceResult.adminUrl, /name=change_detection/);

  const runtimePreview = await fetch(`${url}/api/preview`, {
    method: "POST",
    headers: { "content-type": "application/zip", "x-entry": "index.html", "x-assistant-token": token },
    body: Buffer.from(await sourcePack.arrayBuffer()),
  });
  assert.equal(runtimePreview.status, 200);
  const previewUrl = (await runtimePreview.json()).url;
  assert.match(await (await fetch(`${url}${previewUrl}`)).text(), /Source package/);
  const preflight = await fetch(`${url}${previewUrl}`, { method: "OPTIONS", headers: { "access-control-request-headers": "x-requested-with" } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");

  const existingPackage = await fetch(`${url}/api/package-download?id=bart&token=${token}`);
  assert.equal(existingPackage.status, 200);
  const existingFiles = await archiveContext.window.CognitionArchive.readZip(await existingPackage.blob());
  assert.equal(existingFiles.files.has("manifest.json"), true);
  assert.equal((await fetch(url)).status, 200, "a rejected API request must not crash the local server");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log("import-assistant self-check passed: source adaptation, local preview, change/source ZIP routing, existing package download");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = vm.createContext({
  window: {},
  TextEncoder,
  TextDecoder,
  DataView,
  Uint8Array,
  Blob,
  Response,
  DecompressionStream,
});
const source = await readFile(new URL("../archive.js", import.meta.url), "utf8");
vm.runInContext(source, context);
const archive = context.window.CognitionArchive;

assert.equal(archive.shouldIgnoreImportPath("bart-master/data/result.csv"), true);
assert.equal(archive.shouldIgnoreImportPath("data/result.csv"), true);
assert.equal(archive.shouldIgnoreImportPath("bart-master/assets/data/stimuli.csv"), false);

const entries = new Map([["bart-master/index.html", "<!doctype html>"]]);
for (let index = 0; index < 1001; index += 1) entries.set(`bart-master/data/result-${index}.csv`, "rt,correct\n500,1");
const result = await archive.readZip(archive.createZip(entries));
assert.equal(result.files.size, 1);
assert.equal(result.files.has("bart-master/index.html"), true);
assert.equal(result.ignored.count, 1001);

console.log("archive self-check passed: generated result data is ignored before the effective file limit");

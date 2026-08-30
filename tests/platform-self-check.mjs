import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = vm.createContext({ window: { IMPORTED_PARADIGMS: [] } });
const source = await readFile(new URL("../platform.js", import.meta.url), "utf8");
vm.runInContext(source, context);
const platform = context.window.CognitionPlatform;

assert.equal(platform.getParadigms().length, 3);
assert.equal(platform.findParadigm("stroop").metrics[2], "干扰效应");
const rendered = platform.renderMarkdown("# 标题\n\n<script>alert(1)</script>\n\n[危险](javascript:alert(1))\n\n- **安全列表**");
assert.doesNotMatch(rendered, /<script>|javascript:/i);
assert.match(rendered, /&lt;script&gt;/);
assert.match(rendered, /<ul>/);

const catalogPage = await readFile(new URL("../experiments.html", import.meta.url), "utf8");
const detailPage = await readFile(new URL("../paradigm.html", import.meta.url), "utf8");
assert.match(catalogPage, /catalog-search/);
assert.match(detailPage, /start-experiment-top/);
console.log("platform self-check passed: catalog data, safe Markdown, and page landmarks");

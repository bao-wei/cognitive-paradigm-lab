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
const adminPage = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const adminScript = await readFile(new URL("../admin.js", import.meta.url), "utf8");
assert.match(catalogPage, /catalog-search/);
assert.match(detailPage, /start-experiment-top/);
assert.match(adminPage, /validation-summary/);
assert.match(adminPage, /<details class="technical-details">/);
assert.match(adminPage, /<details class="advanced-settings">/);
assert.match(adminScript, /实验程序需要技术适配/);
assert.match(adminScript, /核心指标应为未爆炸气球的平均充气次数/);
console.log("platform self-check passed: catalog data, safe Markdown, and page landmarks");

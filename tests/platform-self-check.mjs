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
const bart = platform.summarizeBartRows([
  { nPumps: 4, popped: false, earnings: 0.2 },
  { nPumps: 8, popped: true, earnings: 0 },
  { nPumps: 6, popped: "false", earnings: 0.3 },
]);
assert.equal(bart.count, 3);
assert.equal(bart.bankedCount, 2);
assert.equal(bart.adjustedPumps, 5);
assert.ok(Math.abs(bart.burstRate - (100 / 3)) < 0.001);
assert.equal(bart.totalEarnings, 0.5);

const catalogPage = await readFile(new URL("../experiments.html", import.meta.url), "utf8");
const detailPage = await readFile(new URL("../paradigm.html", import.meta.url), "utf8");
const adminPage = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const adminScript = await readFile(new URL("../admin.js", import.meta.url), "utf8");
const runnerPage = await readFile(new URL("../runner.html", import.meta.url), "utf8");
const runnerScript = await readFile(new URL("../runner.js", import.meta.url), "utf8");
const bartScript = await readFile(new URL("../paradigms/packages/bart/bart.js", import.meta.url), "utf8");
assert.match(catalogPage, /catalog-search/);
assert.match(detailPage, /start-experiment-top/);
assert.match(adminPage, /validation-summary/);
assert.match(adminPage, /<details class="technical-details">/);
assert.match(adminPage, /<details class="advanced-settings">/);
assert.match(adminScript, /实验程序需要技术适配/);
assert.match(adminPage, /value="bart"/);
assert.match(adminScript, /调整后平均充气次数/);
assert.match(runnerPage, /id="runner-export"[^>]+download/);
assert.match(runnerScript, /prepareCsvExport/);
assert.match(runnerScript, /summarizeBartRows/);
assert.match(runnerScript, /frame\.contentWindow\.focus/);
assert.match(bartScript, /请按【空格键】开始实验/);
console.log("platform self-check passed: catalog data, safe Markdown, and page landmarks");

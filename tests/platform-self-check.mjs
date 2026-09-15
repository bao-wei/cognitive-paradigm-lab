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
const inferred = platform.inferPsychoJsResult(
  "psychoJS.experiment.addData('key_resp.corr', key_resp.corr); psychoJS.experiment.addData('key_resp.rt', key_resp.rt);",
  ["condition_label,answer\nsame,y\ndifferent,n\n"],
);
assert.deepEqual(JSON.parse(JSON.stringify(inferred)), {
  profile: "difference",
  fields: { correct: "key_resp.corr", rt: "key_resp.rt", condition: "condition_label" },
  levels: ["same", "different"],
});
const reconciled = platform.reconcileResultFields([
  { "key_resp.corr": 1, "key_resp.rt": 0.42, "localisation_resp.rt": 0.81, condition_label: "same" },
], { correct: "key_resp.corr", rt: "rt", condition: "condition_label" });
assert.equal(reconciled.rt, "key_resp.rt");
assert.equal(reconciled.correct, "key_resp.corr");
const metadata = platform.inferPsychoJsMetadata({
  name: "Change Detection and Change Localisation task",
  readme: "A visual working memory change detection task. Zhao et al. (2023). https://doi.org/10.3758/example",
  sample: "",
  result: inferred,
});
assert.equal(metadata.category, "工作记忆");
assert.equal(metadata.name, "变化检测与变化定位任务");
assert.equal(metadata.taskType, "变化检测与定位");
assert.equal(metadata.duration, "约 4 分钟");
assert.match(metadata.summary, /视觉工作记忆/);
assert.match(metadata.description, /# 学习目标[\s\S]+# 实验原理[\s\S]+# 任务流程[\s\S]+# 核心指标[\s\S]+# 结果解读[\s\S]+# 注意事项[\s\S]+# 来源与参考/);

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
assert.match(adminPage, /扩展范式可编辑/);
assert.match(adminScript, /实验程序需要技术适配/);
assert.match(adminPage, /value="bart"/);
assert.match(adminScript, /调整后平均充气次数/);
assert.match(runnerPage, /id="runner-export"[^>]+download/);
assert.match(runnerScript, /prepareCsvExport/);
assert.match(runnerScript, /summarizeBartRows/);
assert.match(runnerScript, /frame\.contentWindow\.focus/);
assert.match(bartScript, /点击【继续】开始实验/);
console.log("platform self-check passed: catalog data, safe Markdown, and page landmarks");

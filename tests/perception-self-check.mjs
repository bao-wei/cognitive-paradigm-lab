import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import vm from "node:vm";

const tasks = new Map();
const context = vm.createContext({ window: { Textbook: { register: (task) => tasks.set(task.id, task) } }, console, performance, DOMException });
vm.runInContext(await readFile(new URL("../paradigms/textbook/tasks/perception.js", import.meta.url), "utf8"), context);
assert.equal(tasks.size, 8);
for (const task of tasks.values()) assert.equal(task.trialCount, 20);
const checks = context.window.Textbook.perceptionChecks;
assert.match(checks.navonFigure("H", "S"), />S<\/text>/);
assert.equal((checks.navonFigure("H", "S").match(/<text /g) || []).length, 17);
const triangle = [[0, 80], [60, 0], [120, 80]];
const outline = [...triangle, triangle[0]];
const dense = outline.slice(1).flatMap((p, i) => Array.from({ length: 25 }, (_, j) => [outline[i][0] + (p[0] - outline[i][0]) * j / 24, outline[i][1] + (p[1] - outline[i][1]) * j / 24]));
assert.equal(checks.traceAccuracy(triangle, [dense]).correct, true);
assert.equal(checks.traceAccuracy(triangle, [[[0, 80], [60, 0]]]).correct, false);
assert.equal(checks.traceAccuracy(triangle, [Array.from({ length: 20 }, (_, i) => [10 + i, 10])]).correct, false);

for (const id of ["donders", "stroop", "navon", "flanker", "gonogo"]) {
  const task = tasks.get(id);
  const c = {
    rows: [], stage() {}, wait: async () => {}, fixation: async () => {}, progress() {}, note: async () => {},
    choose: async (_html, options) => ({ value: options[0].value, rt: 420, timedOut: false }),
    shuffle: (array) => [...array], mean: (values) => values.length ? values.reduce((n, v) => n + v, 0) / values.length : null,
    percent: (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : "数据不足",
    record(row) { this.rows.push({ valid: true, ...row }); },
  };
  const result = await task.run(c);
  assert.equal(c.rows.length, 20, `${id} must record exactly 20 formal trials`);
  assert.ok(result.metrics.length >= 2);
  if (id === "stroop") assert.deepEqual(Object.fromEntries(["congruent", "incongruent", "neutral"].map((condition) => [condition, c.rows.filter((r) => r.condition === condition).length])), { congruent: 7, incongruent: 7, neutral: 6 });
  if (id === "navon") for (const level of ["global", "local"]) for (const condition of ["congruent", "incongruent"]) assert.equal(c.rows.filter((r) => r.level === level && r.condition === condition).length, 5);
  if (id === "gonogo") assert.equal(c.rows.filter((r) => r.condition === "nogo").length, 5);
}
for (const file of tasks.get("mcgurk").assets) assert.ok((await stat(new URL(`../paradigms/textbook/${file}`, import.meta.url))).size > 50000);
console.log("perception self-check passed: 8 registrations, 20-trial counts, conditions, genuine outline scoring and local media assets");

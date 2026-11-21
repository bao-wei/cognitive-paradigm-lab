import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const tasks = new Map();
const sandbox = vm.createContext({ window: { Textbook: { register: (task) => tasks.set(task.id, task) } } });
vm.runInContext(await readFile(new URL("../paradigms/textbook/tasks/memory.js", import.meta.url), "utf8"), sandbox);

function context(group = "reminder-interference", master = true) {
  let visible = "", learned = new Map(), latest = new Map();
  const counts = { waits: [], choices: [], stages: [], tones: [] };
  const ctx = {
    rows: [], counts,
    stage(html) {
      visible = html; counts.stages.push(html);
      const shape = html.match(/记忆图形 (\d+)/)?.[1], location = html.match(/位置：([^<]+)/)?.[1];
      if (shape && location) {
        const id = ["左上", "右上", "左下", "右下"].indexOf(location);
        if (!learned.has(shape)) learned.set(shape, id);
        latest.set(shape, id);
      }
    },
    async wait(ms) { counts.waits.push(ms); },
    async fixation(ms) { counts.waits.push(ms); },
    async choose(html, options, settings = {}) {
      counts.choices.push({ html, options, settings });
      const shape = html.match(/记忆图形 (\d+)/)?.[1];
      let value = options[0].value;
      if (shape && master) value = String((html.includes("后续学习的新位置") ? latest : learned).get(shape) ?? 0);
      if (shape && !master) value = String(((learned.get(shape) ?? 0) + 1) % 4);
      const duration = Math.min(500, settings.timeout || 500);
      return { value, rt: duration, timedOut: false };
    },
    async input(html, options) {
      const value = /4 个字母/.test(options.label) ? "????" : /12 个字母/.test(options.label) ? "????????????" : "";
      if (options.validate) assert.equal(options.validate(value), true);
      return { value, rt: 500 };
    },
    async note() {},
    tone(hz, duration) { counts.tones.push({ hz, duration }); },
    progress() {},
    record(row) { this.rows.push({ ...row, valid: true }); },
    shuffle(values) {
      const result = [...values];
      if (result.includes("reminder-interference") && result.includes(group)) result.sort((a, b) => a === group ? -1 : b === group ? 1 : 0);
      return result;
    },
    mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; },
    percent(n, d) { return d ? `${100 * n / d}%` : "数据不足"; },
  };
  return ctx;
}

const sperling = context();
const sperlingResult = await tasks.get("sperling").run(sperling);
assert.equal(sperling.rows.length, 20);
assert.equal(sperling.counts.tones.length, 15);
for (const condition of ["whole", "partial-0", "partial-300", "partial-1000"]) assert.equal(sperling.rows.filter((r) => r.condition === condition).length, 5);
assert.equal(sperling.counts.waits.filter((n) => n === 50).length, 20);
assert.equal(sperlingResult.metrics[1].value, "0.0 / 12");

const change = context();
const changeResult = await tasks.get("change-detection").run(change);
assert.equal(change.rows.length, 20);
assert.equal(change.rows.filter((r) => r.changed).length, 10);
for (const load of [4, 6, 9]) {
  const selected = change.rows.filter((r) => r.load === load);
  assert.equal(selected.length, load === 9 ? 8 : 6);
  assert.equal(selected.filter((r) => r.changed).length, selected.length / 2);
}
for (const duration of [200, 100, 900]) assert.equal(change.counts.waits.filter((n) => n === duration).length, 20);
assert.ok(change.counts.choices.every((q) => q.settings.timeout === 2000));
assert.equal(changeResult.metrics.length, 3);

const self = context();
const selfResult = await tasks.get("self-reference").run(self);
const study = self.rows.filter((r) => r.phase === "study");
assert.equal(study.length, 20);
for (const encoding of ["self", "common"]) {
  const selected = study.filter((r) => r.encoding === encoding);
  assert.equal(selected.length, 10);
  assert.equal(selected.filter((r) => r.valence === "positive").length, 5);
}
assert.equal(self.rows.filter((r) => r.phase === "recognition").length, 30);
assert.equal(self.rows.filter((r) => r.phase === "recognition" && !r.old).length, 10);
assert.equal(self.rows.filter((r) => r.phase === "filler").length, 30);
assert.equal(self.counts.choices.filter((q) => q.settings.timeout === 3000).length, 20);
assert.equal(self.counts.choices.filter((q) => q.settings.timeout === 1000).length, 30);
assert.equal(selfResult.metrics.length, 4);

const semantic = context();
const semanticResult = await tasks.get("semantic-priming").run(semantic);
assert.equal(semantic.rows.length, 20);
assert.equal(semantic.rows.filter((r) => r.lexicality === "word").length, 10);
assert.equal(semantic.rows.filter((r) => r.lexicality === "nonword").length, 10);
for (const condition of ["related", "unrelated", "neutral"]) assert.ok(semantic.rows.some((r) => r.condition === condition));
assert.equal(semanticResult.metrics.length, 4);

for (const group of ["reminder-interference", "no-reminder-interference", "reminder-control"]) {
  const ctx = context(group);
  const result = await tasks.get("reconsolidation").run(ctx);
  const final = ctx.rows.filter((r) => r.phase === "original-test");
  assert.equal(final.length, 20);
  assert.equal(new Set(final.map((r) => r.shape)).size, 20);
  assert.ok(final.every((r) => r.correct));
  assert.ok(ctx.rows.every((r) => r.condition === group));
  assert.equal(ctx.rows.filter((r) => r.phase === "updated-test").length, group === "reminder-control" ? 0 : 20);
  assert.equal(result.metrics.length, group === "reminder-control" ? 2 : 4);
}
const notMastered = context("reminder-interference", false);
const stopped = await tasks.get("reconsolidation").run(notMastered);
assert.equal(notMastered.rows.filter((r) => r.phase === "criterion").length, 60);
assert.equal(notMastered.rows.filter((r) => r.phase === "original-test").length, 0);
assert.match(stopped.explanation, /没有进入/);

const rif = context();
const rifResult = await tasks.get("retrieval-forgetting").run(rif);
assert.equal(rif.rows.filter((r) => r.phase === "study").length, 20);
assert.equal(rif.rows.filter((r) => r.phase === "practice").length, 15);
const recall = rif.rows.filter((r) => r.phase === "recall");
assert.equal(recall.length, 20);
assert.equal(recall.filter((r) => r.condition === "RP+").length, 5);
assert.equal(recall.filter((r) => r.condition === "RP-").length, 5);
assert.equal(recall.filter((r) => r.condition === "NPP").length, 10);
assert.ok(recall.slice(0, 15).every((r) => r.condition !== "RP+"));
assert.equal(rifResult.metrics.length, 4);
console.log("textbook memory checks passed: six complete flows, timing, balance, mastery stop, genuine condition scores");

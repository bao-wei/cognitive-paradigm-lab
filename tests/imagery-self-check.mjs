import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const tasks = new Map();
const context = vm.createContext({ window: { Textbook: { register: (task) => tasks.set(task.id, task) } } });
vm.runInContext(await readFile(new URL("../paradigms/textbook/tasks/imagery.js", import.meta.url), "utf8"), context);
assert.equal(tasks.size, 2);
const checks = context.window.Textbook.imageryChecks;
const keep = (array) => [...array];
const size = checks.sizeTrials(keep);
assert.equal(size.length, 72);
assert.deepEqual(Object.fromEntries(["congruent", "equal", "incongruent"].map((condition) => [condition, size.filter((trial) => trial.condition === condition).length])), { congruent: 24, equal: 24, incongruent: 24 });
assert.equal(size.filter((trial) => trial.largerSide === "left").length, 36);
assert.equal(size.filter((trial) => trial.largerSide === "right").length, 36);
for (const block of [1, 2]) {
  const rows = size.filter(row => row.block === block);
  assert.equal(rows.length, 36);
  assert.equal(new Set(rows.map(row => [row.id, row.condition, row.largerSide].join(":"))).size, 36);
}
for (const pair of checks.pairs) {
  const conditions = new Set(size.filter((trial) => trial.id === pair.id).map((trial) => trial.condition));
  assert.equal(conditions.size, 3, `${pair.id} must appear in all three conditions`);
  for (const trial of size.filter((trial) => trial.id === pair.id)) {
    assert.equal(trial.larger, pair.larger);
    assert.equal(trial.smaller, pair.smaller);
    const picture = checks.sizePicture(trial);
    assert.ok(picture.includes(`data-object="${pair.larger}"`));
    assert.ok(picture.includes(`data-object="${pair.smaller}"`));
    assert.doesNotMatch(picture, /<text|<image|href=|https?:|undefined/);
  }
}
const rotation = checks.rotationTrials(keep);
assert.equal(rotation.length, 72);
assert.equal(rotation.filter((trial) => trial.orientation === "normal").length, 36);
assert.equal(rotation.filter((trial) => trial.orientation === "mirror").length, 36);
for (const angle of [0, 60, 120, 180, 240, 300]) {
  assert.equal(rotation.filter(trial => trial.angle === angle).length, 12);
  for (const orientation of ["normal", "mirror"]) {
    assert.equal(rotation.filter(trial => trial.angle === angle && trial.orientation === orientation).length, 6);
    for (const block of [1, 2]) assert.equal(rotation.filter(trial => trial.angle === angle && trial.orientation === orientation && trial.block === block).length, 3);
  }
}
assert.deepEqual([0, 60, 120, 180, 240, 300, 360, -60].map(checks.shortestAngle), [0, 60, 120, 180, 120, 60, 0, 60]);
const mirror = checks.letterR("mirror", 120);
assert.match(mirror, /rotate\(120\)/);
assert.match(mirror, /scale\(-1 1\)/);
assert.ok(mirror.indexOf("rotate(120)") < mirror.indexOf("scale(-1 1)"), "the letter must be mirrored inside the rotation group");
assert.doesNotMatch(checks.letterR("normal", 120), /<text|scale\(-1/);
assert.equal(checks.regressionSlope([{ angular_distance: 0, rt: 300, correct: true }, { angular_distance: 60, rt: 420, correct: true }, { angular_distance: 120, rt: 540, correct: true }, { angular_distance: 180, rt: 9000, correct: true, valid: false }, { angular_distance: 180, rt: 1, correct: false }]), 2);
assert.equal(checks.regressionSlope([{ angular_distance: 60, rt: 300, correct: true }]), null);

function harness(taskId) {
  let choice = 0;
  const fixationTimes = [];
  const choices = [];
  return {
    rows: [], fixationTimes, choices,
    shuffle: keep, progress() {}, stage() {}, wait: async () => {}, note: async () => {},
    fixation: async (milliseconds) => { fixationTimes.push(fixationTimes.length ? milliseconds : Math.max(2000, milliseconds)); },
    async trialStart(index, total, { blockSize, fixationMs }) {
      const ms = index === 0 || index % blockSize === 0 ? Math.max(2000, fixationMs) : fixationMs;
      await this.fixation(ms);
      return ms;
    },
    mean: (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    percent: (number, denominator) => denominator ? `${(100 * number / denominator).toFixed(1)}%` : "数据不足",
    record(row) { this.rows.push({ valid: true, ...row }); },
    choose: async (html, options, settings) => {
      choices.push({ html, options, settings });
      let expected, rt;
      if (taskId === "real-size-comparison") {
        const trial = size[choice++];
        expected = trial.largerSide;
        rt = trial.condition === "congruent" ? 350 : trial.condition === "equal" ? 400 : 500;
      } else {
        if (choice < 2) { expected = choice === 0 ? "normal" : "mirror"; rt = 300; }
        else { const trial = rotation[choice - 2]; expected = trial.orientation; rt = 300 + 2 * checks.shortestAngle(trial.angle); }
        choice++;
      }
      assert.ok(options.some((option) => option.value === expected));
      return { value: expected, rt, timedOut: false };
    },
  };
}
for (const [id, task] of tasks) {
  assert.equal(task.trialCount, 72);
  assert.equal(task.chapter, "第七章");
  assert.equal(task.code, id === "real-size-comparison" ? "7-1（大小比较）" : "7-1（R旋转）");
  const c = harness(id);
  const result = await task.run(c);
  assert.equal(c.rows.length, 72, id);
  assert.equal(c.rows.filter((row) => row.correct).length, 72, id);
  const preparationIndices = id === "real-size-comparison" ? [0, 36] : [0, 2, 38];
  assert.equal(c.fixationTimes.length, id === "real-size-comparison" ? 72 : 74);
  assert.ok(c.fixationTimes.every((duration, i) => duration === (preparationIndices.includes(i) ? 2000 : 500)));
  assert.ok(c.rows.every((row, i) => row.phase === "formal" && row.fixation_ms === (i % 36 === 0 ? 2000 : 500)));
  assert.ok(c.choices.every((trial) => trial.settings.timeout === 5000));
  assert.ok(result.metrics.length >= 3);
  assert.equal(result.metrics[0].value, "100.0%");
  if (id === "real-size-comparison") {
    assert.equal(result.metrics.find((metric) => metric.label === "大小一致性效应").value, "+150 ms");
    assert.equal(result.metrics.find((metric) => metric.label === "相同大小基线的干扰").value, "+100 ms");
    assert.equal(result.metrics.find((metric) => metric.label === "相同大小基线的促进").value, "+50 ms");
  } else {
    assert.equal(result.metrics.find((metric) => metric.label === "角度与 RT 的描述性斜率").value, "+2.00 ms/度");
    assert.match(result.extraHtml, /data-rotation-curve/);
    assert.doesNotMatch(checks.rotationCurve(c, []), /data-rotation-curve/);
  }
}
console.log("imagery self-check passed: two complete 72-trial blocked flows, 2s preparation, fully crossed matched pairs, mirrored geometry, actual angle curves and regression");

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
assert.equal(size.length, 20);
assert.deepEqual(Object.fromEntries(["congruent", "equal", "incongruent"].map((condition) => [condition, size.filter((trial) => trial.condition === condition).length])), { congruent: 7, equal: 6, incongruent: 7 });
assert.equal(size.filter((trial) => trial.largerSide === "left").length, 10);
assert.equal(size.filter((trial) => trial.largerSide === "right").length, 10);
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
assert.equal(rotation.length, 20);
assert.equal(rotation.filter((trial) => trial.orientation === "normal").length, 10);
assert.equal(rotation.filter((trial) => trial.orientation === "mirror").length, 10);
for (const angle of [0, 60, 120, 180, 240, 300]) assert.ok([3, 4].includes(rotation.filter((trial) => trial.angle === angle).length));
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
    fixation: async (milliseconds) => { fixationTimes.push(milliseconds); },
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
  assert.equal(task.trialCount, 20);
  assert.equal(task.chapter, "第七章");
  assert.equal(task.code, id === "real-size-comparison" ? "7-1（大小比较）" : "7-1（R旋转）");
  const c = harness(id);
  const result = await task.run(c);
  assert.equal(c.rows.length, 20, id);
  assert.equal(c.rows.filter((row) => row.correct).length, 20, id);
  assert.equal(c.fixationTimes.length, 20);
  assert.ok(c.fixationTimes.every((duration) => duration === 500));
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
console.log("imagery self-check passed: two complete 20-trial flows, matched pairs, mirrored geometry, actual angle curves and regression");

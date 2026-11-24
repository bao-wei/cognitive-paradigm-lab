import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const tasks = new Map();
let clock = 0;
const mean = (values) => { const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value)); return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null; };
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const api = { register: (task) => tasks.set(task.id, task), escape };
const sandbox = vm.createContext({ window: { Textbook: api }, performance: { now: () => clock }, console });
vm.runInContext(await readFile(new URL("../paradigms/textbook/tasks/attention.js", import.meta.url), "utf8"), sandbox);
assert.equal(tasks.size, 2);
const checks = api.attentionChecks;
const identity = (values) => [...values];
const ant = checks.antTrials(identity);
assert.equal(ant.length, 144);
assert.equal(tasks.get("ant").trialCount, 144);
for (const block of [1, 2, 3]) {
  const rows = ant.filter(row => row.block === block);
  assert.equal(rows.length, 48);
  assert.equal(new Set(rows.map(row => [row.cue, row.condition, row.direction, row.targetLocation].join(":"))).size, 48);
}
assert.equal(new Set(ant.map((row) => row.cue + ":" + row.condition)).size, 12);
for (const cue of ["none", "central", "double", "spatial"]) assert.equal(ant.filter((row) => row.cue === cue).length, 36);
for (const direction of ["left", "right"]) assert.equal(ant.filter((row) => row.direction === direction).length, 72);
for (const location of ["above", "below"]) assert.equal(ant.filter((row) => row.targetLocation === location).length, 72);
assert.equal((checks.antBoard({ cue: "double", targetLocation: "above" }, "cue").match(/>\*<\/text>/g) || []).length, 2);
assert.match(checks.antBoard({ cue: "spatial", targetLocation: "below" }, "cue"), /y="252"/);
assert.match(checks.antBoard({ cue: "none", targetLocation: "above", condition: "neutral", direction: "left" }, "target"), /——←——/);

const blink = checks.blinkTrials(identity);
assert.equal(blink.length, 80);
assert.equal(tasks.get("attentional-blink").trialCount, 80);
for (const block of [1, 2]) {
  const rows = blink.filter(row => row.block === block);
  assert.equal(rows.length, 40);
  assert.equal(rows.filter(row => row.mode === "single").length, 20);
  for (const mode of ["single", "dual"]) for (let lag = 1; lag <= 8; lag++) {
    assert.equal(rows.filter(row => row.mode === mode && row.lag === lag && row.t2Present).length, 2);
  }
}
for (const mode of ["single", "dual"]) {
  const rows = blink.filter((row) => row.mode === mode);
  assert.equal(rows.length, 40);
  assert.equal(new Set(rows.map((row) => row.lag)).size, 8);
  assert.equal(rows.filter((row) => row.t2Present).length, 32);
  assert.equal(rows.filter((row) => !row.t2Present).length, 8);
  assert.equal(new Set(rows.filter((row) => row.t2Present).map((row) => row.lag)).size, 8);
  for (let lag = 1; lag <= 8; lag++) {
    assert.equal(rows.filter(row => row.lag === lag && row.t2Present).length, 4);
    assert.equal(rows.filter(row => row.lag === lag && !row.t2Present).length, 1);
  }
  for (const trial of rows) {
    const stream = checks.blinkStream(trial, identity);
    assert.equal(stream.letters.length, 24);
    assert.equal(stream.t2Index - stream.t1Index, trial.lag);
    assert.ok(stream.t1Index >= 6 && stream.t1Index <= 8);
    assert.notEqual(stream.t1, "X");
    assert.equal(stream.letters.filter((letter) => letter === "X").length, Number(trial.t2Present));
    assert.equal(stream.letters[stream.t1Index], stream.t1);
  }
}

function harness(taskId, wrongT1 = false) {
  let index = 0, currentT1 = null, sawX = false, inputCount = 0;
  const times = [], choices = [], fixationModes = [];
  const ctx = {
    rows: [], waits: times, choices, fixationModes, root: null,
    shuffle: identity, mean, escape,
    percent: (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : "数据不足",
    stage(html) {
      const fixationMode = html.match(/data-blink-fixation="(single|dual)"/)?.[1];
      if (fixationMode) { currentT1 = null; sawX = false; fixationModes.push(fixationMode); }
      if (html.includes("color:#ffffff")) currentT1 = html.match(/color:#ffffff[^>]*>([A-Z])</)?.[1] || null;
      if (/data-rsvp[\s\S]*>X<\/div>/.test(html)) sawX = true;
    },
    progress(value) { index = value - 1; },
    wait: async (ms) => { times.push(ms); clock += ms; },
    fixation: async (ms) => { clock += ms; currentT1 = null; sawX = false; },
    async trialStart(trialIndex, total, { blockSize, fixationMs, renderFixation }) {
      this.progress(trialIndex + 1, total);
      const ms = trialIndex === 0 || (blockSize && trialIndex % blockSize === 0) ? Math.max(2000, fixationMs) : fixationMs;
      if (renderFixation) await renderFixation(ms);
      else await this.fixation(ms);
      return ms;
    },
    note: async () => {},
    choose: async (html, options, settings) => {
      choices.push({ html, options, settings });
      if (taskId === "ant") {
        const row = ant[index];
        const rt = { none: 510, central: 470, double: 430, spatial: 390 }[row.cue] + { congruent: 0, incongruent: 70, neutral: 20 }[row.condition];
        return { value: row.direction, rt, timedOut: false };
      }
      return { value: sawX ? "yes" : "no", rt: 420, timedOut: false };
    },
    input: async (_html, settings) => {
      inputCount += 1;
      assert.equal(settings.validate(currentT1), true);
      assert.notEqual(settings.validate("AB"), true);
      return { value: wrongT1 ? "?" : currentT1, rt: 350 };
    },
    record(row) { row.valid = true; this.rows.push(row); },
    inputCount: () => inputCount,
  };
  return ctx;
}

const antCtx = harness("ant");
const antResult = await tasks.get("ant").run(antCtx);
assert.equal(antCtx.rows.length, 144);
assert.equal(antCtx.choices.length, 144);
assert.ok(antCtx.choices.every((choice) => choice.settings.timeout === 1700));
assert.ok(antCtx.rows.every((row, i) => (i % 48 === 0 ? row.fixation_ms >= 2000 : row.fixation_ms >= 400 && row.fixation_ms <= 1600) && row.cue_ms === 100 && row.postcue_fixation_ms === 400));
const cueMean = (cue) => mean(antCtx.rows.filter((row) => row.cue === cue).map((row) => row.rt));
assert.equal(antResult.metrics.find((metric) => metric.label === "警觉效应").value, `+${Math.round(cueMean("none") - cueMean("double"))} ms`);
assert.equal(antResult.metrics.find((metric) => metric.label === "定向效应").value, `+${Math.round(cueMean("central") - cueMean("spatial"))} ms`);

const blinkCtx = harness("attentional-blink");
const blinkResult = await tasks.get("attentional-blink").run(blinkCtx);
assert.equal(blinkCtx.rows.length, 80);
assert.deepEqual(blinkCtx.fixationModes, Array.from(blink, trial => trial.mode), "the active mode must remain visible through every fixation, including after the break");
assert.equal(blinkCtx.inputCount(), 40, "single task must not ask for T1");
assert.equal(blinkCtx.waits.filter((ms) => ms === 15).length, 80 * 24);
assert.equal(blinkCtx.waits.filter((ms) => ms === 75).length, 80 * 24);
assert.ok(blinkCtx.rows.every((row, i) => row.fixation_ms === (i % 40 === 0 ? 2000 : 500)));
assert.ok(blinkCtx.rows.every((row) => row.nominal_soa_ms === row.lag * 90 && row.nominal_text_gap_ms === row.lag * 100));
for (const row of blinkCtx.rows) {
  assert.equal(JSON.parse(row.frame_timing).length, 24);
  assert.equal(row.t2Position, row.t2Present ? row.plannedT2Position : null);
  assert.equal(row.measured_t1_t2_dom_gap_ms, row.t2Present ? row.lag * 90 : null);
  assert.equal(row.correct, true);
}
assert.equal(blinkResult.metrics.find((metric) => metric.label === "双任务 T2 判断正确率").value, "100.0%");
assert.match(blinkResult.extraHtml, /data-blink-curve/);
assert.doesNotMatch(blinkResult.extraHtml, /NaN|undefined/);
const wrongCtx = harness("attentional-blink", true);
const wrongResult = await tasks.get("attentional-blink").run(wrongCtx);
assert.equal(checks.blinkSummary(wrongCtx.rows, "dual").length, 0);
assert.equal(wrongResult.metrics.find((metric) => metric.label === "双任务 T2 判断正确率").value, "数据不足");
assert.ok(wrongCtx.rows.filter((row) => row.mode === "dual").every((row) => row.analysisEligible === false));
assert.equal((checks.blinkCurve(blinkCtx, wrongCtx.rows).match(/<circle /g) || []).length, 8, "do not invent dual-task points or absent-X observations");
assert.equal(checks.blinkSummary([{ mode: "dual", lag: 1, t1Correct: true, valid: false }], "dual").length, 0);
console.log("attention self-check passed: ANT 144 fully crossed blocked trials, long block-start fixation and three effects; RSVP 80 balanced blocked trials, 15+75 ms, T1 screening and honest sparse curves");

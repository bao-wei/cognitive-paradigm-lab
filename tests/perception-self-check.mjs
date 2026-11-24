import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import vm from "node:vm";

const tasks = new Map();
const document = { addEventListener() {}, removeEventListener() {}, createElementNS: () => ({ setAttribute() {} }) };
const context = vm.createContext({ window: { Textbook: { register: (task) => tasks.set(task.id, task) } }, document, console, performance, DOMException });
vm.runInContext(await readFile(new URL("../paradigms/textbook/tasks/perception.js", import.meta.url), "utf8"), context);
assert.equal(tasks.size, 8);
const expectedCounts = { donders: 72, stroop: 72, navon: 80, mcgurk: 48, "embedded-figures": 20, "interface-search": 48, flanker: 80, gonogo: 100 };
const blockSizes = { donders: 24, stroop: 24, navon: 40, mcgurk: 24, "embedded-figures": 10, "interface-search": 24, flanker: 40, gonogo: 50 };
for (const task of tasks.values()) assert.equal(task.trialCount, expectedCounts[task.id], task.id);
const checks = context.window.Textbook.perceptionChecks;
assert.match(checks.navonFigure("H", "S"), />S<\/text>/);
assert.equal((checks.navonFigure("H", "S").match(/<text /g) || []).length, 17);
const triangle = [[0, 80], [60, 0], [120, 80]];
const outline = [...triangle, triangle[0]];
const dense = outline.slice(1).flatMap((p, i) => Array.from({ length: 25 }, (_, j) => [outline[i][0] + (p[0] - outline[i][0]) * j / 24, outline[i][1] + (p[1] - outline[i][1]) * j / 24]));
assert.equal(checks.traceAccuracy(triangle, [dense]).correct, true);
assert.equal(checks.traceAccuracy(triangle, [[[0, 80], [60, 0]]]).correct, false);
assert.equal(checks.traceAccuracy(triangle, [Array.from({ length: 20 }, (_, i) => [10 + i, 10])]).correct, false);

function harness() {
  const starts = [], mediaSources = [], timeline = [];
  let elements = {}, searchButtons = [], preparedMs = null;
  const root = { querySelector: (selector) => elements[selector], querySelectorAll: () => searchButtons };
  const element = () => ({ textContent: "", addEventListener() {}, removeEventListener() {} });
  return {
    rows: [], starts, mediaSources, timeline, root,
    stage(html) {
      timeline.push(html);
      if (html.includes("data-syllable")) {
        const video = { pause() {}, removeEventListener() {}, addEventListener(type, callback) { if (type === "ended") queueMicrotask(callback); }, set src(value) { mediaSources.push(value); } };
        elements = { "[data-syllable]": video, "[data-media-play]": element(), "[data-media-status]": element() };
      } else if (html.includes("data-search-item")) {
        const target = html.match(/<h2>请找到：([^<]+)<\/h2>/)[1];
        searchButtons = [...html.matchAll(/data-search-item="([^"]+)"/g)].map((match) => ({ getAttribute: () => match[1], addEventListener(_type, callback) { if (match[1] === target) queueMicrotask(callback); } }));
        elements = { "[data-search-feedback]": element() };
      } else if (html.includes("data-trace-board")) {
        const target = html.match(/<polygon points="([^"]+)"/)[1].split(" ").map(pair => pair.split(",").map(Number));
        const events = {};
        const board = { createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }), getScreenCTM: () => ({ inverse: () => ({}) }), setPointerCapture() {}, addEventListener(type, callback) { events[type] = callback; } };
        elements = { "[data-trace-board]": board, "[data-trace-ink]": { append() {}, replaceChildren() {} }, "[data-trace-message]": element(), "[data-trace-clear]": element(), "[data-trace-submit]": { addEventListener(_type, callback) {
          queueMicrotask(() => {
            const points = [...target, target[0]];
            const event = ([x, y]) => ({ clientX: x, clientY: y, pointerId: 1, preventDefault() {} });
            events.pointerdown(event(points[0]));
            for (let i = 1; i < points.length; i++) for (let j = 1; j <= 25; j++) events.pointermove(event([points[i - 1][0] + (points[i][0] - points[i - 1][0]) * j / 25, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * j / 25]));
            events.pointerup(); callback();
          });
        } } };
      }
    },
    wait: async () => {}, fixation: async (ms) => { timeline.push(`fixation:${ms}`); }, progress() {},
    note: async function (html) { timeline.push(html); },
    // Stub the shared runtime's preparation contract; below verifies each task delegates every trial and break.
    async trialStart(index, total, options = {}) {
      const afterBreak = index > 0 && options.blockSize > 0 && index % options.blockSize === 0;
      if (afterBreak) await this.note("break");
      preparedMs = index === 0 || afterBreak ? Math.max(2000, options.fixationMs ?? 500) : options.fixationMs ?? 500;
      starts.push({ index, total, blockSize: options.blockSize || 0, preparedMs, afterBreak });
      if (options.renderFixation) await options.renderFixation(preparedMs);
      else await this.fixation(preparedMs);
      return preparedMs;
    },
    choose: async (_html, options) => ({ value: options[0].value, rt: 420, timedOut: false }),
    shuffle: (array) => [...array], mean: (values) => values.length ? values.reduce((n, v) => n + v, 0) / values.length : null,
    percent: (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : "数据不足",
    record(row) { this.rows.push({ valid: true, preparation_fixation_ms: preparedMs, ...row }); },
  };
}

const results = {};
for (const id of Object.keys(expectedCounts)) {
  const task = tasks.get(id);
  const c = harness();
  const result = await task.run(c);
  results[id] = c;
  assert.equal(c.rows.length, expectedCounts[id], `${id} formal count excludes practice/checks`);
  assert.ok(result.metrics.length >= 2);
  const starts = c.starts.filter(start => start.total === expectedCounts[id]);
  assert.deepEqual(starts.map(start => start.index), Array.from({ length: expectedCounts[id] }, (_, index) => index), id + " preparation on every formal trial");
  assert.ok(starts.every(start => start.blockSize === blockSizes[id]), id + " rest interval");
  assert.equal(starts.filter(start => start.afterBreak).length, expectedCounts[id] / blockSizes[id] - 1, id + " rest count");
  for (const start of starts) {
    if (start.index === 0 || start.afterBreak) assert.ok(start.preparedMs >= 2000, id + " first and resumed trial preparation");
    assert.equal(c.rows[start.index].preparation_fixation_ms, start.preparedMs, id + " record after corresponding preparation");
  }
}

function countCells(rows, fields, expected) {
  const cells = new Map();
  for (const row of rows) { const key = fields.map(field => row[field]).join(":"); cells.set(key, (cells.get(key) || 0) + 1); }
  assert.ok(cells.size > 1);
  assert.ok([...cells.values()].every(count => count === expected), fields.join(" × ") + " balanced cells: " + JSON.stringify([...cells]));
  return cells.size;
}
assert.equal(countCells(results.donders.rows, ["condition"], 24), 3);
assert.equal(countCells(results.donders.rows.filter(row => row.condition !== "simple"), ["condition", "stimulus"], 12), 4);
for (let index = 0; index < 72; index += 24) assert.equal(countCells(results.stroop.rows.slice(index, index + 24), ["condition", "ink"], 2), 12);
assert.equal(countCells(results.stroop.rows.filter(row => row.condition === "incongruent"), ["word", "ink"], 2), 12);
assert.ok(results.stroop.rows.every(row => row.condition === "neutral" ? row.word === "XXX" : (row.word === row.ink) === (row.condition === "congruent")));
for (let index = 0; index < 80; index += 40) assert.equal(countCells(results.navon.rows.slice(index, index + 40), ["level", "condition", "globalLetter"], 5), 8);
for (let index = 0; index < 48; index += 24) assert.equal(countCells(results.mcgurk.rows.slice(index, index + 24), ["condition", "speaker"], 1), 24);
assert.equal(results.mcgurk.mediaSources.length, 49, "one sound check plus 48 formal media trials");
assert.ok(results.mcgurk.mediaSources.every(source => tasks.get("mcgurk").assets.includes(source)), "no nonexistent clip 9+ after repeats");
assert.equal(countCells(results["interface-search"].rows, ["condition", "target"], 2), 24);
assert.ok(results["embedded-figures"].rows.every(row => row.correct && row.coverage >= 0.82), "genuine full-outline input completes retained 20 formal traces");
for (let index = 0; index < 80; index += 40) assert.equal(countCells(results.flanker.rows.slice(index, index + 40), ["condition", "target"], 10), 4);
for (let index = 0; index < 100; index += 50) {
  assert.equal(results.gonogo.rows.slice(index, index + 50).filter(row => row.condition === "go").length, 40);
  assert.equal(results.gonogo.rows.slice(index, index + 50).filter(row => row.condition === "nogo").length, 10);
}
for (const file of tasks.get("mcgurk").assets) assert.ok((await stat(new URL(`../paradigms/textbook/${file}`, import.meta.url))).size > 50000);
console.log("perception self-check passed: 8 complete tasks with task-specific counts, balanced conditions/colours/directions/speakers, practice exclusion, preparation/rest delegation, genuine outline scoring and local media assets");

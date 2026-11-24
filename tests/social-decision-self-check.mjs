import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const tasks = new Map();
let clock = 0;
const seededMath = Object.create(Math);
seededMath.random = () => 0.5;
const sandbox = vm.createContext({ window: { Textbook: { register: (task) => tasks.set(task.id, task) } }, performance: { now: () => clock }, Math: seededMath, DOMException, queueMicrotask });
const source = await readFile(new URL("../paradigms/textbook/tasks/social-decision.js", import.meta.url), "utf8");
vm.runInContext(source.replace(/\}\)\(\);\s*$/, "window.__checks = { wasonItem, DRM_LISTS, primeSvg };})();"), sandbox);
assert.equal(tasks.size, 6);
const helpers = sandbox.window.__checks;
const typeCounts = {};
for (let i = 0; i < 24; i += 1) {
  const item = helpers.wasonItem(i);
  typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  assert.deepEqual(Array.from(item.cards, (card) => card.role), ["p", "notp", "q", "notq"]);
}
assert.deepEqual(typeCounts, { abstract: 8, envelope: 8, drinking: 8 });
assert.equal(helpers.DRM_LISTS.flatMap((list) => list.words).length, 20);
for (const list of helpers.DRM_LISTS) assert.ok(!list.words.includes(list.lure), "critical lures must not be studied");
for (const group of ["us", "china", "neutral"]) for (let index = 0; index < 6; index += 1) {
  assert.match(helpers.primeSvg(group, index), /^<svg/);
  assert.doesNotMatch(helpers.primeSvg(group, index), /undefined|(?:href|src)=["']https?:/);
}

function harness(taskId) {
  const controller = new AbortController();
  let trial = 0, pumpCount = 0, hanoiChoice = 0;
  const moves = [0, 2, 0, 1, 2, 1, 0, 2, 1, 0, 1, 2, 0, 2];
  let cards = [], submit, selectedText;
  const node = (index) => ({ dataset: { card: String(index) }, style: {}, callbacks: {}, setAttribute() {}, addEventListener(type, callback) { this.callbacks[type] = callback; } });
  const root = { querySelectorAll: () => cards, querySelector: (selector) => selector === "[data-submit]" ? submit : selectedText };
  const ctx = {
    root, signal: controller.signal, rows: [],
    stage(html) {
      if (html.includes("data-wason-cards")) {
        cards = [0, 1, 2, 3].map(node); submit = node(-1); selectedText = { textContent: "" };
        queueMicrotask(() => { cards[0].callbacks.click(); cards[3].callbacks.click(); clock += 120; submit.callbacks.click(); });
      }
    },
    progress(index) { trial = index; pumpCount = 0; hanoiChoice = 0; },
    async trialStart(index,total,{blockSize=0,label='',fixationMs=500}={}) {this.progress(index+1,total,label); const ms=index===0 || blockSize && index%blockSize===0?Math.max(2000,fixationMs):fixationMs; this.starts.push({index,total,blockSize,ms,label}); clock+=ms;return ms;}, starts: [],
    wait: async (ms) => { clock += ms; }, fixation: async (ms = 500) => { clock += ms; },
    note: async () => { clock += 100; }, tone: async () => true,
    input: async (html) => ({ value: html.includes("自由回忆") ? "床铺 枕头 不存在" : "这条鱼游在前面也许因为它想寻找更多食物，同时后面的鱼群正在跟随它，水流方向和群体之间的距离也可能影响它的位置。", rt: 900 }),
    async choose(html, options) {
      clock += 200;
      let value = options[0].value;
      if (html.includes("确信度") || html.includes("多大把握")) value = 100;
      if (taskId === "bart") value = trial % 2 ? (pumpCount++ < 3 ? "pump" : "bank") : "pump";
      if (taskId === "hanoi" && options[0].value === 0) value = moves[hanoiChoice++];
      return { value, rt: 200, timedOut: false };
    },
    shuffle: (values) => [...values],
    record(row) { row.valid = true; this.rows.push({ ...row }); },
    mean: (values) => { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; },
    percent: (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : "数据不足",
    escape: (text) => String(text),
  };
  return ctx;
}

for (const id of tasks.keys()) {
  const ctx = harness(id);
  const result = await tasks.get(id).run(ctx);
  const formal = ctx.rows.filter((row) => row.phase === "formal");
  assert.equal(formal.length, tasks.get(id).trialCount, `${id} formal count must match metadata`);
  assert.ok(ctx.starts.length>0 && ctx.starts[0].ms>=2000, id+" preparation");
  assert.ok(result.metrics.length >= 3, id);
  if (id === "eyewitness") assert.equal(result.metrics.find((m) => m.label === "分组").value, "一致信息 · 同时列队 · 目标在场");
  if (id === "wason") assert.ok(formal.every((row) => row.correct));
  if (id === "drm") {
    assert.equal(result.metrics.find((m) => m.label === "分组").value, "延迟测验（30秒填充）");
    assert.equal(formal.filter((row) => row.item_type === "old").length, 8);
    assert.equal(formal.filter((row) => row.item_type === "lure").length, 4);
    assert.equal(formal.filter((row) => row.item_type === "new").length, 8);
  }
  if (id === "bart") {
    assert.equal(formal.filter((row) => row.popped).length, 15);
    assert.equal(formal.at(-1).total_earnings, 45);
    assert.equal(result.metrics.find((m) => m.label === "调整后平均充气次数").value, "3.0");
  }
  if (id === "hanoi") {
    assert.ok(formal.every((row) => row.completed && row.moves === 7 && row.excess_moves === 0));
    assert.equal(ctx.rows.filter((row) => row.phase === "move").length, 140);
  }
  if (id === "cultural-priming") {
    assert.equal(ctx.rows.filter((row) => row.phase === "prime").length, 6);
    assert.ok(formal.every((row) => row.attribution_code === "internal"));
  }
}
console.log("social-decision self-check passed: six completed protocols, exact counts, Wason logic, DRM lures, BART earnings, Hanoi seven-move solution, six primes and human coding");

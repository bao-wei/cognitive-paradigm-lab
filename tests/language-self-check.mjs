import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const tasks = new Map();
let clock = 0;
const documentListeners = new Map();
const doc = {
  hidden: false,
  addEventListener(type, fn) { if (!documentListeners.has(type)) documentListeners.set(type, new Set()); documentListeners.get(type).add(fn); },
  removeEventListener(type, fn) { documentListeners.get(type)?.delete(fn); },
};
const sandbox = vm.createContext({
  window: { Textbook: { register(task) { tasks.set(task.id, task); } } },
  document: doc, performance: { now: () => clock }, DOMException, queueMicrotask,
  requestAnimationFrame(fn) { queueMicrotask(() => { clock += 16; fn(clock); }); },
});
vm.runInContext(await readFile(new URL('../paradigms/textbook/tasks/language.js', import.meta.url), 'utf8'), sandbox);
const helpers = sandbox.window.Textbook.languageChecks;
assert.equal(tasks.size, 2);
assert.equal(helpers.sentenceFrames.length, 20);
const identity = { shuffle: a => [...a] };
const readingPlan = helpers.buildReadingTrials(identity);
assert.equal(readingPlan.length, 20);
assert.equal(readingPlan.filter(t => t.condition === 'ambiguous').length, 10);
assert.equal(readingPlan.filter(t => t.condition === 'control').length, 10);
assert.equal(new Set(readingPlan.map(t => t.id)).size, 20);
for (const trial of readingPlan) {
  assert.equal(trial.regions.filter(region => region === 'critical').length, 1);
  assert.equal(trial.regions.filter(region => region === 'spillover').length, 2);
  assert.equal(trial.tokens[trial.criticalIndex], '的原因');
  assert.ok(trial.question && trial.answer !== trial.foil);
}

function harness({ wrongSentence = 0, invalidSentence = '', autoAdvance = true } = {}) {
  const controller = new AbortController();
  const stats = { stages: [], waits: [], fixations: [], choices: [], comprehensionCount: 0, remasked: 0 };
  let current = null;
  const c = {
    signal: controller.signal, rows: [], stats,
    root: {
      querySelectorAll() { return current?.words || []; },
      querySelector(selector) { return selector === '[data-spr-next]' ? current.button : current.position; },
    },
    stage(html) {
      stats.stages.push(html);
      if (!html.includes('data-spr-word')) return;
      const item = { words: [...html.matchAll(/data-spr-word="(\d+)"/g)].map(() => ({ style: {}, textContent: '', setAttribute() {} })), position: { textContent: '' }, button: null };
      const listeners = new Map();
      item.button = {
        disabled: false, textContent: '',
        addEventListener(type, fn) {
          listeners.set(type, fn);
          if (type === 'click' && autoAdvance) queueMicrotask(function advance() {
            if (!listeners.has('click')) return;
            if (!item.button.disabled) {
              clock += 300;
              fn({});
              const visible = item.words.filter(node => !/^—*$/.test(node.textContent)).length;
              assert.ok(visible <= 1, 'moving window must remask every previous word');
              stats.remasked += 1;
            }
            if (listeners.has('click')) queueMicrotask(advance);
          });
        },
        removeEventListener(type) { listeners.delete(type); },
      };
      current = item;
    },
    progress() {},
    abort() { controller.abort(); },
    async wait(ms) { stats.waits.push(ms); clock += ms; },
    async fixation(ms) { stats.fixations.push(ms); clock += ms; },
    async note() {},
    async choose(html, options, settings = {}) {
      stats.choices.push({ html, options, settings });
      let value;
      if (html.includes('理解判断')) {
        stats.comprehensionCount += 1;
        value = stats.comprehensionCount === wrongSentence ? 'foil' : 'correct';
      } else {
        const target = html.match(/data-pwi-target="([^"<>]+)"/)[1];
        assert.ok(options.some(option => option.value === target));
        value = target;
      }
      clock += 420;
      return { value, rt: 420, timedOut: false };
    },
    record(row) {
      if (row.phase === 'formal' && row.sentence_id === invalidSentence) row.valid = false;
      else row.valid = row.valid !== false;
      c.rows.push({ ...row });
    },
    shuffle: a => [...a],
    escape: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
    mean(values) { const usable = values.filter(value => typeof value === 'number' && Number.isFinite(value)); return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null; },
    percent(n, d) { return d ? `${(100 * n / d).toFixed(1)}%` : '数据不足'; },
  };
  return c;
}

const readingContext = harness({ wrongSentence: 3, invalidSentence: 'spr-4' });
const readingResult = await tasks.get('self-paced-reading').run(readingContext);
const sentences = readingContext.rows.filter(row => row.phase === 'formal');
const words = readingContext.rows.filter(row => row.phase === 'word');
assert.equal(sentences.length, 20);
assert.equal(words.length, readingPlan.reduce((sum, item) => sum + item.tokens.length, 0));
assert.equal(words.length, 170);
assert.equal(readingContext.stats.fixations.length, 20);
assert.ok(readingContext.stats.fixations.every(ms => ms === 500));
assert.equal(readingContext.stats.comprehensionCount, 20);
assert.ok(words.every(row => row.rt === 300));
assert.ok(words.filter(row => row.sentence_id === 'spr-3').every(row => row.comprehension_correct === false));
assert.ok(words.filter(row => row.sentence_id === 'spr-4').every(row => row.valid === false));
assert.equal(readingResult.metrics.find(metric => metric.label === '纳入区域分析的句子').value, 18);
assert.equal(documentListeners.get('keydown').size, 0);
assert.equal(documentListeners.get('visibilitychange').size, 0);

const interrupted = harness({ autoAdvance: false });
const interruptedReading = helpers.readMovingWindow(interrupted, readingPlan[0]);
let repeatedPrevented = false;
for (const handler of documentListeners.get('keydown')) handler({ key: ' ', repeat: true, preventDefault() { repeatedPrevented = true; } });
assert.equal(repeatedPrevented, false, 'holding Space must not advance the word window');
assert.ok(interrupted.root.querySelectorAll('[data-spr-word]').every(node => node.textContent === ''));
interrupted.abort();
await assert.rejects(interruptedReading, error => error.name === 'AbortError');
assert.equal(documentListeners.get('keydown').size, 0);

const statsContext = harness();
const chosenWords = [
  { condition: 'ambiguous', region: 'critical', rt: 600, comprehension_correct: true },
  { condition: 'control', region: 'critical', rt: 400, comprehension_correct: true },
  { condition: 'ambiguous', region: 'spillover', rt: 550, comprehension_correct: true },
  { condition: 'control', region: 'spillover', rt: 450, comprehension_correct: true },
  { condition: 'ambiguous', region: 'critical', rt: 9000, comprehension_correct: false },
  { condition: 'ambiguous', region: 'critical', rt: 9000, comprehension_correct: true, valid: false },
];
const controlled = helpers.readingSummary(statsContext, chosenWords, [{ correct: true }]);
assert.equal(controlled.metrics.find(metric => metric.label === '花园路径效应').value, '+200 ms');
assert.equal(controlled.metrics.find(metric => metric.label === '溢出效应').value, '+100 ms');

const pwiPlan = helpers.buildPwiTrials(identity);
assert.equal(pwiPlan.length, 20);
assert.equal(pwiPlan.filter(trial => trial.soa === -100).length, 10);
assert.equal(pwiPlan.filter(trial => trial.soa === 0).length, 10);
for (const condition of ['semantic', 'phonological', 'unrelated']) for (const soa of [-100, 0]) {
  const cell = pwiPlan.filter(trial => trial.condition === condition && trial.soa === soa);
  assert.ok(cell.length === 3 || cell.length === 4);
  assert.equal(new Set(cell.map(trial => trial.picture.id)).size, 3);
}
const pwiContext = harness();
const pwiResult = await tasks.get('picture-word-interference').run(pwiContext);
assert.equal(pwiContext.rows.length, 20);
assert.ok(pwiContext.rows.every(row => row.phase === 'formal' && row.correct));
assert.ok(pwiContext.stats.fixations.every(ms => ms === 500));
assert.equal(pwiContext.stats.waits.filter(ms => ms === 200).length, 20);
assert.equal(pwiContext.stats.waits.filter(ms => ms === 100).length, 10);
assert.ok(pwiContext.stats.choices.every(choice => choice.settings.timeout === 1500));
assert.ok(pwiContext.rows.every(row => row.measured_soa_estimate_ms === row.soa));
assert.ok(pwiContext.rows.every(row => row.response_mode === 'manual_picture_name_choice'));
assert.equal(pwiResult.metrics.find(metric => metric.label === '按键图片命名正确率').value, '100.0%');
assert.equal(pwiResult.metrics.find(metric => metric.label === 'SOA -100 ms · 语义干扰').value, '+0 ms');
const noCorrect = helpers.pwiSummary(pwiContext, pwiContext.rows.map(row => ({ ...row, correct: false })));
assert.equal(noCorrect.metrics.find(metric => metric.label === 'SOA -100 ms · 语义干扰').value, '数据不足');

console.log('language self-check passed: moving-window final word and masking, 20 sentence trials, comprehension filtering, six PWI cells, SOA timing and manual response scoring');

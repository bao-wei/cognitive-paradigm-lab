import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const stubElement = () => ({
  addEventListener() {},
  classList: { add() {}, remove() {} },
  style: {},
  hidden: true,
  innerHTML: "",
  replaceChildren(...children) { this.children = children; },
});

const documentStub = {
  querySelector(selector) {
    return stubElement();
  },
  querySelectorAll: () => [],
  createElement: stubElement,
};

const context = vm.createContext({
  document: documentStub,
  window: {
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
  },
  performance,
  Blob,
  URL,
  console,
});

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
vm.runInContext(`${source}\n;globalThis.__core = { EXPERIMENTS, meanRT, csvCell, renderKeys, normalizeResponseKey };`, context);

const { EXPERIMENTS, meanRT, csvCell, renderKeys, normalizeResponseKey } = context.__core;

assert.equal(EXPERIMENTS.stroop.formalCount, 20);
const stroop = EXPERIMENTS.stroop.buildTrials(EXPERIMENTS.stroop.formalCount);
assert.equal(stroop.length, 20);
assert.equal(stroop.filter((trial) => trial.condition === "congruent").length, 10);
assert.equal(stroop.filter((trial) => trial.condition === "incongruent").length, 10);
assert.deepEqual(
  Object.fromEntries(["1", "2", "3", "4"].map((key) => [key, stroop.filter((trial) => trial.expected === key).length])),
  { "1": 5, "2": 5, "3": 5, "4": 5 },
);

assert.equal(EXPERIMENTS.flanker.formalCount, 20);
const flanker = EXPERIMENTS.flanker.buildTrials(EXPERIMENTS.flanker.formalCount);
assert.equal(flanker.length, 20);
assert.equal(flanker.filter((trial) => trial.condition === "congruent").length, 10);
assert.equal(flanker.filter((trial) => trial.condition === "incongruent").length, 10);

assert.equal(EXPERIMENTS.gonogo.formalCount, 20);
const goNoGo = EXPERIMENTS.gonogo.buildTrials(EXPERIMENTS.gonogo.formalCount);
assert.equal(goNoGo.length, 20);
assert.equal(goNoGo.filter((trial) => trial.condition === "go").length, 15);
assert.equal(goNoGo.filter((trial) => trial.condition === "nogo").length, 5);
assert.equal(renderKeys(EXPERIMENTS.stroop.keys, true).match(/<button/g)?.length, 4);
assert.equal(renderKeys(EXPERIMENTS.flanker.keys, true).match(/<button/g)?.length, 2);
assert.equal(renderKeys(EXPERIMENTS.gonogo.keys, true).match(/<button/g)?.length, 1);
assert.equal(normalizeResponseKey("space"), " ");

for (const filename of ["change_detection.js", "change_detection-legacy-browsers.js"]) {
  const changeSource = await readFile(new URL(`../paradigms/packages/change-detection/${filename}`, import.meta.url), "utf8");
  assert.equal(changeSource.match(/\.slice\(0, 10\)/g)?.length, 2);
  assert.doesNotMatch(changeSource, /nReps: 5/);
}

const changeBuilder = await readFile(new URL("../paradigms/packages/change-detection/change_detection.psyexp", import.meta.url), "utf8");
assert.equal(changeBuilder.match(/name="Selected rows" updates="None" val="0:10"/g)?.length, 2);
assert.doesNotMatch(changeBuilder, /name="nReps" updates="None" val="5"/);

assert.equal(meanRT([
  { correct: true, rt: 420 },
  { correct: false, rt: 200 },
  { correct: true, rt: 580 },
  { correct: true, rt: null },
]), 500);
assert.equal(meanRT([{ correct: false, rt: 300 }]), null);
assert.equal(csvCell('a,"b"'), '"a,""b"""');
const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
const howToUse = await readFile(new URL("../how-to-use.html", import.meta.url), "utf8");
const notice = await readFile(new URL("../notice.html", import.meta.url), "utf8");
assert.doesNotMatch(home, /扩展范式库|DROP-IN LIBRARY/);
assert.doesNotMatch(home, /EXPERIMENT INDEX|id="how-it-works"|id="notice"/);
assert.match(home, /experiments\.html/);
assert.match(home, /how-to-use\.html/);
assert.match(home, /notice\.html/);
assert.match(howToUse, /不是测验/);
assert.match(notice, /只用于教学体验/);

console.log("self-check passed: 20-trial tasks, CSV escaping, cover-only homepage, and separate guidance pages");

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
vm.runInContext(`${source}\n;globalThis.__core = { EXPERIMENTS, meanRT, csvCell };`, context);

const { EXPERIMENTS, meanRT, csvCell } = context.__core;

const stroop = EXPERIMENTS.stroop.buildTrials(24);
assert.equal(stroop.length, 24);
assert.equal(stroop.filter((trial) => trial.condition === "congruent").length, 12);
assert.equal(stroop.filter((trial) => trial.condition === "incongruent").length, 12);
assert.deepEqual(
  Object.fromEntries(["1", "2", "3", "4"].map((key) => [key, stroop.filter((trial) => trial.expected === key).length])),
  { "1": 6, "2": 6, "3": 6, "4": 6 },
);

const flanker = EXPERIMENTS.flanker.buildTrials(24);
assert.equal(flanker.length, 24);
assert.equal(flanker.filter((trial) => trial.condition === "congruent").length, 12);
assert.equal(flanker.filter((trial) => trial.condition === "incongruent").length, 12);

const goNoGo = EXPERIMENTS.gonogo.buildTrials(28);
assert.equal(goNoGo.length, 28);
assert.equal(goNoGo.filter((trial) => trial.condition === "go").length, 21);
assert.equal(goNoGo.filter((trial) => trial.condition === "nogo").length, 7);

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

console.log("self-check passed: trials, CSV escaping, cover-only homepage, and separate guidance pages");

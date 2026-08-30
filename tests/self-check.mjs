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

const importedSection = stubElement();
const importedGrid = stubElement();
const documentStub = {
  querySelector(selector) {
    if (selector === "#imported-catalog") return importedSection;
    if (selector === "#imported-grid") return importedGrid;
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
vm.runInContext(`${source}\n;globalThis.__core = { EXPERIMENTS, meanRT, csvCell, renderImportedParadigms };`, context);

const { EXPERIMENTS, meanRT, csvCell, renderImportedParadigms } = context.__core;

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
assert.equal(importedSection.hidden, false);
assert.match(importedGrid.innerHTML, /扩展目录已就绪/);

renderImportedParadigms([{
  id: "simple-reaction",
  name: "Simple Reaction Time",
  description: "A self-contained task.",
  category: "基础反应",
  platform: "HTML / JavaScript",
  entry: "./paradigms/packages/simple-reaction/index.html",
  status: "ready",
  dataExport: "self",
}]);
assert.equal(importedGrid.children.length, 1);
assert.match(importedGrid.children[0].innerHTML, /打开实验/);

console.log("self-check passed: trial balance, RT filtering, and CSV escaping");

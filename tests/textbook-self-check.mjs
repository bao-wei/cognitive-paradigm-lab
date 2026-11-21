import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { readTextbookTasks, taskCatalogEntry } from '../tools/textbook-tasks.mjs';
const tasks=await readTextbookTasks();
const required=['donders','stroop','navon','mcgurk','sperling','change-detection','self-reference','semantic-priming','reconsolidation','retrieval-forgetting','eyewitness','drm','wason','bart','hanoi','embedded-figures','cultural-priming','interface-search','flanker','gonogo'];
assert.equal(tasks.length,20);
assert.deepEqual(tasks.map(t=>t.id).sort(),required.sort());
for(const task of tasks){
  assert.equal(typeof task.run,'function',task.id);
  assert.ok(task.name&&!/第.{1,3}章/.test(task.name),task.id+' must use paradigm name');
  assert.ok(task.instructions?.length&&task.description?.length>100,task.id+' needs learner instructions');
  const entry=taskCatalogEntry(task);assert.equal(entry.status,'ready');assert.ok(entry.metrics.length>=3);
  for(const asset of task.assets||[])assert.ok((await stat(new URL('../paradigms/textbook/'+asset,import.meta.url))).size>1000,asset);
}
const context=vm.createContext({window:{}});
vm.runInContext(await readFile(new URL('../paradigms/textbook/runtime.js',import.meta.url),'utf8'),context);
const core=context.window.Textbook;
assert.equal(core.mean([null,0,10,NaN]),5);
assert.equal(core.mean([]),null);
assert.equal(core.percent(1,0),'数据不足');
const rows=[{paradigm:'demo',answer:'含,逗号"和换行\n第二行',rt:500},{paradigm:'demo',answer:'=FORMULA',rt:null}];
const csv=core.csvText(rows);
const restored=core.parseCsv(csv);
assert.equal(restored[0].answer,rows[0].answer);
assert.equal(restored[1].answer,"'=FORMULA");
assert.throws(()=>core.parseCsv('a,b\n"unclosed'));
console.log('textbook self-check passed: 18 required + 2 existing tasks, local media, metadata, CSV round-trip');

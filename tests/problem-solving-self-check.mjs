import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
let task;
const context=vm.createContext({window:{Textbook:{register:t=>task=t}}});
vm.runInContext(await readFile(new URL('../paradigms/textbook/tasks/problem-solving.js',import.meta.url),'utf8'),context);
const {parseJarFormula:parse,makeJarProblems}=context.window.Textbook.problemSolvingChecks;
const problems=makeJarProblems();assert.equal(problems.length,20);
for(const p of problems){assert.equal(parse('A-C',p).value,p.target);assert.equal(parse('B-A-2C',p).value===p.target,p.type==='dual-solution');}
assert.equal(parse('B-A-C-C',{A:23,B:49,C:3}).strategy,'trained-rule');
assert.equal(parse('A-C=20',{A:23,B:49,C:3}).value,20);
for(const bad of ['A-C=999','A-C==20','A-C=alert(1)'])assert.throws(()=>parse(bad,{A:23,B:49,C:3}),bad);
for(const bad of ['20','A*B','globalThis.process.exit()','A/2','A+','A+(C','A+2'])assert.throws(()=>parse(bad,{A:23,B:49,C:3}),bad);
for(const group of ['set','control']){
 const ctx={rows:[],shuffle:a=>a.includes(group)?[group,...a.filter(v=>v!==group)]:[...a],note:async()=>{},progress(){},escape:String,
  input:async(html,opt)=>{const value=opt.label==='操作方法'?'A-C':'B-A-2C';assert.equal(opt.validate(value),true);return {value,rt:500};},
  choose:async(html,options)=>({value:options[0].value,rt:500}),record(r){this.rows.push({valid:true,...r});},
  mean:a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null,percent:(n,d)=>d?(n/d*100).toFixed(1)+'%':'数据不足'};
 const result=await task.run(ctx);assert.equal(ctx.rows.filter(r=>r.phase==='formal').length,20);assert.ok(ctx.rows.filter(r=>r.phase==='formal').every(r=>r.correct));assert.equal(result.metrics[3].value,'100.0%');
}
console.log('problem-solving self-check passed: parser boundary, two strategy classes, 20 trials in both groups');

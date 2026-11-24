import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const waits=[], rests=[];
const nodes=new Map(['#stage','#progress-text','#progress','#visibility-note'].map(key=>[key,{innerHTML:'',textContent:'',hidden:false,max:1,value:0}]));
const listeners=[];
const document={hidden:false,querySelector:selector=>nodes.get(selector),addEventListener(type,fn){if(type==='visibilitychange')listeners.push(fn);}};
const context=vm.createContext({window:{},document,AbortController,DOMException,URL,Math,Date,
  setTimeout(fn,ms){waits.push(ms);queueMicrotask(fn);return waits.length;},clearTimeout(){},
});
const source=await readFile(new URL('../paradigms/textbook/runtime.js',import.meta.url),'utf8');
vm.runInContext(source.replace('  global.Textbook={','  global.__makeContext=makeContext;\n  global.Textbook={'),context);
const ctx=context.window.__makeContext({id:'readiness-check'});
ctx.note=async(html,label)=>{rests.push({html,label,completedBeforeResume:ctx.rows.length});document.hidden=true;listeners[0]();document.hidden=false;};
for(let index=0;index<6;index++){
  const ms=await ctx.trialStart(index,6,{blockSize:2,fixationMs:650});
  ctx.record({phase:'formal',correct:true,rt:400,fixation_ms:ms});
}
assert.deepEqual(waits,[2000,650,2000,650,2000,650]);
assert.deepEqual(Array.from(ctx.rows,row=>row.block_number),[1,1,2,2,3,3]);
assert.deepEqual(Array.from(ctx.rows,row=>row.preparation_fixation_ms),waits);
assert.deepEqual(rests.map(rest=>rest.completedBeforeResume),[2,4]);
assert.ok(rests.every(rest=>rest.label==='休息好了，继续'&&rest.html.includes('data-rest-break')));
assert.ok(ctx.rows.every(row=>row.valid),'window changes confined to rest must not invalidate the next trial');
const custom=[];
assert.equal(await ctx.trialStart(0,10,{fixationMs:800,renderFixation:async ms=>{custom.push(ms);await ctx.wait(ms);}}),2000);
assert.deepEqual(custom,[2000]);
assert.equal(await ctx.fixation(350),350,'ordinary fixations must retain requested duration');
await ctx.trialStart(1,10,{renderFixation:async()=>{document.hidden=true;listeners[0]();document.hidden=false;}});
ctx.record({correct:true,rt:400});assert.equal(ctx.rows.at(-1).valid,false,'window changes during fixation invalidate the active trial');
ctx.abort();
assert.equal(ctx.rows.length,0,'withdrawal clears data');
await assert.rejects(ctx.trialStart(1,10),error=>error.name==='AbortError');
const another=context.window.__makeContext({id:'restart-check'});
assert.equal(await another.fixation(300),2000,'each restarted experiment gets preparation');
assert.equal(await another.fixation(300),300);
another.abort();
console.log('readiness self-check passed: first/restart/after-rest >=2000ms, ordinary timing preserved, custom renderer, block metadata and cancellation');

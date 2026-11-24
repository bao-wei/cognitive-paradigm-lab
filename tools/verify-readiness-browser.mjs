import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=path.resolve('.'),out=path.join(root,'output/trial-readiness-2026-11-24/browser');await mkdir(out,{recursive:true});
const live=process.argv.find(arg=>arg.startsWith('--live='))?.slice(7);
const server=http.createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))throw new Error('path');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html;charset=utf-8');res.end(await readFile(file));}catch{res.statusCode=404;res.end('not found');}});
if(!live)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=live||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});
const report=[];
try{
for(const mode of live?['live-desktop']:['online-desktop','online-mobile','offline-linked']){
 const mobile=mode.includes('mobile'),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:900},isMobile:mobile,hasTouch:mobile,acceptDownloads:true,offline:mode==='offline-linked'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(mode==='offline-linked')await page.goto(pathToFileURL(path.join(root,'output/trial-readiness-2026-11-24/linked/第三章_注意网络测试 ANT/index.html')).href);
 else await page.goto(base+'/runner.html?id=ant');
 let scope=page;
 if(mode!=='offline-linked'){await page.locator('#experiment-frame').waitFor();scope=page.frames().find(f=>f.url().includes('/paradigms/textbook/index.html'));}
 await scope.locator('#begin').waitFor();
 assert.match(await scope.locator('.instructions').innerText(),/144/);
 await scope.evaluate(()=>{
  const task=Textbook.tasks.get('ant'),run=task.run;
  task.run=async ctx=>{
   window.__qaCtx=ctx;window.__qaStarts=[];window.__qaTargetOnsets=[];
   const wait=ctx.wait,choose=ctx.choose,start=ctx.trialStart;
   ctx.wait=ms=>wait(ms>=2000?ms:0);
   ctx.trialStart=async(...args)=>{const duration=await start(...args);__qaStarts.push({index:args[0],duration});return duration;};
   ctx.choose=(html,...args)=>{if(html.includes('data-ant-phase="target"'))__qaTargetOnsets.push(performance.now());return choose(html,...args);};
   return run(ctx);
  };
  window.__qaBeginAt=performance.now();
 });
 await scope.locator('#begin').click();
 await scope.waitForTimeout(900);
 assert.equal(await scope.locator('[data-ant-phase="target"]').count(),0,'first target appeared before preparation');
 let breaks=0;const resumeTimes=[];
 for(let step=0;step<160;step++){
  await scope.waitForFunction(()=>document.querySelector('#download')||document.querySelector('.choices button:enabled'),{timeout:10000});
  if(await scope.locator('#download').count())break;
  if(await scope.locator('[data-rest-break]').count()){
   const completed=await scope.evaluate(()=>__qaCtx.rows.length);assert.equal(completed,(breaks+1)*48);
   await scope.waitForTimeout(150);assert.equal(await scope.evaluate(()=>__qaCtx.rows.length),completed,'rest must await learner');
   if(breaks===0)await page.screenshot({path:path.join(out,mode+'-rest.png'),fullPage:true});
   resumeTimes.push(await scope.evaluate(()=>performance.now()));
   await scope.locator('.choices button:enabled').click();breaks++;
   await scope.waitForTimeout(900);assert.equal(await scope.locator('[data-ant-phase="target"]').count(),0,'post-rest target appeared too early');
  }else{
   const direction=await scope.locator('[data-ant-phase="target"] text').last().textContent();
   await scope.locator(`.choices button[data-answer="${direction[2]==='←'?0:1}"]`).click();
  }
 }
 await scope.locator('#download').waitFor();assert.equal(breaks,2);
 const data=await scope.evaluate(()=>({rows:__qaCtx.rows,starts:__qaStarts,onsets:__qaTargetOnsets,begin:__qaBeginAt}));
 assert.equal(data.rows.length,144);assert.equal(data.starts.length,144);
 assert.ok(data.onsets[0]-data.begin>=1900);
 for(let b=0;b<2;b++)assert.ok(data.onsets[(b+1)*48]-resumeTimes[b]>=1900,'post-rest actual preparation');
 for(let i=0;i<144;i++){assert.equal(data.rows[i].block_number,Math.floor(i/48)+1);assert.equal(data.rows[i].correct,true);assert.equal(data.rows[i].fixation_ms,data.starts[i].duration);assert.ok(i%48===0?data.starts[i].duration>=2000:data.starts[i].duration>=400&&data.starts[i].duration<=1600);}
 assert.equal(await scope.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const downloadPromise=page.waitForEvent('download');await scope.locator('#download').click();const download=await downloadPromise;const filename=path.join(out,mode+'-ant.csv');await download.saveAs(filename);
 assert.equal((await readFile(filename,'utf8')).trim().split(/\r?\n/).length,145);
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,mode+'-result.png'),fullPage:true});
 report.push({mode,formalRows:144,correctRows:144,breaks,firstPreparationActualMs:Math.round(data.onsets[0]-data.begin),postRestPreparationActualMs:resumeTimes.map((t,i)=>Math.round(data.onsets[(i+1)*48]-t)),csvRows:144,errors,normalFixationRange:[400,1600]});
 console.log(mode+': ANT144, 2 learner-controlled rests, actual 2s preparation, results and CSV passed');await context.close();
}
}finally{await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
await writeFile(path.join(out,live?'live-readiness-report.json':'readiness-browser-report.json'),JSON.stringify(report,null,2));

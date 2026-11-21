import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const packagePath=process.env.PLAYWRIGHT_PACKAGE||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/package.json';
const {chromium}=createRequire(packagePath)('playwright');
const root=path.resolve('.');
const output=path.join(root,'output','textbook-browser');await mkdir(output,{recursive:true});
const packagesRoot=path.resolve(process.argv.slice(2).find(arg=>!arg.startsWith('--'))||path.join(root,'output','电子教材H5'));
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
const manifest=JSON.parse(await readFile(path.join(packagesRoot,'实验包清单.json'),'utf8')).filter(item=>!only||only.split(',').includes(item.id));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});
const results=[];
const complete=process.argv.includes('--complete');
async function completeTask(page,item) {
  await page.evaluate(id=>{
    const originalNow=performance.now.bind(performance);let offset=0;
    Object.defineProperty(performance,'now',{value:()=>originalNow()+offset,configurable:true});
    const task=Textbook.tasks.get(id),run=task.run;
    task.run=async ctx=>{
      window.__qaRows=ctx.rows;
      const wait=ctx.wait;
      ctx.wait=async ms=>{offset+=ms;return wait(Math.min(ms,2));};
      ctx.fixation=async(ms=500)=>{ctx.stage('<div class="fixation">+</div>');await ctx.wait(ms);};
      const choose=ctx.choose;
      ctx.choose=(html,options,settings)=>{
        const shape=html.match(/aria-label="记忆图形 (\d+)"/);
        if(id==='reconsolidation'&&shape){
          const index=Number(shape[1])-1;
          const updated=ctx.rows.find(r=>r.phase==='interference-study'&&r.shape===index)?.updated;
          window.__qaChoice=options.findIndex(o=>String(o.value)===String(html.includes('新位置 B')&&updated!==undefined?updated:index%4));
        }else window.__qaChoice=null;
        return choose(html,options,settings);
      };
      return run(ctx);
    };
  },item.id);
  await page.locator('#begin').click();
  for(let iteration=0;iteration<1600;iteration++){
    const state=await page.evaluate(()=>{
      const stage=document.querySelector('#stage');
      if(stage.querySelector('#download'))return {done:true,count:window.__qaRows.length};
      if(stage.querySelector('#restart'))return {error:stage.innerText};
      if(stage.querySelector('.input-form'))return {kind:'input',label:stage.querySelector('.input-form label').textContent};
      if(stage.querySelector('[data-card]'))return {kind:'cards'};
      if(stage.querySelector('[data-search-item]'))return {kind:'search',target:stage.querySelector('h2').textContent.replace('请找到：','')};
      const choices=[...stage.querySelectorAll('.choices button:enabled')];
      if(choices.length)return {kind:'choice',index:Number.isInteger(window.__qaChoice)&&window.__qaChoice>=0&&window.__qaChoice<choices.length?window.__qaChoice:(choices.findIndex(b=>b.textContent.includes('结束本轮'))>=0?choices.findIndex(b=>b.textContent.includes('结束本轮')):choices.some(b=>b.textContent.startsWith('保存 '))?1:0)};
      return {kind:'wait'};
    });
    if(state.done)return state.count;
    if(state.error)throw new Error(item.id+': '+state.error);
    if(state.kind==='input'){
      const positions=state.label.match(/^(4|12) 个字母/);
      const text=positions?'?'.repeat(Number(positions[1])):'这幅图像让我想到日常观察到的情境。我认为需要同时考虑画面中对象的行动方向以及周围环境和其他对象之间的关系，才能解释目前看到的情形。';
      await page.locator('.input-form textarea').fill(text);await page.locator('.input-form button').click();
    }else if(state.kind==='cards'){
      await page.locator('[data-card]').nth(0).click();await page.locator('[data-card]').nth(3).click();await page.locator('[data-submit]').click();
    }else if(state.kind==='search')await page.locator(`[data-search-item="${state.target}"]`).click();
    else if(state.kind==='choice'){
      const buttons=page.locator('.choices button:enabled');if(await buttons.count()>state.index)await buttons.nth(state.index).click({timeout:2500}).catch(()=>{});
    }else await page.waitForTimeout(5);
  }
  await page.screenshot({path:path.join(output,item.id+'-incomplete.png'),fullPage:true});
  throw new Error(item.id+' did not finish within the bounded UI driver: '+await page.locator('#stage').innerText());
}
try{
  for(const mobile of [false,true]){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:900},hasTouch:mobile,isMobile:mobile,offline:true,acceptDownloads:true});
    for(const item of manifest){
      const page=await context.newPage();const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
      await page.goto(pathToFileURL(path.join(packagesRoot,item.html)).href);
      await page.locator('#begin').waitFor();assert.ok((await page.title()).includes(item.name));
      const title=await page.locator('h1').innerText();assert.equal(title,item.name);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,item.id+' instruction overflow');
      const completionEligible=complete&&!['mcgurk','embedded-figures'].includes(item.id);
      let completedRows=null;
      if(completionEligible)completedRows=await completeTask(page,item);
      else {await page.locator('#begin').click();await page.waitForTimeout(250);}
      assert.equal(errors.length,0,item.id+': '+errors.join(';'));
      if(['stroop','change-detection','embedded-figures','wason','mcgurk'].includes(item.id))await page.screenshot({path:path.join(output,`${item.id}-${mobile?'mobile':'desktop'}.png`),fullPage:true});
      await page.locator('#exit').click();await page.getByRole('heading',{name:'本次实验已退出'}).waitFor();
      await page.getByRole('button',{name:'重新开始',exact:true}).click();await page.locator('#begin').waitFor();
      assert.equal(requests.length,0,item.id+' made online requests while offline');assert.equal(errors.length,0,item.id+': '+errors.join(';'));
      results.push({id:item.id,mobile,instructions:true,start:true,withdraw:true,restart:true,completedRows,accelerated:completionEligible,networkRequests:requests.length,errors});
      console.log(`${mobile?'mobile':'desktop'} ${item.id}: ${completedRows===null?'start/withdraw/restart':'completed '+completedRows+' rows'}`);
      await page.close();
    }
    await context.close();
  }
}finally{await browser.close();}
await writeFile(path.join(output,`offline-${complete?'complete':'smoke'}${only?'-'+only.replaceAll(',','_'):''}.json`),JSON.stringify(results,null,2));
console.log(`Offline browser checks passed: ${results.length} desktop/mobile cases; zero external requests.`);

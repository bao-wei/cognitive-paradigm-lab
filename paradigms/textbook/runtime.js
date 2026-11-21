(function (global) {
  'use strict';
  const tasks = new Map();
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function shuffle(values) { const a=[...values]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
  const mean = values => {const a=values.filter(v=>typeof v==='number'&&Number.isFinite(v));return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;};
  const percent = (n,d) => d ? `${(100*n/d).toFixed(1)}%` : '数据不足';
  function parseCsv(text) {
    const rows=[];let row=[],cell='',quoted=false;
    text=String(text).replace(/^\ufeff/,'');
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
    if(quoted)throw new Error('CSV 引号不完整');row.push(cell);if(row.some(Boolean))rows.push(row);
    const headers=rows.shift()||[];return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  }
  function csvText(rows) {
    const headers=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    const cell=v=>{let s=String(v??'');if(/^[=+@]/.test(s)||/^-\D/.test(s))s="'"+s;return /[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
    return '\ufeff'+[headers,...rows.map(r=>headers.map(h=>r[h]))].map(r=>r.map(cell).join(',')).join('\r\n');
  }
  function classroomChart(sessions,keys) {
    const groups=new Map();
    for(const row of sessions){const group=row.summary_分组||row.summary_本次随机分组||row.summary_本次随机组别||'全部会话';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row);}
    const bars=[];
    for(const key of keys)for(const [group,rows] of groups){const values=rows.map(r=>/^\d+(?:\.\d+)?%$/.test(r[key]||'')?Number.parseFloat(r[key]):null).filter(v=>v!==null);const value=mean(values);if(value!==null)bars.push(`<div class="class-bar"><span>${escape(key.slice(8))} · ${escape(group)}（${values.length} 人）</span><meter min="0" max="100" value="${value}" aria-label="${escape(key.slice(8))}">${value.toFixed(1)}%</meter><strong>${value.toFixed(1)}%</strong></div>`);}
    return bars.length?`<h3>班级比例指标均值</h3><p class="result-note">按会话等权平均，仅使用文件中实际存在的百分比指标。横轴为 0–100%。</p>${bars.join('')}`:'';
  }
  let current=null;
  function register(task) {if(tasks.has(task.id))throw new Error('重复范式 ID：'+task.id);tasks.set(task.id,task);}
  function makeContext(task) {
    const root=document.querySelector('#stage');
    const controller=new AbortController();let stageController=new AbortController(),visibilityVersion=0,recordVersion=0,audio=null;
    const rows=[];const session=`${task.id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    function check(){if(controller.signal.aborted)throw new DOMException('实验已退出','AbortError');}
    function stage(html){check();stageController.abort();stageController=new AbortController();root.innerHTML=html;}
    function wait(ms){check();return new Promise((resolve,reject)=>{const t=setTimeout(done,Math.max(0,ms));function done(){controller.signal.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(t);reject(new DOMException('实验已退出','AbortError'));}controller.signal.addEventListener('abort',abort,{once:true});});}
    async function choose(html,options,{timeout=0,hideAfter=0}={}) {
      stage(`<div class="stimulus-content">${html}</div><div class="choices">${options.map((o,i)=>`<button type="button" data-answer="${i}">${escape(o.label)}</button>`).join('')}</div>`);
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));check();const start=performance.now();
      return new Promise((resolve,reject)=>{
        let settled=false,timer,hideTimer;
        const signal=stageController.signal;
        const finish=(value,timedOut=false)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(hideTimer);controller.signal.removeEventListener('abort',abort);document.removeEventListener('keydown',onKey);root.querySelectorAll('.choices button').forEach(b=>b.disabled=true);resolve({value,rt:timedOut?null:performance.now()-start,timedOut});};
        function abort(){if(settled)return;settled=true;clearTimeout(timer);clearTimeout(hideTimer);document.removeEventListener('keydown',onKey);reject(new DOMException('实验已退出','AbortError'));}
        function onKey(event){if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||/INPUT|TEXTAREA/.test(event.target.tagName))return;const normalize=k=>k===' '?'space':String(k).toLowerCase()==='return'?'enter':String(k).toLowerCase();const key=normalize(event.key);const o=options.find(v=>normalize(v.key??v.value)===key);if(o){event.preventDefault();finish(o.value);}}
        options.forEach((o,i)=>root.querySelector(`[data-answer="${i}"]`).addEventListener('click',()=>finish(o.value),{signal}));
        document.addEventListener('keydown',onKey);controller.signal.addEventListener('abort',abort,{once:true});
        if(timeout)timer=setTimeout(()=>finish(null,true),timeout);
        if(hideAfter)hideTimer=setTimeout(()=>{const s=root.querySelector('.stimulus-content');if(s)s.style.visibility='hidden';},hideAfter);
      });
    }
    async function input(html,{label='你的回答',placeholder='',minLength=1,validate,buttonLabel='提交'}={}) {
      stage(`${html}<form class="input-form"><label for="task-input">${escape(label)}</label><textarea id="task-input" placeholder="${escape(placeholder)}" autocomplete="off" spellcheck="false"></textarea><p class="input-error" role="alert"></p><button type="submit">${escape(buttonLabel)}</button></form>`);
      const start=performance.now();const form=root.querySelector('form');const field=root.querySelector('textarea');
      return new Promise((resolve,reject)=>{function abort(){reject(new DOMException('实验已退出','AbortError'));}controller.signal.addEventListener('abort',abort,{once:true});form.addEventListener('submit',event=>{event.preventDefault();const value=field.value.trim();const result=validate?validate(value):true;const error=value.length<minLength?`请至少填写 ${minLength} 个字符。`:result===true||result===undefined?'':typeof result==='string'?result:'请检查填写内容。';if(error){root.querySelector('.input-error').textContent=error;return;}controller.signal.removeEventListener('abort',abort);form.querySelector('button').disabled=true;resolve({value,rt:performance.now()-start});},{signal:stageController.signal});});
    }
    const ctx={root,rows,stage,wait,choose,input,escape,shuffle,mean,percent,signal:controller.signal,
      asset:relative=>global.TEXTBOOK_ASSETS?.[relative]||relative,
      fixation:async(ms=500)=>{stage('<div class="fixation" aria-label="请注视中央">+</div>');await wait(ms);},
      note:async(html,buttonLabel='继续')=>choose(html,[{value:'continue',label:buttonLabel,key:'space'}]),
      record(row){check();row.valid=row.valid!==false&&visibilityVersion===recordVersion;recordVersion=visibilityVersion;rows.push({paradigm:task.id,session,trial:rows.length+1,...row});},
      progress(index,total,label='正式实验'){document.querySelector('#progress-text').textContent=`${label} · ${index} / ${total}`;const p=document.querySelector('#progress');p.max=total||1;p.value=index;},
      async tone(hz=600,duration=200){try{audio||=new(global.AudioContext||global.webkitAudioContext)();await audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=hz;g.gain.value=.08;o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration/1000);return true;}catch{return false;}},
      abort(){controller.abort();stageController.abort();rows.length=0;if(ctx.exportUrl){URL.revokeObjectURL(ctx.exportUrl);ctx.exportUrl=null;}if(audio)audio.close().catch(()=>{});},
    };
    document.addEventListener('visibilitychange',()=>{if(document.hidden){visibilityVersion++;document.querySelector('#visibility-note').hidden=false;}},{signal:controller.signal});
    return ctx;
  }
  function taskId(){return global.TEXTBOOK_OFFLINE_ID||new URLSearchParams(location.search).get('id')||'';}
  function describe(task) {
    const details=task.description||'';
    return `<div class="instructions"><p class="eyebrow">PARADIGM EXPERIENCE</p><h1>${escape(task.name)}</h1><p>${escape(task.shortDescription)}</p><ul>${(task.instructions||[]).map(v=>`<li>${escape(v)}</li>`).join('')}</ul><p class="result-note">${task.trialCount?`本次${escape(task.trialCount)}${typeof task.trialCount==='number'?'个正式试次':''}。`:''}仅供教学；结果只保留在当前页面，离开前可导出 CSV。</p><button id="begin" type="button">开始实验</button><details><summary>了解范式原理与指标</summary><div class="description-text">${escape(details).replaceAll('\n','<br>')}</div></details></div>`;
  }
  async function launch() {
    if(current){current.abort();current=null;}
    document.querySelector('#visibility-note').hidden=true;
    const task=tasks.get(taskId());const root=document.querySelector('#stage');
    if(!task){root.innerHTML='<h1>没有找到这个实验</h1><p>请从平台目录重新进入。</p>';return;}
    document.title=`${task.name}｜妙趣认知实验室`;root.innerHTML=describe(task);
    document.querySelector('#exit').onclick=()=>{if(current){current.abort();current=null;}root.innerHTML='<h1>本次实验已退出</h1><p>未完成的结果已清除。</p><button id="restart">重新开始</button>';root.querySelector('#restart').onclick=launch;};
    root.querySelector('#begin').onclick=async event=>{
      event.currentTarget.disabled=true;
      if(current)current.abort();
      const ctx=makeContext(task);current=ctx;
      try {await ctx.tone(440,60);const result=await task.run(ctx);if(current!==ctx)return;finish(task,ctx,result||{});}
      catch(error){if(error.name==='AbortError')return;ctx.abort();current=null;root.innerHTML=`<h1>实验暂时中断</h1><p>${escape(error.message)}</p><button id="restart">重新开始</button>`;root.querySelector('#restart').onclick=launch;}
    };
  }
  function finish(task,ctx,result) {
    const rows=ctx.rows,root=ctx.root;
    const metrics=Array.isArray(result.metrics)?result.metrics:[];
    ctx.progress(1,1,'已完成');
    root.innerHTML=`<p class="eyebrow">YOUR RESULT</p><h1>这一次，你观察到了什么？</h1><p>${escape(task.name)} · 共 ${rows.length} 条过程与测验记录</p><div class="metrics">${metrics.map(m=>`<article><span>${escape(m.label)}</span><strong>${escape(m.value??'数据不足')}</strong><small>${escape(m.note||'')}</small></article>`).join('')}</div><h2>如何理解</h2><p>${escape(result.explanation||'请结合本次条件差异理解实验操作。单次短实验不能用于个人能力评价。')}</p>${result.extraHtml||''}<div class="result-actions"><a id="download" class="button" download>导出本次 CSV</a><button id="repeat" class="quiet">再做一次</button></div><p class="result-note">本次结果未上传、未保存到浏览器。切换窗口的试次保留在 CSV 中并标记 valid=false。反应时受屏幕刷新率、触屏和浏览器影响。</p><section class="classroom"><h2>课堂比较</h2><p>教师可以在本机选择同一范式的多个 CSV，查看匿名会话与分组汇总。文件只在当前页面解析，不会上传。</p><label>选择本地 CSV 文件<input id="class-files" type="file" accept=".csv,text/csv" multiple></label><div id="class-results" role="status"></div></section>`;
    const summaryMetrics=Object.fromEntries(metrics.map(m=>[`summary_${m.label}`,m.value??'']));
    const exportRows=rows.map(r=>({...r,...summaryMetrics}));
    const url=URL.createObjectURL(new Blob([csvText(exportRows)],{type:'text/csv;charset=utf-8'}));
    ctx.exportUrl=url;
    root.querySelector('#download').href=url;root.querySelector('#download').download=`${task.id}-${Date.now()}.csv`;
    root.querySelector('#repeat').onclick=()=>{URL.revokeObjectURL(url);ctx.abort();current=null;launch();};
    root.querySelector('#class-files').onchange=async event=>{
      const target=root.querySelector('#class-results');try{const imports=(await Promise.all([...event.target.files].map(f=>f.text().then(parseCsv)))).flat();const matches=imports.filter(r=>r.paradigm===task.id);if(!matches.length)throw new Error('没有找到同一范式的数据。');const sessions=new Map();for(const row of matches){if(!row.session)continue;if(!sessions.has(row.session))sessions.set(row.session,row);}const summaryKeys=[...new Set([...sessions.values()].flatMap(r=>Object.keys(r).filter(k=>k.startsWith('summary_'))))];target.innerHTML=`<p>共导入 ${sessions.size} 个匿名会话；同一会话重复文件只计一次。</p><div class="table-scroll"><table><thead><tr><th>匿名会话</th>${summaryKeys.map(k=>`<th>${escape(k.slice(8))}</th>`).join('')}</tr></thead><tbody>${[...sessions.values()].map((r,i)=>`<tr><td>${i+1}</td>${summaryKeys.map(k=>`<td>${escape(r[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${classroomChart([...sessions.values()],summaryKeys)}`;}catch(e){target.textContent=e.message;}
    };
    try {
      if(global.parent!==global&&location.origin!=='null'&&global.parent.location.origin===location.origin)
        global.parent.postMessage({type:'cognition-lab:complete',trialCount:rows.length,selfRendered:true},location.origin);
    } catch { /* Standalone or cross-origin textbook containers keep results inside this page. */ }
  }
  global.Textbook={register,tasks,launch,escape,shuffle,mean,percent,parseCsv,csvText};
})(window);

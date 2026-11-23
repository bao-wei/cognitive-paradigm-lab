(function registerProblemSolving(T) {
  'use strict';
  function parseJarFormula(raw, capacities) {
    const equation=String(raw).normalize('NFKC').toUpperCase().replace(/[−–—]/g,'-').replace(/[×·]/g,'*').replace(/\s/g,'').split('=');
    if(equation.length>2||equation.length===2&&!/^\d+$/.test(equation[1]))throw new Error('等式右侧请只填写一个非负整数，或省略等号和结果。');
    const text=equation[0].replace(/(\d)([ABC(])/g,'$1*$2');
    if(!text||text.length>80||!/^[ABC0-9+*()\-]+$/.test(text))throw new Error('请用 A、B、C、加减、整数倍和括号表示方法，例如 A+B；不要只填最终水量。');
    const tokens=text.match(/[ABC]|\d+|[()+*\-]/g);let at=0;
    const blank=()=>({A:0,B:0,C:0});
    function factor(){const token=tokens[at++];if(token==='('){const result=sum();if(tokens[at++]!==')')throw new Error('括号不完整');return result;}if(token==='-'||token==='+'){const result=factor();if(token==='-')for(const k of ['constant','A','B','C'])result[k]*=-1;return result;}if(/^[ABC]$/.test(token||''))return {...blank(),constant:0,[token]:1};if(/^\d+$/.test(token||'')){const number=Number(token);if(number>10)throw new Error('整数倍请限制在 0–10 之间');return {...blank(),constant:number};}throw new Error('表达式不完整');}
    function product(){let left=factor();while(tokens[at]==='*'){at++;const right=factor(),leftJar=['A','B','C'].some(k=>left[k]),rightJar=['A','B','C'].some(k=>right[k]);if(leftJar&&rightJar)throw new Error('两个水罐的容量不能相乘');if(!leftJar&&!rightJar)left.constant*=right.constant;else{const scalar=leftJar?right.constant:left.constant,vector=leftJar?left:right;left={constant:vector.constant*scalar,A:vector.A*scalar,B:vector.B*scalar,C:vector.C*scalar};}}return left;}
    function sum(){let left=product();while(tokens[at]==='+'||tokens[at]==='-'){const sign=tokens[at++]==='+'?1:-1,right=product();for(const k of ['constant','A','B','C'])left[k]+=sign*right[k];}return left;}
    const coefficients=sum();if(at!==tokens.length||coefficients.constant!==0||!['A','B','C'].some(k=>coefficients[k]))throw new Error('请写出由水罐容量组成的完整操作式，不能直接填写目标数值。');
    const uses=['A','B','C'].reduce((s,k)=>s+Math.abs(coefficients[k]),0);if(uses>12)throw new Error('教学题请将用罐次数控制在 12 次以内');
    const value=['A','B','C'].reduce((s,k)=>s+coefficients[k]*capacities[k],0);
    if(equation.length===2&&Number(equation[1])!==value)throw new Error('等号右侧的数值与实际水罐计算不一致，请核对。');
    const old=coefficients.A===-1&&coefficients.B===1&&coefficients.C===-2;
    const direct=coefficients.A===1&&coefficients.B===0&&coefficients.C===-1;
    return {normalized:text,value,coefficients,uses,strategy:old?'trained-rule':direct?'direct-A-C':'other'};
  }
  function makeJarProblems() {
    const dual=Array.from({length:10},(_,i)=>{const A=23+i*2,C=3+i%4;return {A,B:2*A+C,C,target:A-C,type:'dual-solution'};});
    const switchOnly=Array.from({length:10},(_,i)=>{const A=25+i*3,C=2+i%5;return {A,B:2*A+C+7+i,C,target:A-C,type:'rule-change'};});
    return [...dual,...switchOnly];
  }
  function jars(problem) {
    return `<svg viewBox="0 0 480 210" role="img" aria-label="A、B、C 三个不同容量的水罐" style="width:100%;max-width:560px">${['A','B','C'].map((k,i)=>{const x=15+i*160,height=95+Math.min(65,problem[k]);return `<g><path d="M${x+20} ${175-height}V158Q${x+20} 175 ${x+45} 175H${x+100}Q${x+125} 175 ${x+125} 158V${175-height}" fill="#d4e4e7" stroke="#1f5067" stroke-width="3"/><text x="${x+72}" y="133" text-anchor="middle" fill="#172839" font-size="25">${k}</text><text x="${x+72}" y="202" text-anchor="middle" fill="#172839" font-size="18">${problem[k]} 单位</text></g>`;}).join('')}</svg>`;
  }
  T.register({
    id:'water-jug',name:'Luchins 水罐与思维定势',chapter:'第九章',code:'9-2',category:'推理与问题解决',taskType:'解题策略与转换',trialCount:'5 次准备；20 次正式解题',
    shortDescription:'利用三种容量量出目标水量，观察熟悉方法是否妨碍发现简便解法。',
    instructions:['把水罐 A、B、C 的容量组合成指定水量。可装满、倒去一整罐对应容量；用 A、B、C 的加减和整数倍记录方法。', '系统随机安排准备活动，然后完成 20 道解题任务。每题可输入方法，或选择没有解出。不会在正式题之间提示简便方法。', '输入例如 A+B、B-A-C 或 2*A-C；只填最终数字不算操作方法。电脑输入和手机屏幕输入均可使用。'],
    description:'# Luchins 水罐与思维定势\n\n## 与教材的联系\n对应第九章第二节“思维定势”及图9-13。保留河内塔9-1，补充水罐9-2，分别展示子目标搜索和成功经验对策略转换的影响。\n\n## 任务流程\n每次会话随机进入定势准备或对照准备组，先完成5次准备。定势组反复用 B−A−2C 解题并得到反馈；对照组只做不涉及水罐规则的计算。正式阶段20题，前10题可用熟悉规则或 A−C；后10题原规则不再得到目标水量，但仍有直接解法。正式测验不逐题揭示解法，以免把提示混入定势效果。\n\n## 记录与指标\n记录输入公式、实际组合结果、正确性、反应时、用罐次数，以及是否使用熟悉公式或直接解法。分别汇总可用双解题与规则改变题的表现，在结果页解释实际策略。用罐次数按化简后的净用量计，不等同于真实倒水动作数。\n\n## 教学边界\n20题是扩展教学版，不是原始研究题表，也不是智力或创造力测验。单人只进入一个组，不能凭个人结果宣称组间因果效应；教师可本地导入班级CSV比较真实分组。\n\n## 来源\nLuchins (1942), Mechanization in problem solving: The effect of Einstellung；依照本书第四稿“水罐实验”段落与图9-13改编。后续实验参考 Ellis & Reingold (2014), The Einstellung effect in anagram problem solving（此处仅用于说明认知定势概念）；[水罐直接实验研究](https://escholarship.org/uc/item/1976z9q8)。',
    async run(ctx) {
      const group=ctx.shuffle(['set','control'])[0],practice=[{A:21,B:127,C:3},{A:14,B:163,C:25},{A:18,B:43,C:10},{A:9,B:42,C:6},{A:20,B:59,C:4}];
      await ctx.note('<h2>开始前的准备活动</h2><p>请按接下来屏幕上的要求完成。正式题开始后，不再提供解法反馈。</p>');
      for(let i=0;i<5;i++){
        ctx.progress(i+1,5,'准备活动');
        if(group==='set'){
          const p={...practice[i],target:practice[i].B-practice[i].A-2*practice[i].C};
          const response=await ctx.input(`<h2>准备题 ${i+1}</h2>${jars(p)}<p>目标：${p.target} 单位。请使用 B−A−2C 这一方法，写出操作式。</p>`,{label:'用 A、B、C 写出方法',minLength:1,validate:value=>{try{parseJarFormula(value,p);return true;}catch(e){return e.message;}}});
          const scored=parseJarFormula(response.value,p);ctx.record({phase:'practice',condition:group,...p,response:response.value,correct:scored.value===p.target,rt:response.rt});
          await ctx.note(`<h2>准备题反馈</h2><p>B−A−2C＝${p.B}−${p.A}−2×${p.C}＝${p.target}。${scored.value===p.target?'本次计算正确。':'请记住这一操作式。'}</p>`);
        }else{
          const A=13+i*3,B=5+i;const r=await ctx.choose(`<h2>计算准备 ${i+1}</h2><p>${A}+${B}＝？</p>`,ctx.shuffle([A+B,A+B-1,A+B+1]).map(n=>({value:n,label:String(n)})));ctx.record({phase:'practice',condition:group,response:r.value,correct:r.value===A+B,rt:r.rt});await ctx.note('<p>计算准备已完成，继续下一题。</p>');
        }
      }
      await ctx.note('<h2>正式解题</h2><p>请独立寻找一种能量出目标水量的方法。题目没有限制必须使用全部水罐；没有解出也可以如实记录。</p>');
      const problems=makeJarProblems();
      for(let i=0;i<problems.length;i++){
        ctx.progress(i+1,20,'正式解题');const p=problems[i];
        const response=await ctx.input(`<h2>量出 ${p.target} 单位的水</h2>${jars(p)}<p>写出操作方法；没有解出可填“不知道”。</p>`,{label:'操作方法',minLength:1,validate:value=>{if(/^(不知道|未解出|跳过)$/.test(value))return true;try{parseJarFormula(value,p);return true;}catch(e){return e.message;}}});
        const parsed=/^(不知道|未解出|跳过)$/.test(response.value)?null:parseJarFormula(response.value,p);
        ctx.record({phase:'formal',trial:i+1,condition:group,problem_type:p.type,...p,response:response.value,correct:parsed?.value===p.target,computed:parsed?.value??null,strategy:parsed?.strategy||'unsolved',net_jar_uses:parsed?.uses??null,rt:response.rt});
      }
      const rows=ctx.rows.filter(r=>r.phase==='formal'&&r.valid!==false),dual=rows.filter(r=>r.type==='dual-solution'),changed=rows.filter(r=>r.type==='rule-change');
      const duration=rs=>{const v=ctx.mean(rs.filter(r=>r.correct).map(r=>r.rt));return v===null?'数据不足':Math.round(v)+' ms';};
      const preparation=ctx.rows.filter(r=>r.phase==='practice'&&r.valid!==false);
      return {metrics:[{label:'分组',value:group==='set'?'定势准备':'对照准备'},{label:'双解题正确率',value:ctx.percent(dual.filter(r=>r.correct).length,dual.length)},{label:'双解题沿用旧法',value:ctx.percent(dual.filter(r=>r.strategy==='trained-rule').length,dual.length)},{label:'规则改变题正确率',value:ctx.percent(changed.filter(r=>r.correct).length,changed.length)},{label:'规则改变题正确 RT',value:duration(changed)},{label:'准备活动正确率',value:ctx.percent(preparation.filter(r=>r.correct).length,preparation.length)}],explanation:'前十题的 B−A−2C 和 A−C 都能得到目标水量；后十题沿用 B−A−2C 不再正确。分组只表示接受了哪一种准备材料，准备正确率可用来检查规则是否掌握，并不保证已经形成定势。结果来自实际输入，不预设定势一定出现，也不由一人的结果推断组间差异。',extraHtml:`<div class="table-scroll"><table><thead><tr><th>阶段</th><th>正确率</th><th>正确反应时</th></tr></thead><tbody>${[[dual,'双解题'],[changed,'规则改变题']].map(([rs,label])=>`<tr><td>${label}</td><td>${ctx.percent(rs.filter(r=>r.correct).length,rs.length)}</td><td>${duration(rs)}</td></tr>`).join('')}</tbody></table></div>`};
    }
  });
  T.problemSolvingChecks={parseJarFormula,makeJarProblems};
})(window.Textbook);

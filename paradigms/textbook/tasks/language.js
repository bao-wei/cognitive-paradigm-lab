(function registerLanguageTasks(T) {
  'use strict';

  const regionLabels = { pre: '消歧前区', critical: '关键消歧词区', spillover: '消歧后溢出区' };
  const formatRT = value => value === null || !Number.isFinite(value) ? '数据不足' : `${Math.round(value)} ms`;
  const effect = (a, b) => a === null || b === null ? '数据不足' : `${a - b >= 0 ? '+' : ''}${Math.round(a - b)} ms`;
  const table = (c, headers, rows) => `<div class="table-scroll"><table><thead><tr>${headers.map(v => `<th>${c.escape(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${c.escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  // Twenty independently worded frames prevent a participant seeing both versions of one sentence.
  const sentenceFrames = [
    ['医生', '确认', '患者', '病情', '恶化', '非常', '复杂'],
    ['调查员', '发现', '大桥', '突然', '坍塌', '十分', '意外'],
    ['工程师', '查明', '设备', '反复', '停机', '比较', '特殊'],
    ['老师', '得知', '学生', '最近', '迟到', '相当', '复杂'],
    ['警员', '了解', '司机', '突然', '停车', '十分', '特殊'],
    ['园丁', '找到', '花木', '突然', '枯萎', '非常', '复杂'],
    ['研究员', '发现', '幼苗', '停止', '生长', '比较', '特殊'],
    ['经理', '查明', '订单', '连续', '减少', '非常', '复杂'],
    ['农民', '了解', '水渠', '突然', '断流', '比较', '特殊'],
    ['船员', '查明', '轮船', '突然', '减速', '十分', '复杂'],
    ['护士', '了解', '病人', '夜里', '咳嗽', '比较', '特殊'],
    ['班长', '找到', '同学', '频繁', '请假', '相当', '意外'],
    ['专家', '查明', '河水', '持续', '变浑', '十分', '复杂'],
    ['管理员', '了解', '网络', '频繁', '中断', '比较', '复杂'],
    ['厨师', '找到', '面包', '突然', '塌陷', '十分', '特殊'],
    ['技术员', '查明', '电池', '快速', '耗电', '相当', '复杂'],
    ['教练', '了解', '队员', '近日', '失误', '比较', '意外'],
    ['记者', '得知', '航班', '连续', '延误', '十分', '复杂'],
    ['站长', '查明', '列车', '突然', '停运', '相当', '特殊'],
    ['负责人', '确认', '照明', '反复', '闪烁', '非常', '复杂'],
  ];

  function buildReadingTrials(c) {
    const assignments = c.shuffle([...Array(10).fill('ambiguous'), ...Array(10).fill('control')]);
    return c.shuffle(sentenceFrames.map((frame, index) => {
      const [who, verb, subject, modifier, event, degree, adjective] = frame;
      const condition = assignments[index];
      const pre = condition === 'ambiguous' ? [who, verb, subject, modifier, event] : [who, verb, '造成', subject, modifier, event];
      const tokens = [...pre, '的原因', degree, adjective + '。'];
      const criticalIndex = pre.length;
      const questionType = index % 3;
      const question = questionType === 0 ? '句中是谁在了解或查明情况？' : questionType === 1 ? '句中哪件事情需要解释原因？' : '句中如何描述这个原因？';
      const answer = questionType === 0 ? who : questionType === 1 ? `${subject}${modifier}${event}` : `${degree}${adjective}`;
      const foil = questionType === 0 ? ['司机', '园丁', '医生'].find(name => name !== who) : questionType === 1 ? '公园正在举办展览' : '已经完全没有影响';
      return { id: `spr-${index + 1}`, condition, tokens, criticalIndex, regions: tokens.map((_, i) => i < criticalIndex ? 'pre' : i === criticalIndex ? 'critical' : 'spillover'), question, answer, foil };
    }));
  }

  async function readMovingWindow(c, item) {
    c.stage(`<p>按空格键或点击下方按钮逐词阅读。已经读过的词会重新遮挡，不能回看。</p><div data-spr-sentence="${item.id}" style="display:flex;flex-wrap:wrap;gap:12px 8px;align-items:baseline;justify-content:center;min-height:160px;padding:25px 0">${item.tokens.map((word, i) => `<span data-spr-word="${i}" aria-label="未显示的词" style="display:inline-block;min-width:${Math.max(3, word.length + 1)}em;text-align:center;font-size:clamp(20px,4vw,29px);font-family:var(--serif)">${'—'.repeat(Math.max(2, word.length))}</span>`).join('')}</div><p data-spr-position class="prompt" aria-live="polite">尚未揭示词语</p><button data-spr-next type="button">空格 / 显示下一个词</button>`);
    const nodes = [...c.root.querySelectorAll('[data-spr-word]')];
    const button = c.root.querySelector('[data-spr-next]');
    const position = c.root.querySelector('[data-spr-position]');
    let index = -1, onset = null, painting = false, done = false, invalid = false;
    const records = [];
    return new Promise((resolve, reject) => {
      const clear = () => {
        button.removeEventListener('click', advance);
        document.removeEventListener('keydown', key);
        document.removeEventListener('visibilitychange', visibility);
        c.signal?.removeEventListener('abort', abort);
      };
      const abort = () => { if (done) return; done = true; clear(); reject(new DOMException('实验已退出', 'AbortError')); };
      const visibility = () => { if (document.hidden) invalid = true; };
      const advance = () => {
        if (done || painting) return;
        const now = performance.now();
        if (index >= 0) records.push({ phase: 'word', sentence_id: item.id, condition: item.condition, word_index: index + 1, token: item.tokens[index], region: item.regions[index], rt: now - onset, word_onset_ms: onset, word_offset_ms: now });
        if (index === item.tokens.length - 1) { done = true; clear(); button.disabled = true; resolve({ records, invalid }); return; }
        index += 1;
        painting = true;
        button.disabled = true;
        nodes.forEach((node, i) => { node.textContent = i === index ? item.tokens[i] : '—'.repeat(Math.max(2, item.tokens[i].length)); node.setAttribute('aria-label', i === index ? '当前词语' : '被遮挡的词'); });
        position.textContent = `第 ${index + 1} / ${item.tokens.length} 个词`;
        button.textContent = index === item.tokens.length - 1 ? '空格 / 阅读完毕，回答问题' : '空格 / 显示下一个词';
        requestAnimationFrame(() => {
          if (done || c.signal?.aborted) return;
          onset = performance.now();
          painting = false;
          button.disabled = false;
        });
      };
      const key = event => {
        if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || ![' ', 'Spacebar'].includes(event.key)) return;
        event.preventDefault(); advance();
      };
      button.addEventListener('click', advance);
      document.addEventListener('keydown', key);
      document.addEventListener('visibilitychange', visibility);
      c.signal?.addEventListener('abort', abort, { once: true });
      if (c.signal?.aborted) abort();
    });
  }

  function readingSummary(c, words, sentences) {
    const scored = words.filter(row => row.valid !== false && row.comprehension_correct && Number.isFinite(row.rt));
    const by = (condition, region) => c.mean(scored.filter(row => row.condition === condition && row.region === region).map(row => row.rt));
    const formal = sentences.filter(row => row.valid !== false);
    return {
      metrics: [
        { label: '理解判断正确率', value: c.percent(formal.filter(row => row.correct).length, formal.length), note: '每句阅读后回答问题' },
        { label: '花园路径效应', value: effect(by('ambiguous', 'critical'), by('control', 'critical')), note: '歧义句 − 控制句：消歧词区 RT' },
        { label: '溢出效应', value: effect(by('ambiguous', 'spillover'), by('control', 'spillover')), note: '歧义句 − 控制句：溢出区词均 RT' },
        { label: '纳入区域分析的句子', value: formal.filter(row => row.correct).length, note: '排除理解错误、切窗及无效测量' },
      ],
      extraHtml: table(c, ['区域', '歧义句正确试次 RT', '控制句正确试次 RT'], Object.keys(regionLabels).map(region => [regionLabels[region], formatRT(by('ambiguous', region)), formatRT(by('control', region))])),
      explanation: '每个词的阅读时长从该词揭示后的浏览器帧回调，到下一次主动按键或点击计算；最后一个词也需要按键结束。区域均值只使用理解题正确且有效的句子。正差值与额外再分析负担相符，但本次短体验可能为零或负值，不能据此判定个人语言能力。这些中文教学句未经歧义强度和词频常模验证，控制句的提前结构提示也会影响可预测性。',
    };
  }

  T.register({
    id: 'self-paced-reading', name: '自定速度阅读与花园路径效应', chapter: '第十章', code: '10-1',
    category: '语言加工', taskType: '逐词移动窗口阅读', trialCount: 20,
    shortDescription: '逐词揭示句子，比较歧义与控制句在消歧位置及其后区域的阅读时间。',
    metrics: ['理解判断正确率', '花园路径效应', '消歧后溢出效应'],
    instructions: ['共分 2 组，每组 10 句，组间可休息；每组首句注视至少 2000 毫秒，其余句 500 毫秒，再显示遮挡模板。按空格或点击按钮揭示一个词，前一个词随即重新遮挡。', '用正常理解速度阅读；最后一个词出现后还需按一次按钮结束阅读，再回答一道理解题。请不要长按空格。', '共 20 句，歧义与无歧义控制条件各 10 句，不在同一会话重复同一内容的两个版本。理解正确的句子才进入阅读时间分析。'],
    description: '# 学习目标\n观察增量式句子理解和句法消歧如何转化为逐词阅读时长差异。\n\n# 实验任务\n20 句：歧义条件与控制条件各 10 句。20 个不同内容框架分别随机分配条件，在会话间形成材料平衡；每位学习者不重复阅读同一内容的两个版本。控制句在较早位置加入明确的因果定语提示，关键“的原因”及其后两个词保持可比。分 2 组，每组 10 句，组间可休息。每组首句注视至少 2000 ms，其余句 500 ms，随后显示下划线式遮挡，空格或屏幕按钮每次只揭示一个词，并重新遮挡前一词。每句结束后有一道随机位置的选择理解题。\n\n# 指标\n记录所有逐词 RT、词序、词语、消歧前／关键消歧／溢出区域、句子条件以及理解判断。只有理解正确且未被切窗标记失效的句子进入区域 RT。花园路径效应＝歧义句关键消歧 RT−控制句关键消歧 RT；溢出效应＝歧义句溢出区词均 RT−控制句相应 RT。首个词在第一次按键后出现，最后一个词在最后一次按键时结束，不漏计末词。\n\n# 注意\n按键移动窗口不能测量眼动或回视。中文材料为教材演示材料，没有完成独立词频、自然度及歧义强度常模验证；这里不预填显著性或预期正确率。触屏与键盘的操作时长不宜直接混合比较。\n\n# 来源\n教材定稿 10-1；Just, Carpenter & Woolley (1982), Paradigms and processes in reading comprehension；Frazier & Rayner (1982), Making and correcting errors during sentence comprehension。',
    async run(c) {
      const words = [], sentences = [];
      const trials = buildReadingTrials(c);
      for (let i = 0; i < trials.length; i += 1) {
        const item = trials[i];
        const fixationMs = await c.trialStart(i, trials.length, { blockSize: 10, label: '逐词阅读', fixationMs: 500 });
        const reading = await readMovingWindow(c, item);
        const response = await c.choose(`<h2>理解判断</h2><p>${c.escape(item.question)}</p>`, c.shuffle([{ value: 'correct', label: item.answer, key: '1' }, { value: 'foil', label: item.foil, key: '2' }]).map((option, index) => ({ ...option, key: String(index + 1), label: `${index + 1} · ${option.label}` })));
        const correct = response.value === 'correct';
        const sentence = { phase: 'formal', fixation_ms: fixationMs, sentence_id: item.id, condition: item.condition, comprehension_question: item.question, response: response.value, correct, rt: response.rt, valid: !reading.invalid, words: item.tokens.length };
        c.record(sentence);
        sentences.push(sentence);
        for (const word of reading.records) {
          word.comprehension_correct = correct;
          word.correct = correct;
          word.valid = sentence.valid !== false && !reading.invalid;
          c.record(word); words.push(word);
        }
      }
      return readingSummary(c, words, sentences);
    },
  });

  const pictures = [
    { id: 'cat', name: '猫', semantic: '狗', phonological: '帽', unrelated: '桌', svg: '<path d="M71 85L65 25L107 54Q150 35 193 54L235 25L229 85Q260 158 213 203Q150 246 87 203Q40 158 71 85Z" fill="#ddb481" stroke="#172839" stroke-width="5"/><path d="M77 67L76 44L94 58M206 58L224 44L223 67" fill="#cf8c8a"/><ellipse cx="110" cy="129" rx="10" ry="14" fill="#172839"/><ellipse cx="190" cy="129" rx="10" ry="14" fill="#172839"/><path d="M140 156H160L150 168Z" fill="#a95156"/><path d="M150 168V179M150 179Q135 193 121 178M150 179Q165 193 179 178M67 156L110 166M60 178L108 176M233 156L190 166M240 178L192 176" fill="none" stroke="#172839" stroke-width="4"/>' },
    { id: 'dog', name: '狗', semantic: '猫', phonological: '钩', unrelated: '书', svg: '<path d="M85 60Q150 30 215 60L232 145Q229 226 150 231Q71 226 68 145Z" fill="#ceaa78" stroke="#172839" stroke-width="5"/><path d="M85 63Q28 37 25 92Q28 150 67 177L94 99M215 63Q272 37 275 92Q272 150 233 177L206 99" fill="#80573d" stroke="#172839" stroke-width="5"/><ellipse cx="111" cy="121" rx="10" ry="13" fill="#172839"/><ellipse cx="189" cy="121" rx="10" ry="13" fill="#172839"/><ellipse cx="150" cy="178" rx="40" ry="30" fill="#efdcbb"/><path d="M135 159Q150 150 165 159L150 176Z" fill="#172839"/><path d="M150 176V187M150 187Q133 200 123 185M150 187Q167 200 177 185" fill="none" stroke="#172839" stroke-width="4"/>' },
    { id: 'book', name: '书', semantic: '报', phonological: '梳', unrelated: '猫', svg: '<path d="M43 66Q96 40 150 66Q204 40 257 66V214Q203 188 150 215Q97 188 43 214Z" fill="#fffdf7" stroke="#172839" stroke-width="5"/><path d="M150 66V215M32 78V226Q92 201 150 228Q208 201 268 226V78" fill="none" stroke="#1f5067" stroke-width="8"/><path d="M60 88Q99 74 133 88M60 113Q99 99 133 113M60 138Q99 124 133 138M60 163Q99 149 133 163M167 88Q201 74 240 88M167 113Q201 99 240 113M167 138Q201 124 240 138M167 163Q201 149 240 163" fill="none" stroke="#a6aaac" stroke-width="3"/>' },
  ];
  const interferenceLabels = { semantic: '语义相关', phonological: '语音相关', unrelated: '无关控制' };
  function buildPwiTrials(c) {
    return Array.from({ length: 2 }, (_, block) => c.shuffle(Array.from({ length: 2 }, () => ['semantic', 'phonological', 'unrelated'].flatMap(condition => [-100, 0].flatMap(soa => pictures.map(picture => ({ condition, soa, picture, block: block + 1 }))))).flat())).flat();
  }
  function pictureFrame(c, picture, distractor) {
    return `<div style="position:relative;width:min(100%,350px);min-height:280px;display:grid;place-items:center;margin:auto">${picture ? `<svg data-pwi-target="${picture.id}" viewBox="0 0 300 260" role="img" aria-label="需要命名的目标图片" style="width:100%;max-height:300px">${picture.svg}</svg>` : '<div style="height:280px"></div>'}<span data-pwi-word style="position:absolute;top:43%;left:50%;transform:translate(-50%,-50%);font:bold 42px/1.2 var(--serif);color:#a62927;text-shadow:0 1px #fffdf7,1px 0 #fffdf7,-1px 0 #fffdf7,0 -1px #fffdf7">${c.escape(distractor)}</span></div>`;
  }
  async function painted(c) {
    await new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('实验已退出', 'AbortError'));
      c.signal?.addEventListener('abort', abort, { once: true });
      requestAnimationFrame(() => { c.signal?.removeEventListener('abort', abort); if (c.signal?.aborted) abort(); else resolve(); });
    });
    return performance.now();
  }
  function pwiSummary(c, allRows) {
    const rows = allRows.filter(row => row.valid !== false);
    const mean = (condition, soa) => c.mean(rows.filter(row => row.condition === condition && (soa === undefined || row.soa === soa) && row.correct === true && Number.isFinite(row.rt)).map(row => row.rt));
    const metrics = [{ label: '按键图片命名正确率', value: c.percent(rows.filter(row => row.correct).length, rows.length), note: '图片出现后选择名称；不是声音触发计时' }];
    for (const soa of [-100, 0]) metrics.push(
      { label: `SOA ${soa} ms · 语义干扰`, value: effect(mean('semantic', soa), mean('unrelated', soa)), note: '语义相关 RT − 无关控制 RT' },
      { label: `SOA ${soa} ms · 语音促进`, value: effect(mean('unrelated', soa), mean('phonological', soa)), note: '无关控制 RT − 语音相关 RT' },
    );
    const cells = [-100, 0].flatMap(soa => ['semantic', 'phonological', 'unrelated'].map(condition => { const subset = rows.filter(row => row.condition === condition && row.soa === soa); return [soa + ' ms', interferenceLabels[condition], subset.length, c.percent(subset.filter(row => row.correct).length, subset.length), formatRT(mean(condition, soa))]; }));
    return { metrics, extraHtml: table(c, ['SOA', '干扰词', '有效次数', '正确率', '正确反应 RT'], cells), explanation: '结果分别在两个 SOA 下比较语义干扰和语音促进，分数只由本次正确且有效的反应计算，缺少正确反应时保留“数据不足”。本教材版采用文档允许的按键名称选择，记录图片出现至手动选择的时长，不能把它当作声学命名潜伏期，也不能用来验证口语产生阶段的精确时间顺序。本教学版重复三张原创图片，存在熟悉和重复启动影响；图片与词语未经独立常模验证，结果不保证出现经典方向。' };
  }

  T.register({
    id: 'picture-word-interference', name: '图片词汇干扰', chapter: '第十章', code: '10-2',
    category: '语言加工', taskType: '图片名称选择', trialCount: 72,
    shortDescription: '忽略图片上的文字，选择图片名称，比较语义、语音干扰及两种呈现时序。',
    metrics: ['按键命名正确率', '语义干扰效应', '语音促进效应'],
    instructions: ['先熟悉三张原创图片及名称：猫、狗、书。实验中忽略红色干扰词，尽快选择目标图片名称。', '共 72 次，分 2 组，每组 36 次，组间可休息。三种干扰词与提前 100 ms 或同时出现两种时序完整交叉；每组首试次注视至少 2000 ms。', '按 1、2、3 或点击屏幕按钮选择图片名称；具体映射在开始时显示。每次最多 1500 ms。这里记录按键选择时间，不请求麦克风或录音。'],
    description: '# 学习目标\n体验图片命名中语义竞争与语音相关性的作用，并比较干扰词领先图片与同时出现的安排。\n\n# 设计与流程\n3 种干扰词 × 2 种 SOA × 3 个目标完整交叉，每个组合 4 次，共 72 次正式试次。分 2 组，每组 36 次，组间可休息；每组每个组合 2 次，组内随机。三个目标分别为猫、狗、书，每个目标都出现在全部六个条件中。语义例为猫—狗，语音例为猫—帽、狗—钩、书—梳，无关词为跨类别词。每组首试次中央注视至少 2000 ms，其余试次 500 ms，随后空屏 200 ms。SOA −100 ms 时干扰词先出现 100 ms，再加入图片；SOA 0 ms 时二者同时出现。图片出现后有 1500 ms 选择窗口。按键映射在会话中固定，在会话间随机。\n\n# 操作与计分\n本实现采用定稿允许的“按下对应图片名称按键”方式，选择有客观对错。不会请求麦克风，也不会把手动选择时间写成声音触发的命名潜伏期。按 SOA 分别计算语义干扰（语义相关正确 RT−无关正确 RT）和语音促进（无关正确 RT−语音相关正确 RT），并输出各条件准确率。原始 CSV 保留超时、错误与切窗试次。\n\n# 时间记录\n记录设定 SOA、浏览器估计 SOA、干扰词及图片的时钟时间。浏览器帧调度和触屏操作存在误差，不能据此推断语音编码的毫秒级阶段边界。\n\n# 注意与来源\n图片为原创 SVG，中文材料为教学示例，未提供独立命名一致性、字频和语音相关强度常模。参考教材定稿 10-2；Rosinski (1977)；Levelt, Roelofs & Meyer (1999), A theory of lexical access in speech production。',
    async run(c) {
      const mapping = c.shuffle(pictures);
      await c.note(`<h2>图片与按键</h2><div style="display:flex;flex-wrap:wrap;justify-content:center;gap:15px">${mapping.map((picture, index) => `<div style="width:150px"><svg viewBox="0 0 300 260" role="img" aria-label="${c.escape(picture.name)}" style="width:140px;height:125px">${picture.svg}</svg><p>${index + 1} · ${c.escape(picture.name)}</p></div>`).join('')}</div><p>只判断图片，不判断上方的红色文字。</p>`, '已熟悉，开始实验');
      const choices = mapping.map((picture, index) => ({ value: picture.id, label: `${index + 1} · ${picture.name}`, key: String(index + 1) }));
      const trials = buildPwiTrials(c);
      for (let i = 0; i < trials.length; i += 1) {
        const trial = trials[i], distractor = trial.picture[trial.condition];
        const fixationMs = await c.trialStart(i, trials.length, { blockSize: 36, label: '图片名称选择', fixationMs: 500 });
        c.stage('<div style="min-height:280px" aria-label="空屏"></div>'); await c.wait(200);
        let distractorOnset = null;
        if (trial.soa < 0) {
          c.stage(pictureFrame(c, null, distractor));
          distractorOnset = await painted(c);
          await c.wait(100);
        }
        const renderRequested = performance.now();
        const response = await c.choose(pictureFrame(c, trial.picture, distractor), choices, { timeout: 1500 });
        const responseAt = performance.now();
        const pictureOnset = responseAt - (response.timedOut ? 1500 : response.rt);
        if (trial.soa === 0) distractorOnset = pictureOnset;
        c.record({ phase: 'formal', fixation_ms: fixationMs, block: trial.block, condition: trial.condition, soa: trial.soa, target: trial.picture.id, target_name: trial.picture.name, distractor, response: response.value, expected: trial.picture.id, correct: response.value === trial.picture.id, rt: response.timedOut ? null : response.rt, timed_out: response.timedOut, response_mode: 'manual_picture_name_choice', key_mapping: mapping.map((picture, index) => `${index + 1}=${picture.name}`).join(';'), distractor_onset_ms: distractorOnset, picture_onset_estimate_ms: pictureOnset, picture_render_requested_ms: renderRequested, measured_soa_estimate_ms: distractorOnset - pictureOnset, onset_method: 'browser response timestamp minus manual RT; no voice trigger', response_window_ms: 1500 });
      }
      return pwiSummary(c, c.rows);
    },
  });

  T.languageChecks = { sentenceFrames, buildReadingTrials, readMovingWindow, readingSummary, pictures, buildPwiTrials, pwiSummary };
})(window.Textbook);

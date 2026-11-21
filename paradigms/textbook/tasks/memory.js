(function registerMemoryTasks() {
  "use strict";
  const T = window.Textbook;
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const mean = (values) => { const usable = values.filter((n) => n !== null && n !== undefined && Number.isFinite(Number(n))).map(Number); return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null; };
  const format = (value, unit = "", decimals = 1) => value === null || !Number.isFinite(value) ? "数据不足" : `${value.toFixed(decimals)}${unit}`;
  const rate = (rows, predicate = (r) => r.correct) => rows.length ? rows.filter(predicate).length / rows.length : null;
  const pct = (value) => format(value === null ? null : value * 100, "%");
  const yesNo = [{ value: "yes", label: "是", key: "y" }, { value: "no", label: "否", key: "n" }];
  const validRows = (ctx, phase) => ctx.rows.filter((r) => r.phase === phase && r.valid !== false);
  const panel = (title, text = "") => `<h2>${esc(title)}</h2><p>${esc(text)}</p>`;
  const table = (headers, rows) => `<div class="table-scroll"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const normalize = (value) => String(value ?? "").normalize("NFKC").replace(/[\s，,。.!！?？、;；:：-]/g, "").toLowerCase();
  const scoreWord = (value, expected) => normalize(value) === normalize(expected);

  T.register({
    id: "sperling", name: "Sperling 部分报告法", chapter: "第四章", code: "4-1", category: "感觉记忆", taskType: "全部与部分报告", trialCount: 20,
    shortDescription: "短暂观察字母矩阵，比较全部报告、即时提示及延迟提示下可报告的信息量。",
    instructions: ["先确认能看清屏幕中的大写英文字母。每次矩阵只呈现 50 毫秒。", "全部报告时按从上到下、从左到右输入 12 个字母；部分报告时只输入箭头所指一行的 4 个字母。不确定的位置输入 ?。", "高、中、低提示音分别指向上、中、下行，屏幕也会显示对应行提示。提示可延迟 0、300 或 1000 毫秒。"],
    description: "# Sperling 部分报告法\n\n## 学习目标\n体验图像记忆在刺激消失后的短暂保持，以及提取线索延迟对报告的影响。\n\n## 实验流程\n20 个试次随机混合：全部报告、部分报告即时提示、提示延迟 300 毫秒、提示延迟 1000 毫秒，各 5 次。注视点后呈现 3×4 字母矩阵 50 毫秒。部分报告在指定延迟后给出高、中、低音和视觉行线索。\n\n## 操作\n按行从左到右输入。全部报告为 12 个位置，部分报告为 4 个位置；忘记的位置用 ? 占位。若听不到提示音，使用相同时间出现的视觉行提示。\n\n## 指标与解释\n全部报告计算平均正确字母数。部分报告先计算正确报告的行内字母数，再乘 3 估计可用信息量，不能直接将部分报告的原始 4 字母成绩与全部报告的 12 字母成绩比较。50 毫秒由浏览器帧调度近似呈现，不同刷新率会带来时间偏差。\n\n## 来源\nSperling (1960), The information available in brief visual presentations. 教学程序为独立编写的缩短版。",
    async run(ctx) {
      const conditions = ctx.shuffle(["whole", "partial-0", "partial-300", "partial-1000"].flatMap((condition) => Array.from({ length: 5 }, () => condition)));
      const letters = "BCDFGHJKLMNPRSTVWXYZ".split("");
      for (let i = 0; i < conditions.length; i += 1) {
        ctx.progress(i + 1, 20, "字母报告");
        const condition = conditions[i], partial = condition !== "whole";
        const selectedRow = Math.floor(Math.random() * 3);
        const matrix = ctx.shuffle(letters).slice(0, 12);
        await ctx.fixation(500);
        ctx.stage(`<div aria-label="字母矩阵" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:360px;margin:25px auto;font:32px monospace;text-align:center">${matrix.map((letter) => `<span>${letter}</span>`).join("")}</div>`);
        await ctx.wait(50);
        ctx.stage('<div style="min-height:190px" aria-label="空屏"></div>');
        const cueDelay = partial ? Number(condition.split("-")[1]) : 0;
        if (cueDelay) await ctx.wait(cueDelay);
        if (partial) ctx.tone([1300, 800, 400][selectedRow], 180);
        const expected = partial ? matrix.slice(selectedRow * 4, selectedRow * 4 + 4).join("") : matrix.join("");
        const response = await ctx.input(panel(partial ? `${["↑ 上", "→ 中", "↓ 下"][selectedRow]}行 · 请报告 4 个字母` : "全部报告 · 请报告 12 个字母", "从左到右；遗忘位置用 ?。") + `<p>本次类型：${partial ? `部分报告（提示延迟 ${cueDelay} 毫秒）` : "全部报告"}</p>`, {
          label: partial ? "4 个字母或问号" : "12 个字母或问号", placeholder: partial ? "例如 A?CD" : "例如 AB?D?FGHI?KL", minLength: 1,
          validate: (value) => new RegExp(`^[a-zA-Z?？\\s]{${partial ? 4 : 12},}$`).test(value.trim()) && value.replace(/\s/g, "").length === expected.length ? true : `请填写 ${expected.length} 个位置；遗忘处填写 ?`,
        });
        const answer = response.value.replace(/\s/g, "").toUpperCase();
        const lettersCorrect = [...expected].filter((letter, index) => answer[index] === letter).length;
        ctx.record({ phase: "report", condition, cueDelay, cueRow: partial ? selectedRow + 1 : null, matrix: matrix.join(""), expected, response: answer, lettersCorrect, possibleLetters: expected.length, correct: lettersCorrect === expected.length, rt: response.rt });
      }
      const rows = validRows(ctx, "report");
      const summaries = ["whole", "partial-0", "partial-300", "partial-1000"].map((condition) => {
        const data = rows.filter((r) => r.condition === condition), raw = mean(data.map((r) => r.lettersCorrect));
        return { condition, raw, estimate: raw === null ? null : raw * (condition === "whole" ? 1 : 3) };
      });
      return { metrics: summaries.map((s, index) => ({ label: ["全部报告", "即时部分报告估计", "延迟 300 ms 估计", "延迟 1000 ms 估计"][index], value: format(s.estimate, " / 12"), note: index ? `行内正确字母均值 ${format(s.raw)} × 3` : "平均正确字母数" })), explanation: "部分报告的估计值乘以 3 后才与全部报告比较。短时延迟下的差异可用于讨论图像记忆；单次少量试次不保证出现经典效应。提示音与视觉线索是冗余提示。" };
    },
  });

  const palette = ["#e53935", "#1976d2", "#ffeb00", "#25a84a", "#111111", "#ffffff", "#9b3d81", "#ed7d16", "#795548"];
  const positions = [[75, 90], [140, 90], [205, 90], [75, 165], [140, 165], [205, 165], [75, 240], [140, 240], [205, 240]];
  function memoryArray(left, right) {
    const square = (point, index, offset, colors) => `<rect x="${point[0] + offset}" y="${point[1]}" width="26" height="26" fill="${colors[index]}" />`;
    return `<svg role="img" aria-label="左右两侧颜色方块阵列" viewBox="0 0 600 340" style="width:100%;max-width:650px;background:#aaa;border:5px solid #28221f">${positions.slice(0, left.length).map((p, i) => square(p, i, 0, left)).join("")}${positions.slice(0, right.length).map((p, i) => square(p, i, 290, right)).join("")}<text x="300" y="186" text-anchor="middle" font-size="25" fill="#222">+</text></svg>`;
  }
  T.register({
    id: "change-detection", name: "视觉工作记忆变化检测", chapter: "第四章", code: "4-2", category: "工作记忆", taskType: "颜色变化检测", trialCount: 20,
    shortDescription: "记住箭头指定一侧的颜色阵列，观察 4、6、9 个方块负荷对变化检测的影响。",
    instructions: ["箭头指向需要记住的一侧，只判断该侧颜色有没有改变。", "箭头与注视点 200 ms；记忆阵列 100 ms；保持间隔 900 ms；测试阵列最多 2000 ms。", "按 Y / 点击“有变化”，按 N / 点击“无变化”。共 20 次，其中恰好一半发生颜色变化。"],
    description: "# 视觉工作记忆变化检测\n\n## 学习目标\n理解视觉工作记忆的编码、保持与比较过程，观察负荷对行为成绩的影响。\n\n## 流程与数量\n严格采用教材流程图：中央注视点与左右箭头线索 200 毫秒；双侧颜色记忆阵列 100 毫秒；仅保留注视点的 900 毫秒间隔；测试阵列呈现并允许反应 2000 毫秒。目标侧负荷为 4、6、9 个方块，分别 6、6、8 个试次。总 20 次，10 次变化、10 次不变，每个负荷内变化各占 50%。\n\n## 操作\n只记忆箭头指示的一侧。改变试次仅改变目标侧的一个颜色。目标侧与反应方式随机平衡。手机使用屏幕按钮。\n\n## 指标\n各负荷的正确率、正确反应时、命中率和虚报率。容量估计 K = N ×（命中率 − 虚报率），不把负 K 强行改成零。缺少任一条件时显示数据不足。\n\n## 注意\n短版仅用于教学。实际呈现受显示刷新率影响；切换窗口会使试次失效。\n\n## 来源\nLuck & Vogel (1997); Cowan (2001)。按教材要求重新编写。",
    async run(ctx) {
      const trials = ctx.shuffle([4, 6, 9].flatMap((load) => Array.from({ length: load === 9 ? 8 : 6 }, (_, index) => ({ load, changed: index % 2 === 0, side: index % 4 < 2 ? "left" : "right" }))));
      for (let i = 0; i < trials.length; i += 1) {
        ctx.progress(i + 1, 20, "变化检测");
        const { load, changed, side } = trials[i];
        const left = ctx.shuffle(palette).slice(0, load), right = ctx.shuffle(palette).slice(0, load);
        const changedIndex = Math.floor(Math.random() * load);
        const probeLeft = [...left], probeRight = [...right], selected = side === "left" ? probeLeft : probeRight;
        if (changed) selected[changedIndex] = ctx.shuffle(palette.filter((color) => color !== selected[changedIndex]))[0];
        ctx.stage(`<div style="min-height:250px;display:grid;place-content:center;font-size:40px;text-align:center" aria-label="注意${side === "left" ? "左" : "右"}侧"><span>${side === "left" ? "←" : "→"}</span><span>+</span></div>`);
        await ctx.wait(200);
        ctx.stage(memoryArray(left, right));
        await ctx.wait(100);
        ctx.stage('<div style="min-height:250px;display:grid;place-content:center;font-size:30px" aria-label="保持间隔">+</div>');
        await ctx.wait(900);
        const response = await ctx.choose(memoryArray(probeLeft, probeRight) + `<p>箭头指定的一侧有颜色变化吗？</p>`, [{ value: "changed", label: "有变化", key: "y" }, { value: "same", label: "无变化", key: "n" }], { timeout: 2000 });
        ctx.record({ phase: "test", condition: String(load), load, side, changed, changedIndex: changed ? changedIndex : null, response: response.value, correct: response.value === (changed ? "changed" : "same"), rt: response.timedOut ? null : response.rt, timeout: response.timedOut });
        await ctx.wait(250);
      }
      const rows = validRows(ctx, "test");
      const data = [4, 6, 9].map((load) => {
        const selected = rows.filter((r) => r.load === load), hit = rate(selected.filter((r) => r.changed), (r) => r.response === "changed"), fa = rate(selected.filter((r) => !r.changed), (r) => r.response === "changed");
        return { load, count: selected.length, accuracy: rate(selected), rt: mean(selected.filter((r) => r.correct).map((r) => r.rt)), hit, fa, capacity: hit === null || fa === null ? null : load * (hit - fa) };
      });
      return { metrics: data.map((d) => ({ label: `负荷 ${d.load} · 容量 K`, value: format(d.capacity), note: `正确率 ${pct(d.accuracy)} · ${d.count} 个有效试次` })), extraHtml: table(["负荷", "正确率", "正确 RT", "命中率", "虚报率"], data.map((d) => [d.load, pct(d.accuracy), format(d.rt, " ms", 0), pct(d.hit), pct(d.fa)])), explanation: "容量按 K=N×(命中率−虚报率)计算。每个负荷的试次较少，估计会波动，不能据此评价个人工作记忆能力。超时按错误保留，正确反应时只纳入有效且正确的试次。" };
    },
  });

  const adjectives = {
    positive: ["诚实", "勇敢", "热情", "耐心", "友善", "勤奋", "宽容", "乐观", "细心", "可靠", "谦虚", "真诚", "机智", "温柔", "独立"],
    negative: ["懒惰", "自私", "急躁", "冷漠", "固执", "粗心", "虚伪", "傲慢", "胆怯", "消极", "吝啬", "暴躁", "嫉妒", "浮躁", "偏执"],
  };
  async function arithmeticFiller(ctx, seconds, phase) {
    let current = 403;
    for (let tick = 0; tick < seconds; tick += 1) {
      const answer = current - 3;
      const options = ctx.shuffle([answer, answer + 1, answer - 1]).map((n) => ({ value: String(n), label: String(n) }));
      const response = await ctx.choose(panel(`倒数任务 · 剩余 ${seconds - tick} 秒`, `从 ${current} 减去 3，选择结果。`), options, { timeout: 1000 });
      ctx.record({ phase, condition: "subtract-three", expected: answer, response: response.value, correct: Number(response.value) === answer && !response.timedOut, rt: response.timedOut ? null : response.rt });
      await ctx.wait(Math.max(0, 1000 - (response.rt || 1000)));
      current = answer;
    }
  }
  T.register({
    id: "self-reference", name: "自我参照效应", chapter: "第五章", code: "5-1", category: "记忆", taskType: "编码与再认", trialCount: "学习 20 词；测验 30 词",
    shortDescription: "比较自我参照和常用词判断后的记得、熟悉及来源记忆。",
    instructions: ["学习时按提示判断“适合描述我吗”或“日常语言中常用吗”。每个词呈现满 3 秒，请在时限内选是或否。", "两种编码任务各 10 个形容词，积极与消极词数量相等；之后做 30 秒倒数任务。", "再认时选择“记得”“熟悉”或“新词”。记得指能回想学习情境，熟悉指有旧感但想不起情境；判断为学过时还需判断学习任务。"],
    description: "# 自我参照效应\n\n## 学习目标\n比较自我参照编码和词语常用性编码后的记忆表现。\n\n## 流程\n两种判断各学习 10 个形容词，每个判断内积极、消极各 5 词，每词 3 秒。材料分配与任务块顺序在每次会话随机平衡。之后进行 30 秒减 3 倒数任务。再认测验混合 20 个旧词和 10 个新词，共 30 题；判断为记得或熟悉后继续作来源判断。\n\n## 操作与指标\n编码时的“是／否”没有客观对错。再认中记得、熟悉均计为判断学过；分别报告两种编码下的总体再认率、记得比例、新词虚报率与来源判断正确率。来源正确率的分母为判断学过的旧词。\n\n## 解释\n比较两种编码的记忆比例，不预设每次都会出现自我参照优势。积极或消极词只是实验材料，不对参与者作性格判断。\n\n## 来源\nRogers, Kuiper & Kirker (1977); Leshikar et al. (2015)，按教材缩短并改编为中文。",
    async run(ctx) {
      const positive = ctx.shuffle(adjectives.positive), negative = ctx.shuffle(adjectives.negative);
      const assigned = ["self", "common"].flatMap((encoding, index) => [positive, negative].flatMap((pool, valenceIndex) => pool.slice(index * 5, index * 5 + 5).map((word) => ({ word, encoding, valence: valenceIndex ? "negative" : "positive" }))));
      const order = ctx.shuffle(["self", "common"]);
      const study = order.flatMap((encoding) => ctx.shuffle(assigned.filter((word) => word.encoding === encoding)));
      for (let i = 0; i < study.length; i += 1) {
        const item = study[i];
        ctx.progress(i + 1, 20, "编码学习");
        const response = await ctx.choose(`<p>${item.encoding === "self" ? "这个词适合描述我吗？" : "这个词在日常语言中常用吗？"}</p><div style="font-size:52px;margin:35px 0">${esc(item.word)}</div>`, yesNo, { timeout: 3000 });
        await ctx.wait(Math.max(0, 3000 - (response.rt || 3000)));
        ctx.record({ phase: "study", condition: item.encoding, ...item, taskOrder: order.join(","), response: response.value, correct: null, rt: response.timedOut ? null : response.rt, timeout: response.timedOut });
      }
      await arithmeticFiller(ctx, 30, "filler");
      await ctx.note(panel("词语再认", "请根据自己的体验作答。记得：能回想当时情境；熟悉：觉得见过但想不起细节；新词：认为没有学过。"), "开始再认");
      const newWords = [...positive.slice(10), ...negative.slice(10)].map((word) => ({ word, encoding: "new", valence: adjectives.positive.includes(word) ? "positive" : "negative" }));
      const test = ctx.shuffle([...assigned, ...newWords]);
      for (let i = 0; i < test.length; i += 1) {
        const item = test[i];
        ctx.progress(i + 1, 30, "记忆测验");
        const recognition = await ctx.choose(`<div style="font-size:46px;margin:40px 0">${esc(item.word)}</div>`, [{ value: "remember", label: "记得", key: "r" }, { value: "familiar", label: "熟悉", key: "f" }, { value: "new", label: "新词", key: "n" }]);
        let source = null;
        if (recognition.value !== "new") source = await ctx.choose(panel("学习时做的是哪种判断？", item.word), [{ value: "self", label: "适合描述我", key: "1" }, { value: "common", label: "日常语言常用", key: "2" }]);
        const old = item.encoding !== "new", recognized = recognition.value !== "new";
        ctx.record({ phase: "recognition", condition: item.encoding, ...item, old, response: recognition.value, recognized, source: source?.value || "", sourceCorrect: old && recognized ? source?.value === item.encoding : null, correct: old === recognized, rt: recognition.rt, sourceRt: source?.rt || null });
      }
      const data = validRows(ctx, "recognition"), self = data.filter((r) => r.encoding === "self"), common = data.filter((r) => r.encoding === "common"), lures = data.filter((r) => !r.old), sourceRows = data.filter((r) => r.old && r.recognized);
      return { metrics: [{ label: "自我参照 · 总体再认", value: pct(rate(self, (r) => r.recognized)), note: `记得 ${pct(rate(self, (r) => r.response === "remember"))}` }, { label: "常用词判断 · 总体再认", value: pct(rate(common, (r) => r.recognized)), note: `记得 ${pct(rate(common, (r) => r.response === "remember"))}` }, { label: "新词虚报率", value: pct(rate(lures, (r) => r.recognized)), note: "新词被判为记得或熟悉" }, { label: "来源记忆正确率", value: pct(rate(sourceRows, (r) => r.sourceCorrect)), note: "判断学过的旧词" }], explanation: "总体再认包括“记得”和“熟悉”。比较两类编码条件的差异时，同时观察新词虚报率。材料较少且顺序随机，未出现自我参照优势也是可能的真实结果。编码时的描述判断没有性格评价含义。" };
    },
  });

  T.register({
    id: "semantic-priming", name: "语义启动词汇判断", chapter: "第五章", code: "5-2", category: "语言加工", taskType: "词汇判断", trialCount: 20,
    shortDescription: "在语义相关、无关与中性启动后判断真词或伪词，比较正确反应时。",
    instructions: ["先出现启动词，再出现目标。只判断目标是否为本任务说明的常用双字词。", "使用 F 和 J 键，具体真词／伪词映射在开始时说明，手机点击相同标签按钮。每次会话随机平衡按键映射。", "共 20 次：10 个真词和 10 个伪词。结果比较真词的相关、无关、中性启动条件，仅纳入 200–2000 ms 的正确反应。"],
    description: "# 语义启动词汇判断\n\n## 学习目标\n体验语义相关启动词是否改变目标词的判断速度，理解激活扩散模型如何连接到反应时差异。\n\n## 设计\n共 20 次，10 个真词与 10 个伪词。真词中相关、无关、中性启动分别 4、3、3 次，另有 10 次伪词填充。真词和伪词均为双字材料，顺序随机；按键映射在每次会话随机反转。相关词对与无关配对由同一组常见启动材料打乱产生，避免条件完全使用不同来源的词。中性启动用“□□”。\n\n## 流程\n注视 500 毫秒，启动词 200 毫秒，空屏 50 毫秒，目标最长 2000 毫秒。手机点按与电脑按键等效。\n\n## 指标\n各条件准确率与正确反应时。200 毫秒以下、2000 毫秒以上、错误和离开窗口试次不进入反应时均值；同时保留原始行和排除标记。无关减相关的正差值可作为本次启动效应。\n\n## 注意\n这些常用词与按明确规则构成的伪词用于教学，没有进行独立大样本词频和熟悉度常模验证。反应时优势必须结合准确率解释。\n\n## 来源\nMeyer & Schvaneveldt (1971), Facilitation in recognizing pairs of words。",
    async run(ctx) {
      const pairs = ctx.shuffle([["医生", "护士"], ["老师", "学生"], ["太阳", "月亮"], ["苹果", "香蕉"], ["火车", "汽车"], ["桌子", "椅子"], ["猫咪", "小狗"], ["冬天", "夏天"], ["白天", "黑夜"], ["钢笔", "铅笔"]]);
      const map = Math.random() < 0.5 ? { word: "f", nonword: "j" } : { word: "j", nonword: "f" };
      await ctx.note(panel("本次按键", `真词：${map.word.toUpperCase()}；伪词：${map.nonword.toUpperCase()}。手机点击对应的标签按钮。`));
      const nonwords = ["师蕉", "汽笔", "护椅", "冬铅", "月医", "蕉铁", "椅护", "夏桌", "狗汽", "笔猫"];
      const trials = ctx.shuffle([...pairs.map(([prime, target], index) => ({ lexicality: "word", condition: index < 4 ? "related" : index < 7 ? "unrelated" : "neutral", target, prime: index < 4 ? prime : index < 7 ? pairs[(index + 3) % pairs.length][0] : "□□" })), ...nonwords.map((target, index) => ({ lexicality: "nonword", condition: "nonword-filler", prime: index % 3 === 0 ? "□□" : pairs[index][0], target }))]);
      const options = [{ value: "word", label: `真词（${map.word.toUpperCase()}）`, key: map.word }, { value: "nonword", label: `伪词（${map.nonword.toUpperCase()}）`, key: map.nonword }];
      for (let i = 0; i < trials.length; i += 1) {
        ctx.progress(i + 1, 20, "词汇判断");
        const trial = trials[i];
        await ctx.fixation(500);
        ctx.stage(`<div style="font-size:42px;margin:40px">${esc(trial.prime)}</div>`);
        await ctx.wait(200);
        ctx.stage('<div style="height:145px"></div>');
        await ctx.wait(50);
        const response = await ctx.choose(`<div style="font-size:48px;margin:40px">${esc(trial.target)}</div>`, options, { timeout: 2000 });
        const correct = response.value === trial.lexicality;
        ctx.record({ phase: "lexical", ...trial, response: response.value, correct, rt: response.timedOut ? null : response.rt, rtIncluded: correct && !response.timedOut && response.rt >= 200 && response.rt <= 2000, keyMapping: `${map.word}=word;${map.nonword}=nonword` });
      }
      const rows = validRows(ctx, "lexical"), labels = { related: "相关启动", unrelated: "无关启动", neutral: "中性启动" };
      const summaries = ["related", "unrelated", "neutral"].map((condition) => { const data = rows.filter((r) => r.condition === condition); return { condition, accuracy: rate(data), rt: mean(data.filter((r) => r.rtIncluded).map((r) => r.rt)) }; });
      const related = summaries[0].rt, unrelated = summaries[1].rt;
      return { metrics: [...summaries.map((s) => ({ label: labels[s.condition], value: format(s.rt, " ms", 0), note: `正确率 ${pct(s.accuracy)}` })), { label: "语义启动效应", value: format(related === null || unrelated === null ? null : unrelated - related, " ms", 0), note: "无关条件 RT − 相关条件 RT" }], explanation: "只比较真词的三个启动条件；伪词是词汇判断所需填充试次。反应时只使用正确且 200–2000 ms 的有效试次。少量材料可能不产生经典优势，须同时检查速度与准确率权衡。" };
    },
  });

  const locationOptions = [{ value: "0", label: "左上", key: "1" }, { value: "1", label: "右上", key: "2" }, { value: "2", label: "左下", key: "3" }, { value: "3", label: "右下", key: "4" }];
  const locationNames = ["左上", "右上", "左下", "右下"];
  function pairedShape(item, location = null) {
    const shapes = ["circle", "triangle", "square", "diamond", "cross"];
    const shape = shapes[item.index % 5], color = palette[Math.floor(item.index / 5) % 4];
    const geometry = shape === "circle" ? '<circle cx="65" cy="65" r="35" />' : shape === "triangle" ? '<path d="M65 22 L108 102 L22 102 Z" />' : shape === "square" ? '<rect x="28" y="28" width="74" height="74" />' : shape === "diamond" ? '<path d="M65 18 L112 65 L65 112 L18 65 Z" />' : '<path d="M50 20 H80 V50 H110 V80 H80 V110 H50 V80 H20 V50 H50 Z" />';
    return `<svg aria-label="记忆图形 ${item.index + 1}" role="img" viewBox="0 0 130 130" style="width:115px;height:115px;fill:${color};margin:20px">${geometry}</svg>${location === null ? "" : `<p style="font-size:30px">位置：${locationNames[location]}</p>`}`;
  }
  T.register({
    id: "reconsolidation", name: "记忆提醒与干扰更新", chapter: "第五章", code: "5-3", category: "记忆", taskType: "配对学习与干扰", trialCount: "原配对 20 组；原记忆测验 20 题",
    shortDescription: "随机进入提醒与干扰的一个组别，在相同流程时长下观察原配对与新位置的混淆。",
    instructions: ["学习 20 个图形和四个空间位置的配对，达到 80% 正确后进入后续阶段；最多三轮，未达到标准会停止并如实说明。", "系统随机分配提醒后干扰、不提醒而干扰、提醒不干扰三个组之一，每次只体验一个组。", "最后按要求报告最初位置；干扰组另测新位置。此短版展示实验逻辑，不声称短时间内验证了生物学再巩固。"],
    description: "# 记忆提醒与干扰更新\n\n## 学习目标\n体验三组平行实验中提醒与新配对学习的区别，观察原配对正确率和新位置侵入。\n\n## 分组与学习\n每次会话随机进入提醒后学习新位置、不提醒而学习新位置、提醒但无新配对学习三组之一。三组不是同一人依次经历的三个阶段。先学习 20 个图形与位置 A 的配对，以 80% 正确为标准，最多三轮；未达标则停止，不混入后续正式结果。\n\n## 后续流程\n提醒组用少量旧图形激活原配对；无提醒组完成等时长数字任务。干扰组学习相同图形与不同位置 B，控制组完成等时长填充任务。提醒阶段、活动阶段与最终延迟在各组相同。之后测试 20 个原配对，干扰组另测新配对。\n\n## 指标\n初始学习正确率、原位置保持正确率、把原位置误报为 B 的侵入比例，以及干扰组新位置学习正确率。无干扰组没有学习 B，不报告“新配对学习率”。原位置测试在新位置测试之前。\n\n## 解释边界\n程序压缩了真实研究的时间间隔，只是待检验方案的教学演示。没有同一课堂三组数据时，不生成虚构组均值，也不声称证明旧记忆被删除。机制研究还需延迟干扰与恢复检验等条件。\n\n## 来源\n按本教材记忆再巩固教学方案编写；设计解释参考 Hupbach et al. (2007)。",
    async run(ctx) {
      const group = ctx.shuffle(["reminder-interference", "no-reminder-interference", "reminder-control"])[0];
      const pairs = ctx.shuffle(Array.from({ length: 20 }, (_, index) => { const original = index % 4; return { index, original, updated: (original + 1 + Math.floor(Math.random() * 3)) % 4 }; }));
      let mastered = false, lastAccuracy = 0, attempts = 0;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        attempts = attempt;
        await ctx.note(panel(`配对学习 · 第 ${attempt} 轮`, "请记住图形最初的位置。学习后需达到 80% 才能继续。"));
        for (let i = 0; i < pairs.length; i += 1) { ctx.progress(i + 1, 20, `学习 ${attempt}`); ctx.stage(pairedShape(pairs[i], pairs[i].original)); await ctx.wait(1500); }
        const checks = [];
        for (const item of ctx.shuffle(pairs)) {
          const response = await ctx.choose(pairedShape(item) + '<p>这个图形最初出现在哪个位置？</p>', locationOptions);
          const correct = Number(response.value) === item.original;
          checks.push(correct);
          ctx.record({ phase: "criterion", condition: group, attempt, shape: item.index, original: item.original, response: response.value, correct, rt: response.rt });
        }
        lastAccuracy = checks.filter(Boolean).length / checks.length;
        if (lastAccuracy >= .8) { mastered = true; break; }
        await ctx.note(panel("学习检查", `本轮正确率 ${pct(lastAccuracy)}，尚未达到 80%。${attempt < 3 ? "下一轮重新学习。" : "本次停止，避免把未学会的原配对当作遗忘。"}`));
      }
      if (!mastered) return { metrics: [{ label: "初始学习正确率", value: pct(lastAccuracy), note: `${attempts} 轮后未达到 80% 标准` }], explanation: "本次没有进入提醒与干扰阶段，也没有生成遗忘或更新效果。可以重新开始，学习稳定后再体验。" };
      const reminder = group !== "no-reminder-interference", interference = group !== "reminder-control";
      await ctx.note(panel("活动阶段", "请按接下来屏幕的要求完成。"));
      for (let i = 0; i < 4; i += 1) {
        const item = pairs[i], prompt = reminder ? pairedShape(item) + '<p>回想这个图形最初的位置。</p>' : panel("数字判断", `${17 + i} 是奇数吗？`);
        const response = await ctx.choose(prompt, reminder ? locationOptions : yesNo, { timeout: 1500 });
        ctx.record({ phase: "reminder", condition: group, shape: reminder ? item.index : null, response: response.value, correct: reminder ? Number(response.value) === item.original : response.value === ((17 + i) % 2 ? "yes" : "no"), rt: response.timedOut ? null : response.rt });
        await ctx.wait(Math.max(0, 1500 - (response.rt || 1500)));
      }
      for (let i = 0; i < pairs.length; i += 1) {
        const item = pairs[i];
        ctx.progress(i + 1, 20, "后续活动");
        if (interference) { ctx.stage(pairedShape(item, item.updated) + '<p>请学习这一次的位置。</p>'); await ctx.wait(1500); ctx.record({ phase: "interference-study", condition: group, shape: item.index, original: item.original, updated: item.updated, correct: null, rt: null }); }
        else { const value = 23 + i; const response = await ctx.choose(panel("填充任务", `${value} 是奇数吗？`), yesNo, { timeout: 1500 }); ctx.record({ phase: "control-filler", condition: group, expected: value % 2 ? "yes" : "no", response: response.value, correct: response.value === (value % 2 ? "yes" : "no"), rt: response.timedOut ? null : response.rt }); await ctx.wait(Math.max(0, 1500 - (response.rt || 1500))); }
      }
      for (let tick = 5; tick > 0; tick -= 1) { ctx.stage(panel("保持间隔", `${tick} 秒后进入原配对测验。`)); await ctx.wait(1000); }
      const originalTest = ctx.shuffle(pairs);
      for (let i = 0; i < originalTest.length; i += 1) {
        const item = originalTest[i];
        ctx.progress(i + 1, 20, "最初位置测验");
        const response = await ctx.choose(pairedShape(item) + '<p>请选择最初学习的位置 A。</p>', locationOptions);
        ctx.record({ phase: "original-test", condition: group, shape: item.index, original: item.original, updated: interference ? item.updated : null, response: response.value, correct: Number(response.value) === item.original, intrusion: interference && Number(response.value) === item.updated, rt: response.rt });
      }
      if (interference) {
        await ctx.note(panel("新位置测验", "这次请选择后续活动中学习的新位置 B。"));
        for (const item of ctx.shuffle(pairs)) {
          const response = await ctx.choose(pairedShape(item) + '<p>请选择后续学习的新位置 B。</p>', locationOptions);
          ctx.record({ phase: "updated-test", condition: group, shape: item.index, expected: item.updated, response: response.value, correct: Number(response.value) === item.updated, rt: response.rt });
        }
      }
      const original = validRows(ctx, "original-test"), updated = validRows(ctx, "updated-test"), groupLabel = { "reminder-interference": "提醒后干扰", "no-reminder-interference": "不提醒而干扰", "reminder-control": "提醒但不干扰" }[group];
      const metrics = [{ label: "本次随机组别", value: groupLabel, note: "被试间设计，仅经历一个组" }, { label: "最初配对正确率", value: pct(rate(original)), note: `初始学习 ${pct(lastAccuracy)}，第 ${attempts} 轮达标` }];
      if (interference) metrics.push({ label: "新位置侵入率", value: pct(rate(original, (r) => r.intrusion)), note: "将最初位置误报为后学位置 B" }, { label: "新配对正确率", value: pct(rate(updated)), note: "新位置 B 的独立测验" });
      return { metrics, explanation: "这是三个平行组中的一次体验，不能用一个人的结果估计提醒与干扰的因果作用。图形、活动次数和时长在各组匹配，但时间被压缩，不能证明真实再巩固、旧记忆删除或临床效应。" };
    },
  });

  T.register({
    id: "retrieval-forgetting", name: "提取诱发遗忘", chapter: "第六章", code: "6-2", category: "记忆", taskType: "类别线索回忆", trialCount: "学习 20 项；最终测验 20 题",
    shortDescription: "学习类别词表，练习提取部分项目，再比较 RP+、RP− 与未练习类别的回忆。",
    instructions: ["学习 4 个类别，每类 5 个词，共 20 项。", "练习时根据“类别＋首字”补全词语，只练习半数类别中的部分项目，重复三轮。", "最终按类别线索输入学过的词，忘记可留空直接提交。正式测验不提示正确答案；最后比较三类项目。"],
    description: "# 提取诱发遗忘\n\n## 学习目标\n理解练习提取部分项目如何可能影响同类别的其他项目，区分 RP+、RP− 与 NPP。\n\n## 流程\n学习 4 类各 5 项，共 20 个类别—样例配对。随机选择两个类别，各练习 2 或 3 项，总练习 5 项，重复 3 轮。最终对全部 20 项进行类别加首字线索回忆。练习类别中提取过的项目为 RP+；同类未练习为 RP−；另外两类为 NPP 基线。类别与项目随机分配。\n\n## 控制\n最终测验先随机呈现 RP− 和 NPP，再测 RP+，减少强项目先输出造成的干扰。此安排减轻输出干扰，不能完全排除强度竞争等替代解释。测验不即时显示答案。材料为常见中文双字词。\n\n## 指标\n分别计算 RP+、RP−、NPP 回忆正确率。提取诱发遗忘差值为 NPP−RP−；该差值可能为正、零或负，不能预填 RP+ > NPP > RP−。\n\n## 解释\n提取抑制理论认为，检索目标时抑制相关竞争项目，可能使未练习项目稍后更难提取。缩短演示不是抑制机制的充分证明。\n\n## 来源\nAnderson, Bjork & Bjork (1994), Remembering can cause forgetting。",
    async run(ctx) {
      const categories = ctx.shuffle([
        { category: "水果", words: ["苹果", "香蕉", "橘子", "葡萄", "草莓"] },
        { category: "动物", words: ["老虎", "猴子", "大象", "熊猫", "兔子"] },
        { category: "工具", words: ["锤子", "剪刀", "钳子", "锯子", "扳手"] },
        { category: "蔬菜", words: ["白菜", "萝卜", "黄瓜", "茄子", "土豆"] },
      ]);
      const items = categories.flatMap((category, index) => ctx.shuffle(category.words).map((word, rank) => ({ category: category.category, word, condition: index < 2 ? rank < (index === 0 ? 3 : 2) ? "RP+" : "RP-" : "NPP" })));
      const study = ctx.shuffle(items);
      for (let i = 0; i < study.length; i += 1) { ctx.progress(i + 1, 20, "学习类别词表"); ctx.stage(panel(study[i].category, study[i].word)); await ctx.wait(2000); ctx.record({ phase: "study", ...study[i], correct: null, rt: null }); }
      const practice = items.filter((item) => item.condition === "RP+");
      for (let repetition = 1; repetition <= 3; repetition += 1) {
        for (const item of ctx.shuffle(practice)) {
          const response = await ctx.input(panel(`提取练习 · 第 ${repetition} 轮`, `${item.category} — ${item.word[0]}＿`), { label: "请输入完整词语（忘记可留空）", minLength: 0 });
          const correct = scoreWord(response.value, item.word);
          ctx.record({ phase: "practice", ...item, repetition, response: response.value, correct, rt: response.rt });
          await ctx.note(panel(correct ? "提取正确" : "参考词语", item.word));
        }
      }
      await ctx.note(panel("最终回忆", "接下来测验全部项目，暂时不显示对错。忘记时留空提交。"));
      const test = [...ctx.shuffle(items.filter((item) => item.condition !== "RP+")), ...ctx.shuffle(practice)];
      for (let i = 0; i < test.length; i += 1) {
        const item = test[i];
        ctx.progress(i + 1, 20, "最终类别线索回忆");
        const response = await ctx.input(panel("请输入学过的词语", `${item.category} — ${item.word[0]}＿`), { label: "完整词语（忘记可留空）", minLength: 0 });
        ctx.record({ phase: "recall", ...item, finalOrder: i + 1, response: response.value, correct: scoreWord(response.value, item.word), rt: response.rt });
      }
      const rows = validRows(ctx, "recall"), groups = ["RP+", "NPP", "RP-"].map((condition) => { const selected = rows.filter((r) => r.condition === condition); return { condition, accuracy: rate(selected), count: selected.length }; });
      const difference = groups[1].accuracy === null || groups[2].accuracy === null ? null : (groups[1].accuracy - groups[2].accuracy) * 100;
      return { metrics: [...groups.map((group) => ({ label: `${group.condition === "RP-" ? "RP−" : group.condition} 回忆正确率`, value: pct(group.accuracy), note: `${group.count} 项有效测验` })), { label: "提取诱发遗忘差值", value: format(difference, " 百分点"), note: "NPP − RP−" }], explanation: "RP+ 是练习过的项目，RP− 是同类未练习项目，NPP 是未练习类别的基线。NPP 高于 RP− 与提取诱发遗忘现象相符，但本次短版不能单独排除所有竞争解释，也不会强制生成预期顺序。" };
    },
  });
})();

(function registerAttentionTasks(T) {
  "use strict";

  const cueLabels = { none: "无线索", central: "中心线索", double: "双线索", spatial: "空间线索" };
  const targetLabels = { congruent: "一致", incongruent: "不一致", neutral: "中性" };
  const esc = (text) => T.escape(text);
  const validRows = (rows) => rows.filter((row) => row.valid !== false);
  const average = (ctx, rows) => ctx.mean(validRows(rows).filter((row) => row.correct === true && Number.isFinite(row.rt)).map((row) => row.rt));
  const rtText = (value) => value === null ? "数据不足" : `${Math.round(value)} ms`;
  const diffText = (first, second) => first === null || second === null ? "数据不足" : `${first - second >= 0 ? "+" : ""}${Math.round(first - second)} ms`;
  const accuracy = (ctx, rows) => { const usable = validRows(rows); return ctx.percent(usable.filter((row) => row.correct === true).length, usable.length); };
  const table = (headers, rows) => `<div class="table-scroll"><table><thead><tr>${headers.map((cell) => `<th>${esc(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

  function antTrials(shuffle) {
    const cues = ["none", "central", "double", "spatial"];
    const targets = ["congruent", "incongruent", "neutral"];
    return Array.from({ length: 3 }, (_, block) => shuffle(cues.flatMap(cue => targets.flatMap(condition => ["left", "right"].flatMap(direction => ["above", "below"].map(targetLocation => ({ cue, condition, direction, targetLocation, block: block + 1 }))))))).flat();
  }

  function antBoard(trial, phase) {
    const targetY = trial.targetLocation === "above" ? 88 : 252;
    const star = (y) => `<text x="260" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="36" fill="#172839">*</text>`;
    const cue = phase !== "cue" || trial.cue === "none" ? "" : trial.cue === "central" ? star(143)
      : trial.cue === "double" ? star(88) + star(252) : star(targetY);
    const middle = trial.direction === "left" ? "←" : "→";
    const outer = trial.condition === "neutral" ? "—" : trial.condition === "congruent" ? middle : middle === "←" ? "→" : "←";
    const target = phase === "target" ? `<text x="260" y="${targetY}" text-anchor="middle" dominant-baseline="central" font-size="44" letter-spacing="7" fill="#172839">${outer}${outer}${middle}${outer}${outer}</text>` : "";
    return `<svg data-ant-phase="${phase}" viewBox="0 0 520 340" role="img" aria-label="${phase === "target" ? "请判断中央箭头方向" : "请注视中央加号"}" style="display:block;width:min(100%,560px);margin:auto"><text x="260" y="177" text-anchor="middle" font-size="26" fill="#172839">+</text>${cue}${target}</svg>`;
  }

  T.register({
    id: "ant", name: "注意网络测试 ANT", chapter: "第三章", code: "3-1", category: "注意与执行控制", taskType: "线索与箭头判断", trialCount: 144,
    metrics: ["警觉效应", "定向效应", "冲突效应"],
    shortDescription: "在四种线索和三种箭头条件下，分别体验警觉、定向与执行控制。",
    instructions: [
      "注视中央加号。星号可能出现在中央、上下两处或目标位置，也可能没有星号。",
      "箭头出现在加号上方或下方；只判断五个符号中间的箭头。左箭头按 ←，右箭头按 →，手机点击对应方向按钮。",
      "共 144 个正式试次，分 3 组，每组 48 次，组间可休息。每次最多 1700 毫秒作答；每组开始前注视至少 2000 毫秒。",
    ],
    description: "# 注意网络测试 ANT\n\n## 学习目标\n区分警觉、定向和执行控制三个注意网络，理解同一项行为任务中不同条件差值的意义。\n\n## 实验流程\n按定稿文字与流程图：144 个正式试次，分 3 组，每组 48 次，组间可主动休息。每组完整交叉 4 种线索 × 3 种目标条件 × 2 个方向 × 2 个位置，各组合每组 1 次，组内随机。每组首试次中央注视至少 2000 ms，其余试次随机注视 400–1600 ms；线索 100 ms，再注视 400 ms，箭头阵列最长 1700 ms。中央加号始终保留。\n\n## 操作\n忽略两侧箭头或横线，只判断正中央箭头指向；键盘左右方向键与屏幕按钮等效。\n\n## 指标\n只用有效且正确的反应时计算：警觉效应＝无线索 RT−双线索 RT；定向效应＝中心线索 RT−空间线索 RT；冲突效应＝不一致 RT−一致 RT。报告各条件正确率和正确 RT；缺少正确试次时显示数据不足，不把缺失当成零。\n\n## 解释与来源\n参照 Fan et al. (2002) 经典 ANT 范式，按《认知心理学》在线实验 11.22 定稿改编。本教材采用 144 次的平衡教学版，不等同于原研究的完整测量程序，不能用于个人网络效率评估；效应方向也不保证与组水平经典结果一致。浏览器与设备造成计时误差，切换窗口的试次保留但不纳入汇总。",
    async run(ctx) {
      const trials = antTrials(ctx.shuffle);
      for (const [index, trial] of trials.entries()) {
        const fixationMs = await ctx.trialStart(index, trials.length, { blockSize: 48, label: "注意网络测试", fixationMs: 400 + Math.floor(Math.random() * 1201), renderFixation: ms => { ctx.stage(antBoard(trial, "fixation")); return ctx.wait(ms); } });
        ctx.stage(antBoard(trial, "cue")); await ctx.wait(100);
        ctx.stage(antBoard(trial, "fixation")); await ctx.wait(400);
        const answer = await ctx.choose(antBoard(trial, "target"), [
          { value: "left", label: "← 左", key: "ArrowLeft" },
          { value: "right", label: "右 →", key: "ArrowRight" },
        ], { timeout: 1700 });
        ctx.record({ phase: "formal", ...trial, expected: trial.direction, response: answer.value, correct: answer.value === trial.direction, rt: answer.timedOut ? null : answer.rt, timed_out: answer.timedOut, fixation_ms: fixationMs, cue_ms: 100, postcue_fixation_ms: 400, target_window_ms: 1700 });
        await ctx.wait(250);
      }
      const rows = validRows(ctx.rows).filter(row => row.phase === "formal");
      const cueMean = (cue) => average(ctx, rows.filter((row) => row.cue === cue));
      const targetMean = (condition) => average(ctx, rows.filter((row) => row.condition === condition));
      return {
        metrics: [
          { label: "警觉效应", value: diffText(cueMean("none"), cueMean("double")), note: "无线索 − 双线索" },
          { label: "定向效应", value: diffText(cueMean("central"), cueMean("spatial")), note: "中心线索 − 空间线索" },
          { label: "冲突效应", value: diffText(targetMean("incongruent"), targetMean("congruent")), note: "不一致 − 一致" },
          { label: "正确率", value: accuracy(ctx, rows), note: `${rows.length} 个有效试次` },
          { label: "正确反应时", value: rtText(average(ctx, rows)), note: "仅统计正确且有效的反应" },
        ],
        extraHtml: "<h3>各线索条件</h3>" + table(["线索", "有效试次", "正确率", "正确 RT"], Object.keys(cueLabels).map((cue) => {
          const subset = rows.filter((row) => row.cue === cue); return [cueLabels[cue], subset.length, accuracy(ctx, subset), rtText(cueMean(cue))];
        })) + "<h3>各目标条件</h3>" + table(["目标", "有效试次", "正确率", "正确 RT"], Object.keys(targetLabels).map((condition) => {
          const subset = rows.filter((row) => row.condition === condition); return [targetLabels[condition], subset.length, accuracy(ctx, subset), rtText(targetMean(condition))];
        })),
        explanation: "三个差值分别对应线索带来的准备收益、有效位置线索的定向收益和两侧不一致刺激的冲突代价。结果来自本次真实反应；少量试次、不同组合的正确数量和设备延迟都会使差值波动，不能据此诊断注意能力。",
      };
    },
  });

  const LETTERS = "ABCDEFGHJKLMNPQRSTUVWYZ".split("");
  function blinkTrials(shuffle) {
    return Array.from({ length: 2 }, (_, block) => shuffle(["single", "dual"].flatMap((mode, modeIndex) => Array.from({ length: 8 }, (_, index) => {
      const rows = Array.from({ length: 2 }, () => ({ mode, lag: index + 1, t2Present: true, block: block + 1 }));
      if ((modeIndex + index) % 2 === block) rows.push({ mode, lag: index + 1, t2Present: false, block: block + 1 });
      return rows;
    }).flat()))).flat();
  }

  function blinkStream(trial, shuffle) {
    const t1 = shuffle(LETTERS)[0];
    const distractors = LETTERS.filter((letter) => letter !== t1);
    const t1Index = 6 + Math.floor(Math.random() * 3), t2Index = t1Index + trial.lag;
    const letters = Array.from({ length: 24 }, () => shuffle(distractors)[0]);
    letters[t1Index] = t1;
    if (trial.t2Present) letters[t2Index] = "X";
    return { letters, t1, t1Index, t2Index };
  }

  const rsvpFrame = (letter = "", white = false) => `<div data-rsvp style="min-height:320px;display:grid;place-items:center;background:#9b9b9b;border:1px solid #6c6c6c;font:700 clamp(60px,18vw,100px)/1 Arial,sans-serif;color:${white ? "#ffffff" : "#111111"}" aria-label="${letter ? "快速字母呈现" : "间隔空屏"}">${letter || "&nbsp;"}</div>`;
  function blinkSummary(rows, mode, lag = null) {
    return rows.filter((row) => row.valid !== false && row.mode === mode && (lag === null || row.lag === lag) && (mode !== "dual" || row.t1Correct === true));
  }
  function blinkCurve(ctx, rows) {
    const modes = ["single", "dual"], colors = ["#1f5067", "#c74b36"];
    const cells = modes.flatMap((mode) => Array.from({ length: 8 }, (_, index) => {
      const lag = index + 1, selected = blinkSummary(rows, mode, lag).filter((row) => row.t2Present);
      return { mode, lag, count: selected.length, percent: selected.length ? selected.filter((row) => row.t2Response === "yes").length / selected.length * 100 : null };
    }));
    const x = (lag) => 68 + (lag - 1) * 58, y = (value) => 236 - value * 1.8;
    const grid = [0, 25, 50, 75, 100].map((value) => `<path d="M68 ${y(value)}H474" stroke="#d4cfc4"/><text x="55" y="${y(value) + 4}" text-anchor="end" fill="#52606d" font-size="12">${value}%</text>`).join("");
    const plots = modes.map((mode, modeIndex) => {
      const values = cells.filter((cell) => cell.mode === mode);
      const links = values.slice(1).map((cell, index) => cell.percent !== null && values[index].percent !== null ? `<path d="M${x(values[index].lag)} ${y(values[index].percent)}L${x(cell.lag)} ${y(cell.percent)}" stroke="${colors[modeIndex]}" fill="none" stroke-width="2"/>` : "").join("");
      return links + values.filter((cell) => cell.percent !== null).map((cell) => `<circle cx="${x(cell.lag)}" cy="${y(cell.percent)}" r="${modeIndex ? 4 : 6}" fill="${colors[modeIndex]}"><title>${mode === "single" ? "单任务" : "双任务"} ${cell.lag * 90} ms：${cell.percent.toFixed(1)}%，n=${cell.count}</title></circle>`).join("");
    }).join("");
    return `<h3>T2 出现时的检出正确率</h3><p class="result-note">单任务为蓝色，双任务为红色；双任务仅纳入 T1 正确试次。没有有效 X 出现试次的格不画点、不补零。横轴是按流程图设置的名义间隔，实际 DOM 时序见 CSV。</p><svg data-blink-curve viewBox="0 0 540 310" role="img" aria-label="单任务与双任务的 T2 检出正确率曲线" style="display:block;width:100%;max-width:720px">${grid}<path d="M68 50V236H474" stroke="#172839" fill="none"/>${Array.from({ length: 8 }, (_, i) => `<text x="${x(i + 1)}" y="260" text-anchor="middle" font-size="11" fill="#172839">${(i + 1) * 90}</text>`).join("")}<text x="270" y="290" text-anchor="middle" fill="#52606d" font-size="12">T1–T2 名义间隔（ms）</text><text x="100" y="32" fill="${colors[0]}" font-size="13">● 单任务</text><text x="245" y="32" fill="${colors[1]}" font-size="13">● 双任务（T1正确）</text>${plots}</svg>`;
  }

  T.register({
    id: "attentional-blink", name: "注意瞬脱效应", chapter: "第三章", code: "3-2", category: "注意与执行控制", taskType: "快速序列视觉呈现", trialCount: 80,
    metrics: ["T1 识别正确率", "T2 检测正确率", "T2 随间隔变化曲线"],
    shortDescription: "观看快速字母流，比较只检测 X 与先识别白色目标再检测 X 的表现。",
    instructions: [
      "每轮先看任务提示，再注视字母流。白色字母是 T1，黑色 X 是可能出现的 T2。",
      "单任务只判断是否出现 X；双任务先报告白色 T1 字母，再判断 X。忘记 T1 时可填写 ?，不要猜测必须出现 X。",
      "共 80 次，分 2 组，每组 40 次，组间可休息。每组开始前注视至少 2000 ms。按流程图每个字母呈现 15 ms、空屏 75 ms；T2 在 T1 后第 1–8 项。",
    ],
    description: "# 注意瞬脱效应\n\n## 学习目标\n体验注意资源在时间维度上的限制，区分只检测第二目标与同时识别两个目标的任务要求。\n\n## 刺激与流程\n灰色背景上的黑色大写字母流中，T1 为白色字母，T2 为黑色 X，X 有出现和缺席两种情况。单任务只检测 X；双任务先输入 T1，再检测 X。每轮共 24 个字母，T1 位置在第 7–9 个之间随机；T2 预定槽位在 T1 后第 1–8 项。T1 和干扰字母均不含 X。\n\n## 定稿时序差异的处理\n正文列出 100–800 ms 间隔，而配图规定每字母 15 ms、空屏 75 ms，合计 90 ms 的刺激起始间隔。遵循流程图优先，采用 15+75 ms 与 lag 1–8，因此名义 T1–T2 间隔为 90、180、270、360、450、540、630、720 ms；CSV 同时列出正文标称值 100–800 ms、图示名义值与实际 DOM 更新时刻。DOM 时刻不等于物理屏幕亮度变化时刻，普通浏览器不能保证精确 15 ms 呈现。\n\n## 设计与数量\n共 80 个正式试次，分 2 组，每组 40 次，组间可休息，每组首试次先注视至少 2000 ms，其余试次 500 ms。单任务与双任务各 40 次；每个任务 × lag 组合包含 4 次 X 出现和 1 次 X 缺席，总计 64 次出现、16 次缺席。每组在每个任务 × lag 安排 2 次 X 出现，缺席试次在两组交错平衡；组内随机。这是平衡教学版，不能替代完整研究测量。\n\n## 指标\n双任务先计算 T1 识别率，仅 T1 正确且有效的试次进入双任务 T2 分析。报告 T2 判断正确率、X 出现时的命中率和缺席时的虚报率。曲线只绘制实际有 X 出现且可分析的格，缺失格不补零；附表同时展示全部可分析试次的判断正确率。X 缺席试次的 lag 指预定槽位，没有真实 T2 呈现时刻。\n\n## 解释与来源\n参照 Raymond、Shapiro 与 Arnell (1992) 的 RSVP 注意瞬脱实验，按《认知心理学》在线实验 11.22 定稿实现。结果全部由实际作答计算，不预画经典曲线；短版没有出现明显瞬脱并不说明注意能力异常。",
    async run(ctx) {
      const trials = blinkTrials(ctx.shuffle);
      for (const [index, trial] of trials.entries()) {
        await ctx.note(`<h2>${trial.mode === "single" ? "这一轮：只判断 X" : "这一轮：先报告白色字母，再判断 X"}</h2><p>字母流结束后再作答，呈现过程中不用按键。</p>`, "准备好，播放字母流");
        const fixationMs = await ctx.trialStart(index, trials.length, { blockSize: 40, label: trial.mode === "single" ? "单任务：只检测 X" : "双任务：T1 字母和 X", fixationMs: 500, renderFixation: ms => {
          ctx.stage(`<div class="fixation" data-blink-fixation="${trial.mode}" style="position:relative"><span aria-hidden="true">+</span><p class="prompt" style="position:absolute;top:12px;text-align:center">${trial.mode === "single" ? "本轮单任务：只判断 X 是否出现" : "本轮双任务：先报告白色字母，再判断 X"}</p></div>`);
          return ctx.wait(ms);
        } });
        const stream = blinkStream(trial, ctx.shuffle), stamps = [];
        for (const [serialIndex, letter] of stream.letters.entries()) {
          ctx.stage(rsvpFrame(letter, serialIndex === stream.t1Index));
          const onset = performance.now();
          await ctx.wait(15);
          ctx.stage(rsvpFrame());
          const offset = performance.now();
          stamps.push({ position: serialIndex + 1, letter, onset, offset });
          await ctx.wait(75);
        }
        let t1Response = null, t1Correct = null, t1Rt = null;
        if (trial.mode === "dual") {
          const pending = ctx.input("<h2>刚才的白色字母是什么？</h2><p>请输入一个英文字母；没有记住时填写 ?。</p>", { label: "白色字母 T1", minLength: 1, placeholder: "例如 A，或 ?", validate: (value) => /^[a-zA-Z?？]$/.test(value.trim()) || "请只填写一个英文字母或问号。" });
          ctx.root?.querySelector("textarea")?.setAttribute("autocapitalize", "characters");
          const answer = await pending;
          t1Response = answer.value.trim().toUpperCase(); t1Correct = t1Response === stream.t1; t1Rt = answer.rt;
        }
        const answer = await ctx.choose("<h2>刚才的字母流中出现过黑色 X 吗？</h2>", [{ value: "yes", label: "有 X", key: "y" }, { value: "no", label: "没有 X", key: "n" }]);
        const t1Stamp = stamps[stream.t1Index], t2Stamp = stamps[stream.t2Index];
        ctx.record({ phase: "formal", condition: trial.mode, ...trial, fixation_ms: fixationMs, t1: stream.t1, t1Position: stream.t1Index + 1, t2Position: trial.t2Present ? stream.t2Index + 1 : null, plannedT2Position: stream.t2Index + 1, t1Response, t1Correct, t1Rt, t2Response: answer.value, correct: answer.value === (trial.t2Present ? "yes" : "no"), rt: answer.rt, analysisEligible: trial.mode === "single" || t1Correct, nominal_text_gap_ms: trial.lag * 100, nominal_soa_ms: trial.lag * 90, letter_ms: 15, blank_ms: 75, actual_t1_dom_onset_ms: t1Stamp.onset, actual_t2_dom_onset_ms: trial.t2Present ? t2Stamp.onset : null, measured_t1_t2_dom_gap_ms: trial.t2Present ? t2Stamp.onset - t1Stamp.onset : null, timing_source: "performance.now at DOM update; physical display onset not measured", frame_timing: JSON.stringify(stamps.map((stamp) => ({ ...stamp, onset: Math.round(stamp.onset * 10) / 10, offset: Math.round(stamp.offset * 10) / 10 }))) });
      }
      const rows = validRows(ctx.rows).filter(row => row.phase === "formal"), dual = rows.filter((row) => row.mode === "dual"), usableDual = blinkSummary(rows, "dual"), single = blinkSummary(rows, "single");
      const t2Accuracy = (selected) => ctx.percent(selected.filter((row) => row.correct).length, selected.length);
      const rates = (selected, present) => { const subset = selected.filter((row) => row.t2Present === present); return ctx.percent(subset.filter((row) => row.t2Response === "yes").length, subset.length); };
      return {
        metrics: [
          { label: "双任务 T1 识别正确率", value: ctx.percent(dual.filter((row) => row.t1Correct).length, dual.length), note: `${dual.length} 次有效双任务` },
          { label: "单任务 T2 判断正确率", value: t2Accuracy(single), note: `${single.length} 次有效判断` },
          { label: "双任务 T2 判断正确率", value: t2Accuracy(usableDual), note: `仅 ${usableDual.length} 次 T1 正确的有效试次` },
          { label: "单任务 X 虚报率", value: rates(single, false), note: "X 缺席却报告出现" },
          { label: "双任务 X 虚报率", value: rates(usableDual, false), note: "T1 正确且 X 缺席时" },
        ],
        extraHtml: blinkCurve(ctx, rows) + "<h3>按间隔核对本次判断</h3>" + table(["任务", "lag", "图示间隔", "可分析试次", "T2 判断正确率", "X 出现命中率"], ["single", "dual"].flatMap((mode) => Array.from({ length: 8 }, (_, index) => {
          const lag = index + 1, subset = blinkSummary(rows, mode, lag);
          return [mode === "single" ? "单任务" : "双任务（T1正确）", lag, `${lag * 90} ms`, subset.length, t2Accuracy(subset), rates(subset, true)];
        }))),
        explanation: "只有双任务中 T1 识别正确的试次才用于 T2 分析。比较不同间隔下的真实检出率时，要同时查看 X 缺席时的虚报率和每格样本数。每个任务与间隔只有 4 次 X 出现试次，T1 错误后可分析数量还会减少；未出现经典低谷、图上缺少某些点均可能发生，不能补造数据或将其用于个人能力判断。",
      };
    },
  });

  T.attentionChecks = { antTrials, antBoard, blinkTrials, blinkStream, blinkSummary, blinkCurve };
})(window.Textbook);

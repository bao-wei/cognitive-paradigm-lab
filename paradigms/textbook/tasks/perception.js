(function registerPerceptionTasks(T) {
  "use strict";

  const colors = [
    { name: "红", ink: "#c63832", key: "1" },
    { name: "绿", ink: "#287044", key: "2" },
    { name: "蓝", ink: "#285eaa", key: "3" },
    { name: "黄", ink: "#9b7000", key: "4" },
  ];
  const big = (value) => `<div style="min-height:190px;display:grid;place-items:center;font-size:clamp(54px,14vw,90px);font-weight:700">${value}</div>`;
  const meanRT = (c, rows) => c.mean(rows.filter((r) => r.valid !== false && r.correct === true && Number.isFinite(r.rt)).map((r) => r.rt));
  const formatRT = (n) => n === null ? "数据不足" : `${Math.round(n)} ms`;
  const difference = (a, b) => a === null || b === null ? "数据不足" : `${a - b >= 0 ? "+" : ""}${Math.round(a - b)} ms`;
  const acc = (c, rows) => c.percent(rows.filter((r) => r.valid !== false && r.correct === true).length, rows.filter((r) => r.valid !== false).length);
  const standardMetrics = (c, rows) => [
    { label: "正确率", value: acc(c, rows), note: `${rows.length} 个正式试次` },
    { label: "平均反应时", value: formatRT(meanRT(c, rows)), note: "仅统计正确且已作答的试次" },
  ];
  const table = (headers, rows) => `<div style="overflow:auto"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

  T.register({
    id: "donders", name: "Donders 减法反应时", chapter: "第一章", code: "1-1", category: "基础反应", taskType: "简单、辨别与选择反应", trialCount: 20,
    shortDescription: "体验简单反应、辨别反应和选择反应，用反应时差估计不同加工阶段。",
    instructions: ["共 20 个正式试次，分为三类任务。每一类开始前会说明按键规则。", "简单反应：看到圆形就按空格或点击反应；辨别反应：只对蓝色圆形反应，灰色圆形不反应；选择反应：按蓝／灰对应按钮。", "空白等待期不要提前作答；触屏按钮与键盘按键等效。"],
    description: "# 学习目标\n理解 Donders 减法反应时法如何通过任务差异估计加工时间。\n\n# 实验原理\n简单反应、辨别反应和选择反应包含不同的刺激辨别与反应选择要求。辨别反应 RT 减去简单反应 RT 为刺激辨别时间估计，选择反应 RT 减去辨别反应 RT 为反应选择时间估计。\n\n# 任务流程\n20 个正式试次：简单反应 6 次、辨别反应 8 次（目标与非目标各 4 次）、选择反应 6 次。三个任务区组顺序随机，每次刺激前等待 700–1400 ms；反应窗口 2000 ms。\n\n# 记录指标与结果解读\n分任务报告正确率、正确反应平均 RT 和两种减法值。不反应试次不进入 RT 平均。减法法依赖纯插入等假设，短体验可能得到负差值，不能据此推断个人加工能力。\n\n# 注意事项与来源\n仅供教学，不保存数据。参考 Donders（1868）的经典心理过程测时方法。",
    async run(c) {
      const blocks = c.shuffle(["simple", "discrimination", "choice"]);
      const labels = { simple: "简单反应", discrimination: "辨别反应", choice: "选择反应" };
      let index = 0;
      for (const condition of blocks) {
        await c.note(`<h2>${labels[condition]}</h2><p>${condition === "simple" ? "看到蓝色圆形，立即按空格或点击反应。" : condition === "discrimination" ? "仅对蓝色圆形按空格／点击；灰色圆形出现时等待，不作反应。" : "蓝色圆形按 F 或点击蓝色；灰色圆形按 J 或点击灰色。"}</p>`);
        const stimuli = condition === "simple" ? Array(6).fill("blue") : c.shuffle(Array.from({ length: condition === "choice" ? 6 : 8 }, (_, i) => i % 2 ? "gray" : "blue"));
        for (const stimulus of stimuli) {
          c.progress(++index, 20, labels[condition]);
          await c.fixation(700 + Math.floor(Math.random() * 701));
          const options = condition === "choice" ? [{ value: "blue", label: "F · 蓝色", key: "f" }, { value: "gray", label: "J · 灰色", key: "j" }] : [{ value: "go", label: "空格 · 反应", key: " " }];
          const r = await c.choose(big(`<span style="color:${stimulus === "blue" ? "#285eaa" : "#737373"}">●</span>`), options, { timeout: 2000 });
          const expected = condition === "choice" ? stimulus : condition === "discrimination" && stimulus === "gray" ? null : "go";
          c.record({ condition, stimulus, expected, response: r.value, rt: r.timedOut ? null : r.rt, correct: r.value === expected, response_window: 2000 });
          await c.wait(200);
        }
      }
      const means = Object.fromEntries(blocks.map((condition) => [condition, meanRT(c, c.rows.filter((r) => r.condition === condition))]));
      return { metrics: [
        { label: "刺激辨别时间", value: difference(means.discrimination, means.simple), note: "辨别反应 RT − 简单反应 RT" },
        { label: "反应选择时间", value: difference(means.choice, means.discrimination), note: "选择反应 RT − 辨别反应 RT" },
      ], extraHtml: table(["任务", "正确率", "平均 RT"], ["simple", "discrimination", "choice"].map((condition) => [labels[condition], acc(c, c.rows.filter((r) => r.condition === condition)), formatRT(means[condition])])), explanation: "差值来自你的真实作答。负值和无效差值也如实保留；少量试次、任务顺序与纯插入假设都会影响估计。" };
    },
  });

  T.register({
    id: "stroop", name: "Stroop 色词干扰", chapter: "第一章", code: "1-2", category: "注意与执行控制", taskType: "颜色判断", trialCount: 20,
    shortDescription: "比较一致、不一致和中性条件，体验自动阅读与颜色判断之间的竞争。",
    instructions: ["忽略文字含义，只判断字体的颜色。", "1＝红、2＝绿、3＝蓝、4＝黄，也可以点击对应颜色按钮。", "先完成 3 次练习，再完成 20 次正式试次。尽量又快又准。"],
    description: "# 学习目标与原理\n体验自动词义加工对颜色判断的影响。\n\n# 任务流程\n练习 3 次，正式 20 次。一致条件 7 次、不一致条件 7 次、中性条件 6 次。中性刺激为没有颜色意义的 XXX。注视点 500 ms，反应窗口 2500 ms。按 1、2、3、4 或触屏按钮判断红、绿、蓝、黄。\n\n# 指标与结果解读\n报告各条件正确率、正确反应平均 RT；Stroop 干扰量＝不一致 RT−一致 RT；相对中性的干扰量＝不一致 RT−中性 RT。正差值与干扰相符，但小样本不保证出现效应。\n\n# 注意事项与来源\n颜色辨识困难时不宜解释结果。本任务仅为教学体验，不作心理诊断。参考 Stroop（1935）。",
    async run(c) {
      const formal = c.shuffle([...Array(7).fill("congruent"), ...Array(7).fill("incongruent"), ...Array(6).fill("neutral")]);
      const choices = colors.map((color) => ({ value: color.name, label: `${color.key} · ${color.name}`, key: color.key }));
      for (let i = -3; i < 20; i += 1) {
        const condition = i < 0 ? ["congruent", "incongruent", "neutral"][i + 3] : formal[i];
        const target = colors[(i + 24) % 4];
        const word = condition === "neutral" ? "XXX" : condition === "congruent" ? target.name : colors[(i + 25) % 4].name;
        c.progress(i < 0 ? i + 4 : i + 1, i < 0 ? 3 : 20, i < 0 ? "练习" : "正式实验");
        await c.fixation(500);
        const r = await c.choose(big(`<span style="color:${target.ink}">${word}</span>`), choices, { timeout: 2500 });
        const correct = r.value === target.name;
        if (i < 0) await c.note(`<h2>${correct ? "正确" : `正确颜色是${target.name}`}</h2>`, i === -1 ? "开始正式实验" : "下一次练习");
        else c.record({ condition, word, ink: target.name, response: r.value, correct, rt: r.timedOut ? null : r.rt });
      }
      const subsets = ["congruent", "incongruent", "neutral"].map((condition) => c.rows.filter((r) => r.condition === condition));
      const means = subsets.map((rows) => meanRT(c, rows));
      return { metrics: [...standardMetrics(c, c.rows), { label: "Stroop 干扰效应", value: difference(means[1], means[0]), note: "不一致 − 一致" }, { label: "相对中性干扰量", value: difference(means[1], means[2]), note: "不一致 − 中性" }], extraHtml: table(["条件", "正确率", "正确 RT"], subsets.map((rows, i) => [["一致", "不一致", "中性"][i], acc(c, rows), formatRT(means[i])])), explanation: "自动阅读可能延缓颜色判断。本次差值由实际数据计算，不能把一次正负差值理解为稳定的控制能力。" };
    },
  });

  function navonFigure(globalLetter, localLetter) {
    const patterns = { H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"], S: ["11111", "10000", "10000", "11111", "00001", "00001", "11111"] };
    return `<svg viewBox="0 0 220 290" role="img" aria-label="由小字母组成的大字母" style="height:250px;max-width:100%">${patterns[globalLetter].map((row, y) => [...row].map((v, x) => v === "1" ? `<text x="${20 + x * 40}" y="${30 + y * 38}" text-anchor="middle" fill="#172839" font-size="28" font-family="monospace" font-weight="700">${localLetter}</text>` : "").join("")).join("")}</svg>`;
  }

  T.register({
    id: "navon", name: "Navon 整体优势效应", chapter: "第二章", code: "2-1", category: "知觉", taskType: "整体与局部字母判断", trialCount: 20,
    shortDescription: "在复合字母中判断整体或局部，比较整体优先和跨层级干扰。",
    instructions: ["刺激由许多小字母排成一个大字母。每次先看提示“整体”或“局部”。", "整体＝判断大字母；局部＝判断组成图形的小字母。H 按 F，S 按 J，或点击按钮。", "20 次正式试次中，两个层级与一致／不一致条件各 5 次。"],
    description: "# 学习目标与实验原理\n采用 Navon 复合字母，比较整体与局部加工，以及不相关层级的干扰。\n\n# 任务流程\n每次提示目标层级 800 ms，注视 400 ms，然后呈现复合 H/S。整体／局部 × 一致／不一致共四种条件，每种 5 次，合计 20 次随机呈现。按 F＝H、J＝S，或点击按钮。\n\n# 指标与含义\n整体优势＝局部正确 RT−整体正确 RT；整体对局部干扰＝局部不一致 RT−局部一致 RT；局部对整体干扰＝整体不一致 RT−整体一致 RT。报告各条件正确率和 RT，不保证每人出现经典方向。\n\n# 注意事项与来源\n图形大小和屏幕会影响视觉层级加工，结果仅供课堂讨论。参考 Navon（1977）。",
    async run(c) {
      const trials = c.shuffle(["global", "local"].flatMap((level) => ["congruent", "incongruent"].flatMap((condition) => Array.from({ length: 5 }, (_, i) => {
        const globalLetter = i % 2 ? "S" : "H";
        return { level, condition, globalLetter, localLetter: condition === "congruent" ? globalLetter : globalLetter === "H" ? "S" : "H" };
      }))));
      for (const [i, trial] of trials.entries()) {
        c.progress(i + 1, 20, trial.level === "global" ? "判断整体" : "判断局部");
        c.stage(`<h2>${trial.level === "global" ? "判断整体大字母" : "判断局部小字母"}</h2>`);
        await c.wait(800);
        await c.fixation(400);
        const r = await c.choose(navonFigure(trial.globalLetter, trial.localLetter), [{ value: "H", label: "F · H", key: "f" }, { value: "S", label: "J · S", key: "j" }], { timeout: 3000 });
        const target = trial.level === "global" ? trial.globalLetter : trial.localLetter;
        c.record({ ...trial, target, response: r.value, correct: r.value === target, rt: r.timedOut ? null : r.rt });
      }
      const subset = (level, condition) => c.rows.filter((r) => r.level === level && (!condition || r.condition === condition));
      return { metrics: [...standardMetrics(c, c.rows),
        { label: "整体优势", value: difference(meanRT(c, subset("local")), meanRT(c, subset("global"))), note: "局部 RT − 整体 RT" },
        { label: "整体对局部的干扰", value: difference(meanRT(c, subset("local", "incongruent")), meanRT(c, subset("local", "congruent"))), note: "局部任务：不一致 − 一致" },
        { label: "局部对整体的干扰", value: difference(meanRT(c, subset("global", "incongruent")), meanRT(c, subset("global", "congruent"))), note: "整体任务：不一致 − 一致" }], explanation: "这些差值分别回答整体是否更快、以及哪个层级带来了干扰。试次数较少时可能与经典方向不同。" };
    },
  });

  async function playSyllable(c, source, auditoryOnly) {
    c.stage(`<p>${auditoryOnly ? "听取语音，注视中央十字" : "请注视说话者口型并聆听"}</p><div style="position:relative;width:min(100%,480px);margin:auto;background:#b8b8b8;min-height:220px"><video data-syllable playsinline preload="auto" style="display:block;width:100%;${auditoryOnly ? "visibility:hidden" : ""}"></video>${auditoryOnly ? '<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:42px">+</div>' : ""}</div><p data-media-status role="status">准备播放</p><button type="button" data-media-play class="button button-primary">播放本次语音</button>`);
    const root = c.root || document.querySelector("#task-stage");
    if (!root) throw new Error("没有找到媒体播放容器");
    const video = root.querySelector("[data-syllable]");
    video.src = c.asset ? c.asset(source) : source;
    const button = root.querySelector("[data-media-play]");
    const status = root.querySelector("[data-media-status]");
    await new Promise((resolve, reject) => {
      let finished = false;
      const complete = (error) => {
        if (finished) return;
        finished = true;
        video.pause();
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
        button.removeEventListener("click", play);
        document.removeEventListener("keydown", onKey);
        c.signal?.removeEventListener("abort", onAbort);
        error ? reject(error) : resolve();
      };
      const onAbort = () => complete(new DOMException("实验已退出", "AbortError"));
      const onEnded = () => complete();
      const onError = () => complete(new Error("语音视频无法解码或加载，请使用支持 H.264 / AAC 的浏览器重新开始；不会用空白刺激继续实验。"));
      const play = async () => {
        button.disabled = true;
        status.textContent = "正在播放…";
        try { await video.play(); } catch {
          button.disabled = false;
          status.textContent = "浏览器尚未允许声音，请点击播放，并确认媒体音量已打开。";
        }
      };
      const onKey = (event) => { if ((event.code === "Space" || event.key === "Enter") && !event.repeat && !button.disabled) { event.preventDefault(); play(); } };
      video.addEventListener("ended", onEnded);
      video.addEventListener("error", onError);
      button.addEventListener("click", play);
      document.addEventListener("keydown", onKey);
      c.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  T.register({
    id: "mcgurk", name: "麦格克效应", chapter: "第二章", code: "2-2", category: "知觉", taskType: "视听言语整合", trialCount: 20,
    assets: Array.from({ length: 8 }, (_, i) => [`assets/mcgurk-ba-${i + 1}.mp4`, `assets/mcgurk-fusion-${i + 1}.mp4`]).flat(),
    shortDescription: "观看真实说话者视频，比较听觉、视听一致与视听不一致时的音节知觉。",
    instructions: ["请打开媒体音量，建议戴耳机。每次点击“播放本次语音”，播放结束后选择实际听到的音节。", "部分试次只听声音，部分试次同时呈现口型。不要按预期猜答案，也不需要刻意寻找某种错觉。", "共有 20 次。先做声音检查；未听清时不要继续正式任务。"],
    description: "# 学习目标与实验原理\n考查可见口型如何参与言语知觉。听觉 /ba/ 与视觉 /ga/ 的不一致配对有时被报告为 /da/。\n\n# 任务流程\n使用真实说话者视频，听觉单通道 6 次、视听一致 6 次、视听不一致 8 次，共 20 次随机呈现。音频、视频均随本程序本地提供；不需要在线视频。每次播放后选择 ba、da、ga 或其他。先进行声音检查。\n\n# 指标与结果解读\n报告每种条件的 ba／da／ga／其他比例、听觉与一致条件识别率、以及不一致条件 da 融合报告率。不一致试次记录知觉报告，不把未出现错觉判为错误。未听清、设备静音时不宜解释结果。\n\n# 材料与来源\nMcGurk 与 MacDonald（1976）；视频来自 Beauchamp Lab 公开材料，Basu Mallick、Magnotti 与 Beauchamp（2015），Experiment 2。原作者在材料页面声明尽法律允许范围放弃版权及相关权利：\nhttps://openwetware.org/wiki/Beauchamp:Stimuli\n\n# 教学注意\n媒体播放和主观报告不构成听力或认知诊断；数据只保留在当前页面。",
    async run(c) {
      await c.note("<h2>声音检查</h2><p>下一段是真人发音。请确认设备媒体音量已开启。</p>", "播放检查语音");
      await playSyllable(c, "assets/mcgurk-ba-1.mp4", true);
      const check = await c.choose("<h2>刚才是否清楚听到了语音？</h2>", [{ value: "yes", label: "听到了，开始实验" }, { value: "no", label: "没有，重新检查" }]);
      if (check.value !== "yes") {
        await c.note("<p>请先检查静音开关、媒体音量和耳机连接，再播放一次。</p>");
        await playSyllable(c, "assets/mcgurk-ba-1.mp4", true);
        const repeat = await c.choose("<h2>现在是否清楚听到了语音？</h2>", [{ value: "yes", label: "听到了，开始实验" }, { value: "no", label: "仍未听到，结束检查" }]);
        if (repeat.value !== "yes") throw new Error("没有通过声音检查，请检查设备后重新开始。未生成实验结果。");
      }
      const trials = c.shuffle([...Array(6).fill("auditory"), ...Array(6).fill("congruent"), ...Array(8).fill("incongruent")]);
      const seen = { auditory: 0, congruent: 0, incongruent: 0 };
      for (const [i, condition] of trials.entries()) {
        c.progress(i + 1, 20, "聆听与报告");
        await c.fixation(350);
        const speaker = ++seen[condition];
        const source = `assets/mcgurk-${condition === "incongruent" ? "fusion" : "ba"}-${speaker}.mp4`;
        await playSyllable(c, source, condition === "auditory");
        const r = await c.choose("<h2>你实际听到了哪个音节？</h2>", [{ value: "ba", label: "1 · ba", key: "1" }, { value: "da", label: "2 · da", key: "2" }, { value: "ga", label: "3 · ga", key: "3" }, { value: "other", label: "4 · 其他", key: "4" }]);
        c.record({ condition, speaker, auditory: "ba", visual: condition === "auditory" ? "none" : condition === "congruent" ? "ba" : "ga", response: r.value, correct: condition === "incongruent" ? null : r.value === "ba", fusion: condition === "incongruent" && r.value === "da", rt: r.rt });
      }
      const subset = (condition) => c.rows.filter((r) => r.valid !== false && r.condition === condition);
      return { metrics: [
        { label: "听觉单通道识别率", value: acc(c, subset("auditory")), note: "报告为 ba 的比例" },
        { label: "视听一致识别率", value: acc(c, subset("congruent")), note: "报告为 ba 的比例" },
        { label: "融合性知觉报告率", value: c.percent(subset("incongruent").filter((r) => r.fusion).length, subset("incongruent").length), note: "视听不一致时报告 da 的比例" },
      ], extraHtml: table(["条件", "ba", "da", "ga", "其他"], ["auditory", "congruent", "incongruent"].map((condition, i) => [["听觉单通道", "视听一致", "视听不一致"][i], ...["ba", "da", "ga", "other"].map((response) => c.percent(subset(condition).filter((r) => r.response === response).length, subset(condition).length))])), explanation: "不一致视频是听觉 ba 配视觉 ga。da 报告为本任务定义的融合报告，没有融合报告也属于有效知觉差异。视频来源为公开实验材料，未使用文字或动画替代真人发音。" };
    },
  });

  const targetShapes = [
    [[0, 80], [60, 0], [120, 80]],
    [[0, 0], [110, 0], [110, 80], [0, 80]],
    [[0, 0], [45, 0], [45, 45], [110, 45], [110, 90], [0, 90]],
    [[0, 80], [30, 0], [90, 0], [120, 80]],
  ];
  function shapeFor(index) {
    const points = targetShapes[index % targetShapes.length];
    const angle = (Math.floor(index / 4) % 4) * Math.PI / 2;
    return points.map(([x, y]) => [Math.round(x * Math.cos(angle) - y * Math.sin(angle)), Math.round(x * Math.sin(angle) + y * Math.cos(angle))]);
  }
  const pointString = (points) => points.map((p) => p.join(",")).join(" ");
  function normalizedShape(points, shiftX = 0, shiftY = 0) {
    const minX = Math.min(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    return points.map(([x, y]) => [x - minX + shiftX, y - minY + shiftY]);
  }
  function targetIcon(points) {
    const p = normalizedShape(points, 30, 30);
    return `<svg viewBox="0 0 190 190" role="img" aria-label="需要记忆的目标轮廓" style="height:200px;max-width:100%"><polygon points="${pointString(p)}" fill="none" stroke="#172839" stroke-width="3" /></svg>`;
  }
  function segmentDistance(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function traceAccuracy(points, strokes) {
    const trace = strokes.flat();
    if (trace.length < 6) return { correct: false, coverage: 0, offPath: 1 };
    const edge = points.map((p, i) => [p, points[(i + 1) % points.length]]);
    const expected = edge.flatMap(([a, b]) => Array.from({ length: 20 }, (_, i) => [a[0] + (b[0] - a[0]) * i / 19, a[1] + (b[1] - a[1]) * i / 19]));
    const strokeSegments = strokes.flatMap((stroke) => stroke.slice(1).map((p, i) => [stroke[i], p]));
    const coverage = expected.filter((p) => strokeSegments.some(([a, b]) => segmentDistance(p, a, b) < 10)).length / expected.length;
    const sampled = strokeSegments.flatMap(([a, b]) => {
      const count = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
      return Array.from({ length: count }, (_, i) => [a[0] + (b[0] - a[0]) * i / (count - 1), a[1] + (b[1] - a[1]) * i / (count - 1)]);
    });
    const offPath = sampled.filter((p) => !edge.some(([a, b]) => segmentDistance(p, a, b) < 12)).length / (sampled.length || 1);
    return { correct: coverage >= 0.82 && offPath <= 0.22, coverage, offPath };
  }
  function complexFigure(points, index, practice) {
    const distractors = Array.from({ length: practice ? 9 : 16 + index % 3 * 6 }, (_, i) => {
      const x1 = 15 + ((i * 73 + index * 23) % 290), y1 = 15 + ((i * 47 + 37) % 230);
      const x2 = 15 + ((i * 31 + 180) % 290), y2 = 15 + ((i * 91 + index * 19) % 230);
      return `<path d="M${x1} ${y1}L${x2} ${y2}" />`;
    }).join("");
    return `<svg data-trace-board viewBox="0 0 320 260" role="img" aria-label="复杂背景，请描画隐藏的目标轮廓" style="width:min(100%,520px);display:block;margin:auto;background:#fffdf7;border:1px solid #88939b;touch-action:none;user-select:none"><g fill="none" stroke="#172839" stroke-width="2">${distractors}<polygon points="${pointString(points)}" /></g><g data-trace-ink fill="none" stroke="#c74b36" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></g></svg>`;
  }
  async function traceTarget(c, index, practice) {
    const target = shapeFor(index);
    await c.note(`<h2>${practice ? "练习：认识目标" : "观察目标图形"}</h2>${targetIcon(target)}<p>记住形状和方向，下一页的目标可能出现在不同位置，但不会旋转。</p>`, "记住了，寻找隐藏图形");
    const points = normalizedShape(target, 60 + index % 3 * 18, 55 + index % 4 * 10);
    c.stage(`<p>按住鼠标或手指沿目标全部轮廓描画，可分多笔。完成后点击提交。</p>${complexFigure(points, index, practice)}<p data-trace-message role="status">尚未描画</p><div class="choices"><button type="button" data-trace-clear class="button button-secondary">清除重画</button><button type="button" data-trace-submit class="button button-primary">提交轮廓</button></div>`);
    const root = c.root || document.querySelector("#task-stage");
    const svg = root.querySelector("[data-trace-board]");
    const ink = root.querySelector("[data-trace-ink]");
    const message = root.querySelector("[data-trace-message]");
    const strokes = [];
    let stroke = null, line = null, down = false;
    const start = performance.now();
    const project = (event) => {
      const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const mapped = p.matrixTransform(svg.getScreenCTM().inverse());
      return [mapped.x, mapped.y];
    };
    const draw = (event) => {
      if (!down) return;
      event.preventDefault();
      stroke.push(project(event));
      line.setAttribute("points", pointString(stroke));
      message.textContent = `已描画 ${strokes.length} 笔`;
    };
    svg.addEventListener("pointerdown", (event) => {
      event.preventDefault(); down = true; svg.setPointerCapture(event.pointerId);
      stroke = []; strokes.push(stroke);
      line = document.createElementNS("http://www.w3.org/2000/svg", "polyline"); ink.append(line); draw(event);
    });
    svg.addEventListener("pointermove", draw);
    svg.addEventListener("pointerup", () => { down = false; });
    svg.addEventListener("pointercancel", () => { down = false; });
    root.querySelector("[data-trace-clear]").addEventListener("click", () => { strokes.length = 0; ink.replaceChildren(); message.textContent = "已清除，请重画"; });
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(new DOMException("实验已退出", "AbortError"));
      c.signal?.addEventListener("abort", onAbort, { once: true });
      root.querySelector("[data-trace-submit]").addEventListener("click", () => {
        if (!strokes.flat().length) { message.textContent = "请先在图中描画目标轮廓"; return; }
        c.signal?.removeEventListener("abort", onAbort);
        resolve({ ...traceAccuracy(points, strokes), rt: performance.now() - start, strokes: JSON.stringify(strokes.map((s) => s.map(([x, y]) => [Math.round(x), Math.round(y)]))), target: JSON.stringify(points), difficulty: index % 3 + 1 });
      }, { once: false });
    });
  }

  T.register({
    id: "embedded-figures", name: "镶嵌图形", chapter: "第十一章", code: "11-1", category: "知觉", taskType: "隐藏轮廓描画", trialCount: 20,
    shortDescription: "在复杂背景中找出简单图形，并用鼠标或触屏沿轮廓描画。",
    instructions: ["先观察并记住目标形状及方向，随后从复杂背景中寻找同样的形状。", "按住鼠标或手指描画整个轮廓，可以分笔；点“清除重画”可重新描画，完成后提交。", "2 次练习有反馈；20 次正式任务不显示正确轮廓。"],
    description: "# 学习目标\n体验从复杂知觉背景中分离目标轮廓的过程。\n\n# 任务与流程\n按文档流程先练习认识目标→寻找隐藏图形→反馈；正式阶段观察目标→寻找隐藏图形→描画轮廓。练习 2 次，正式 20 次。使用本项目原创的简单几何轮廓和不同密度线段背景，不复制标准测验受版权保护的题图。目标方向保持不变，位置改变。鼠标和触屏均可连续描画，允许分笔、清除重画。\n\n# 记录指标\n记录描画正确率、正确试次平均 RT、轮廓覆盖率、偏离比例、轨迹与复杂度。覆盖率至少 82% 且明显偏离的采样点不超过 22% 才记为正确。RT 从复杂图形出现至提交，包括重画时间。\n\n# 含义与注意\n本教材版体验知觉分离，不是标准 GEFT，不提供场独立／场依存人格分型。班级比较应通过主动导出数据后由教师汇总，平台不收集全班数据。参考 Witkin（1950）与 Witkin 等（1971）的镶嵌图形研究。",
    async run(c) {
      for (let i = 0; i < 2; i += 1) {
        c.progress(i + 1, 2, "练习");
        const result = await traceTarget(c, i, true);
        const target = JSON.parse(result.target);
        await c.note(`<h2>${result.correct ? "轮廓描画正确" : "请对照红色正确轮廓"}</h2><div style="position:relative">${complexFigure(target, i, true).replace('<g data-trace-ink', `<polygon points="${pointString(target)}" fill="none" stroke="#c74b36" stroke-width="5"/><g data-trace-ink`)}</div><p>轮廓覆盖 ${Math.round(result.coverage * 100)}%，偏离 ${Math.round(result.offPath * 100)}%。应描出整个闭合轮廓。</p>`, i === 1 ? "进入正式实验" : "下一次练习");
      }
      for (let i = 0; i < 20; i += 1) {
        c.progress(i + 1, 20, "正式描画");
        const result = await traceTarget(c, i + 2, false);
        c.record({ condition: `complexity-${result.difficulty}`, ...result });
      }
      const coverage = c.mean(c.rows.filter((r) => r.valid !== false).map((r) => r.coverage));
      return { metrics: [...standardMetrics(c, c.rows), { label: "平均轮廓覆盖率", value: coverage === null ? "数据不足" : `${Math.round(coverage * 100)}%`, note: "目标轮廓被实际轨迹覆盖的比例" }], explanation: "背景中的目标轮廓由原创几何材料构成。描画成绩反映本次搜索与操作表现，不能按标准测验常模推断认知风格，也不能把触屏描画熟练度等同于知觉能力。" };
    },
  });

  const interfaceGroups = [
    { title: "文件与数据", labels: ["新建文档", "打开项目", "导入数据", "导出数据", "查看保存状态", "版本记录"] },
    { title: "账户与安全", labels: ["账户资料", "修改密码", "双重验证", "登录设备", "隐私设置", "退出账户"] },
    { title: "工作与协作", labels: ["任务列表", "团队成员", "分享文档", "通知设置", "评论记录", "帮助中心"] },
  ];
  async function searchInterface(c, condition, target, order) {
    const controls = interfaceGroups.flatMap((g) => g.labels);
    const button = (label) => `<button type="button" data-search-item="${label}" style="min-height:44px;padding:8px 6px;border:1px solid #89929a;background:#fffdf7;color:#172839;font:inherit;font-size:12px;border-radius:3px">${label === "查看保存状态" ? "已保存 · 查看状态" : label}</button>`;
    const body = condition === "grouped"
      ? interfaceGroups.map((g) => `<section><h3 style="text-align:left;font-size:15px;margin:18px 0 8px">${g.title}</h3><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px">${g.labels.map(button).join("")}</div></section>`).join("")
      : `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;padding-top:12px">${order.map((i) => button(controls[i])).join("")}</div>`;
    c.stage(`<h2>请找到：${target}</h2><div style="width:min(100%,620px);margin:auto;padding:12px;background:#e8dfcf;border:1px solid #adb1ae">${body}</div><p data-search-feedback role="status">点击目标功能</p>`);
    const root = c.root || document.querySelector("#task-stage");
    const start = performance.now();
    const clickHistory = [];
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(new DOMException("实验已退出", "AbortError"));
      c.signal?.addEventListener("abort", onAbort, { once: true });
      root.querySelectorAll("[data-search-item]").forEach((element) => element.addEventListener("click", () => {
        const label = element.getAttribute("data-search-item");
        clickHistory.push({ label, rt: Math.round(performance.now() - start) });
        if (label === target) { c.signal?.removeEventListener("abort", onAbort); resolve({ rt: performance.now() - start, correct: clickHistory.length === 1, wrongClicks: clickHistory.length - 1, firstSelection: clickHistory[0].label, clicks: JSON.stringify(clickHistory) }); }
        else root.querySelector("[data-search-feedback]").textContent = "这个功能与目标不符，请继续寻找。";
      }));
    });
  }

  T.register({
    id: "interface-search", name: "界面信息分组与视觉搜索", chapter: "第十二章", code: "12-1", category: "注意与执行控制", taskType: "界面目标搜索", trialCount: 20,
    shortDescription: "比较高密度界面和按功能分组的界面，观察搜索速度、误操作和主观难度。",
    instructions: ["根据每次提示，在模拟界面中找到目标功能并点击。点错后继续寻找。", "两种界面功能相同，共 20 个搜索任务。每种界面结束后报告主观难度。", "系统记录点击和反应时；此网页不测量眼动，不把鼠标或手指轨迹当作注视。"],
    description: "# 学习目标与原理\n体验功能分组、留白和标题层级对目标搜索的影响。\n\n# 任务流程\n两种界面各 10 个正式任务，共 20 次，区组顺序随机。两种界面均包含相同的 18 个功能；高密度界面无功能标题且功能随机排列，分组界面按文件与数据、账户与安全、工作与协作组织。任务包含导出数据、账户安全和保存状态等，错误点击后继续寻找目标。每区组结束报告 1–7 分主观难度。\n\n# 指标与含义\n记录目标发现 RT、首次操作正确率、错误点击数、点击顺序与主观难度。首次注视目标区域时间和无关区域注视次数需要眼动设备，本网页不测量，CSV 中明确记为未采集，不使用鼠标行为替代眼动。\n\n# 注意事项与来源\n两种界面的屏幕大小与操作设备应尽量一致；重复相同功能可能产生练习效应。本实验是信息组织与视觉搜索的人机交互教学演示，不评价个人能力。",
    async run(c) {
      const targets = ["导出数据", "修改密码", "查看保存状态", "隐私设置", "任务列表", "双重验证", "导入数据", "团队成员", "版本记录", "通知设置"];
      const order = c.shuffle(Array.from({ length: 18 }, (_, i) => i));
      const difficulty = {};
      let index = 0;
      for (const condition of c.shuffle(["dense", "grouped"])) {
        await c.note(`<h2>${condition === "dense" ? "界面 A" : "界面 B"}</h2><p>按提示寻找目标。功能与上一组相同，请尽量又快又准。</p>`);
        for (const target of c.shuffle(targets)) {
          c.progress(++index, 20, "搜索目标");
          const r = await searchInterface(c, condition, target, order);
          c.record({ condition, target, ...r, first_fixation_ms: "not_collected", irrelevant_fixations: "not_collected" });
        }
        const rating = await c.choose("<h2>这一组界面使用起来有多困难？</h2><p>1＝非常容易，7＝非常困难。</p>", Array.from({ length: 7 }, (_, i) => ({ value: i + 1, label: String(i + 1), key: String(i + 1) })));
        difficulty[condition] = Number(rating.value);
        c.rows.filter((r) => r.condition === condition).forEach((r) => { r.subjective_difficulty = difficulty[condition]; });
      }
      const rows = (condition) => c.rows.filter((r) => r.valid !== false && r.condition === condition);
      const average = (condition) => c.mean(rows(condition).map((r) => r.rt));
      return { metrics: [
        { label: "搜索时间差", value: difference(average("dense"), average("grouped")), note: "高密度 − 分组；包含纠正误点所花时间" },
        { label: "分组界面首次正确率", value: acc(c, rows("grouped")), note: "第一次点击即命中目标" },
        { label: "主观难度差", value: `${difficulty.dense - difficulty.grouped} 分`, note: "高密度难度 − 分组难度" },
      ], extraHtml: table(["界面", "平均搜索 RT", "首次正确率", "误点次数", "难度"], ["dense", "grouped"].map((condition, i) => [["高密度", "功能分组"][i], formatRT(average(condition)), acc(c, rows(condition)), rows(condition).reduce((n, r) => n + r.wrongClicks, 0), `${difficulty[condition]}/7`])), explanation: "网页实际记录点击和反应时，没有采集注视点或眼动。搜索时间包含错误后纠正的时间；应结合正确率、主观难度和区组顺序解释。" };
    },
  });

  T.register({
    id: "flanker", name: "Flanker 侧抑制任务", chapter: "补充范式", code: "S-1", category: "注意与执行控制", taskType: "箭头方向判断", trialCount: 20,
    shortDescription: "判断中央箭头的方向，忽略两侧无关箭头，体验反应冲突。",
    instructions: ["只判断五个箭头中正中央的箭头。", "中央朝左按 F／左按钮；朝右按 J／右按钮。20 个正式试次。"],
    description: "# 学习目标与原理\n体验无关侧翼刺激带来的反应冲突。\n\n# 任务流程\n先做 2 次练习，再完成 20 次正式试次。一致和不一致条件各 10 次，中央左／右方向各半。注视点 500 ms，反应窗口 2000 ms。键盘 F／J 和触屏按钮等效。\n\n# 指标与含义\n报告正确率、正确 RT 和冲突效应（不一致 RT−一致 RT）。小样本差值仅供教学讨论，不作能力判断。参考 Eriksen 与 Eriksen（1974）。",
    async run(c) {
      const trials = c.shuffle(Array.from({ length: 20 }, (_, i) => ({ condition: i < 10 ? "congruent" : "incongruent", target: i % 2 ? "left" : "right" })));
      const choices = [{ value: "left", label: "F · ←", key: "f" }, { value: "right", label: "J · →", key: "j" }];
      for (let i = -2; i < trials.length; i += 1) {
        const t = i < 0 ? { condition: i === -2 ? "congruent" : "incongruent", target: "left" } : trials[i];
        const center = t.target === "left" ? "←" : "→";
        const side = t.condition === "congruent" ? center : t.target === "left" ? "→" : "←";
        c.progress(i < 0 ? i + 3 : i + 1, i < 0 ? 2 : 20, i < 0 ? "练习" : "正式实验");
        await c.fixation(500);
        const r = await c.choose(`<div style="min-height:200px;display:grid;place-items:center;font-size:clamp(28px,8vw,56px);letter-spacing:.05em">${side}${side}${center}${side}${side}</div>`, choices, { timeout: 2000 });
        if (i < 0) await c.note(`<h2>${r.value === t.target ? "正确" : "请只判断中央箭头"}</h2>`, i === -1 ? "开始正式实验" : "继续练习");
        else c.record({ ...t, response: r.value, correct: r.value === t.target, rt: r.timedOut ? null : r.rt });
      }
      return { metrics: [...standardMetrics(c, c.rows), { label: "冲突效应", value: difference(meanRT(c, c.rows.filter((r) => r.condition === "incongruent")), meanRT(c, c.rows.filter((r) => r.condition === "congruent"))), note: "不一致 − 一致" }], explanation: "不一致侧翼可能延缓中央方向判断。本页汇总真实作答，短教学任务的差值可能波动。" };
    },
  });

  T.register({
    id: "gonogo", name: "Go / No-Go 反应抑制", chapter: "补充范式", code: "S-2", category: "注意与执行控制", taskType: "反应与抑制", trialCount: 20,
    shortDescription: "对频繁出现的 Go 信号作出反应，在 No-Go 信号出现时停止动作。",
    instructions: ["看到绿色圆形立即按空格或点击反应；看到红色叉号时不要反应。", "先完成 2 次练习，再完成 20 次正式试次，反应窗口为 1200 ms。"],
    description: "# 学习目标与原理\n体验高频反应形成的倾向，以及对不应反应信号的动作抑制。\n\n# 任务流程\n2 次练习，20 次正式试次，15 次 Go 和 5 次 No-Go 随机出现。注视点 500 ms，反应窗口 1200 ms。Go＝绿色圆形；No-Go＝红色叉号。空格或触屏按钮反应。\n\n# 指标与含义\n报告总正确率、正确 Go 平均 RT、No-Go 抑制成功率和 Go 漏报。不能把单次成绩视为冲动性或临床抑制控制评估。",
    async run(c) {
      const trials = c.shuffle([...Array(15).fill("go"), ...Array(5).fill("nogo")]);
      for (let i = -2; i < 20; i += 1) {
        const condition = i < 0 ? i === -2 ? "go" : "nogo" : trials[i];
        c.progress(i < 0 ? i + 3 : i + 1, i < 0 ? 2 : 20, i < 0 ? "练习" : "正式实验");
        await c.fixation(500);
        const r = await c.choose(big(`<span style="color:${condition === "go" ? "#287044" : "#c63832"}">${condition === "go" ? "●" : "×"}</span>`), [{ value: "go", label: "空格 · 反应", key: " " }], { timeout: 1200 });
        const correct = condition === "go" ? r.value === "go" : r.timedOut;
        if (i < 0) await c.note(`<h2>${correct ? "正确" : condition === "go" ? "绿色圆形需要反应" : "红色叉号不要反应"}</h2>`, i === -1 ? "开始正式实验" : "继续练习");
        else c.record({ condition, response: r.value, correct, rt: r.timedOut ? null : r.rt, commission: condition === "nogo" && !r.timedOut, omission: condition === "go" && r.timedOut });
      }
      return { metrics: [...standardMetrics(c, c.rows), { label: "No-Go 抑制成功率", value: acc(c, c.rows.filter((r) => r.condition === "nogo")), note: "5 次 No-Go 中成功不反应的比例" }, { label: "Go 漏报", value: `${c.rows.filter((r) => r.omission).length} 次`, note: "15 次 Go 中未及时反应的次数" }], explanation: "No-Go 不作反应是正确行为，其 RT 不进入平均反应时。总正确率应结合 Go 漏报和 No-Go 误反应阅读。" };
    },
  });

  T.perceptionChecks = { navonFigure, shapeFor, traceAccuracy };
})(window.Textbook);

(function registerSocialDecisionTasks() {
  "use strict";

  const register = (definition) => window.Textbook.register(definition);
  const labels = {
    consistent: "一致信息", neutral: "中性信息", misleading: "误导信息",
    simultaneous: "同时列队", sequential: "顺序列队",
  };
  const mean = (ctx, values, unit = "") => {
    const value = ctx.mean(values.filter(Number.isFinite));
    return value === null ? "数据不足" : `${value.toFixed(unit === " ms" ? 0 : 1)}${unit}`;
  };
  const metric = (label, value, note = "") => ({ label, value: String(value), note });
  const htmlText = (ctx, text) => `<p>${ctx.escape(text)}</p>`;
  const confidence = async (ctx) => Number((await ctx.choose("<h2>你对刚才的判断有多大把握？</h2><p>请报告当下的确信度。</p>", [20, 40, 60, 80, 100].map((value, index) => ({ value, label: `${value}%`, key: String(index + 1) })))).value);

  function avatar(identity, coat = "#526b83", size = 100) {
    const seed = identity + 1;
    const skin = ["#b67d5b", "#d5a780", "#edc3a0", "#c18e6c"][identity % 4];
    const hair = ["#2e2524", "#433730", "#7b5136"][identity % 3];
    const width = 25 + seed % 7;
    const eyeY = 38 + seed % 4;
    const glasses = identity % 3 === 0 ? '<g fill="none" stroke="#172839" stroke-width="2"><rect x="29" y="34" width="17" height="11" rx="3"/><rect x="54" y="34" width="17" height="11" rx="3"/><path d="M46 39H54"/></g>' : "";
    const beard = identity % 4 === 1 ? '<path d="M34 54Q50 81 66 54Q51 67 34 54" fill="#4a342c"/>' : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" width="${size}" height="${size * 1.1}" role="img" aria-label="候选人物头像"><path d="M8 110V92Q13 73 50 73Q87 73 92 92V110" fill="${coat}"/><ellipse cx="50" cy="43" rx="${width}" ry="32" fill="${skin}"/><path d="M${50 - width} 36Q13 0 50 5Q89 5 ${50 + width} 36L70 23L${45 + seed % 12} 17L29 29Z" fill="${hair}"/><circle cx="38" cy="${eyeY}" r="2" fill="#172839"/><circle cx="62" cy="${eyeY}" r="2" fill="#172839"/><path d="M50 42L47 52H53M40 62Q50 ${65 + seed % 5} 60 62" fill="none" stroke="#734d3b" stroke-width="2"/>${glasses}${beard}</svg>`;
  }

  function theftScene(identity, jacket, progress) {
    const x = 45 + progress * 245;
    const bagX = progress < 0.5 ? 245 : x + 65;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 240" role="img" aria-label="虚构商店事件动画"><rect x="1" y="1" width="458" height="238" rx="8" fill="#e8dfcf"/><rect x="322" y="20" width="110" height="145" fill="#c9d4d6"/><path d="M0 200H460" stroke="#172839"/><rect x="215" y="143" width="90" height="12" fill="#7a6555"/><path d="M220 155V205M300 155V205" stroke="#7a6555" stroke-width="7"/><g transform="translate(${x},54) scale(.84)">${avatar(identity, jacket, 100).replace(/<svg[^>]+>|<\/svg>/g, "")}</g><rect x="${bagX}" y="118" width="28" height="26" rx="3" fill="#bd924d"/><path d="M${bagX + 5} 118V110Q${bagX + 14} 98 ${bagX + 23} 110V118" fill="none" stroke="#725535" stroke-width="3"/><text x="22" y="29" fill="#172839" font-size="15">商店监控 · 教学动画</text><text x="22" y="226" fill="#52606d" font-size="12">请留意刚才发生的事件</text></svg>`;
  }

  register({
    id: "eyewitness", name: "证词污染与列队指认", chapter: "第六章", code: "6-3",
    category: "记忆", taskType: "事件记忆与指认", trialCount: 20,
    shortDescription: "观看虚构商店事件，再在不同列队方式中作出指认并报告确信度。",
    instructions: [
      "本任务包含虚构的拿走物品事件，不含暴力。你可以随时退出，结果不用于能力评估。",
      "每轮观看短动画，阅读事件后的文字材料，再进行人物指认。事件中的人可能在列队中，也可能不在。",
      "请独立作答；不确定时可以选择没有此人。随后报告确信度和一个事件细节。",
      "系统随机分配一种文字材料、列队方式和目标状态，全程保持这一分组。20 轮结束后提供事后解释。",
    ],
    description: "# 学习目标\n体验事件后信息与列队方式如何影响事件记忆和指认。\n\n# 实验操作\n先知情同意，再完成 20 轮原创商店动画、文字阅读、列队指认、确信度和细节报告。系统按 3 种信息 × 2 种列队方式 × 2 种目标状态随机分组；个人只进入一个组，不把不同组串成连续阶段。人物是原创示意头像。\n\n# 指标与解释\n记录人物选择、目标是否在场、正确拒绝或误认、决策反应时、确信度及事件细节报告。在顺序列队中逐人决定，选择后终止列队，不返回重选。没有真实班级数据时不绘制班级均值。\n\n# 注意事项\n动画和头像未经司法辨认材料标准化，重复练习也会改变记忆策略。本任务只用于体验研究操作，不用于评价证人或作司法判断。\n\n# 来源与参考\n教材 6-3 要求；[列队程序研究原文](https://pmc.ncbi.nlm.nih.gov/articles/PMC5256444/)。",
    async run(ctx) {
      const consent = await ctx.choose("<h2>知情同意</h2><p>你将观看虚构的商店事件动画，随后回答记忆问题。部分设计细节在任务结束后解释。没有真实受害者或暴力画面。你可随时退出，所有作答仅存在当前页面。</p>", [{ value: "yes", label: "我了解并同意参与" }, { value: "no", label: "不参与，结束体验" }]);
      if (consent.value !== "yes") {
        ctx.record({ phase: "consent", consent: false, correct: null, rt: consent.rt });
        return { metrics: [metric("体验状态", "已退出")], explanation: "未进入事件观看和指认阶段。" };
      }
      const info = ctx.shuffle(["consistent", "neutral", "misleading"])[0];
      const lineup = ctx.shuffle(["simultaneous", "sequential"])[0];
      const present = ctx.shuffle([true, false])[0];
      const rows = [];
      const details = [];
      for (let trial = 0; trial < 20; trial += 1) {
        ctx.progress(trial + 1, 20, "事件与指认");
        const identity = trial * 7 + 2;
        const jacket = trial % 2 ? "#4c7195" : "#a04f4a";
        const jacketName = trial % 2 ? "蓝色" : "红色";
        const wrongName = trial % 2 ? "红色" : "蓝色";
        for (let frame = 0; frame < 6; frame += 1) {
          ctx.stage(theftScene(identity, jacket, frame / 5));
          await ctx.wait(450);
        }
        const postText = info === "neutral" ? "商店里有一扇门，柜台附近放着物品。请回想刚才的场景。"
          : `一位顾客提到：“我看到那个穿${info === "misleading" ? wrongName : jacketName}外套的人拿走了柜台上的包。”`;
        await ctx.note(`<h2>事件后的阅读材料</h2>${htmlText(ctx, postText)}<p>请阅读后继续。</p>`);
        let candidates = Array.from({ length: 6 }, (_, i) => identity + i + 1);
        if (present) candidates[0] = identity;
        candidates = ctx.shuffle(candidates);
        let chosen = null;
        const began = performance.now();
        if (lineup === "simultaneous") {
          const gallery = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">${candidates.map((candidate, index) => `<figure style="margin:0">${avatar(candidate, "#526b83", 82)}<figcaption>候选人 ${index + 1}</figcaption></figure>`).join("")}</div>`;
          const result = await ctx.choose(`<h2>人物列队</h2><p>事件中的人物可能在这里，也可能不在。请选择一人，或选择没有此人。</p>${gallery}`, [
            ...candidates.map((candidate, index) => ({ value: candidate, label: `候选人 ${index + 1}` })),
            { value: "none", label: "没有此人" },
          ]);
          chosen = result.value === "none" ? null : Number(result.value);
        } else {
          for (let index = 0; index < candidates.length; index += 1) {
            const answer = await ctx.choose(`<h2>候选人 ${index + 1}</h2>${avatar(candidates[index], "#526b83", 155)}<p>这是否是事件中的人物？一旦选择“是”，本轮列队就结束。</p>`, [{ value: "yes", label: "是，指认此人", key: "y" }, { value: "no", label: "不是，查看下一位", key: "n" }]);
            if (answer.value === "yes") { chosen = candidates[index]; break; }
          }
        }
        const rt = performance.now() - began;
        const sure = await confidence(ctx);
        const detail = await ctx.choose("<h2>事件细节</h2><p>动画中拿走包的人，外套是什么颜色？</p>", [{ value: "红色", label: "红色" }, { value: "蓝色", label: "蓝色" }, { value: "不确定", label: "不确定" }]);
        const row = { phase: "formal", trial: trial + 1, condition: info, lineup, target_present: present, target: identity, choice: chosen ?? "none", correct: present ? chosen === identity : chosen === null, rt: Math.round(rt), confidence: sure, actual_detail: jacketName, reported_detail: detail.value, detail_correct: detail.value === jacketName, misinformation_report: info === "misleading" && detail.value === wrongName };
        ctx.record(row); rows.push(row);
        details.push(`第 ${trial + 1} 轮实际外套为${jacketName}；你的报告为${detail.value}。`);
      }
      const scored = rows.filter((row) => row.valid !== false);
      return {
        metrics: [metric("分组", `${labels[info]} · ${labels[lineup]} · ${present ? "目标在场" : "目标缺席"}`), metric("指认／拒绝正确率", ctx.percent(scored.filter((r) => r.correct).length, scored.length)), metric("平均指认时间", mean(ctx, scored.map((r) => r.rt), " ms")), metric("平均确信度", mean(ctx, scored.map((r) => r.confidence), "%")), metric("细节正确率", ctx.percent(scored.filter((r) => r.detail_correct).length, scored.length))],
        explanation: `事后说明：你被随机分到${labels[info]}、${labels[lineup]}、${present ? "目标在场" : "目标缺席"}条件。${info === "misleading" ? "阅读材料故意把动画人物的外套颜色写成相反颜色，用于演示事件后误导信息。" : info === "consistent" ? "阅读材料中的外套颜色与动画一致。" : "阅读材料没有提供外套颜色。"}每轮都有“没有此人”选项；目标缺席时正确拒绝才是正确反应。单个分组的短练习不能说明某种列队方式优于另一种。`,
        extraHtml: `<details><summary>查看事件细节核对</summary>${details.map((text) => htmlText(ctx, text)).join("")}</details>`,
      };
    },
  });

  const DRM_LISTS = [
    { level: "high", lure: "睡觉", words: ["床铺", "枕头", "打盹", "困倦", "梦境"], foils: ["海岸", "锤子"] },
    { level: "high", lure: "甜味", words: ["糖果", "蜂蜜", "蛋糕", "蜜饯", "砂糖"], foils: ["台灯", "公路"] },
    { level: "low", lure: "学校", words: ["纸张", "道路", "时钟", "窗户", "花园"], foils: ["瀑布", "绳索"] },
    { level: "low", lure: "寒冷", words: ["杯子", "天空", "门口", "衣服", "水面"], foils: ["钢琴", "邮票"] },
  ];

  register({
    id: "drm", name: "DRM 语义诱饵与虚假再认", chapter: "第六章", code: "6-4",
    category: "记忆", taskType: "词表学习与再认", trialCount: 20,
    shortDescription: "学习词表并完成自由回忆与再认，观察语义关联和确信度之间的关系。",
    instructions: ["词语每个呈现 1.5 秒，请尽量记住。请不要记笔记。", "系统随机安排即时测验或 30 秒填充任务后的延迟测验，个人只进入一种安排。", "先自由回忆，再进行 20 题新旧词判断；每题都报告确信度。", "任务结束后会说明词表设计。所有材料为教学示例，结果不用于记忆能力诊断。"],
    description: "# 学习目标\n体验语义关联如何影响记忆和再认时的确信度。\n\n# 实验操作\n学习 4 组共 20 个中文词，每词 1500 毫秒，随后自由回忆和 20 次再认，逐题报告确信度。两组词与对应主题高度关联，另外两组关联较弱；词语是教学材料，未使用标准化联想强度常模。系统在即时测验和 30 秒算术填充后的延迟测验之间随机分组。\n\n# 指标与解释\n旧词命中率、新词虚报率、关键诱饵虚报率、自由回忆成绩及确信度校准。结果页才揭示未学习的关键诱饵。不预填虚假记忆效应，不把一次练习解释为个人能力。\n\n# 注意事项\n高低关联材料未经过中文词频和联想强度常模匹配，课堂可讨论这一限制。延迟只用于体验操作，不等同长期记忆研究。\n\n# 来源与参考\nDeese（1959）；Roediger 与 McDermott（1995）；教材 6-4 要求。",
    async run(ctx) {
      const delayed = ctx.shuffle([true, false])[0];
      const lists = ctx.shuffle(DRM_LISTS.map((list) => ({ ...list, words: [...list.words] })));
      let studyIndex = 0;
      for (const list of lists) {
        for (const word of list.words) {
          ctx.progress(++studyIndex, 20, "词语学习");
          ctx.stage(`<h2>请记住这个词</h2><div style="font-size:clamp(36px,10vw,64px);padding:50px">${ctx.escape(word)}</div>`);
          await ctx.wait(1500);
          ctx.stage("<p>＋</p>"); await ctx.wait(250);
        }
      }
      if (delayed) await arithmeticFiller(ctx, 30000);
      const recall = await ctx.input("<h2>自由回忆</h2><p>请写出刚才学过的词，词与词之间用空格或顿号分开。如果没有想起，可以填“没有想起”。</p>", { label: "回忆到的词语", minLength: 1 });
      const recalled = [...new Set(recall.value.split(/[\s，,、；;。]+/).filter(Boolean))];
      const studied = lists.flatMap((list) => list.words);
      ctx.record({ phase: "free-recall", condition: delayed ? "delayed" : "immediate", recall: recall.value, correct_count: recalled.filter((word) => studied.includes(word)).length, lure_count: recalled.filter((word) => lists.some((list) => list.lure === word)).length, correct: null, rt: recall.rt });
      const probes = ctx.shuffle(lists.flatMap((list) => [
        ...ctx.shuffle(list.words).slice(0, 2).map((word) => ({ word, type: "old", level: list.level })),
        { word: list.lure, type: "lure", level: list.level },
        ...list.foils.map((word) => ({ word, type: "new", level: list.level })),
      ]));
      const rows = [];
      for (let i = 0; i < probes.length; i += 1) {
        ctx.progress(i + 1, 20, "新旧词判断");
        const probe = probes[i];
        const answer = await ctx.choose(`<h2>刚才是否学过这个词？</h2><div style="font-size:42px;padding:30px">${ctx.escape(probe.word)}</div>`, [{ value: "old", label: "学过", key: "f" }, { value: "new", label: "没有学过", key: "j" }]);
        const sure = await confidence(ctx);
        const correct = answer.value === (probe.type === "old" ? "old" : "new");
        const row = { phase: "formal", trial: i + 1, condition: probe.level, delay_condition: delayed ? "delayed" : "immediate", word: probe.word, item_type: probe.type, response: answer.value, correct, rt: answer.rt, confidence: sure };
        ctx.record(row); rows.push(row);
      }
      const scored = rows.filter((row) => row.valid !== false);
      const old = scored.filter((row) => row.item_type === "old");
      const lures = scored.filter((row) => row.item_type === "lure");
      const novel = scored.filter((row) => row.item_type === "new");
      const metrics = [metric("分组", delayed ? "延迟测验（30秒填充）" : "即时测验"), metric("旧词命中率", ctx.percent(old.filter((row) => row.response === "old").length, old.length)), metric("关键诱饵虚报率", ctx.percent(lures.filter((row) => row.response === "old").length, lures.length)), metric("普通新词虚报率", ctx.percent(novel.filter((row) => row.response === "old").length, novel.length)), metric("自由回忆正确词", `${recalled.filter((word) => studied.includes(word)).length} / 20`)];
      for (const level of ["high", "low"]) {
        const subset = lures.filter((row) => row.condition === level);
        metrics.push(metric(`${level === "high" ? "高" : "低"}关联诱饵虚报率`, ctx.percent(subset.filter((row) => row.response === "old").length, subset.length)));
      }
      const brier = ctx.mean(scored.map((row) => ((row.confidence / 100) - Number(row.correct)) ** 2));
      metrics.push(metric("确信度校准误差", brier === null ? "数据不足" : brier.toFixed(3), "Brier 分数：自报正确概率与实际正确性的均方差，越接近 0 越一致"));
      return { metrics, explanation: `事后说明：“${lists.map((list) => list.lure).join("、")}”是没有在学习阶段呈现的关键诱饵。与主题相近的词可能让人产生学过主题词的感觉，但你的结果也可能没有出现这一现象。你的安排是${delayed ? "延迟测验（30 秒填充）" : "即时测验"}。未经常模匹配的少量教学词不能用来诊断记忆能力。` };
    },
  });

  async function arithmeticFiller(ctx, milliseconds) {
    const until = performance.now() + milliseconds;
    while (performance.now() < until) {
      const left = Math.max(1, Math.ceil((until - performance.now()) / 1000));
      ctx.stage(`<h2>间隔任务 · 剩余 ${left} 秒</h2><p>请从 100 开始，每次减 3，在心中连续倒数。</p><div style="font-size:34px;padding:25px">100 → 97 → 94 → …</div>`);
      await ctx.wait(Math.min(1000, Math.max(1, until - performance.now())));
    }
  }

  function wasonItem(index) {
    const type = index % 3;
    if (type === 0) {
      const vowel = ["A", "E", "I", "O", "U", "A", "E"][Math.floor(index / 3)];
      const consonant = ["K", "T", "R", "M", "N", "S", "P"][Math.floor(index / 3)];
      const even = 2 + (Math.floor(index / 3) % 4) * 2;
      const odd = even + 1;
      return { type: "abstract", rule: "如果卡片一面是元音字母，那么另一面是偶数。", cards: [{ label: vowel, role: "p" }, { label: consonant, role: "notp" }, { label: String(even), role: "q" }, { label: String(odd), role: "notq" }], rationale: "必须查看元音卡片背面是否为偶数，也要查看奇数卡片背面是否为元音。辅音和偶数不违反这个单向条件。" };
    }
    if (type === 1) {
      const price = 5 + Math.floor(index / 3);
      return { type: "envelope", rule: `如果信封已经封口，那么必须贴至少 ${price} 元的邮票。每张卡片一面显示封口状态，另一面显示邮资。`, cards: [{ label: "已封口", role: "p" }, { label: "未封口", role: "notp" }, { label: `${price + 1} 元邮票`, role: "q" }, { label: `${price - 1} 元邮票`, role: "notq" }], rationale: "必须检查封口信封的邮资，也要检查不足额邮资的信封是否封口。未封口与足额邮资本身不能违背该规则。" };
    }
    const age = 18 + Math.floor(index / 3) % 3;
    return { type: "drinking", rule: `本题假定：如果顾客正在饮酒，那么年龄必须至少 ${age} 岁。每张卡片一面是饮品，另一面是年龄。请只按题设推理。`, cards: [{ label: "啤酒", role: "p" }, { label: "果汁", role: "notp" }, { label: `${age + 5} 岁`, role: "q" }, { label: `${age - 2} 岁`, role: "notq" }], rationale: `必须检查饮酒者是否达到 ${age} 岁，也要检查未达到 ${age} 岁者是否饮酒。喝果汁和达到年龄本身都不能违反这一单向条件。` };
  }

  async function selectWasonCards(ctx, item) {
    const cards = ctx.shuffle(item.cards);
    const selected = new Set();
    ctx.stage(`<h2>只翻哪些卡片，才能检验规则？</h2>${htmlText(ctx, item.rule)}<p>可选多张。请选择必须检查的最少卡片，再提交。</p><div data-wason-cards style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">${cards.map((card, index) => `<button class="button button-secondary" data-card="${index}" aria-pressed="false" style="min-height:95px;font-size:23px">${ctx.escape(card.label)}</button>`).join("")}</div><p data-selected aria-live="polite">尚未选择</p><button class="button button-primary" data-submit type="button">提交判断</button>`);
    const began = performance.now();
    return await new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException("实验已退出", "AbortError"));
      ctx.signal?.addEventListener("abort", abort, { once: true });
      for (const button of ctx.root.querySelectorAll("[data-card]")) {
        button.addEventListener("click", () => {
          const index = Number(button.dataset.card);
          if (selected.has(index)) selected.delete(index); else selected.add(index);
          button.setAttribute("aria-pressed", String(selected.has(index)));
          button.style.background = selected.has(index) ? "#d7e6d9" : "";
          button.style.color = selected.has(index) ? "#172839" : "";
          ctx.root.querySelector("[data-selected]").textContent = selected.size ? `已选择 ${selected.size} 张` : "尚未选择";
        });
      }
      ctx.root.querySelector("[data-submit]").addEventListener("click", () => {
        if (!selected.size) { ctx.root.querySelector("[data-selected]").textContent = "请至少选择一张卡片。"; return; }
        const roles = [...selected].map((index) => cards[index].role);
        ctx.signal?.removeEventListener("abort", abort);
        ctx.root.querySelector("[data-submit]").disabled = true;
        resolve({ roles, labels: [...selected].map((index) => cards[index].label), correct: roles.length === 2 && roles.includes("p") && roles.includes("notq"), rt: performance.now() - began });
      }, { once: false });
    });
  }

  register({
    id: "wason", name: "Wason 选择任务", chapter: "第八章", code: "8-1",
    category: "推理与问题解决", taskType: "条件推理", trialCount: 20,
    shortDescription: "在字母数字、信封邮票和饮酒年龄情境中，选择必须翻看的卡片检验规则。",
    instructions: ["每题四张卡片，各自只显示一面。请选出检验规则必须查看的最少卡片。", "点击卡片可选择或取消，多选后提交。电脑和手机均可直接点击。", "共 20 题，包含三类相同逻辑结构的任务，每题提交后提供反馈。", "题目中的饮酒年龄是题设条件；连续反馈会产生学习迁移，成绩不能视为未经练习的能力测量。"],
    description: "# 学习目标\n比较抽象内容与具体内容下的条件推理，理解证真偏向和内容效应。\n\n# 实验操作\n20 题依次完成字母数字、信封邮票、饮酒年龄三类（7、7、6 题），逻辑结构均为“若 P 则 Q”。每类题目及卡片随机排序，选择后立即反馈。\n\n# 指标与解释\n记录各题选择、反应时及三种情境的正确率。逻辑上必须检验 P 和非 Q；不能只寻找支持规则的例子。平台只展示真实个人记录；如需班级比较，应由教师收集导出的数据，不填入虚构班级均值。\n\n# 注意事项\n即时反馈与重复题目会产生练习和迁移，三类题目差异只供课堂讨论。\n\n# 来源与参考\n教材 8-1；[Gorilla Wason 教学说明](https://support.gorilla.sc/support/educational-resources/classic-psychology-tasks/wason-selection-task)。",
    async run(ctx) {
      const indices = Array.from({ length: 20 }, (_, index) => index);
      const order = [0, 1, 2].flatMap((type) => ctx.shuffle(indices.filter((index) => index % 3 === type)));
      const rows = [];
      for (let i = 0; i < order.length; i += 1) {
        ctx.progress(i + 1, 20, "条件推理");
        const item = wasonItem(order[i]);
        const answer = await selectWasonCards(ctx, item);
        const row = { phase: "formal", trial: i + 1, condition: item.type, rule: item.rule, selected_cards: answer.labels.join(" | "), selected_roles: answer.roles.join(" | "), correct: answer.correct, rt: Math.round(answer.rt) };
        ctx.record(row); rows.push(row);
        await ctx.note(`<h2>${answer.correct ? "判断正确" : "再想一想"}</h2>${htmlText(ctx, item.rationale)}<p>这道题需要查看“P”和“非 Q”。</p>`, i === 19 ? "查看结果" : "下一题");
      }
      const scored = rows.filter((row) => row.valid !== false);
      const metrics = [metric("总体正确率", ctx.percent(scored.filter((row) => row.correct).length, scored.length)), metric("平均判断时间", mean(ctx, scored.map((row) => row.rt), " ms"))];
      for (const [type, label] of [["abstract", "字母数字"], ["envelope", "信封邮票"], ["drinking", "饮酒年龄"]]) {
        const subset = scored.filter((row) => row.condition === type);
        metrics.push(metric(`${label}正确率`, ctx.percent(subset.filter((row) => row.correct).length, subset.length)), metric(`${label}平均时间`, mean(ctx, subset.map((row) => row.rt), " ms")));
      }
      return { metrics, explanation: "规则“若 P 则 Q”只会被“P 且非 Q”推翻。因此，检验规则时必须检查 P 和非 Q。内容可能改变人们对规则的理解，但本任务有即时反馈和重复练习，个人三类成绩也会受顺序、阅读与学习迁移影响。没有收集到的同学数据不会自动变成班级比较值。" };
    },
  });

  register({
    id: "bart", name: "BART 气球模拟风险任务", chapter: "第八章", code: "8-2",
    category: "决策与奖赏", taskType: "连续风险决策", trialCount: 20,
    shortDescription: "在继续充气获得收益和及时保存收益之间权衡，体验动态风险决策。",
    instructions: ["共 20 个气球，每充气一次获得 1 个模拟积分；充得越多，气球越可能爆炸。", "按空格或点击“充气”继续；按回车或点击“保存”保留本轮积分并进入下一个气球。", "爆炸会失去本轮未保存积分，不影响此前已保存的积分。没有真实金钱。", "各气球爆炸点随机分布，不会提前显示。"],
    description: "# 学习目标\n体验在不确定条件下权衡收益与爆炸风险。\n\n# 实验操作\n20 个气球，每次充气获得 1 个模拟积分。每个气球的爆炸阈值独立从 1—32 次中等概率抽取，达到阈值即爆炸；这一缩短参数用于课堂体验，不是临床常模。可随时保存本轮收益。\n\n# 指标与解释\n调整后平均充气次数只统计未爆炸气球；另记录爆炸比例、总收益、每轮充气次数和选择时间。爆炸概率在生存至后一次充气时随剩余阈值数减少而升高。\n\n# 注意事项\n没有真实奖金，20 轮任务不能用于判断人格、冲动性或现实冒险倾向。全部爆炸时调整后均值显示数据不足。\n\n# 来源与参考\nLejuez 等（2002）；[Gorilla BART 教学说明](https://support.gorilla.sc/support/educational-resources/classic-psychology-tasks/BART)。",
    async run(ctx) {
      let total = 0;
      const rows = [];
      for (let trial = 0; trial < 20; trial += 1) {
        ctx.progress(trial + 1, 20, "气球充气");
        const threshold = 1 + Math.floor(Math.random() * 32);
        let pumps = 0;
        let popped = false;
        const began = performance.now();
        while (true) {
          const radius = Math.min(92, 34 + pumps * 1.8);
          const answer = await ctx.choose(`<p>已保存 ${total} 积分 · 本轮未保存 ${pumps} 积分</p><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260" role="img" aria-label="已充气 ${pumps} 次的气球" style="max-height:280px"><ellipse cx="150" cy="115" rx="${radius * 0.88}" ry="${radius}" fill="#c74b36"/><path d="M145 ${115 + radius}L155 ${115 + radius}L150 ${125 + radius}Z" fill="#96382a"/><path d="M150 ${125 + radius}Q130 230 155 250" fill="none" stroke="#52606d"/><ellipse cx="${150 - radius * 0.35}" cy="${115 - radius * 0.3}" rx="${radius * 0.12}" ry="${radius * 0.25}" fill="#efb7a7"/></svg>`, [{ value: "pump", label: "充气 +1", key: "space" }, { value: "bank", label: `保存 ${pumps} 积分`, key: "Enter" }]);
          if (answer.value === "bank") { total += pumps; break; }
          pumps += 1;
          if (pumps >= threshold) { popped = true; ctx.stage("<h2>气球爆炸</h2><p>本轮未保存收益归零，已保存收益不变。</p>"); await ctx.wait(800); break; }
        }
        const row = { phase: "formal", trial: trial + 1, condition: "balloon", pumps, nPumps: pumps, popped, earnings: popped ? 0 : pumps, threshold, total_earnings: total, correct: null, rt: Math.round(performance.now() - began) };
        ctx.record(row); rows.push(row);
      }
      const scored = rows.filter((row) => row.valid !== false);
      const banked = scored.filter((row) => !row.popped);
      return { metrics: [metric("调整后平均充气次数", banked.length ? mean(ctx, banked.map((row) => row.pumps)) : "数据不足", `只统计 ${banked.length} 个未爆炸有效气球`), metric("气球爆炸比例", ctx.percent(scored.filter((row) => row.popped).length, scored.length)), metric("累计收益", `${total} 模拟积分`, "所有轮次的实际任务积分"), metric("气球数量", rows.length)], explanation: "调整后平均充气次数排除了爆炸轮，以减少爆炸强制截断充气造成的影响；分数仍受阈值随机性和短时练习影响。任务没有标准的正确选择，也没有真实奖金。本次表现不能作为人格或风险倾向诊断。" };
    },
  });

  function hanoiSvg(pegs, selected) {
    const centers = [80, 230, 380];
    const colors = ["#47745a", "#d8a62e", "#c74b36"];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 225" role="img" aria-label="三盘河内塔当前状态"><path d="M20 185H440" stroke="#172839" stroke-width="5"/>${pegs.map((peg, index) => `<g data-peg="${index}"><path d="M${centers[index]} 65V185" stroke="#637181" stroke-width="5"/>${selected === index ? `<rect x="${centers[index] - 63}" y="40" width="126" height="155" fill="none" stroke="#1f5067" stroke-dasharray="5 5"/>` : ""}${peg.map((disk, height) => `<rect data-disk="${disk}" x="${centers[index] - (25 + disk * 16)}" y="${159 - height * 28}" width="${50 + disk * 32}" height="25" rx="4" fill="${colors[disk - 1]}"/>`).join("")}<text x="${centers[index]}" y="216" text-anchor="middle" font-size="16" fill="#172839">${["A", "B", "C"][index]}：${peg.join("、") || "空"}</text></g>`).join("")}</svg>`;
  }

  register({
    id: "hanoi", name: "河内塔中的子目标与搜索", chapter: "第九章", code: "9-1",
    category: "推理与问题解决", taskType: "三盘问题解决", trialCount: 20,
    shortDescription: "遵守大小盘规则移动三盘河内塔，观察子目标提示与搜索过程。",
    instructions: ["把 A 柱上的三个盘全部移到 C 柱。每次只移动最上方一个盘，不能把大盘放到小盘上。", "先点击来源柱，再点击目标柱；电脑可按 A、B、C，手机直接点按钮。", "共 20 轮，每轮起点与目标相同。可结束当前轮并记录未完成。", "系统随机分配提示组或无提示组，保留全部移动、违例和回退记录。重复练习本身也会改变表现。"],
    description: "# 学习目标\n观察子目标提示与搜索、回退之间的关系。\n\n# 实验操作\n系统随机分配提示或无提示条件，完成 20 轮三盘河内塔。每轮 A 柱按大、中、小顺序放盘，目标是全部移至 C 柱；只允许移动顶盘，大盘不能压小盘。每轮最长 120 秒，可主动结束并保留未完成记录。最少合法移动是 7 步。\n\n# 指标与解释\n记录每次选择、合法移动、违例、立即逆向回退、完成时间和是否完成。不能只依据速度评价策略。相同问题的重复练习具有明显学习效应，随机提示组和无提示组应结合首轮表现及既有经验讨论。\n\n# 注意事项\n这是操作过程演示，不是智力测试，不会显示未实际收集的组间差异。\n\n# 来源与参考\n教材实验探究 9-1。",
    async run(ctx) {
      const hinted = ctx.shuffle([true, false])[0];
      const experienced = await ctx.choose("<h2>既有经验</h2><p>你以前是否完成过三盘河内塔？</p>", [{ value: "yes", label: "完成过" }, { value: "no", label: "没有" }, { value: "unsure", label: "不确定" }]);
      await ctx.note(`<h2>本次任务</h2><p>每次移动一个顶盘，不能把大盘放在小盘上，目标为 C 柱。</p>${hinted ? '<p>请先思考：移动最大盘之前，上面的两个小盘应放在哪里？</p>' : '<p>请按规则自行探索完成方法。</p>'}`);
      const rows = [];
      for (let trial = 0; trial < 20; trial += 1) {
        ctx.progress(trial + 1, 20, "三盘河内塔");
        const pegs = [[3, 2, 1], [], []];
        const began = performance.now();
        let selected = null, moves = 0, violations = 0, backtracks = 0, lastMove = null, completed = false;
        let moveIndex = 0;
        while (performance.now() - began < 120000) {
          const remaining = Math.max(0, 120000 - (performance.now() - began));
          const answer = await ctx.choose(`<p>合法移动 ${moves} 次 · 违例 ${violations} 次 · 目标 C 柱</p>${hanoiSvg(pegs, selected)}<p>${selected === null ? "请选择来源柱" : `已选 ${["A", "B", "C"][selected]} 柱，请选择目标柱`}</p>`, [{ value: 0, label: "A 柱", key: "a" }, { value: 1, label: "B 柱", key: "b" }, { value: 2, label: "C 柱", key: "c" }, { value: "stop", label: "结束本轮（记录未完成）" }], { timeout: remaining });
          if (answer.timedOut || answer.value === "stop" || answer.value === null) break;
          const peg = Number(answer.value);
          if (selected === null) {
            if (!pegs[peg].length) { violations += 1; ctx.record({ phase: "move", trial: trial + 1, move_index: ++moveIndex, condition: hinted ? "hint" : "no-hint", from: peg, to: null, legal: false, reason: "empty_source", correct: false, rt: answer.rt }); }
            else selected = peg;
            continue;
          }
          const from = selected;
          selected = null;
          if (from === peg) continue;
          const disk = pegs[from].at(-1);
          const legal = !pegs[peg].length || pegs[peg].at(-1) > disk;
          if (legal) {
            pegs[peg].push(pegs[from].pop()); moves += 1;
            if (lastMove && lastMove.from === peg && lastMove.to === from && lastMove.disk === disk) backtracks += 1;
            lastMove = { from, to: peg, disk };
          } else violations += 1;
          ctx.record({ phase: "move", trial: trial + 1, move_index: ++moveIndex, condition: hinted ? "hint" : "no-hint", from, to: peg, disk, legal, correct: legal, rt: answer.rt, state: pegs.map((stack) => stack.join("-")).join(" | ") });
          if (pegs[2].length === 3) { completed = true; break; }
        }
        const row = { phase: "formal", trial: trial + 1, condition: hinted ? "hint" : "no-hint", prior_experience: experienced.value, moves, violations, backtracks, completed, correct: completed, rt: Math.round(performance.now() - began), excess_moves: completed ? moves - 7 : null, valid: ctx.rows.filter((entry) => entry.phase === "move" && entry.trial === trial + 1).every((entry) => entry.valid !== false) };
        ctx.record(row); rows.push(row);
        await ctx.note(`<h2>${completed ? "本轮完成" : "本轮未完成"}</h2><p>合法移动 ${moves} 次，违例 ${violations} 次，立即回退 ${backtracks} 次。</p><p>三盘问题最少需要 7 次合法移动。</p>`, trial === 19 ? "查看结果" : "下一轮");
      }
      const scored = rows.filter((row) => row.valid !== false);
      return { metrics: [metric("分组", hinted ? "子目标提示" : "无提示"), metric("完成比例", ctx.percent(scored.filter((row) => row.completed).length, scored.length)), metric("完成轮平均移动", mean(ctx, scored.filter((row) => row.completed).map((row) => row.moves))), metric("立即回退总次数", scored.reduce((sum, row) => sum + row.backtracks, 0)), metric("违例总次数", scored.reduce((sum, row) => sum + row.violations, 0)), metric("完成轮平均时间", mean(ctx, scored.filter((row) => row.completed).map((row) => row.rt), " ms"))], explanation: `你的分组是${hinted ? "子目标提示组" : "无提示组"}。完成最少需 7 次合法移动。比较过程时还应考虑初始经验、阅读时间、规则理解以及 20 轮中的练习效应。没有另一组的实际课堂数据，不能由个人结果推断提示是否有效。` };
    },
  });

  function primeSvg(group, index) {
    const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img" aria-label="命名和描述用图片" style="max-height:235px"><rect x="1" y="1" width="318" height="198" rx="6" fill="#f5f0e6"/>${body}</svg>`;
    const stroke = 'fill="none" stroke="#1f5067" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
    const us = [
      '<rect x="55" y="40" width="210" height="120" fill="white"/>' + Array.from({ length: 7 }, (_, n) => `<rect x="55" y="${40 + n * 18}" width="210" height="9" fill="#a64339"/>`).join("") + '<rect x="55" y="40" width="89" height="66" fill="#1f5067"/>' + Array.from({ length: 20 }, (_, n) => `<circle cx="${64 + n % 5 * 17}" cy="${48 + Math.floor(n / 5) * 16}" r="2" fill="white"/>`).join(""),
      '<path d="M120 178L137 89L158 61L178 92L190 178Z" fill="#6f9c91"/><circle cx="158" cy="47" r="14" fill="#6f9c91"/><path d="M145 37L130 24M151 32L145 15M160 31V10M168 33L179 17M175 40L191 30M145 96L114 63L102 33" stroke="#6f9c91" stroke-width="10"/><path d="M101 31L96 12L108 5L114 18L108 33" fill="#d8a62e"/><path d="M176 98L203 115V148L179 138" fill="#d4b785"/><rect x="100" y="178" width="113" height="14" fill="#8e9d98"/>',
      `<path d="M45 173H275M65 160V93H255V160M50 93H270L160 52Z" ${stroke}/><path d="M130 53V40Q160 2 190 40V53M159 12V3" ${stroke}/>${[83,115,147,179,211,243].map((x) => `<path d="M${x} 100V157" ${stroke}/>`).join("")}`,
      '<path d="M65 125Q84 103 108 111L115 76Q160 45 205 76L212 111Q239 103 255 125Q160 159 65 125Z" fill="#a77a48"/><path d="M112 109Q160 120 208 109" fill="none" stroke="#634c33" stroke-width="8"/><path d="M129 72Q160 91 192 72" fill="none" stroke="#634c33" stroke-width="5"/>',
      '<path d="M160 92Q100 42 39 57L114 122L145 114L160 158L176 114L207 122L282 57Q220 42 160 92Z" fill="#825b3a"/><path d="M150 86Q164 61 181 79L194 87L177 94L172 116H152Z" fill="white"/><path d="M177 79L195 87L178 92" fill="#d8a62e"/><circle cx="174" cy="81" r="3" fill="#172839"/>',
      `<circle cx="158" cy="104" r="66" fill="white" stroke="#52606d" stroke-width="3"/><path d="M116 48Q159 104 116 160M200 48Q157 104 200 160" fill="none" stroke="#c74b36" stroke-width="3"/>${Array.from({ length: 7 }, (_, i) => `<path d="M${113 + Math.sin(i / 6 * Math.PI) * 28} ${59 + i * 16}l-9 5M${203 - Math.sin(i / 6 * Math.PI) * 28} ${59 + i * 16}l9 5" stroke="#c74b36" stroke-width="3"/>`).join("")}`,
    ];
    const china = [
      '<path d="M30 150L70 120L108 135L150 91L194 112L239 63L290 87V111L239 89L198 138L150 117L110 162L69 147L30 178Z" fill="#8f8776"/><path d="M30 150L70 120L108 135L150 91L194 112L239 63L290 87" fill="none" stroke="#514f4d" stroke-width="8"/><path d="M51 130V105H78V128M135 101V72H161V99M225 75V43H252V72" fill="#9d9481" stroke="#514f4d" stroke-width="3"/>',
      '<path d="M58 135Q19 97 79 77Q119 65 114 115Q110 151 154 137Q191 124 168 93Q150 68 204 64Q244 61 248 99" fill="none" stroke="#a54631" stroke-width="18"/><path d="M227 71L254 47L280 64L279 89L249 106L235 94Z" fill="#c74b36"/><path d="M254 52L246 31M272 60L286 39M258 106L251 131M101 132L89 157M178 126L196 155" stroke="#a54631" stroke-width="7"/><circle cx="265" cy="71" r="4" fill="white"/><path d="M278 86L297 88" stroke="#d8a62e" stroke-width="4"/>',
      '<circle cx="160" cy="100" r="70" fill="white" stroke="#172839" stroke-width="3"/><path d="M160 30A70 70 0 0 1 160 170A35 35 0 0 1 160 100A35 35 0 0 0 160 30" fill="#172839"/><circle cx="160" cy="65" r="10" fill="#172839"/><circle cx="160" cy="135" r="10" fill="white"/>',
      '<path d="M160 10V38M160 157V190" stroke="#a54631" stroke-width="4"/><ellipse cx="160" cy="100" rx="72" ry="62" fill="#c74b36"/><path d="M124 48Q94 101 124 153M160 39V161M196 48Q226 101 196 153" fill="none" stroke="#e4aa55" stroke-width="3"/><rect x="134" y="33" width="52" height="13" fill="#d8a62e"/><rect x="134" y="154" width="52" height="13" fill="#d8a62e"/>',
      '<circle cx="112" cy="55" r="28" fill="#172839"/><circle cx="208" cy="55" r="28" fill="#172839"/><ellipse cx="160" cy="109" rx="76" ry="66" fill="white" stroke="#172839" stroke-width="3"/><ellipse cx="129" cy="101" rx="20" ry="29" transform="rotate(30 129 101)" fill="#172839"/><ellipse cx="191" cy="101" rx="20" ry="29" transform="rotate(-30 191 101)" fill="#172839"/><circle cx="133" cy="98" r="5" fill="white"/><circle cx="187" cy="98" r="5" fill="white"/><ellipse cx="160" cy="133" rx="12" ry="8" fill="#172839"/>',
      '<path d="M49 91Q90 76 113 49H207Q231 76 271 91H49M75 132Q118 119 130 99H190Q206 120 246 132H75" fill="#395b64"/><path d="M93 93V175M227 93V175M118 134V175M202 134V175" stroke="#a64e35" stroke-width="8"/><path d="M66 178H254" stroke="#7b7367" stroke-width="7"/>',
    ];
    const weather = [
      '<path d="M72 139Q42 99 84 82Q95 42 142 63Q181 34 214 76Q265 68 269 114Q267 144 233 144H82Z" fill="#c2cdd1" stroke="#657d89" stroke-width="3"/>',
      '<path d="M75 112Q43 78 82 64Q104 28 143 54Q186 32 209 67Q254 69 251 109Z" fill="#a9bbc4"/><path d="M95 134L86 164M139 134L130 164M183 134L174 164M226 134L217 164" stroke="#407a9c" stroke-width="7"/>',
      `<path d="M160 31V169M100 65L220 135M100 135L220 65M149 43L160 55L171 43M149 157L160 145L171 157M112 61L116 79L99 84M221 116L204 121L209 139M99 116L116 121L112 139M209 61L204 79L221 84" ${stroke}/>` ,
      `<path d="M49 74H219Q262 73 251 47Q241 24 218 45M35 101H256Q284 101 280 126Q276 150 253 138M71 130H177Q216 129 207 157Q198 179 179 163" ${stroke}/>` ,
      '<circle cx="160" cy="100" r="44" fill="#d8a62e"/>' + Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${160 + Math.cos(a) * 59} ${100 + Math.sin(a) * 59}L${160 + Math.cos(a) * 78} ${100 + Math.sin(a) * 78}" stroke="#d8a62e" stroke-width="6"/>`; }).join(""),
      '<path d="M145 133V40Q160 13 175 40V133A33 33 0 1 1 145 133Z" fill="white" stroke="#657d89" stroke-width="4"/><path d="M160 141V65" stroke="#c74b36" stroke-width="10"/><circle cx="160" cy="159" r="20" fill="#c74b36"/><path d="M180 60H193M180 80H193M180 100H193M180 120H193" stroke="#657d89" stroke-width="3"/>',
    ];
    return wrap((group === "us" ? us : group === "china" ? china : weather)[index]);
  }

  function fishScene(index) {
    const bodyColor = ["#1f5067", "#3e737b", "#416680", "#485e73"][index % 4];
    const fish = (x, y, size, color) => `<g transform="translate(${x},${y}) scale(${size})"><ellipse cx="0" cy="0" rx="30" ry="14" fill="${color}"/><path d="M-25 0L-43 -16V16Z" fill="${color}"/><circle cx="18" cy="-3" r="2.6" fill="white"/></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 235" role="img" aria-label="一条鱼在一群鱼前方游动的水下场景"><rect width="460" height="235" rx="7" fill="#dfebea"/>${Array.from({ length: 5 }, (_, i) => `<path d="M0 ${30 + i * 42}Q110 ${15 + i * 42} 230 ${30 + i * 42}T460 ${30 + i * 42}" fill="none" stroke="#c4d7d6"/>`).join("")}${fish(345, 113, 1.13, bodyColor)}${Array.from({ length: 7 }, (_, i) => fish(83 + (i % 3) * 55, 65 + Math.floor(i / 3) * 45 + (index % 3) * 4, 0.58, "#91aeb6")).join("")}<path d="M315 58Q346 47 384 57" fill="none" stroke="#c08246" stroke-width="2"/><path d="M385 57L374 49L375 62Z" fill="#c08246"/></svg>`;
  }

  register({
    id: "cultural-priming", name: "文化启动与因果归因", chapter: "第十一章", code: "11-2",
    category: "社会与文化认知", taskType: "图片启动与开放归因", trialCount: 20,
    shortDescription: "为图片命名并描述，再解释鱼群场景，保留开放回答并在结束后编码。",
    instructions: ["先完成 6 幅图片的命名与描述。请在回答中写出一个名称和一句完整描述。", "接着观看 20 幅水下场景，回答“这条鱼为什么游在最前面”。每次至少 40 个字，请按实际想法作答。", "全部开放回答完成后，再为各回答标记原因类型。没有预设正确答案。", "每次体验只随机进入一种启动条件。所有文字只在本页处理，可随时退出。"],
    description: "# 学习目标\n体验文化线索启动后如何记录开放式因果归因。\n\n# 实验操作\n按流程图随机进入美国文化、中国文化或中性气象图片组。先为 6 张原创符号图命名并写一句描述，再完成 20 次鱼群场景的开放解释，每次至少 40 个字。图中一条鱼独自在鱼群前方。全部开放回答完成后，才进入人工编码阶段，避免在作答前提示归因类别。\n\n# 指标与解释\n保存完整文本、作答时间、启动分组和事后编码。内部、外部、混合和其他类别由学习者逐条标记，不用关键词自动冒充内容编码。严谨研究应使用不知道分组的独立编码者并报告一致性。\n\n# 注意事项\n原文化框架切换研究与双文化经验有关，不能把启动材料或一次任务解释为民族性格、个人文化身份或能力诊断。20 次近似场景会有重复练习影响。\n\n# 来源与参考\n教材图 11-34；Hong、Morris、Chiu 与 Benet-Martínez（2000）；Morris 与 Peng（1994）。[研究介绍](https://www.gsb.stanford.edu/faculty-research/working-papers/how-cultures-move-through-minds-dynamic-constructivist-approach)。",
    async run(ctx) {
      const group = ctx.shuffle(["us", "china", "neutral"])[0];
      const primeOrder = ctx.shuffle([0, 1, 2, 3, 4, 5]);
      for (let i = 0; i < primeOrder.length; i += 1) {
        ctx.progress(i + 1, 6, "图片命名与描述");
        const answer = await ctx.input(`<h2>图片 ${i + 1} / 6</h2>${primeSvg(group, primeOrder[i])}<p>请为图片命名，并写一句描述。</p>`, { label: "名称与描述", placeholder: "名称：……；描述：……", minLength: 8 });
        ctx.record({ phase: "prime", trial: i + 1, condition: group, picture: primeOrder[i] + 1, response: answer.value, correct: null, rt: answer.rt });
      }
      const rows = [];
      for (let trial = 0; trial < 20; trial += 1) {
        ctx.progress(trial + 1, 20, "场景解释");
        const answer = await ctx.input(`<h2>这条鱼为什么游在最前面？</h2>${fishScene(trial)}<p>请依据自己的想法写一段解释，至少 40 个字。</p>`, { label: "你的解释", minLength: 40, validate: (value) => value.replace(/\s/g, "").length >= 40 || "请至少写 40 个字，再继续。" });
        const row = { phase: "formal", trial: trial + 1, condition: group, response: answer.value, characters: answer.value.replace(/\s/g, "").length, correct: null, rt: answer.rt };
        ctx.record(row);
        rows.push(row);
      }
      await ctx.note("<h2>开放作答已全部完成</h2><p>下面仅对刚才的回答进行事后标记。内部原因指鱼的意图、性格或能力；外部原因指鱼群、情境或群体压力。一个回答可以同时包含两者，也可以无法归类。</p><p>这里由你进行自我标记，不是系统自动判断；课堂研究可另请不知道分组的编码者复核。</p>", "开始事后编码");
      for (const row of rows) {
        ctx.progress(row.trial, 20, "事后人工编码");
        const answer = await ctx.choose(`<h2>回答 ${row.trial} 的编码</h2><blockquote style="text-align:left;white-space:pre-wrap">${ctx.escape(row.response)}</blockquote>`, [{ value: "internal", label: "内部／个体原因" }, { value: "external", label: "外部／情境原因" }, { value: "mixed", label: "两者都有" }, { value: "other", label: "其他／无法归类" }]);
        row.attribution_code = answer.value;
        row.coding_method = "participant_self_code_after_all_responses";
        row.coding_rt = answer.rt;
        const stored = ctx.rows.find((entry) => entry.phase === "formal" && entry.trial === row.trial);
        if (stored) Object.assign(stored, { attribution_code: row.attribution_code, coding_method: row.coding_method, coding_rt: row.coding_rt });
      }
      const groupLabel = { us: "美国文化符号", china: "中国文化符号", neutral: "中性气象图片" }[group];
      const scored = rows.filter((row) => row.valid !== false);
      return { metrics: [metric("本次随机分组", groupLabel), metric("内部归因", ctx.percent(scored.filter((row) => row.attribution_code === "internal").length, scored.length)), metric("外部归因", ctx.percent(scored.filter((row) => row.attribution_code === "external").length, scored.length)), metric("混合归因", ctx.percent(scored.filter((row) => row.attribution_code === "mixed").length, scored.length)), metric("其他／无法归类", ctx.percent(scored.filter((row) => row.attribution_code === "other").length, scored.length)), metric("平均作答时间", mean(ctx, scored.map((row) => row.rt), " ms"))], explanation: `你本次被随机分到${groupLabel}组。归因比例来自全部开放回答之后的学习者自我编码，完整原文会一并导出，没有关键词自动判分。单个组的个人结果不能检验组间启动效应，也不能据此推断文化身份或固定民族差异。正式研究需考虑双文化经验、材料可比性、独立盲法编码及其一致性。` };
    },
  });
})();

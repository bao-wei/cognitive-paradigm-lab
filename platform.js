(function initializePlatform(global) {
  "use strict";

  const BUILTIN_PARADIGMS = [
    {
      id: "stroop",
      number: "01",
      name: "Stroop 色词干扰",
      shortDescription: "忽略文字含义，只判断字体颜色，体验自动阅读对当前任务的干扰。",
      category: "注意与执行控制",
      taskType: "选择反应",
      duration: "约 3 分钟",
      metrics: ["正确率", "平均反应时", "干扰效应"],
      tags: ["注意", "自动化加工", "冲突控制"],
      descriptionPath: "./paradigms/builtin/stroop/description.md",
      mode: "builtin",
      status: "ready",
    },
    {
      id: "flanker",
      number: "02",
      name: "Flanker 侧抑制任务",
      shortDescription: "判断中央箭头方向，同时抑制两侧无关箭头带来的反应冲突。",
      category: "注意与执行控制",
      taskType: "选择反应",
      duration: "约 3 分钟",
      metrics: ["正确率", "平均反应时", "冲突效应"],
      tags: ["执行控制", "选择性注意", "冲突抑制"],
      descriptionPath: "./paradigms/builtin/flanker/description.md",
      mode: "builtin",
      status: "ready",
    },
    {
      id: "gonogo",
      number: "03",
      name: "Go / No-Go 任务",
      shortDescription: "对高频 Go 信号快速反应，在 No-Go 信号出现时抑制已经准备好的动作。",
      category: "注意与执行控制",
      taskType: "反应抑制",
      duration: "约 3 分钟",
      metrics: ["正确率", "平均反应时", "抑制成功率"],
      tags: ["反应抑制", "冲动控制", "持续注意"],
      descriptionPath: "./paradigms/builtin/gonogo/description.md",
      mode: "builtin",
      status: "ready",
    },
  ];

  function getParadigms({ includeReview = false } = {}) {
    const imported = Array.isArray(global.IMPORTED_PARADIGMS) ? global.IMPORTED_PARADIGMS : [];
    return [...BUILTIN_PARADIGMS, ...imported]
      .filter((item) => includeReview || item.status === "ready")
      .map((item, index) => ({
        ...item,
        number: item.number || String(index + 1).padStart(2, "0"),
        name: item.name || item.title || item.id,
        shortDescription: item.shortDescription || item.description || "",
        taskType: item.taskType || item.platform || "行为任务",
        duration: item.duration || "时长见说明",
        metrics: Array.isArray(item.metrics) ? item.metrics : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
        mode: item.mode || "package",
      }));
  }

  function findParadigm(id, options) {
    return getParadigms(options).find((item) => item.id === id) || null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value, { image = false } = {}) {
    const url = String(value || "").trim();
    if (!url || /^(?:javascript|vbscript|data):/i.test(url)) return "";
    if (image && /^https?:/i.test(url)) return "";
    return url;
  }

  function renderInline(value) {
    let text = escapeHtml(value);
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, url) => {
      const safe = safeUrl(url, { image: true });
      return safe ? `<img src="${escapeHtml(safe)}" alt="${alt}" loading="lazy" />` : alt;
    });
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, url) => {
      const safe = safeUrl(url);
      return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    });
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    return text;
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || "").replaceAll("\r\n", "\n").split("\n");
    const output = [];
    let paragraph = [];
    let listType = null;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (!listType) return;
      output.push(`</${listType}>`);
      listType = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      const quote = line.match(/^>\s?(.*)$/);

      if (!line.trim()) {
        flushParagraph();
        closeList();
      } else if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      } else if (unordered || ordered) {
        flushParagraph();
        const nextType = unordered ? "ul" : "ol";
        if (listType !== nextType) {
          closeList();
          listType = nextType;
          output.push(`<${listType}>`);
        }
        output.push(`<li>${renderInline((unordered || ordered)[1])}</li>`);
      } else if (quote) {
        flushParagraph();
        closeList();
        output.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      } else if (/^---+$/.test(line.trim())) {
        flushParagraph();
        closeList();
        output.push("<hr />");
      } else {
        paragraph.push(line.trim());
      }
    }
    flushParagraph();
    closeList();
    return output.join("\n");
  }

  function summarizeBartRows(rows, fields = {}) {
    const pumpsField = fields.pumps || "nPumps";
    const poppedField = fields.popped || "popped";
    const earningsField = fields.earnings || "earnings";
    const valid = (Array.isArray(rows) ? rows : []).map((row) => ({
      pumps: Number(row?.[pumpsField]),
      popped: parseBoolean(row?.[poppedField]),
      earnings: Number(row?.[earningsField]),
    })).filter((row) => Number.isFinite(row.pumps) && row.popped !== null);
    const banked = valid.filter((row) => !row.popped);
    const earnings = valid.map((row) => row.earnings).filter(Number.isFinite);
    return {
      count: valid.length,
      bankedCount: banked.length,
      adjustedPumps: banked.length ? banked.reduce((sum, row) => sum + row.pumps, 0) / banked.length : null,
      burstRate: valid.length ? valid.filter((row) => row.popped).length / valid.length * 100 : null,
      totalEarnings: earnings.reduce((sum, value) => sum + value, 0),
    };
  }

  function inferPsychoJsResult(sample, csvTexts = []) {
    const fields = [...new Set([...String(sample || "").matchAll(/\.addData\s*\(\s*["']([^"']+)["']/g)].map((match) => match[1]))];
    const correct = fields.find((field) => /(?:^|[._])corr(?:ect)?$/i.test(field)) || "correct";
    const pairedRt = correct.replace(/(?:corr|correct)$/i, "rt");
    const rt = fields.includes(pairedRt) ? pairedRt : fields.find((field) => /(?:^|[._])rt$/i.test(field)) || "rt";
    let condition = "condition";
    let levels = [];
    for (const csv of csvTexts) {
      const lines = String(csv || "").replaceAll("\r\n", "\n").split("\n").filter(Boolean);
      if (lines.length < 2) continue;
      const headers = parseCsvRow(lines[0]);
      const index = headers.findIndex((header) => /condition|trial.?type|congruen/i.test(header));
      if (index < 0) continue;
      const values = [...new Set(lines.slice(1, 301).map((line) => parseCsvRow(line)[index]?.trim()).filter(Boolean))];
      if (values.length >= 2 && values.length <= 12) {
        condition = headers[index].trim();
        levels = values;
        break;
      }
    }
    return { profile: levels.length === 2 ? "difference" : "generic", fields: { correct, rt, condition }, levels };
  }

  function reconcileResultFields(rows, configured = {}) {
    const available = [...new Set((Array.isArray(rows) ? rows : []).flatMap((row) => row && typeof row === "object" ? Object.keys(row) : []))];
    const exact = (field) => available.includes(field) ? field : "";
    const correct = exact(configured.correct) || available.find((field) => /(?:^|[._])corr(?:ect)?$/i.test(field)) || configured.correct || "correct";
    const pairedRt = correct.replace(/(?:corr|correct)$/i, "rt");
    const rt = exact(configured.rt) || exact(pairedRt) || available.find((field) => /(?:^|[._])rt$/i.test(field)) || configured.rt || "rt";
    const condition = exact(configured.condition) || available.find((field) => /condition|trial.?type|congruen/i.test(field)) || configured.condition || "condition";
    return { ...configured, correct, rt, condition };
  }

  function inferPsychoJsMetadata({ name = "", readme = "", sample = "", result = {} } = {}) {
    const context = `${name}\n${readme}\n${sample.slice(0, 200000)}`;
    const changeTask = /change detection|change locali[sz]ation/i.test(context);
    const category = changeTask ? "工作记忆"
      : /attention|stroop|flanker|inhibition/i.test(context) ? "注意与执行控制"
        : /decision|risk|reward/i.test(context) ? "决策与奖赏" : "认知心理学实验";
    const taskType = changeTask ? "变化检测与定位" : "行为任务";
    const duration = changeTask ? "约 10 分钟" : "约 5–10 分钟";
    const license = /\bMIT\b/i.test(readme) ? "MIT"
      : /Apache(?: License)?(?:,? Version)? 2\.0|Apache-2\.0/i.test(readme) ? "Apache-2.0"
        : "来源仓库未声明；发布前请核对授权";
    const cleanName = String(name || taskType).replace(/\s*\[PsychoPy\]\s*/i, "").trim();
    const correct = result.fields?.correct || "correct";
    const rt = result.fields?.rt || "rt";
    const condition = result.fields?.condition || "condition";
    const reference = String(readme).split(/\r?\n/).find((line) => /doi\.org|\(20\d{2}\)/i.test(line))?.trim() || "请以来源仓库 README 与原始论文为准。";
    if (changeTask) {
      return {
        name: "变化检测与变化定位任务", category, taskType, duration, license,
        summary: "通过变化检测与变化定位任务测量视觉工作记忆表现，比较相同与变化条件下的正确率和反应时。",
        description: `# 学习目标\n\n理解变化检测和变化定位范式如何测量视觉工作记忆，并能够解释正确率、反应时及条件差异。\n\n# 实验原理\n\n视觉工作记忆容量有限。被试短暂记忆一组彩色方块，随后判断指定位置的颜色是否改变，或指出发生变化的位置。表现越准确，通常说明对视觉信息的保持与比较越稳定。\n\n# 任务流程\n\n1. 观察并记忆屏幕上的 6 个彩色方块。\n2. 在变化检测阶段，判断指定位置的颜色与记忆画面相同还是不同，并按 Y 或 N。\n3. 在变化定位阶段，比较前后两组方块，并按 1–6 指出颜色发生变化的位置。\n4. 程序记录每次反应的正确性、按键和反应时。\n\n# 核心指标\n\n- **变化检测正确率**：字段 \`${correct}\`，数值越高表示判断越准确。\n- **变化检测反应时**：字段 \`${rt}\`，在保证准确的前提下越短表示反应越快。\n- **变化定位正确率**：字段 \`localisation_resp.corr\`，反映识别变化位置的能力。\n- **实验条件**：字段 \`${condition}\`，用于比较相同与变化试次。\n\n# 结果解读\n\n应同时查看正确率和反应时，避免把单纯的快速反应解释为更好的表现。相同与变化条件之间的差异可反映任务难度或判断偏向；变化定位正确率可作为视觉工作记忆表现的补充指标。\n\n# 注意事项\n\n请在安静环境中使用键盘完成任务，保持注视屏幕中央，并在发布前完整试做一次，确认材料、按键和结果回传均正常。\n\n# 来源与参考\n\n${reference}`,
      };
    }
    return {
      name: cleanName, category, taskType, duration, license,
      summary: `${cleanName}用于演示${category}中的${taskType}，记录正确率与反应时。`,
      description: `# 学习目标\n\n理解${cleanName}的基本流程，并能够根据正确率和反应时解释任务表现。\n\n# 实验原理\n\n本任务通过标准化刺激和按键反应测量认知加工表现。\n\n# 任务流程\n\n阅读指导语后完成全部试次，并按照屏幕提示作答。\n\n# 核心指标\n\n- 正确字段：\`${correct}\`\n- 反应时字段：\`${rt}\`\n- 条件字段：\`${condition}\`\n\n# 结果解读\n\n应结合正确率与反应时综合判断，避免只依据单一指标下结论。\n\n# 注意事项\n\n发布前请完整试做，确认刺激、按键与结果回传正常。\n\n# 来源与参考\n\n${reference}`,
    };
  }

  function parseCsvRow(line) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === "," && !quoted) { cells.push(cell); cell = ""; }
      else cell += character;
    }
    cells.push(cell);
    return cells;
  }

  function parseBoolean(value) {
    if (value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true") return true;
    if (value === false || value === 0 || value === "0" || String(value).toLowerCase() === "false") return false;
    return null;
  }

  global.CognitionPlatform = Object.freeze({
    BUILTIN_PARADIGMS,
    getParadigms,
    findParadigm,
    escapeHtml,
    renderMarkdown,
    inferPsychoJsResult,
    reconcileResultFields,
    inferPsychoJsMetadata,
    summarizeBartRows,
    safeUrl,
  });
})(window);

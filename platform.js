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

  global.CognitionPlatform = Object.freeze({
    BUILTIN_PARADIGMS,
    getParadigms,
    findParadigm,
    escapeHtml,
    renderMarkdown,
    safeUrl,
  });
})(window);

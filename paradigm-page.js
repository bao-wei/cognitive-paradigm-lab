(async function initializeParadigmPage() {
  "use strict";

  const platform = window.CognitionPlatform;
  const id = new URLSearchParams(window.location.search).get("id") || "";
  const item = platform.findParadigm(id);
  const loading = document.querySelector("#paradigm-loading");
  const error = document.querySelector("#paradigm-error");

  if (!item) {
    loading.hidden = true;
    error.hidden = false;
    return;
  }

  document.title = `${item.name}｜知觉之间`;
  document.querySelector("#paradigm-domain").textContent = `${item.category} · ${item.taskType}`;
  document.querySelector("#paradigm-title").textContent = item.name;
  document.querySelector("#paradigm-lead").textContent = item.shortDescription;
  document.querySelector("#paradigm-duration").textContent = item.duration;
  document.querySelector("#paradigm-task").textContent = item.taskType;
  document.querySelector("#paradigm-metrics").replaceChildren(...(item.metrics.length ? item.metrics : ["见范式说明"]).map((metric) => {
    const li = document.createElement("li");
    li.textContent = metric;
    return li;
  }));

  try {
    const markdown = await loadDescription(item);
    document.querySelector("#markdown-body").innerHTML = platform.renderMarkdown(markdown);
  } catch (cause) {
    document.querySelector("#markdown-body").innerHTML = `<p>${platform.escapeHtml(item.shortDescription)}</p><blockquote>说明文件暂时无法加载，请返回目录后稍后重试。</blockquote>`;
  }

  const buttons = [document.querySelector("#start-experiment-top"), document.querySelector("#start-experiment-bottom")];
  buttons.forEach((button) => configureStart(button, item));
  loading.hidden = true;
  document.querySelector("#paradigm-hero").hidden = false;
  document.querySelector("#paradigm-reading").hidden = false;

  async function loadDescription(paradigm) {
    if (!paradigm.descriptionPath) return `# ${paradigm.name}\n\n${paradigm.shortDescription}`;
    const response = await fetch(paradigm.descriptionPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`说明文件加载失败：${response.status}`);
    return response.text();
  }

  function configureStart(button, paradigm) {
    if (paradigm.mode === "builtin") {
      button.addEventListener("click", () => window.CognitionExperiment?.open(paradigm.id));
      return;
    }
    if (paradigm.entry) {
      button.addEventListener("click", () => window.location.assign(`./runner.html?id=${encodeURIComponent(paradigm.id)}`));
      return;
    }
    button.disabled = true;
    button.textContent = "实验暂不可用";
  }
})();

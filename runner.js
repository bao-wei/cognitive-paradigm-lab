(function initializeRunner() {
  "use strict";

  const platform = window.CognitionPlatform;
  const id = new URLSearchParams(window.location.search).get("id") || "";
  const item = platform.findParadigm(id);
  const frame = document.querySelector("#experiment-frame");
  const wait = document.querySelector("#runner-wait");
  const error = document.querySelector("#runner-error");
  const results = document.querySelector("#runner-results");
  let rows = [];

  document.querySelector("#runner-exit").addEventListener("click", exitRunner);
  document.querySelector("#runner-export").addEventListener("click", exportCsv);
  document.querySelector("#runner-retry").href = window.location.href;
  window.addEventListener("message", receiveResult);

  if (!item || item.mode !== "package" || !item.entry || !item.result) {
    showError("这个范式尚未通过平台运行与结果协议检查。");
    return;
  }
  document.title = `${item.name}｜知觉之间`;
  document.querySelector("#runner-title").textContent = item.name;
  document.querySelector("#runner-back").href = `./paradigm.html?id=${encodeURIComponent(item.id)}`;
  frame.src = item.entry;
  frame.hidden = false;
  wait.hidden = true;
  document.querySelector("#runner-status").textContent = "实验数据只保留在当前页面";

  function receiveResult(event) {
    if (event.source !== frame.contentWindow || !event.data || event.data.type !== "cognition-lab:complete") return;
    const received = Array.isArray(event.data.trials) ? event.data.trials : Array.isArray(event.data.results) ? event.data.results : [];
    if (!received.length) {
      showError("实验已结束，但没有返回逐试次数据。请联系平台管理员检查该范式。");
      return;
    }
    rows = received;
    try { renderResult(); } catch (cause) { showError(`结果字段无法解析：${cause.message}`); }
  }

  function renderResult() {
    const config = item.result;
    const correctField = config.fields.correct;
    const rtField = config.fields.rt;
    if (!rows.some((row) => Object.hasOwn(row, correctField)) || !rows.some((row) => Object.hasOwn(row, rtField))) {
      throw new Error(`缺少 ${correctField} 或 ${rtField}`);
    }
    const correctRows = rows.filter((row) => truthy(row[correctField]));
    const accuracy = rows.length ? correctRows.length / rows.length * 100 : 0;
    const mean = meanRt(correctRows, rtField);
    const effect = calculateEffect(rows, config);
    document.querySelector("#runner-result-note").textContent = `${item.name} · ${rows.length} 个有效试次。单次短测仅用于理解范式。`;
    document.querySelector("#runner-accuracy").textContent = `${Math.round(accuracy)}%`;
    document.querySelector("#runner-rt").textContent = mean === null ? "—" : `${Math.round(mean)} ms`;
    document.querySelector("#runner-effect-label").textContent = effect.label;
    document.querySelector("#runner-effect").textContent = effect.value;
    document.querySelector("#runner-effect-note").textContent = effect.note;
    document.querySelector("#runner-explanation").textContent = effect.explanation;
    frame.hidden = true;
    results.hidden = false;
    document.querySelector("#runner-status").textContent = "实验完成 · 结果未上传";
  }

  function calculateEffect(data, config) {
    if (config.profile === "generic") return {
      label: "有效试次",
      value: String(data.length),
      note: "实验返回的逐试次记录",
      explanation: "本页汇总本次正确率与正确反应时。请结合范式说明理解各项指标，单次短测结果不能用于个人能力评价。",
    };
    const [first, second] = config.levels;
    const condition = config.fields.condition;
    const rt = config.fields.rt;
    const firstMean = meanRt(data.filter((row) => truthy(row[config.fields.correct]) && String(row[condition]) === first), rt);
    const secondMean = meanRt(data.filter((row) => truthy(row[config.fields.correct]) && String(row[condition]) === second), rt);
    const difference = firstMean === null || secondMean === null ? null : firstMean - secondMean;
    const dotProbe = config.profile === "dot-probe";
    return {
      label: dotProbe ? "注意偏向分数" : "条件差异",
      value: difference === null ? "数据不足" : `${difference >= 0 ? "+" : "−"}${Math.abs(Math.round(difference))} ms`,
      note: `${first} − ${second}`,
      explanation: difference === null
        ? "至少一个条件没有足够的正确反应，因此本次无法计算条件差异。你仍可导出逐试次数据检查。"
        : `${first} 条件与 ${second} 条件相差 ${Math.abs(Math.round(difference))} ms。分数方向和心理学含义请以本范式说明页为准。`,
    };
  }

  function exportCsv() {
    if (!rows.length) return;
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const csv = [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))]
      .map((line) => line.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.id}-result-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV 已生成，请在下载文件夹中查看");
  }

  function exitRunner() {
    if (rows.length && !window.confirm("退出后，本次未导出的结果将被清除。确定退出吗？")) return;
    window.location.assign(`./paradigm.html?id=${encodeURIComponent(id)}`);
  }

  function showError(message) {
    frame.hidden = true;
    wait.hidden = true;
    results.hidden = true;
    error.hidden = false;
    document.querySelector("#runner-error-message").textContent = message;
    document.querySelector("#runner-status").textContent = "实验无法启动";
  }

  function meanRt(data, field) { const values = data.map((row) => Number(row[field])).filter(Number.isFinite); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
  function truthy(value) { return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true"; }
  function csvCell(value) { const text = String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
  function showToast(message) { const toast = document.querySelector("#toast"); toast.textContent = message; toast.classList.add("show"); window.setTimeout(() => toast.classList.remove("show"), 2600); }
})();

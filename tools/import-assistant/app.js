(() => {
  const token = "__ASSISTANT_TOKEN__";
  const disconnectedMessage = "本地导入发布助手已断开。请重新双击“启动范式导入发布助手.cmd”，并在新打开的页面继续操作。";
  const state = { environment: null, previewToken: null, verified: false, publishing: false };
  const elements = {
    environment: document.querySelector("#environment-list"),
    targetRepository: document.querySelector("#target-repository"),
    pavloviaForm: document.querySelector("#pavlovia-form"),
    pavloviaUrl: document.querySelector("#pavlovia-url"),
    pavloviaResult: document.querySelector("#pavlovia-result"),
    fileInput: document.querySelector("#change-pack-input"),
    drop: document.querySelector("#change-pack-drop"),
    uploadStatus: document.querySelector("#upload-status"),
    previewResult: document.querySelector("#preview-result"),
    verifyStatus: document.querySelector("#verify-status"),
    verifyResult: document.querySelector("#verify-result"),
    applyButton: document.querySelector("#apply-button"),
    publishStatus: document.querySelector("#publish-status"),
    publishResult: document.querySelector("#publish-result"),
    publishConfirm: document.querySelector("#publish-confirm"),
    publishButton: document.querySelector("#publish-button"),
    log: document.querySelector("#activity-log"),
    clearLog: document.querySelector("#clear-log"),
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  async function api(url, options = {}) {
    let response;
    try {
      response = await fetch(url, { ...options, headers: { "x-assistant-token": token, ...(options.headers || {}) } });
    } catch {
      throw new Error(disconnectedMessage);
    }
    const payload = await response.json().catch(() => ({ error: `请求失败（HTTP ${response.status}）` }));
    if (!response.ok) {
      const error = new Error(payload.error || `请求失败（HTTP ${response.status}）`);
      Object.assign(error, payload);
      throw error;
    }
    return payload;
  }

  function log(message, tone = "") {
    const item = document.createElement("li");
    item.className = tone;
    const now = new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    item.innerHTML = `<time>${now}</time><span>${escapeHtml(message)}</span>`;
    elements.log.append(item);
    item.scrollIntoView({ block: "nearest" });
  }

  function setTag(element, text, tone = "") {
    element.textContent = text;
    element.className = `panel-tag ${tone}`.trim();
  }

  function setResult(element, html, tone = "") {
    element.hidden = false;
    element.className = `${element.id === "pavlovia-result" ? "inline-result" : "action-summary"} ${tone}`.trim();
    element.innerHTML = html;
  }

  function markStep(step, status) {
    const marker = document.querySelector(`[data-step-marker="${step}"]`);
    if (status === "done") marker.classList.add("done");
    if (status === "active") marker.classList.add("active");
  }

  async function loadEnvironment() {
    try {
      const value = await api("/api/status");
      state.environment = value;
      elements.environment.innerHTML = `
        <div><dt>本地服务</dt><dd class="status-good">已连接 · ${escapeHtml(value.node)}</dd></div>
        <div><dt>GitHub</dt><dd class="${value.ghAuthenticated ? "status-good" : "status-bad"}">${value.ghAuthenticated ? "已登录" : "未登录"}</dd></div>
        <div><dt>目标仓库</dt><dd>${escapeHtml(value.repository || "未识别")}</dd></div>
        <div title="${escapeHtml(value.projectRoot)}"><dt>项目目录</dt><dd>${escapeHtml(value.projectRoot)}</dd></div>`;
      elements.targetRepository.textContent = value.repository || "未识别仓库";
      log(value.ghAuthenticated ? `环境检查通过，目标仓库：${value.repository}` : "本地服务正常，但 GitHub CLI 尚未登录。", value.ghAuthenticated ? "success" : "error");
    } catch (error) {
      log(error.message, "error");
    }
  }

  async function openWorkbench(event) {
    const link = event.target.closest('a[href="/site/admin.html"]');
    if (!link) return;
    event.preventDefault();
    const target = window.open("about:blank", "_blank");
    try {
      await api("/api/status");
      const destination = new URL(link.href);
      if (!new URLSearchParams(destination.hash.slice(1)).has("token")) destination.hash = `token=${encodeURIComponent(token)}`;
      if (target) target.location.href = destination.href;
      else window.location.href = destination.href;
    } catch (error) {
      target?.close();
      window.alert(error.message);
      log(error.message, "error");
    }
  }

  async function preparePavlovia(event) {
    event.preventDefault();
    const button = elements.pavloviaForm.querySelector("button");
    button.disabled = true;
    setResult(elements.pavloviaResult, "正在下载并排除数据目录，请不要关闭页面…", "processing");
    log("开始读取 Pavlovia 公开项目。", "");
    try {
      const value = await api("/api/pavlovia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: elements.pavloviaUrl.value }) });
      setResult(elements.pavloviaResult, `<p><strong>待配置源码已整理完成</strong></p><p>保留 ${value.fileCount} 个文件（${formatBytes(value.bytes)}），排除 ${value.removed} 个数据或生成文件，自动完成 ${value.adapted} 项技术适配。</p><p>下一步请在工作台审核自动预填结果；只有工作台最后导出的 ZIP 才是第 02 步使用的变更包。</p><p><a class="button button-secondary" href="${escapeHtml(value.adminUrl)}" target="_blank">打开工作台并自动载入</a> · <a class="text-link" href="${escapeHtml(value.downloadUrl)}">另存源码 ZIP</a></p>`, "");
      markStep(1, "done");
      log(`Pavlovia 来源已整理：${value.fileCount} 个文件。`, "success");
    } catch (error) {
      setResult(elements.pavloviaResult, `<strong>整理失败：</strong>${escapeHtml(error.message)}`, "error");
      log(`Pavlovia 整理失败：${error.message}`, "error");
    } finally { button.disabled = false; }
  }

  async function readChangePack(file) {
    if (!file) return;
    state.previewToken = null;
    state.verified = false;
    elements.applyButton.disabled = true;
    elements.publishConfirm.checked = false;
    elements.publishConfirm.disabled = true;
    elements.publishButton.disabled = true;
    setTag(elements.uploadStatus, "正在读取", "processing");
    setResult(elements.previewResult, `正在解压并预演 ${escapeHtml(file.name)}…`, "processing");
    log(`开始预演变更包：${file.name}`);
    try {
      const value = await api("/api/upload", { method: "POST", headers: { "Content-Type": "application/zip", "x-file-name": file.name }, body: file });
      state.previewToken = value.previewToken;
      const actions = [
        ["新增", value.actions.add],
        ["替换", value.actions.replace],
        ["删除", value.actions.delete],
      ];
      setTag(elements.uploadStatus, "预演通过", "success");
      setResult(elements.previewResult, `<p><strong>${escapeHtml(file.name)}</strong> 已通过结构预演。</p><ul class="summary-list">${actions.map(([label, ids]) => `<li>${label} ${ids.length}：${escapeHtml(ids.join(", ") || "无")}</li>`).join("")}</ul>`, "");
      elements.applyButton.disabled = false;
      setTag(elements.verifyStatus, "可以开始", "");
      markStep(1, "done");
      markStep(2, "done");
      markStep(3, "active");
      log("变更包预演通过，尚未修改本地范式库。", "success");
    } catch (error) {
      if (error.kind === "source-package") {
        setTag(elements.uploadStatus, "需要先配置", "processing");
        setResult(elements.previewResult, `<p><strong>已识别为待配置源码包</strong></p><p>${escapeHtml(error.message)}</p><p><a class="button button-secondary" href="${escapeHtml(error.adminUrl)}" target="_blank">打开工作台并自动载入</a></p>`, "processing");
      } else {
        setTag(elements.uploadStatus, "预演失败", "error");
        setResult(elements.previewResult, `<strong>未应用任何变更：</strong>${escapeHtml(error.message)}`, "error");
      }
      log(`变更包预演失败：${error.message}`, "error");
    }
  }

  async function applyAndVerify() {
    elements.applyButton.disabled = true;
    setTag(elements.verifyStatus, "正在处理", "processing");
    setResult(elements.verifyResult, "正在备份、应用、重建目录并逐项执行自动检查…", "processing");
    log("开始应用本地变更并运行全部自检。");
    try {
      const value = await api("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ previewToken: state.previewToken }) });
      state.verified = true;
      setTag(elements.verifyStatus, "全部通过", "success");
      setResult(elements.verifyResult, `<p><strong>${value.tests.length} 项自动检查全部通过</strong>，目录现在包含 ${value.catalogCount} 个扩展范式。</p><ul class="summary-list">${value.tests.map((test) => `<li>${escapeHtml(test.file)}</li>`).join("")}</ul>${value.backupRoot ? `<p>可恢复备份：${escapeHtml(value.backupRoot)}</p>` : ""}`, "");
      elements.publishConfirm.disabled = !(state.environment?.ghAuthenticated && state.environment?.repository);
      setTag(elements.publishStatus, "等待确认", "");
      markStep(3, "done");
      markStep(4, "active");
      log("本地应用完成，全部自动检查通过。", "success");
    } catch (error) {
      setTag(elements.verifyStatus, "检查失败", "error");
      setResult(elements.verifyResult, `<strong>未进入发布：</strong>${escapeHtml(error.message)}`, "error");
      elements.applyButton.disabled = false;
      log(`应用或自检失败：${error.message}`, "error");
    }
  }

  async function publish() {
    if (!state.environment?.repository || state.publishing) return;
    state.publishing = true;
    elements.publishButton.disabled = true;
    elements.publishConfirm.disabled = true;
    setTag(elements.publishStatus, "正在提交", "processing");
    setResult(elements.publishResult, `正在向 ${escapeHtml(state.environment.repository)} 创建原子提交…`, "processing");
    log(`开始发布到 ${state.environment.repository}。`);
    try {
      const value = await api("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: state.environment.repository }) });
      setResult(elements.publishResult, `<p><strong>GitHub 已接受提交</strong>：<a class="text-link" href="${escapeHtml(value.commitUrl)}" target="_blank" rel="noreferrer">${escapeHtml(value.sha.slice(0, 8))}</a></p><p id="deployment-line">正在等待 GitHub Pages 工作流出现…</p>`, "processing");
      setTag(elements.publishStatus, "等待部署", "processing");
      log(`提交已写入 main：${value.sha.slice(0, 8)}。`, "success");
      await waitForDeployment(value.siteUrl);
    } catch (error) {
      setTag(elements.publishStatus, "发布失败", "error");
      setResult(elements.publishResult, `<strong>发布未完成：</strong>${escapeHtml(error.message)}`, "error");
      elements.publishConfirm.disabled = false;
      log(`发布失败：${error.message}`, "error");
    } finally { state.publishing = false; }
  }

  async function waitForDeployment(siteUrl) {
    const line = () => document.querySelector("#deployment-line");
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 3 ? 2500 : 5000));
      const value = await api("/api/deployment");
      if (value.url && line()) line().innerHTML = `部署状态：${escapeHtml(value.status)} · <a class="text-link" href="${escapeHtml(value.url)}" target="_blank" rel="noreferrer">查看工作流</a>`;
      if (value.status === "completed" && value.conclusion === "success") {
        setTag(elements.publishStatus, "网页已上线", "success");
        setResult(elements.publishResult, `<p><strong>发布完成，GitHub Pages 已成功部署。</strong></p><p><a class="button button-secondary" href="${escapeHtml(siteUrl)}" target="_blank" rel="noreferrer">打开公开网站</a> <a class="text-link" href="${escapeHtml(value.url)}" target="_blank" rel="noreferrer">查看部署记录</a></p>`, "");
        markStep(4, "done");
        log("GitHub Pages 返回成功，公开网页已经更新。", "success");
        return;
      }
      if (value.status === "completed") throw new Error(`GitHub Pages 部署结束，但结果为 ${value.conclusion || "未知"}；请打开工作流查看原因`);
    }
    throw new Error("提交已成功，但等待部署超过 7 分钟；可稍后从 GitHub Actions 查看结果");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  elements.pavloviaForm.addEventListener("submit", preparePavlovia);
  document.addEventListener("click", openWorkbench);
  elements.fileInput.addEventListener("change", () => readChangePack(elements.fileInput.files[0]));
  for (const eventName of ["dragenter", "dragover"]) elements.drop.addEventListener(eventName, (event) => { event.preventDefault(); elements.drop.classList.add("dragging"); });
  for (const eventName of ["dragleave", "drop"]) elements.drop.addEventListener(eventName, (event) => { event.preventDefault(); elements.drop.classList.remove("dragging"); });
  elements.drop.addEventListener("drop", (event) => readChangePack([...event.dataTransfer.files].find((file) => file.name.toLowerCase().endsWith(".zip"))));
  elements.applyButton.addEventListener("click", applyAndVerify);
  elements.publishConfirm.addEventListener("change", () => { elements.publishButton.disabled = !(elements.publishConfirm.checked && state.verified); });
  elements.publishButton.addEventListener("click", publish);
  elements.clearLog.addEventListener("click", () => { elements.log.innerHTML = ""; log("显示记录已清空；磁盘与 GitHub 内容没有改变。"); });
  document.querySelector("#activity-log time").textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  loadEnvironment();
})();

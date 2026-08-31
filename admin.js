(function initializeAdmin() {
  "use strict";

  const PASSWORD_DIGEST = "fb458c8277f408161128ab4ddeedd42c786715ebd780d2ce3f5fa0137fb4de22";
  const SESSION_KEY = "cognition-lab-admin-session";
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const platform = window.CognitionPlatform;
  const archive = window.CognitionArchive;
  const published = platform.getParadigms({ includeReview: true });
  const state = {
    files: new Map(),
    packageName: "",
    runtimePassed: false,
    runtimeRows: [],
    objectUrls: [],
    staged: new Map(),
    deletions: new Set(),
    checks: [],
  };

  const elements = Object.fromEntries([
    "admin-login", "login-form", "admin-password", "login-error", "admin-workspace", "admin-logout",
    "zip-input", "folder-input", "package-status", "metadata-panel", "description-panel", "validation-panel", "file-summary",
    "field-id", "field-name", "field-category", "field-task", "field-duration", "field-entry", "field-license", "field-profile",
    "field-correct", "field-rt", "field-condition", "field-levels", "field-summary", "field-source", "markdown-input",
    "description-editor", "description-preview", "run-validation", "validation-list", "open-preview", "close-preview",
    "validation-summary", "validation-actions", "validation-details-summary",
    "experiment-preview", "preview-frame", "runtime-status", "manual-confirmation", "stage-package", "library-list",
    "change-list", "change-count", "export-changes", "toast",
  ].map((id) => [camel(id), document.getElementById(id)]));

  if (sessionStorage.getItem(SESSION_KEY) === "granted") showWorkspace();
  elements.loginForm.addEventListener("submit", authenticate);
  elements.adminLogout.addEventListener("click", logout);
  elements.zipInput.addEventListener("change", loadZip);
  elements.folderInput.addEventListener("change", loadFolder);
  elements.markdownInput.addEventListener("change", loadMarkdown);
  elements.descriptionEditor.addEventListener("input", () => {
    renderDescription();
    validatePackage();
  });
  document.querySelectorAll("#metadata-panel input, #metadata-panel select, #manual-confirmation").forEach((control) => {
    control.addEventListener("input", validatePackage);
    control.addEventListener("change", validatePackage);
  });
  elements.runValidation.addEventListener("click", validatePackage);
  elements.openPreview.addEventListener("click", openPreview);
  elements.closePreview.addEventListener("click", closePreview);
  elements.stagePackage.addEventListener("click", stagePackage);
  elements.exportChanges.addEventListener("click", exportChanges);
  window.addEventListener("message", receivePreviewMessage);
  renderLibrary();
  renderChanges();

  async function authenticate(event) {
    event.preventDefault();
    const digest = await sha256(elements.adminPassword.value);
    if (digest !== PASSWORD_DIGEST) {
      elements.loginError.textContent = "密码不正确，请重新输入。";
      elements.adminPassword.select();
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "granted");
    elements.adminPassword.value = "";
    elements.loginError.textContent = "";
    showWorkspace();
  }

  function showWorkspace() {
    elements.adminLogin.hidden = true;
    elements.adminWorkspace.hidden = false;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    closePreview();
    elements.adminWorkspace.hidden = true;
    elements.adminLogin.hidden = false;
    elements.adminPassword.focus();
  }

  async function loadZip() {
    const file = elements.zipInput.files[0];
    if (!file) return;
    setPackageStatus("正在解压并检查…", "working");
    try {
      const { files, ignored } = await archive.readZip(file);
      await acceptFiles(files, file.name.replace(/\.zip$/i, ""), ignored);
    } catch (error) {
      resetPackage();
      setPackageStatus(error.message, "error");
    } finally {
      elements.zipInput.value = "";
    }
  }

  async function loadFolder() {
    const selected = [...elements.folderInput.files];
    if (!selected.length) return;
    setPackageStatus("正在读取文件夹…", "working");
    try {
      if (selected.length > 10000) throw new Error("文件夹超过 10000 个条目的安全限制");
      const total = selected.reduce((sum, file) => sum + file.size, 0);
      if (total > 100 * 1024 * 1024) throw new Error("文件夹超过 100 MB 的限制");
      const files = new Map();
      const ignored = { count: 0, bytes: 0 };
      for (const file of selected) {
        const path = file.webkitRelativePath || file.name;
        archive.assertSafePath(path);
        if (archive.shouldIgnoreImportPath(path)) {
          ignored.count += 1;
          ignored.bytes += file.size;
          continue;
        }
        if (files.size >= 1000) throw new Error("文件夹包含超过 1000 个有效文件，请精简后重试");
        files.set(path.replaceAll("\\", "/"), new Uint8Array(await file.arrayBuffer()));
      }
      const root = selected[0].webkitRelativePath?.split("/")[0] || "experiment-package";
      await acceptFiles(files, root, ignored);
    } catch (error) {
      resetPackage();
      setPackageStatus(error.message, "error");
    } finally {
      elements.folderInput.value = "";
    }
  }

  async function acceptFiles(rawFiles, packageName, ignored = { count: 0, bytes: 0 }) {
    closePreview();
    state.files = stripCommonRoot(rawFiles);
    state.packageName = packageName;
    state.runtimePassed = false;
    state.runtimeRows = [];
    elements.manualConfirmation.checked = false;
    const manifest = readJson("manifest.json") || readJson("paradigm.json") || {};
    const idGuess = slug(manifest.id || packageName);
    setValue("field-id", idGuess);
    setValue("field-name", manifest.name || manifest.title || titleFromEntry() || packageName);
    setValue("field-category", manifest.category || "");
    setValue("field-task", manifest.taskType || manifest.platform || "行为任务");
    setValue("field-duration", manifest.duration || "");
    setValue("field-entry", manifest.entry || findEntry());
    setValue("field-license", manifest.license || (hasLicense() ? "见包内 LICENSE 文件" : ""));
    setValue("field-profile", manifest.result?.profile || manifest.resultProfile || "generic");
    setValue("field-correct", manifest.result?.fields?.correct || "correct");
    setValue("field-rt", manifest.result?.fields?.rt || "rt");
    setValue("field-condition", manifest.result?.fields?.condition || "condition");
    setValue("field-levels", (manifest.result?.levels || []).join(", "));
    setValue("field-summary", manifest.shortDescription || manifest.description || "");
    setValue("field-source", manifest.source || "");
    elements.descriptionEditor.value = readText("description.md") || readText("README.md") || "";
    elements.fileSummary.textContent = `${state.files.size} 个文件 · ${formatBytes(totalSize(state.files))}${ignored.count ? ` · 已忽略 ${ignored.count} 个历史数据或无关文件` : ""}`;
    elements.metadataPanel.hidden = false;
    elements.descriptionPanel.hidden = false;
    elements.validationPanel.hidden = false;
    setPackageStatus(`已读取 ${packageName}${ignored.count ? `，已忽略 ${ignored.count} 个历史数据或无关文件` : ""}`, "success");
    renderDescription();
    validatePackage();
  }

  function resetPackage() {
    closePreview();
    state.files = new Map();
    state.runtimePassed = false;
    elements.metadataPanel.hidden = true;
    elements.descriptionPanel.hidden = true;
    elements.validationPanel.hidden = true;
  }

  async function loadMarkdown() {
    const file = elements.markdownInput.files[0];
    if (!file) return;
    elements.descriptionEditor.value = await file.text();
    elements.markdownInput.value = "";
    renderDescription();
    validatePackage();
  }

  function renderDescription() {
    const text = elements.descriptionEditor.value;
    elements.descriptionPreview.innerHTML = text.trim()
      ? platform.renderMarkdown(text)
      : "<p class=\"empty-copy\">输入 Markdown 后，这里会按学习者看到的样式实时预览。</p>";
  }

  function validatePackage() {
    if (!state.files.size) return;
    const checks = [];
    const add = (level, title, detail) => checks.push({ level, title, detail });
    const manifest = collectManifest();
    const requiredFields = [
      [manifest.id, "范式 ID"], [manifest.name, "范式名称"], [manifest.category, "认知领域"],
      [manifest.taskType, "任务类型"], [manifest.duration, "预计时长"], [manifest.entry, "入口文件"],
      [manifest.license, "许可证"], [manifest.shortDescription, "简短简介"],
    ];
    const missing = requiredFields.filter(([value]) => !String(value || "").trim()).map(([, label]) => label);
    add(missing.length ? "fail" : "pass", "基本信息", missing.length ? `缺少：${missing.join("、")}` : "必填字段已经填写");
    add(/^[a-z0-9][a-z0-9-]*$/.test(manifest.id) ? "pass" : "fail", "范式 ID", "只能使用小写字母、数字和连字符，且不能与现有范式误冲突");
    add(state.files.has(manifest.entry) ? "pass" : "fail", "实验入口", state.files.has(manifest.entry) ? `已找到 ${manifest.entry}` : `没有找到 ${manifest.entry || "指定入口"}`);

    const description = elements.descriptionEditor.value.trim();
    const sections = ["学习目标", "实验原理", "任务|流程|操作", "指标", "结果", "注意", "来源|参考"];
    const absent = sections.filter((name) => !new RegExp(name, "i").test(description));
    add(description.length >= 200 && absent.length === 0 ? "pass" : "fail", "范式说明", description.length < 200
      ? "说明内容过短，请完整介绍原理、流程、指标与结果含义"
      : absent.length ? `还需要包含：${absent.join("、")}` : "说明结构完整且可以安全渲染");

    const textSample = collectTextSample();
    const network = /fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|pavlovia\.org|ServerManager|\.upload\s*\(/i.test(textSample);
    const remoteAssets = /(?:src|href)\s*=\s*["']https?:\/\//i.test(textSample);
    add(!network && !remoteAssets ? "pass" : "fail", "数据与网络边界", network
      ? "检测到联网或数据上传代码；请移除 Pavlovia/服务器连接后再导出"
      : remoteAssets ? "检测到远程资源引用；请把依赖文件放入范式包" : "未发现常见联网或远程资源代码");

    const missingResources = findMissingResources(manifest.entry);
    add(missingResources.length ? "fail" : "pass", "资源引用", missingResources.length
      ? `缺少本地资源：${missingResources.slice(0, 5).join("、")}${missingResources.length > 5 ? "…" : ""}`
      : "入口页面引用的本地资源均存在");

    const hasBridge = /cognition-lab:complete/i.test(textSample);
    add(hasBridge ? "pass" : "fail", "平台完成事件", hasBridge
      ? "检测到 cognition-lab:complete 结果桥接事件"
      : "实验必须在结束时向父页面发送 cognition-lab:complete 事件和逐试次数据");

    const resultFields = [manifest.result.fields.correct, manifest.result.fields.rt].filter(Boolean);
    let resultOkay = resultFields.length === 2;
    let resultDetail = resultOkay ? `已配置 ${resultFields.join("、")} 字段，将在试运行时确认` : "请填写正确字段和反应时字段";
    const isBartTask = /addData\s*\(\s*["']nPumps["']/i.test(textSample) && /addData\s*\(\s*["']popped["']/i.test(textSample);
    if (isBartTask) {
      resultOkay = false;
      resultDetail = "检测到 BART：核心指标应为未爆炸气球的平均充气次数，而不是正确率与反应时；需要配置专用结果适配器";
    }
    else if (["difference", "dot-probe"].includes(manifest.result.profile)) {
      resultOkay = resultOkay && Boolean(manifest.result.fields.condition) && manifest.result.levels.length === 2;
      resultDetail = resultOkay ? `将比较 ${manifest.result.levels[0]} 与 ${manifest.result.levels[1]}` : "条件差异模板还需要条件字段和两个条件值";
    }
    add(resultOkay ? "pass" : "fail", "结果模板", resultDetail);

    add(state.runtimePassed ? "pass" : "warn", "运行结果回传", state.runtimePassed
      ? `预览已接收到 ${state.runtimeRows.length} 条试次数据`
      : "请打开预览并完整试做，系统尚未接收到完成事件");
    add(elements.manualConfirmation.checked ? "pass" : "warn", "管理员人工确认", elements.manualConfirmation.checked
      ? "已确认实验流程、材料与结果解释"
      : "完整试做后请勾选人工确认");

    state.checks = checks;
    renderValidationSummary(checks);
    elements.validationList.replaceChildren(...checks.map(renderCheck));
    const hasFailure = checks.some((check) => check.level === "fail");
    elements.stagePackage.disabled = hasFailure || !state.runtimePassed || !elements.manualConfirmation.checked;
    return !elements.stagePackage.disabled;
  }

  function renderValidationSummary(checks) {
    const failures = checks.filter((check) => check.level === "fail");
    const warnings = checks.filter((check) => check.level === "warn");
    const passes = checks.filter((check) => check.level === "pass").length;
    const basicFailure = failures.find((check) => check.title === "基本信息");
    const descriptionFailure = failures.find((check) => check.title === "范式说明");
    const technicalFailures = failures.filter((check) => !["基本信息", "范式说明"].includes(check.title));
    const actions = [];

    if (basicFailure) actions.push({ title: "补全范式信息", detail: basicFailure.detail, target: "metadata-panel" });
    if (descriptionFailure) actions.push({ title: "补充教学说明", detail: "请在上方说明区介绍学习目标、实验原理、操作流程、核心指标与结果含义。", target: "description-panel" });
    if (technicalFailures.length) actions.push({
      title: "实验程序需要技术适配",
      detail: `系统发现 ${technicalFailures.length} 类程序问题，例如运行依赖、核心指标或结果页接口。上传者无需逐项填写，可展开技术详情交由平台维护人员处理。`,
    });
    if (!failures.length && !state.runtimePassed) actions.push({ title: "进行一次完整试做", detail: "打开实验预览并完成任务，系统会自动确认结果是否成功返回。", target: "open-preview" });
    if (!failures.length && state.runtimePassed && !elements.manualConfirmation.checked) actions.push({ title: "确认试做结果", detail: "确认材料、流程和结果解释无误后，勾选下方人工确认。", target: "manual-confirmation" });

    const status = failures.length ? "需要处理" : warnings.length ? "等待试做" : "可以加入";
    const title = failures.length ? "这个范式还不能直接加入" : warnings.length ? "文件检查完成，下一步进行试做" : "检查完成，可以加入范式库";
    const detail = failures.length
      ? `目前归纳为 ${actions.length} 项待办；红色技术清单已收起。`
      : warnings.length ? "完成一次预览和人工确认即可继续。" : "所有必需检查均已完成。";
    elements.validationSummary.dataset.kind = failures.length ? "blocked" : warnings.length ? "pending" : "ready";
    elements.validationSummary.innerHTML = `<span>${status}</span><div><strong>${title}</strong><p>${detail}</p></div>`;
    elements.validationActions.replaceChildren(...actions.map(renderValidationAction));
    elements.validationDetailsSummary.textContent = `查看完整检查（${passes} 项通过，${checks.length - passes} 项待处理）`;
  }

  function renderValidationAction(action) {
    const item = document.createElement("article");
    item.className = "validation-action";
    item.innerHTML = `<span aria-hidden="true">→</span><div><strong>${platform.escapeHtml(action.title)}</strong><p>${platform.escapeHtml(action.detail)}</p></div>`;
    if (action.target) {
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.addEventListener("click", () => focusValidationTarget(action.target));
      item.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) focusValidationTarget(action.target); });
    }
    return item;
  }

  function focusValidationTarget(target) {
    const element = document.getElementById(target);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (element?.matches("input, textarea, button")) window.setTimeout(() => element.focus(), 350);
  }

  function renderCheck(check) {
    const item = document.createElement("article");
    item.className = `validation-item ${check.level}`;
    const label = check.level === "pass" ? "通过" : check.level === "warn" ? "待完成" : "失败";
    item.innerHTML = `<span>${label}</span><div><strong>${platform.escapeHtml(check.title)}</strong><p>${platform.escapeHtml(check.detail)}</p></div>`;
    return item;
  }

  function collectManifest() {
    const profile = elements.fieldProfile.value;
    return {
      schemaVersion: 1,
      id: elements.fieldId.value.trim(),
      name: elements.fieldName.value.trim(),
      shortDescription: elements.fieldSummary.value.trim(),
      category: elements.fieldCategory.value.trim(),
      taskType: elements.fieldTask.value.trim(),
      duration: elements.fieldDuration.value.trim(),
      entry: elements.fieldEntry.value.trim().replace(/^\.\//, ""),
      license: elements.fieldLicense.value.trim(),
      source: elements.fieldSource.value.trim() || null,
      approved: true,
      allowNetwork: false,
      dataExport: "adapter",
      description: "description.md",
      result: {
        profile,
        fields: {
          correct: elements.fieldCorrect.value.trim(),
          rt: elements.fieldRt.value.trim(),
          condition: elements.fieldCondition.value.trim(),
        },
        levels: elements.fieldLevels.value.split(",").map((value) => value.trim()).filter(Boolean),
      },
    };
  }

  function openPreview() {
    const entry = elements.fieldEntry.value.trim().replace(/^\.\//, "");
    if (!state.files.has(entry)) {
      showToast("入口文件不存在，无法预览");
      return;
    }
    closePreview();
    state.runtimePassed = false;
    state.runtimeRows = [];
    const html = readText(entry);
    const rewritten = rewriteEntryForPreview(html, entry);
    elements.experimentPreview.hidden = false;
    const previewUrl = URL.createObjectURL(new Blob([rewritten], { type: "text/html" }));
    state.objectUrls.push(previewUrl);
    elements.previewFrame.src = previewUrl;
    elements.runtimeStatus.textContent = "实验已启动；请完成全部流程，等待结果回传。";
    validatePackage();
    elements.experimentPreview.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function rewriteEntryForPreview(html, entry) {
    const base = entry.includes("/") ? entry.slice(0, entry.lastIndexOf("/") + 1) : "";
    const rewritten = String(html).replace(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi, (full, attribute, quote, url) => {
      if (/^(?:https?:|data:|#|mailto:|javascript:)/i.test(url)) return full;
      const path = resolveRelative(base, url.split(/[?#]/)[0]);
      const bytes = state.files.get(path);
      if (!bytes) return full;
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType(path) }));
      state.objectUrls.push(blobUrl);
      return `${attribute}=${quote}${blobUrl}${quote}`;
    });
    return rewritten.replace(/<head([^>]*)>/i, `<head$1><base target="_self"><script>window.addEventListener("error",function(e){parent.postMessage({type:"cognition-lab:preview-error",message:e.message},"*")});<\/script>`);
  }

  function receivePreviewMessage(event) {
    if (event.source !== elements.previewFrame.contentWindow || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "cognition-lab:preview-error") {
      elements.runtimeStatus.textContent = `运行错误：${event.data.message || "未知脚本错误"}`;
      return;
    }
    if (event.data.type !== "cognition-lab:complete") return;
    const rows = Array.isArray(event.data.trials) ? event.data.trials : Array.isArray(event.data.results) ? event.data.results : [];
    const manifest = collectManifest();
    const required = [manifest.result.fields.correct, manifest.result.fields.rt].filter(Boolean);
    const missing = required.filter((field) => !rows.some((row) => row && Object.hasOwn(row, field)));
    if (!rows.length || missing.length) {
      state.runtimePassed = false;
      elements.runtimeStatus.textContent = !rows.length ? "收到完成事件，但没有逐试次数据。" : `结果数据缺少字段：${missing.join("、")}`;
    } else {
      state.runtimePassed = true;
      state.runtimeRows = rows;
      elements.runtimeStatus.textContent = `检查通过：收到 ${rows.length} 条试次数据，可以生成平台结果页。`;
    }
    validatePackage();
  }

  function closePreview() {
    if (!elements.previewFrame) return;
    elements.previewFrame.src = "about:blank";
    elements.experimentPreview.hidden = true;
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.objectUrls = [];
  }

  function stagePackage() {
    if (!validatePackage()) return;
    const manifest = collectManifest();
    const files = new Map(state.files);
    files.set("manifest.json", encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`));
    files.set("description.md", encoder.encode(`${elements.descriptionEditor.value.trim()}\n`));
    const exists = published.some((item) => item.id === manifest.id);
    state.staged.set(manifest.id, { action: exists ? "replace" : "add", manifest, files });
    state.deletions.delete(manifest.id);
    renderLibrary();
    renderChanges();
    showToast(exists ? "已加入待替换清单" : "已加入待添加清单");
  }

  function renderLibrary() {
    elements.libraryList.replaceChildren(...published.map((item) => {
      const row = document.createElement("article");
      row.className = "library-row";
      const isCore = item.mode === "builtin";
      const deleting = state.deletions.has(item.id);
      row.innerHTML = `<div><strong>${platform.escapeHtml(item.name)}</strong><span>${platform.escapeHtml(item.category)} · ${platform.escapeHtml(item.id)}</span></div>`;
      const button = document.createElement("button");
      button.className = "text-button";
      button.type = "button";
      button.disabled = isCore;
      button.textContent = isCore ? "核心范式" : deleting ? "撤销删除" : "标记删除";
      if (deleting) row.classList.add("pending-delete");
      button.addEventListener("click", () => toggleDelete(item.id));
      row.append(button);
      return row;
    }));
  }

  function toggleDelete(id) {
    if (state.deletions.has(id)) state.deletions.delete(id);
    else {
      state.deletions.add(id);
      state.staged.delete(id);
    }
    renderLibrary();
    renderChanges();
  }

  function renderChanges() {
    const changes = [
      ...[...state.staged].map(([id, item]) => ({ id, action: item.action, name: item.manifest.name })),
      ...[...state.deletions].map((id) => ({ id, action: "delete", name: published.find((item) => item.id === id)?.name || id })),
    ];
    elements.changeCount.textContent = String(changes.length);
    elements.exportChanges.disabled = changes.length === 0;
    if (!changes.length) {
      elements.changeList.innerHTML = '<p class="empty-copy">还没有添加、替换或删除操作。</p>';
      return;
    }
    elements.changeList.replaceChildren(...changes.map((change) => {
      const row = document.createElement("article");
      const label = change.action === "add" ? "添加" : change.action === "replace" ? "替换" : "删除";
      row.className = `change-row ${change.action}`;
      row.innerHTML = `<span>${label}</span><div><strong>${platform.escapeHtml(change.name)}</strong><small>${platform.escapeHtml(change.id)}</small></div>`;
      const button = document.createElement("button");
      button.className = "text-button";
      button.type = "button";
      button.textContent = "移除";
      button.addEventListener("click", () => {
        if (change.action === "delete") state.deletions.delete(change.id);
        else state.staged.delete(change.id);
        renderLibrary();
        renderChanges();
      });
      row.append(button);
      return row;
    }));
  }

  function exportChanges() {
    const entries = new Map();
    const manifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      add: [],
      replace: [],
      delete: [...state.deletions],
    };
    for (const [id, item] of state.staged) {
      manifest[item.action].push(id);
      for (const [path, bytes] of item.files) entries.set(`packages/${id}/${path}`, bytes);
    }
    entries.set("changes.json", `${JSON.stringify(manifest, null, 2)}\n`);
    entries.set("README.txt", "知觉之间范式库变更包\r\n\r\n请先解压，再在项目根目录运行：\r\nnode tools/apply-changes.mjs <解压后的文件夹>\r\n");
    downloadBlob(archive.createZip(entries), `cognition-lab-changes-${new Date().toISOString().slice(0, 10)}.zip`);
    showToast("变更包已生成，请交由教材编写人员同步到仓库");
  }

  function readJson(path) {
    try { return JSON.parse(readText(path)); } catch { return null; }
  }

  function readText(path) {
    const bytes = state.files.get(path);
    return bytes ? decoder.decode(bytes) : "";
  }

  function collectTextSample() {
    return [...state.files]
      .filter(([path, bytes]) => /\.(?:html?|js|mjs|json|md|txt)$/i.test(path) && bytes.byteLength <= 1024 * 1024)
      .slice(0, 60)
      .map(([, bytes]) => decoder.decode(bytes))
      .join("\n");
  }

  function findEntry() {
    return [...state.files.keys()].find((path) => path.toLowerCase() === "index.html")
      || [...state.files.keys()].find((path) => /(^|\/)index\.html?$/i.test(path)) || "index.html";
  }

  function titleFromEntry() {
    return readText(findEntry()).match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
  }

  function hasLicense() {
    return [...state.files.keys()].some((path) => /(^|\/)licen[cs]e(?:\.[^/]+)?$/i.test(path));
  }

  function findMissingResources(entry) {
    const html = readText(entry);
    const base = entry.includes("/") ? entry.slice(0, entry.lastIndexOf("/") + 1) : "";
    const missing = [];
    for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const url = match[1];
      if (/^(?:https?:|data:|#|mailto:|javascript:)/i.test(url)) continue;
      const path = resolveRelative(base, url.split(/[?#]/)[0]);
      if (path && !state.files.has(path)) missing.push(path);
    }
    return [...new Set(missing)];
  }

  function stripCommonRoot(files) {
    const keys = [...files.keys()];
    const roots = keys.map((path) => path.split("/")[0]);
    if (!keys.length || !roots.every((root) => root === roots[0]) || keys.some((path) => !path.includes("/"))) return new Map(files);
    return new Map([...files].map(([path, bytes]) => [path.slice(roots[0].length + 1), bytes]));
  }

  function resolveRelative(base, relative) {
    const parts = `${base}${relative}`.split("/");
    const resolved = [];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") resolved.pop();
      else resolved.push(part);
    }
    return resolved.join("/");
  }

  function setValue(id, value) { document.getElementById(id).value = value ?? ""; }
  function setPackageStatus(message, kind) { elements.packageStatus.textContent = message; elements.packageStatus.dataset.kind = kind; }
  function totalSize(files) { return [...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0); }
  function formatBytes(bytes) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
  function slug(value) { return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "new-paradigm"; }
  function camel(value) { return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
  function mimeType(path) { const ext = path.split(".").pop().toLowerCase(); return ({ js: "application/javascript", mjs: "application/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", json: "application/json", csv: "text/csv", wav: "audio/wav", mp3: "audio/mpeg" })[ext] || "application/octet-stream"; }
  async function sha256(value) { const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value)); return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function showToast(message) { elements.toast.textContent = message; elements.toast.classList.add("show"); window.setTimeout(() => elements.toast.classList.remove("show"), 2600); }
})();

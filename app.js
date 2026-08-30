"use strict";

const COLORS = {
  red: { label: "红色", hex: "#c74b36", key: "1" },
  green: { label: "绿色", hex: "#47745a", key: "2" },
  blue: { label: "蓝色", hex: "#255f83", key: "3" },
  yellow: { label: "黄色", hex: "#d19a16", key: "4" },
};

const EXPERIMENTS = {
  stroop: {
    number: "实验 01",
    title: "Stroop 色词干扰",
    question: "文字的含义，会在多大程度上干扰你对颜色的判断？",
    instruction: "屏幕会出现一个颜色词。请忽略文字写的是什么，只判断文字本身的颜色，并按对应数字键。",
    keys: Object.entries(COLORS).map(([value, item]) => ({ key: item.key, label: item.label, value, color: item.hex })),
    practiceCount: 6,
    formalCount: 24,
    responseWindow: 1800,
    buildTrials(count) {
      const names = Object.keys(COLORS);
      const trials = [];
      for (let index = 0; index < count; index += 1) {
        const ink = names[index % names.length];
        const congruent = index % 2 === 0;
        const word = congruent ? ink : names[(index + 1 + (index % 3)) % names.length];
        trials.push({
          condition: congruent ? "congruent" : "incongruent",
          stimulus: COLORS[word].label.replace("色", ""),
          displayColor: COLORS[ink].hex,
          expected: COLORS[ink].key,
          answer: ink,
        });
      }
      return shuffle(trials);
    },
    render(stimulus, trial) {
      stimulus.className = "stimulus";
      stimulus.textContent = trial.stimulus;
      stimulus.style.color = trial.displayColor;
    },
    effect(results) {
      const congruent = meanRT(results.filter((row) => row.condition === "congruent"));
      const incongruent = meanRT(results.filter((row) => row.condition === "incongruent"));
      const difference = validDifference(incongruent, congruent);
      return {
        label: "干扰效应",
        value: difference === null ? "数据不足" : `${formatSigned(difference)} ms`,
        note: "不一致 − 一致条件",
        explanation: difference === null
          ? "部分条件中没有足够的正确反应，因此暂时无法计算稳定的条件差异。你仍可导出逐试次数据进行检查。"
          : `你的不一致条件平均反应时比一致条件${difference >= 0 ? "慢" : "快"} ${Math.abs(Math.round(difference))} ms。经典 Stroop 效应通常表现为不一致条件更慢、错误更多；单次短实验会受到练习、疲劳与随机波动影响。`,
      };
    },
  },
  flanker: {
    number: "实验 02",
    title: "Flanker 侧抑制任务",
    question: "当周围信息与目标冲突时，你能否只对中央目标作出反应？",
    instruction: "请只判断五个箭头中最中央箭头的方向。中央箭头向左按 F，向右按 J；两侧箭头只是干扰项。",
    keys: [
      { key: "F", label: "中央向左", value: "left" },
      { key: "J", label: "中央向右", value: "right" },
    ],
    practiceCount: 6,
    formalCount: 24,
    responseWindow: 1600,
    buildTrials(count) {
      return shuffle(Array.from({ length: count }, (_, index) => {
        const targetRight = index % 2 === 0;
        const congruent = Math.floor(index / 2) % 2 === 0;
        const target = targetRight ? "→" : "←";
        const flank = congruent ? target : (targetRight ? "←" : "→");
        return {
          condition: congruent ? "congruent" : "incongruent",
          stimulus: `${flank}${flank}${target}${flank}${flank}`,
          expected: targetRight ? "j" : "f",
          answer: targetRight ? "right" : "left",
        };
      }));
    },
    render(stimulus, trial) {
      stimulus.className = "stimulus";
      stimulus.textContent = trial.stimulus;
      stimulus.style.color = "#172839";
    },
    effect(results) {
      const congruent = meanRT(results.filter((row) => row.condition === "congruent"));
      const incongruent = meanRT(results.filter((row) => row.condition === "incongruent"));
      const difference = validDifference(incongruent, congruent);
      return {
        label: "冲突效应",
        value: difference === null ? "数据不足" : `${formatSigned(difference)} ms`,
        note: "不一致 − 一致条件",
        explanation: difference === null
          ? "部分条件中没有足够的正确反应，因此暂时无法计算稳定的条件差异。你仍可导出逐试次数据进行检查。"
          : `你的不一致条件平均反应时比一致条件${difference >= 0 ? "慢" : "快"} ${Math.abs(Math.round(difference))} ms。正值通常反映无关侧翼刺激引发了反应冲突，但短实验的个人结果不应用于能力评价。`,
      };
    },
  },
  gonogo: {
    number: "实验 03",
    title: "Go / No-Go 任务",
    question: "当“立即反应”成为习惯后，你能否在关键信号出现时停下来？",
    instruction: "看到绿色圆形时尽快按空格键；看到红色圆形时不要按任何键。请兼顾速度与准确性。",
    keys: [
      { key: "空格", label: "绿色：按下", value: "go", color: "#47745a" },
      { key: "不按", label: "红色：等待", value: "nogo", color: "#c74b36" },
    ],
    practiceCount: 7,
    formalCount: 28,
    responseWindow: 1100,
    buildTrials(count) {
      const noGoCount = Math.max(1, Math.round(count * 0.25));
      const trials = Array.from({ length: count }, (_, index) => {
        const noGo = index < noGoCount;
        return {
          condition: noGo ? "nogo" : "go",
          stimulus: noGo ? "红色圆形" : "绿色圆形",
          displayColor: noGo ? "#c74b36" : "#47745a",
          expected: noGo ? null : " ",
          answer: noGo ? "withhold" : "space",
        };
      });
      return shuffle(trials);
    },
    render(stimulus, trial) {
      stimulus.className = "stimulus circle";
      stimulus.textContent = "";
      stimulus.style.color = "transparent";
      stimulus.style.background = trial.displayColor;
    },
    effect(results) {
      const noGo = results.filter((row) => row.condition === "nogo");
      const correctNoGo = noGo.filter((row) => row.correct).length;
      const inhibition = noGo.length ? (correctNoGo / noGo.length) * 100 : null;
      return {
        label: "抑制成功率",
        value: inhibition === null ? "数据不足" : `${Math.round(inhibition)}%`,
        note: "No-Go 试次未按键比例",
        explanation: inhibition === null
          ? "没有足够的 No-Go 试次用于计算抑制成功率。"
          : `你在 ${correctNoGo}/${noGo.length} 个 No-Go 试次中成功停止了反应。Go 试次建立了持续反应倾向，而偶尔出现的 No-Go 信号要求你抑制已经准备好的动作。`,
      };
    },
  },
};

ensureExperimentShell();

const elements = {
  dialog: document.querySelector("#experiment-dialog"),
  close: document.querySelector("#close-experiment"),
  kicker: document.querySelector("#dialog-kicker"),
  progressWrap: document.querySelector("#progress-wrap"),
  progressText: document.querySelector("#progress-text"),
  progressBar: document.querySelector("#progress-bar"),
  intro: document.querySelector("#intro-screen"),
  introNumber: document.querySelector("#intro-number"),
  title: document.querySelector("#dialog-title"),
  question: document.querySelector("#intro-question"),
  instruction: document.querySelector("#intro-instruction"),
  keyGuide: document.querySelector("#key-guide"),
  introTrials: document.querySelector("#intro-trials"),
  startPractice: document.querySelector("#start-practice"),
  task: document.querySelector("#task-screen"),
  phaseLabel: document.querySelector("#phase-label"),
  fixation: document.querySelector("#fixation"),
  stimulus: document.querySelector("#stimulus"),
  feedback: document.querySelector("#feedback"),
  taskKeyGuide: document.querySelector("#task-key-guide"),
  transition: document.querySelector("#transition-screen"),
  practiceSummary: document.querySelector("#practice-summary"),
  startFormal: document.querySelector("#start-formal"),
  results: document.querySelector("#results-screen"),
  resultNote: document.querySelector("#result-note"),
  metricAccuracy: document.querySelector("#metric-accuracy"),
  metricRT: document.querySelector("#metric-rt"),
  metricEffectLabel: document.querySelector("#metric-effect-label"),
  metricEffect: document.querySelector("#metric-effect"),
  metricEffectNote: document.querySelector("#metric-effect-note"),
  resultExplanation: document.querySelector("#result-explanation"),
  exportCsv: document.querySelector("#export-csv"),
  retry: document.querySelector("#retry-experiment"),
  toast: document.querySelector("#toast"),
};

let state = createEmptyState();

document.querySelectorAll("[data-experiment]").forEach((button) => {
  button.addEventListener("click", () => openExperiment(button.dataset.experiment));
});
elements.startPractice.addEventListener("click", () => startPhase("practice"));
elements.startFormal.addEventListener("click", () => startPhase("formal"));
elements.exportCsv.addEventListener("click", exportResults);
elements.retry.addEventListener("click", resetToIntro);
elements.close.addEventListener("click", requestClose);
elements.dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  requestClose();
});
window.CognitionExperiment = Object.freeze({ open: openExperiment });

function ensureExperimentShell() {
  const shell = document.querySelector("#experiment-shell");
  if (!shell || document.querySelector("#experiment-dialog")) return;
  shell.innerHTML = `
    <dialog class="experiment-dialog" id="experiment-dialog" aria-labelledby="dialog-title">
      <div class="dialog-shell">
        <header class="dialog-header">
          <a class="brand compact" href="#" tabindex="-1">
            <span class="brand-mark" aria-hidden="true">知</span>
            <span><strong>实验进行中</strong><small id="dialog-kicker">COGNITION LAB</small></span>
          </a>
          <div class="progress-wrap" id="progress-wrap" hidden>
            <span id="progress-text">0 / 0</span>
            <div class="progress-track" aria-hidden="true"><i id="progress-bar"></i></div>
          </div>
          <button class="icon-button" id="close-experiment" type="button" aria-label="退出实验">×</button>
        </header>
        <section class="dialog-content intro-screen" id="intro-screen">
          <div class="intro-label" id="intro-number"></div>
          <h2 id="dialog-title"></h2>
          <p class="intro-question" id="intro-question"></p>
          <div class="instruction-panel">
            <div><p class="eyebrow">你的任务</p><p id="intro-instruction"></p></div>
            <div class="key-guide" id="key-guide"></div>
          </div>
          <div class="intro-meta">
            <span id="intro-trials"></span><span>先练习，后正式实验</span><span>请勿刷新页面</span>
          </div>
          <button class="button button-primary" id="start-practice" type="button">开始练习</button>
        </section>
        <section class="dialog-content task-screen" id="task-screen" hidden aria-live="polite">
          <p class="phase-label" id="phase-label">练习</p>
          <div class="stimulus-stage" id="stimulus-stage">
            <div class="fixation" id="fixation" aria-hidden="true">+</div>
            <div class="stimulus" id="stimulus" role="img" aria-label="实验刺激"></div>
            <div class="feedback" id="feedback"></div>
          </div>
          <div class="task-key-guide" id="task-key-guide"></div>
        </section>
        <section class="dialog-content transition-screen" id="transition-screen" hidden>
          <p class="eyebrow">PRACTICE COMPLETE</p>
          <h2>练习完成，规则已经熟悉。</h2>
          <p id="practice-summary"></p>
          <button class="button button-primary" id="start-formal" type="button">进入正式实验</button>
        </section>
        <section class="dialog-content results-screen" id="results-screen" hidden>
          <div class="result-heading">
            <div><p class="eyebrow">YOUR RESULT</p><h2>这一次，你观察到了什么？</h2></div>
            <p id="result-note"></p>
          </div>
          <div class="metric-grid">
            <article><span>正确率</span><strong id="metric-accuracy">—</strong><small>全部正式试次</small></article>
            <article><span>平均反应时</span><strong id="metric-rt">—</strong><small>仅统计正确反应</small></article>
            <article><span id="metric-effect-label">条件差异</span><strong id="metric-effect">—</strong><small id="metric-effect-note">—</small></article>
          </div>
          <div class="result-explanation"><h3>如何理解</h3><p id="result-explanation"></p></div>
          <div class="result-actions">
            <button class="button button-primary" id="export-csv" type="button">导出本次 CSV</button>
            <button class="button button-secondary" id="retry-experiment" type="button">再做一次</button>
          </div>
          <p class="ephemeral-warning">退出本页后，本次结果将被清除。请先导出需要保留的数据。</p>
        </section>
      </div>
    </dialog>`;
}

function createEmptyState() {
  return {
    id: null,
    config: null,
    phase: null,
    trials: [],
    results: [],
    index: 0,
    acceptingResponse: false,
    stimulusStartedAt: 0,
    timer: null,
    keyHandler: null,
  };
}

function openExperiment(id) {
  if (!EXPERIMENTS[id]) return;
  clearExperimentState();
  state.id = id;
  state.config = EXPERIMENTS[id];
  renderIntro();
  showScreen("intro");
  elements.dialog.showModal();
  document.body.classList.add("dialog-open");
}

function renderIntro() {
  const config = state.config;
  elements.introNumber.textContent = config.number;
  elements.title.textContent = config.title;
  elements.question.textContent = config.question;
  elements.instruction.textContent = config.instruction;
  elements.introTrials.textContent = `约 ${Math.ceil((config.formalCount * (config.responseWindow + 700)) / 60000) + 1} 分钟`;
  elements.keyGuide.innerHTML = renderKeys(config.keys);
  elements.taskKeyGuide.innerHTML = renderKeys(config.keys);
}

function renderKeys(keys) {
  return keys.map((item) => `
    <span class="key-item">
      <kbd>${escapeHtml(item.key)}</kbd>
      ${item.color ? `<i class="color-dot" style="background:${item.color}" aria-hidden="true"></i>` : ""}
      <span>${escapeHtml(item.label)}</span>
    </span>
  `).join("");
}

function startPhase(phase) {
  state.phase = phase;
  state.index = 0;
  state.results = phase === "formal" ? [] : state.results;
  const count = phase === "practice" ? state.config.practiceCount : state.config.formalCount;
  state.trials = state.config.buildTrials(count);
  elements.phaseLabel.textContent = phase === "practice" ? "练习阶段 · 系统会提示正误" : "正式实验 · 请保持专注";
  elements.kicker.textContent = phase === "practice" ? "PRACTICE" : "FORMAL SESSION";
  showScreen("task");
  elements.progressWrap.hidden = false;
  scheduleTrial();
}

function scheduleTrial() {
  cleanupTrial();
  if (state.index >= state.trials.length) {
    finishPhase();
    return;
  }

  updateProgress();
  elements.stimulus.hidden = true;
  elements.feedback.textContent = "";
  elements.fixation.hidden = false;
  state.timer = window.setTimeout(showStimulus, 420 + Math.random() * 180);
}

function showStimulus() {
  const trial = state.trials[state.index];
  elements.fixation.hidden = true;
  elements.stimulus.hidden = false;
  state.config.render(elements.stimulus, trial);
  state.stimulusStartedAt = performance.now();
  state.acceptingResponse = true;
  state.keyHandler = (event) => handleResponse(event);
  window.addEventListener("keydown", state.keyHandler);
  state.timer = window.setTimeout(() => handleTimeout(), state.config.responseWindow);
}

function handleResponse(event) {
  if (!state.acceptingResponse || event.repeat) return;
  const key = event.key.toLowerCase();
  const validKeys = state.id === "stroop" ? ["1", "2", "3", "4"]
    : state.id === "flanker" ? ["f", "j"]
      : [" "];
  if (!validKeys.includes(key)) return;
  event.preventDefault();
  recordTrial(key, performance.now() - state.stimulusStartedAt);
}

function handleTimeout() {
  const trial = state.trials[state.index];
  if (state.id === "gonogo" && trial.expected === null) {
    recordTrial(null, null);
  } else {
    recordTrial(null, null);
  }
}

function recordTrial(response, rt) {
  if (!state.acceptingResponse) return;
  state.acceptingResponse = false;
  const trial = state.trials[state.index];
  const correct = trial.expected === null ? response === null : response === trial.expected;
  const row = {
    trial: state.index + 1,
    condition: trial.condition,
    stimulus: trial.stimulus,
    expected: trial.expected === " " ? "space" : (trial.expected ?? "withhold"),
    response: response === " " ? "space" : (response ?? "none"),
    correct,
    rt: rt === null ? null : Math.round(rt),
  };
  if (state.phase === "formal") state.results.push(row);

  cleanupTrial();
  elements.stimulus.hidden = true;
  if (state.phase === "practice") {
    elements.feedback.textContent = correct ? "正确" : `不正确 · ${trial.expected === null ? "这个刺激不需要按键" : "请再看清按键规则"}`;
    elements.feedback.style.color = correct ? "#47745a" : "#c74b36";
  }
  state.index += 1;
  state.timer = window.setTimeout(scheduleTrial, state.phase === "practice" ? 620 : 320);
}

function finishPhase() {
  cleanupTrial();
  elements.progressWrap.hidden = true;
  if (state.phase === "practice") {
    elements.practiceSummary.textContent = "接下来不会再提示正误。正式试次完成后，你将看到本次正确率、反应时和条件差异。";
    showScreen("transition");
    elements.startFormal.focus();
  } else {
    renderResults();
    showScreen("results");
    elements.exportCsv.focus();
  }
}

function renderResults() {
  const correct = state.results.filter((row) => row.correct);
  const accuracy = state.results.length ? (correct.length / state.results.length) * 100 : 0;
  const rt = meanRT(state.results);
  const effect = state.config.effect(state.results);
  elements.resultNote.textContent = `${state.config.title} · ${state.results.length} 个正式试次。单次短测结果仅用于理解范式。`;
  elements.metricAccuracy.textContent = `${Math.round(accuracy)}%`;
  elements.metricRT.textContent = rt === null ? "—" : `${Math.round(rt)} ms`;
  elements.metricEffectLabel.textContent = effect.label;
  elements.metricEffect.textContent = effect.value;
  elements.metricEffectNote.textContent = effect.note;
  elements.resultExplanation.textContent = effect.explanation;
}

function exportResults() {
  if (!state.results.length) return;
  const correctRows = state.results.filter((row) => row.correct);
  const accuracy = ((correctRows.length / state.results.length) * 100).toFixed(1);
  const mean = meanRT(state.results);
  const headers = ["experiment", "trial", "condition", "stimulus", "expected", "response", "correct", "rt_ms", "session_accuracy_pct", "session_mean_correct_rt_ms"];
  const rows = state.results.map((row) => [
    state.id,
    row.trial,
    row.condition,
    row.stimulus,
    row.expected,
    row.response,
    row.correct ? 1 : 0,
    row.rt ?? "",
    accuracy,
    mean === null ? "" : Math.round(mean),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.id}-result-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV 已生成，请在下载文件夹中查看");
}

function resetToIntro() {
  const id = state.id;
  clearExperimentState();
  state.id = id;
  state.config = EXPERIMENTS[id];
  renderIntro();
  showScreen("intro");
  elements.startPractice.focus();
}

function requestClose() {
  const hasProgress = state.phase === "practice" || state.phase === "formal" || state.results.length > 0;
  if (hasProgress && !window.confirm("退出后，本次实验进度和未导出的结果将被清除。确定退出吗？")) return;
  closeExperiment();
}

function closeExperiment() {
  clearExperimentState();
  elements.dialog.close();
  document.body.classList.remove("dialog-open");
}

function clearExperimentState() {
  cleanupTrial();
  state = createEmptyState();
}

function cleanupTrial() {
  if (state.timer) window.clearTimeout(state.timer);
  if (state.keyHandler) window.removeEventListener("keydown", state.keyHandler);
  state.timer = null;
  state.keyHandler = null;
  state.acceptingResponse = false;
}

function updateProgress() {
  const current = Math.min(state.index + 1, state.trials.length);
  elements.progressText.textContent = `${current} / ${state.trials.length}`;
  elements.progressBar.style.width = `${(current / state.trials.length) * 100}%`;
}

function showScreen(name) {
  ["intro", "task", "transition", "results"].forEach((key) => {
    elements[key].hidden = key !== name;
  });
}

function meanRT(results) {
  const values = results.filter((row) => row.correct && Number.isFinite(row.rt)).map((row) => row.rt);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function validDifference(a, b) {
  return a === null || b === null ? null : a - b;
}

function formatSigned(value) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value))}`;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function renderImportedParadigms(items) {
  const section = document.querySelector("#imported-catalog");
  const grid = document.querySelector("#imported-grid");
  if (!section || !grid) return;

  section.hidden = false;
  if (items.length === 0) {
    grid.innerHTML = `
      <article class="imported-empty">
        <span aria-hidden="true">＋</span>
        <div>
          <h4>扩展目录已就绪</h4>
          <p>将完整实验文件夹放入 <code>paradigms/packages/</code>，目录会在下次扫描或 GitHub Pages 发布时自动更新。</p>
        </div>
        <a class="text-link" href="./paradigms/README.md" target="_blank" rel="noopener">查看导入规则 ↗</a>
      </article>
    `;
    return;
  }

  grid.replaceChildren(...items.map((item, index) => {
    const article = document.createElement("article");
    article.className = "imported-card";

    const statusLabel = item.status === "ready" ? "可运行" : item.status === "blocked" ? "文件不完整" : "待审核";
    const exportLabel = item.dataExport === "adapter" ? "统一 CSV" : item.dataExport === "self" ? "原程序导出" : "导出未验证";
    const canLaunch = item.status === "ready" && Boolean(item.entry);
    const action = canLaunch
      ? `<a class="button button-secondary imported-action" href="${escapeHtml(item.entry)}" target="_blank" rel="noopener noreferrer">打开实验 ↗</a>`
      : `<span class="button button-secondary imported-action" aria-disabled="true">${item.status === "blocked" ? "无法运行" : "等待审核"}</span>`;

    article.innerHTML = `
      <span class="imported-index">P${String(index + 1).padStart(2, "0")}</span>
      <div>
        <div class="imported-meta">
          <span class="status-chip ${escapeHtml(item.status)}">${statusLabel}</span>
          <span class="status-chip">${escapeHtml(item.category)}</span>
          <span class="status-chip">${escapeHtml(item.platform)}</span>
          <span class="status-chip">${exportLabel}</span>
        </div>
        <h4>${escapeHtml(item.name)}</h4>
        <p>${escapeHtml(item.description || "已识别实验入口，尚无简介。")}</p>
      </div>
      ${action}
    `;
    return article;
  }));
}

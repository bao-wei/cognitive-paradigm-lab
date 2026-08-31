import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PACKAGES = path.join(ROOT, "paradigms", "packages");
const DEFAULT_OUTPUT = path.join(ROOT, "paradigms", "catalog.generated.js");
const TEXT_EXTENSIONS = new Set([".html", ".htm", ".js", ".mjs", ".json", ".md", ".txt"]);

const CATEGORY_RULES = [
  ["注意与执行控制", /stroop|flanker|simon|antisaccade|attention network|go.?no.?go|continuous performance|inhibition/i],
  ["记忆", /corsi|digit span|working memory|n.?back|change detection|memory/i],
  ["语言加工", /lexical|word decision|semantic|bilingual|language/i],
  ["决策与奖赏", /bart|balloon|bandit|delay discount|risk|decision/i],
  ["社会与情绪", /cyberball|emotion|face preference|social|affect/i],
  ["知觉", /visual search|mental rotation|perception|motion|contrast|detection/i],
  ["基础反应", /simple reaction|choice reaction|reaction time|rtt/i],
];

export async function scanPackages(packagesDir = DEFAULT_PACKAGES) {
  const entries = await safeReadDir(packagesDir);
  const packages = [];

  for (const directory of entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))) {
    packages.push(await inspectPackage(packagesDir, directory.name));
  }

  return packages.sort((a, b) => a.category.localeCompare(b.category, "zh-CN") || a.name.localeCompare(b.name, "zh-CN"));
}

export async function buildCatalog({ packagesDir = DEFAULT_PACKAGES, output = DEFAULT_OUTPUT } = {}) {
  const packages = await scanPackages(packagesDir);
  const body = `window.IMPORTED_PARADIGMS = ${JSON.stringify(packages, null, 2)};\n`;
  await writeFile(output, body, "utf8");
  return packages;
}

async function inspectPackage(packagesDir, folder) {
  const root = path.join(packagesDir, folder);
  const files = await listFiles(root);
  const normalized = files.map(toPosix);
  const manifest = await readManifest(root);
  const entryFile = resolveEntry(manifest.entry, normalized);
  const descriptionFile = resolveDescription(manifest.description, normalized);
  const sample = await collectTextSample(root, files);
  const name = cleanText(manifest.name) || extractHeading(sample) || humanize(folder);
  const description = cleanText(manifest.shortDescription) || cleanText(manifest.descriptionText) || extractDescription(sample);
  const platform = cleanText(manifest.platform) || detectPlatform(sample, normalized);
  const category = cleanText(manifest.category) || inferCategory(`${name}\n${description}\n${folder}`);
  const networkFlags = detectNetworkFlags(sample);
  const license = cleanText(manifest.license) || findLicense(normalized);
  const approved = manifest.approved === true;
  const networkApproved = manifest.allowNetwork === true;
  const dataExport = ["adapter", "self", "none"].includes(manifest.dataExport) ? manifest.dataExport : detectDataExport(sample);
  const result = normalizeResult(manifest.result);
  const hasCompletionBridge = /cognition-lab:complete/i.test(sample);

  const issues = [];
  if (!entryFile) issues.push("未找到 index.html 或 manifest 指定入口");
  if (!descriptionFile) issues.push("缺少 description.md 范式说明");
  if (!license) issues.push("未识别许可证");
  if (networkFlags.dataConnection && !networkApproved) issues.push("检测到可能的数据联网代码，尚未明确允许");
  if (networkFlags.remoteAssets && !networkApproved) issues.push("依赖远程资源，尚未明确允许");
  if (!hasCompletionBridge) issues.push("未检测到 cognition-lab:complete 结果桥接事件");
  if (!result) issues.push("缺少可用的结果模板与字段映射");
  if (!approved) issues.push("尚未在 paradigm.json 中确认 approved");

  const networkClear = (!networkFlags.dataConnection && !networkFlags.remoteAssets) || networkApproved;
  const complete = entryFile && descriptionFile && result && hasCompletionBridge;
  const status = !entryFile ? "blocked" : approved && Boolean(license) && networkClear && complete ? "ready" : "review";
  return {
    id: folder,
    name,
    shortDescription: description,
    category,
    taskType: cleanText(manifest.taskType) || platform,
    duration: cleanText(manifest.duration) || "时长见说明",
    metrics: normalizeList(manifest.metrics).length ? normalizeList(manifest.metrics) : metricsForResult(result),
    tags: normalizeList(manifest.tags),
    platform,
    entry: entryFile ? `./paradigms/packages/${encodePath(folder)}/${encodePath(entryFile)}` : null,
    descriptionPath: descriptionFile ? `./paradigms/packages/${encodePath(folder)}/${encodePath(descriptionFile)}` : null,
    status,
    dataExport,
    result,
    license: license || null,
    source: cleanText(manifest.source) || null,
    issues,
  };
}

async function readManifest(root) {
  for (const file of ["manifest.json", "paradigm.json"]) {
    try {
      return JSON.parse(await readFile(path.join(root, file), "utf8"));
    } catch {
      // Try the legacy filename before treating the package as unconfigured.
    }
  }
  return {};
}

function resolveEntry(configured, files) {
  const candidates = [configured, "index.html", "html/index.html"].filter(Boolean).map(toPosix);
  return candidates.find((candidate) => files.includes(candidate))
    || files.find((file) => /(^|\/)index\.html?$/i.test(file))
    || null;
}

function resolveDescription(configured, files) {
  const candidates = [configured, "description.md"].filter(Boolean).map(toPosix);
  return candidates.find((candidate) => files.includes(candidate)) || null;
}

function normalizeResult(value) {
  if (!value || typeof value !== "object") return null;
  const profile = ["generic", "difference", "dot-probe", "bart"].includes(value.profile) ? value.profile : null;
  const fields = value.fields && typeof value.fields === "object" ? {
    correct: cleanText(value.fields.correct),
    rt: cleanText(value.fields.rt),
    condition: cleanText(value.fields.condition),
    pumps: cleanText(value.fields.pumps),
    popped: cleanText(value.fields.popped),
    earnings: cleanText(value.fields.earnings),
  } : {};
  const levels = normalizeList(value.levels);
  if (!profile) return null;
  if (profile === "bart" && (!fields.pumps || !fields.popped || !fields.earnings)) return null;
  if (profile !== "bart" && (!fields.correct || !fields.rt)) return null;
  if (["difference", "dot-probe"].includes(profile) && (!fields.condition || levels.length !== 2)) return null;
  return { profile, fields, levels };
}

function metricsForResult(result) {
  if (!result) return [];
  if (result.profile === "bart") return ["调整后平均充气次数", "气球爆炸比例", "累计收益"];
  const third = result.profile === "dot-probe" ? "注意偏向分数" : result.profile === "difference" ? "条件差异" : "有效试次";
  return ["正确率", "平均反应时", third];
}

function normalizeList(value) {
  return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : [];
}

async function collectTextSample(root, files) {
  const ranked = files.filter((file) => !/^(?:lib|vendor)[\\/]/i.test(file)).sort((a, b) => priority(a) - priority(b)).slice(0, 24);
  const chunks = [];
  for (const file of ranked) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    try {
      const content = await readFile(path.join(root, file), "utf8");
      chunks.push(content.slice(0, 160000));
    } catch {
      // Binary, unreadable, or removed during scanning: skip it.
    }
  }
  return chunks.join("\n");
}

function priority(file) {
  const name = path.basename(file).toLowerCase();
  if (name === "paradigm.json") return 0;
  if (name.startsWith("readme")) return 1;
  if (name === "index.html") return 2;
  if (name.endsWith(".js")) return 3;
  return 4;
}

async function listFiles(root, relative = "", output = []) {
  if (output.length >= 5000) return output;
  for (const entry of await safeReadDir(path.join(root, relative))) {
    if (entry.isSymbolicLink()) continue;
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) await listFiles(root, next, output);
    else output.push(next);
    if (output.length >= 5000) break;
  }
  return output;
}

async function safeReadDir(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function detectPlatform(sample, files) {
  const value = `${sample}\n${files.join("\n")}`;
  if (/psychojs|psychopy/i.test(value)) return "PsychoJS";
  if (/jspsych/i.test(value)) return "jsPsych";
  if (/lab\.js|labjs/i.test(value)) return "lab.js";
  if (/opensesame/i.test(value)) return "OpenSesame";
  return "HTML / JavaScript";
}

function inferCategory(value) {
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(value))?.[0] || "待整理";
}

function detectNetworkFlags(sample) {
  return {
    remoteAssets: /(?:src|href|import\s+[^;]*?from)\s*[=(]?\s*["']https?:\/\//i.test(sample),
    dataConnection: /fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|ServerManager|\.upload\s*\(/i.test(sample),
  };
}

function detectDataExport(sample) {
  if (/postMessage\s*\([^)]*(?:trial|result|data)/i.test(sample)) return "adapter";
  if (/(?:download|save)[\w.]*\s*\([^)]*(?:csv|data)|text\/csv/i.test(sample)) return "self";
  return "none";
}

function findLicense(files) {
  const file = files.find((item) => /(^|\/)licen[cs]e(?:\.[^/]+)?$/i.test(item));
  return file ? `见 ${file}` : "";
}

function extractHeading(sample) {
  const markdown = sample.match(/^#\s+([^\r\n]+)/m)?.[1];
  const html = sample.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return cleanText(markdown || html);
}

function extractDescription(sample) {
  const paragraph = sample.match(/^(?!#)([^\r\n]{24,220})$/m)?.[1]
    || sample.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)/i)?.[1];
  return cleanText(paragraph).slice(0, 180);
}

function humanize(value) {
  return value.replaceAll(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function toPosix(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}

function encodePath(value) {
  return toPosix(value).split("/").map(encodeURIComponent).join("/");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const packages = await buildCatalog();
  const counts = packages.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }), {});
  console.log(`catalog generated: ${packages.length} package(s)`, counts);
}

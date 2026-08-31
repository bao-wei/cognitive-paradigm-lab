import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyChanges } from "./apply-changes.mjs";
import { buildCatalog } from "./build-catalog.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UI_ROOT = path.join(ROOT, "tools", "import-assistant");
const WORK_ROOT = path.join(ROOT, ".assistant-work");
const ASSISTANT_PORT = 4174;
const TESTS = [
  "archive-self-check.mjs",
  "self-check.mjs",
  "importer-self-check.mjs",
  "platform-self-check.mjs",
  "change-pack-self-check.mjs",
  "import-assistant-self-check.mjs",
];
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
};

export function parsePavloviaUrl(value) {
  let parsed;
  try { parsed = new URL(String(value).trim()); } catch { throw userError("请输入完整的 Pavlovia GitLab 项目地址"); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "gitlab.pavlovia.org") throw userError("目前只接受 https://gitlab.pavlovia.org/ 下的公开项目");
  const parts = parsed.pathname.replace(/\.git\/?$/, "").split("/").filter(Boolean);
  if (parts.length < 2 || parts.some((part) => !/^[\w.-]+$/.test(part))) throw userError("Pavlovia 项目地址格式不正确");
  const repo = parts.at(-1);
  return { cloneUrl: `https://gitlab.pavlovia.org/${parts.join("/")}.git`, repo };
}

export async function findChangeRoot(directory, depth = 0) {
  const root = path.resolve(directory);
  if (await exists(path.join(root, "changes.json"))) return root;
  if (depth >= 3) throw new Error("压缩包中没有找到 changes.json；请上传工作台导出的“范式库变更包”");
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "__MACOSX") continue;
    try { return await findChangeRoot(path.join(root, entry.name), depth + 1); } catch { /* Try the next wrapper directory. */ }
  }
  throw new Error("压缩包中没有找到 changes.json；请上传工作台导出的“范式库变更包”");
}

export function safeChild(root, child) {
  const base = path.resolve(root);
  const target = path.resolve(base, child);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error("路径超出助手工作目录");
  return target;
}

export async function createAssistantServer({ port = 0, openBrowser = true } = {}) {
  await mkdir(WORK_ROOT, { recursive: true });
  const token = randomBytes(24).toString("hex");
  const state = {
    changeRoot: null,
    previewToken: null,
    actions: null,
    verified: false,
    publishedSha: null,
    sourceZip: null,
    sourceName: null,
    runtimePreview: null,
  };
  let baseUrl = "";

  const server = createServer(async (request, response) => {
    try {
      if (!isLocalHost(request.headers.host)) return sendJson(response, 403, { error: "仅允许从本机访问" });
      const url = new URL(request.url, baseUrl || "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/") {
        const html = (await readFile(path.join(UI_ROOT, "index.html"), "utf8")).replace("__ASSISTANT_TOKEN__", token);
        return send(response, 200, html, MIME[".html"], true);
      }
      if (request.method === "GET" && url.pathname === "/app.js") {
        const script = (await readFile(path.join(UI_ROOT, "app.js"), "utf8")).replace("__ASSISTANT_TOKEN__", token);
        return send(response, 200, script, MIME[".js"], true, { "Content-Security-Policy": "default-src 'self'" });
      }
      if (request.method === "GET" && url.pathname === "/assistant.css") return serveFile(response, path.join(UI_ROOT, "assistant.css"), true);
      if (request.method === "GET" && url.pathname === "/styles.css") return serveFile(response, path.join(ROOT, "styles.css"), true);
      if (request.method === "GET" && url.pathname.startsWith("/site/")) return serveSite(response, url.pathname.slice(6));
      if (request.method === "OPTIONS" && url.pathname.startsWith(`/preview/${token}/`)) return send(response, 204, "", "text/plain", true, previewCors(request));
      if (request.method === "GET" && url.pathname.startsWith(`/preview/${token}/`)) return serveRuntimePreview(response, url.pathname, state, token);
      if (request.method === "GET" && url.pathname === "/api/source-download") {
        if (url.searchParams.get("token") !== token || !state.sourceZip) return sendJson(response, 403, { error: "下载凭据无效" });
        return serveFile(response, state.sourceZip, false, { "Content-Disposition": `attachment; filename="${state.sourceName || path.basename(state.sourceZip)}"` });
      }
      if (request.method === "GET" && url.pathname === "/api/package-download") {
        if (url.searchParams.get("token") !== token) return sendJson(response, 403, { error: "下载凭据无效" });
        return await handlePackageDownload(response, url.searchParams.get("id"));
      }
      if (url.pathname.startsWith("/api/")) {
        if (!validOrigin(request, baseUrl) || request.headers["x-assistant-token"] !== token) return sendJson(response, 403, { error: "本地会话凭据无效，请刷新助手页面" });
        if (request.method === "GET" && url.pathname === "/api/status") return sendJson(response, 200, await environmentStatus());
        if (request.method === "GET" && url.pathname === "/api/deployment") return sendJson(response, 200, await deploymentStatus(state.publishedSha));
        if (request.method === "POST" && url.pathname === "/api/preview") return await handleRuntimePreview(request, response, state, token);
        if (request.method === "POST" && url.pathname === "/api/upload") return await handleUpload(request, response, state, token);
        if (request.method === "POST" && url.pathname === "/api/apply") return await handleApply(request, response, state);
        if (request.method === "POST" && url.pathname === "/api/publish") return await handlePublish(request, response, state);
        if (request.method === "POST" && url.pathname === "/api/pavlovia") return await handlePavlovia(request, response, state, token);
      }
      sendJson(response, 404, { error: "未找到页面" });
    } catch (error) {
      sendJson(response, Number(error.statusCode) || 500, { error: cleanError(error), ...(error.details || {}) });
    }
  });

  await new Promise((resolve, reject) => server.listen(port, "127.0.0.1", resolve).once("error", reject));
  const actualPort = server.address().port;
  baseUrl = `http://127.0.0.1:${actualPort}`;
  if (openBrowser) openUrl(baseUrl);
  return { server, url: baseUrl };
}

async function handleUpload(request, response, state, token) {
  const fileName = String(request.headers["x-file-name"] || "changes.zip").replace(/[^\w.-]+/g, "-");
  if (!fileName.toLowerCase().endsWith(".zip")) throw userError("请选择工作台导出的 ZIP 变更包");
  const body = await readBody(request, 120 * 1024 * 1024);
  const sessionRoot = path.join(WORK_ROOT, "uploads", `${Date.now()}-${randomBytes(4).toString("hex")}`);
  const zipPath = path.join(sessionRoot, fileName);
  const extractRoot = path.join(sessionRoot, "extracted");
  await mkdir(extractRoot, { recursive: true });
  await writeFile(zipPath, body);
  await expandArchive(zipPath, extractRoot);
  let changeRoot;
  try {
    changeRoot = await findChangeRoot(extractRoot);
  } catch (error) {
    if (!(await looksLikeSourcePackage(extractRoot))) throw error;
    const sourceRoot = await findSourceRoot(extractRoot);
    const adaptation = await adaptPsychoJsPackage(sourceRoot);
    const adaptedZip = path.join(sessionRoot, `adapted-${fileName}`);
    await compressArchive(sourceRoot, adaptedZip);
    state.sourceZip = adaptedZip;
    state.sourceName = sourceNameFromFile(fileName);
    const sourceError = userError(`已识别为待配置源码包；已自动完成 ${adaptation.count} 项技术适配，请在工作台审核信息并试做`);
    sourceError.statusCode = 422;
    sourceError.details = { kind: "source-package", adminUrl: adminUrl(token, state.sourceName.replace(/\.zip$/i, "")) };
    throw sourceError;
  }
  const preview = await applyChanges(changeRoot, { projectRoot: ROOT, apply: false });
  state.changeRoot = changeRoot;
  state.actions = preview.actions;
  state.previewToken = randomBytes(18).toString("hex");
  state.verified = false;
  state.publishedSha = null;
  sendJson(response, 200, { ...preview, previewToken: state.previewToken, fileName });
}

async function handleApply(request, response, state) {
  const body = await readJson(request);
  if (!state.changeRoot || body.previewToken !== state.previewToken) throw userError("变更包预演已失效，请重新选择文件");
  const catalogPath = path.join(ROOT, "paradigms", "catalog.generated.js");
  const oldCatalog = await readFile(catalogPath);
  let applied;
  try {
    applied = await applyChanges(state.changeRoot, { projectRoot: ROOT, apply: true });
    const packages = await buildCatalog();
    const tests = [];
    for (const file of TESTS) {
      const result = await run(process.execPath, [path.join(ROOT, "tests", file)], { cwd: ROOT, timeout: 120000 });
      tests.push({ file, output: result.stdout.trim() });
    }
    state.verified = true;
    state.previewToken = null;
    return sendJson(response, 200, { applied: true, actions: applied.actions, backupRoot: applied.backupRoot, catalogCount: packages.length, tests });
  } catch (error) {
    if (applied) await rollback(applied, oldCatalog);
    state.verified = false;
    throw userError(`${cleanError(error)}${applied ? "；本地改动已自动恢复，未发布" : ""}`);
  }
}

async function handlePublish(request, response, state) {
  const body = await readJson(request);
  if (!state.verified || !state.actions) throw userError("必须先成功应用并通过全部自检，才能发布");
  const environment = await environmentStatus();
  if (!environment.ghAuthenticated) throw userError("GitHub CLI 尚未登录，请先在终端运行 gh auth login");
  if (body.confirm !== environment.repository) throw userError("发布确认与目标仓库不一致");
  const published = await publishActions(environment.repository, environment.defaultBranch, state.actions);
  state.publishedSha = published.sha;
  state.verified = false;
  sendJson(response, 200, { ...published, siteUrl: environment.siteUrl });
}

async function handlePavlovia(request, response, state, token) {
  const { url } = await readJson(request);
  const source = parsePavloviaUrl(url);
  const stamp = `${Date.now()}-${source.repo.replace(/[^\w.-]+/g, "-")}`;
  const sourceRoot = path.join(WORK_ROOT, "sources", stamp);
  const zipPath = path.join(WORK_ROOT, "sources", `${stamp}.zip`);
  await mkdir(path.dirname(sourceRoot), { recursive: true });
  await run("git", ["clone", "--depth", "1", "--single-branch", source.cloneUrl, sourceRoot], { cwd: ROOT, timeout: 300000 });
  const removed = await removeGeneratedFolders(sourceRoot);
  const adaptation = await adaptPsychoJsPackage(sourceRoot);
  await compressArchive(sourceRoot, zipPath);
  state.sourceZip = zipPath;
  state.sourceName = `${source.repo}.zip`;
  const summary = await directorySummary(sourceRoot);
  sendJson(response, 200, {
    source: source.cloneUrl,
    folder: sourceRoot,
    removed,
    adapted: adaptation.count,
    ...summary,
    downloadUrl: `/api/source-download?token=${token}`,
    adminUrl: adminUrl(token, source.repo, source.cloneUrl.replace(/\.git$/, "")),
  });
}

async function handleRuntimePreview(request, response, state, token) {
  const entry = String(request.headers["x-entry"] || "index.html").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!entry || entry.split("/").some((part) => !part || part === "." || part === "..")) throw userError("实验入口路径不正确");
  const body = await readBody(request, 120 * 1024 * 1024);
  const id = randomBytes(12).toString("hex");
  const previewRoot = path.join(WORK_ROOT, "previews", id);
  const zipPath = path.join(WORK_ROOT, "previews", `${id}.zip`);
  await mkdir(previewRoot, { recursive: true });
  await writeFile(zipPath, body);
  await expandArchive(zipPath, previewRoot);
  if (!(await exists(safeChild(previewRoot, entry)))) throw userError(`找不到实验入口 ${entry}`);
  state.runtimePreview = { id, root: previewRoot };
  sendJson(response, 200, { url: `/preview/${token}/${id}/${entry}` });
}

function serveRuntimePreview(response, pathname, state, token) {
  const prefix = `/preview/${token}/`;
  const [id, ...parts] = decodeURIComponent(pathname.slice(prefix.length)).split("/");
  if (!state.runtimePreview || id !== state.runtimePreview.id || !parts.length) return sendJson(response, 404, { error: "预览已失效，请重新打开" });
  const target = safeChild(state.runtimePreview.root, parts.join("/"));
  return serveFile(response, target, false, previewCors());
}

function previewCors(request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": request?.headers["access-control-request-headers"] || "Content-Type",
  };
}

async function handlePackageDownload(response, id) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(id || ""))) throw userError("范式 ID 不正确");
  const packageRoot = safeChild(path.join(ROOT, "paradigms", "packages"), id);
  if (!(await exists(packageRoot))) throw userError("找不到该扩展范式");
  const zipPath = path.join(WORK_ROOT, "packages", `${id}.zip`);
  await mkdir(path.dirname(zipPath), { recursive: true });
  await compressArchive(packageRoot, zipPath);
  return serveFile(response, zipPath, false, { "Content-Disposition": `attachment; filename="${id}.zip"` });
}

async function environmentStatus() {
  let repository = "";
  let defaultBranch = "main";
  let ghAuthenticated = false;
  try {
    await run("gh", ["auth", "status"], { cwd: ROOT, timeout: 15000 });
    ghAuthenticated = true;
    const result = await run("gh", ["repo", "view", "--json", "nameWithOwner,defaultBranchRef"], { cwd: ROOT, timeout: 15000 });
    const details = JSON.parse(result.stdout);
    repository = details.nameWithOwner;
    defaultBranch = details.defaultBranchRef?.name || "main";
  } catch { /* Report the actionable status in the UI. */ }
  const siteUrl = repository ? `https://${repository.split("/")[0].toLowerCase()}.github.io/${repository.split("/")[1]}/` : "";
  return { node: process.version, ghAuthenticated, repository, defaultBranch, siteUrl, projectRoot: ROOT };
}

async function publishActions(repository, branch, actions) {
  const ref = await ghApi("GET", `repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`);
  const parentSha = ref.object.sha;
  const commit = await ghApi("GET", `repos/${repository}/git/commits/${parentSha}`);
  const remoteTree = await ghApi("GET", `repos/${repository}/git/trees/${commit.tree.sha}?recursive=1`);
  if (remoteTree.truncated) throw userError("远程仓库文件树过大，无法安全生成原子更新");
  const changedIds = [...new Set([...actions.add, ...actions.replace, ...actions.delete])];
  const treeEntries = [];

  for (const id of changedIds) {
    const prefix = `paradigms/packages/${id}/`;
    const localRoot = path.join(ROOT, "paradigms", "packages", id);
    const localFiles = actions.delete.includes(id) ? [] : await listFiles(localRoot);
    const localPaths = new Set(localFiles.map((file) => `${prefix}${toPosix(path.relative(localRoot, file))}`));
    for (const remote of remoteTree.tree.filter((item) => item.type === "blob" && item.path.startsWith(prefix))) {
      if (!localPaths.has(remote.path)) treeEntries.push({ path: remote.path, mode: "100644", type: "blob", sha: null });
    }
    for (const file of localFiles) {
      const content = await readFile(file);
      if (content.length > 90 * 1024 * 1024) throw userError(`文件超过 GitHub 单文件安全上限：${path.relative(ROOT, file)}`);
      const blob = await ghApi("POST", `repos/${repository}/git/blobs`, { content: content.toString("base64"), encoding: "base64" });
      treeEntries.push({ path: `${prefix}${toPosix(path.relative(localRoot, file))}`, mode: "100644", type: "blob", sha: blob.sha });
    }
  }
  const catalog = await readFile(path.join(ROOT, "paradigms", "catalog.generated.js"));
  const catalogBlob = await ghApi("POST", `repos/${repository}/git/blobs`, { content: catalog.toString("base64"), encoding: "base64" });
  treeEntries.push({ path: "paradigms/catalog.generated.js", mode: "100644", type: "blob", sha: catalogBlob.sha });
  const tree = await ghApi("POST", `repos/${repository}/git/trees`, { base_tree: commit.tree.sha, tree: treeEntries });
  const summary = changedIds.join(", ");
  const nextCommit = await ghApi("POST", `repos/${repository}/git/commits`, {
    message: `chore: update paradigm library (${summary})`,
    tree: tree.sha,
    parents: [parentSha],
  });
  await ghApi("PATCH", `repos/${repository}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: nextCommit.sha, force: false });
  return { sha: nextCommit.sha, commitUrl: `https://github.com/${repository}/commit/${nextCommit.sha}`, changedIds };
}

async function deploymentStatus(sha) {
  if (!sha) return { status: "none", conclusion: null };
  try {
    const result = await run("gh", ["run", "list", "--workflow", "pages.yml", "--commit", sha, "--limit", "1", "--json", "databaseId,status,conclusion,url"], { cwd: ROOT, timeout: 15000 });
    const runInfo = JSON.parse(result.stdout)[0];
    return runInfo || { status: "waiting", conclusion: null };
  } catch (error) {
    return { status: "unknown", conclusion: null, error: cleanError(error) };
  }
}

async function ghApi(method, endpoint, body) {
  const args = ["api", endpoint, "--method", method];
  const options = { cwd: ROOT, timeout: 300000 };
  if (body !== undefined) {
    args.push("--input", "-");
    options.input = JSON.stringify(body);
  }
  const result = await run("gh", args, options);
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

async function rollback(applied, oldCatalog) {
  const packagesRoot = path.join(ROOT, "paradigms", "packages");
  for (const id of [...applied.actions.add, ...applied.actions.replace]) await rm(path.join(packagesRoot, id), { recursive: true, force: true });
  if (applied.backupRoot) {
    for (const id of [...applied.actions.replace, ...applied.actions.delete]) {
      const backup = path.join(applied.backupRoot, id);
      if (await exists(backup)) await rename(backup, path.join(packagesRoot, id));
    }
    await rm(applied.backupRoot, { recursive: true, force: true });
  }
  await writeFile(path.join(ROOT, "paradigms", "catalog.generated.js"), oldCatalog);
}

async function removeGeneratedFolders(root) {
  const removable = new Set([".git", "__MACOSX", "node_modules", "data", "results"]);
  let count = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const target = safeChild(root, path.join(directory, entry.name));
      if (removable.has(entry.name)) {
        const summary = await directorySummary(target);
        count += summary.fileCount;
        await rm(target, { recursive: true, force: true });
      } else await visit(target);
    }
  }
  await visit(root);
  return count;
}

async function directorySummary(root) {
  const files = await listFiles(root);
  let bytes = 0;
  for (const file of files) bytes += (await stat(file)).size;
  return { fileCount: files.length, bytes };
}

export async function findSourceRoot(root) {
  const indexes = (await listFiles(root)).filter((file) => path.basename(file).toLowerCase() === "index.html");
  if (!indexes.length) throw userError("源码包中没有找到 index.html");
  indexes.sort((left, right) => left.split(path.sep).length - right.split(path.sep).length);
  return path.dirname(indexes[0]);
}

export async function adaptPsychoJsPackage(root, { fetchImpl = fetch } = {}) {
  const indexPath = path.join(root, "index.html");
  if (!(await exists(indexPath))) return { count: 0 };
  let html = await readFile(indexPath, "utf8");
  if (!/psychojs-/i.test(html)) return { count: 0 };
  let count = 0;
  const vendorRoot = path.join(root, "vendor");
  const bundledVendor = path.join(ROOT, "paradigms", "packages", "bart", "vendor");
  const vendorUrls = new Map([
    ["https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js", "jquery-3.6.0.min.js"],
    ["https://cdn.jsdelivr.net/npm/jquery-ui-dist@1.12.1/jquery-ui.min.js", "jquery-ui-1.12.1.min.js"],
    ["https://cdn.jsdelivr.net/npm/jquery-ui-dist@1.12.1/jquery-ui.min.css", "jquery-ui-1.12.1.min.css"],
    ["https://cdn.jsdelivr.net/npm/preloadjs@1.0.1/lib/preloadjs.min.js", "preloadjs-1.0.1.min.js"],
  ]);
  for (const [url, name] of vendorUrls) {
    if (!html.includes(url)) continue;
    await mkdir(vendorRoot, { recursive: true });
    await copyFile(path.join(bundledVendor, name), path.join(vendorRoot, name));
    html = html.replaceAll(url, `./vendor/${name}`);
    count += 1;
  }

  const dependencySources = [html];
  for (const file of await listFiles(root)) {
    if (/\.js$/i.test(file) && (await stat(file)).size <= 1024 * 1024) dependencySources.push(await readFile(file, "utf8"));
  }
  const runtimePaths = [...dependencySources.join("\n").matchAll(/["']((?:\.\/)?lib\/(psychojs-[\d.]+(?:\.iife)?\.(?:js|css)))["']/gi)];
  for (const match of runtimePaths) {
    const relative = match[1].replace(/^\.\//, "");
    const target = safeChild(root, relative);
    if (await exists(target)) continue;
    const response = await fetchImpl(`https://lib.pavlovia.org/${match[2]}`);
    if (!response.ok) throw userError(`无法自动下载 PsychoJS 运行库 ${match[2]}（HTTP ${response.status}）`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 10 * 1024 * 1024) throw userError(`PsychoJS 运行库 ${match[2]} 超过安全大小限制`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    count += 1;
  }

  if (!html.includes("cognition-lab:preview-error")) {
    const monitor = `<script>window.addEventListener("error",function(e){parent.postMessage({type:"cognition-lab:preview-error",message:e.message||"资源加载失败"},"*")});window.addEventListener("unhandledrejection",function(e){parent.postMessage({type:"cognition-lab:preview-error",message:String(e.reason?.message||e.reason||"程序运行失败")},"*")});</script>`;
    html = html.replace(/<head([^>]*)>/i, `<head$1>${monitor}`);
    count += 1;
  }
  await writeFile(indexPath, html);

  const modulePath = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*\btype=["']module["'][^>]*>/gi)]
    .map((match) => match[1].replace(/^\.\//, ""))[0];
  if (modulePath) {
    const scriptPath = safeChild(root, modulePath);
    let script = await readFile(scriptPath, "utf8");
    if (!/cognition-lab:complete/i.test(script) && script.includes("psychoJS.window.close();")) {
      script = script.replace("psychoJS.window.close();", `window.parent.postMessage({type: "cognition-lab:complete", trials: psychoJS.experiment?._trialsData || []}, "*");\n  psychoJS.window.close();`);
      await writeFile(scriptPath, script);
      count += 1;
    }
  }
  return { count };
}

async function looksLikeSourcePackage(root) {
  return (await listFiles(root)).some((file) => path.basename(file).toLowerCase() === "index.html");
}

async function listFiles(root, output = []) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) await listFiles(target, output);
    else output.push(target);
  }
  return output;
}

async function expandArchive(zipPath, destination) {
  if (process.platform !== "win32") {
    await run("unzip", ["-q", zipPath, "-d", destination], { timeout: 300000 });
    return;
  }
  const script = "Expand-Archive -LiteralPath $env:ASSISTANT_ZIP -DestinationPath $env:ASSISTANT_DEST -Force";
  await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { env: { ASSISTANT_ZIP: zipPath, ASSISTANT_DEST: destination }, timeout: 300000 });
}

async function compressArchive(source, destination) {
  if (process.platform !== "win32") {
    await run("zip", ["-q", "-r", destination, "."], { cwd: source, timeout: 300000 });
    return;
  }
  const script = "$items = Join-Path $env:ASSISTANT_SOURCE '*'; Compress-Archive -Path $items -DestinationPath $env:ASSISTANT_ZIP -CompressionLevel Optimal -Force";
  await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { env: { ASSISTANT_SOURCE: source, ASSISTANT_ZIP: destination }, timeout: 300000 });
}

function run(command, args, { cwd = ROOT, env = {}, input = "", timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} 执行超时`));
    }, timeout);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `${command} 退出码 ${code}`).trim()));
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

async function readBody(request, limit) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) {
      const error = userError("文件超过 120 MB 限制");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request) {
  const body = await readBody(request, 1024 * 1024);
  try { return JSON.parse(body.toString("utf8") || "{}"); } catch { throw userError("请求数据格式不正确"); }
}

async function serveSite(response, relative) {
  const normalized = relative || "index.html";
  const target = safeChild(ROOT, normalized);
  const first = normalized.split(/[\\/]/)[0];
  const rootFileAllowed = !normalized.includes("/") && [".html", ".js", ".css", ".svg"].includes(path.extname(normalized));
  if (!rootFileAllowed && first !== "paradigms") return sendJson(response, 403, { error: "该文件不对本地网页开放" });
  return serveFile(response, target, false);
}

async function serveFile(response, file, strictCsp, headers = {}) {
  try {
    const body = await readFile(file);
    const csp = strictCsp ? { "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'" } : {};
    send(response, 200, body, MIME[path.extname(file).toLowerCase()] || "application/octet-stream", strictCsp, { ...csp, ...headers });
  } catch { sendJson(response, 404, { error: "文件不存在" }); }
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), MIME[".json"]);
}

function send(response, status, body, contentType, noStore = true, headers = {}) {
  response.writeHead(status, { "Content-Type": contentType, ...(noStore ? { "Cache-Control": "no-store" } : {}), "X-Content-Type-Options": "nosniff", ...headers });
  response.end(body);
}

function validOrigin(request, baseUrl) {
  const origin = request.headers.origin;
  return !origin || origin === baseUrl || origin === baseUrl.replace("127.0.0.1", "localhost");
}

function isLocalHost(host = "") {
  return /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host);
}

function openUrl(url) {
  const child = spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

async function reopenRunningAssistant(error) {
  if (error?.code !== "EADDRINUSE") throw error;
  const url = `http://127.0.0.1:${ASSISTANT_PORT}`;
  try {
    const response = await fetch(url);
    const html = await response.text();
    if (!response.ok || !html.includes("<title>本地导入发布助手｜知觉之间</title>")) throw error;
  } catch {
    throw error;
  }
  openUrl(url);
  return url;
}

function cleanError(error) {
  return String(error?.message || error).replace(/gho_[A-Za-z0-9_]+/g, "[已隐藏凭据]").slice(0, 4000);
}

function sourceNameFromFile(fileName) {
  return String(fileName).replace(/^\d{10,}-/, "").replace(/[^\w.-]+/g, "-");
}

function adminUrl(token, name, origin = "") {
  const params = new URLSearchParams({ token, source: `/api/source-download?token=${token}`, name });
  if (origin) params.set("origin", origin);
  return `/site/admin.html#${params}`;
}

function userError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function toPosix(value) { return value.replaceAll("\\", "/"); }
async function exists(target) { try { await stat(target); return true; } catch { return false; } }

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    const { url } = await createAssistantServer({ port: ASSISTANT_PORT });
    console.log(`\n本地导入发布助手已启动：${url}`);
    console.log("请保留此窗口；完成后按 Ctrl+C 关闭助手。\n");
  } catch (error) {
    const url = await reopenRunningAssistant(error);
    console.log(`\n助手已在运行，已重新打开：${url}\n`);
  }
}

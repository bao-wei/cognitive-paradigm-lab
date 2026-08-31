import { cp, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function applyChanges(changeRoot, { projectRoot = ROOT, apply = false } = {}) {
  const sourceRoot = path.resolve(changeRoot);
  const packagesRoot = path.resolve(projectRoot, "paradigms", "packages");
  const changes = JSON.parse(await readFile(path.join(sourceRoot, "changes.json"), "utf8"));
  const actions = {
    add: validateIds(changes.add),
    replace: validateIds(changes.replace),
    delete: validateIds(changes.delete),
  };
  if (![...actions.add, ...actions.replace, ...actions.delete].length) throw new Error("变更包中没有新增、替换或删除操作");
  const duplicates = [...actions.add, ...actions.replace, ...actions.delete].filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicates.length) throw new Error(`同一范式存在冲突操作：${[...new Set(duplicates)].join(", ")}`);
  for (const id of [...actions.add, ...actions.replace]) await stat(path.join(sourceRoot, "packages", id));
  for (const id of actions.add) {
    if (await exists(safePackagePath(packagesRoot, id))) throw new Error(`“添加”操作与现有范式冲突：${id}；请在工作台中改为“替换”`);
  }
  for (const id of actions.replace) {
    if (!await exists(safePackagePath(packagesRoot, id))) throw new Error(`找不到要替换的现有范式：${id}；请在工作台中改为“添加”`);
  }
  if (!apply) return { applied: false, actions };

  await mkdir(packagesRoot, { recursive: true });
  const backupRoot = path.resolve(projectRoot, ".changes-backup", new Date().toISOString().replaceAll(/[:.]/g, "-"));
  for (const id of [...actions.replace, ...actions.delete]) {
    const target = safePackagePath(packagesRoot, id);
    if (!await exists(target)) continue;
    await mkdir(backupRoot, { recursive: true });
    await rename(target, path.join(backupRoot, id));
  }
  for (const id of [...actions.add, ...actions.replace]) {
    const target = safePackagePath(packagesRoot, id);
    await rm(target, { recursive: true, force: true });
    await cp(path.join(sourceRoot, "packages", id), target, { recursive: true, errorOnExist: true });
  }
  return { applied: true, actions, backupRoot: await exists(backupRoot) ? backupRoot : null };
}

function validateIds(value) {
  if (!Array.isArray(value)) throw new Error("changes.json 的操作清单格式不正确");
  for (const id of value) if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`不安全的范式 ID：${id}`);
  return value;
}

function safePackagePath(packagesRoot, id) {
  const target = path.resolve(packagesRoot, id);
  if (path.dirname(target) !== packagesRoot) throw new Error(`范式目录越界：${id}`);
  return target;
}

async function exists(target) {
  try { await stat(target); return true; } catch { return false; }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const changeRoot = process.argv.find((argument, index) => index > 1 && argument !== "--apply");
  if (!changeRoot) throw new Error("用法：node tools/apply-changes.mjs <解压后的变更包目录> [--apply]");
  const result = await applyChanges(changeRoot, { apply: process.argv.includes("--apply") });
  console.log(JSON.stringify(result, null, 2));
  if (!result.applied) console.log("以上为预演结果；确认无误后追加 --apply 执行。替换或删除的旧目录会先备份到 .changes-backup。");
}

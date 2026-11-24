import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {readTextbookTasks} from '../tools/textbook-tasks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, 'output', 'textbook-linked-2026-11-24');
const out = path.resolve(process.argv.slice(2).find(arg=>!arg.startsWith('--')) || path.join(stage, 'H5-release'));
const manifest = JSON.parse(await readFile(path.join(out, '入口清单.json'), 'utf8'));
const tasks = await readTextbookTasks();
const ids = tasks.map(task => task.id).sort();
assert.equal(tasks.length, 27);
assert.equal(manifest.length, 28, '27 experiment entries plus one catalogue');
assert.deepEqual(manifest.map(entry => entry.id).sort(), [...ids, 'catalog'].sort());

const archiveContext = vm.createContext({window: {}, Blob, TextEncoder, TextDecoder, Uint8Array, DataView});
vm.runInContext(await readFile(path.join(root, 'archive.js'), 'utf8'), archiveContext);
const archive = archiveContext.window.CognitionArchive;
const expectedAssets = Object.fromEntries(await Promise.all([...new Set(tasks.flatMap(task => task.assets || []))].map(async relative => [relative, 'data:video/mp4;base64,' + (await readFile(path.join(root, 'paradigms/textbook', relative))).toString('base64')])));
assert.equal(Object.keys(expectedAssets).length, 16);
const instructions = await readFile(path.join(out, '上传与使用说明.txt'), 'utf8');
const sources = await readFile(path.join(root, 'paradigms/textbook/assets/SOURCES.md'), 'utf8');

for (const entry of manifest) {
  assert.equal(entry.embeddedExperiments, 27, entry.id);
  const html = await readFile(path.join(out, entry.html), 'utf8');
  assert.equal(Buffer.byteLength(html), entry.htmlBytes, entry.id + ' manifest size');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=/i, entry.id + ' external code dependency');
  assert.doesNotMatch(html, /github\.io/i, entry.id + ' must not contain GitHub Pages navigation');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  assert.equal(scripts.length, 1, entry.id + ' one embedded script');
  scripts.forEach(script => new vm.Script(script, {filename: entry.id + '-linked.html'}));
  // Only parse the builder's JSON assignments; never execute experiment or DOM code.
  const config = scripts[0].match(/^window\.TEXTBOOK_LINKED_ENTRY=([\s\S]+?);window\.TEXTBOOK_LINKED_CATALOG=([\s\S]+?);window\.TEXTBOOK_ASSETS=([\s\S]+?);\r?\n/);
  assert.ok(config, entry.id + ' embedded configuration');
  const defaultId = JSON.parse(config[1]);
  const catalog = JSON.parse(config[2]);
  const assets = JSON.parse(config[3]);
  assert.equal(defaultId, entry.id === 'catalog' ? '' : entry.id);
  assert.equal(catalog.length, 27);
  assert.deepEqual(catalog.map(task => task.id).sort(), ids);
  assert.deepEqual(assets, expectedAssets, entry.id + ' all media included byte-for-byte');
  assert.ok(catalog.every(task => task.name && task.category && task.metrics.length >= 3), entry.id + ' catalogue metadata');
  const navigation = [...scripts[0].matchAll(/(?:\bhref\s*=|\.href\s*=)\s*["']([^"']*)["']/g)].map(match => match[1]);
  assert.ok(navigation.length >= 5, entry.id + ' header, cards, error and result navigation');
  assert.ok(navigation.every(href => href === '#catalog' || href.startsWith('#experiment/')), entry.id + ' navigation must stay in the same file');

  const zip = await archive.readZip(new Blob([await readFile(path.join(out, entry.zip))]));
  assert.deepEqual([...zip.files.keys()].sort(), ['index.html', '上传与使用说明.txt', '素材来源与许可.md'].sort(), entry.zip + ' contents');
  assert.equal(new TextDecoder().decode(zip.files.get('index.html')), html, entry.zip + ' HTML matches loose file');
  assert.equal(new TextDecoder().decode(zip.files.get('上传与使用说明.txt')), instructions, entry.zip + ' instructions');
  assert.equal(new TextDecoder().decode(zip.files.get('素材来源与许可.md')), sources, entry.zip + ' material attribution');
}

if(process.argv.includes('--verify-previous')){
const oldRelease = path.join(homedir(), 'Desktop', '电子教材H5');
const before = JSON.parse(await readFile(path.join(stage, 'old-release-before.json'), 'utf8'));
async function filesWithin(directory, relative = '') {
  const entries = await readdir(path.join(directory, relative), {withFileTypes: true});
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesWithin(directory, path.join(relative, entry.name)) : path.join(relative, entry.name).replaceAll('\\', '/')))).flat();
}
assert.deepEqual((await filesWithin(oldRelease)).sort(), before.map(file => file.Path.replaceAll('\\', '/')).sort(), 'previous release file set unchanged');
for (const file of before) {
  const bytes = await readFile(path.join(oldRelease, file.Path.replaceAll('\\', '/')));
  assert.equal(bytes.length, file.Length, file.Path + ' previous size unchanged');
  assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(), file.SHA256.toUpperCase(), file.Path + ' previous SHA256 unchanged');
}
console.log(`previous release preserved: ${before.length} files`);
}
console.log(`linked H5 self-check passed: ${manifest.length} self-contained entries, 27 tasks and 16 videos in each, hash-only navigation, ZIP integrity`);

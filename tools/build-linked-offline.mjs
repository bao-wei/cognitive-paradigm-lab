import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {readTextbookTasks, taskCatalogEntry, TEXTBOOK_MODULES} from './textbook-tasks.mjs';
import {trialSettingsCsv, trialSettingsNotes} from './trial-settings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'output', 'textbook-linked-2026-11-24', 'H5-release'));
const oldRelease = path.resolve(homedir(), 'Desktop', '电子教材H5');
const comparePath = value => process.platform === 'win32' ? value.toLowerCase() : value;
if (comparePath(out) === comparePath(oldRelease) || comparePath(out).startsWith(comparePath(oldRelease + path.sep))) throw new Error('不能覆盖上一版桌面 H5，请选择新目录');
const tasks = await readTextbookTasks();
const catalog = tasks.map(task => ({id: task.id, name: task.name, chapter: task.chapter, code: task.code, category: task.category, shortDescription: task.shortDescription, trialCount: task.trialCount, metrics: taskCatalogEntry(task).metrics})).sort((a, b) => a.code.localeCompare(b.code, 'zh-CN', {numeric: true}));
const [template, css, linkedCss, runtime, linked, sources, ...modules] = await Promise.all([
  'paradigms/textbook/index.html', 'paradigms/textbook/runtime.css', 'paradigms/textbook/linked.css', 'paradigms/textbook/runtime.js', 'paradigms/textbook/linked.js', 'paradigms/textbook/assets/SOURCES.md', ...TEXTBOOK_MODULES.map(name => `paradigms/textbook/tasks/${name}.js`),
].map(file => readFile(path.join(ROOT, file), 'utf8')));
const mime = {'.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg'};
const assets = {};
for (const relative of new Set(tasks.flatMap(task => task.assets || []))) {
  const filename = path.resolve(ROOT, 'paradigms/textbook', relative);
  if (!filename.startsWith(path.join(ROOT, 'paradigms/textbook/assets') + path.sep)) throw new Error('素材路径越界');
  assets[relative] = `data:${mime[path.extname(filename)] || 'application/octet-stream'};base64,${(await readFile(filename)).toString('base64')}`;
}
const context = vm.createContext({window: {}, Blob, TextEncoder, TextDecoder, Uint8Array, DataView});
vm.runInContext(await readFile(path.join(ROOT, 'archive.js'), 'utf8'), context);
const archive = context.window.CognitionArchive;
const collection = new Map();
const index = [];
await mkdir(out, {recursive: true});
const encoder = new TextEncoder();
const instructions = `妙趣认知实验室｜教材互联版（2026-11-24）\r\n\r\n一、上传哪一个文件\r\n每个范式文件夹内的 index.html 都是完整的单文件 H5。保留原先的章节及范式入口：例如第二章的 Navon 文件先显示 Navon 的说明和“开始实验”，麦格克文件先显示麦格克。任一入口都内置全部 27 项实验、实验目录、样式和所需媒体。\r\n\r\n教材平台若接受单个 HTML，上传对应文件夹中的 index.html；若接受 H5 ZIP，上传同名 ZIP，入口填 index.html。不要上传“妙趣认知实验室_教材互联版_全部入口.zip”作为一个实验；这是交付合集。需要直接展示总目录时，上传“总实验目录.zip”或打开根目录 index.html。\r\n\r\n二、目录如何跳转\r\n“实验目录”和实验卡片使用本文件的 #catalog / #experiment/范式ID 切换页面视图。目录中的全部实验都在当前 HTML 中运行，没有跳到 GitHub，也不需要兄弟文件的地址。平台改变文件名、网址或分开存放各入口，不影响文件内的这些切换。浏览器后退/前进也可以切换刚才访问的页面。\r\n\r\n这里的“页面”是同一个 HTML 内的不同视图。文件不是去打开平台上另外上传的某个 HTML，因此也不需要管理员维护平台文件链接。每个入口体积约 3.2 MB，因为全部程序和音视频都已内嵌。\r\n\r\n三、平台需要允许什么\r\n平台应当以网页/H5方式运行该文件，允许内联 JavaScript、样式、data: 音视频与 blob: CSV 下载；若使用 iframe，需允许脚本、下载，并保留页内锚点（hash）导航。音视频可由学习者点击播放，不依赖自动播放。若平台只预览附件、清洗脚本或禁用下载，需平台方调整容器设置；文件本身无法绕过。无需访问 GitHub、CDN 或其他服务器。手机须使用可运行 H5 的教材容器或完整浏览器，而非静态附件预览器。\r\n\r\n正式交付前在教材平台试传一个入口：开始实验→完成→导出 CSV→实验目录→选择另一个范式→麦格克播放声音和视频；也可关闭外网后重复验证。单文件的本地离线检查不能代替对未知教材容器权限的实际检查。\r\n\r\n四、数据与更新\r\n所有数据只保留在当前页面内存。点击实验目录、切换实验、退出或关闭页面会清除本次结果；需要保留时先导出 CSV。仅供教学体验，不用于科研采集、临床判断或能力评价。实验内容、试次数量与上一版 11.22 定稿 H5 相同，此版仅新增文件内完整目录和导航。\r\n\r\n每个入口都是独立副本。以后新增/修改实验，重新运行 tools/build-linked-offline.mjs 并替换教材中需要同步更新的入口文件，不会自动从网上更新。上一版桌面“电子教材H5”未作修改。\r\n`;
const revisedInstructions=instructions.replace('实验内容、试次数量与上一版 11.22 定稿 H5 相同，此版仅新增文件内完整目录和导航。','教材内容沿用11.22定稿；本次按范式调整试次与分段休息，并延长首试次及休息后准备时间，详见试次设置文件。').replace('上一版桌面“电子教材H5”未作修改。','桌面现有两套H5已按本次要求同步更新。');
for (const task of [...catalog, {id: '', name: '总实验目录', chapter: '', code: ''}]) {
  const script = `window.TEXTBOOK_LINKED_ENTRY=${JSON.stringify(task.id)};window.TEXTBOOK_LINKED_CATALOG=${JSON.stringify(catalog)};window.TEXTBOOK_ASSETS=${JSON.stringify(assets)};\n${runtime}\n${modules.join('\n')}\n${linked}`;
  const title = task.id ? task.name + '｜妙趣认知实验室' : '实验目录｜妙趣认知实验室';
  const html = template.replace('<link rel="stylesheet" href="runtime.css">', () => `<style>${css}\n${linkedCss}</style>`)
    .replace(/\s*<script src="[^"<>]+"><\/script>/g, '')
    .replace('<script>Textbook.launch();</script>', () => `<script>${script.replaceAll(/<\/script/gi, '<\\/script')}</script>`)
    .replace('教学实验｜妙趣认知实验室', () => TextbookEscape(title));
  new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1], {filename: (task.id || 'catalog') + '-linked.html'});
  if (/<script[^>]+src=|<link[^>]+href=/.test(html)) throw new Error('仍含外部代码依赖：' + task.id);
  const base = task.id ? `${task.chapter}_${task.name}`.replace(/[<>:"/\\|?*]/g, '-') : '总实验目录';
  const relative = task.id ? base + '/index.html' : 'index.html';
  if (task.id) await mkdir(path.join(out, base), {recursive: true});
  await writeFile(path.join(out, relative), html);
  const files = new Map([['index.html', encoder.encode(html)], ['上传与使用说明.txt', encoder.encode(revisedInstructions)], ['素材来源与许可.md', encoder.encode(sources)]]);
  const zip = Buffer.from(await archive.createZip(files).arrayBuffer());
  await writeFile(path.join(out, base + '.zip'), zip);
  collection.set(base + '.zip', new Uint8Array(zip));
  index.push({id: task.id || 'catalog', chapter: task.chapter, code: task.code, name: task.name, trials:task.trialCount||'', html: relative, zip: base + '.zip', embeddedExperiments: catalog.length, htmlBytes: Buffer.byteLength(html)});
  console.log(`${base}: ${Buffer.byteLength(html)} bytes, ${catalog.length} embedded experiments`);
}
const listing = '\ufeff' + ['章节,编号,默认入口,单文件HTML,H5压缩包,文件内实验数量', ...index.map(task => [task.chapter, task.code, task.name, task.html, task.zip, task.embeddedExperiments].map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\r\n');
await writeFile(path.join(out, '入口清单.json'), JSON.stringify(index, null, 2));
await writeFile(path.join(out, '入口清单.csv'), listing);
await writeFile(path.join(out, '上传与使用说明.txt'), revisedInstructions);
await writeFile(path.join(out, '试次与休息设置.csv'), trialSettingsCsv(tasks));
await writeFile(path.join(out, '试次与准备时间说明.txt'), trialSettingsNotes);
await writeFile(path.join(out, '素材来源与许可.md'), sources);
collection.set('入口清单.csv', encoder.encode(listing));
collection.set('入口清单.json', encoder.encode(JSON.stringify(index, null, 2)));
collection.set('上传与使用说明.txt', encoder.encode(revisedInstructions));
collection.set('试次与休息设置.csv', encoder.encode(trialSettingsCsv(tasks)));
collection.set('试次与准备时间说明.txt', encoder.encode(trialSettingsNotes));
await writeFile(path.join(out, '妙趣认知实验室_教材互联版_全部入口.zip'), Buffer.from(await archive.createZip(collection).arrayBuffer()));
console.log(`教材互联版已生成：${out}`);

function TextbookEscape(value) {
  return value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readTextbookTasks, TEXTBOOK_MODULES } from './textbook-tasks.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.argv[2]||path.join(ROOT,'output','电子教材H5'));
const mime={'.mp4':'video/mp4','.webm':'video/webm','.wav':'audio/wav','.mp3':'audio/mpeg','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const tasks=await readTextbookTasks();
const archiveContext=vm.createContext({window:{},Blob,TextEncoder,TextDecoder,Uint8Array,DataView});
vm.runInContext(await readFile(path.join(ROOT,'archive.js'),'utf8'),archiveContext);
const archive=archiveContext.window.CognitionArchive;
if(!archive?.createZip)throw new Error('无法读取 ZIP 打包器');
await mkdir(out,{recursive:true});
const template=await readFile(path.join(ROOT,'paradigms/textbook/index.html'),'utf8');
const css=await readFile(path.join(ROOT,'paradigms/textbook/runtime.css'),'utf8');
const runtime=await readFile(path.join(ROOT,'paradigms/textbook/runtime.js'),'utf8');
const modules=await Promise.all(TEXTBOOK_MODULES.map(name=>readFile(path.join(ROOT,`paradigms/textbook/tasks/${name}.js`),'utf8')));
const index=[];const collection=new Map();
for(const task of tasks){
  const assets={};
  for(const relative of task.assets||[]){
    const filename=path.resolve(ROOT,'paradigms/textbook',relative);
    if(!filename.startsWith(path.join(ROOT,'paradigms/textbook/assets')+path.sep))throw new Error('素材路径越界');
    assets[relative]=`data:${mime[path.extname(filename)]||'application/octet-stream'};base64,${(await readFile(filename)).toString('base64')}`;
  }
  const escapeScript=s=>s.replaceAll(/<\/script/gi,'<\\/script');
  const script=`window.TEXTBOOK_OFFLINE_ID=${JSON.stringify(task.id)};window.TEXTBOOK_ASSETS=${JSON.stringify(assets)};\n${runtime}\n${modules.join('\n')}\nTextbook.launch();`;
  let html=template.replace('<link rel="stylesheet" href="runtime.css">',()=>`<style>${css}</style>`)
    .replace(/\s*<script src="[^"<>]+"><\/script>/g,'').replace('<script>Textbook.launch();</script>',()=>`<script>${escapeScript(script)}</script>`)
    .replace('教学实验｜妙趣认知实验室',task.name+'｜妙趣认知实验室');
  new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1],{filename:task.id+'-offline.html'});
  if(/<script[^>]+src=|<link[^>]+href=/.test(html))throw new Error('离线文件仍然含外部代码依赖：'+task.id);
  const base=`${task.chapter||'补充范式'}_${task.name}`.replace(/[<>:"/\\|?*]/g,'-');
  const folder=path.join(out,base);await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'index.html'),html);
  const readme=`${task.name}\r\n${task.chapter||'平台补充范式'} ${task.code||''}\r\n\r\n解压后用现代浏览器打开 index.html。该文件包含全部代码与媒体，可断网运行。手机请使用支持本地 HTML 与音视频播放的浏览器或教材 H5 容器。实验结果仅在页面内存中保留，离开前请导出 CSV。\r\n\r\n${task.description}\r\n`;
  const entries=new Map([['index.html',new TextEncoder().encode(html)],['使用说明.txt',new TextEncoder().encode(readme)]]);
  if(task.assets?.length){const sources=await readFile(path.join(ROOT,'paradigms/textbook/assets/SOURCES.md'));entries.set('素材来源与许可.md',new Uint8Array(sources));}
  const zip=archive.createZip(entries);const zipBytes=Buffer.from(await zip.arrayBuffer());await writeFile(path.join(out,base+'.zip'),zipBytes);collection.set(base+'.zip',new Uint8Array(zipBytes));
  index.push({chapter:task.chapter||'补充范式',code:task.code||'',id:task.id,name:task.name,trials:task.trialCount,zip:base+'.zip',html:base+'/index.html'});
  console.log(base+'.zip');
}
await writeFile(path.join(out,'实验包清单.json'),JSON.stringify(index,null,2));
const listing=['章节,编号,范式名称,试次数量,压缩包',...index.map(t=>[t.chapter,t.code,t.name,t.trials,t.zip].map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\r\n');
await writeFile(path.join(out,'实验包清单.csv'),'\ufeff'+listing);
const instructions='电子教材 H5 使用说明\r\n\r\n每个章节与范式名称对应一个 ZIP。上传电子教材时请分别上传对应的单项 ZIP，入口为 index.html。index.html 已内嵌所有样式、程序与必需媒体，可以在断网情况下完成实验及导出结果。\r\n\r\n手机端使用支持本地 HTML、JavaScript、音视频和文件下载的浏览器或教材 H5 容器。微信聊天附件预览通常不是完整浏览器，请用教材的正式 H5 页面或浏览器打开。\r\n\r\n教材原文 9-2 仅有编号，没有范式与编程要求，因此不创建空实验。原有 Flanker 和 Go/No-Go 收入补充范式。无数量要求的正式测验为20试次；自我参照严格采用20个学习词、10个新词和30次再认，启动材料、练习、填充与学习阶段另计。\r\n\r\n眼动指标需要眼动设备，本版记录行为数据和主观难度。班级比较需教师主动选择本地CSV汇总，平台不会自动收集学生数据。再巩固为压缩流程教学演示，不以短时操作证明生物学机制或记忆被删除。\r\n';
await writeFile(path.join(out,'上传与离线使用说明.txt'),instructions);
collection.set('实验包清单.csv',new TextEncoder().encode('\ufeff'+listing));collection.set('上传与离线使用说明.txt',new TextEncoder().encode(instructions));
await writeFile(path.join(out,'妙趣认知实验室_全部独立H5实验包.zip'),Buffer.from(await archive.createZip(collection).arrayBuffer()));
console.log(`已生成 ${index.length} 个独立 H5 包：${out}`);

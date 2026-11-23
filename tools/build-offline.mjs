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
const instructions=`电子教材 H5 使用说明\r\n11.22 全部定稿对应版本\r\n\r\n每个章节与范式名称对应一个 ZIP，共${index.length}项。上传电子教材时请分别上传单项 ZIP，入口为 index.html。入口文件内嵌全部程序、样式和必需媒体，可断网完成实验及导出。\r\n\r\n手机端使用支持本地 HTML、JavaScript、音视频和下载的浏览器或教材 H5 容器。微信附件预览通常不是完整浏览器。\r\n\r\n依据编辑11.22定稿补全第三、七、十章，保留第十二章唯一实验；另据第九章第四稿补充9-2“Luchins水罐与思维定势”，保留9-1河内塔。原有Flanker和Go/No-Go归入补充范式。定稿第七章两项均编号7-1，清单分别标为7-1（大小比较）和7-1（R旋转），未擅自改作7-2。R旋转为按定稿图示独立编写的正反R判断，未使用尚未提供的课堂源程序。\r\n\r\n注意瞬脱正文标称100–800ms，与流程图15ms呈现+75ms空屏不一致。本版按“流程图优先”采用90ms序列间隔，lag1–8对应90–720ms，并记录标称及实际DOM时序。浏览器不是专用计时硬件，短时呈现受刷新率影响。图片-词汇干扰采用定稿允许的按键名称选择，记录手动选择RT，不宣称测得发声起始时间。\r\n\r\n未指定数量的正式测验为20试次。自我参照按要求学习20词并加入10新词进行30次再认，启动、练习、填充与学习阶段另计。\r\n\r\n眼动指标需要外部设备，本版记录行为数据和主观难度。班级比较由教师主动选择本地CSV，不自动收集数据。再巩固为压缩流程教学演示，不据此证明生物学机制或记忆被删除。\r\n`;
await writeFile(path.join(out,'上传与离线使用说明.txt'),instructions);
collection.set('实验包清单.csv',new TextEncoder().encode('\ufeff'+listing));collection.set('上传与离线使用说明.txt',new TextEncoder().encode(instructions));
await writeFile(path.join(out,'妙趣认知实验室_全部独立H5实验包.zip'),Buffer.from(await archive.createZip(collection).arrayBuffer()));
console.log(`已生成 ${index.length} 个独立 H5 包：${out}`);

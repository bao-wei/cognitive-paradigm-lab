import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
export const TEXTBOOK_MODULES = ['perception', 'memory', 'social-decision', 'attention', 'imagery', 'language', 'problem-solving'];
const METRICS = {
  donders:['三种任务反应时','刺激辨别时间','反应选择时间'],stroop:['条件正确率','Stroop 干扰效应','相对中性条件干扰'],
  navon:['整体优势','局部干扰','整体干扰'],mcgurk:['音节报告比例','语音识别率','融合性报告比例'],
  sperling:['全部报告成绩','部分报告估计容量','延迟条件差异'],'change-detection':['判断正确率','各负荷反应时','工作记忆容量 K'],
  'self-reference':['自我与常用词再认','记得比例','新词虚报率'],'semantic-priming':['正确反应时','启动效应','错误率'],
  reconsolidation:['原配对正确率','新位置侵入比例','新配对学习表现'],'retrieval-forgetting':['RP+ 回忆率','RP− 回忆率','NPP 基线回忆率'],
  eyewitness:['指认选择','确信度','事件后信息条件'],drm:['正确记忆','关键诱饵虚报','确信度校准'],
  wason:['三类任务正确率','选择与反应时','课堂比较'],bart:['调整后平均充气次数','爆炸比例','累计收益'],
  hanoi:['合法与违例移动','回退次数','完成时间'],'embedded-figures':['轮廓识别正确率','识别反应时','复杂度差异'],
  'cultural-priming':['开放式归因','人工编码比例','文化启动分组'],'interface-search':['目标发现反应时','操作正确率','主观难度'],
  flanker:['正确率','平均反应时','冲突效应'],gonogo:['正确率','Go 反应时','抑制成功率'],
  ant:['警觉效应','定向效应','冲突效应'],'attentional-blink':['T1 识别率','T2 检测正确率','注意瞬脱曲线'],
  'real-size-comparison':['条件正确率','正确反应时','大小一致性效应'],'mental-rotation':['正反识别正确率','旋转角度反应时','旋转曲线'],
  'self-paced-reading':['理解正确率','关键消歧区阅读时间','溢出效应'],'picture-word-interference':['语义干扰','语音促进','SOA 条件差异'],
  'water-jug':['解题正确率','熟悉策略使用率','规则改变后表现'],
};
export async function readTextbookTasks() {
  const context=vm.createContext({window:{}});
  vm.runInContext(await readFile(new URL('../paradigms/textbook/runtime.js',import.meta.url),'utf8'),context);
  for(const name of TEXTBOOK_MODULES)vm.runInContext(await readFile(new URL(`../paradigms/textbook/tasks/${name}.js`,import.meta.url),'utf8'),context,{filename:name+'.js'});
  return [...context.window.Textbook.tasks.values()];
}
export function taskCatalogEntry(task) {
  return {
    id:task.id,name:task.name,shortDescription:task.shortDescription,category:task.category,
    taskType:task.taskType,duration:task.duration||'时长见范式说明',metrics:task.metrics||METRICS[task.id]||['本次表现','范式特定指标','逐试次数据'],
    tags:task.tags||[],platform:'Textbook HTML5',mode:'package',
    entry:`./paradigms/textbook/index.html?id=${encodeURIComponent(task.id)}`,
    descriptionPath:`./paradigms/textbook/descriptions/${task.id}.md`,
    status:'ready',dataExport:'adapter',controls:[],
    result:{profile:'generic',fields:{correct:'correct',rt:'rt'},levels:[]},
    license:'Copyright © 妙趣认知实验室；第三方素材见 assets/SOURCES.md',
    source:'《认知心理学》在线实验-11.22（全部定稿）；水罐任务另据第九章第四稿补充',issues:[],
  };
}

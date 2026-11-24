const plans = {
  donders:['每24次','三种反应任务各24次'],
  stroop:['每24次','三条件×四颜色×六重复'],
  navon:['每40次','层级×一致性×目标字母配平'],
  mcgurk:['每24次','三种条件各16次，八套材料各重复两次'],
  'embedded-figures':['每10次','保留20幅正式描画，每次含记忆和描画操作'],
  'interface-search':['每24次','两类界面各24次，匹配搜索目标'],
  flanker:['每40次','冲突条件与左右方向配平'],
  gonogo:['每50次','Go80次、No-Go20次，每段40/10'],
  ant:['每48次','三段完整4线索×3目标×2方向×2位置'],
  'attentional-blink':['每40次','单/双任务×8个lag，每格4次出现和1次缺席'],
  sperling:['每24次','四条件各12次，三行线索配平'],
  'change-detection':['每24次','三负荷×是否变化×左右位置，四段配平'],
  'self-reference':['学习和测验间转换','保留20个学习词与10个新词，不重复探测同一记忆'],
  'semantic-priming':['每24次','36个不同真词与36个不同非词，关系条件配平'],
  reconsolidation:['各阶段开始','保留20组独立配对，学习检查和更新阶段另计'],
  'retrieval-forgetting':['各阶段开始','保留20项的类别结构，提取练习另计'],
  eyewitness:['每5轮','保留20轮完整事件和指认流程，休息放在事件之间'],
  drm:['学习和测验间转换','保留四组20个学习词与20个再认探测，避免重复暴露诱饵'],
  wason:['每12题','三类情境各8题，每段各类4题'],
  bart:['每10个','30个独立气球，保留1–32次阈值的教学缩短参数'],
  hanoi:['每5轮','保留20轮解题过程，需结合练习效应讨论'],
  'real-size-comparison':['每36次','6物体对×3条件×2位置，各组合两次'],
  'mental-rotation':['每36次','6角度×正反方向，每组合6次，练习另计'],
  'self-paced-reading':['每10句','20个不同句框，歧义和控制各10句'],
  'picture-word-interference':['每36次','3图×3关系×2SOA，每组合4次'],
  'cultural-priming':['各阶段开始，开放作答自行调节','6张启动图与20段开放归因，保留事后人工编码'],
  'water-jug':['正式题每10题','5次准备另计，保留10道双解题及10道规则改变题'],
};
export function trialSettingsCsv(tasks) {
  const rows=[['章节','范式名称','正式数量或阶段结构','休息安排','设置理由'],...tasks.map(task=>[task.chapter,task.name,task.trialCount,...plans[task.id]])];
  return '\ufeff'+rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
export const trialSettingsNotes = `试次与准备时间修订说明（2026-11-24）\r\n\r\n首个试次、各学习/测验阶段开头、休息后首个试次的固视点名义呈现至少2000毫秒；其余试次保留各范式时序。ANT其余初始注视为400–1600毫秒。刺激呈现后开始记录作答反应时，准备和休息不计入RT。\r\n\r\n休息页由学习者点击“休息好了，继续”恢复，不自动结束。CSV包含block_number和preparation_fixation_ms。休息期间切窗不影响之后完整试次的有效性，试次期间切窗仍会标记无效。\r\n\r\n数量按条件组合、独立材料和教学时长设定，详见“试次与休息设置.csv”。保留20的项目具有明确词表、解题或开放作答结构，不再把20作为所有任务的默认次数。练习、学习、填充和编码另计。\r\n\r\nANT采用144次教学版，三段各48次，段内完整交叉48种组合。它不是经典完整研究版本；研究实施常用24次练习加三段96次正式测验。增加重复可减少偶然波动，不保证个人出现经典方向，也不将教学体验变为科研或临床测量。\r\n\r\n在线版、独立离线版和教材互联版由同一任务代码构建。互联版每个HTML仍内置全部实验和媒体，不依赖GitHub。\r\n\r\n参考：Fan等（2002）https://pubmed.ncbi.nlm.nih.gov/11970796/ ；Medina与Barraza（2019）https://pmc.ncbi.nlm.nih.gov/articles/PMC6439233/\r\n`;

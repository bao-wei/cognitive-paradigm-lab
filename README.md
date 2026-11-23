# “妙趣认知实验室”在线虚拟实验平台

面向认知心理学学习者的纯静态行为实验聚合平台。11.22 定稿版覆盖原有教材任务、第三章两项注意任务、第七章两项表象任务和第十章两项语言任务；另据第九章第四稿补充水罐思维定势，保留 Flanker 和 Go / No-Go，共 27 项。实验目录按范式名称和认知领域展示，每项提供说明、电脑与触屏操作、实际结果及 UTF-8 CSV 导出。

## 教材实验与离线 H5

教材要求来自《认知心理学》在线实验-11.22（全部定稿）。有流程图时优先按图实现。第九章保留河内塔，并按本章“思维定势”和图9-13补充 Luchins 水罐任务。第十二章仅保留界面分组与视觉搜索一项。第七章两项重复的7-1编号在清单中加任务说明区分。未规定数量时，正式测验为20试次，学习、练习和填充阶段另计；自我参照学习20词、另加10个新词进行30次再认。

注意瞬脱流程图为15ms字母加75ms空屏，与正文100–800ms不一致，采用图示90ms序列间隔与1–8个lag，并导出实际DOM时序。R字符心理旋转按标准正反判断独立编写，未使用尚未提供的课堂源程序。图片词汇干扰采用定稿允许的按键图片名称选择，明确区分手动RT与发声起始时间。

运行与打包共用 `paradigms/textbook/` 的源码和媒体，确保在线与离线的条件、计时和计分一致：

```powershell
node tools/build-catalog.mjs
node tools/build-offline.mjs
```

离线文件生成在 `output/电子教材H5/`。每项以“章节_范式名称.zip”命名，解压入口 `index.html` 已内嵌程序、样式和全部必需媒体，可直接断网打开，不需要服务器。目录内还包含 CSV 清单和全部单项 ZIP 的总包。手机需使用支持本地 HTML、JavaScript、媒体和下载的浏览器或教材 H5 容器。

麦格克任务使用 Beauchamp Lab 公开的真人视听材料，来源与许可在 `paradigms/textbook/assets/SOURCES.md`。镶嵌图形、列队人物和文化图片为原创 SVG 教学材料，不按标准化测验常模评分。眼动指标需外部设备，界面搜索任务只提供实际行为指标及主观难度。班级汇总由教师主动在结果页导入同一范式 CSV，在本机去重并按真实组别显示，不自动收集数据。

教材条目由统一源码生成，管理员工作台将其标为“教材源码维护”；新上传的独立范式仍按原变更包流程添加、替换和删除。

## 隐私边界

实验结果仅保存在当前页面的 JavaScript 内存中，不上传服务器，不写入 Cookie、`localStorage`、`sessionStorage` 或 IndexedDB。刷新或退出页面后数据清除，学习者可在结果页主动导出 CSV。

## 本地预览

可直接双击 `index.html`，也可以在本目录启动任意静态文件服务器：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

项目本身没有运行时依赖。上面的命令使用本机 Python 启动预览服务；也可以直接双击 `index.html`。

## 核心自检

安装 Node.js 后可运行：

```powershell
node tests/self-check.mjs
node tests/importer-self-check.mjs
```

该检查覆盖三个范式的正式试次数量与条件平衡、正确反应时筛选以及 CSV 字段转义。

## 管理范式库

普通学习页面不提供范式维护入口。教材编写人员可以访问隐藏的 `admin.html` 工作台，在浏览器本地完成 ZIP/文件夹读取、Markdown 说明预览、资源检查、完整试做和变更包导出。

管理员初始防误入密码为 `cognition-admin-2026`。这是静态页面的便捷门槛，不是真正的服务器端身份认证；需要修改时请同时更换 `admin.js` 中的 SHA-256 摘要。

导出的变更包需要先解压，再运行：

```powershell
node tools/apply-changes.mjs <变更包目录>
node tools/apply-changes.mjs <变更包目录> --apply
node tools/build-catalog.mjs
```

第一条命令只预演，第二条才应用。替换和删除的旧目录会先移动到 `.changes-backup/`，便于恢复。详细字段、实验完成事件和 Pavlovia 注意事项见 [`paradigms/README.md`](./paradigms/README.md)。推送到 `main` 后，GitHub Actions 会自动重新扫描、执行自检并发布 Pages。

## 本地导入发布助手（推荐）

教材编写人员可以直接双击根目录的 `启动范式导入发布助手.cmd`。助手会自动打开浏览器，并按四步完成：

1. 打开维护工作台配置、试做并导出“范式库变更包”；也可先粘贴公开 Pavlovia GitLab 地址，由助手下载并排除 `.git`、`data`、`results` 和 `node_modules`。
2. 上传变更包 ZIP，预演新增、替换和删除清单。
3. 建立可恢复备份、应用变更、重建目录并运行全部自检；检查失败会自动恢复，不会发布。
4. 核对目标仓库后发布，并等待 GitHub Pages 返回真实部署结果。

第一次使用前，需要安装 Node.js 和 GitHub CLI，并在终端完成一次 `gh auth login`。GitHub 凭据由本机 `gh` 管理，不会写入网页、变更包或仓库。助手只监听 `127.0.0.1`；使用结束后关闭命令窗口即可停止服务。

旧的命令行流程仍然保留，适合需要逐步排查时使用。

## 发布到 GitHub Pages

1. 在 GitHub 新建仓库并上传本目录中的文件。
2. 打开仓库 `Settings → Pages`。
3. 在 `Build and deployment → Source` 中选择 `GitHub Actions`。
4. 推送到 `main`，等待 `Build catalog and deploy GitHub Pages` 工作流完成。
5. 在工作流或 Pages 设置中打开站点地址。

所有资源均使用相对路径，可直接发布在 GitHub Pages 的项目子路径下。

## 教学说明

当前试次数量为了课堂演示和内部测试而缩短，结果不构成心理测量、能力评价或诊断。正式课程使用前，应由课程负责人复核指导语、试次平衡、时间参数与数据解释。

## 版权

Copyright © 2026 妙趣认知实验室。保留所有权利。未经授权，不得复制、再发布或用于商业用途。

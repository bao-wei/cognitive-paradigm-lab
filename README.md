# 知觉之间｜认知心理学实验范式平台

面向认知心理学学习者的纯静态行为实验聚合平台。当前内部测试版包含：

- Stroop 色词干扰任务
- Flanker 侧抑制任务
- Go / No-Go 反应抑制任务
- 单次实验正确率、平均反应时与条件差异展示
- UTF-8 CSV 逐试次数据导出
- 解压实验包后自动发现、分类和生成扩展目录

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

## 添加下载的实验包

1. 将完整实验文件夹复制到 `paradigms/packages/`，不要打散目录结构。
2. 运行 `node tools/build-catalog.mjs`；本地目录会立即更新。
3. 检查自动识别的入口、类别、平台、联网风险和许可证状态。
4. 审核完成后，在实验包根目录添加 `paradigm.json` 并设置 `approved: true`。

详细字段和 Pavlovia 注意事项见 [`paradigms/README.md`](./paradigms/README.md)。推送到 `main` 后，GitHub Actions 会自动重新扫描、执行自检并发布 Pages。

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

Copyright © 2026 知觉之间。保留所有权利。未经授权，不得复制、再发布或用于商业用途。

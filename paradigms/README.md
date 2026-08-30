# Drop-in 范式包

把解压后的公开实验包作为一个完整文件夹放进 `paradigms/packages/`。每次运行扫描脚本，或推送到已经配置好的 GitHub 仓库，目录会自动重建。

```powershell
node tools/build-catalog.mjs
```

## 自动识别

扫描器会自动寻找：

- `index.html` 或 `html/index.html` 实验入口；
- PsychoJS、jsPsych、lab.js、OpenSesame 或普通 HTML/JavaScript；
- 注意与执行控制、记忆、语言加工、决策与奖赏、社会与情绪、知觉、基础反应等类别；
- 许可证文件、远程资源、可能的数据联网代码和已有导出逻辑。

无法识别类别时自动归入“待整理”。缺少入口文件时仍会进入目录，但显示“文件不完整”。

## 审核后启用

第三方 JavaScript 与普通软件一样具有完整执行能力，可能上传实验数据、加载外部资源或修改页面。因此，新解压的包默认显示“待审核”，不会直接提供运行按钮。

审核后，在实验包根目录添加 `paradigm.json`：

```json
{
  "name": "Stroop 色词干扰",
  "description": "判断字体颜色，忽略文字含义。",
  "category": "注意与执行控制",
  "platform": "PsychoJS",
  "entry": "index.html",
  "license": "MIT",
  "source": "https://example.org/source-project",
  "approved": true,
  "allowNetwork": false,
  "dataExport": "self"
}
```

`dataExport` 可取：

- `adapter`：已接入本平台的统一结果接口；
- `self`：原实验自己提供文件下载；
- `none`：尚未确认导出能力。

`approved: true` 代表维护者已经检查该包，且必须同时填写或提供许可证。`allowNetwork: true` 仅用于已经确认远程资源和数据去向的程序；默认值为 `false`。扫描器不会替维护者作出法律或隐私判断。

## Pavlovia 包注意事项

PsychoJS 导出通常不只有一个 JavaScript 文件，还包含 `index.html`、条件表、图片/音频和指定版本的 `lib/psychojs-*.js`。必须保留原目录结构。原程序如果仍连接 Pavlovia，需要先改成本地数据导出，或在 `paradigm.json` 中保持未批准状态。

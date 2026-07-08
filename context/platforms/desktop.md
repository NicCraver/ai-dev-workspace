# Desktop (Electron) 端一页纸

> 保持在约 100 行以内。由 /distill 定期结晶更新，人工修正错误。最后更新：2026-07-08

## 基本信息
- 仓库：apps/desktop/（独立 git 仓库，electron-vue 脚手架）
- 技术栈：**Electron 19 + Vue 2.7**（Vuex 3 / vue-router 3）；webpack 4 + babel 6/7（`.electron-vue/`）；electron-builder 23 打包。渲染层 UI 混用 **element-ui 2 / ant-design-vue 1 / iview 3** + UnoCSS 0.50。IM：融云 `@rongcloud/imlib-v2`；网络：axios + ws（Pulsar WebSocket）；存储：sqlite3 + leveldown/levelup + electron-store；媒体：ffmpeg / video.js / fabric / tui-image-editor；自动更新：electron-updater；启用 `@electron/remote`。包管理 npm，`volta` 锁 **Node 14.21.3**。
- 最低支持版本 / 目标环境：Windows（NSIS，x64，兼容 Win7）/ macOS（dmg，x64）/ Linux（deb）；`appId=zhixin.zhiguaniot.com`，productName 智信。

## 常用命令
```bash
# 安装（postinstall 自动 lint:fix + electron-builder install-app-deps 重编译原生模块）：
npm install
# 开发（热重载 localhost:9080；MODE_ENV ∈ dev|test|pre|gray|prod）：
npm run dev          # 或 dev:test / dev:pre / dev:gray / dev:prod
# 打包（webpack 构建 + electron-builder；同 5 个环境）：
npm run build        # 或 build:test / build:pre / build:gray / build:prod
# 按平台出包（环境 × 平台）：
npm run pack:win-prod   # 或 pack:mac-prod / pack:win-test / pack:mac-dev ...
npm run build:dir       # 只打目录不压缩（快速验证）
# lint / 测试 / 清理：
npm run lint ; npm run lint:fix
npm test             # vitest --ui（另有 npm run unit：karma，老）
npm run build:clean
```
> 测试与 mock 基本空置（`test/unit` 仅 1 个 spec；`mockjs` 在依赖里但未启用）。质量靠 `npm run lint` + 真机跑。

## 目录与架构约定
- **electron-vue 三段式**：`src/main/`（主进程）· `src/renderer/`（Vue 渲染）· `src/modules/`（共享：FileRW/logger/utils）。构建入口 `main` → `./dist/electron/main.js`。
- **主进程** `src/main/`：`index.js`（窗口/托盘/单例/快捷键/崩溃处理）；`ipc/`（按域分文件：app/dialog/popup/setting/upgrade）；`controller/`（token、sqlite、leveldb、secret、server-time）；`process-manager/`（多窗口：main-view、top-notice、show-media/show-message、screen-cut 截图）；`native-ui/`（托盘）。
- **渲染进程** `src/renderer/`：`main.js`+`App.vue` 入口；`router/`（vue-router）、`store/`（Vuex，含 `module/`）、`service/`（**网络层**，按业务域 + `config/axios.config.js`）、`plugin/`（websocket/notification/clipboard/polling-notice/file-* 等）、`WebIM/`、`pages|views|components/`、`mixin|directives|filters/`。
- **环境**：`MODE_ENV` 经 `cross-env` 注入，`dotenv-webpack` 读 `.env`（公共网关路径/DB 名后缀基线）+ `.env.<env>`（BASE_URL/APP_URL/Pulsar/DB 名）。5 套：dev/test/pre/gray/prod。构建时 `changeVersionAddEnv()`（`.electron-vue/utils.js`）改版本/注入环境；独立安装包后缀看该文件 `SuffixMode`。
- **存储**：sqlite3（业务库）+ leveldown（缓存）+ electron-store（设置）+ electron-json-storage。DB 名按环境区分（`DB_*` 后缀）。

## Mock 开关方式
- **无统一 mock**（`mockjs` 仅在 devDeps 未启用）。环境/后端域名切换靠 **MODE_ENV + `.env.<env>`**（dev→192.168.10.25、prod→zhixin.zhiguaniot.com 等）。
- **页面先行**：按 `context/contracts/` 类型在 `src/renderer/service/` 内构造本地数据，接口到位后删除并在活跃功能 impl-notes 记录。

## WebView 集成方式
- Desktop 是**宿主**：通过 `BrowserWindow`/iframe 加载内嵌 web（智信 AI 框、行动中心、群公告等，URL 见 `.env.*` 的 `APP_AICHAT`/`APP_ACTIONCENTER`/`APP_GROUPBULLETIN`）。
- 对内嵌 web 的请求统一在 `src/main/index.js` 用 `session.webRequest.onBeforeSendHeaders` 注入 `Cache-Control: no-cache`（路径前缀 `ai-chat/`、`action-center/`、`group-bulletin/`）。
- **桥接（对应 `context/bridge.md` 的宿主侧）**：渲染进程经 `ipcRenderer` 调主进程 `ipcMain.handle/on`，分模块在 `src/main/ipc/` 与 `src/main/controller/`（如 `token.controller` 提供 `get-token`，正是 web 端 `window.webview.ipcRenderer.sendSync("get-token", n)` 的对端）。内嵌 web 经 `@electron/remote` 暴露的 `window.webview.ipcRenderer` 与本端通信。新增通道务必同步契约与 bridge.md。

## 已知坑
- **Node 14.21.3**（volta，README 建议 14.17.6）；原生模块 sqlite3/leveldown 依赖该版本，**macOS arm64（M1）需特殊编译**：leveldown ≥6，sqlite3 `--build-from-source --target_arch=arm64`（见 README「m1芯片运行」）。
- `yarn.lock` 与 `package-lock.json` **并存**，依赖版本可能漂移；统一用一种（README 示例用 npm）。
- 工具链整体偏老（Vue 2 / webpack 4 / ESLint 4 / babel 6-7），新 IDE 插件可能不兼容；`postinstall` 会自动 `lint:fix`，拉代码后留意工作区 diff。
- **禁用 ES2020 语法**（可选链 `?.`、空值合并 `??`）：webpack4/babel6-7 目标运行时不转译，用 `&&` 兜底（如 `(x && x.y) || []`、`data && data.type`）。渲染层 `.vue`/`.js`、preload `static/plugin/webview.js` 均适用。（web 端 apps/web 可用 `?.`——跑在 webview 现代 Chromium。）
- `electron-builder.yml` 已在 .gitignore，但仓库内仍存在，**Windows 签名证书密码明文**（`certificatePassword`）——勿外泄，勿重新提交该文件。
- 多窗口 + `@electron/remote` + IPC 交错，窗口生命周期/单例/关闭逻辑易出竞态（`src/main/index.js` 的 `closeWin`/`gologin`/`realQuit` 等）。
- 渲染层三套 UI 库（element-ui/ant-design-vue/iview）混用，体积大、风格不统一，新功能尽量沿用同域既有库。

## 深度参考（组件级调研）
- [转发弹窗（消息转发）](./desktop-forward-dialog.md) —— `transmit-message.vue` 全链路：UI/五条取数通道/三种转发模式/智能体字段/子组件契约/移植要点。关键词提醒：代码里「转发」=`transmit`。

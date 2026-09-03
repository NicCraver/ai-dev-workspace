# Status：PC 端集成 DeepSeek Harness（dsh）

> 最后更新：2026-09-03（含风险分析 risks.md） ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

把开源的 DeepSeek Harness（`@deepseek-ai/dsh`）内嵌进智信 PC 端：侧边栏新增入口，点开即用；安装包自带独立 Node 运行时，**终端用户机器上无需任何 Node 环境**。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 可行性调研 | — | — | — | ✅ |
| spec | — | — | — | ✅ |
| 内嵌运行时准备脚本 | — | — | — | ✅ |
| 主进程 dsh 进程管理 + IPC | — | — | — | ✅ |
| 侧边栏入口 + 面板 | — | — | — | ✅ |
| afterPack 打包接入 | — | — | — | ✅ 真实构建流程验证 |
| webpack 编译 | — | — | — | ✅ exit 0 |
| 完整 electron-builder 打包 | — | — | — | ✅ exit 0（含 npmRebuild） |
| 打包产物启动 | — | — | — | ✅ app 正常起，主进程存活 |
| 无 Node 环境可用性 | — | — | — | ✅ `env -i` 验证通过 |
| **GUI 自测（点侧边栏看界面）** | — | — | — | ⬜ **未做，需登录账号** |
| 无 Node 的**他人机器**验证 | — | — | — | ⬜ |

> 仅 desktop 单端功能，其余三端不涉及。

## 本回合各端现状（code-status）

2026-09-03 `code-status.sh` 输出：

| 端 | 分支 | 同步 | 脏区 | 归属 |
|---|---|---|---|---|
| desktop | `feat/dsh-integration` | no upstream | 脏(3) 本地调试勿提交 | **本功能**，`2d8b5821` 已提交、**未 push** |
| context | main | ahead 39 | 干净 | 本功能文档 |
| android | master-3.6.23 | synced | 脏(4) | markdown 配色，非本功能 |
| ios | master-3.5.32 | synced | 脏(1) | 同上，非本功能 |
| meeting | main | ahead 4 | 脏(85) | 会议室系列，非本功能 |
| contact | — | — | 脏(2) | 会议室后端，非本功能 |
| web | feat/data-scope-storage-group | synced | 干净 | 非本功能 |

> 提交时已按仓库禁忌排除 `.env.test` / `electron-builder.yml` / `package.json`——
> 这三个文件工作区里的改动是本地调试用的（test 包名、arm64），与本功能无关。

## 2026-09-03 回合

打开上一回合的产物做 GUI 自测，**发现并修了第一个真实缺陷**。

### 坑：Chromium 102 缺 `AbortSignal.timeout`

现象：dsh 界面里点「选择工作区」，报

```
workspace create failed: internal: AbortSignal.timeout is not a function
```

文件夹选不了。

根因：本端 Electron 19 的渲染层是 **Chromium 102**（2022-05），而 `AbortSignal.timeout`
是 **Chrome 103** 才引入的。dsh 的前端是 2026 年的 TypeScript，按现代浏览器 target 编译，
直接用了这个 API。服务端（内嵌 Node 24）有这个 API，所以问题只在 webview 侧。

> 这正是 spec 第三节里点过名的「Chromium 102 渲染层特性受限」风险，第一次具体落地。

修法：给 dsh 的 webview 挂 preload，做特性检测式 polyfill。
新增 `static/plugin/dsh-webview-preload.js`，除 `AbortSignal.timeout` 外顺带补齐了
同样可能被现代代码用到的：

| API | 需要的 Chrome 版本 |
|---|---|
| `AbortSignal.timeout` | 103（**已确认撞上**） |
| `Array.prototype.toSorted / toReversed / with / toSpliced` | 110 |
| `AbortSignal.any` | 116 |
| `Object.groupBy` / `Map.groupBy` | 117 |
| `Promise.withResolvers` | 119 |

webview 同时加了 `webpreferences="contextIsolation=0"`，否则 preload 里的补丁落不到页面全局。
dsh 是本地回环页面，preload 只补纯 JS API、不暴露任何 Node 能力。

路径取法与既有 `webview-control.vue` 一致（打包后 `static/` 被拷进 `dist/electron/static`）。

> **这个坑不是 dsh 独有的**：任何内嵌按现代 target 编译的 Web 应用，在本端都会撞
> Chromium 102 的天花板。后续遇到新的 `xxx is not a function`，往这个 preload 里加即可。

android / ios / meeting / contact 四个仓库的脏区 mtime 全是 09-02（昨天 09:06–20:50），
属于 markdown 配色与会议室那几个活跃功能的遗留，与本功能无关，本回合未触碰。

## 方案要点

**接入面：本地 Web UI + webview**，不是 ACP、不是自绘。

- 主进程用**内嵌的 Node 24** spawn `dsh web --no-open --host 127.0.0.1 --port 0`
- 从 stdout 正则提取 `http://127.0.0.1:<port>`，交给渲染层 `<webview>` 加载
- dsh 只监听回环地址，不开放外部访问

**为什么不用 ACP**：官方 `@deepseek-ai/dsh-acp` 自述为「仅面向自动化的传输适配器，而非 UI 集成」，不提供推理、计划、工具展示，且**没有逐 token 流式**（只在消息提交后整条下发）。撑不起交互式聊天界面。详见 spec 第二节。

**为什么必须捆 Node**：本端是 Electron 19（内置 Node 16），dsh 要求 Node ^22.19 || >=24，`ELECTRON_RUN_AS_NODE` 复用不了。

## 文件清单（apps/desktop）

| 文件 | 作用 |
|------|------|
| `src/main/dsh/dsh-runtime.const.js` | 版本与布局常量。**纯 CommonJS**，主进程 / 构建脚本 / afterPack hook 三方共用 |
| `src/main/dsh/dsh-runtime-path.js` | 运行时路径解析（开发期 vs 打包后）、就绪校验 |
| `src/main/dsh/dsh.controller.js` | spawn / 就绪等待 / 停止 / 重启；退出时回收子进程 |
| `src/main/ipc/dsh-ipc.js` | `dsh-ensure-started` / `dsh-get-status` / `dsh-restart` / `dsh-stop` |
| `src/renderer/views/dsh/index.vue` | 面板：启动中 / 失败重试 / webview 三态 |
| `scripts/dsh/prepare-dsh-runtime.js` | 构建期准备运行时（下载 Node + 装 dsh） |
| `scripts/dsh/fs-utils.js` | 准备脚本与 hook 共用的文件工具 |
| `hook/afterPackHook.js` | 把运行时拷进安装包并补执行位 |

改动的既有文件：`src/main/index.js`（注册 IPC）、`src/renderer/router/index.js`（`dsh` 路由）、`src/renderer/views/main.vue`（面板挂载 + 懒加载）、`src/renderer/components/layouts/new-aside-menu.vue`（侧边栏入口）、`.gitignore`。

## 关键决策记录

- 2026-09-02 **走 afterPack hook，不改 `electron-builder.yml`**。该文件在 desktop 的 `.gitignore` 里且仓库明令禁止提交，配置改动进不了主干；afterPack 是纯代码路径，可提交。同理没有动 `package.json`（不加 npm script）。
- 2026-09-02 **运行时产物不进版本库**。约 390MB，由 `prepare-dsh-runtime.js` 在构建机上生成，`.gitignore` 排除 `resources/dsh-runtime/`。
- 2026-09-02 **只保留 Node 可执行文件本体**，剔掉官方发行包里的 npm / 头文件 / 文档，省约 60MB。
- 2026-09-02 **`DSH_HOME` 指向 `userData/dsh-home`**，不能用包内资源目录——macOS 签名后只读，dsh 首次启动要往 home 里 seed profile。
- 2026-09-02 **面板懒挂载**：只有用户第一次点侧边栏入口才挂载并 spawn，避免开机就多一个 Node 进程。
- 2026-09-02 **不做交叉平台准备**：dsh 依赖树含按平台分发的预编译包（sharp / koffi），npm 只装当前平台那份。与仓库既有约定一致——mac 包在 mac 上构建，Windows 包在 Windows 上构建。

## 实测数据（2026-09-02，macOS arm64）

| 项 | 值 |
|---|---|
| dsh 冷启动到监听 | ~1s（profile 已 seed） |
| dsh 进程常驻内存 | RSS ~185MB |
| 首页 HTTP | 200，14.5KB |
| `@deepseek-ai/dsh` 依赖 | 453 包，275MB，装 10-13 分钟 |
| 内嵌 Node 24.20.0 | 129MB |
| **运行时合计** | **403MB**（`resources/dsh-runtime/`） |
| afterPack 拷贝耗时 | 14.7s（417MB） |

### 已完成的验证

1. **无系统 Node 可用性**（本功能的核心验收点）
   `env -i HOME=… DSH_HOME=… <内嵌node> <dsh bin> web --no-open --port 0`
   —— 清空 PATH、不依赖系统任何 Node，启动成功，stdout 出 `dsh web: http://127.0.0.1:57486`，`curl` 200。
2. **打包位置副本同样可用**：用模拟 context 调 `afterPackHook`，把运行时拷进
   `<app>/Contents/Resources/dsh-runtime/`，执行位保留（`-rwxr-xr-x`），再次 `env -i` 启动成功、HTTP 200。
3. **webpack 编译通过**（`node .electron-vue/build.js`，exit 0）；`npm run lint` 无告警。
4. **完整 `electron-builder --dir` 打包通过**（exit 0，**含 `npmRebuild` 原生模块重编译**）。
   产物 `build/mac-arm64/zhixin-test.app` 共 841MB，其中 `dsh-runtime` 417MB。
   asar 内确认含 `dsh-ensure-started`、`dsh-runtime`、渲染层面板代码。
5. **打包产物能启动**：`open` 起 app，主进程存活、共 5 个进程；未点入口时 dsh 子进程为 0，
   符合懒挂载设计。
6. **产物内的 runtime 可用**：从 `<app>/Contents/Resources/dsh-runtime/` 直接 `env -i` 启动，
   HTTP 200，内嵌 Node 报 `v24.20.0`。

> 关于 `npmRebuild`：本机 Node 24（非仓库要求的 14.21.3）下重编译**成功**。
> `leveldown.node` 未变动；`sqlite3` 的 `lib/binding/napi-v3-darwin-arm64/node_sqlite3.node`
> 被重新编译，但字节数与重编译前完全一致（1760432）——napi-v3 是稳定 ABI，与 Node/Electron
> 版本无关。`node_modules` 无损伤。

## 风险分析

见同目录 [risks.md](./risks.md)——基于本地实测的未来坑位清单。核心结论：

- **CSS 有 4 个 Chromium 102 不支持的特性**（`:has()` / `@container` / `color-mix()` / `subgrid`），**无法 polyfill 且静默失效**，是最该先看的一条
- JS 侧 4 个缺口（`AbortSignal.timeout/any`、`toReversed`、`Promise.withResolvers`）已被现有 preload 全覆盖，这是目前「用起来问题不大」的原因
- `showDirectoryPicker` 未被使用，此前担心的 File System Access API 问题**不成立**
- 端口安全实测：只绑回环、跨站 Origin 被 403 拦，**风险低于 spec 第五节原先的判断**
- 更新包体积（每次发版是否重下 417MB）与内网代理是两个必须先查清的工程问题

## 待办 / 阻塞

- **GUI 自测未做**：需要 `npm run dev:test` 起应用，登录后点侧边栏「Harness」，确认能出 dsh 界面。
  代码路径已编译、打包、启动全部通过，但界面层没有人眼验证过——这是唯一还没被覆盖的环节。
- 在**别人的、没装 Node 的机器**上装一次安装包（本机验证用的是 `env -i` 隔离，等价但不是真机）
- 体积优化：275MB 里有约 120-150MB 是用不到的东西（别家模型 SDK、sharp、Web UI trajectory 包、全平台 node-pty prebuilds），可裁。**先保证能跑，裁剪单独做一轮并回归**
- 模型端点与凭据：默认打公网 `platform.deepseek.com`，内网可用性与合规待确认
- 安全：dsh 能跑 shell 改文件，装进员工客户端等于开了本地任意代码执行面。需要产品/安全过一轮审批策略（见 spec 第五节）
- `dsh plugin` 子命令会调 pnpm，用户机器没有 pnpm，该功能在内嵌环境下不可用

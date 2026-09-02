# Status：PC 端集成 DeepSeek Harness（dsh）

> 最后更新：2026-09-02 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

把开源的 DeepSeek Harness（`@deepseek-ai/dsh`）内嵌进智信 PC 端：侧边栏新增入口，点开即用；安装包自带独立 Node 运行时，**终端用户机器上无需任何 Node 环境**。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 可行性调研 | — | — | — | ✅ |
| spec | — | — | — | ✅ |
| 内嵌运行时准备脚本 | — | — | — | ✅ |
| 主进程 dsh 进程管理 + IPC | — | — | — | ✅ |
| 侧边栏入口 + 面板 | — | — | — | ✅ |
| afterPack 打包接入 | — | — | — | ✅ |
| 本机 dev 自测 | — | — | — | 🚧 |
| 打包产物真机验证（无 Node 机器） | — | — | — | ⬜ |

> 仅 desktop 单端功能，其余三端不涉及。

## 本回合各端现状（code-status）

| 端 | 分支 | 说明 |
|---|---|---|
| desktop | `feat/dsh-integration`（新建，自 `master-3.4.27`） | 本功能全部改动 |
| context | main | 本功能文档 |

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
| `@deepseek-ai/dsh` 依赖 | 453 包，275MB，装 13 分钟 |
| Node 24.20.0 二进制 | 116MB |
| 运行时合计 | 见下方「待办」中的实测结论 |

## 待办 / 阻塞

- 本机 `npm run dev` 起应用，点侧边栏 Harness 入口，确认能出 dsh 界面
- 跑一次 `npm run build:dir`，确认 afterPack 把运行时拷进产物、内嵌 Node 有执行位
- 在**没装 Node 的机器**上验证安装包（这是本功能的验收标准）
- 体积优化：275MB 里有约 120-150MB 是用不到的东西（别家模型 SDK、sharp、Web UI trajectory 包、全平台 node-pty prebuilds），可裁。**先保证能跑，裁剪单独做一轮并回归**
- 模型端点与凭据：默认打公网 `platform.deepseek.com`，内网可用性与合规待确认
- 安全：dsh 能跑 shell 改文件，装进员工客户端等于开了本地任意代码执行面。需要产品/安全过一轮审批策略（见 spec 第五节）
- `dsh plugin` 子命令会调 pnpm，用户机器没有 pnpm，该功能在内嵌环境下不可用

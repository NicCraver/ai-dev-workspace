# 行动中心（action-center）一页纸

> 保持在约 100 行以内。最后更新：2026-08-27（首次建立，静态勘察，未跑过构建）

## 基本信息
- 仓库：`apps/action-center/`（`zx-operation-center`），远端 `zx/zx-action-center-pc.git`，主分支 `release`。
- **性质：不是智信的某一端**，是公司另一个 web 项目。本工作区里主要当**参考源**——抄它的交互 / 逻辑 / 界面到智信各端；未来也会直接迭代它自己。
- **本地依赖未安装（`node_modules` 为空），当前是只读状态。** 只看代码不跑东西的话不用装。
- 技术栈：Vue 3.5（`<script setup>`）+ Vite 4 + Vue Router 4（文件式路由 `vite-plugin-pages`）+ UnoCSS + Element Plus（PC）+ Vant（移动）+ Tiptap 2.9.1（富文本，重度使用）+ axios。状态管理用 Vue 3 响应式 + composables，**无 Pinia/Vuex**。
- ⚠️ **`package.json#volta` 锁的是 node 16.20.2 / pnpm 7.33.6**——比 `apps/web`（node 22 / pnpm 10）老两个大版本。装依赖前确认 volta 已切版本，别用当前 shell 的 node 直接装。
- 部署 base 固定 `/action-center/`。

## 常用命令
```bash
# 装依赖（volta 会切到 node 16 / pnpm 7）：
pnpm i
# 启动开发（端口 6173，host 0.0.0.0，/api 代理到 192.168.10.25）：
pnpm dev
# 单入口开发：cross-env BUILD_TARGET=main|zx|m|share vite dev
# 全量构建（vue-tsc → 依次 build main/zx/m/share → mergeDist.js 合并到 dist/）：
pnpm build
# 单入口构建：pnpm build:main | build:zx | build:mobile | build:share
# 预览：pnpm preview
```
> **无 ESLint、无 test 脚本**；类型检查唯一手段是 `vue-tsc`（已内嵌在 `build`）。构建脚本用 `nr`（`@antfu/ni`）串联。

## 目录与架构约定
- **MPA 四入口**（`vite.config.ts` 的 `BUILD_TARGET`）：`index.html`(主/PC) · `zx/`(智信桌面) · `m/`(移动) · `share/`(分享)。分别构建到 `dist_<target>`，最后 `mergeDist.js` 合并成单个 `dist/` 并生成 `build_version`（含 CI 元数据）。
- **路由（文件式）**：`src/pages/` → 主应用；`src/mpa/zx-desktop/pages/` → 智信桌面；`src/mpa/zx-mobile/pages/` → 移动。支持 `[id]` / `[...all]` 动态段。
- **网络层 `src/api/`**：`axiosInstance.ts` 是核心，其余按业务域拆（`chat.ts` / `okr.ts` / `weekwork.ts` / `t0.ts` / `o5.ts` 等），`index.ts` 汇总导出。
  - `baseMap` 按域分前缀：`auth=/api/oauth`、`chat=/api/chat/v1`、`contact=/api/contact/v1`、`action=/api/actionCenter/v1`（默认 baseURL）、`file=/api/oss/v1`、`workMethod=/api/workMethod/v1`、`okr=/okr`。
  - 业务码约定与智信 web 端**一致**：`M0000` 成功；`O_T_001/002` 刷 token 重放；`O_T_003` 登录过期。失败重试 ≤3 次（`retryMap` 按 `retrykey` 计数，间隔 2s）。
  - 部分错误码**故意不弹 toast**：`W_M_00001` / `W_M_00002`（T0 无权限）、`A_D_00010`（行动保存冲突）。抄这块逻辑时别把静默名单丢了。
  - `clientType` 从 URL 参数读并存 sessionStorage，每个请求作为 header 下发。
- **宿主通信封装在 `src/pageHandle.js` + `src/pageMsg.js`**，不是散落在组件里。三种宿主分支写在 `openActionPage()` 里：iframe → `window.top.postMessage({to:"operation", …})`；移动端原生 → `@tjmt/wnsdk`；纯网页 → 开新窗口。
- **样式**：UnoCSS 原子类，token 在 `unocss.config.js`。`primary: #3E7EFF` 与智信 web 端**同色**，抄界面时配色基本可直接对齐。
- **别名**：`@/` → `src/`。
- `docs/feat/` 下按日期存着历次功能的复盘文档，`spec/` 下有若干 `*.spec.md`——**找某个交互当初为什么这么做，先翻这两个目录**，比读代码快。

## Mock 开关方式
- **无统一 mock 开关 / Mock Service**。组件内零散内存 mock，另有 `src/mpa/zx-desktop/pages/call-card-playground.vue` 这类 playground 页面用来单独调组件。
- 本仓库不参与 `context/contracts/` 的页面先行流程（契约服务的是智信四端）。

## WebView / 宿主集成方式
被嵌入方，三种宿主形态：
- **智信 PC（Electron iframe）**：token 由宿主统一管理。`axiosInstance.ts` 的 `requestTokenFromParent()` 走 `window.top.postMessage("getToken")` ↔ parent 回 `{type:"setToken", data:{access_token, refresh_token}}`，5s 超时。**与 `apps/web` 的 `tokenBridge.js` 是同一套协议**（见 `context/bridge.md`）。
- **移动端原生**：走 `@tjmt/wnsdk`（`openSDKPage` / `openO5SDKPage`），与 web 端用法不同——web 端没这个依赖。
- **纯网页**：开新窗口。

## 已知坑
- ⚠️ **dev 端口 6173 与 `apps/web` 完全相同**，两个项目不能同时起 dev server。要并行调试得改一边的 `server.port`。
- ⚠️ **`tests/unit/` 下 6 个 `.test.js` 用 vitest 写的，但 `package.json` 既没装 vitest 也没 test 脚本**——现状是跑不起来。要跑得自己补依赖与脚本；抄这些文件里的逻辑时别默认它们是绿的。
- 另有 4 个 `.spec.js` 散在 `src/components/**` 里（如 `RemindLaterSettingPopup.spec.js`），同样跑不了。
- node 16 / pnpm 7 的老工具链，与工作区其他 web 项目不互通；`pnpm-lock.yaml` 是 lockfile v5 格式，别用新 pnpm 去改它。
- `patches/html-to-image@1.11.11.patch` + 一大串 `@tiptap/extension-*` 的 `overrides` 锁在 2.9.1——**升 Tiptap 会连锁炸**，抄富文本相关代码时注意版本差异（`apps/web` 用的是 Tiptap 3）。
- 仓库根目录有个被 git 跟踪的 `@tiptap-pro/` 目录（私有包的 dist 直接入库）。工作区里它常显示为已删除的脏区，**不要 stage 这些删除**。
- `auto-imports.d.ts` / `components.d.ts` 是生成物，勿手改。
- `base` 固定 `/action-center/`，部署路径须一致否则资源 404。

## 从这里抄代码到智信各端时
按 `CLAUDE.md`「跨端移植规则」的例外条款：本仓库没有 impl-notes，**可以直接读源码**。但——
1. 先用 codebase-memory 或 Grep 定位，别整目录漫读。
2. 抄过来按目标端惯用范式重写，别把 MPA / Vite / Tiptap 2 的结构假设带进去。
3. 抄的实现若有非显然取舍（为什么这么做交互、边界条件），写进当前功能的 `impl-notes.md` 并注明来源是本仓库哪个文件。

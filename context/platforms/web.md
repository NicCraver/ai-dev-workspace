# Web 端一页纸

> 保持在约 100 行以内。由 /distill 定期结晶更新，人工修正错误。最后更新：2026-07-07

## 基本信息
- 仓库：apps/web/
- 技术栈：Vue 3.5（`<script setup>`）+ Vite 7 + Vue Router 4（文件式路由 `vite-plugin-pages`）+ UnoCSS（presetWind3 / typography / icons）+ Element Plus（PC）+ Vant（移动）+ ant-design-x-vue + Tiptap 3（富文本）+ axios + `@microsoft/fetch-event-source`（SSE 流式）。状态管理用 composables（`src/use/`），**无 Pinia/Vuex**。包管理 pnpm，`package.json#volta` 锁定 node 22.16.0 / pnpm 10.22.0。
- 最低支持版本 / 目标环境：现代浏览器（ESNext；`m/index.html` 内 polyfill 了 `Object.hasOwn`/`Array.at`）；以 `/ai-chat/` 为 base 部署；既作独立 Web，也内嵌于智信 PC/移动端 WebView 与 iframe。

## 常用命令
```bash
# 安装依赖（volta 自动切到锁定版本）：
pnpm i
# 启动开发（端口 6173，host 0.0.0.0，/api 代理到 192.168.10.25）：
pnpm dev
# 构建（dev 产物：vue-tsc → 依次 build main/zx/m/share → mergeDist.js 合并到 dist/）：
pnpm build
# 生产构建（读 .env.prod）：
pnpm build:prod
# 单入口构建：pnpm build:main | build:zx | build:mobile | build:share（均有 :prod 变体）
# 预览：pnpm preview
# 格式化（仅 prettier，作用于 src/）：
pnpm format
# 清理重装：pnpm dev:clean
```
> **无 ESLint、无测试脚本**；类型检查唯一手段是 `vue-tsc`（已内嵌在 build 里，单独跑用 `pnpm exec vue-tsc --noEmit`）。

## 目录与架构约定
- **MPA 四入口**（见 `vite.config.js` 的 `buildEntries`）：`index.html`(主/PC) · `zx/`(桌面) · `m/`(移动) · `share/`(分享)。各自有独立 `main.js`：根 `src/main.js`、`src/mpa/desktop/main.js`、`src/mpa/mobile/main.js`。**新增全局插件/样式要同步三处 main.js。**
- **路由（文件式）**：三套虚拟模块 `~pages`(src/pages) / `~zx-pages`(src/mpa/desktop/pages) / `~m-pages`(src/mpa/mobile/pages)，命名即路由；`router.js` 另导出 `hashRouter` 与版本自更新逻辑。
- **网络层 `src/server/`**：`http.js` 是 axios 实例（baseURL `/api/aiBasic`，30s；请求拦截自动加 `Authorization`/`zxCorpId`/`clientType`/`version`；响应拦截处理业务码：`M0000` 成功 / `O_T_001/002` 静默刷新 token / `O_T_003` 登录过期 / 失败重试 ≤3 次）。按业务域拆 `src/server/module/*.js`；**`src/server/index.js` 由 `vite-auto-api-exports` 自动生成，勿手改——加新 module 文件即自动并入导出。**
- **AI 流式接口**不走 http 实例：用编译期常量 `API_AI_BASE_URL`（vite define，源 `VITE_API_AI_BASE_URL`）+ 直接 axios 或 `src/stream/useEventSource.ts`（SSE）。
- **状态**：composables 放 `src/use/`；登录态集中在 `src/loginUtil.js`（sessionStorage：`aiToken`/`aiUser`/`aiCorpId`）。
- **样式/组件**：UnoCSS 原子类 + `uno.config.js` 主题 token（primary `#3E7EFF` 等）；Element Plus / Vant / ant-design-x-vue 走 unplugin 按需自动注册。
- **别名**：`@/` → `src/`。

## Mock 开关方式
- 当前**无统一 mock 开关 / Mock Service**；现状是组件内零散内存 mock（如 `createMockAgents()`），注释标注「后续接接口替换」。
- **页面先行约定**：按 `context/contracts/` 的类型在 `src/server/module/` 或组件内构造本地 mock，接口到位后删 mock、改回真实调用，并在活跃功能 impl-notes 记录差异。

## WebView 集成方式
Web 端是**被嵌入方**，与宿主通信走以下通道（协议对照见 `context/bridge.md`）：
- 智信独立窗口（Electron 风格 IPC）：`window.webview.ipcRenderer`（如 `sendSync("get-token", n)`、`on("open-page", …)`）。
- 智信 iframe：`window.postMessage("getToken")` ↔ parent 回 `{type:"setToken", data}`。
- 统一封装在 `src/utils/tokenBridge.js`（`isInIframe()` / `isEmbeddedInZxHost()` / `requestTokenFromHost()`）；**取 token 一律走它，不要在组件里重复写 postMessage/ipc。**
- **平台识别**：MPA 插件向 `m/zx/share` 的 HTML 注入 `window.__VITE_MPA_PLATFORM__`（值 ∈ `m`/`zx`/`share`，主应用为 undefined），运行期读它判断当前宿主形态。

## 已知坑
- `API_AI_BASE_URL` 与 `VITE_API_AI_BASE_URL` 是 vite **编译期**注入，改 `.env` 必须**重启 dev server**，HMR 不生效。
- `base` 固定 `/ai-chat/`，部署路径须一致，否则资源 404。
- `src/server/index.js`、`components.d.ts`、`auto-imports.d.ts`、`tsconfig.tsbuildinfo` 均为生成物，勿手改（后两者与 `dist_*` 已在 .gitignore）。
- 全局插件/样式注册散落在三个 `main.js`，漏改会导致某入口行为不一致。
- 无 lint/test，质量靠人工 + `vue-tsc`；提交前建议 `pnpm format` 并本地跑一次 `pnpm build` 验类型。

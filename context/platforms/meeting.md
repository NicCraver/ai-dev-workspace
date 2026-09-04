# 智能会议室端一页纸

> 保持在约 100 行以内。由 /distill 定期结晶更新，人工修正错误。最后更新：2026-09-04

## 基本信息
- 仓库：apps/meeting/（前端，独立 git，源码在仓库根 `src/`）。后端在 `apps/contact`（Java `/meetingRoom`）。
- 前端技术栈：Vue 3.5（`<script setup>`）+ Vite 8 + Vue Router 4（文件式路由 `vite-plugin-pages`）
  + UnoCSS 66（presetWind3 / typography / icons）+ Element Plus（PC）+ Vant（移动）+ axios。
  状态管理用 composables（`src/composables/`），**无 Pinia/Vuex**。JS 为主，工具/类型用 TS。
- 功能目录：`src/features/booking` 预定 · `agent` 助手 · `admin` 管理 · `race` 抢订 · `demo`。
- 包管理 pnpm，根 `package.json#volta` 锁 node 22.16.0 / pnpm 10.22.0。
- 目标环境：以 `/meeting/` 为 base 部署；既作独立 Web，也内嵌于智信 PC / iOS / 安卓 WebView。

## 常用命令
```bash
# 在 apps/meeting/ 根执行
pnpm i
pnpm dev              # 前端，端口 6273；/meetingApi → Java 7004 /meetingRoom
pnpm build            # vue-tsc → main/zx/m → mergeDist 合并到 dist/
pnpm build:prod       # 生产构建
pnpm test             # Vitest 5 单测，`src/features/**/tests/*.test.js`
pnpm test:ui          # Vitest UI
pnpm test:e2e         # Playwright UI E2E（需 contact :7004；前端可 reuse :6273）
pnpm test:e2e:headed  # 弹出 Chromium，放慢操作方便看
pnpm test:e2e:ui      # Playwright 控制台，勾选用例再看浏览器
pnpm format           # prettier，仅作用于 src/
```
> **无 ESLint**；类型检查用 `vue-tsc`（已内嵌在 build，也可 `pnpm typecheck`）。`tsconfig.json` 是 `checkJs: false`，
> 源码以 JS 为主，故 `vue-tsc` 实际只覆盖 `.ts` / `.d.ts`，**不检查现有 JS 文件与 `.vue` 里
> 的 JS 脚本块**——质量保障对 JS 部分仍主要靠人工 review。

## 目录与架构约定
- **MPA 三入口**（见 `vite.config.js` 的 `buildEntries`）：`index.html`(main) · `zx/`(PC) · `m/`(移动)。
  **没有 share 入口。** 各自有独立 `main.js`：`src/main.js`、`src/mpa/desktop/main.js`、
  `src/mpa/mobile/main.js`。**新增全局插件/样式/指令要同步三处。**
- **路由（文件式）**：三套虚拟模块 `~pages`(src/pages) / `~zx-pages`(src/mpa/desktop/pages) /
  `~m-pages`(src/mpa/mobile/pages)；`src/router.js` 另含版本自更新（动态 import 失败 →
  比对 `/meeting/build_version` 与 `JENKINS_BUILD_NUMBER` → 提示刷新）。
- **网络层 `src/api/`**：`http.js` 是 axios 实例（baseURL `/meetingApi`，30s；请求拦截自动加
  `Authorization`/`zxCorpId`/`clientType`/`version`；响应拦截处理业务码：`M0000` 成功 /
  `O_T_001/002` 静默刷新 token / `O_T_003` 登录过期 / 失败重试 ≤3 次）。按业务域拆
  `src/api/module/*.js`；**`src/api/index.js` 由 `vite-auto-api-exports` 自动生成，勿手改。**
- **后端**：会议室接口在 `apps/contact` 的 `com.zgiot.zx.meetingroom`，前缀 `/meetingRoom`。
  前端仍请求 `/meetingApi`；dev 代理改写成 `/meetingRoom` 打 7004。信封 `{ code: "M0000", data, msg }`。
- **样式/组件**：UnoCSS 原子类 + `uno.config.js` 主题 token（primary `#3E7EFF` 等，与智信视觉统一）；
  Element Plus / Vant 走 unplugin 按需自动注册。
- **别名**：`@/` → `src/`。
- **登录态**：`src/utils/index.js` 的 `bootstrapAuthFromUrl()` 是唯一入口，
  sessionStorage 键 `meetingToken` / `meetingCorpId` / `clientType`。

## Mock 开关方式
无统一 mock 开关。页面先行阶段按 `context/contracts/` 的类型在 `src/api/module/` 或组件内构造
本地 mock，接口到位后删 mock、改回真实调用，并在活跃功能 impl-notes 记录差异。

## WebView 集成方式
**当前未做 JSBridge。** token / corpId / clientType 由宿主拼在 URL query 上
（`?token=&corpId=&clientType=`），前端 `bootstrapAuthFromUrl()` 落 sessionStorage。
三端内嵌地址：PC → `/meeting/zx/`，iOS / 安卓 → `/meeting/m/`。
将来接桥（拟 `wnsdk.meeting.*` / `window.webview.ipcRenderer`）只改 `bootstrapAuthFromUrl()` 一处，
协议须先写入 `context/bridge.md`。

## 已知坑
- `base` 固定 `/meeting/`，部署路径须一致，否则资源 404。
- `JENKINS_BUILD_NUMBER` / `__BUILD_TARGET__` 是 vite **编译期** define，改 env 必须重启 dev server。
- dev 模式下三个入口都同时构建，`__BUILD_TARGET__` 恒为 `main`；要区分入口请读
  `window.__VITE_MPA_PLATFORM__`（zx/m 有值，main 为 undefined）。
- 生成物勿手改且不提交：`src/api/index.js`、`src/assets/index.ts`、
  `components.d.ts`、`auto-imports.d.ts`。
- 全局插件/样式注册散落在三个 `main.js`，漏改会导致某入口行为不一致。
- 无 lint；质量靠人工 + `vue-tsc`；提交前建议 `pnpm format` 并本地跑一次 `pnpm build`。

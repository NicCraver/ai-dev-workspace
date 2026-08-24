# Spec：智能会议室 · 前端基建（脚手架 + 冒烟页）

> Superpowers brainstorm 产出。最后更新：2026-08-24

## 背景与目标

新开「智能会议室」业务，需要一个能被智信 PC / iOS / 安卓三端 WebView 内嵌的前端工程。工作区已有两个同形项目可参考：

- `apps/web`（`zx-ai-chat`）：Vue 3.5 + Vite 7 + UnoCSS 66 + Node 22 / pnpm 10，MPA 四入口 `main/zx/m/share`。
- `apps/action-center`（`zx-operation-center`）：同一套骨架的老版本（Vite 4 / UnoCSS 0.50 / Node 16 / pnpm 7）。

本期目标是把**工程底座**搭到能跑通、能验收的程度：构建、路由、样式 token、网络层、环境变量、部署 base 全部就位，三个入口各有一个冒烟页能拉到 token 并调通一个后端接口。业务页面下一轮再做。

**成功标准**：见下方「验收标准」六条，逐条可复现。

## 关键决策（brainstorm 结论）

| 项 | 结论 | 理由 |
|---|---|---|
| 脚手架基线 | 照搬 `apps/web` 现代栈 | Vite 7 / Vue 3.5 / UnoCSS 66 / Node 22，比 action-center 新两代 |
| 搭建方式 | **干净新建 + 定点移植**（不是整仓 cp） | 整仓复制会带进 tiptap / ali-oss / ant-design-x-vue 等 AI 聊天专用依赖，裁不干净；全手写又会漏掉四个自研 vite 插件的隐性行为 |
| 构建入口 | `main` + `zx` + `m` 三个，去掉 `share` | 分享页本期无场景，真需要时再补 |
| 仓库落地 | `apps/meeting/`，独立 git（`git init`，暂无 remote） | 与 web / action-center 平级；`apps/` 被编排仓 .gitignore |
| 前后端关系 | 同仓 monorepo（pnpm workspace）：`web/` + `server/` | 后端由前端自己用 Node 写，同仓便于共享接口类型 |
| Node 框架 | Hono + TypeScript | 跨运行时、类型推导强 |
| 前端语言 | JS 为主，工具/类型用 TS | 与现有两个项目习惯一致，切换无成本 |
| 宿主桥 | **本期不做** | token 先从 URL query / sessionStorage 取；`wnsdk.meeting.*` 等原生通道等三端排期 |

## 范围

**本期做**：

1. `apps/meeting/` monorepo 骨架（pnpm workspace + 根 package.json + CLAUDE.md）
2. `web/` 三入口构建链路（vite 配置 + 四个自研插件适配 + mergeDist）
3. `web/` 运行时骨架（router 含版本自更新 / server axios 层 / utils / uno token / 三个冒烟页）
4. `server/` Hono 最小服务（`/meetingApi/health`，套智信业务码信封）
5. 配套文档：`context/platforms/meeting.md` 一页纸

**本期不做**：JSBridge、`share` 入口、真业务接口与契约、Pinia/Vuex、ESLint、单元测试。

## 目录结构

```
apps/meeting/                 # 独立 git 仓库
├── pnpm-workspace.yaml       # packages: ["web", "server"]
├── package.json              # zx-meeting-room，转发脚本 + volta 锁 node 22.16.0 / pnpm 10.22.0
├── CLAUDE.md                 # 本仓编码约定（照 apps/web/CLAUDE.md 体例）
├── .gitignore
├── web/
│   ├── package.json  vite.config.js  uno.config.js  export.config.js  mergeDist.js
│   ├── index.html  zx/index.html  m/index.html
│   └── src/
│       ├── main.js  App.vue  router.js  style.css
│       ├── mpa/desktop/{main.js, App.vue, pages/index.vue}
│       ├── mpa/mobile/{main.js, App.vue, pages/index.vue}
│       ├── pages/index.vue
│       ├── plugins/{vite-mpa-plugin.js, vite-pages-config.js,
│       │            vite-auto-api-exports.js, vite-auto-assets-exports.js}
│       ├── server/{http.js, index.js(生成物), module/health.js}
│       ├── utils/index.js
│       ├── use/  assets/
└── server/
    ├── package.json  tsconfig.json
    └── src/{index.ts, routes/health.ts, middleware/cors.ts}
```

根 scripts：`dev`（web + server 并行，用 `concurrently`，根 devDependency）、`dev:web`、`dev:server`、
`build`（= `build:server` + `build:web`）、`build:prod`。所有根脚本用 `pnpm -F <pkg> run <script>` 转发到子包。

## web 构建配置

- `base = "/meeting/"`。三入口 `index.html`(main) / `zx/index.html` / `m/index.html`，
  产物 `dist_main` / `dist_zx` / `dist_m`，由 `mergeDist.js` 合并成 `dist/` 并写入 `build_version`
  （`branch` / `commit` / `build_number` / `build_time`）。
- 四个自研插件从 `apps/web/src/plugins/` 逐文件移植，按三入口改：

  | 插件 | 改动 |
  |---|---|
  | `vite-mpa-plugin.js` | 删 `share` 的 dev fallback 与 `platformMap` 条目；默认 baseUrl 改 `/meeting/` |
  | `vite-pages-config.js` | 原样（三套虚拟模块 `~pages` / `~zx-pages` / `~m-pages`） |
  | `vite-auto-api-exports.js` | 原样（扫 `src/server/module/` 生成 `src/server/index.js`） |
  | `vite-auto-assets-exports.js` + `export.config.js` | 原样 |

- **移除**：`unplugin-vue-macros`（本项目不用宏，少一层 vue 插件包装）、`ant-design-x-vue` resolver、`vite-plugin-inspect`。
  **保留** `code-inspector-plugin`，`injectTo` 指向三处 `main.js`。
- `define`：`JENKINS_BUILD_NUMBER`（源 `process.env.BUILD_NUMBER`）、`__BUILD_TARGET__`。
- alias `@` → `src`；`build.assetsInlineLimit: 0`；非 development 时 `outDir: dist_${buildTarget}`。
- dev server：`host 0.0.0.0`，端口 **6273**（避开 ai-chat 的 6173，两项目可同时跑）。proxy 两条：
  - `/api` → `http://192.168.10.25`（智信网关，取用户/组织）
  - `/meetingApi` → `http://localhost:3100`（自家 Hono）
- 依赖表（收窄）：
  - dependencies：`vue` `vue-router` `@vueuse/core` `axios` `dayjs` `element-plus` `vant` `unocss`
    `@unocss/preset-wind3` `@unocss/preset-typography` `@unocss/transformer-directives`
  - devDependencies：`vite` `@vitejs/plugin-vue` `unplugin-auto-import` `unplugin-vue-components`
    `vite-plugin-pages` `code-inspector-plugin` `fs-extra` `cross-env` `prettier` `typescript` `vue-tsc`
  - **明确不引入**：tiptap 全家 / ali-oss / ant-design-x-vue / better-scroll / @tanstack/vue-table

## web 运行时骨架

- **网络层**：`src/server/http.js` 整段移植 `apps/web` 版本，保留 token 刷新（`O_T_001/002` 静默刷新、
  `O_T_003` 登录过期）、失败重试 ≤3 次、`M0000` 成功拆包、动态 `clientType` header、
  `Authorization` / `zxCorpId` 注入。`baseMap` 精简为
  `{ base: "/api/", auth: "/api/oauth", meeting: "/meetingApi" }`，axios 实例默认 `baseURL` 指 `meeting`。
  它依赖 `@/utils` 的 `getToken` / `setToken` / `getCorpId` / `getUrlParams` / `showToastError`
  与 `@vueuse/core` 的 `useSessionStorage`，一并移植。
  新接口写 `src/server/module/<域>.js`，`src/server/index.js` 由插件自动生成（生成物，勿手改）。
- **路由**：`src/router.js` 移植含 **版本自更新** 逻辑——`router.onError` 捕获
  「Failed to fetch dynamically imported module」→ 拉 `/meeting/build_version` 与 `JENKINS_BUILD_NUMBER`
  比对 → 不一致则提示刷新。fetch 路径同步改 `/meeting/`。
- **样式**：`uno.config.js` 照搬 theme 色板（`primary #3E7EFF` / `black #1F2329` / `grayMedium #8F959E` 等，
  与智信视觉统一）与 `rules`（`gutter-stable` / `drag-area` / `no-drag-area` / `bg-layout-gradient`）；
  **删** `tzero` 色组与 `t0-item-*` shortcut（AI 框专用）。presets 保留 `presetWind3` / `presetTypography` / `presetIcons`。
- **登录态**：本期无桥。`getUrlParams` 读 `?token=&corpId=&clientType=` 落 sessionStorage
  （键沿用 `aiToken` / `aiCorpId` / `clientType` 的同构命名，改前缀为 `meetingToken` / `meetingCorpId`）；
  无 query 时直接读 sessionStorage。原生桥以后接，接入点集中在 `src/utils/index.js`，不散落到组件。
- **全局注册同步**：全局插件 / 样式 / 指令必须同步三处 `main.js`（`src/main.js`、`src/mpa/desktop/main.js`、
  `src/mpa/mobile/main.js`）——这是 `apps/web` 记录在案的坑，新项目沿袭同一约束。
- **冒烟页**：三份，各显示 `__BUILD_TARGET__`、`window.__VITE_MPA_PLATFORM__`、token 有无，
  并调一次 `/meetingApi/health` 把结果打屏。zx 页用 Element Plus 组件、m 页用 Vant 组件，
  顺带验证按需注册在两个入口都生效。

## server（Hono + TS）

- `@hono/node-server` 起在端口 **3100**，所有路由挂 `/meetingApi` 前缀。
- `GET /meetingApi/health` 返回 `{ code: "M0000", data: { ok: true, ts }, msg: "" }`——
  **故意套用智信业务码信封**，这样 `http.js` 的响应拦截器不必为自家后端开特例。
- `middleware/cors.ts`：dev 期放行 `localhost:6273`。
- scripts：`dev`（`tsx watch src/index.ts`）、`build`（`tsc`）、`start`（`node dist/index.js`）。
- `tsconfig.json` 开 `strict`。

## 各端差异点

本期产出物是 web 工程本身，三端仅作为宿主容器，**不改动任何原生代码**。

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本期改动 | ✅ 新建 `apps/meeting` | — | — | — |
| 内嵌入口 | — | 加载 `/meeting/m/` | 加载 `/meeting/m/` | 加载 `/meeting/zx/` |
| 取 token | 本期走 URL query | 后续排期 JSBridge | 后续排期 JSBridge | 后续排期 JSBridge |

## 依赖的接口

本期只依赖自建 `GET /meetingApi/health`，不消费任何智信后端接口，因此 **不新增 `context/contracts/` 契约**。
业务接口下一轮再按「一域一文件夹、一接口一文件」补契约。

## 验收标准

1. `pnpm i`（在 `apps/meeting/` 根）安装通过，无 peer 冲突报错。
2. `pnpm dev:server` 起服务后，`curl http://localhost:3100/meetingApi/health` 返回 `code: "M0000"`。
3. `pnpm dev:web` 后三个 URL 均出页且 health 结果打屏成功：
   `http://localhost:6273/meeting/`、`/meeting/zx/`、`/meeting/m/`。
4. zx 页的 Element Plus 组件与 m 页的 Vant 组件都正常渲染（按需注册生效）。
5. `pnpm build` 产出合并后的 `web/dist/`，内含三入口 HTML 与 `build_version`。
6. 在 `web/` 下 `pnpm exec vue-tsc --noEmit` 退出码 0；在 `server/` 下 `pnpm run build`（`tsc`）退出码 0。

## 待用户确认的问题

无。brainstorm 已逐项确认：基线 / 入口数 / 交付范围 / 仓库落地 / 后端形态 / Node 框架 / 前端语言 / 宿主桥。

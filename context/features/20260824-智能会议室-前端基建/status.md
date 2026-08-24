# Status：智能会议室 · 前端基建（脚手架 + 冒烟页）

> 最后更新：2026-08-24（9 个任务全部实现并通过逐任务评审，验收 6 条已跑通）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 一句话

新建 `apps/meeting/`（pnpm monorepo：`web/` + `server/`），前端照搬 `apps/web` 现代栈但只留 main/zx/m 三入口，
后端 Hono + TS 起最小服务。本期只交付工程底座与冒烟页，不做业务页面、不做 JSBridge。

## 平台矩阵

本期产出物是新建 web 工程，**三端原生零改动**（仅作为将来内嵌宿主）。

| 任务 | meeting-web | meeting-server | android | ios | desktop |
|------|-------------|----------------|---------|-----|---------|
| brainstorm + spec | ✅ | ✅ | — | — | — |
| plan（9 任务） | ✅ | ✅ | — | — | — |
| T1 仓库骨架（workspace / git init） | ✅ | ✅ | — | — | — |
| T2 Hono 最小服务 + `/meetingApi/health` | — | ✅ | — | — | — |
| T3 构建链路（三入口 + 四插件 + mergeDist） | ✅ | — | — | — | — |
| T4 运行时基础层（http / utils / dialog） | ✅ | — | — | — | — |
| T5 main 入口 + router 版本自更新 + SmokeCard | ✅ | — | — | — | — |
| T6 zx 入口（Element Plus 自检） | ✅ | — | — | — | — |
| T7 m 入口（Vant 自检） | ✅ | — | — | — | — |
| T8 全量构建 + 类型检查 | ✅ | ✅ | — | — | — |
| T9 CLAUDE.md / README / platforms 一页纸 | ✅ | ✅ | — | — | — |
| 验收 6 条跑通 | ✅ | ✅ | — | — | — |

## 验收结果（6 条，实测）

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | `pnpm i` 通过、无 peer 冲突 | ✅ `Done in 39.1s` |
| 2 | `curl /meetingApi/health` 返 `M0000` | ✅ `{"code":"M0000","data":{"ok":true,"ts":...},"msg":""}`（评审员独立起服务复验） |
| 3 | `/meeting/`、`/meeting/zx/`、`/meeting/m/` 三页均出且 health 打屏 | ✅ chrome-devtools 真实浏览器逐页实测，console 无报错 |
| 4 | zx 的 Element Plus 与 m 的 Vant 正常渲染 | ✅ 两个弹层均真实点开、读到内容文字 |
| 5 | `pnpm build` 产出合并 `dist/` 含三入口 HTML 与 `build_version` | ✅ 四文件齐全，`build_version` 四键；平台标识只注入 zx/m |
| 6 | web `vue-tsc --noEmit` 与 server `tsc` 均退 0 | ✅ 均 `exit=0` |

## 待办 / 阻塞

- (meeting) `apps/meeting` 尚无 git remote，当前 9 个提交只在本地（tip `3fbb62c`，分支 main）。建仓后补 remote 并首推。
- (meeting) **`vue-tsc` 这道关目前基本是空转**：`web/tsconfig.json` 为 `checkJs: false` 而源码全是 JS/.vue(JS 脚本块)，
  实测放一个含类型错误的 `.ts` 探针才会 `exit=2`。即它只护住将来写的 `.ts` / `.d.ts`，护不住现有代码。
  要么后续业务代码逐步转 TS，要么另加质量手段——本期按 spec 不引入 ESLint / 单测，先记在此。
- (meeting) volta 未安装，`package.json#volta` 的 node 22.16.0 只是声明；实机跑的是 node v24.19.0（Vite 7 要求 ≥22.12，可跑）。
- (meeting) 业务页面（会议列表 / 详情 / 预定）下一轮再做，本期只交付底座 + 冒烟页。
- (跨端) 三端内嵌 URL（`/meeting/zx/`、`/meeting/m/`）与 JSBridge 命名空间（拟 `wnsdk.meeting.*`）
  需另行排期知会 android / ios / desktop，本期不做。接桥时只改 `bootstrapAuthFromUrl()` 一处。

## 关键决策记录

- 2026-08-24 基线取 `apps/web`（Vite 7 / Vue 3.5 / UnoCSS 66 / Node 22）而非 `apps/action-center`（Vite 4 / Node 16）：栈新两代。
- 2026-08-24 搭建方式选「干净新建 + 定点移植」而非整仓 cp：整仓复制会带进 tiptap / ali-oss / ant-design-x-vue
  等 AI 聊天专用依赖且裁不干净；全手写又会漏掉四个自研 vite 插件（MPA 平台注入、三套路由虚拟模块、
  API 自动导出、资源自动导出）的隐性行为。
- 2026-08-24 只做 main/zx/m 三入口，去掉 share：分享页本期无场景。
- 2026-08-24 前后端同仓 monorepo：后端由前端自己写（Hono + TS），同仓便于共享接口类型。
- 2026-08-24 `/meetingApi/health` 故意套智信业务码信封（`code: "M0000"`）：
  让移植过来的 `http.js` 响应拦截器不必为自家后端开特例。
- 2026-08-24 前端语言 JS 为主、工具/类型用 TS：与现有两个项目习惯一致，人和 AI 切换无成本。
- 2026-08-24 本期不做 JSBridge：token 先走 URL query / sessionStorage，接入点集中在 `src/utils/index.js`，
  不散落到组件，将来接桥只改一处。
- 2026-08-24 删掉 `unplugin-vue-macros` 与 `uno.config.js` 的 `tzero` 色组 / `t0-item-*` shortcut：均为 AI 框专用。
- 2026-08-24 执行期修正（plan 原文写错）：`bootstrapAuthFromUrl` 写 `clientType` 曾用 `JSON.stringify`，
  与 `http.js` 里 `useSessionStorage("clientType", "app")` 的裸字符串序列化器不自洽（读回来多一对字面引号）。
  首次加载被 `http.js` 顶层的 URL 覆盖掩盖，二次刷新不带 query 时才暴露。已改为写裸字符串（`067cb82`），plan 同步修正。
- 2026-08-24 m 入口的 `main.js` **有意**不引 `@vant/touch-emulator`（触摸模拟只 PC 需要），与另两份入口不同，勿"对齐"。

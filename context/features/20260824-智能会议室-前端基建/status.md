# Status：智能会议室 · 前端基建（脚手架 + 冒烟页）

> 最后更新：2026-08-24（spec 已定稿，待用户 review 后写 plan）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 一句话

新建 `apps/meeting/`（pnpm monorepo：`web/` + `server/`），前端照搬 `apps/web` 现代栈但只留 main/zx/m 三入口，
后端 Hono + TS 起最小服务。本期只交付工程底座与冒烟页，不做业务页面、不做 JSBridge。

## 平台矩阵

本期产出物是新建 web 工程，**三端原生零改动**（仅作为将来内嵌宿主）。

| 任务 | meeting-web | meeting-server | android | ios | desktop |
|------|-------------|----------------|---------|-----|---------|
| brainstorm + spec | ✅ | ✅ | — | — | — |
| plan | ⬜ | ⬜ | — | — | — |
| 仓库骨架（workspace / git init / CLAUDE.md） | ⬜ | ⬜ | — | — | — |
| 构建链路（三入口 + 四插件 + mergeDist） | ⬜ | — | — | — | — |
| 运行时骨架（router / http / utils / uno） | ⬜ | — | — | — | — |
| Hono 最小服务 + `/meetingApi/health` | — | ⬜ | — | — | — |
| 冒烟页 ×3 | ⬜ | — | — | — | — |
| 验收 6 条跑通 | ⬜ | ⬜ | — | — | — |
| `context/platforms/meeting.md` 一页纸 | ⬜ | ⬜ | — | — | — |

## 待办 / 阻塞

- (meeting) 等用户 review `spec.md`，通过后进 writing-plans 出 `plan.md`。
- (meeting) `apps/meeting` 尚无 git remote，本期只本地 `git init`；建仓后再补 remote 并首推。
- (meeting) 端口占用约定：web dev **6273**（避开 ai-chat 的 6173）、server **3100**。
- (跨端) 三端内嵌 URL（`/meeting/zx/`、`/meeting/m/`）与 JSBridge 命名空间（拟 `wnsdk.meeting.*`）
  需另行排期知会 android / ios / desktop，本期不做。

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

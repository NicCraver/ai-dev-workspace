# Status：会议室前端重构

> 最后更新：2026-08-31 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 令牌 `--zx-*` + 旧名别名 | ✅ | — | — | — |
| 基础组件按需拷贝 | ✅ | — | — | — |
| 后台 chrome 替换 | ✅ | — | — | — |
| 预定 PC / 移动 chrome 替换 | ✅ | — | — | — |
| 自测通过（`pnpm test`） | ✅ | — | — | — |
| 接口联调 | — | — | — | — |

android / ios / desktop 不单独立项：会议室以内嵌 WebView 复用 meeting web。

meeting 仓库 `main` 相对 origin 同步、工作区脏（本轮 web 令牌/组件/chrome 未在 apps 仓提交，由独立流程处理）。`pnpm test` 两次均为 server 120 + web 86 通过；`vue-tsc --noEmit` 通过。

## 待办 / 阻塞

- (web) `apps/meeting` 源码改动尚未单独 commit / push
- (web) 浏览器点选回归未做（本期验证条是单测 + 源码 grep）

## 关键决策记录

- 2026-08-31 设计系统对齐，不改业务流程与接口
- 2026-08-31 按需拷贝进 `apps/meeting/web`，不 submodule、不整库搬
- 2026-08-31 现有弹窗保持 `v-if`；命令式 `showXxx` 只给新弹窗
- 2026-08-31 顺序：令牌 → 组件 → 后台 → 预定 PC → 移动
- 2026-08-31 `AcDialog` 默认禁止点遮罩 / Esc 关闭，视为允许的 UX 差异

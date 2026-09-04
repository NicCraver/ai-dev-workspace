# Status：会议室埋点

> 最后更新：2026-09-04（我的预定弹层限高 + e2e/单测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞


## 平台矩阵

会议室走 WebView，代码在 meeting 前端 + contact 后端。四端复用同一套页面。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | ✅ | — 复用 WebView | — 复用 WebView | — 复用 WebView |
| 接口联调 | ✅ | — | — | — |
| 自测通过 | 🚧 | — | — | — |

说明：contact JUnit 9 绿。meeting 单测已切 Vitest 5（`pnpm test` → 27 files / 129 tests 绿）。测试库已建 `meeting_event`。本地 contact 已用新 jar 重启；`POST /meetingRoom/events` 与 Vite `/meetingApi/events` 均 `accepted:1`，`GET /events/recent` 能读回。页面点击漏斗还没在浏览器里走完。

## 待办 / 阻塞

- (web) 打开看板 / 助手走一遍，用 recent 核对 `page_view` 与 `agent_*`
- apps/meeting、apps/contact 代码未提交（contact 勿提交 `application.properties`）

## 关键决策记录

- 2026-09-03 独立表 `meeting_event`，不复用 `meeting_booking_audit`
- 2026-09-03 助手成功只记 `agent_booked`，不与 `booking_submit` 双计
- 2026-09-03 永不存用户说话原文；`GET /events/recent` 仅管理员
- 2026-09-04 meeting 单测从 `node:test` 换成 Vitest 5（与埋点功能无关的工具升级）
- 2026-09-04 `pnpm test:ui` 打开 Vitest UI（需 `--watch`，否则跑完就退出）
- 2026-09-04 会议室前端加 Playwright UI E2E（`pnpm test:e2e`，9 条：PC 看板/预定/管理/助手 + 移动看板）
- 2026-09-04 `pnpm test:e2e:headed` 弹出浏览器看着跑
- 2026-09-04 前端暂移除周期预定（每周重复开关、管理页 allowRecurring、详情展示）；保存会议室固定 `allowRecurring: false`

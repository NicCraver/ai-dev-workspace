# Status：会议室埋点

> 最后更新：2026-09-04（我的预定弹层限高 + e2e/单测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞


## 平台矩阵

会议室走 WebView，代码在 meeting 前端 + contact 后端。四端复用同一套页面。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | ✅ | — 复用 WebView | — 复用 WebView | — 复用 WebView |
| 接口联调 | ✅ | — | — | — |
| 自测通过 | 🚧 | — | — | — |

说明：contact JUnit 9 绿。meeting 单测 `pnpm test` 27 files / 137 tests 绿（补了周视图 `occupancySource`）。Playwright `pnpm test:e2e` **10 条全绿**（原 9 条 + PC「我的预定不超出视口」）。测试库已建 `meeting_event`。本机 Java 7004 可用。埋点点击漏斗还没拿 `GET /events/recent` 人工对完。

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| meeting | main | ahead 4 | 脏(含 web→根目录搬迁) | **本功能** | 弹层限高、XPopup 滑入、更多菜单「我的预定」、e2e |
| contact | feat/meetingroom | 无 upstream | 脏(埋点 Java + 本地 properties) | 本功能 | 勿提交 `application.properties` |
| context | main | ahead 39 | 脏(package.json) | 编排 | 本功能 status 待提交 |
| web | feat/data-range-week-work | 无 upstream | 脏(周工作弹层) | 周工作 | 本回合未改 |

## 2026-09-04 我的预定 / 预约弹层

- `AcDialog` 内容区改 `flex-1 min-h-0`，避免百分比高度把列表顶出视口
- 「我的预定」弹层 `max-height: min(80vh, 720px)`，列表自己滚
- 预约弹层同样限高；移动端底部抽屉用 `transform` 滑入（原先 `margin-bottom: -100vh` 会让按钮落在视口外）
- e2e：PC 打开「我的预定」必须整层在视口内；预定漏斗改选 19:00–20:00（默认时段常被占，22:00 又不在开放时间内）

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

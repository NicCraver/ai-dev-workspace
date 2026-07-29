# Status：ios / 安卓 · 群机器人可 @ 判定

> 最后更新：2026-07-29（android / ios 代码已改；**真机自测未做**）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约 groupRobots + hasCallBackAddress · plan Task 1 | — | ✅ | ✅ | — |
| 模型落库 + canAtRobot helper · plan Task 2/5 | — | ✅ | ✅ | — |
| @ 列表过滤 · plan Task 3/6 | — | ✅ | ✅ | — |
| 消息 @回复 菜单 · plan Task 4/7 | — | ✅ | ✅ | — |
| 自测通过 · plan Task 8 | — | ⬜ 待真机 | ⬜ 待真机 | — |

> **本轮范围：只做 android + ios**。web / desktop 列保持 —。

## 待办 / 阻塞

- (android / ios) ⏳ **真机自测未做**：type≠1 可 @；type=1+hasCallBack=1 可 @；type=1 无回调不在 `@` 列表且消息无「@回复」仅「回复」；群设置机器人列表仍全量；群/个人 AI 菜单不变。
- (全端) ⏳ 抓包确认 `groupRobots[].hasCallBackAddress` 字段名与取值。
- (android) SCHEMA_VERSION 73→74，升级后靠 MigrationHelper 迁 `GROUP_ROBOT` 表。

## 关键决策记录

- 2026-07-29 不可 @ → 只藏「@回复」，保留「回复」
- 2026-07-29 本期只做 android + ios
- 2026-07-29 不可 @ 机器人在 @ 列表直接不展示
- 2026-07-29 客户端本地判定；数据源 `group/get.groupRobots`
- 2026-07-29 查不到机器人详情 → 不展示「@回复」
- 2026-07-29 群设置机器人列表不过滤

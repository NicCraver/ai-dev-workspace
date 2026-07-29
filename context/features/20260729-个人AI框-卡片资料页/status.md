# Status：个人AI框-卡片资料页

> 最后更新：2026-07-29 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 群聊个人 AI 头像 → 资料卡打开 · plan Task 1–3 | — | ✅ | ✅ | ✅ |
| 个人 AI 仅展示管理者+介绍（空行隐藏） | — | ✅ | ✅ | ✅ |
| 自测通过 | — | ⬜ 待真机 | ⬜ 待真机 | ⬜ 待 PC |

## 待办 / 阻塞

- (desktop / android / ios) ⏳ 真机/PC 联调：群聊点个人 AI 头像应打开资料卡；群 AI 字段不变；空字段不展示。
- (全端) ⏳ 确认 `getAgentBaseInfoForPlatform` 在 `belongType=1` + `belongId=personalAccountId` + `agentAccountId=ga_*` 下回参含 `mainManagerList` / `remark`。

## 关键决策记录

- 2026-07-29 仅群聊；入口=消息头像
- 2026-07-29 个人 AI 只展示管理者 + 智能体介绍；群 AI 不变
- 2026-07-29 空字段整行隐藏
- 2026-07-29 失败与现网群 AI 一致（缓存/Toast）
- 2026-07-29 方案：复用智能体资料卡 + 个人 AI 精简模式；入参 belongType=1、belongId=personalAccountId

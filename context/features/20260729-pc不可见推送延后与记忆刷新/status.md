# Status：pc不可见推送延后与记忆刷新

> 最后更新：2026-07-29 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 推送延后消息（pageActive / pending） | ✅ 代码+单测 | — | — | — |
| 激活刷记忆（refreshMemoryOnly） | ✅ 代码 | — | — | — |
| aiBoxDeactivate / 切回激活 | ✅ 收 | — | — | ✅ 发 |
| PC E2E 自测 | ⬜ | — | — | ⬜ |

## 待办 / 阻塞

- (web / desktop) ⏳ PC E2E：① AiBrowser 切到 deepseek → 推送命中当前会话 → list/History 刷、消息不刷；切回后消息补刷 + 记忆接口。② 系统窗切走/切回同理。③ 停在 deepseek 时系统窗切回不应冲刷消息。

## 关键决策记录

- 2026-07-29 只延后 Chat 消息；list/History 立刻刷
- 2026-07-29 激活记忆 = getLastSessionMessage 只回写记忆栏
- 2026-07-29 `pageActive = docVisible && shellActive`；壳 `aiBoxDeactivate` / `aiBoxCheckVersion`
- 2026-07-29 仅 PC；移动端不做

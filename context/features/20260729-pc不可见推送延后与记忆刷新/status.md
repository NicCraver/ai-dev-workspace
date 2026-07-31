# Status：pc不可见推送延后与记忆刷新

> 最后更新：2026-07-31 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 推送延后（pageActive / pending） | ✅ 整次延后 | — | — | ✅ 不可见不 post |
| 激活刷记忆（refreshMemoryOnly） | ✅ 改 getAgentDataRange + checkVersion 去重 | — | — | — |
| aiBoxDeactivate / 切回激活 | ✅ 收 | — | — | ✅ 发 + flush deferred |
| PC E2E 自测 | ⬜ | — | — | ⬜ |

## 待办 / 阻塞

- (web / desktop) ⏳ PC E2E：切到会话/deepseek → 推送 → **左侧角标保持**、web 不刷接口；切回 AI框后才 list/History/消息 + 记忆。
- (desktop) ⏳ 推送勿强改 `aiBrowserSiderItem` 为个人 AI（否则对话切回会误激活清角标）；web 侧已避开 getLastSessionMessage。
- (desktop) ✅ 根因：启动预创建的隐藏 `personalAiWin` 每次推送都 `refresh-personal-ai-data`，后台刷会话清未读 → 角标一闪。已改为：隐藏不转发、show 再 flush；创建时不再 loadURL。

## 关键决策记录

- 2026-07-31 激活记忆改 `getAgentDataRange`（不清未读）；`aiBoxCheckVersion` 激活工作 300ms 去重
- 2026-07-29 desktop：隐藏 `personalAiWin` 不发 `refresh-personal-ai-data`；创建窗不再预 load `/zx/personal`（避免后台页清未读）
- 2026-07-29 ~~只延后 Chat~~ → **改：不可见时整次推送延后**（list/History/消息都不刷），否则后台刷会清未读、角标一闪
- 2026-07-29 desktop：面板不可见或非个人 AI tab **不向 iframe post**，sessionIds 本地 deferred，切回再 flush
- 2026-07-29 ~~激活记忆 = getLastSessionMessage~~ → 见 2026-07-31
- 2026-07-29 `pageActive = docVisible && shellActive`；壳 `aiBoxDeactivate` / `aiBoxCheckVersion`
- 2026-07-29 仅 PC；移动端不做

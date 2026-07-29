# Status：消息来自个人AI框 badge

> 最后更新：2026-07-29｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 气泡下「来自xxx个人AI框」 | — | 🚧 代码已合 | 🚧 代码已合 | ✅ 已 push |
| 个人 AI 头像资料卡（belongId/belongType） | — | — | — | ✅ 已 push |
| 真机自测 | — | ⬜ | ⬜ | — |

## 待办 / 阻塞

- (desktop) ✅ `personal-ai-chat` 已 push（`7a980cf2`）：badge 文案去掉「的」；头像点击走 agent-pop-info，`belongId=personalAccountId`、`belongType=1`；资料卡仅管理者 + 智能体介绍。
- (ios / android) ⏳ 真机：含 `personalAccountId` 消息气泡下出现 `来自{nickName}个人AI框`；昵称旁「个人AI框」tag 仍在；撤回不显示；缓存 miss 拉人后刷新出现。
- (android) 本地缓存用 `EaseUserInfo.fullName`；miss 走 `getTheUserDetailInfoFromServer` + `UserDetailInfoRefresh`。
- (ios) 本地 `CorpUserTable.name`；miss 走 `logicRequestUserInfo` + `logicProfileSaveDataToDBNoAvatar`（触发 `ZXNotifyRefeashNameCell`）。

## 关键决策记录

- 2026-07-29 对齐 PC：`MsgPersonalAiRow`；名字按 `personalAccountId` 查人，不用 `content.user.name`
- 2026-07-29 与昵称旁 identity tag 并存
- 2026-07-29 昵称未就绪不展示空 badge
- 2026-07-29 **布局**：badge 在「N条回复」**下方**（气泡 → 表情 → N条回复 → 来源 badge）
- 2026-07-29 文案去掉中间「的」：`来自{nickName}个人AI框`（PC/iOS/Android 同步）
- 2026-07-29 PC 个人 AI 消息头像：`getAgentBaseInfoForPlatform` 须带 `belongId`（personalAccountId）+ `belongType=1` + `conditionType=im`，勿用当前群 id

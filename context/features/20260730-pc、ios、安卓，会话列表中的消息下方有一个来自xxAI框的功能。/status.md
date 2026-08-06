# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-08-06（合并转发页回复：android/ios 对齐 PC 本地已改，待真机）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 个人 badge + `fixTaskMessage===1` 门闩 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 群 AI badge「来自群AI框」 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 自己消息详情 badge | — | ✅ | ✅ | ✅ |
| 合并转发保留字段 + 合并详情列表 badge | — | ✅（待真机） | ✅（待真机） | ✅ |
| 合并详情个人 AI 框名/头像 + tag | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 逐条转发抹 badge（含 ActionCard） | — | 🚧 白名单已有；剥 referMsgUid 本地未 commit | 🚧 白名单已有；剥 uid 本地未 commit | ✅ 文本白名单；ActionCard 单条仍不走 |
| 转发保留引用 / 剥 referMsgUid（对齐 PC） | — | 🚧 逐条+合并页/OSS 本地已改（待 commit/真机） | 🚧 保留 Reply + 剥 uid + 合并预览本地已改（待 commit/真机） | 🚧 本地已修（待 commit/真机） |
| 个人/群 AI 列表昵称取实时资料 | — | ⬜ | ✅ | ✅ |
| impl-notes | ✅ | ✅ | ✅ | ✅ |
| 自测通过 | — | ⬜ | ⬜ | ⬜ |

> web：本期不做。

## 待办 / 阻塞

- (desktop) ⏳ 多选转发三坑本地已修，**待 commit/push + 真机**
- (android) ⏳ 合并转发页回复 + AI 引用头（encode/完整 decode `referMsg`）本地已改，**待 commit/push + 真机**
- (ios) ⏳ 合并转发页回复 + AI 引用头；点引用聚合勿「0条回复」（内嵌源+列表回复）本地已改，**待 commit/push + 真机**
- (desktop / android / ios) ⏳ 合并详情个人 AI 名头像 tag：已 push hotfix，**待真机**
- (全端) ⏳ 联调确认后端 `extra.fixTaskMessage` 为数字 `1`

## 关键决策记录

- 2026-08-06：(desktop) 多选转发修复——`selectMessage` 兜底；转发剥 `referMsgUid`；保留 `ReferenceMessage`；`packmysend` parse string extra
- 2026-08-06：(android) 对齐 PC 逐条：Reference 不再转文本；ActionCard/`Reference` 剥 `referMsgUid`；空 uid 跳过 `checkReferenceMessageIsExist`
- 2026-08-06：(android) 合并页不显示回复：OSS/预览 JSON 须写 `content`=回复正文（勿只靠 Gson 的 `editSendText`）；还原内嵌引用；`referMsgUid` 清空
- 2026-08-06：(ios) 合并页回复「消息源不一致」：预览勿用原消息 uid 查库；剥 `referMsgUid`；无 uid 时 `getRcMessageState` 返回正常；合并详情勿把 Reply 转 Text
- 2026-08-06：(android/ios) AI 框合并详情引用头：安卓完整 decode `referMsg`；iOS 还原 payload 且禁止本机 UID 回落；名优先内嵌 `referMsg.user`

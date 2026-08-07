# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-08-06（desktop 多选转发三坑已 push hotfix；待真机）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| 转发保留引用 / 剥 referMsgUid（对齐 PC） | — | 🚧 逐条+合并页引用头/点引用弹窗已装真机（待重复合并自测+commit） | 🚧 保留 Reply + 剥 uid + 合并预览本地已改（待 commit/真机） | ✅ 已 push hotfix（待真机） |
| 个人/群 AI 列表昵称取实时资料 | — | ⬜ | ✅ | ✅ |
| impl-notes | ✅ | ✅ | ✅ | ✅ |
| 自测通过 | — | ⬜ | ⬜ | ⬜ |

> web：本期不做。

## 待办 / 阻塞

- (desktop) ✅ 多选转发三坑已 push `personal-ai-chat-hotfix`（`9d107693`），**待真机**
- (android) ✅ 合并详情回复引用对齐 PC，已推 `personal-ai-chat-hotfix`（`56173906a`）；旧 OSS 须**重新合并**再验，**待真机**
- (ios) ✅ 合并转发回复/引用聚合/多选预勾/导航居中，已推 `personal-ai-chat-hotfix`（`e24b0cd4b`），**待真机**
- (desktop / android / ios) ⏳ 合并详情个人 AI 名头像 tag：已 push hotfix，**待真机**
- (全端) ⏳ 联调确认后端 `extra.fixTaskMessage` 为数字 `1`

## 关键决策记录

- 2026-08-06：(desktop) 多选转发修复——`selectMessage` 兜底；转发剥 `referMsgUid`；保留 `ReferenceMessage`；`packmysend` parse string extra；已 push `personal-ai-chat-hotfix`（`9d107693`）
- 2026-08-06：(android) 对齐 PC 逐条：Reference 不再转文本；ActionCard/`Reference` 剥 `referMsgUid`；空 uid 跳过 `checkReferenceMessageIsExist`
- 2026-08-06：(android) 合并页不显示回复：OSS/预览 JSON 须写 `content`=回复正文（勿只靠 Gson 的 `editSendText`）；还原内嵌引用；`referMsgUid` 清空
- 2026-08-06：(ios) 合并页回复「消息源不一致」：预览勿用原消息 uid 查库；剥 `referMsgUid`；无 uid 时 `getRcMessageState` 返回正常；合并详情勿把 Reply 转 Text
- 2026-08-06：(android/ios) AI 框合并详情引用头：安卓完整 decode `referMsg`；iOS 还原 payload 且禁止本机 UID 回落；名优先内嵌 `referMsg.user`
- 2026-08-06：(android) 合并详情点引用：专用 `OpenCombineReferUnitDialogEvent`（内嵌源+列表同引用回复）；ActionCard 缺 `objName` 仍可还原 `referMsg`；旧 OSS 需重新合并
- 2026-08-06：(ios) 合并详情 UI：导航 customView 在 iOS26 勿 Left/Right 对齐（圆形底图标偏）；回复层顶距额外 +20 过大，已改回 `kPopoverNavTop = kNavBarH`
- 2026-08-06：(ios) 长按多选：进多选只勾了 `isSelectedMessage` 未调 `changeSelectedStatus` → 底部 `isEnabale=NO` 误报「请选择操作内容」；匹配改为对象/`messageId`/非空 `messageUId`

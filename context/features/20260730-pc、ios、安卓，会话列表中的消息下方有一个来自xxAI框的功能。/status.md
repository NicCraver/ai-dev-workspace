# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-08-11（ios 合并详情引用快照修复**重做**：08-10 那版改动在工作区已丢失，本次按同一根因重新落地，未提交）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
- (ios) ✅ 合并转发回复/引用聚合/多选预勾/导航居中，已推 `personal-ai-chat-hotfix`（`e24b0cd4b`）；**2026-08-11 重做**：群内个人 AI @回复→智能体 Reply，合并详情引用头显示原始 `ga_` ID + 点引用聚合层头像/名/标签(错成群AI框)/时间(元旦 08:00) 全错。08-10 记录的那版修改在 iOS 工作区**已不存在**（`hydrateCombineReferModel` 全仓无匹配、stash/历史均无），本次重新实现：打包补 `referMsg.user/sentTime/extra` + 读侧按同列表源消息回填（旧 OSS 也能修）。**本地已改未提交，待 Xcode 构建 + 真机自测**
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
- 2026-08-10：(ios) 合并详情 · 群内个人 AI 对话：智能体流式 Reply 引用头丢失 + 点 @回复引用聚合层头像/名/标签/时间错乱。根因：① 合并 extra 白名单裁掉 `fromType`；② OSS `referMsg` 未写 `user`/`sentTime`/`personalAccountId`；③ 读侧 `ga_` 回落展示原始 ID；④ 聚合弹层首条展开逻辑误伤合并态。修复：打包从同批消息补齐 refer 快照；读侧 `hydrateCombineReferModel` 从列表回填；聚合弹层合并态禁用展开并置顶
- 2026-08-11：(ios) 上条改动在工作区丢失（未提交且非 stash），按复核后的根因重做，范围收敛为 ②③：`fromType` 全仓无消费方（只出现在知识库 item），**不再动 extra 白名单**；聚合弹层展开逻辑本次未见异常，**不改**。实际落地：`ZXCombineMessageLogic` 打包时按 `referMsgUid` 在本批/本地库找源消息，写 `referMsg.user`(id/name/portrait) + `sentTime` + 合并白名单 `extra`/`baseExtra` + `objectName`，再剥 uid；读侧 `initWithCombineMessage` 补 `referModel` 的 `sentTime`/`extra`/`isCombine`/`conversationType`，另加 `hydrateCombineReferModelsInList:`（合并详情 + 转发预览都调）按「发送者 + 正文」在同一份聊天记录里回填名/头像/时间/extra，使**旧 OSS 无需重新合并**也能正确显示

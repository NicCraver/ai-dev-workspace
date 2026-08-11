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
- (android) ✅ 合并详情/回复弹窗对齐 iOS（评优徽章、AI 框标签、引用源时间与 extra）已提交 `f34ef9502`，**未 push、AI 未编译**，待真机自测；老合并记录须**重新合并**才带 `referMsgSentTime`

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
- 2026-08-11（第四轮）：(ios) 两个新反馈同源——① 点回复开聚合弹层，引用消息时间「元旦 08:00」；② 群智能体回复我的消息合并后**整块引用不显示**。根因：会话页的引用是靠 `referMsgUid` / extra 触发 uid **查本地库**还原的，合并态禁止查库，而打包只写了 uid 没写快照；`fromType` 被 extra 白名单裁掉又让流式 Reply 掉出专用 cell。修复：打包快照升级为「正文 + user + sentTime + extra + objectName」，源消息按「本批选中 → 本地库 → 会话页解析链路」三级找，智能体发的任意类型消息都快照；白名单保留 `fromType`；读侧新增按快照直接建 `referModel`；`ZXIMChatCell` 在 `sentTime<=0` 时隐藏时间标签。**老记录仍需重新合并**
- 2026-08-11（再补3）：(android) 源消息若是**智能体那条**：时间空白 + 标签错成「群AI框」。根因同一个——安卓把引用源的时间写在**内嵌 content 的 `destructTime`** 上（`ConversationFragment.getTextMessageInfo` 发送时写入，`ReferencePreviewView` 读它发事件），而合并打包只写了内嵌正文，`destructTime` 与 `extra` 全丢，读侧自然既没时间也没 `personalAccountId`。修复：打包 `MessageTransmitDialog` 的 Reference / ActionCard 分支写 `referMsgSentTime`（+ 文本内嵌补 `extra`/`baseExtra`），读侧 `CombineDetailActivity.applyCombineReferSourceTime` 还原到内嵌 `destructTime`；另把弹窗的同列表匹配从「只取时间」升级为返回整条消息，缺 extra 时借它的 extra 补标签。**老记录须重新合并**
- 2026-08-11（再补2）：(android) 回复弹窗源消息**时间显示成回复那条的时间** —— `CombineDetailActivity` 合成源消息时写的是 `fromMsg.getSentTime()`（回复消息）。内嵌引用 payload 不带时间戳，正确来源有二：`ReferencePreviewView` 发事件时带的 `messageContent.getDestructTime()`（融云用它存引用源消息时间），以及在同一份聊天记录里按「发送者 + 正文」找到原消息取 `sentTime`（新增 `findCombineSourceSentTime`）。两者都拿不到时**留 0**（时间胶囊隐藏），绝不用回复时间顶替
- 2026-08-11（再补）：(android) 回复弹窗**源消息那一行不是 adapter 渲染的**——`dialog_refer_msg_unit_fragment_dialog.xml` 用 `<include>` 引 `rc_item_refer_unit_primary_message`，由 `ReferMessageUnitFragmentDialog.HeaderViewHolder` 自己 findViewById + 绑定，所以只改 adapter 时回复行有星星、源消息行没有。已在 Fragment 侧补齐控件与 `bindHeaderSenderExtras`（tag + 评优 + 空时间隐藏胶囊）。注意：源消息发送人是**普通人**时本就没有 AI 框标签，只有评优徽章
- 2026-08-11（补）：(android) 澄清缺失的是**合并详情点引用弹出的回复弹窗**（`ReferMessageUnitListAdapter` + `rc_item_refer_unit_message` / `_primary_message`），不是列表页：两个布局里**根本没有** AI 框 tag 与评优区块 → 已补 `tv_left_agent_tag` + `ll_left_appraising`，adapter 两个 ViewHolder / `BaseHolderParam` 5 个构造挂控件，`bindSenderExtras` 在昵称显隐的 5 处调用；tag 逻辑照会话页复制，评优复用 `CombineAppraisingBinder`。时间：`DateFormatUtil.getTimestampString` 在 `sentTime<=0` 时返回**空串**（安卓表现为空白胶囊，iOS 表现为「元旦 08:00」），两个 adapter 均补「空串则隐藏胶囊」
- 2026-08-11：(android) 合并详情昵称行对齐 iOS：**新增** `CombineAppraisingBinder`（评优徽章 + 星星，只读本地库，会话页存量不动）+ 布局补 `ll_left_appraising` 区块 + `CombineAdapter` 挂钩；`CombineDetailActivity` 补 `sentTime` 兜底（`messageTime`/`receivedTime`）。**AI 框 tag 与时间的绑定代码本就存在**（`a026626b2`），用户反馈不显示，待截图 + 确认该记录由哪端合并
- 2026-08-11（第三轮）：(ios) **新合并记录已验证正常**（打包侧快照生效）；**旧记录仍显示 `ga_` ID** ⇒ 读侧两条回退（同列表回填 / 群关系表兜底）都没命中，原因未知。已插临时日志 `[ZXCombineRefer]`（`ZXCombineMessageLogic.hydrateCombineReferModelsInList:` 两处 + `ZXIMCellLogic.getSenderNickName` 兜底处），**定位后必须删除**
- 2026-08-11（第二轮）：(ios) 用户在**旧合并记录**上复验，引用块与聚合弹层仍显示 `ga_` ID ⇒ 读侧列表回填未命中。补三处：① `agentReplyReferModelForMessage:` 合并态直接返回已有 `referModel`（cell 重建会覆盖回填）；② 源消息匹配放宽（正文唯一命中也认、正文先剥「回复@xxx：」前缀再比）；③ **兜底**：合并态 `ga_` 无名/无头像时按「原群 targetId + agentAccountId」查群智能体关系表（`getSenderNickName` 与 `setChatAvatarByMsgModel` 各加一处）。仍为本地改动、未构建
- 2026-08-11：(ios) 上条改动在工作区丢失（未提交且非 stash），按复核后的根因重做，范围收敛为 ②③：`fromType` 全仓无消费方（只出现在知识库 item），**不再动 extra 白名单**；聚合弹层展开逻辑本次未见异常，**不改**。实际落地：`ZXCombineMessageLogic` 打包时按 `referMsgUid` 在本批/本地库找源消息，写 `referMsg.user`(id/name/portrait) + `sentTime` + 合并白名单 `extra`/`baseExtra` + `objectName`，再剥 uid；读侧 `initWithCombineMessage` 补 `referModel` 的 `sentTime`/`extra`/`isCombine`/`conversationType`，另加 `hydrateCombineReferModelsInList:`（合并详情 + 转发预览都调）按「发送者 + 正文」在同一份聊天记录里回填名/头像/时间/extra，使**旧 OSS 无需重新合并**也能正确显示

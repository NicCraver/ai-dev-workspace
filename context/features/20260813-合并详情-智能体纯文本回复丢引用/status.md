# Status：合并详情（聊天记录页）智能体纯文本回复丢引用

> 最后更新：2026-08-13 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 问题

群聊天记录（合并转发详情）里，个人 AI 框的一条回复：

- **iOS**：显示引用块「李峰：你好」+ 正文「回复 @李峰：你好！我在，有什么可以帮您？」
- **android**：只有正文「你好！我在，有什么可以帮您？」，引用块和「回复 @xx：」前缀全丢

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 合并详情：纯文本条目带引用快照时还原引用 | ➖ | ✅ | ➖ 已支持 | ⬜ 待确认 |
| 真机自测 | ➖ | 🚧 | ➖ | ⬜ |

## 定位

OSS 合并包里，智能体（个人 AI 框）的回复可能是 **`RC:TxtMsg`**，引用不在消息体里，只以
`content.referMsg`（+ `referMsgUserId` / `objName`）快照的形式写入 —— iOS 打包侧 `ZXCombineMessageLogic`
对 `isAgentMessage` 专门补这份快照，读侧 `ZXRCMessageModel.zx_referModelFromCombineSnapshot` 再把它还原成引用。

android 读侧 `CombineDetailActivity.setViewList()` 的 `case IMMessageType.TXT_MESSAGE` 直接
`Gson.fromJson(..., TextMessage.class)`，把 `referMsg` 快照整块丢掉 → 无引用块、无前缀。
（`ZX:ActionCardMsg` / `RC:ReferenceMsg` 两条路径本来就还原引用，所以同页其它 AI 回复正常。）

## 本次改动落点（android）

- `IM/.../message_type/combine/CombineDetailActivity.java`
  - TXT 分支先走新增的 `buildReferCardFromTxtJson()`：JSON 里有非空 `referMsg` 且有正文时，
    组一份卡片 JSON（content / extra / baseExtra / user / referMsgUserId / objName / referMsg）交给
    `ActionCardMessage(byte[])` 解析，复用卡片 provider 的引用块 + 蓝色「回复 @xx：」前缀，
    与同页其它智能体回复观感一致；同时把 `Message.objectName` 改成 `ZX:ActionCardMsg` 保持下游一致。
  - 内嵌引用还原不出来（`isBlankReferContent`）时回落 `decodeNestedReferFromJson`；仍拿不到就返回 null，
    调用方回落普通文本，**不会丢正文**。
  - 新增 `fixBlankNestedReferText()`：内嵌引用本身是 `RC:ReferenceMsg` 且 `editSendText` 为空时兜底，
    否则 `ReferenceChildReferenceMessage` 会空指针。
  - 沿用既有约定：`referMsgUid` 置空（按内嵌快照展示，不查当前会话）、`applyCombineReferSourceTime` 还原源消息时间。
- `IM/.../util/AgentReplyDisplayUtil.java`：把私有的前缀剥离逻辑暴露为
  `bodyByStrippingReplyPrefix()`，避免正文自带「回复 @xx：」时前缀渲染两遍。

编译验证：`./gradlew :IM:compileDevelopDebugJavaWithJavac` 通过。

## 待办 / 阻塞

- (android) **需真机复现自测**：用出问题的那条聊天记录再开一次，确认引用块 +「回复 @李峰：」出现且正文不重复前缀。
- 结论基于代码链路推断（iOS 打包/读取两侧都为「智能体纯文本回复 + referMsg 快照」写了专门分支），
  未直接抓过那份 OSS JSON。若真机验证后仍无引用，需抓合并包 JSON 看该条的 `objectName` 与是否真有 `referMsg`。
- **打包侧仍有缺口**：android `MessageTransmitDialog` 的 TXT 分支不写 `referMsg` 快照（android 端本地也没有
  「引用只记在 extra 触发 uid」的还原链路），因此**由 android 发起的合并转发**里这类 AI 回复在四端都不会有引用块。
  要补齐需先在 android 侧实现类似 iOS `agentReplyReferModelForMessage` 的查库还原，属独立任务。
- desktop / web 是否有同类丢失未查。

## 关键决策记录

- 2026-08-13：android 读侧把「带引用快照的纯文本」转成 `ActionCardMessage` 而不是 `ReferenceMessage`——
  合并详情里 `ReferenceMessageItemProvider` 只画引用块、正文直接取 `textContent`（不拼「回复 @xx：」前缀，
  人发的回复是发送时就把前缀写进正文的），卡片 provider 才会同时给引用块和蓝色前缀，与同页其它 AI 回复一致。

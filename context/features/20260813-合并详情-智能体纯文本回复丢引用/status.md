# Status：合并详情（聊天记录页）智能体回复丢引用（iOS 转发→安卓看）

> 最后更新：2026-08-13 15:30 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 问题

群聊天记录（合并转发详情）里，个人 AI 框的一条回复：

- **iOS**：引用块「李峰：你好」+ 正文「回复 @李峰：你好！我在，有什么可以帮您？」
- **android**：只有正文，引用块与「回复 @xx：」前缀全丢

**复现条件**：合并转发由 **iOS 发起**时安卓看丢引用；由安卓发起时安卓正常 → 差异在 OSS 包的字段形态，不在 iOS 显示逻辑。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 合并详情兼容 iOS 打包的引用快照 | ➖ | ✅ | ➖ 无需改 | ⬜ 未查 |
| 真机自测 | ➖ | 🚧 已装 onTest 包待验 | ➖ | ⬜ |

## 定位（已抓真实 OSS 包比对，非推断）

用 `adb pull /sdcard/Android/data/com.cnmts.smart_message.test/cache/merge-cache/*.txt` 取到同一段会话的两份合并包
（iOS 打包 / 安卓打包），出问题的那条是 `ZX:ActionCardMsg`，两端字段形态不同：

| | 安卓打包 | iOS 打包 |
|---|---|---|
| 引用类型字段 | `objName = "RC:TxtMsg"` | `objName` 缺省，写在 `referObjName = "RC:ReferenceMsg"` |
| `referMsg` 快照 | `{content, user}` | `{content, user, senderUserInfo, objectName:"RC:ReferenceMsg", sentTime, emoji…}` |

安卓读侧 `ActionCardMessage(byte[])` 与 `CombineDetailActivity.restoreActionCardReferMsg()`：

1. 不认 `referObjName`；
2. 于是 objName 回落 `referMsg.objectName` = `RC:ReferenceMsg`，`NativeClient.newMessageContent()` 对这份
   「只有 content 字符串」的快照解不出内容（null / 空壳）；
3. 旧兜底只在 `objName == RC:TxtMsg` 时才按文本还原 → 引用整块丢 → 卡片 provider 因 `referMsg == null` 连
   「回复 @xx：」前缀也不拼。

被引的消息本身是一条回复消息（李峰「回复 @Bob：你好」），所以 objName 才是 `RC:ReferenceMsg`；
同一份包里被引的是普通文本的那条（第 2 条 AI 回复）就正常 —— 与截图现象一致。

## 本次改动落点（android，2 文件）

- `IM/.../message_type/combine/CombineDetailActivity.java`
  - `restoreActionCardReferMsg()`：objName 依次取 `objName` → **`referObjName`** → `referMsg.objectName` → 文本；
    还原改为统一走 `decodeNestedReferFromJson()`。
  - `decodeNestedReferFromJson()`：objName 为 `RC:ReferenceMsg`（或空/文本）时直接按文本快照还原；
    其它类型解出来是空的也回落文本，避免整块引用消失。
  - 新增 `textReferFromJson()`：`content` 作正文，`user` / `senderUserInfo` 作引用人（引用条「昵称：正文」与
    「回复 @xx：」前缀都取这里）。
  - `isBlankReferContent()` 增加「`ReferenceMessage` 且 `editSendText` 空」= 空壳判定；ActionCard 分支的兜底
    条件由 `referMsg == null` 放宽为 `isBlankReferContent(...)`。
  - TXT 分支新增 `buildReferCardFromTxtJson()`：`RC:TxtMsg` 条目若带 `referMsg` 快照（iOS
    `ZXCombineMessageLogic` 对 `isAgentMessage` 的纯文本回复会写快照），转成卡片以复用引用块 + 前缀渲染。
    **当前两份样本里没有这种条目，属防御性分支**，还原不出来时回落普通文本，不丢正文。
  - 新增 `fixBlankNestedReferText()`：内嵌引用是 `RC:ReferenceMsg` 且 `editSendText` 空时兜底，
    否则 `ReferenceChildReferenceMessage` 会空指针。
- `IM/.../util/AgentReplyDisplayUtil.java`：私有的前缀剥离逻辑暴露为 `bodyByStrippingReplyPrefix()`，
  防正文自带「回复 @xx：」时前缀渲染两遍。

验证：`./gradlew :IM:compileDevelopDebugJavaWithJavac` 通过；`./gradlew installOnTestDebug` 已装到真机（2509FPN0BC）。

## 待办 / 阻塞

- (android) **真机自测**：重开那条 iOS 转发的聊天记录，确认第 4 条出现引用块「李峰：你好」+ 蓝色「回复 @李峰：」，
  且正文不重复前缀；再看一遍安卓自己转发的那份没被改坏。
- iOS **不需要改**：它写的 `referObjName` + 快照信息量够，安卓读不了是安卓的兼容问题。
  （若要收敛差异，可另起任务让 iOS 也补写 `objName`，属锦上添花。）
- desktop / web 读同一份 iOS 包是否也丢引用，未验证。
- 打包侧遗留：安卓 `MessageTransmitDialog` TXT 分支不写 `referMsg` 快照（安卓本地没有「引用只记在 extra 触发
  uid」的查库还原链路），所以安卓发起的合并转发里这类纯文本 AI 回复在四端都不会有引用块 —— 独立任务。

## 关键决策记录

- 2026-08-13：`RC:ReferenceMsg` 的引用快照一律按**文本**还原（不喂给融云 `newMessageContent`）——
  快照里只有 `content` + `user`，iOS/PC 的引用条展示的也是这份正文；喂给融云要么得到空壳，要么得到没有
  userInfo 的回复消息（引用人显示不出来）。
- 2026-08-13：安卓读侧把「带引用快照的纯文本条目」转成 `ActionCardMessage` 而非 `ReferenceMessage`——
  合并详情的 `ReferenceMessageItemProvider` 只画引用块、正文直取 `textContent`（人发的回复是发送时就把
  「回复 @xx：」写进正文的），卡片 provider 才会同时给引用块和蓝色前缀。

# Status：合并详情（聊天记录页）智能体回复丢引用（iOS 转发→安卓看）

> 最后更新：2026-08-13 16:40 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 问题

群聊天记录（合并转发详情）里，个人 AI 框的一条回复：

- **iOS**：引用块「李峰：你好」+ 正文「回复 @李峰：你好！我在，有什么可以帮您？」
- **android**：只有正文，引用块与「回复 @xx：」前缀全丢

**复现条件**：合并转发由 **iOS 发起**时安卓看丢引用；由安卓发起时安卓正常 → 差异在 OSS 包的字段形态，不在 iOS 显示逻辑。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 合并详情兼容 iOS 打包的引用快照 | ➖ | ✅ | ➖ 无需改 | ⬜ 未查 |
| 合并详情 `RC:ReferenceMsg` 画引用块 | ➖ | ✅ 本来就画 | ✅ 本来就画 | ✅ 本次新增 |
| 引用人昵称被写成 `ga_` 账号 id | ➖ | ✅ 本次 | ✅ 本次（读 + 发） | ✅ 本次 |
| 真机 / 客户端自测 | ➖ | 🚧 已装 onTest 包待验 | ⬜ 待人工 Xcode 构建 | ⬜ 待跑 dev:test |

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

## 第二轮：PC 无引用块 + 三端引用人显示成 `ga_xxx`（2026-08-13 下午）

现象（同一条消息，李峰「回复 @Bob：你好」）：

- **desktop**：合并详情只有正文，无引用块；
- **android / ios**：有引用块，但引用人昵称显示成 `ga_2079857285076635650`。

### 定位（依据用户贴的 PC 侧真实消息 JSON）

消息体 `content.referMsg = {content, user:{id:"ga_…", name:"ga_…", portrait:""}, burnDuration:<源消息时间>}`。

1. **PC 无引用块**：`winbox-wrapper.vue`（合并详情列表）把 `ReferenceMessage` 和 `TextMessage` 一起丢给
   `msg-txt`，只渲染正文——从来没画过引用块（会话页走的是 `msg-reply`，合并详情没接）。
2. **昵称是 uid**：**producer 是 iOS 发送侧**。`ZXRCIMBaseChatController+SendMessage.m` 组装
   `RCReferenceMessage` 时，若被引消息没有 `senderUserInfo`，用 `name = self.replyModel.senderUserId`
   起头再查通讯录；被引的是智能体（`ga_`）→ 通讯录查不到 → **昵称就是账号 id**，且
   `destructDuration = 源消息 sentTime`（正是数据里的 `burnDuration`，可据此判定这条是 iOS 发的）。
   这份快照随消息发出去，三端引用条都优先读 `referMsg.user.name` → 全都显示 `ga_xxx`。

### 本轮改动

- **desktop**（2 文件）
  - `components/popwin/winbox-wrapper.vue`：`ReferenceMessage` 拆出独立分支，用 `msg-refer`
    （`skipLocalCheck` 不查本地原消息）+ `msg-txt` 渲染；新增 `referSnapshot()` / `referSenderName()` /
    `findCombineSenderMessage()`（昵称占位时按「发送者 + 正文」在同一份记录里找源消息借名，再回落 `AllUserMap`）。
  - `components/chitchat/message/msg-refer.vue`：新增 `senderNameOverride` prop；`senderName` 增加
    「`user.name` 等于 `user.id` 视为占位」判断（会话页同样受益）。
- **android**（2 文件）
  - `IM/.../dialogue/reference/ReferencePreviewView.java`：内嵌昵称占位判定（空 / 等于 `referMsgUserId` /
    `ga_`、`robot_` 前缀）→ 继续走智能体、通讯录解析；`ga_` 分支查不到 `AgentInfo` 时回落内嵌名，不留空。
  - `IM/.../message_type/combine/CombineDetailActivity.java`：新增 `hydrateReferUserNames()`，构建列表后
    把占位昵称用同一份记录里源消息的 `userInfo.name` 回填（`ReferenceMessage` 与 `ActionCardMessage` 都覆盖）。
- **ios**（3 文件）
  - `ZXIMCellLogic.m`：`zx_isPlaceholderDisplayName:` 把 `ga_` / `robot_` 开头的名字也算占位
    （原来只认空和 `user<`）——读侧全链路（会话页、合并详情、OSS 打包写 `referMsg.user`）一起受益。
  - `ZXCombineMessageLogic.m`：`hydrateCombineReferModelsInList:` 的 `needName` 改用占位判定；源消息自身
    没写 `senderUserInfo` 时再按 `getSenderNickName:` 解析一次。
  - `ZXRCIMBaseChatController+SendMessage.m`（**producer 修复**）：发回复消息时先用 `getSenderNickName:`
    取展示名，仍是占位就写空串，**不再拿 accountId 顶替**——存量消息靠上面的读侧兜底。

验证：`./gradlew :IM:compileDevelopDebugJavaWithJavac` 通过；desktop `eslint` 通过 + `vue-template-compiler`
编译两个模板 0 错误。iOS 按仓库规范不自行构建。

## 待办 / 阻塞

- (android) **真机自测**：重开那条 iOS 转发的聊天记录，确认第 4 条出现引用块「李峰：你好」+ 蓝色「回复 @李峰：」，
  且正文不重复前缀；再看一遍安卓自己转发的那份没被改坏。
- iOS **不需要改**：它写的 `referObjName` + 快照信息量够，安卓读不了是安卓的兼容问题。
  （若要收敛差异，可另起任务让 iOS 也补写 `objName`，属锦上添花。）
- desktop / web 读同一份 iOS 包是否也丢引用，未验证（desktop 的「不画引用块」已单独修，见第二轮）。
- (desktop) `npm run dev:test` 打开那条聊天记录，确认引用块出现且昵称是「Bob」而非 `ga_…`。
- (ios) 人工在 Xcode 构建自测：① 老消息的引用条昵称回填；② 新发一条回复智能体的消息，抓包看
  `referMsg.user.name` 不再是 `ga_…`。
- 昵称占位判定按「`ga_` / `robot_` 前缀」实现，若将来有真人昵称以此开头会被误判（可能性极低，先记着）。
- 打包侧遗留：安卓 `MessageTransmitDialog` TXT 分支不写 `referMsg` 快照（安卓本地没有「引用只记在 extra 触发
  uid」的查库还原链路），所以安卓发起的合并转发里这类纯文本 AI 回复在四端都不会有引用块 —— 独立任务。

## 关键决策记录

- 2026-08-13：`RC:ReferenceMsg` 的引用快照一律按**文本**还原（不喂给融云 `newMessageContent`）——
  快照里只有 `content` + `user`，iOS/PC 的引用条展示的也是这份正文；喂给融云要么得到空壳，要么得到没有
  userInfo 的回复消息（引用人显示不出来）。
- 2026-08-13：引用人昵称**同时修 producer 与 consumer**——iOS 发送侧不再写 accountId 占位（治本，只对新消息生效），
  三端读侧加占位判定 + 同包源消息回填（治存量）。
- 2026-08-13：desktop 合并详情不复用会话页的 `msg-reply`（它会查本地原消息、弹回复抽屉），改为直接组合
  `msg-refer` + `msg-txt`，与 `msg-actioncard` 在合并详情里的做法一致。
- 2026-08-13：安卓读侧把「带引用快照的纯文本条目」转成 `ActionCardMessage` 而非 `ReferenceMessage`——
  合并详情的 `ReferenceMessageItemProvider` 只画引用块、正文直取 `textContent`（人发的回复是发送时就把
  「回复 @xx：」写进正文的），卡片 provider 才会同时给引用块和蓝色前缀。

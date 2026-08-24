# Findings：三端已读回执链路测绘与断点定位

> 审计日期：2026-08-24 ｜ 只读审计，未改任何代码
> 分支快照：desktop `feat/gfm-markdown` · android `fix/md-table-fold-truncate` · ios `feat/ios-file-download-progress`
> 证据规范：带 `文件:行号` 的是代码坐实；无行号的一律进「推测」小节

## 结论摘要

**问题最集中在 PC 端（apps/desktop）。**

PC 是三端里唯一**不用融云 SDK 原生回执 API** 的一端——发送方登记、阅读方回执、回执入库全是自研。
自研实现和 SDK 原生在四个地方口径不一致，每一处都能单独造成「对方看了、发送方仍显示未读」。

排第一的是群聊：PC 阅读方的回执**只覆盖 `TextMessage` / `ReferenceMessage` 且 `content.extra` 非空的消息**，
而安卓 / iOS 阅读方按 SDK 的 `readReceiptInfo.isReceiptRequestMessage` 判定、不限消息类型。
排第二的是私聊：PC 阅读方的回执被 `isFirstScreen` / `showDownMsg` 两个滚动位置状态挡着——
**用户往上翻过历史再看消息，这一次的已读回执就不发**。这条正好解释「偶发、无法稳定复现、用户说不清条件」。

安卓也有一处独立缺陷（发送方只对纯文本发回执请求，引用消息不发），但影响面比 PC 窄。
iOS 没有找到会导致「发送方显示未读」的缺陷。

---

## 一、机制总览：两套完全独立的通道

| | 私聊 | 群聊（@ 消息） |
|---|---|---|
| 主通道 | 融云 `RC:ReadNtf`（已读通知，带 `lastMessageSendTime`，覆盖该时间之前的全部消息） | 融云 `RC:RRReqMsg`（发送方要求回执）→ `RC:RRRspMsg`（阅读方响应，带 `receiptMessageDic`） |
| 服务端旁路 | `datasyn/readMessage`（写）+ `datasyn/getReadMessage`（读） | 无（服务端没有群维度按人已读接口） |
| 多端同步 | 融云 `RC:SRSMsg` / `syncConversationReadStatus` | 同左 |

服务端旁路只影响**会话级**已读时间，不含群内按人明细。群聊的「已读 N 人」名单**只有融云一条路**。

### 融云 SDK 三端不同版本

| 端 | SDK | 形态 | 可读性 |
|---|---|---|---|
| android | `rong_imlib_5.5.3.jar` + `libRongIMLib.so` | 原生 5.x | 仅接口层；内部行为不可读 |
| ios | `RongCloudIM 5.3.7`（`apps/ios/Podfile:33`） | 原生 5.x | Pods 公开头文件可读 |
| desktop | `static/libs/RongIMLib-v2-Adapter-5.3.3.prod.js`（`src/renderer/main.js:8` require，UMD 挂 `window.RongIMLib`） | **v2 API 系**，与原生 5.x 不是同一套 | 明文 JS，全可读 |

> 注意：`node_modules/@rongcloud/imlib-v2` 那份**不是运行时加载的**，只作类型参考。本报告涉及 SDK 内部行为的结论全部在 adapter 明文里复核过。

---

## 二、事实表

### 2.1 desktop（apps/desktop）

**SDK 初始化**

| 事实 | 位置 |
|---|---|
| `RongIMClient.init(AppKey)` 不传 options，`readReceiptTimeout` 取默认 **1 天** | `src/renderer/WebIM/IMSDKServer.js:11` |
| 消息内容类构造器 `QL(messageType, objectName, content, isPersited, isCounted)`，实例形状是 `{messageType, objectName, content, isPersited, isCounted}` | adapter，`QL=function(...)` |
| `Message.send()` 取的是 `sourceMsg.content` 再 `new MessageObject(...)` | `src/renderer/WebIM/message/MessageModel.js:212` |
| SDK 在本机发出 / 多端同步收到 `messageDirection === SEND` 的 `RC:RRReqMsg` 时，写本机记录 `` `${myId}${messageUId}SENT` `` 到 `localStorage["RCV4-API-V2"]`；**要求消息 sentTime 在 `readReceiptTimeout` 窗口内** | adapter，压缩函数 `jL()` |
| SDK 收到 `RC:RRRspMsg` 时，把 `content.receiptMessageDic[myId]` **重写为「本机存在对应 SENT 记录」的子集**；无记录的 messageUId 被剔除，全无记录就变成空数组 | adapter，`idx 503403` 处的重写函数 |

**私聊**

| 阶段 | 事实 | 位置 |
|---|---|---|
| ② 触发 | `ReadLastMessage()` 有 6 个调用点：mounted、消息列表 watcher ×2、`isFirstScreen` watcher、路由/窗口可见性 watcher | `msg-list.vue:871,1246,1334,1352,1366,2320` |
| ② 触发 | **函数头两行直接 return**：`if (!this.isFirstScreen \|\| this.showDownMsg) return false;` | `msg-list.vue:2587-2589` |
| ③ 发出 | 倒序找**第一条**「非自己发、未读、有 messageUId 和 sentTime」的消息，发完即 `break`；发送者是 `ga_` / `robot_` 前缀则 `continue` 跳过 | `msg-list.vue:2590-2629` |
| ③ 发出 | `SendReadReceiptMessage()` 构造 `new RongIMLib.ReadReceiptMessage({messageUId, lastMessageSendTime: msg.sentTime, type})`，用**普通 sendMessage** 发出（非 SDK 封装 API） | `messageService.js:509-542` |
| ③ 发出 | 同一函数额外发一条 `SyncReadStatusMessage`，并在 `.then` 里 800ms 防抖打 `datasyn/readMessage` | `messageService.js:544-559`、`:488-500` |
| ④ 入库 | 收 `RC:ReadNtf` → `ReadReceiptMessage` action → 1 秒延时后 commit | `ReceiveMessageListener.js:246-251`、`messageActions.js:159-171` |
| ④ 入库 | `READRECEIPTMESSAGE`：倒序把 `msg.bySelf && msg.messageTime <= content.lastMessageSendTime && sentStatus === SENT` 的置为 `READ` | `messageMutations.js:233-267` |
| ⑤ 多端 | **无 `syncConversationReadStatus` 调用**；改用自研 `SyncReadStatusMessage` | 全仓库无该 API 调用 |
| ⑥ UI | `getStatusText()`：`sentStatus === SENT` 显示「未」，`RECEIVED`/`READ` 显示「已」；已读时间取 `msgReadTime` 与 `innerReadTime` 的较大值 | `msg-list.vue:2961-2989` |
| ⑥ UI | `innerReadTime` 来自 `datasyn/getReadMessage`（`chatType: 1`），在 `privateTargetId` watcher 里拉一次 | `msg-list.vue:1265-1280` |

**群聊**

| 阶段 | 事实 | 位置 |
|---|---|---|
| ① 登记 | `shouldRequestGroupReadReceipt()`：`mentionedInfo.type === ALL` 直接 true；否则解析 `extra`，`atAllUserList` 非空 true，或 `atUserList` 里存在非 `robot_` / 非 `ga_` 的 id 才 true | `messageService.js:295-318` |
| ① 登记 | `requestGroupReadReceiptIfNeeded()` 用**普通 sendMessage** 发 `ReadReceiptRequestMessage`，content 为 `{messageUId}` | `messageService.js:319-339` |
| ① 登记 | 只在 `SendTextMessage` / `SendReferMessage` 成功后调用 | `messageService.js:344-357` |
| ① 登记 | 自研需回执登记表 `setNeedReceipt`，写入条件：`messageDirection === 1 && txtmsg.extra && txtmsg.extra.atUserList && !isHis && msg.messageUId` | `MessageModel.js:305-317` |
| ① 登记 | `setNeedReceipt` 名单由 `extra.atUserList` + `extra.atAllUserList` 构造（剔除 robot）；名单为空则**直接 return 不登记** | `storeModule/index.js:116-151` |
| ③ 发出 | `sendGroupReceiptMessage()` 筛选条件：非自己发 + 有 messageUId + 非本地消息 + **messageType ∈ {TextMessage, ReferenceMessage}** + **`content.extra` 非空** + 有 sentTime | `msg-list.vue:1427-1446` |
| ③ 发出 | 唯一触发点是 `msgLength` watcher（消息条数变化），且 setTimeout 1000ms 后才发 | `msg-list.vue:1291-1295,1456-1461` |
| ③ 发出 | 按 `senderUserId` 分组成 `receiptMessageDic`，用普通 sendMessage 发 `ReadReceiptResponseMessage` | `msg-list.vue:1447-1454`、`messageService.js:469-484` |
| ④ 入库 | `HandleGroupMsgResp` 仅当 `content.receiptMessageDic[myId]` 为真值时处理（**空数组 `[]` 在 JS 里是 truthy，会进入后空转**） | `messageActions.js:172-196` |
| ④ 入库 | `setGroupReceipt` 三道门：群未登记直接 return / groupStore 空直接 return / 该 messageUId 未登记则跳过 / **`msgState[senderUserId] === 0` 严格相等**才写入 | `storeModule/index.js:153-182` |
| ⑤ 多端 | 依赖 SDK 的 SENT 记录本机化机制（见上表） | — |
| ⑥ UI | 「已读 N/M」从 `electronStore/groupReceiptByGroup` 读，2 秒轮询刷新 | `msg-list.vue:1624-1636,882`、`:2942-2948` |
| — | **PC 完全不处理收到的 `RC:RRReqMsg`**：`MsgObjectNameEnum` 无 `"RC:RRReqMsg"` 反向映射，落 `UnknownMessage` | `MessageModel.js:65-85`、`ReceiveMessageListener.js` |

### 2.2 android（apps/android）

| 阶段 | 机制 | 事实 | 位置 |
|---|---|---|---|
| — | 配置 | `setReadReceiptConversationTypeList(PRIVATE, GROUP)`，两类会话都开 | `smart_message/.../RongMessageInit.java:112,118-123`；默认值见 `IM/.../base/RongContext.java:85-86` |
| ① | 群 | 发送成功回调里发 `sendReadReceiptRequest`，条件：**`objectName == TXT_MESSAGE`** + `GROUP` + `getMentionedInfo() != null` | `IM/.../dialogue/ConversationFragment.java:1578-1591` |
| ② | 群 | 收到 `RC:RRReqMsg` → `Event.ReadReceiptRequestEvent` → 在当前列表里找到该 messageUId 就回执 | `ConversationFragment.java:2470-2499` |
| ② | 群 | 拉历史消息时批量补发：`readReceiptInfo != null && isReadReceiptMessage() && !hasRespond()` 的消息进 `needSendResponseMessageList` | `ConversationFragment.java:3554-3559,3581-3583`（另一处同构在 `:3938-3974`） |
| ③ | 群 | SDK 原生 `sendReadReceiptResponse` | `ConversationFragment.java:2486,3582,3974`；重试路径 `smart_message/.../polling/TimeTaskService.java:592` |
| ② | 私 | 进会话时 `sendPrivateReadReceiptMessage()`，时间戳用 **`System.currentTimeMillis() - deltaTime`（当前时间，覆盖全部历史）** | `ConversationFragment.java:1393,1708-1713` |
| ② | 私 | 会话页前台实时收到新消息时再发一次，条件：`event.left == 0` + `PRIVATE` + `isReadReceiptConversationType` + `direction == RECEIVE` + UId 非空 | `ConversationFragment.java:2982-3001` |
| ③ | 私 | SDK 原生 `sendReadReceiptMessage(conversationType, targetId, time)` | `ConversationFragment.java:1710,2984` |
| ④ | 私 | 收 `RC:ReadNtf` → `ntfTime >= uiMessage.getSentTime() && sentStatus == SENT` → 置 `READ`；**要求当前正打开该会话** | `ConversationFragment.java:3178-3190` |
| ④ | 私 | 另有本地矫正：拉历史时 `direction == SEND && sentStatus ∈ {SENT, RECEIVED} && sentTime < privateLastReceiveMessageTime` → 置 `READ` | `ConversationFragment.java:3563-3572` |
| ⑤ | 两者 | `syncConversationReadStatus` 在进会话 / 清未读 / 退出会话多处调用 | `ConversationFragment.java:1380,1389,1493,1501,1628,1715-1725,3001` |
| ⑥ | 群 | 已读名单从 SDK 的 `readReceiptInfo.getRespondUserIdList()` 读 | `IM/.../groupread/GroupReadDialog.java`、`GroupReadTextProvider.java`、`IM/.../bean/UIMessage.java` |
| — | 两者 | **独有：回执失败落 greendao 重试队列**，`TimeTaskService` 轮询重发（`RETRYTYPE_sendReadReceiptRequest` / `Response`） | `TimeTaskService.java:589-592`、`base_data/.../RongMessageResendPara.java` |

### 2.3 ios（apps/ios）

| 阶段 | 机制 | 事实 | 位置 |
|---|---|---|---|
| ① | 群 | 发送成功回调里 `syncSendReadReceiptRequest:`，条件：`content.mentionedInfo` 非 nil + `messageHasReadReceiptUsers:` | `ZXRCIMBaseChatController+SendMessage.m:196,1170-1187` |
| ① | 群 | `messageHasReadReceiptUsers:`：`mentionedInfo.type == RC_Mentioned_All` true；否则解析 extra，`atAllUserList` 非空 true，或 `atUserList` 里存在非 robot / 非 agent 前缀的 id 才 true | `+SendMessage.m:1147-1168` |
| ② | 群 | 三个触发点：`viewWillAppear`、`applicationWillResignActive`、融云连接状态变为 Connected | `ZXRCIMBaseChatController.m:151`、`+Notification.m:496,512` |
| ② | 群 | 收到 `RC:RRReqMsg` 通知 → 在当前列表找该 messageUId 且 `direction == RECEIVE` → 立即回执 | `+Notification.m:350-370` |
| ② | 群 | 加载历史（本地 / 远程 / 合并）后批量补发，条件 `readReceiptInfo.isReceiptRequestMessage && !hasRespond && direction == RECEIVE`，**不限消息类型** | `ZXRCIMBaseChatController.m:460,538,797,899,1096-1117` |
| ③ | 群 | SDK 原生 `sendReadReceiptResponse` | `ZXRCIMBaseChatController.m:1117`、`ZX_Base/ZX_Logic/ZXChatLogic.m:35` |
| ② | 私 | `sendReadReceiptWithLastTime`：取 `dataArray` 里**最后一条 RECEIVE** 消息的 `sentTime` | `+SendMessage.m:1093-1112` |
| ③ | 私 | SDK 原生 `sendReadReceiptMessage`，成功后再打 `datasyn/readMessage` | `ZXChatLogic.m:25-31`、`+SendMessage.m:1100-1107` |
| ⑤ | 群 | `syncConversationReadStatus`，注释明说「单聊已读回执可复用，不需要发同步命令」，所以**只对 GROUP 发** | `+SendMessage.m:1132-1144` |
| ⑥ | 群 | 已读名单从 `RCMessage.readReceiptInfo` 读 | `ZX_Model/ZXRCMessageModel.m:57,529` |
| — | 私 | `datasyn/getReadMessage` 有封装 | `ZX_Base/ZX_Logic/ZXConversationLogic.m:373`、`ZX_Defines/ZXApiMacro.h:127` |

---

## 三、阶段横切对比

| 阶段 | desktop | android | ios | 不对称？ |
|---|---|---|---|---|
| **群①** 发回执请求的消息范围 | 文本 + 引用；@所有人 或 @真人 | **仅纯文本**；有 mentionedInfo 即发（不排除机器人） | 所有带 mentionedInfo 的类型；@所有人 或 @真人 | ⚠️ 安卓最窄 |
| **群①** 发送方登记 | 自研 electron-store map + SDK SENT 记录（双份） | SDK 原生 | SDK 原生 | ⚠️ PC 独有自研层 |
| **群②** 阅读方触发点 | **仅 `msgLength` watcher** | 收到 RRReqMsg 事件 + 拉历史批量补发 | viewWillAppear + 退到后台 + 重连 + 4 处拉历史补发 | ⚠️ PC 最少 |
| **群③** 阅读方回执范围 | **仅 文本/引用 且 extra 非空** | 按 `readReceiptInfo.isReadReceiptMessage`，不限类型 | 按 `readReceiptInfo.isReceiptRequestMessage`，不限类型 | ⚠️ PC 独窄 |
| **群④** 回执入库 | 自研三道门 + SDK SENT 过滤 | SDK 原生 | SDK 原生 | ⚠️ PC 独有 |
| **群⑤** 多端同步 | 无 `syncConversationReadStatus` | 有，多处 | 有，仅 GROUP | ⚠️ PC 缺 |
| **私②** 阅读方触发点 | 6 处，但**全部被 `isFirstScreen \|\| showDownMsg` 挡一道** | 进会话 + 前台实时收消息 | viewWillAppear + 退到后台 + 重连 | ⚠️ PC 独有门槛 |
| **私③** 已读时间戳口径 | 最新一条未读真人消息的 `sentTime` | **当前时间**（进会话时）/ 该条 sentTime（实时） | 最后一条 RECEIVE 的 `sentTime` | ⚠️ 安卓最宽 |
| **私③** 跳过智能体/机器人 | 跳过（`ga_` / `robot_` 前缀） | 不跳过 | 不跳过 | ⚠️ PC 独有 |
| **私④** 回执入库 | `messageTime <= lastMessageSendTime && sentStatus === SENT` | `ntfTime >= sentTime && sentStatus == SENT` + 本地矫正 | SDK 原生 | 口径一致 |
| **失败重试** | 无 | **有**（落库 + 轮询重发） | 无 | ⚠️ 只有安卓有 |

---

## 四、18 格组合推演

发送端 = 看到错误未读态的一端；阅读端 = 实际看了消息的一端。

### 群聊（@ 消息）

| 发送端 ↓ / 阅读端 → | desktop | android | ios |
|---|---|---|---|
| **desktop** | ⚠️ 条件断（B1/B2/B3） | ⚠️ 条件断（B1/B2/B3） | ⚠️ 条件断（B1/B2/B3） |
| **android** | ⚠️ 条件断（A3：引用@ 不发请求；A1：非文本/引用 或 extra 空时 PC 不回） | ⚠️ 条件断（A3，仅引用@） | ⚠️ 条件断（A3，仅引用@） |
| **ios** | ❌ **断**（A1：iOS 可对任意带 @ 的类型发请求，PC 只回文本/引用且 extra 非空） | 通 | 通 |

### 私聊

| 发送端 ↓ / 阅读端 → | desktop | android | ios |
|---|---|---|---|
| **desktop** | ⚠️ 条件断（A2） | 通 | 通 |
| **android** | ⚠️ 条件断（A2） | 通 | 通 |
| **ios** | ⚠️ 条件断（A2） | 通 | 通 |

图例：❌ = 无条件断；⚠️ = 满足附加条件时断（条件写在括号里）。

**私聊的断点全在「阅读端 = PC」这一列**，与发送端无关。
**群聊的断点分布在三处**：「阅读端 = PC」整列（A1）、「发送端 = 安卓」整行（A3，限引用消息）、「发送端 = PC」整行（B1/B2/B3）。

三张表的交集只有一个位置：**PC**。这与用户「私聊群聊都有」的描述吻合。

---

## 五、可疑点排序

### A 级（代码坐实，可直接开修）

---

**A1 — PC 阅读群消息时，回执只覆盖「文本/引用 且 extra 非空」的消息**

- 现象映射：「群聊，用户已读，对方显示未读」
- 断点阶段：群③（阅读方发出）
- 影响组合：任意端发 → **PC 读**；条件是被 @ 的消息不是纯文本/引用，或 `content.extra` 为空
- 位置：`apps/desktop/src/renderer/components/chitchat/message/msg-list.vue:1433-1446`
- 说明：安卓 / iOS 阅读方按 SDK 的 `readReceiptInfo.isReceiptRequestMessage` 判定，**不限消息类型**（安卓 `ConversationFragment.java:3554-3559`、iOS `ZXRCIMBaseChatController.m:1108-1113`）。
  iOS 发送方只要 `content.mentionedInfo` 非 nil 就发回执请求（`+SendMessage.m:1170-1173`），不限类型——所以 iOS 能发出「PC 接不住」的回执请求。
- 验证手段：iOS 发一条**非纯文本的 @ 消息**（如带 @ 的图片/文件/卡片），PC 打开会话，看 iOS 侧已读是否翻转。

---

**A2 — PC 私聊已读回执被滚动位置状态整体挡掉**

- 现象映射：「私聊，用户已读，对方显示未读」+「偶发、无法稳定复现」
- 断点阶段：私②（阅读方触发）
- 影响组合：任意端发 → **PC 读**
- 位置：`apps/desktop/src/renderer/components/chitchat/message/msg-list.vue:2587-2589`

```js
if (!this.isFirstScreen || this.showDownMsg) {
  return false;
}
```

- 说明：`ReadLastMessage` 有 6 个调用点（`:871,1246,1334,1352,1366,2320`），但**每一个都先撞这两行**。
  `isFirstScreen` 在向上翻历史时置 false（`:1954,2298`），`showDownMsg` 是「下方有新消息」提示。
  安卓 / iOS 的私聊回执都没有等价门槛——安卓进会话就无条件 `sendPrivateReadReceiptMessage()`（`ConversationFragment.java:1393`），iOS `viewWillAppear` 就发（`ZXRCIMBaseChatController.m:151`）。
  `isFirstScreen` 的 watcher（`:1362-1366`）在滚回底部时会补一次，所以**不是必然失败，而是取决于用户当时的滚动位置**——这正好是「偶发、说不清条件」的形状。
- 验证手段：PC 上打开一个有历史消息的私聊，**先往上滚一段**，让对方发消息，不滚回底部直接读，然后看对方端已读是否翻转。

---

**A3 — 安卓发送方只对纯文本发回执请求，引用消息不发**

- 现象映射：「群聊，用户已读，对方显示未读」
- 断点阶段：群①（发送方登记）
- 影响组合：**安卓发** → 任意端读；条件是这条 @ 消息是**引用消息**
- 位置：`apps/android/IM/src/main/java/com/im/dialogue/ConversationFragment.java:1580`

```java
if (message != null && message.getObjectName().equals(IMMessageType.TXT_MESSAGE) && mConversationType == ConversationType.GROUP && ...)
```

- 说明：iOS 对应逻辑不限 objectName（`+SendMessage.m:1170-1173`），PC 对文本和引用都发（`messageService.js:344-357`）。
  安卓发引用 @ 消息时不发 `RC:RRReqMsg` → 安卓 / iOS 阅读方（都依赖 `isReceiptRequestMessage`）永远不回执 → 安卓发送方永远显示未读。
  PC 阅读方走自研分支会回执（引用消息在白名单里），但安卓侧能否消化这条回执取决于安卓 SDK 是否也做 SENT 记录本机化过滤——**不可读，见 B5**。
- 验证手段：安卓群里发一条「引用某条消息 + @某人」，用 iOS 读，看安卓侧已读人数是否变化。

---

### B 级（三端不对称，机制上成立，但要靠不可读的 SDK 内部或未确认的数据结构才能定死）

---

**B1 — PC 发送方登记条件要求 `extra.atUserList` 存在，与「是否发回执请求」的条件不一致**

- 断点阶段：群①
- 影响组合：**PC 发** → 任意端读；条件是 @所有人 且 extra 里没有 `atUserList` 字段
- 位置：`apps/desktop/src/renderer/WebIM/message/MessageModel.js:305-311` vs `src/renderer/service/messageService.js:295-302`
- 说明：`shouldRequestGroupReadReceipt` 在 `mentionedInfo.type === ALL` 时**直接返回 true 并发出 RRReqMsg**，
  但 `setNeedReceipt` 的写入条件是 `txtmsg.extra && txtmsg.extra.atUserList`——**没有 `atUserList` 就不登记**。
  两者不一致时的后果：请求发出去了，对方回执也回来了，但 `setGroupReceipt` 第一道门
  （`storeModule/index.js:157-159`，群未登记直接 return）把它整条丢掉。
  另外 `setNeedReceipt` 内部若名单为空还会提前 return（`:141-143`）。
- 定 A 级还差什么：需要确认「PC 发 @所有人 消息时，`content.extra` 里 `atUserList` 到底有没有值」。
  代码里 `atAllUserList` 和 `atUserList` 是两个字段，但没找到构造处的强约束。
- 验证手段：PC 发一条 @所有人，在 devtools 里看该消息的 `content.extra`，以及 `electronStore` 的 `groupMessageNeedReceiptMap` 有没有这条。

---

**B2 — PC 发送方登记跳过历史消息（`!isHis`），且登记表在本地存储里**

- 断点阶段：群①
- 影响组合：**PC 发** → 任意端读；条件是 PC 重装 / 清 electron-store / 换机后回看旧的 @ 消息
- 位置：`apps/desktop/src/renderer/WebIM/message/MessageModel.js:309`（`!isHis`）、登记表落 electron-store（`storeModule/index.js:144-150`）
- 说明：登记表是纯本地的，没有从服务端或融云重建的路径。一旦丢失，此前发过的所有 @ 消息的已读状态永久不再翻转。
  安卓 / iOS 的登记在 SDK 侧，且安卓另有 greendao 重试队列兜底。
- 验证手段：PC 发 @ 消息 → 清 electron-store → 重启 → 让对方读 → 看已读是否翻转。

---

**B3 — PC 回执入库要求读者已在需回执名单里且值严格等于 0**

- 断点阶段：群④
- 影响组合：**PC 发** → 任意端读；条件是回执方不在 `needReadTimeMap` 里
- 位置：`apps/desktop/src/renderer/store/module/storeModule/index.js:173`

```js
if (msgState && msgState[senderUserId] === 0) {
```

- 说明：名单由 `extra.atUserList` + `extra.atAllUserList` 构造（`:128-139`）。若 @所有人 时 `atAllUserList` 不是全体成员 id，
  则实际读者的 `msgState[senderUserId]` 是 `undefined`，`undefined === 0` 为 false，回执被静默丢弃。
  与 B1 同源，判据也相同。

---

**B4 — PC `readReceiptTimeout` 未配置，取 SDK 默认 1 天**

- 断点阶段：群①/群④
- 影响组合：**PC 发** → 任意端读；条件是消息超过 1 天后才被读
- 位置：`apps/desktop/src/renderer/WebIM/IMSDKServer.js:11`
- 说明：adapter 里 `jL()` 写 SENT 记录时有窗口判断 `new Date(now - timeout天) - e.sentTime < 0`；
  收 `RC:RRRspMsg` 的重写函数（`idx 503403`）同样先判窗口，超窗直接原样返回不做匹配。
  PC 阅读方走的是裸 `sendMessage`，不受 SDK 窗口约束——**所以 PC 会一直发回执，但 PC 作为发送方接不住超过 1 天的回执**。
  SDK 支持的上限是 15 天（`Math.min(15, Math.max(n.readReceiptTimeout || 1, 1))`）。
  安卓 / iOS 的对应配置在 `RongMessageInit.java` / `AppDelegate+RCIM.m` 里**没有找到显式设置**，走各自 SDK 默认值——原生 5.x 默认多少不可读。
- 验证手段：PC 发 @ 消息，隔天再让对方读（或改系统时间），看已读是否翻转。

---

**B5 — 安卓 / iOS SDK 是否同样做 SENT 记录本机化过滤，不可验证**

- 断点阶段：群④
- 影响组合：任意端发 → 任意端读
- 说明：PC 的 adapter 明文里坐实了「收到 `RC:RRRspMsg` 时按本机 SENT 记录过滤 `receiptMessageDic[myId]`」。
  原生 5.x SDK 大概率有同构逻辑，但安卓只有 jar + so、iOS 只有 framework 二进制，**无法确认**。
  这条直接决定 A3 里「PC 阅读方的自研回执能否被安卓发送方消化」。
- 验证手段：只能靠真机埋点或黑盒实验。

---

**B6 — 三端融云 SDK 版本不一致（5.5.3 / 5.3.7 / v2-Adapter-5.3.3）**

- 说明：已读回执的窗口期、去重键、多端同步语义在版本间改过。PC 用的还是 v2 API 系，与两个原生端不是同一套。
  本身不是缺陷，但是上面所有「不可确认」项的根源。

---

### C 级（代码确有问题，但按当前逻辑推演不会造成本次现象；顺手记录）

| # | 问题 | 位置 |
|---|---|---|
| C1 | `switch` 里 `case ReadReceiptResponseMessage` **写了两次**，且第一组没有 `break` —— `RC:ReadNtf` / `RC:SRSMsg` 会 fallthrough 进 `HandleGroupMsgResp`。因为该函数有 `receiptMessageDic` 判空守卫，实际无害 | `apps/desktop/src/renderer/WebIM/ReceiveMessageListener.js:246-264` |
| C2 | `MsgObjectNameEnum` 缺 `"RC:RRReqMsg"` 与 `"RC:SRSMsg"` 的反向映射 → PC 收到这两类消息一律落 `UnknownMessage`。`case MessageType.SyncReadStatusMessage`（`ReceiveMessageListener.js:246`）因此是**永远进不去的死分支** | `apps/desktop/src/renderer/WebIM/message/MessageModel.js:65-85` |
| C3 | `SyncReadStatusMessage` 发送时传 `content: syncContent`（syncContent 已是消息实例），而 `Message.send` 会再 `new MessageObject(sourceMsg.content)` → `QL` 把整个实例塞进 `.content`，**payload 多包一层**，`lastMessageSendTime` 落在第二层。同文件里另两处用 `...content` 展开（`:529`）和 `content: {纯对象}`（`:330`）都是对的——**同一个文件三种写法**。影响自己多端未读同步，不影响对方已读 | `apps/desktop/src/renderer/service/messageService.js:545-553` |
| C4 | iOS `_sendReadReceiptResponseForMessages:` 的**私聊分支**用群回执 API `sendReadReceiptResponse` 处理私聊消息。私聊另有 `sendReadReceiptWithLastTime` 走正确的 `sendReadReceiptMessage`，所以是冗余而非缺失 | `apps/ios/.../ZXRCIMBaseChatController.m:1098-1117` |
| C5 | 安卓发送方条件 `getMentionedInfo() != null` **不排除机器人 / 智能体**，@机器人 也会发回执请求。PC / iOS 都排除了。方向与本次现象相反（多发不会造成未读） | `apps/android/.../ConversationFragment.java:1580` |

---

## 五之二、展示层专项（2026-08-24 追加）

起因：同事指出「PC 就是看 msglist，有消息就给融云发回执；显示是 electron-store 来展示的」。核对结果如下。

### 核对同事的说法

| 说法 | 核对 |
|---|---|
| 「PC 有消息就给融云发回执」 | **群聊近似成立**——`sendGroupReceiptMessage()` 挂在 `msgLength` watcher（`msg-list.vue:1291`），消息数一变就发；但筛了两道（A1）。**私聊不成立**——`ReadLastMessage` 函数头 `if (!isFirstScreen \|\| showDownMsg) return`（`:2587`）。 |
| 「显示靠 electron-store」 | **完全成立**，且这是比回执发送侧更根本的缺陷。 |

### PC 展示层数据来源

| 展示的东西 | 内存态 | 落盘位置 |
|---|---|---|
| 群「已读 N/M」 | `groupMessageReceiptMap[groupId][messageUId][userId]` | `electronStore/<accountId>/group-receipt-<groupId>.json`（`storeModule/index.js:23-28`） |
| 要不要渲染已读入口 | `groupMessageNeedReceiptMap` | `groupMessageNeedReceipt.json`（`storeModule/index.js:12-15`） |
| 私聊「已/未」+ 已读时间 | `chatReadTime[YYYYMMDD][messageUId]` | `msgReadTime-<date>.json`，**按天分片**（`storeModule/index.js:30-36`） |
| 私聊兜底已读时间 | `innerReadTime` | 不落盘，进会话拉一次 `datasyn/getReadMessage`（`msg-list.vue:1265-1280`） |
| 会话最后已读时间 | — | `chatLastReadTime.json`（`storeModule/index.js:16-19`） |

### D 级：展示层四个洞

| # | 问题 | 位置 | 后果 |
|---|---|---|---|
| **D1** | 群已读**纯本地存储，无任何重建路径** | `storeModule/index.js` 全文 | 换机 / 重装 / 清缓存 → **群**已读全丢且永久回不来。**私聊不受影响**（见下方实测修正） |
| ~~**D2**~~ | 私聊已读按天分片，只加载 4 天窗口 | `storeModule/index.js:38-51` | **已实测降级**，见下 |
| **D3** | 登记表决定渲不渲染已读入口，一旦丢失后续回执全被第一道门丢弃 | `storeModule/index.js:157-159` | 与 B1/B2/B3 同源；**服务端权威源也救不了「压根没渲染出已读入口」** |
| **D4** | 三端各存各的，无共同权威源 | 三端 | 天然不可能显示一致 |

### 实测修正（2026-08-24，用户在真机上验的）

**测法**：PC 上翻到 **8/6**（4 天窗口之外、6 个月之内）自己发出去的私聊消息，看显示什么。
**结果**：显示**已读**。

**结论**：

- **D2 从 A 级降级。** 私聊已读**状态**不受本地册子影响——融云本地库把 `sentStatus = READ` 持久化了，
  `MessageModel.js:265-276` 那段「融云历史消息返回的都是未读」的补正逻辑要么生效了（`offLineMessage` 为真），
  要么融云本身就返回了 READ。册子缺失只丢**已读时间戳**，不影响「已读/未读」文案。
- **D1 对私聊同样降级**，融云本地库兜底。**但对群聊仍然成立**——群「已读 N/M」是纯 electron-store，无任何兜底。
- **`repro.md` 的 R1 作废。**

**这个结果把范围砍掉一大半**：既然融云库能记住私聊已读状态，那私聊显示「未读」就**只有一个可能——回执从来没到达发送方**。
不是「记了没读出来」，是「压根没记上」。私聊方向应集中查 A2 / B4（回执发不出、收不到），不必再查显示层。

**群聊方向反而升级**：群已读没有融云兜底，D1 / D3 / B1 / B3 一旦命中就是必现，没有东西能救。

### 关键机会：服务端已有权威数据，三端都没用起来

`datasyn/getReadMessage` 返回 `[{accountId, msgUID, msgTimestamp, chatType, targetId, readTimestamp}]`，
**带 `accountId`，且接口明确支持 `chatType: 2`（群聊）**：

- 安卓接口定义与注释：`android_net/.../HistoryChatMessageZhiXinServerInterface.java:63-69`（「chatType:会话类型:1、单聊；2、群聊」）
- iOS 封装按会话类型传 1/2：`ZX_Base/ZX_Logic/ZXConversationLogic.m:365-370`
- 返回结构：安卓 `PrivateReadBean`、iOS `ZXRCReadTimeModel.h`

写入侧三端都在打 `datasyn/readMessage`（PC `readSource:"websocket"` `messageService.js:928`、安卓 `"android"` `ConversationFragment.java:1735`、iOS `"IOS"` `ZXConversationLogic.m:346`）——**服务端手里有全量数据**。

但读取侧：

| 端 | 状态 |
|---|---|
| android | `getReadMsg` 接口已定义，**全仓库零调用** |
| ios | `logicGetServerReadMessages` 已定义，**全仓库零调用** |
| desktop | 只在私聊用，`chatType: 1` 写死（`msg-list.vue:1270`），且 reduce 时**丢掉了 `accountId`**（`:1272-1276`） |

> **未验证的硬前提**：`chatType: 2` 的返回是否含**按人明细**（同一 msgUID 多条不同 accountId 的记录）。
> 返回模型里有 `accountId` 字段，机制上支持，但没有实测过。这条决定服务端能否作为群已读的权威源。

## 六、推测（无行号支撑，需实测）

- PC 阅读方回执唯一触发点是 `msgLength` watcher（`msg-list.vue:1291-1295`），推测**切回一个已打开过、消息数没变化的群会话时不会补发回执**。安卓 / iOS 都有「进入会话 / 拉历史」的补发路径。未在代码里找到 PC 的等价补发，但也没有能证伪的调用点。
- PC 群回执延时 1000ms 发出（`msg-list.vue:1456`），私聊回执入库延时 1000ms（`messageActions.js:168-170`）。若用户在 1 秒内切走会话或关窗口，推测回执会丢。未验证 setTimeout 是否在会话切换时被清理。
- 安卓 `sendPrivateReadReceiptMessage()` 用当前时间做 `lastMessageSendTime`（`ConversationFragment.java:1710`），比另两端的「最后一条接收消息的 sentTime」更宽。推测安卓作为阅读方最不容易漏，与「安卓读了对方还是未读」的反馈相对少相符——但用户没给出端信息，无法印证。

## 七、已知限制

1. **无复现路径**。用户无法稳定复现且未记录端信息，本报告全部结论来自代码审计，A 级也只是「代码上必然」，未经真机验证。
2. **SDK 内部行为三端不对等**。PC 的 adapter 是明文 JS，逐条复核过；iOS 只读了公开头文件与调用层；安卓只有 jar + `libRongIMLib.so`，SDK 内部完全不可读。凡涉及原生 SDK 内部的结论一律降到 B 级。
3. **未覆盖会话列表未读数 / 红点**（本轮范围外，用户确认）。C3 属于该域，只做记录。
4. **`datasyn/getReadMessage` 无契约文件**。三端都在调用，本次未逐字段比对传参与解读；PC 只在 `chatType: 1` 用（`msg-list.vue:1270`），安卓 / iOS 的调用条件未展开审计。

## 八、建议的下一步

按性价比排序：

1. **先验 A2**（PC 私聊滚动位置门槛）——不需要出包，PC 本地 `npm run dev:test` 就能跑，10 分钟出结果。这条同时解释「偶发」和「私聊也有」。
2. **再验 A1**（PC 群回执消息类型白名单）——需要 iOS 配合发一条非纯文本的 @ 消息。
3. **B1/B3 一起验**——PC devtools 里看一次 @所有人 消息的 `extra` 结构即可同时定性两条。
4. A3 需要安卓出包或直接看真机行为，成本最高，放最后。

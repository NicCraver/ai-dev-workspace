# Spec：3端-私聊群聊已读回执不翻转排查

> 由 Superpowers brainstorm 产出。最后更新：2026-08-24

## 背景与目标

用户反馈：**私聊和群聊都出现「接收方已经看了消息，但发送方那一侧仍显示未读」**。

关键约束——**无法稳定复现，用户遇到时没有记录，也说不清是哪一端发的消息**。因此没有复现路径可走，本轮唯一能拿到的证据是代码本身。

本轮目标不是修复，是**审计**：把 desktop / android / ios 三端的已读回执实现完整测绘出来，找出三端行为不对称的地方，并给出「问题最可能出在哪一端、哪个位置」的排序结论。

成功标准：

1. 三端 × 私聊/群聊 × 6 个链路阶段的对比矩阵填满，每格有 `文件:行号` 支撑。
2. 9 个（发送端 × 阅读端）组合 × 私聊/群聊 = 18 格标出「通 / 断 / 待测」。
3. 可疑点按置信度 A/B/C 排序，A 级的可直接进入下一轮修复。

### 交付物

| 文件 | 内容 |
|---|---|
| `spec.md` | 本文档（调查方案本身） |
| `findings.md` | **主交付**。三端事实表 + 阶段对比矩阵 + 组合推演 + 可疑点排序 |
| `status.md` | 平台矩阵，标记每端审计完成度 |

### 为什么是「3 端」而不是 4 端

`apps/web` 无 IM 已读回执逻辑——grep `ReadReceipt|readReceipt` 在 `apps/web/src` 下命中的全是个人 AI 框语境的 unread，与 IM 消息回执无关。故本次范围 = desktop / android / ios。

## 用户流程

被审计的是两条独立的产品流程，它们在代码里走**完全不同的通道**：

**私聊已读**
1. A 在会话里发消息给 B。
2. B 打开会话（或在前台收到、或滚动到该消息）。
3. B 侧发出已读信号。
4. A 侧收到后，把该消息的 UI 从「未读」翻成「已读」。

**群聊已读（@ 消息）**
1. A 在群里发一条 @ 消息。
2. A 侧同时发出「要求回执」请求（`RC:RRReqMsg`）。
3. 被 @ 的 B 打开会话看到该消息。
4. B 侧发出回执响应（`RC:RRRspMsg`）。
5. A 侧收到后累加已读人数，点开可看「已读 N 人」名单。

用户报的故障是第 4 步（私聊）/ 第 5 步（群聊）不发生。

## 范围

- **本期做：**
  - 三端已读回执链路的**只读审计**，产出 `findings.md`。
  - 覆盖私聊与群聊两套机制。
  - 纳入智能体 / 机器人会话的已读跳过逻辑（PC `msg-list.vue:2643` 明确跳过）——它属于阶段③的过滤条件，直接决定某些私聊会话永不回执。

- **本期不做：**
  - 不改任何代码、不加埋点、不出包。
  - 不查「自己的未读数 / 红点多端同步」（用户已确认排除；两套机制确有耦合，但范围翻倍）。
  - 不反编译安卓 jar / so。改用「调用层代码 + iOS 公开头文件 + PC 明文 adapter」三角互证。
  - 不查融云控制台的服务端配置（拿不到）。
  - 不写 `plan.md`（本轮无可执行的代码任务）。不碰 `impl-notes.md`（那是给跨端移植用的）。

## 调查方法

### 方法选型

先纵切、后横切：

1. **纵切**——逐端读完实现，产出带 `文件:行号` 的事实表。
2. **横切**——把事实表重排成「阶段 × 端」对比矩阵，不对称的格子自然浮出来。
3. **推演**——按 18 个组合格推断哪些必然断。
4. **排序**——按置信度分级输出可疑点。

选它的理由：现象无法复现，代码事实是唯一证据；而且 `context/features/20260819-pc端群@消息已读回执丢失/plan.md` 已经把 desktop 侧的群聊事实表做完了（含融云 adapter 5.3.3 的内部行为逐条复核），纵切阶段 desktop 那一列近乎白送，只需补私聊部分并复核是否过期。

### 链路阶段模型

已 grep 坐实：**私聊走两条并行通道，群聊只有一条。**

私聊：
- 融云 `RC:ReadNtf`（已读通知）——安卓 `ConversationFragment.java:1710,2984`、iOS `ZXChatLogic.m:25`、PC `messageService.js:509 SendReadReceiptMessage`（PC 是自研构造 `RongIMLib.ReadReceiptMessage`，非 SDK 封装方法）
- 服务端 `datasyn/getReadMessage`——三端都有：安卓 `HistoryChatMessageZhiXinServerInterface.java:69`、iOS `ZXApiMacro.h:127`、PC `msg-list.vue:1270`（PC 仅在 `chatType:1` 用）

群聊：只有融云 `RC:RRReqMsg` → `RC:RRRspMsg`。安卓/iOS 用 SDK 原生 `sendReadReceiptRequest/Response`，PC 自研构造消息体（`messageService.js:319,470`）。

对比矩阵按 **6 阶段 × 2 机制 × 3 端** 展开：

| 阶段 | 私聊要查的 | 群聊要查的 |
|---|---|---|
| ① 发送方登记 | 是否记录「这条待确认已读」 | `RRReqMsg` 何时发、对哪些消息发（PC 有 `shouldRequestGroupReadReceipt` 过滤，安卓/iOS 的过滤条件是什么） |
| ② 阅读方触发时机 | 进会话 / 滚动 / 前台切换 / 收到新消息 | 同左，另加「历史消息补发」 |
| ③ 阅读方发出 | `RC:ReadNtf` 发不发、带什么 time | `RRRspMsg` 发不发、覆盖哪些 messageUId |
| ④ 发送方接收入库 | 收 `ReadNtf` 后怎么改本地消息状态 | 收 `RRRspMsg` 后写进哪张表，有无丢弃门槛 |
| ⑤ 多端同步 | `syncConversationReadStatus`（安卓 `ConversationFragment.java:1715`、iOS `+SendMessage.m:1133`，**PC 无此调用**） | SDK 的 `SENT` 记录本机化问题 |
| ⑥ UI 读取 | 已读标从哪读 | 「已读 N 人」名单从哪读 |

### 各端读取锚点

不盲扫，从已 grep 出的入口顺藤摸。

**desktop**（8/19 事实表可复用，但需复核是否过期——那份 plan 写完后 `messageService.js` 疑似又动过）

`IMSDKServer.js:11` · `ReceiveMessageListener.js:246-263` · `MessageModel.js:31-84,305-317` · `messageService.js:292-360,470,509` · `msg-list.vue:844,1270,1292,1427,2621,2642-2660` · `messageActions.js:159` · `storeModule/index.js:113-180` · `zx-header.vue:313`

**android**

`IM/.../dialogue/ConversationFragment.java`（1380-1724 私聊已读与同步、1582/1969 发 Request、2470 `ReadReceiptRequestEvent`、2501 `ReadReceiptResponseEvent`、2984、3582）· `IM/.../groupread/GroupReadDialog.java` + `GroupReadTextProvider.java`（已读名单 UI）· `IM/.../bean/UIMessage.java` · `IM/.../manager/RongMessageHandlerManager.java` · `smart_message/.../RongMessageInit.java`（SDK 初始化配置，对标 PC 的 `readReceiptTimeout`）· `smart_message/.../polling/TimeTaskService.java:589`（**回执重试队列，PC/iOS 都没有的东西**）· `base_data/.../RongMessageResendPara.java`

**ios**

`ZXRCIMBaseChatController.m`（152 / 460 / 538 / 797 / 899 / 1096-1117，注意 `:260` 有一处被注释掉的回执调用）· `+SendMessage.m:1133,1173` · `+Notification.m:361,495,511` · `ZXChatLogic.m:25,35,57` · `ZXRCMessageModel.h/.m`（`readReceiptInfo`）· `AppDelegate+RCIM.m`（SDK init）· `ZXIMCellLogic.m` / `ZXChatCellAttachView.m`（UI）

### 结论的组织方式

**组合推演**：9 个（发送端 × 阅读端）× 私聊/群聊 = 18 格，每格标「通 / 断 / 待测」。断的格子必须能指到具体阶段 + `文件:行号`。

「发送端 × 阅读端」是 3×3 全排列，**含同端对角线**（如 PC 发、另一个人在 PC 上读）——同端组合不能默认为通，因为 PC 的自研实现和 SDK 原生在同端之间照样可能对不上。

**可疑点分三级**（混在一起没法排优先级）：

- **A 级 坐实**——代码里条件明确不满足，能画出「哪个组合必然断」。可直接开修。
- **B 级 高疑**——三端行为不对称，但要靠 SDK 内部行为才能定死；PC 能读明文验证，安卓只能推。
- **C 级 待测**——只能靠埋点或真机验证的。

每条可疑点固定五个字段：`现象映射`（对应用户哪句话）/ `断点阶段` / `影响组合` / `文件:行号` / `验证手段`。

### 硬性证据规范

`findings.md` 里每条事实必须带 `文件:行号`。无行号的一律标「推测」并单独成节，不与事实混排。这条是本次调查的核心约束——8/19 那份 PC plan 正是靠这个格式，才能在五天后被直接复用。

## 各端差异点

已 grep 坐实的结构性差异（这些本身就是候选可疑点，进入 `findings.md` 后逐条定级）：

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 融云 SDK 版本 | — | `rong_imlib_5.5.3.jar` | `RongCloudIM 5.3.7`（`Podfile:33`） | `RongIMLib-v2-Adapter-5.3.3.prod.js`（v2 API 系，与原生 5.x 非同一套） |
| SDK 可读性 | — | 仅 jar + `libRongIMLib.so`，接口层可见、内部不可见 | Pods 内公开头文件可读 | 明文 JS，全可读 |
| 群回执发送方式 | — | SDK 原生 `sendReadReceiptRequest/Response` | SDK 原生 `sendReadReceiptResponse` | 自研构造消息体（`messageService.js:319,470`） |
| 私聊已读信号 | — | `sendReadReceiptMessage`（`ConversationFragment.java:1710,2984`） | `sendReadReceiptMessage`（`ZXChatLogic.m:25`） | 自研构造 `RongIMLib.ReadReceiptMessage`（`messageService.js:509`） |
| `syncConversationReadStatus` | — | 有（`ConversationFragment.java:1715`） | 有（`+SendMessage.m:1133`） | **无此调用** |
| 回执重试队列 | — | 有（`TimeTaskService.java:589` + greendao 落库） | 无 | 无 |
| `readReceiptTimeout` | — | 待查（`RongMessageInit.java`） | 待查（`AppDelegate+RCIM.m`） | 未传 options，取默认 **1 天**（`IMSDKServer.js:11`） |

> 上表的「web」列恒为 `—`：web 端不参与 IM 已读回执。

## 依赖的接口

| 接口 | 契约文件 | 说明 |
|---|---|---|
| `datasyn/getReadMessage` | **无契约，待补** | 会话级已读时间。三端都在调，但 PC 只用于 `chatType:1`。审计中需确认三端传参与解读是否一致；若发现不一致，按仓库规则先补 `context/contracts/` 再动代码（本轮不动代码，只记录）。 |

融云 `RC:ReadNtf` / `RC:RRReqMsg` / `RC:RRRspMsg` 是 SDK 内置消息类型，不属于自有接口契约范围。

## 待用户确认的问题

无。范围已在 brainstorm 中收敛：三端、只查已读回执（不含未读红点）、只出分析报告不改代码。

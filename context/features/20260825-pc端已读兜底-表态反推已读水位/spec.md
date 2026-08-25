# Spec：PC 端已读兜底 —— 表态反推已读水位

> 2026-08-25 ｜ 只做 desktop 端。上一轮方案（`20260824-3端-私聊群聊已读回执不翻转排查`）已封存，见该目录的封存说明。

## 一、问题

PC 端私聊与群聊都出现「对方明明看了，PC 上仍显示未读」。

根因已定位（上一轮结论）：融云的回执消息在 adapter 属性表里是 `isPersited: false`——

```
"RC:ReadNtf"  :{isCounted:!1, isPersited:!1}
"RC:RRReqMsg" :{isCounted:!1, isPersited:!1}
"RC:RRRspMsg" :{isCounted:!1, isPersited:!1}
```

不落库、不进历史。PC 那一刻不在线，回执就永久丢失，之后拉多少次历史都补不回来。
丢不丢全看时机——这也是问题无法稳定复现的原因。

**在回执通道上打补丁有天花板。本方案不修回执通道，在它旁边另建一条独立的推断通道。**

## 二、核心思路：已读水位

会话级、按人的单调水位表：

```
watermarkMap = { `${conversationType}_${targetId}`: { accountId: 时间戳 } }
```

语义：`watermark[U] = T` 表示 **U 在 T 时刻确实打开着这个会话**。
于是我发的任何 `sentTime <= T` 的消息，对 U 已读。

只增不减（`bump` 内部取 max）。纯内存，切会话不清，进程退出自然消失。

### 三个证据源

三源都走 `isPersited: true` 的可靠通道，与回执通道的失效条件完全不相关。

| 源 | 数据来源 | 水位取值 |
|---|---|---|
| 表态 | `expansionDataMap[messageUId]` 的 `` `${emoji}_` `` 前缀，条目 `{ s: 账号Id, t: 时间戳 }` | `max(水位, 被表态消息.sentTime)` |
| 回复 | 同一份消息扩展，`referInfo_` 前缀，同一份数据结构 | 同上 |
| 对方发言 | `messageList` 里 `!bySelf` 的消息 | `max(水位, 该消息.sentTime)` |

排除项：自己、`robot_` / `ga_` 前缀账号（机器人与智能体不参与已读）、`isLocalMessage`。

三源共用一个收集函数，输出同一张 `{ accountId: 水位 }`。

> 表态与回复在智信里走的是**同一条通道**（IM 消息扩展），数据结构完全一致，
> 因此代码上是同一段逻辑，不需要分支。

### 为什么水位取「被表态消息的 sentTime」而不是「表态时间 t」

- `t` 是表态那一刻，比 sentTime 晚。用 `t` 会多盖一段——从被表态消息到表态时刻之间的消息，
  可能在对方视口下方，没真看到。
- 用 sentTime 更保守：对方渲染到了那条消息，它前面的消息就在它上方。
- 附带好处：**上一轮「扩展条目缺 `t` 时用 1 占位」的坑，本方案结构上绕开了**——根本不读 `t`。

## 三、模块设计

新目录 `apps/desktop/src/renderer/components/chitchat/read-receipt/`：

### `readWatermarkModel.js` —— 纯函数，无 Vue / Vuex / electron-store 依赖

```js
extractExpansionReaders(expansionEntry, selfId)             // → [accountId, ...]
collectWatermark({ messageList, expansionDataMap, selfId }) // → { accountId: 水位 }
isReadByWatermark(sentTime, watermark, userId)              // → boolean
```

`extractExpansionReaders` **只返回人、不返回时间**——时间由调用方用该条消息的 `sentTime` 补，
与第二节「水位不取 `t`」一致。

`expansionDataMap[messageUId]` 的形状是 `{ prefix: [{ s, t }, ...] }`，
值已被 `MessageExpansionUtils.js` 的 `parseMap` JSON.parse 过。

### `readWatermarkStore.js` —— reactive 水位表

`bump(conversationKey, readers)` / `get(conversationKey)`。`bump` 内部逐个取 max，保证单调。

### `tests/readWatermarkModel.test.js` —— vitest

## 四、接线（只碰 `msg-list.vue`）

### 喂入点（1 个）

watcher 盯 `messageList` 与 `expansionDataMap.updated`
（`MessageExpansionUtils.js:44` 已有这个全局更新时间戳），变了就 `collectWatermark` 一次、`bump` 进表。

实时扩展监听（`IMSDKServer.js:45`）、新消息（`MessageModel.js:251`）、拉历史（`MessageModel.js:353`）
**全部汇入 `onExpansionUpdate`**，所以盯这一个时间戳就够，不用逐个挂钩子。

### 读出点（2 个）

**私聊** —— `getStatusText(data)`：现有已读时间之上再 `max` 一个水位命中值。

**群聊** —— `getGroupHasReadCount(msg)` 与模板的已读图标绑定：
名单里每个 `userId`，水位 ≥ `msg.sentTime` 就算已读。

**分母（@ 名单）不动**：不在名单里的人表态，既不进分子也不进分母。
理由是分母的语义是「需要已读的人数」，由发送方登记决定，不该被旁人的动作改写。

> 群聊「本地名单整片缺失时不显示已读图标」的行为保持不变，本次不碰。

## 五、边界

### 会误报（承认，不修）

1. **跳转进会话中间** —— 对方从搜索 / @提醒直接跳到第 10 条并表态，第 1–9 条可能没滚过，
   按水位仍算已读。这是「已读水位」的行业通行语义；安卓 `sendPrivateReadReceiptMessage`
   （`ConversationFragment.java:1710`）用当前时间做 `lastMessageSendTime`，本质同样宽松。
2. **多设备** —— 对方手机发消息、电脑没打开。水位记的是「人」不是「设备」。
   已读本来就是人的语义，不视为缺陷。

### 会失效（覆盖不到，不算错）

- 证据消息不在当前已加载的 `messageList` 里 → 收集不到。滚动加载更多历史后自动补上，单调只增。
- 对方全程没表态、没回复、没发言 → 兜不住，只能靠回执。

### 关键性质

**这一层只会把「未读」翻成「已读」，永远不会反向。**
最坏情况是「没兜住」，不存在「兜出个更差的」。

## 六、测试

`readWatermarkModel.js` 三个函数全是纯函数，vitest 覆盖：

- 表态取到人；同一条消息多人表态全部收进；同一人多条消息表态时水位取最晚那条的 `sentTime`
- 回复前缀 `referInfo_` 与表态走同一路径
- 对方发言进水位；自己发的不进；`robot_` / `ga_` 不进；`isLocalMessage` 不进
- 水位单调：小值不覆盖大值
- 边界：`sentTime` 恰好等于水位算已读；大于水位算未读
- 脏数据：扩展值不是数组、条目缺 `s`、空输入，均不抛异常

> `apps/desktop` 禁用可选链与 `??`，一律 `&&` 兜底。

## 七、真机验收（4 条，全部可主动构造）

每条都要先确认 PC 上显示未读，再触发证据，观察是否翻转。

1. **私聊** —— 手机对 PC 发的旧消息表态 → PC 上**那条之前的所有消息**翻已读
2. **群聊 · 名单内** —— @ 名单里的人表态 → 分子 +1，分母不变
3. **群聊 · 名单外** —— 不在 @ 名单的人表态 → `x/y` 完全不变
4. **对方发言** —— 对方在会话里发一句话 → 我方该时刻之前的消息全翻已读

## 八、交付

- 分支：从 `origin/release` 切 `feat/pc-read-watermark`
- 改动面：新增 3 个文件 + 改 `msg-list.vue` 三处
- 不碰：回执通道、服务端接口、Vuex
- 打包配置三件套（`.env.test` / `electron-builder.yml` / `package.json`）一律不 stage

## 九、与上一轮方案的关系

上一轮分支 `fix/pc-read-receipt-hardening`（18 commit，未 push，未验收）继续封存。
其中 commit `63501144` 实现过表态/回复反推，但**只覆盖被表态的那一条消息**，
对方在第 10 条上表态时第 1–9 条仍是未读——覆盖面太窄，当不了兜底。
本方案的水位传播正是补这一点。

上一轮未做完的另两条（服务端写入解耦、群聊服务端 `chatType: 2` 接口）不在本次范围。

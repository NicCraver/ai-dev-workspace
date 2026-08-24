# PC 端已读回执准确性加固 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 PC 端（apps/desktop）私聊与群聊的已读/未读显示做到「只增不减、可重建、不漏发回执」，消除因本地数据过期丢失、消息类型不匹配、滚动位置状态而错报未读的全部已知路径。

**Architecture:** 把散落在 `msg-list.vue` / `messageService.js` / `storeModule` 里的已读判定抽成一个无依赖纯函数模块，用 vitest 覆盖。判定遵循两条不变式——**单调性**（已读不可回退成未读）与**多源合并**（本地缓存 / 融云 / 服务端任一有已读记录即算已读，取时间最大值）。发送侧去掉三道 PC 独有的收窄条件（消息类型白名单、`extra` 非空、`isFirstScreen`），并补齐触发点对齐 iOS。服务端 `datasyn/getReadMessage` 提为可重建的权威源，本地存储降级为秒开缓存。

**Tech Stack:** Electron 19 + Vue 2.7 Options API + Vuex 3 + electron-store，融云 `RongIMLib-v2-Adapter-5.3.3`（UMD 全局 `window.RongIMLib`），测试用 vitest（已在 devDependencies）。

## Global Constraints

- **仅改 `apps/desktop`。** 本计划不动安卓 / iOS / web。
- **禁止重装依赖**：不执行 `npm install` / `pnpm install`，不删 `node_modules`。
- **禁止使用可选链 `?.` 与空值合并 `??`**：`apps/desktop` 一律用 `&&` 兜底。
- **提交禁忌**：`.env.test`、`electron-builder.yml`、`package.json`、`package-lock.json` 一律不 `git add`。工作区里这三个文件当前就是脏的（PC 打包本地配置），提交前确认未 stage。
- **注释用中文。**
- **功能内聚**：新增代码集中在 `apps/desktop/src/renderer/components/chitchat/read-receipt/`，单测放该目录下的 `tests/`。既有文件就地改，不搬迁。
- **框架约束**：Vue 2.7 Options API，不引入 Vue 3 / Pinia / 组合式 API 库。
- **禁止改动融云 SDK 私有 storage**（`localStorage["RCV4-API-V2"]`）：SDK 构造时整表读进内存缓存，外部写入会在 SDK 下次 `set` 时被整体覆盖。只读不写也不做依赖。
- 分支：**从 `origin/release` 切** `fix/pc-read-receipt-hardening`（不是从当前的 `feat/gfm-markdown`），
  目的是让回执修复能独立发版、不与 GFM Markdown 迭代绑定。
  已核实：`origin/release` 被 `feat/gfm-markdown` 完全包含（分叉 0/20），那 20 个 commit **只碰 markdown 相关文件**，
  本计划要改的 8 个文件在两分支间**零差异**，因此计划中的所有行号在 release 上同样有效。
  `.env.test` / `electron-builder.yml` / `package.json` 三个本地脏文件在两分支间也无差异，切分支时会平滑带过。

### 明确不在本计划范围内

| 项 | 为什么不做 |
|---|---|
| **A3**：安卓发送方只对纯文本发回执请求，引用消息不发（`ConversationFragment.java:1580`） | 需改安卓并出包，跨端协调。本计划只动 PC。**单独排期**，已记入 `status.md` 待办 |
| `send-box.vue:1597-1605` 的 10 人上限 | **产品需求**，>10 人群 @所有人 不显示已读属预期行为 |
| 会话列表未读数 / 红点多端同步 | 用户已确认不在本次范围 |
| 安卓 / iOS 接入服务端已读权威源 | 两端目前接口已定义但零调用。PC 侧跑通并确认 `chatType:2` 返回形态后再推 |

---

## 背景：本轮审计已坐实的事实

行号为改动前。完整测绘见同目录 `findings.md`。

| 事实 | 位置 |
|---|---|
| 私聊已读显示：`msgReadTime[sentDate]` 不存在时，**服务端兜底 `innerReadTime` 也被同一个条件挡住** | `msg-list.vue:2974-2978` |
| 本地已读按天分片，启动只加载「前天/昨天/今天/明天」四册 | `storeModule/index.js:38-51` |
| 私聊回执入口 `ReadLastMessage` 有 6 个调用点，但函数头 `if (!isFirstScreen \|\| showDownMsg) return false` 一律先挡 | `msg-list.vue:2580-2589`；调用点 `:871,1246,1334,1352,1366,2320` |
| `isFirstScreen` 在**定位跳转**时置 false（`data.order == 1`），在**滚动离底**时也置 false（同时 `showDownMsg = true`） | `msg-list.vue:1954`、`:2298` |
| PC 群阅读方回执筛选：仅 `TextMessage`/`ReferenceMessage` 且 `content.extra` 非空 | `msg-list.vue:1433-1446` |
| PC 群阅读方唯一触发点是 `msgLength` watcher，延时 1000ms | `msg-list.vue:1291-1295`、`:1456` |
| 安卓 / iOS 阅读方按 SDK `readReceiptInfo.isReceiptRequestMessage` 判定，**不限消息类型、不看 extra** | `ConversationFragment.java:3554-3559`、`ZXRCIMBaseChatController.m:1108-1113` |
| iOS 阅读方有三个触发点：`viewWillAppear` / 退到后台 / 融云重连 | `ZXRCIMBaseChatController.m:151`、`+Notification.m:496,512` |
| `shouldRequestGroupReadReceipt` 与 `setNeedReceipt` 是两套独立判定，大群 @所有人 时前者放行、后者不登记 | `messageService.js:295-318` vs `storeModule/index.js:116-151` |
| `send-box.vue` 的 10 人上限**是产品需求**，>10 人群 @所有人 不显示已读属预期行为，**不修** | `send-box.vue:1597-1605` |
| `RongIMClient.init(AppKey)` 未传 options，`readReceiptTimeout` 取默认 1 天（SDK 上限 15 天） | `IMSDKServer.js:11` |
| `switch` 里 `case ReadReceiptResponseMessage` 重复出现，第一组缺 `break` | `ReceiveMessageListener.js:246-264` |
| `SyncReadStatusMessage` 发送时传 `content: syncContent`（已是消息实例），`Message.send` 再 `new MessageObject(sourceMsg.content)` → payload 多包一层 | `messageService.js:545-553`；`MessageModel.js:212`；adapter `QL()` |
| `datasyn/getReadMessage` 返回 `[{accountId, msgUID, msgTimestamp, chatType, targetId, readTimestamp}]`，接口注释明确支持 `chatType: 2`（群聊） | `messageService.js:946-969`；安卓 `HistoryChatMessageZhiXinServerInterface.java:63-69`；iOS `ZXConversationLogic.m:365-370` |
| PC 目前只在私聊调用它，`chatType: 1` 写死，且 reduce 时丢掉 `accountId` | `msg-list.vue:1265-1280` |

**唯一未验证项**：`chatType: 2` 的返回是否含按人明细（同一 `msgUID` 多条不同 `accountId`）。
Task 6 的实现步骤里包含一次性探测，代码按「有明细 / 无明细」两条分支兼容，**不阻塞其余任务**。

---

## File Structure

- **Create** `apps/desktop/src/renderer/components/chitchat/read-receipt/readStateModel.js` — 无依赖纯逻辑：已读时间合并、私聊已读判定、群回执候选筛选、群已读名单合并、服务端返回归一化。
- **Create** `apps/desktop/src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js` — 上述纯逻辑的 vitest 单测。
- **Create** `apps/desktop/src/renderer/components/chitchat/read-receipt/receiptMetrics.js` — 可观测计数器（内存 + 可导出）。
- **Create** `context/features/20260824-3端-私聊群聊已读回执不翻转排查/acceptance.md` — 上线前验收用例（Task 8 产出）。
- **Modify** `apps/desktop/src/renderer/store/module/storeModule/index.js` — 已读册子改按需加载；`setGroupReceipt` 放宽；`setNeedReceipt` 与请求判定共用纯函数。
- **Modify** `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue` — 私聊显示去门槛、私聊回执去 `isFirstScreen`、群回执口径放宽 + 补触发点、群已读合并服务端。
- **Modify** `apps/desktop/src/renderer/service/messageService.js` — `getReadMessage` 支持群聊；`shouldRequestGroupReadReceipt` 改调纯函数；修 `SyncReadStatusMessage` 包装；接入计数器。
- **Modify** `apps/desktop/src/renderer/WebIM/IMSDKServer.js:11` — `init` 传 `readReceiptTimeout`。
- **Modify** `apps/desktop/src/renderer/WebIM/ReceiveMessageListener.js:246-264` — 修 `switch` 重复 case 与缺失 `break`；接入计数器。
- **Modify** `apps/desktop/src/renderer/WebIM/message/MessageModel.js:65-85` — 补 `RC:RRReqMsg` / `RC:SRSMsg` 反向映射。

---

### Task 0: 切分支

**Files:** 无

**Interfaces:**
- Consumes: 无
- Produces: 分支 `fix/pc-read-receipt-hardening`

- [ ] **Step 1: 确认工作区干净度并从 release 切分支**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git status --short
git fetch origin release
git checkout -b fix/pc-read-receipt-hardening origin/release
git status --short
git log --oneline -1
```

预期：
- 切换前后 `git status --short` **都只显示** `.env.test`、`electron-builder.yml`、`package.json` 三行 `M`
  （这三个文件在 release 与 feat/gfm-markdown 之间无差异，本地修改会平滑带过）
- `git log --oneline -1` 显示 `613af430 Merge branch 'master-3.4.25' into 'release'` 或更新的 release tip

**这三个文件是 PC 打包本地配置，本计划全程不得 `git add`。** 若切换时报冲突或出现其它改动，先停下来问，不要强切。

- [ ] **Step 2: 核对基线行号**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
grep -n "if (!this.isFirstScreen || this.showDownMsg)" src/renderer/components/chitchat/message/msg-list.vue
grep -n "RongIMLib.RongIMClient.init(AppKey)" src/renderer/WebIM/IMSDKServer.js
grep -n "Object.keys(needReadTimeMap).length === 0" src/renderer/store/module/storeModule/index.js
```

预期三条都能命中，行号分别接近 `2587`、`11`、`141`。
**若任何一条命中不到，立即停止并报告**——说明基线与计划不符，后续任务的行号引用需要重新核对。

---

### Task 1: 纯逻辑模块 —— 已读时间合并与私聊已读判定

**Files:**
- Create: `apps/desktop/src/renderer/components/chitchat/read-receipt/readStateModel.js`
- Test: `apps/desktop/src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `mergeReadTime(...times) -> number`
  - `resolvePrivateReadTime({ msgReadTime, innerReadTime, sentDate, messageUId }) -> number`

- [ ] **Step 1: 写失败的测试**

创建 `apps/desktop/src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js`：

```js
import { describe, it, expect } from "vitest";
import {
  mergeReadTime,
  resolvePrivateReadTime,
} from "../readStateModel.js";

describe("mergeReadTime", () => {
  it("全部无效时返回 0", () => {
    expect(mergeReadTime()).toBe(0);
    expect(mergeReadTime(null, undefined, 0, NaN, "")).toBe(0);
  });

  it("取最大值", () => {
    expect(mergeReadTime(100, 300, 200)).toBe(300);
  });

  it("字符串时间戳按数字比较", () => {
    expect(mergeReadTime("1787557547548", 100)).toBe(1787557547548);
  });

  it("忽略负数与非法值", () => {
    expect(mergeReadTime(-5, "abc", 42)).toBe(42);
  });
});

describe("resolvePrivateReadTime", () => {
  const messageUId = "D06A-QLT4-6PUD-03B4";
  const sentDate = "20260806";

  it("本地册子有记录时取该值", () => {
    const t = resolvePrivateReadTime({
      msgReadTime: { [sentDate]: { [messageUId]: 500 } },
      innerReadTime: {},
      sentDate,
      messageUId,
    });
    expect(t).toBe(500);
  });

  it("册子整册缺失时，服务端兜底仍然生效（本次修复的核心）", () => {
    const t = resolvePrivateReadTime({
      msgReadTime: {},
      innerReadTime: { [messageUId]: 900 },
      sentDate,
      messageUId,
    });
    expect(t).toBe(900);
  });

  it("两个源都有时取较大者", () => {
    const t = resolvePrivateReadTime({
      msgReadTime: { [sentDate]: { [messageUId]: 500 } },
      innerReadTime: { [messageUId]: 900 },
      sentDate,
      messageUId,
    });
    expect(t).toBe(900);
  });

  it("两个源都没有时返回 0", () => {
    const t = resolvePrivateReadTime({
      msgReadTime: {},
      innerReadTime: {},
      sentDate,
      messageUId,
    });
    expect(t).toBe(0);
  });

  it("入参缺失不抛异常", () => {
    expect(resolvePrivateReadTime({})).toBe(0);
    expect(resolvePrivateReadTime()).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js
```

预期：FAIL，报错为找不到模块 `../readStateModel.js`。

- [ ] **Step 3: 写最小实现**

创建 `apps/desktop/src/renderer/components/chitchat/read-receipt/readStateModel.js`：

```js
/**
 * 已读状态纯逻辑模块。
 *
 * 两条不变式：
 * 1. 单调性——已读只增不减，任何源报了已读就不再回退成未读。
 * 2. 多源合并——本地缓存 / 融云 / 服务端任一有记录即算已读，时间取最大值。
 *
 * 本文件不依赖 Vue / Vuex / electron-store，可独立单测。
 * 注意：apps/desktop 禁止使用可选链与空值合并，一律 && 兜底。
 */

/**
 * 合并多个已读时间，取最大的有效值。
 * @param {...(number|string)} times 任意个候选时间戳
 * @returns {number} 最大有效时间戳，全部无效时返回 0
 */
export function mergeReadTime() {
  let max = 0;
  for (let i = 0; i < arguments.length; i++) {
    const n = Number(arguments[i]);
    if (!isNaN(n) && n > max) {
      max = n;
    }
  }
  return max;
}

/**
 * 私聊：解析某条消息的已读时间。
 *
 * 修复要点——旧实现把服务端兜底 innerReadTime 也挂在
 * `msgReadTime[sentDate] &&` 后面，导致本地册子整册缺失时（超出加载窗口的日期），
 * 服务端明明有数据也取不到。这里两个源彼此独立。
 *
 * @param {Object} params
 * @param {Object} params.msgReadTime   本地已读册子 { 'YYYYMMDD': { messageUId: readTime } }
 * @param {Object} params.innerReadTime 服务端已读时间 { messageUId: readTime }
 * @param {string} params.sentDate      消息发送日期 'YYYYMMDD'
 * @param {string} params.messageUId    消息唯一 Id
 * @returns {number} 已读时间戳，未读返回 0
 */
export function resolvePrivateReadTime(params) {
  const p = params || {};
  const msgReadTime = p.msgReadTime || {};
  const innerReadTime = p.innerReadTime || {};
  const sentDate = p.sentDate;
  const messageUId = p.messageUId;
  if (!messageUId) {
    return 0;
  }
  const dateBucket = (sentDate && msgReadTime[sentDate]) || {};
  const localTime = dateBucket[messageUId];
  const serverTime = innerReadTime[messageUId];
  return mergeReadTime(localTime, serverTime);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js
```

预期：PASS，10 个用例全绿。

- [ ] **Step 5: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/read-receipt/readStateModel.js src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js
git commit -m "feat(receipt): 新增已读状态纯逻辑模块，私聊已读时间多源合并"
```

---

### Task 2: 纯逻辑模块 —— 群回执候选筛选与名单合并

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/read-receipt/readStateModel.js`
- Modify: `apps/desktop/src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js`

**Interfaces:**
- Consumes: `mergeReadTime` (Task 1)
- Produces:
  - `isAgentOrRobotId(userId) -> boolean`
  - `pickGroupReceiptCandidates(messageList) -> Array<Object>`
  - `buildReceiptMessageDic(candidates) -> Object`
  - `mergeGroupReceiptEntry(localEntry, serverEntry) -> Object`

- [ ] **Step 1: 追加失败的测试**

在 `tests/readStateModel.test.js` 顶部 import 补上新函数：

```js
import {
  mergeReadTime,
  resolvePrivateReadTime,
  isAgentOrRobotId,
  pickGroupReceiptCandidates,
  buildReceiptMessageDic,
  mergeGroupReceiptEntry,
} from "../readStateModel.js";
```

文件末尾追加：

```js
describe("isAgentOrRobotId", () => {
  it("识别机器人与智能体前缀", () => {
    expect(isAgentOrRobotId("robot_123")).toBe(true);
    expect(isAgentOrRobotId("ga_456")).toBe(true);
    expect(isAgentOrRobotId("1478260773032583169")).toBe(false);
    expect(isAgentOrRobotId(null)).toBe(false);
    expect(isAgentOrRobotId(123)).toBe(false);
  });
});

describe("pickGroupReceiptCandidates", () => {
  const 基础 = {
    bySelf: false,
    messageUId: "UID-1",
    sentTime: 1787000000000,
    senderUserId: "u1",
    messageType: "TextMessage",
    isLocalMessage: false,
    content: { extra: { atUserList: [] } },
  };

  it("放行普通文本消息", () => {
    expect(pickGroupReceiptCandidates([基础]).length).toBe(1);
  });

  it("放行 extra 为空的消息（旧实现会漏掉，本次修复的核心）", () => {
    const m = Object.assign({}, 基础, { messageUId: "UID-2", content: {} });
    expect(pickGroupReceiptCandidates([m]).length).toBe(1);
  });

  it("放行非文本/引用类型的消息（旧实现会漏掉）", () => {
    const m = Object.assign({}, 基础, {
      messageUId: "UID-3",
      messageType: "ZXActionCardMsg",
    });
    expect(pickGroupReceiptCandidates([m]).length).toBe(1);
  });

  it("排除自己发的", () => {
    const m = Object.assign({}, 基础, { bySelf: true });
    expect(pickGroupReceiptCandidates([m]).length).toBe(0);
  });

  it("排除本地消息、无 messageUId、无 sentTime", () => {
    const a = Object.assign({}, 基础, { isLocalMessage: true });
    const b = Object.assign({}, 基础, { messageUId: "" });
    const c = Object.assign({}, 基础, { sentTime: 0 });
    expect(pickGroupReceiptCandidates([a, b, c]).length).toBe(0);
  });

  it("排除机器人与智能体发的", () => {
    const a = Object.assign({}, 基础, { senderUserId: "robot_1" });
    const b = Object.assign({}, 基础, { senderUserId: "ga_1" });
    expect(pickGroupReceiptCandidates([a, b]).length).toBe(0);
  });

  it("按 messageUId 去重", () => {
    expect(pickGroupReceiptCandidates([基础, 基础]).length).toBe(1);
  });

  it("空输入不抛异常", () => {
    expect(pickGroupReceiptCandidates()).toEqual([]);
    expect(pickGroupReceiptCandidates(null)).toEqual([]);
  });
});

describe("buildReceiptMessageDic", () => {
  it("按原始发送者分组", () => {
    const dic = buildReceiptMessageDic([
      { senderUserId: "u1", messageUId: "A" },
      { senderUserId: "u1", messageUId: "B" },
      { senderUserId: "u2", messageUId: "C" },
    ]);
    expect(dic).toEqual({ u1: ["A", "B"], u2: ["C"] });
  });

  it("跳过缺字段的项", () => {
    const dic = buildReceiptMessageDic([
      { senderUserId: "", messageUId: "A" },
      { senderUserId: "u1", messageUId: "" },
    ]);
    expect(dic).toEqual({});
  });
});

describe("mergeGroupReceiptEntry", () => {
  it("服务端有、本地为 0 时以服务端为准", () => {
    const r = mergeGroupReceiptEntry({ u1: 0 }, { u1: 900 });
    expect(r).toEqual({ u1: 900 });
  });

  it("本地有、服务端无时保留本地（单调性）", () => {
    const r = mergeGroupReceiptEntry({ u1: 500 }, {});
    expect(r).toEqual({ u1: 500 });
  });

  it("两边都有时取较大者", () => {
    const r = mergeGroupReceiptEntry({ u1: 500 }, { u1: 900 });
    expect(r).toEqual({ u1: 900 });
  });

  it("服务端多出的读者不加入名单（名单由发送方登记决定）", () => {
    const r = mergeGroupReceiptEntry({ u1: 0 }, { u1: 900, u2: 800 });
    expect(r).toEqual({ u1: 900 });
  });

  it("本地名单缺失时返回空对象", () => {
    expect(mergeGroupReceiptEntry(null, { u1: 900 })).toEqual({});
    expect(mergeGroupReceiptEntry()).toEqual({});
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js
```

预期：FAIL，报 `isAgentOrRobotId is not a function` 等。

- [ ] **Step 3: 追加实现**

在 `readStateModel.js` 末尾追加：

```js
/**
 * 是否机器人 / 智能体账号。这类账号不参与已读回执。
 * @param {string} userId
 * @returns {boolean}
 */
export function isAgentOrRobotId(userId) {
  return (
    typeof userId === "string" &&
    (userId.indexOf("robot_") === 0 || userId.indexOf("ga_") === 0)
  );
}

/**
 * 群聊：从消息列表里挑出「我应当回执」的消息。
 *
 * 修复要点——旧实现额外要求 messageType ∈ {TextMessage, ReferenceMessage}
 * 且 content.extra 非空，比安卓 / iOS 窄得多（那两端按 SDK 的
 * readReceiptInfo 判定，不限类型也不看 extra）。这里对齐两端口径，
 * 只保留「别人发的真人消息」这一条语义约束。
 *
 * @param {Array<Object>} messageList 已渲染的消息列表
 * @returns {Array<Object>} 去重后的候选消息
 */
export function pickGroupReceiptCandidates(messageList) {
  const list = messageList || [];
  const seen = {};
  const result = [];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (!m || m.bySelf || !m.messageUId || !m.sentTime) {
      continue;
    }
    if (m.isLocalMessage) {
      continue;
    }
    if (isAgentOrRobotId(m.senderUserId)) {
      continue;
    }
    if (seen[m.messageUId]) {
      continue;
    }
    seen[m.messageUId] = true;
    result.push(m);
  }
  return result;
}

/**
 * 按原始发送者分组，构造融云 RC:RRRspMsg 的 receiptMessageDic。
 * @param {Array<Object>} candidates pickGroupReceiptCandidates 的输出
 * @returns {Object} { senderUserId: [messageUId, ...] }
 */
export function buildReceiptMessageDic(candidates) {
  const list = candidates || [];
  const dic = {};
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (!m || !m.senderUserId || !m.messageUId) {
      continue;
    }
    if (!dic[m.senderUserId]) {
      dic[m.senderUserId] = [];
    }
    dic[m.senderUserId].push(m.messageUId);
  }
  return dic;
}

/**
 * 群聊：合并一条消息的本地已读名单与服务端已读明细。
 *
 * 名单的「有哪些人」由发送方登记决定（本地），服务端只用来补时间。
 * 服务端多出的读者不加入名单——避免把非 @ 对象算进「需已读人数」的分母。
 * 单调：本地已有的时间不会被服务端的更小值覆盖。
 *
 * @param {Object} localEntry  { userId: 0|readTime }
 * @param {Object} serverEntry { userId: readTime }
 * @returns {Object} 合并后的名单
 */
export function mergeGroupReceiptEntry(localEntry, serverEntry) {
  const local = localEntry || {};
  const server = serverEntry || {};
  const merged = {};
  const keys = Object.keys(local);
  for (let i = 0; i < keys.length; i++) {
    const userId = keys[i];
    merged[userId] = mergeReadTime(local[userId], server[userId]);
  }
  return merged;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js
```

预期：PASS，全部用例绿（含 Task 1 的 10 条）。

- [ ] **Step 5: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/read-receipt/
git commit -m "feat(receipt): 群回执候选筛选与名单合并纯逻辑，口径对齐安卓/iOS"
```

---

### Task 3: 纯逻辑模块 —— 服务端已读返回归一化

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/read-receipt/readStateModel.js`
- Modify: `apps/desktop/src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js`

**Interfaces:**
- Consumes: `mergeReadTime` (Task 1)
- Produces:
  - `normalizeServerReadList(list) -> { byMessageMax: Object, byMessageUser: Object, hasPerUserDetail: boolean }`

- [ ] **Step 1: 追加失败的测试**

import 补 `normalizeServerReadList`，文件末尾追加：

```js
describe("normalizeServerReadList", () => {
  it("空输入返回空结构且标记无明细", () => {
    const r = normalizeServerReadList();
    expect(r.byMessageMax).toEqual({});
    expect(r.byMessageUser).toEqual({});
    expect(r.hasPerUserDetail).toBe(false);
  });

  it("私聊形态：按 msgUID 聚合最大已读时间", () => {
    const r = normalizeServerReadList([
      { msgUID: "A", readTimestamp: "500" },
      { msgUID: "A", readTimestamp: "900" },
      { msgUID: "B", readTimestamp: 300 },
    ]);
    expect(r.byMessageMax).toEqual({ A: 900, B: 300 });
  });

  it("群聊形态：带 accountId 时同时产出按人明细", () => {
    const r = normalizeServerReadList([
      { msgUID: "A", accountId: "u1", readTimestamp: 500 },
      { msgUID: "A", accountId: "u2", readTimestamp: 900 },
    ]);
    expect(r.hasPerUserDetail).toBe(true);
    expect(r.byMessageUser).toEqual({ A: { u1: 500, u2: 900 } });
    expect(r.byMessageMax).toEqual({ A: 900 });
  });

  it("兼容后端把字段写成 readMsgUID 的情况", () => {
    const r = normalizeServerReadList([
      { readMsgUID: "A", readTimestamp: 700 },
    ]);
    expect(r.byMessageMax).toEqual({ A: 700 });
  });

  it("跳过缺 msgUID 或 readTimestamp 无效的项", () => {
    const r = normalizeServerReadList([
      { accountId: "u1", readTimestamp: 500 },
      { msgUID: "B", readTimestamp: "abc" },
      { msgUID: "C", readTimestamp: 0 },
    ]);
    expect(r.byMessageMax).toEqual({});
  });

  it("同一 msgUID 只有一个 accountId 时也算有明细", () => {
    const r = normalizeServerReadList([
      { msgUID: "A", accountId: "u1", readTimestamp: 500 },
    ]);
    expect(r.hasPerUserDetail).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js
```

预期：FAIL，报 `normalizeServerReadList is not a function`。

- [ ] **Step 3: 追加实现**

在 `readStateModel.js` 末尾追加：

```js
/**
 * 归一化 datasyn/getReadMessage 的返回。
 *
 * 返回项形如 { accountId, msgUID, msgTimestamp, chatType, targetId, readTimestamp }。
 * 私聊只关心「这条消息什么时候被读」，群聊还需要「被谁读」。
 * 服务端 chatType:2 是否真的下发按人明细尚未实测，
 * 这里用 hasPerUserDetail 标记，调用方据此决定群聊那半边用不用得上。
 *
 * @param {Array<Object>} list 接口返回的数组
 * @returns {{ byMessageMax: Object, byMessageUser: Object, hasPerUserDetail: boolean }}
 */
export function normalizeServerReadList(list) {
  const rows = list || [];
  const byMessageMax = {};
  const byMessageUser = {};
  let hasPerUserDetail = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) {
      continue;
    }
    const msgUId = row.msgUID || row.readMsgUID;
    const readTime = Number(row.readTimestamp);
    if (!msgUId || isNaN(readTime) || readTime <= 0) {
      continue;
    }
    byMessageMax[msgUId] = mergeReadTime(byMessageMax[msgUId], readTime);

    const accountId = row.accountId;
    if (accountId) {
      hasPerUserDetail = true;
      if (!byMessageUser[msgUId]) {
        byMessageUser[msgUId] = {};
      }
      byMessageUser[msgUId][accountId] = mergeReadTime(
        byMessageUser[msgUId][accountId],
        readTime
      );
    }
  }

  return { byMessageMax, byMessageUser, hasPerUserDetail };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readStateModel.test.js
```

预期：PASS。

- [ ] **Step 5: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/read-receipt/
git commit -m "feat(receipt): 服务端已读返回归一化，兼容有无按人明细两种形态"
```

---

### Task 4: 可观测计数器

没有它，加固版上线后若仍有反馈，分不清是「没修对」还是「修漏了」。

**Files:**
- Create: `apps/desktop/src/renderer/components/chitchat/read-receipt/receiptMetrics.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `bump(key)` — 计数 +1
  - `snapshot() -> Object` — 取当前计数快照
  - `dump()` — 打印到 console
  - 全局挂载 `window.__receiptMetrics`

- [ ] **Step 1: 写实现**

创建 `apps/desktop/src/renderer/components/chitchat/read-receipt/receiptMetrics.js`：

```js
/**
 * 已读回执可观测计数器。
 *
 * 纯内存，不落盘、不上报。出问题时让用户在开发者工具执行
 * `window.__receiptMetrics.dump()` 导出，用来区分
 * 「回执没发出去」「发了但没收到」「收到了但被丢弃」三种情况。
 */

const counters = {
  privateReceiptSent: 0, // 私聊已读通知发出
  privateReceiptSkippedAgent: 0, // 私聊跳过（智能体/机器人）
  privateReceiptBlocked: 0, // 私聊被门槛拦下（showDownMsg）
  groupReceiptSent: 0, // 群回执响应发出
  groupReceiptCandidates: 0, // 群回执候选消息条数
  groupRespReceived: 0, // 收到群回执响应
  groupRespEmptyForMe: 0, // 收到但 receiptMessageDic[我] 为空
  groupRespDroppedUnregistered: 0, // 收到但该消息未登记，被丢弃
  groupRespApplied: 0, // 收到并成功写入名单
  serverReadFetched: 0, // 服务端已读拉取成功次数
  serverReadRowsPrivate: 0, // 服务端私聊已读条数
  serverReadRowsGroup: 0, // 服务端群聊已读条数
};

/**
 * 计数 +1。key 不在表里时静默忽略，避免打错字造成脏数据。
 * @param {string} key
 * @param {number} step 默认 1
 */
export function bump(key, step) {
  if (Object.prototype.hasOwnProperty.call(counters, key)) {
    counters[key] += typeof step === "number" ? step : 1;
  }
}

/**
 * 取当前计数快照（浅拷贝）。
 * @returns {Object}
 */
export function snapshot() {
  return Object.assign({}, counters);
}

/**
 * 打印到 console，方便用户截图或复制。
 */
export function dump() {
  const snap = snapshot();
  console.table(snap);
  return snap;
}

if (typeof window !== "undefined") {
  window.__receiptMetrics = { snapshot, dump, bump };
}

export default { bump, snapshot, dump };
```

- [ ] **Step 2: 确认 lint 通过**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx eslint src/renderer/components/chitchat/read-receipt/receiptMetrics.js
```

预期：无输出（无 error）。

- [ ] **Step 3: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/read-receipt/receiptMetrics.js
git commit -m "feat(receipt): 新增回执可观测计数器，挂 window.__receiptMetrics"
```

---

### Task 5: 私聊显示去门槛 + 已读册子按需加载

**Files:**
- Modify: `apps/desktop/src/renderer/store/module/storeModule/index.js:30-51`
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue:2974-2978`

**Interfaces:**
- Consumes: `resolvePrivateReadTime` (Task 1)
- Produces: mutation `electronStore/ensureReadTimeDates`，接收 `{ accountId, dates: string[] }`

- [ ] **Step 1: 在 storeModule 增加按需加载 mutation**

`src/renderer/store/module/storeModule/index.js`，在 `refreshReadTime` mutation 之后（约第 84 行）插入：

```js
    /**
     * 按需补载已读册子。
     *
     * refreshReadTimeState 只预载「前天/昨天/今天/明天」四册，
     * 超出这个窗口的日期在 chatReadTime 里连 key 都没有，
     * 导致 getStatusText 里 `msgReadTime[sentDate] &&` 直接短路。
     * 这里让消息列表把实际用到的日期报上来，缺哪册补哪册。
     */
    ensureReadTimeDates(state, { accountId, dates }) {
      const list = dates || [];
      for (let i = 0; i < list.length; i++) {
        const date = list[i];
        if (!date || state.chatReadTime[date]) {
          continue;
        }
        Vue.set(
          state.chatReadTime,
          date,
          getDateReadTime({ date, accountId })
        );
      }
    },
```

- [ ] **Step 2: 在 msg-list 里改已读时间解析**

`src/renderer/components/chitchat/message/msg-list.vue`，在 `<script>` 的 import 区（约第 653 行 `getSortList` 那组 import 之后）加入：

```js
import {
  resolvePrivateReadTime,
  pickGroupReceiptCandidates,
  buildReceiptMessageDic,
} from "../read-receipt/readStateModel.js";
import receiptMetrics from "../read-receipt/receiptMetrics.js";
```

然后把 `getStatusText` 里这段（原 `:2974-2988`）：

```js
      let storeReadTime =
        this.msgReadTime[data.sentDate] &&
        this.msgReadTime[data.sentDate][data.messageUId];
      let compInnerReadTime =
        this.msgReadTime[data.sentDate] && this.innerReadTime[data.messageUId];
      let readTime = 0;
      //取最大的一个
      if (compInnerReadTime) {
        readTime = compInnerReadTime;
      }
      if (storeReadTime) {
        if (readTime < storeReadTime) {
          readTime = storeReadTime;
        }
      }
```

整段替换为：

```js
      // 已读时间多源合并：本地册子与服务端兜底彼此独立，
      // 册子整册缺失（超出预载窗口的日期）时服务端数据仍然生效。
      const readTime = resolvePrivateReadTime({
        msgReadTime: this.msgReadTime,
        innerReadTime: this.innerReadTime,
        sentDate: data.sentDate,
        messageUId: data.messageUId,
      });
```

- [ ] **Step 3: 消息条数变化时补载册子**

`Messages` watcher 是 `deep: true`，每次消息内容变动都会触发，不适合挂 O(n) 循环。
挂到 `msgLength` watcher 上——它只在**条数**变化时触发，而条数变化正是「有新消息进入列表」的时刻。

新增方法（放在 `methods` 里）：

```js
    /**
     * 把列表里实际出现的发送日期报给 store，缺的已读册子按需补载。
     * refreshReadTimeState 只预载四册，超窗口的日期在 chatReadTime 里连 key 都没有，
     * 会让 getStatusText 的已读判定直接短路。
     */
    ensureReadTimeDatesForList() {
      const list = this.messageList || [];
      if (!list.length) {
        return;
      }
      const dates = {};
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m && m.bySelf && m.sentDate) {
          dates[m.sentDate] = true;
        }
      }
      const dateList = Object.keys(dates);
      if (!dateList.length) {
        return;
      }
      this.$store.commit("electronStore/ensureReadTimeDates", {
        accountId: this.senderInfo.id,
        dates: dateList,
      });
    },
```

把 `msgLength` watcher（原 `:1291-1295`）改为：

```js
    msgLength(len) {
      if (len) {
        this.ensureReadTimeDatesForList();
        this.sendGroupReceiptMessage();
      }
    },
```

> `Messages` watcher（原 `:1281-1290`）**保持原样不动**，只负责维护 `msgLength`。

- [ ] **Step 4: 起应用验证**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run dev:test
```

打开一个有一周以上历史的私聊，往上翻到 5 天前自己发的消息。
开发者工具 Console 执行：

```js
const $s = document.querySelector('#app').__vue__.$store;
console.log('已加载册子:', Object.keys($s.state.electronStore.chatReadTime));
```

预期：输出里包含**列表里出现过的所有日期**，不再只有四册。
界面上老消息应显示「已读」且**带已读时间**（旧实现只有「已读」两字、无时间）。

- [ ] **Step 5: lint 并提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run lint
git add src/renderer/store/module/storeModule/index.js src/renderer/components/chitchat/message/msg-list.vue
git commit -m "fix(receipt): 私聊已读时间去掉日期册门槛，册子改按需补载"
```

---

### Task 6: 私聊回执去掉 isFirstScreen 门槛 + 补触发点

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue:2587-2589, 2621-2626`

**Interfaces:**
- Consumes: `receiptMetrics` (Task 4)
- Produces: 无

- [ ] **Step 1: 收窄门槛**

`msg-list.vue` 的 `ReadLastMessage`，把（原 `:2587-2589`）：

```js
      if (!this.isFirstScreen || this.showDownMsg) {
        return false;
      }
```

改为：

```js
      // 只保留 showDownMsg：它精确表示「下方有用户尚未看到的新消息」，
      // 此时把最新消息标已读会误报。
      // 原先还挡了 !isFirstScreen——但 isFirstScreen 在「从搜索/消息定位跳进
      // 会话中间」时也会置 false（:1954 的 order == 1 分支），
      // 那种场景用户确实看到了消息，却因此永不发已读回执。
      // 安卓（ConversationFragment.java:1393）与 iOS
      // （ZXRCIMBaseChatController.m:151）都没有等价门槛。
      if (this.showDownMsg) {
        receiptMetrics.bump("privateReceiptBlocked");
        return false;
      }
```

- [ ] **Step 2: 给发出与跳过两条路径打点**

同函数内，把（原 `:2618` 与 `:2621-2626`）这两处补上计数：

```js
            skippedAgentOnly = true;
            receiptMetrics.bump("privateReceiptSkippedAgent");
            continue;
          }
          this.$service.SendReadReceiptMessage({
            msg: message,
            conversationType,
            key: conversationId,
          });
          receiptMetrics.bump("privateReceiptSent");
          sentReceipt = true;
          break;
```

- [ ] **Step 3: 窗口重新可见时补发一次**

同文件 `mounted`（约 `:842-848`，`ipcRenderer.on("ReadReceiptMsgEvent", ...)` 附近）追加：

```js
    // 对齐 iOS 的触发点（viewWillAppear / 退到后台 / 融云重连）：
    // 窗口重新可见时补发一次已读，避免「切走再切回来」漏发。
    this.__onWindowFocusReadReceipt = () => {
      const dlg = this.OpenDialog;
      if (!dlg || !dlg.id) {
        return;
      }
      this.ReadLastMessage(
        this.messageList,
        dlg.id,
        dlg.conversationType,
        false,
        dlg.name
      );
    };
    window.addEventListener("focus", this.__onWindowFocusReadReceipt);
```

在 `beforeDestroy`（若无则新建）里移除：

```js
  beforeDestroy() {
    if (this.__onWindowFocusReadReceipt) {
      window.removeEventListener("focus", this.__onWindowFocusReadReceipt);
      this.__onWindowFocusReadReceipt = null;
    }
  },
```

> 若 `beforeDestroy` 已存在，把上面两行加进去，不要新增第二个同名钩子。

- [ ] **Step 4: 起应用验证**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run dev:test
```

用全局搜索跳进某个私聊的中间位置，看完不滚到底就切走。
Console 执行 `window.__receiptMetrics.dump()`，预期 `privateReceiptSent` ≥ 1、`privateReceiptBlocked` 为 0。

- [ ] **Step 5: lint 并提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run lint
git add src/renderer/components/chitchat/message/msg-list.vue
git commit -m "fix(receipt): 私聊已读去掉 isFirstScreen 门槛，补窗口聚焦触发点"
```

---

### Task 7: 群阅读方口径对齐安卓/iOS + 补触发点

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue:1291-1295, 1427-1464`

**Interfaces:**
- Consumes: `pickGroupReceiptCandidates`、`buildReceiptMessageDic` (Task 2)、`receiptMetrics` (Task 4)
- Produces: 无

- [ ] **Step 1: 替换筛选逻辑**

把 `sendGroupReceiptMessage`（原 `:1427-1464`）整个方法替换为：

```js
    sendGroupReceiptMessage() {
      if (
        this.OpenDialog.conversationType !==
        ConversationModel.IMConversationEnum.GROUP
      ) {
        return;
      }
      // 口径对齐安卓 / iOS：不限消息类型、不要求 extra 非空。
      // 旧实现只回执 TextMessage / ReferenceMessage 且 content.extra 非空，
      // 是三端里最窄的一档，会漏掉其它端发来的带 @ 的非文本消息。
      const candidates = pickGroupReceiptCandidates(this.messageList);
      if (!candidates.length) {
        return;
      }
      receiptMetrics.bump("groupReceiptCandidates", candidates.length);
      const receiptMessageDic = buildReceiptMessageDic(candidates);
      const targetId = candidates[0].targetId;
      clearTimeout(this.__groupReceiptTimer);
      this.__groupReceiptTimer = setTimeout(() => {
        this.$service.SendGroupReceiptMessageRes({
          targetId,
          receiptMessageDic,
        });
        receiptMetrics.bump("groupReceiptSent");
      }, 1000);
    },
```

- [ ] **Step 2: 补触发点**

`msgLength` watcher（原 `:1291-1295`）保留，另加一个会话切换触发。在 `OpenDialog` watcher 的 handler 里（原 `:1300` 的 `if (!oldVal || val.id !== oldVal.id) {` 块内）追加：

```js
          // 切换会话后补一次群回执：msgLength 可能没变化，
          // 光靠 msgLength watcher 会漏发。
          this.$nextTick(() => {
            this.sendGroupReceiptMessage();
          });
```

- [ ] **Step 3: 清理定时器**

在 Task 6 建立的 `beforeDestroy` 里追加：

```js
    if (this.__groupReceiptTimer) {
      clearTimeout(this.__groupReceiptTimer);
      this.__groupReceiptTimer = null;
    }
```

- [ ] **Step 4: 起应用验证**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run dev:test
```

让手机在群里发一条 @ 你的消息，PC 打开该群。
Console 执行 `window.__receiptMetrics.dump()`，预期 `groupReceiptCandidates` > 0 且 `groupReceiptSent` ≥ 1。
再到手机上确认那条消息的已读人数增加。

- [ ] **Step 5: lint 并提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run lint
git add src/renderer/components/chitchat/message/msg-list.vue
git commit -m "fix(receipt): 群回执口径对齐安卓/iOS，补会话切换触发点"
```

---

### Task 8: 群回执入库放宽 + 两处判定统一

**Files:**
- Modify: `apps/desktop/src/renderer/store/module/storeModule/index.js:153-182`
- Modify: `apps/desktop/src/renderer/store/module/messageModule/messageActions.js:172-196`

**Interfaces:**
- Consumes: `receiptMetrics` (Task 4)
- Produces: 无

- [ ] **Step 1: setGroupReceipt 去掉「值必须严格等于 0」的限制**

`storeModule/index.js`，把 `setGroupReceipt`（原 `:153-182`）方法体替换为：

```js
    setGroupReceipt(
      state,
      { accountId, groupId, senderUserId, sentTime, messageUIds }
    ) {
      if (!state.groupMessageNeedReceiptMap[groupId]) {
        return;
      }
      const groupStore = getGroupStore({ accountId, groupId });
      if (!state.groupMessageReceiptMap[groupId]) {
        state.groupMessageReceiptMap[groupId] = groupStore.store;
      }
      const groupReadState = state.groupMessageReceiptMap[groupId];
      const ids = messageUIds || [];
      for (let i = 0; i < ids.length; i++) {
        const msgUId = ids[i];
        if (!state.groupMessageNeedReceiptMap[groupId][msgUId]) {
          continue;
        }
        const msgState = groupReadState[msgUId];
        if (!msgState) {
          continue;
        }
        // 旧实现要求 msgState[senderUserId] === 0 才写入，
        // 读者不在名单里（undefined）时静默丢弃。这里放宽为
        // 「名单里有这个人 且 新时间更大」，满足单调性。
        const prev = Number(msgState[senderUserId]);
        const next = Number(sentTime);
        if (
          Object.prototype.hasOwnProperty.call(msgState, senderUserId) &&
          !isNaN(next) &&
          (isNaN(prev) || next > prev)
        ) {
          msgState[senderUserId] = next;
          Vue.set(groupReadState, msgUId, msgState);
          groupStore.set(msgUId, msgState);
        }
      }
    },
```

> 同时删掉原来那句 `state.groupMessageNeedReceiptMap[groupId][messageUIds] = sentTime;`——
> 它把整个数组当 key 用，写进去的是 `"A,B,C"` 这种脏 key，是笔误。

- [ ] **Step 2: 给回执接收路径打点**

`messageActions.js`，把 `HandleGroupMsgResp`（原 `:172-196`）替换为：

```js
  HandleGroupMsgResp({ commit, dispatch, getters }, { message }) {
    /**
     * 处理自己发送的群消息已读回执
     */
    receiptMetrics.bump("groupRespReceived");
    const dic =
      message.content && message.content.receiptMessageDic
        ? message.content.receiptMessageDic
        : null;
    const mine = dic ? dic[getters.GetSendUser.id] : null;
    if (!mine || !mine.length) {
      // 空数组也会走到这里：融云 SDK 收到 RC:RRRspMsg 时会把
      // receiptMessageDic[我的id] 重写为「本机存在 SENT 记录」的子集，
      // 本机没记录就变成空数组。
      receiptMetrics.bump("groupRespEmptyForMe");
      return;
    }
    receiptMetrics.bump("groupRespApplied");
    commit("READGROUPRECEIPTRESPONSE", {
      senderUserId: message.senderUserId,
      sentTime: message.sentTime,
      targetId: message.targetId,
      messageUids: mine,
    });
    commit("electronStore/setGroupReceipt", {
      accountId: getters.GetSendUser.id,
      groupId: message.targetId,
      senderUserId: message.senderUserId,
      sentTime: message.sentTime,
      messageUIds: mine,
    });
  },
```

同文件顶部 import 区追加：

```js
import receiptMetrics from "@/components/chitchat/read-receipt/receiptMetrics.js";
```

- [ ] **Step 3: 两处判定统一**

`messageService.js` 的 `shouldRequestGroupReadReceipt`（原 `:295-318`），在函数开头 `mentionedInfo.type === 1` 分支前插入注释与守卫：

```js
  shouldRequestGroupReadReceipt(msg) {
    if (!msg || !msg.content) return false;
    const mentionedInfo = msg.content.mentionedInfo;
    if (!mentionedInfo) return false;
    let extra = msg.content.extra;
    if (typeof extra === "string") {
      try {
        extra = JSON.parse(extra);
      } catch (e) {
        extra = null;
      }
    }
    // MentionedType.ALL === 1
    if (mentionedInfo.type === 1 || mentionedInfo.type === RongIMLib.MentionedType.ALL) {
      // @所有人：send-box.vue:1597-1605 对 >10 人的群不下发 atAllUserList，
      // 此时本机 setNeedReceipt 构造不出名单、不会登记，回执回来必然丢弃。
      // 这是产品需求（大群 @所有人 不显示已读），因此这里也不发回执请求，
      // 免得让对方端做一次注定被丢弃的回执。
      const hasAllList = !!(extra && extra.atAllUserList && extra.atAllUserList.length);
      return hasAllList;
    }
    if (!extra) return false;
    if (extra.atAllUserList && extra.atAllUserList.length) return true;
    const atUserList = extra.atUserList || [];
    return atUserList.some(({ atUserId }) => {
      if (!atUserId || typeof atUserId !== "string") return false;
      return !atUserId.startsWith("robot_") && !atUserId.startsWith("ga_");
    });
  },
```

- [ ] **Step 4: 起应用验证**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run dev:test
```

在一个 **>10 人的群**发 @所有人，Console 里应看不到「回执请求」日志（`messageService.js:336`）。
在一个 **≤10 人的群**发 @所有人，应看到该日志。

- [ ] **Step 5: lint 并提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run lint
git add src/renderer/store/module/storeModule/index.js src/renderer/store/module/messageModule/messageActions.js src/renderer/service/messageService.js
git commit -m "fix(receipt): 群回执入库放宽为单调更新，大群@所有人不发无用请求"
```

---

### Task 9: 三条一行改动

**Files:**
- Modify: `apps/desktop/src/renderer/WebIM/IMSDKServer.js:11`
- Modify: `apps/desktop/src/renderer/WebIM/ReceiveMessageListener.js:246-264`
- Modify: `apps/desktop/src/renderer/WebIM/message/MessageModel.js:65-85`
- Modify: `apps/desktop/src/renderer/service/messageService.js:545-553`

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: readReceiptTimeout 提到 15 天**

`IMSDKServer.js`，把：

```js
    RongIMLib.RongIMClient.init(AppKey);
```

改为：

```js
    // 群回执有效期，单位天，SDK 默认 1 天、上限 15 天
    // （adapter 内 Math.min(15, Math.max(readReceiptTimeout || 1, 1))）。
    // 超过窗口的回执请求与回执响应会被 SDK 直接丢弃，
    // 导致「对方隔天才看」或「PC 离线超过一天」时已读永不翻转。
    RongIMLib.RongIMClient.init(AppKey, null, { readReceiptTimeout: 15 });
```

- [ ] **Step 2: 修 switch 重复 case 与缺失 break**

`ReceiveMessageListener.js`，把原 `:246-264` 这段：

```js
      case MessageModel.MessageType.SyncReadStatusMessage:
      case MessageModel.MessageType.ReadReceiptMessage:
      case MessageModel.MessageType.ReadReceiptResponseMessage:
        store.dispatch("ReadReceiptMessage", { ... });
        if (message.senderUserId === store.getters.GetSendUser.id) {
          store.dispatch("UpdateReminderMap", { ... });
        }
      case MessageModel.MessageType.ReadReceiptResponseMessage:
        store.dispatch("HandleGroupMsgResp", { ... });
        break;
```

替换为：

```js
      case MessageModel.MessageType.SyncReadStatusMessage:
      case MessageModel.MessageType.ReadReceiptMessage:
        // 私聊已读通知 / 多端已读同步
        store.dispatch("ReadReceiptMessage", {
          message: MessageModel.Message.convertMsg(message),
        });
        if (message.senderUserId === store.getters.GetSendUser.id) {
          store.dispatch("UpdateReminderMap", {
            type: false,
            key: message.targetId,
            data: message,
            number: 0,
          });
        }
        break;
      case MessageModel.MessageType.ReadReceiptResponseMessage:
        // 群消息已读回执响应
        store.dispatch("HandleGroupMsgResp", {
          message: MessageModel.Message.convertMsg(message),
        });
        break;
```

> 原写法里 `ReadReceiptResponseMessage` 出现两次，且第一组没有 `break`，
> 导致 `RC:ReadNtf` / `RC:SRSMsg` 也会 fallthrough 进 `HandleGroupMsgResp`。
> 因该函数有判空守卫，实际无害，但语义是错的。

- [ ] **Step 3: 补消息类型反向映射**

`MessageModel.js` 的 `MsgObjectNameEnum`，在正向段（约 `:64`）补：

```js
  ReadReceiptRequestMessage: "RC:RRReqMsg", //群消息已读回执请求
  SyncReadStatusMessage: "RC:SRSMsg", //多端已读状态同步
```

在反向段（约 `:84`）补：

```js
  "RC:RRReqMsg": "ReadReceiptRequestMessage",
  "RC:SRSMsg": "SyncReadStatusMessage",
```

> 补上之后 `case MessageType.SyncReadStatusMessage` 才不再是死分支。

- [ ] **Step 4: 修 SyncReadStatusMessage 多包一层**

`messageService.js`，把（原 `:544-559`）：

```js
      let syncContent = new RongIMLib.SyncReadStatusMessage({
        lastMessageSendTime: msg.sentTime,
      });
      msgIntance
        .send({
          targetId: msg.targetId,
          content: syncContent,
          messageType: msgIntance.messageType.SyncReadStatusMessage,
          conversationType,
        })
```

改为：

```js
      // Message.send 内部会 new MessageObject(sourceMsg.content)，
      // 传消息实例会被再包一层（adapter 的 QL 把整个实例塞进 .content），
      // 导致下发的 RC:SRSMsg 里 lastMessageSendTime 落在第二层。
      // 这里直接传纯对象。
      msgIntance
        .send({
          targetId: msg.targetId,
          content: { lastMessageSendTime: msg.sentTime },
          messageType: msgIntance.messageType.SyncReadStatusMessage,
          conversationType,
        })
```

同时删掉上方已不再使用的 `let syncContent = ...` 声明。

- [ ] **Step 5: 起应用验证**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run dev:test
```

预期：登录正常、能收发消息、私聊已读正常翻转（说明 `init` 第三参没打乱 SDK 初始化）。

- [ ] **Step 6: lint 并提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run lint
git add src/renderer/WebIM/IMSDKServer.js src/renderer/WebIM/ReceiveMessageListener.js src/renderer/WebIM/message/MessageModel.js src/renderer/service/messageService.js
git commit -m "fix(receipt): 回执有效期提到15天，修 switch fallthrough、消息映射与 SRSMsg 包装"
```

---

### Task 10: 服务端权威源接入（含 chatType:2 探测）

**Files:**
- Modify: `apps/desktop/src/renderer/service/messageService.js:946-969`
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue:1255-1280, 1624-1636`

**Interfaces:**
- Consumes: `normalizeServerReadList`、`mergeGroupReceiptEntry` (Task 2/3)、`receiptMetrics` (Task 4)
- Produces: 组件 data `serverGroupReceipt`（`{ messageUId: { userId: readTime } }`）

- [ ] **Step 1: 接口层保留 accountId**

`messageService.js` 的 `getReadMessage`（原 `:946-969`），把 `.then` 改为直接返回原始数组（现在就是这样，无需改动），但补一行注释说明 `chatType` 取值：

```js
  /**
   * 会话级已读明细。chatType: 1=单聊、2=群聊（后端接口注释确认支持两者）。
   * 返回 [{ accountId, msgUID, msgTimestamp, chatType, targetId, readTimestamp }]。
   */
  getReadMessage({ targetId, chatType }, config = {}) {
```

- [ ] **Step 2: 私聊与群聊都拉服务端已读**

`msg-list.vue`，把 `privateTargetId` watcher（原 `:1265-1280`）替换为一个通用的会话已读拉取。在 `watch` 里把它改成：

```js
    privateTargetId: {
      immediate: true,
      handler(targetId) {
        if (!targetId) {
          return;
        }
        this.$service
          .getReadMessage({ targetId, chatType: 1 })
          .then((list) => {
            const normalized = normalizeServerReadList(list);
            this.innerReadTime = normalized.byMessageMax;
            receiptMetrics.bump("serverReadFetched");
            receiptMetrics.bump(
              "serverReadRowsPrivate",
              (list && list.length) || 0
            );
          })
          .catch(() => {});
      },
    },
```

并在 `groupId` watcher（原 `:1255-1264`）的 `if (id)` 分支里追加群聊拉取：

```js
    groupId: {
      immediate: true,
      handler(id) {
        if (id) {
          this.$nextTick().then(this.refreshGroupReceipt);
          this.fetchServerGroupReceipt(id);
        } else {
          this.groupReceipt = null;
          this.serverGroupReceipt = {};
        }
      },
    },
```

- [ ] **Step 3: 新增 data 与拉取方法**

`data()` 里（原 `:833-835` 附近）追加：

```js
      serverGroupReceipt: {}, // 服务端群已读明细 { messageUId: { userId: readTime } }
```

`methods` 里新增：

```js
    /**
     * 拉取群聊的服务端已读明细。
     *
     * datasyn/getReadMessage 的 chatType:2 是否真的下发按人明细（同一 msgUID
     * 多条不同 accountId）此前没实测过。normalizeServerReadList 会给出
     * hasPerUserDetail 标记：为 true 才用于合并群名单，为 false 则本次拉取
     * 对群聊无用，只打点不落地——功能退化为「仅本地回执」，不会更差。
     */
    fetchServerGroupReceipt(groupId) {
      if (!groupId) {
        return;
      }
      this.$service
        .getReadMessage({ targetId: groupId, chatType: 2 })
        .then((list) => {
          const normalized = normalizeServerReadList(list);
          receiptMetrics.bump("serverReadFetched");
          receiptMetrics.bump(
            "serverReadRowsGroup",
            (list && list.length) || 0
          );
          // 【一次性探测，Task 10 验收后可保留】
          console.log(
            "[receipt] 群已读服务端返回",
            "条数=", (list && list.length) || 0,
            "含按人明细=", normalized.hasPerUserDetail
          );
          if (normalized.hasPerUserDetail) {
            this.serverGroupReceipt = normalized.byMessageUser;
          } else {
            this.serverGroupReceipt = {};
          }
        })
        .catch(() => {
          this.serverGroupReceipt = {};
        });
    },
```

- [ ] **Step 4: 展示时合并两个源**

把 `getGroupNeedReadCount` / `getGroupHasReadCount`（原 `:2929-2935`）替换为：

```js
    /**
     * 取某条群消息合并后的已读名单：本地回执表 + 服务端明细，取时间较大者。
     * 名单成员由本地登记决定，服务端只补时间。
     */
    getMergedGroupReceipt(msg) {
      const local = this.groupReceipt && this.groupReceipt[msg.messageUId];
      const server = this.serverGroupReceipt[msg.messageUId];
      return mergeGroupReceiptEntry(local, server);
    },
    getGroupNeedReadCount(msg) {
      return Object.keys(this.getMergedGroupReceipt(msg)).length;
    },
    getGroupHasReadCount(msg) {
      const merged = this.getMergedGroupReceipt(msg);
      return Object.keys(merged).filter((k) => merged[k]).length;
    },
```

import 区补上 `normalizeServerReadList` 与 `mergeGroupReceiptEntry`：

```js
import {
  resolvePrivateReadTime,
  pickGroupReceiptCandidates,
  buildReceiptMessageDic,
  normalizeServerReadList,
  mergeGroupReceiptEntry,
} from "../read-receipt/readStateModel.js";
```

- [ ] **Step 5: 模板里的 msgReceipt 也走合并结果**

`msg-list.vue` 模板里有 4 处把原始 `groupReceipt` 直接传给子组件（原 `:339-341, 436-438, 454-456, 565-568`）：

```vue
                      :msgReceipt="
                        groupReceipt && groupReceipt[item.messageUId]
                      "
```

**四处全部**改为：

```vue
                      :msgReceipt="getMergedGroupReceipt(item)"
```

> 不改这里的话，「@某人 旁边的小图标」（`msgtype/msg-txt.vue:52-73`）仍然只看本地表，
> 服务端补回来的已读时间在图标上体现不出来，与「已读 N/M」文案对不上。

`getMergedGroupReceipt` 在名单为空时返回 `{}`，而 `{}` 是 truthy——
子组件里 `msgReceipt && msgReceipt[row.userId] === 0` 会因 `undefined === 0` 为 false 而不显示图标，
行为与原来 `msgReceipt` 为 undefined 时一致，不会多渲染出图标。

- [ ] **Step 6: 起应用，读一次探测结论**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run dev:test
```

打开任意群聊，Console 里应出现：

```
[receipt] 群已读服务端返回 条数= N 含按人明细= true/false
```

**把这个结论记到 `context/features/20260824-3端-私聊群聊已读回执不翻转排查/status.md` 的「实测进展」表里。**

- `含按人明细= true` → 群已读获得可重建的权威源，换机/清缓存后能恢复。
- `含按人明细= false` → 群聊那半边退化为「仅本地回执」，与改动前持平、不更差。
  此时在 status.md 记一条待办：需后端补群维度按人已读查询。

- [ ] **Step 7: lint 并提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run lint
git add src/renderer/service/messageService.js src/renderer/components/chitchat/message/msg-list.vue
git commit -m "feat(receipt): 接入服务端已读权威源，群聊按 chatType=2 拉取并合并"
```

---

### Task 11: 验收用例文档 + 收尾

**Files:**
- Create: `context/features/20260824-3端-私聊群聊已读回执不翻转排查/acceptance.md`
- Modify: `context/features/20260824-3端-私聊群聊已读回执不翻转排查/status.md`
- Modify: `context/features/20260824-3端-私聊群聊已读回执不翻转排查/impl-notes.md`

**Interfaces:**
- Consumes: 全部前置任务
- Produces: 可交付的上线前验收清单

- [ ] **Step 1: 跑全量单测**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/read-receipt/
```

预期：全绿。把实际条数记下来填进 status.md。

- [ ] **Step 2: 跑 lint**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run lint
```

预期：无 error。

- [ ] **Step 3: 确认提交禁忌文件未被 stage**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git status --short
git log --oneline origin/feat/gfm-markdown..HEAD --stat | grep -E "\.env\.test|electron-builder\.yml|package(-lock)?\.json" || echo "OK: 无禁忌文件"
```

预期：最后一行输出 `OK: 无禁忌文件`。若有命中，立即 `git rebase -i` 剔除。

- [ ] **Step 4: 写验收用例**

创建 `context/features/20260824-3端-私聊群聊已读回执不翻转排查/acceptance.md`，内容见本计划末尾的「附录：验收用例」，逐条抄进去。

- [ ] **Step 5: 更新 status.md 与 impl-notes.md**

- `status.md`：平台矩阵补一行「加固实施（Task 0~11）」desktop 列标 ✅；「实测进展」表补 Task 10 Step 5 的探测结论；「待办 / 阻塞」把已完成项划掉。
- `impl-notes.md`：写平台无关的逻辑提炼——已读状态的两条不变式（单调、多源合并）、三端阅读方口径差异、服务端已读接口的两种返回形态。供安卓 / iOS 后续对齐时参考。

- [ ] **Step 6: 提交 context**

```bash
cd /Users/nic/w/ai-dev-workspace
git add "context/features/20260824-3端-私聊群聊已读回执不翻转排查"
git commit -m "docs(3端已读回执): PC 加固实施完成，补验收用例与实现笔记"
```

---

## 附录：验收用例

抄进 `acceptance.md`。**全部通过才上线。**每条都记录实际结果，不要只打勾。

### 前置

- PC 装加固版（`npm run dev:test` 或测试包均可），手机装现网版本
- 至少两个账号：A 在 PC，B 在手机（iOS 或安卓）
- 准备一个 **≤10 人的群** 和一个 **>10 人的群**

### 一、私聊（6 条）

| # | 步骤 | 预期 |
|---|---|---|
| P1 | A 在 PC 发消息给 B，B 在手机打开会话看到 | A 侧 3 秒内显示「已读」并带时间 |
| P2 | B 在手机发消息给 A，A 在 PC 正常打开会话看到 | B 侧显示已读 |
| P3 | **A 在 PC 用全局搜索跳进该会话中间**，看完不滚到底就切走 | B 侧显示已读（**这条是修复重点，旧版会一直未读**） |
| P4 | A 在 PC 往上滚离开底部，B 发新消息，A 不滚回底部 | B 侧保持未读（**这条不能被"修坏"**，用户确实没看到） |
| P5 | A 翻到 5 天前自己发的消息 | 显示「已读」**且带已读时间**（旧版只有「已读」二字无时间） |
| P6 | A 退出 PC 客户端重开，重复 P5 | 结果与 P5 一致 |

### 二、群聊（7 条）

| # | 步骤 | 预期 |
|---|---|---|
| G1 | A 在 PC 的小群（≤10 人）发 @B 的纯文本，B 在手机看到 | A 侧「@B」旁小图标从未读变已读 |
| G2 | A 在 PC 的小群发 @所有人，B 在手机看到 | A 侧显示已读（与旧版一致） |
| G3 | A 在 PC 的**大群（>10 人）**发 @所有人 | 不显示已读标记（**符合产品需求**）；Console 里**不应**出现「回执请求」日志 |
| G4 | **B 在手机群里发 @A 的纯文本**，A 在 PC 打开该群看到 | B 侧已读人数 +1 |
| G5 | **B 在手机群里发 @A 的非纯文本**（引用消息 / 卡片等），A 在 PC 打开看到 | B 侧已读人数 +1（**这条是修复重点，旧版 PC 不回执**） |
| G6 | A 在 PC 从群 X 切到群 Y 再切回 X | 不报错；`window.__receiptMetrics.dump()` 里 `groupReceiptSent` 有增长 |
| G7 | A 在 PC 发 @B，B **隔天**再看（或把 B 设备时间调后一天） | A 侧已读翻转（旧版 1 天窗口会丢） |

### 三、回归（4 条）—— 确认没改坏

| # | 步骤 | 预期 |
|---|---|---|
| R1 | 收发文本 / 图片 / 文件 / 引用消息 | 全部正常 |
| R2 | 会话列表红点、未读数 | 与旧版一致 |
| R3 | 智能体 / 机器人会话 | 不发已读回执，不打 `readMessage`，本地角标正常清除 |
| R4 | 多窗口（独立会话窗口） | 已读显示与主窗口一致，不报错 |

### 四、可观测自检（1 条）

| # | 步骤 | 预期 |
|---|---|---|
| M1 | Console 执行 `window.__receiptMetrics.dump()` | 输出计数表；`groupRespEmptyForMe` 若持续增长，说明融云 SDK 的 SENT 记录本机化过滤在丢回执，需单独排查 |

### 上线判据

- 私聊 P1~P6 全过，其中 **P3 必须通过、P4 必须不被破坏**
- 群聊 G1~G7 全过，其中 **G5 是本次核心修复**
- 回归 R1~R4 无异常
- 单测全绿、`npm run lint` 无 error
- 提交里不含 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json`

### 上线后观察

发版后观察 **2 周**。若仍有「已读显示未读」反馈，让用户在 PC 上执行
`window.__receiptMetrics.dump()` 截图回传——计数分布能直接区分
「回执没发出去」「发了但没收到」「收到了但被丢弃」三种情况，不用再靠猜。

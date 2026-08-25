# PC 端已读兜底 —— 表态反推已读水位 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PC 端（`apps/desktop`）加一条不经过融云回执通道的已读推断层——对方表态、回复或在会话里发言，都反推出「他在那一刻打开着会话」，据此把该时刻之前我发的消息翻成已读。

**Architecture:** 三个纯函数模块（收集证据 → 合并成按人的单调水位表 → 判定某条消息是否落在水位内），加一个纯内存、不依赖 Vue 的水位仓库，最后在 `msg-list.vue` 上接一个喂入点和两个读出点（私聊文案、群聊名单）。全程只把「未读」翻成「已读」，不会反向。

**Tech Stack:** Electron 19 + Vue 2.7（Options API）+ Vuex 3 + vitest 2.0.5

## Global Constraints

以下约束对每个任务都生效，不再逐条重复：

- **禁止可选链 `?.` 与空值合并 `??`**，一律用 `&&` / `||` 兜底（`apps/desktop` 硬性规范）。
- **Vue 2.7 + Options API**，禁止引入 Vue 3 / Pinia / 组合式 API 库。
- **注释一律中文**。
- 缩进 2 空格、LF 换行、文件末尾留换行（`.editorconfig`）。
- **禁止 `npm install` / `pnpm install` / 删 `node_modules` 重装**。依赖已就绪，直接跑。
- 测试命令统一 `npx vitest run <路径>`（`npm test` 是 `vitest --ui` 交互式，不要在自动化里用）。
- **提交时绝不 `git add` 这四个文件**：`.env.test`、`electron-builder.yml`、`package.json`、`package-lock.json`。它们是本地调试配置，工作区里有改动属正常，不要还原也不要提交。用显式路径 `git add`，不要用 `git add -A` / `git add .`。
- 所有路径以 `apps/desktop/` 为根书写，命令均在 `apps/desktop` 目录下执行。

## File Structure

| 文件 | 职责 |
|---|---|
| `src/renderer/components/chitchat/read-receipt/readWatermarkModel.js`（新建） | 纯函数：从消息扩展取人、扫消息列表算水位、判定是否落在水位内。零框架依赖 |
| `src/renderer/components/chitchat/read-receipt/readWatermarkStore.js`（新建） | 纯内存水位仓库：会话级、按人、单调只增。零框架依赖，返回新对象供 Vue 赋值 |
| `src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js`（新建） | Model 单测 |
| `src/renderer/components/chitchat/read-receipt/tests/readWatermarkStore.test.js`（新建） | Store 单测 |
| `src/renderer/components/chitchat/message/msg-list.vue`（改） | 接线：喂入（2 个 watcher + 1 个 `msg-expansion-update` 事件订阅）+ 2 个读出点（私聊 `getStatusText`、群聊 `getMergedGroupReceipt`）+ 3 处模板绑定 |

**为什么水位表不用 Vue 的 `reactive`**：Vue 2 对「新增 key」不响应，用 `reactive` 就得处处 `set`。
改成纯对象仓库、`bumpWatermark` 返回一个**新对象**，`msg-list.vue` 整体赋给 data 字段即可触发重渲染——
仓库因此完全脱离 Vue，可在 node 环境裸跑单测。

---

## Task 0: 切分支

- [ ] **Step 1: 从 origin/release 切出工作分支**

当前工作区在 `fix/pc-read-receipt-hardening`（上一轮封存分支），工作区里有三个打包配置脏文件，**切分支时不要动它们**。

```bash
cd apps/desktop
git fetch origin release
git checkout -b feat/pc-read-watermark origin/release
```

- [ ] **Step 2: 确认基线干净**

```bash
git status --short
```

Expected：只有 `.env.test`、`electron-builder.yml`、`package.json` 三行 `M`（本地调试配置，不管它）。
若出现别的改动文件，先停下来问人，不要继续。

- [ ] **Step 3: 确认 read-receipt 目录不存在**

```bash
ls src/renderer/components/chitchat/read-receipt 2>&1
```

Expected：`No such file or directory`。该目录只存在于上一轮封存分支，本轮从零建。

---

## Task 1: 水位判定与证据提取（叶子纯函数）

**Files:**
- Create: `src/renderer/components/chitchat/read-receipt/readWatermarkModel.js`
- Test: `src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `isAgentOrRobotId(userId: string): boolean`
  - `extractExpansionReaders(expansionEntry: Object, excludeUserId: string): Array<string>`
  - `isReadByWatermark(sentTime: number, watermark: Object, userId: string): boolean`

**背景数据形状**（来自 `src/renderer/WebIM/MessageExpansionUtils.js`）：
`expansionDataMap[messageUId]` 形如 `{ prefix: [{ s: 账号Id, t: 时间戳 }, ...] }`。
表态的 prefix 是 emoji 字符（key 原文形如 `` `${emoji}_0` ``，被 `k.split("_")` 取首段），
回复的 prefix 是 `referInfo`。两者**数据结构完全一致**，所以不需要按前缀分支。
值已被该文件的 `parseMap` 做过 `JSON.parse`。

- [ ] **Step 1: 建目录并写失败的测试**

创建 `src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js`：

```js
import { describe, it, expect } from "vitest";
import {
  isAgentOrRobotId,
  extractExpansionReaders,
  isReadByWatermark,
} from "../readWatermarkModel";

describe("isAgentOrRobotId", () => {
  it("robot_ 与 ga_ 前缀算机器人/智能体", () => {
    expect(isAgentOrRobotId("robot_123")).toBe(true);
    expect(isAgentOrRobotId("ga_abc")).toBe(true);
  });

  it("普通账号与非字符串都不算", () => {
    expect(isAgentOrRobotId("u1001")).toBe(false);
    expect(isAgentOrRobotId(undefined)).toBe(false);
    expect(isAgentOrRobotId(123)).toBe(false);
  });
});

describe("extractExpansionReaders", () => {
  it("从表态前缀里取出表态人", () => {
    const entry = { "😀": [{ s: "u1", t: 100 }, { s: "u2", t: 200 }] };
    expect(extractExpansionReaders(entry, "me").sort()).toEqual(["u1", "u2"]);
  });

  it("回复前缀 referInfo 与表态走同一条路径", () => {
    const entry = { referInfo: [{ s: "u3", t: 300 }] };
    expect(extractExpansionReaders(entry, "me")).toEqual(["u3"]);
  });

  it("同一人在多个前缀里出现只返回一次", () => {
    const entry = {
      "😀": [{ s: "u1", t: 100 }],
      referInfo: [{ s: "u1", t: 900 }],
    };
    expect(extractExpansionReaders(entry, "me")).toEqual(["u1"]);
  });

  it("排除自己与机器人/智能体", () => {
    const entry = {
      "😀": [
        { s: "me", t: 100 },
        { s: "robot_1", t: 100 },
        { s: "ga_1", t: 100 },
        { s: "u1", t: 100 },
      ],
    };
    expect(extractExpansionReaders(entry, "me")).toEqual(["u1"]);
  });

  it("缺 t 照样返回人——水位不取 t，取被作用消息的 sentTime", () => {
    const entry = { "😀": [{ s: "u1" }] };
    expect(extractExpansionReaders(entry, "me")).toEqual(["u1"]);
  });

  it("脏数据不抛异常", () => {
    expect(extractExpansionReaders(undefined, "me")).toEqual([]);
    expect(extractExpansionReaders({}, "me")).toEqual([]);
    expect(extractExpansionReaders({ "😀": "not-an-array" }, "me")).toEqual([]);
    expect(extractExpansionReaders({ "😀": [null, {}, { t: 1 }] }, "me")).toEqual(
      []
    );
  });
});

describe("isReadByWatermark", () => {
  it("sentTime 小于水位算已读", () => {
    expect(isReadByWatermark(100, { u1: 200 }, "u1")).toBe(true);
  });

  it("sentTime 恰好等于水位算已读", () => {
    expect(isReadByWatermark(200, { u1: 200 }, "u1")).toBe(true);
  });

  it("sentTime 大于水位算未读", () => {
    expect(isReadByWatermark(300, { u1: 200 }, "u1")).toBe(false);
  });

  it("该人没有水位记录算未读", () => {
    expect(isReadByWatermark(100, { u2: 999 }, "u1")).toBe(false);
    expect(isReadByWatermark(100, {}, "u1")).toBe(false);
    expect(isReadByWatermark(100, undefined, "u1")).toBe(false);
  });

  it("sentTime 无效算未读", () => {
    expect(isReadByWatermark(0, { u1: 200 }, "u1")).toBe(false);
    expect(isReadByWatermark(undefined, { u1: 200 }, "u1")).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js
```

Expected：FAIL，报 `Failed to resolve import "../readWatermarkModel"`。

- [ ] **Step 3: 写实现**

创建 `src/renderer/components/chitchat/read-receipt/readWatermarkModel.js`：

```js
/**
 * 已读水位纯逻辑模块。
 *
 * 水位语义：watermark[U] = T 表示「U 在 T 时刻确实打开着这个会话」，
 * 于是我发的任何 sentTime <= T 的消息，对 U 已读。
 *
 * 三个证据源都走 isPersited: true 的可靠通道，与融云回执通道的失效条件不相关：
 * 1. 表态（消息扩展，key 形如 `${emoji}_0`）
 * 2. 回复（消息扩展，key 形如 `referInfo_0`，与表态同一份数据结构）
 * 3. 对方在会话里发言（发言必然先打开会话）
 *
 * 本文件不依赖 Vue / Vuex / electron-store，可独立单测。
 * 注意：apps/desktop 禁止使用可选链与空值合并，一律 && 兜底。
 */

/**
 * 是否机器人 / 智能体账号。这类账号不参与已读。
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
 * 从一条消息的扩展里取出「对它做过动作的人」。
 *
 * expansionDataMap[messageUId] 形如 { prefix: [{ s: 账号Id, t: 时间戳 }, ...] }，
 * 值已被 MessageExpansionUtils 的 parseMap JSON.parse 过。
 * 表态与回复共用这一份结构，所以不按前缀分支。
 *
 * **只返回人、不返回时间**：水位取的是被作用消息的 sentTime，不是动作时间 t。
 * 这样比取 t 保守（t 更晚，会多盖一段可能在对方视口下方的消息），
 * 也顺带绕开「扩展条目缺 t」的坑。
 *
 * @param {Object} expansionEntry expansionDataMap[messageUId]
 * @param {string} excludeUserId  要排除的账号（通常是自己）
 * @returns {Array<string>} 去重后的账号 Id 列表
 */
export function extractExpansionReaders(expansionEntry, excludeUserId) {
  const entry = expansionEntry || {};
  const seen = {};
  const readers = [];
  const keys = Object.keys(entry);
  for (let i = 0; i < keys.length; i++) {
    const list = entry[keys[i]];
    if (!Array.isArray(list)) {
      continue;
    }
    for (let j = 0; j < list.length; j++) {
      const item = list[j];
      if (!item || !item.s) {
        continue;
      }
      if (excludeUserId && item.s === excludeUserId) {
        continue;
      }
      if (isAgentOrRobotId(item.s)) {
        continue;
      }
      if (seen[item.s]) {
        continue;
      }
      seen[item.s] = true;
      readers.push(item.s);
    }
  }
  return readers;
}

/**
 * 某条消息的发送时间是否落在某人的已读水位以内。
 * @param {number} sentTime  消息发送时间
 * @param {Object} watermark { accountId: 水位时间戳 }
 * @param {string} userId    要判定的人
 * @returns {boolean}
 */
export function isReadByWatermark(sentTime, watermark, userId) {
  const time = Number(sentTime);
  if (!time || isNaN(time)) {
    return false;
  }
  const map = watermark || {};
  const mark = Number(map[userId]);
  if (!mark || isNaN(mark)) {
    return false;
  }
  return time <= mark;
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js
```

Expected：PASS，`Tests  13 passed (13)`。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/components/chitchat/read-receipt/readWatermarkModel.js \
        src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js
git commit -m "feat(receipt): 已读水位的证据提取与判定纯函数"
```

---

## Task 2: 扫消息列表算水位

**Files:**
- Modify: `src/renderer/components/chitchat/read-receipt/readWatermarkModel.js`（追加一个导出函数）
- Test: `src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js`（追加一个 describe）

**Interfaces:**
- Consumes: Task 1 的 `extractExpansionReaders(expansionEntry, excludeUserId)`、`isAgentOrRobotId(userId)`
- Produces: `collectWatermark({ messageList: Array, expansionDataMap: Object, selfId: string }): Object`
  返回 `{ accountId: 水位时间戳 }`

消息对象上用到的字段：`sentTime`、`messageUId`、`bySelf`、`senderUserId`、`isLocalMessage`。

- [ ] **Step 1: 追加失败的测试**

在 `tests/readWatermarkModel.test.js` 的 import 里加上 `collectWatermark`：

```js
import {
  isAgentOrRobotId,
  extractExpansionReaders,
  isReadByWatermark,
  collectWatermark,
} from "../readWatermarkModel";
```

在文件末尾追加：

```js
describe("collectWatermark", () => {
  const selfId = "me";

  it("对方发言把水位推到该消息的 sentTime", () => {
    const messageList = [
      { messageUId: "m1", sentTime: 100, bySelf: false, senderUserId: "u1" },
      { messageUId: "m2", sentTime: 300, bySelf: false, senderUserId: "u1" },
      { messageUId: "m3", sentTime: 200, bySelf: false, senderUserId: "u2" },
    ];
    expect(
      collectWatermark({ messageList, expansionDataMap: {}, selfId })
    ).toEqual({ u1: 300, u2: 200 });
  });

  it("自己发的消息不进水位", () => {
    const messageList = [
      { messageUId: "m1", sentTime: 100, bySelf: true, senderUserId: selfId },
    ];
    expect(
      collectWatermark({ messageList, expansionDataMap: {}, selfId })
    ).toEqual({});
  });

  it("机器人与智能体发言不进水位", () => {
    const messageList = [
      { messageUId: "m1", sentTime: 100, bySelf: false, senderUserId: "robot_1" },
      { messageUId: "m2", sentTime: 100, bySelf: false, senderUserId: "ga_1" },
    ];
    expect(
      collectWatermark({ messageList, expansionDataMap: {}, selfId })
    ).toEqual({});
  });

  it("本地消息（isLocalMessage）不进水位", () => {
    const messageList = [
      {
        messageUId: "m1",
        sentTime: 100,
        bySelf: false,
        senderUserId: "u1",
        isLocalMessage: true,
      },
    ];
    expect(
      collectWatermark({ messageList, expansionDataMap: {}, selfId })
    ).toEqual({});
  });

  it("表态把水位推到被表态消息的 sentTime，而不是表态时间 t", () => {
    const messageList = [
      { messageUId: "m1", sentTime: 100, bySelf: true, senderUserId: selfId },
    ];
    const expansionDataMap = { m1: { "😀": [{ s: "u1", t: 99999 }] } };
    expect(collectWatermark({ messageList, expansionDataMap, selfId })).toEqual({
      u1: 100,
    });
  });

  it("回复与表态一样进水位", () => {
    const messageList = [
      { messageUId: "m1", sentTime: 100, bySelf: true, senderUserId: selfId },
    ];
    const expansionDataMap = { m1: { referInfo: [{ s: "u1", t: 99999 }] } };
    expect(collectWatermark({ messageList, expansionDataMap, selfId })).toEqual({
      u1: 100,
    });
  });

  it("同一人在多条消息上表态，水位取最晚那条的 sentTime", () => {
    const messageList = [
      { messageUId: "m1", sentTime: 500, bySelf: true, senderUserId: selfId },
      { messageUId: "m2", sentTime: 100, bySelf: true, senderUserId: selfId },
    ];
    const expansionDataMap = {
      m1: { "😀": [{ s: "u1" }] },
      m2: { "👍": [{ s: "u1" }] },
    };
    expect(collectWatermark({ messageList, expansionDataMap, selfId })).toEqual({
      u1: 500,
    });
  });

  it("发言与表态两个源取较大者", () => {
    const messageList = [
      { messageUId: "m1", sentTime: 800, bySelf: true, senderUserId: selfId },
      { messageUId: "m2", sentTime: 200, bySelf: false, senderUserId: "u1" },
    ];
    const expansionDataMap = { m1: { "😀": [{ s: "u1" }] } };
    expect(collectWatermark({ messageList, expansionDataMap, selfId })).toEqual({
      u1: 800,
    });
  });

  it("自己表态不进水位", () => {
    const messageList = [
      { messageUId: "m1", sentTime: 100, bySelf: false, senderUserId: "u1" },
    ];
    const expansionDataMap = { m1: { "😀": [{ s: selfId }] } };
    expect(collectWatermark({ messageList, expansionDataMap, selfId })).toEqual({
      u1: 100,
    });
  });

  it("缺 sentTime 的消息跳过，脏输入不抛异常", () => {
    expect(collectWatermark(undefined)).toEqual({});
    expect(collectWatermark({})).toEqual({});
    expect(
      collectWatermark({
        messageList: [null, { messageUId: "m1" }, { sentTime: 100 }],
        expansionDataMap: {},
        selfId,
      })
    ).toEqual({});
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js
```

Expected：FAIL，报 `collectWatermark is not a function`。

- [ ] **Step 3: 写实现**

在 `readWatermarkModel.js` 末尾追加：

```js
/**
 * 扫一遍当前已加载的消息列表，产出每个人的已读水位。
 *
 * 三个源合在一次遍历里，都取 max：
 * - 对方发言：senderUserId 的水位推到该消息 sentTime
 * - 表态 / 回复：做动作的人的水位推到被作用消息的 sentTime
 *
 * 只能算到「已加载的消息」。滚动加载更多历史后会重算，配合仓库的单调合并只增不减。
 *
 * @param {Object} params
 * @param {Array<Object>} params.messageList      已渲染的消息列表
 * @param {Object}        params.expansionDataMap 全局消息扩展表
 * @param {string}        params.selfId           我的账号 Id
 * @returns {Object} { accountId: 水位时间戳 }
 */
export function collectWatermark(params) {
  const p = params || {};
  const list = p.messageList || [];
  const expansionMap = p.expansionDataMap || {};
  const selfId = p.selfId;
  const result = {};

  // 内联的取 max，避免为一行逻辑再导出一个函数
  const bump = function(userId, time) {
    const t = Number(time);
    if (!userId || !t || isNaN(t)) {
      return;
    }
    if (!result[userId] || result[userId] < t) {
      result[userId] = t;
    }
  };

  for (let i = 0; i < list.length; i++) {
    const msg = list[i];
    if (!msg || !msg.sentTime) {
      continue;
    }
    if (msg.isLocalMessage) {
      continue;
    }

    // 源 3：对方在会话里发言——发言必然先打开会话
    if (
      !msg.bySelf &&
      msg.senderUserId &&
      msg.senderUserId !== selfId &&
      !isAgentOrRobotId(msg.senderUserId)
    ) {
      bump(msg.senderUserId, msg.sentTime);
    }

    // 源 1 / 2：表态与回复——同一条消息扩展通道，同一份数据结构
    if (!msg.messageUId) {
      continue;
    }
    const readers = extractExpansionReaders(
      expansionMap[msg.messageUId],
      selfId
    );
    for (let j = 0; j < readers.length; j++) {
      bump(readers[j], msg.sentTime);
    }
  }

  return result;
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js
```

Expected：PASS，`Tests  23 passed (23)`。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/components/chitchat/read-receipt/readWatermarkModel.js \
        src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js
git commit -m "feat(receipt): 扫消息列表算按人已读水位，表态/回复/发言三源合一"
```

---

## Task 3: 水位仓库（单调、纯内存、零框架依赖）

**Files:**
- Create: `src/renderer/components/chitchat/read-receipt/readWatermarkStore.js`
- Test: `src/renderer/components/chitchat/read-receipt/tests/readWatermarkStore.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `buildConversationKey(conversationType: number|string, targetId: string): string`
  - `bumpWatermark(conversationKey: string, readers: Object): Object` —— 并入后返回该会话水位的**新对象副本**
  - `getWatermark(conversationKey: string): Object` —— 返回**新对象副本**
  - `__resetWatermark(): void` —— 仅供单测

**为什么返回新对象**：`msg-list.vue` 会把返回值整体赋给一个 data 字段。
Vue 2 对整体赋值必然响应，对原对象新增 key 则不响应。返回副本把这个坑一次性堵掉。

- [ ] **Step 1: 写失败的测试**

创建 `src/renderer/components/chitchat/read-receipt/tests/readWatermarkStore.test.js`：

```js
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildConversationKey,
  bumpWatermark,
  getWatermark,
  __resetWatermark,
} from "../readWatermarkStore";

describe("readWatermarkStore", () => {
  beforeEach(() => {
    __resetWatermark();
  });

  it("会话 key 按类型 + targetId 组合，私聊群聊互不干扰", () => {
    expect(buildConversationKey(1, "u1")).toBe("1_u1");
    expect(buildConversationKey(3, "u1")).toBe("3_u1");
    expect(buildConversationKey(1, "")).toBe("");
    expect(buildConversationKey(1, undefined)).toBe("");
  });

  it("首次并入即读得到", () => {
    bumpWatermark("1_u1", { a: 100 });
    expect(getWatermark("1_u1")).toEqual({ a: 100 });
  });

  it("单调只增：小值不覆盖大值", () => {
    bumpWatermark("1_u1", { a: 500 });
    bumpWatermark("1_u1", { a: 100 });
    expect(getWatermark("1_u1")).toEqual({ a: 500 });
  });

  it("大值覆盖小值", () => {
    bumpWatermark("1_u1", { a: 100 });
    bumpWatermark("1_u1", { a: 500 });
    expect(getWatermark("1_u1")).toEqual({ a: 500 });
  });

  it("不同会话彼此隔离", () => {
    bumpWatermark("1_u1", { a: 100 });
    bumpWatermark("3_g1", { a: 900 });
    expect(getWatermark("1_u1")).toEqual({ a: 100 });
    expect(getWatermark("3_g1")).toEqual({ a: 900 });
  });

  it("bumpWatermark 返回合并后的副本，改副本不影响仓库", () => {
    bumpWatermark("1_u1", { a: 100 });
    const snapshot = bumpWatermark("1_u1", { b: 200 });
    expect(snapshot).toEqual({ a: 100, b: 200 });
    snapshot.a = 1;
    expect(getWatermark("1_u1")).toEqual({ a: 100, b: 200 });
  });

  it("getWatermark 也返回副本", () => {
    bumpWatermark("1_u1", { a: 100 });
    const snapshot = getWatermark("1_u1");
    snapshot.a = 1;
    expect(getWatermark("1_u1")).toEqual({ a: 100 });
  });

  it("无效输入不抛异常也不污染仓库", () => {
    expect(bumpWatermark("", { a: 100 })).toEqual({});
    expect(bumpWatermark("1_u1", undefined)).toEqual({});
    bumpWatermark("1_u1", { a: 0, b: "x", c: null });
    expect(getWatermark("1_u1")).toEqual({});
    expect(getWatermark("")).toEqual({});
    expect(getWatermark("不存在的会话")).toEqual({});
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readWatermarkStore.test.js
```

Expected：FAIL，报 `Failed to resolve import "../readWatermarkStore"`。

- [ ] **Step 3: 写实现**

创建 `src/renderer/components/chitchat/read-receipt/readWatermarkStore.js`：

```js
/**
 * 已读水位仓库：会话级、按人、单调只增、纯内存。
 *
 * **不落盘**的理由：数据本来就在内存里；没有持久化时机就没有漏写 / 重复写 / 循环依赖；
 * 且历史消息重新加载后照样重算生效，落盘方案做不到这点。
 *
 * **不用 Vue 的 reactive**：Vue 2 对新增 key 不响应，用 reactive 就得处处 set。
 * 这里改成纯对象 + 返回新副本，由 msg-list.vue 整体赋给 data 字段触发重渲染，
 * 仓库因此完全脱离框架，可在 node 环境裸跑单测。
 *
 * 生命周期：切会话不清，进程退出自然消失。占用是 O(会话数 × 会话内人数)，可忽略。
 *
 * 注意：apps/desktop 禁止使用可选链与空值合并，一律 && 兜底。
 */

const watermarkMap = {};

/**
 * 会话 key。同一个 targetId 的私聊与群聊不会串。
 * @param {number|string} conversationType
 * @param {string} targetId
 * @returns {string} targetId 缺失时返回空串
 */
export function buildConversationKey(conversationType, targetId) {
  if (!targetId) {
    return "";
  }
  return `${conversationType}_${targetId}`;
}

/**
 * 把一批水位并进仓库，逐个取 max —— 只增不减。
 * @param {string} conversationKey
 * @param {Object} readers { accountId: 水位时间戳 }
 * @returns {Object} 合并后该会话水位的新副本
 */
export function bumpWatermark(conversationKey, readers) {
  if (!conversationKey) {
    return {};
  }
  const incoming = readers || {};
  if (!watermarkMap[conversationKey]) {
    watermarkMap[conversationKey] = {};
  }
  const entry = watermarkMap[conversationKey];
  const keys = Object.keys(incoming);
  for (let i = 0; i < keys.length; i++) {
    const userId = keys[i];
    const t = Number(incoming[userId]);
    if (!t || isNaN(t)) {
      continue;
    }
    if (!entry[userId] || entry[userId] < t) {
      entry[userId] = t;
    }
  }
  return Object.assign({}, entry);
}

/**
 * 读某个会话的水位副本。
 * @param {string} conversationKey
 * @returns {Object}
 */
export function getWatermark(conversationKey) {
  if (!conversationKey) {
    return {};
  }
  return Object.assign({}, watermarkMap[conversationKey] || {});
}

/**
 * 清空仓库。**仅供单测**，业务代码不要调用。
 */
export function __resetWatermark() {
  const keys = Object.keys(watermarkMap);
  for (let i = 0; i < keys.length; i++) {
    delete watermarkMap[keys[i]];
  }
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/tests/readWatermarkStore.test.js
```

Expected：PASS，`Tests  8 passed (8)`。

- [ ] **Step 5: 全量跑一次两个测试文件**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/
```

Expected：`Test Files  2 passed (2)`，`Tests  31 passed (31)`。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/chitchat/read-receipt/readWatermarkStore.js \
        src/renderer/components/chitchat/read-receipt/tests/readWatermarkStore.test.js
git commit -m "feat(receipt): 已读水位仓库，会话级按人单调只增"
```

---

## Task 4: 接线喂入点 + 私聊读出点

**Files:**
- Modify: `src/renderer/components/chitchat/message/msg-list.vue`

**Interfaces:**
- Consumes: Task 2 的 `collectWatermark`、Task 1 的 `isReadByWatermark`、Task 3 的 `buildConversationKey` / `bumpWatermark`
- Produces: 组件内的 `this.readWatermark`（`{ accountId: 水位 }`）与 `this.refreshReadWatermark()`，Task 5 会用

**已有的可复用事实**（`origin/release` 版本行号）：
- `expansionDataMap` 已在第 649–653 行 import 自 `@/WebIM/MessageExpansionUtils.js`
- 实时扩展监听（`IMSDKServer.js:45`）、新消息（`MessageModel.js:251`）、拉历史（`MessageModel.js:353`）**全部汇入** `onExpansionUpdate`，它在 `MessageExpansionUtils.js:46` 统一 `window.eventHub.$emit("msg-expansion-update", messageUId)`
- `msg-list.vue` 已经在订阅这个事件：第 868 行 `$on`、第 891 行 `$off`
- `this.senderInfo.id` 是我的账号 Id（mapGetters `GetSendUser`）
- `this.privateTargetId` 是私聊对端 Id（computed，非私聊时为 `null`）
- `this.OpenDialog.conversationType` / `this.OpenDialog.id`

> **⚠️ 扩展更新必须走事件总线，不能靠 computed 监听 `expansionDataMap`。**
> 它是 Vue 2.7 的 `reactive()`，**新增 key 不响应**——`MessageExpansionUtils.js:44` 写的
> `expansionDataMap["updated"]` 是动态新增的键，computed 读它永远不会被重新触发。
> 现有代码也正是靠 `msg-expansion-update` 事件驱动表态 UI 刷新的。

- [ ] **Step 1: 加 import**

在 `msg-list.vue` 第 653 行 `} from "@/WebIM/MessageExpansionUtils.js";` 之后插入：

```js
import {
  collectWatermark,
  isReadByWatermark,
} from "@/components/chitchat/read-receipt/readWatermarkModel";
import {
  buildConversationKey,
  bumpWatermark,
} from "@/components/chitchat/read-receipt/readWatermarkStore";
```

- [ ] **Step 2: 加 data 字段**

在 `data()` 的 return 里，`innerReadTime: {},` 那一行（release 第 835 行）之后插入：

```js
      // 已读水位兜底：{ accountId: 时间戳 }，表示此人在该时刻打开着本会话。
      // 由 refreshReadWatermark 整体赋值，不要就地改 key（Vue 2 不响应新增 key）。
      readWatermark: {},
```

- [ ] **Step 3: 加 computed**

在 `computed` 里，`privateTargetId()` 那个 computed 之后插入：

```js
    conversationKey() {
      return buildConversationKey(
        this.OpenDialog.conversationType,
        this.OpenDialog.id
      );
    },
```

- [ ] **Step 4: 加 watch**

在组件的 `watch` 块里追加两条（若 `watch` 块不存在则在 `computed` 之后新建）：

```js
    // 消息列表变化（新消息 / 拉历史 / 切会话）后重算水位
    messageList() {
      this.refreshReadWatermark();
    },
    // 切会话立刻换成目标会话的水位
    conversationKey: {
      immediate: true,
      handler() {
        this.refreshReadWatermark();
      },
    },
```

- [ ] **Step 5: 订阅表态 / 回复的更新事件**

`expansionDataMap` 新增 key 不响应（见本任务开头的警告），扩展更新只能靠事件总线。

在第 868 行那句之后追加一行：

```js
    window.eventHub.$on("msg-expansion-update", this.updateExpansionKeyMap);
    // 表态 / 回复更新后重算已读水位（expansionDataMap 新增 key 不响应，只能走事件）
    window.eventHub.$on("msg-expansion-update", this.refreshReadWatermark);
```

在第 891 行那句之后追加对应的解绑：

```js
    window.eventHub.$off("msg-expansion-update", this.updateExpansionKeyMap);
    window.eventHub.$off("msg-expansion-update", this.refreshReadWatermark);
```

- [ ] **Step 6: 加喂入方法**

在 `methods` 里，`getStatusText(data)` 之前插入：

```js
    /**
     * 重算并并入本会话的已读水位。
     *
     * 只读不写业务状态：collectWatermark 是纯函数，bumpWatermark 只动模块内的水位表，
     * 返回的新副本整体赋给 readWatermark 触发重渲染。
     * 水位单调只增，所以重复调用是幂等的，不怕 watcher / 事件多触发几次。
     *
     * 同时作为 msg-expansion-update 的事件回调，事件带的 messageUId 参数用不上，忽略。
     */
    refreshReadWatermark() {
      const key = this.conversationKey;
      if (!key) {
        this.readWatermark = {};
        return;
      }
      const collected = collectWatermark({
        messageList: this.messageList,
        expansionDataMap,
        selfId: this.senderInfo && this.senderInfo.id,
      });
      this.readWatermark = bumpWatermark(key, collected);
    },
```

- [ ] **Step 7: 改私聊读出点 `getStatusText`**

在 `getStatusText(data)` 里，找到这段（release 第 2984–2988 行）：

```js
      if (storeReadTime) {
        if (readTime < storeReadTime) {
          readTime = storeReadTime;
        }
      }
      if (readTime > 0) {
```

改成：

```js
      if (storeReadTime) {
        if (readTime < storeReadTime) {
          readTime = storeReadTime;
        }
      }
      // 兜底：表态 / 回复 / 对方发言反推的已读水位。
      // 不经过融云回执通道，回执丢没丢都不影响它。
      // 只在前两个源都没给出时间时才用——它们的时间更精确，水位是下界。
      // 这一层只会把「未读」翻成「已读」，不会反向。
      if (
        !readTime &&
        this.privateTargetId &&
        isReadByWatermark(
          data.sentTime,
          this.readWatermark,
          this.privateTargetId
        )
      ) {
        readTime = this.readWatermark[this.privateTargetId];
      }
      if (readTime > 0) {
```

- [ ] **Step 8: lint 通过**

```bash
npm run lint
```

Expected：exit 0，无输出或只有既有 warning。若报可选链 / `??` 相关错误，说明写错了，改成 `&&` 兜底。

- [ ] **Step 9: 单测仍然全绿**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/
```

Expected：`Tests  31 passed (31)`。

- [ ] **Step 10: 提交**

```bash
git add src/renderer/components/chitchat/message/msg-list.vue
git commit -m "feat(receipt): 私聊已读接入水位兜底，表态/回复/发言均可反推"
```

---

## Task 5: 群聊读出点

**Files:**
- Modify: `src/renderer/components/chitchat/message/msg-list.vue`

**Interfaces:**
- Consumes: Task 4 的 `this.readWatermark`、Task 1 的 `isReadByWatermark`
- Produces: `getMergedGroupReceipt(msg): Object|null`

**背景**：群聊已读名单 `groupReceipt[messageUId]` 形如 `{ userId: 0 | 已读时间 }`，
成员就是发送时登记的 @ 名单。它有三个消费者：

1. 模板里三处 `:msgReceipt` 绑定（release 第 340、437、455 行），传给
   `msg-txt.vue` / `msg-txt-fold-expand.vue`，用来在 @ 某人的名字旁点已读/未读小点
   （`msg-txt.vue:58` 判 `=== 0`，`:69` 判 `!== 0`）
2. `getGroupNeedReadCount` / `getGroupHasReadCount`（release 第 2929、2933 行）
3. 已读区块的显示开关（release 第 566–567 行）

**分母不动**：水位只把名单里已有的人从 0 翻成时间戳，**不新增成员**。
分母的语义是「需要已读的人数」，由发送方登记决定，不该被旁人的表态改写。

**本地名单缺失时返回 `null` 而不是 `{}`**：第 3 个消费者靠真假决定渲不渲染，
返回 `{}` 会让每条 @ 消息都误显示成已读。第 566–567 行那个开关保持读 `groupReceipt` 原值，不改。

- [ ] **Step 1: 加合并方法**

在 `methods` 里，`getGroupNeedReadCount(msg)` 之前插入：

```js
    /**
     * 群聊已读名单 = 本地登记名单 + 水位兜底。
     *
     * 名单成员（分母）完全由本地登记决定，水位只把名单里的人从「未读」翻成「已读」。
     * 不在名单里的人表态，既不进分子也不进分母。
     *
     * 本地未登记时返回 null（不是 {}）：调用方靠返回值真假决定渲不渲染已读，
     * 返回 {} 会让每条别人发的 @ 消息都误显示成已读。
     */
    getMergedGroupReceipt(msg) {
      const local = this.groupReceipt && this.groupReceipt[msg.messageUId];
      if (!local) {
        return null;
      }
      const merged = {};
      const keys = Object.keys(local);
      for (let i = 0; i < keys.length; i++) {
        const userId = keys[i];
        if (local[userId]) {
          merged[userId] = local[userId];
        } else if (
          isReadByWatermark(msg.sentTime, this.readWatermark, userId)
        ) {
          merged[userId] = this.readWatermark[userId];
        } else {
          merged[userId] = 0;
        }
      }
      return merged;
    },
```

- [ ] **Step 2: 改计数方法**

把 release 第 2929–2936 行这两个方法：

```js
    getGroupNeedReadCount(msg) {
      const needReadTimeMap = this.groupReceipt[msg.messageUId];
      return Object.keys(needReadTimeMap).length;
    },
    getGroupHasReadCount(msg) {
      const needReadTimeMap = this.groupReceipt[msg.messageUId];
      return Object.entries(needReadTimeMap).filter((item) => item[1]).length;
    },
```

改成：

```js
    getGroupNeedReadCount(msg) {
      // 分母仍是本地登记的名单人数，水位不改它
      const needReadTimeMap = this.getMergedGroupReceipt(msg) || {};
      return Object.keys(needReadTimeMap).length;
    },
    getGroupHasReadCount(msg) {
      const needReadTimeMap = this.getMergedGroupReceipt(msg) || {};
      return Object.entries(needReadTimeMap).filter((item) => item[1]).length;
    },
```

- [ ] **Step 3: 改三处模板绑定**

release 第 339–341、436–438、454–456 行各有一处相同写法：

```html
                      :msgReceipt="
                        groupReceipt && groupReceipt[item.messageUId]
                      "
```

三处**全部**改成：

```html
                      :msgReceipt="getMergedGroupReceipt(item)"
```

用下面这条命令确认改完了：

```bash
grep -n "groupReceipt\[item.messageUId\]" src/renderer/components/chitchat/message/msg-list.vue
```

Expected：只剩 1 处（第 566–567 行那个已读区块显示开关），三个 `:msgReceipt` 绑定都不在了。

- [ ] **Step 4: lint 通过**

```bash
npm run lint
```

Expected：exit 0。

- [ ] **Step 5: 单测仍然全绿**

```bash
npx vitest run src/renderer/components/chitchat/read-receipt/
```

Expected：`Tests  31 passed (31)`。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/chitchat/message/msg-list.vue
git commit -m "feat(receipt): 群聊已读名单接入水位兜底，只补分子不改分母"
```

---

## Task 6: 真机验收

**Files:** 无代码改动（除非发现问题）

- [ ] **Step 1: 起测试环境**

```bash
npm run dev:test
```

- [ ] **Step 2: 确认提交前工作区干净**

```bash
git status --short
```

Expected：只有 `.env.test`、`electron-builder.yml`、`package.json` 三行 `M`。这三个**不要提交**。

- [ ] **Step 3: 跑四条验收**

每条都要**先确认 PC 上显示未读**，再触发证据，观察是否翻转。

| # | 场景 | 操作 | 期望 |
|---|------|------|------|
| 1 | 私聊 · 表态 | 手机对 PC 发的一条旧消息表态 | PC 上**那条及它之前的所有消息**翻已读 |
| 2 | 群聊 · 名单内 | @ 名单里的人对该消息表态 | `已读 x/y` 的 x +1，y 不变；@ 名字旁的小点由未读变已读 |
| 3 | 群聊 · 名单外 | 不在 @ 名单的人对该消息表态 | `x/y` 完全不变 |
| 4 | 对方发言 | 对方在会话里发一句话 | 我方该时刻之前的消息全翻已读 |

- [ ] **Step 4: 回填验收结果**

把四条的实际结果（通过 / 不通过 + 现象）写进
`context/features/20260825-pc端已读兜底-表态反推已读水位/status.md` 的平台矩阵与「待办 / 阻塞」。

- [ ] **Step 5: 提交文档**

在**工作区仓库根目录**（不是 `apps/desktop`）执行：

```bash
cd ../..
git add "context/features/20260825-pc端已读兜底-表态反推已读水位"
git commit -m "docs(pc已读兜底): 回填真机验收结果"
```

---

## 附：本方案覆盖不到的情况（预期内，不是 bug）

- 证据消息不在当前已加载的 `messageList` 里 → 收集不到。滚动加载更多历史后自动补上，仓库单调只增。
- 对方全程没表态、没回复、没发言 → 兜不住，只能靠原有的回执通道。
- 对方从搜索 / @提醒直接跳到会话中间再表态 → 按水位仍把前面的算已读。这是「已读水位」的通行语义，接受。

**关键性质：这一层只会把「未读」翻成「已读」，永远不会反向。最坏情况是「没兜住」。**

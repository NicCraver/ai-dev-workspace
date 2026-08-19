# PC 端群 @ 消息已读回执丢失 修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 PC 端（apps/desktop）群聊 @ 消息「对方已经看了，发送方仍显示未读」的缺陷，使 PC 的群已读回执行为与安卓 / iOS 一致。

**Architecture:** 保留融云回执作为唯一数据通道（安卓/iOS 也是如此，服务端没有群维度按人已读接口）。PC 侧做四件事：(1) 把融云 web SDK 的群回执有效期从默认 1 天提到 15 天；(2) 阅读方改为「SDK 原生 `sendReceiptResponse` + 放宽后的自研兜底」双保险，不再只对文本/引用消息回执；(3) 发送方的「需回执登记表」覆盖历史消息与多端同步消息，不再只在本机发送瞬间登记；(4) 把散落在 `msg-list.vue` / `MessageModel.js` / `storeModule` 里的判定逻辑抽成一个无依赖的纯函数模块，用 vitest 覆盖。

**Tech Stack:** Electron + Vue 2 + Vuex + electron-store，融云 `@rongcloud/imlib-v2@2.10.1`，测试用 vitest 2.0.5（已在 devDependencies，无需安装）。

## Global Constraints

- **仅改 `apps/desktop`。** 本计划不改安卓 / iOS 代码。
- **禁止重装 PC 端依赖**：不得执行 `npm install` / `pnpm install`，不得删除 `node_modules`。
- **禁止使用可选链 `?.` 与空值合并 `??`**：`apps/desktop` 一律用 `&&` 兜底（既有代码风格，构建链不支持）。
- **提交禁忌**：`.env.test`、`electron-builder.yml`、`package.json`、`package-lock.json` 一律不得 `git add` / commit。若工作区里它们有改动，提交前 `git restore` 还原或确认未 stage。
- **注释用中文。**
- **功能内聚**：新增代码集中在 `src/renderer/components/chitchat/group-receipt/`，单测放该目录下的 `tests/`。既有文件就地改，不做搬迁。
- **禁止改动融云 SDK 的私有 storage**（`localStorage["RCV4-API-V2"]`）：SDK 构造时把整张表读进内存缓存，外部写入会在 SDK 下次 `set` 时被整体覆盖，属于必然失效的做法。
- 分支：从 `apps/desktop` 当前分支切 `fix/pc-group-at-read-receipt`。

---

## 背景：已确认的代码事实

阅读代码得到的事实（行号为改动前）。

**先记一条容易踩空的前提：运行时加载的融云 SDK 不是 `node_modules/@rongcloud/imlib-v2`，而是 `main.js:8` require 的 `static/libs/RongIMLib-v2-Adapter-5.3.3.prod.js`（UMD，挂全局 `window.RongIMLib`）。** node_modules 里那份只作类型/参考。下表中涉及 SDK 内部行为的结论已在**这个 adapter 文件里逐条复核过**，两者实现一致（同名压缩函数 `jL` / `KL`）。改代码与验证都以 adapter 为准。

| 事实 | 位置 |
|---|---|
| 融云 web SDK 初始化没传 options，`readReceiptTimeout` 取默认值 1 天 | `src/renderer/WebIM/IMSDKServer.js:11` |
| SDK 收到 `RC:RRRspMsg` 时，会把 `content.receiptMessageDic[我的id]` 重写为「本机存在 `${myId}${messageUId}SENT` 记录」的子集，没有记录就变成空数组 | `static/libs/RongIMLib-v2-Adapter-5.3.3.prod.js`，`setOnReceiveMessageListener` 内的重写函数 |
| 该 `SENT` 记录只在本机 `sendMessage` 成功发出 `RC:RRReqMsg`，或收到 `messageDirection === SEND` 的 `RC:RRReqMsg` 时写入 | 同上，压缩后函数名 `jL()` |
| 阅读方回执是自研的：只对 `TextMessage` / `ReferenceMessage` 且 `content.extra` 非空的消息发，且挂在 `msgLength` watcher 上 | `src/renderer/components/chitchat/message/msg-list.vue:1427`、触发点 `:1292` |
| PC 完全不处理收到的 `RC:RRReqMsg`（`ReceiveMessageListener` 无对应 case，`MsgObjectNameEnum` 无 `"RC:RRReqMsg"` 映射） | `src/renderer/WebIM/ReceiveMessageListener.js:246-263`、`src/renderer/WebIM/message/MessageModel.js:44-85` |
| 发送方「需回执登记表」只在 `messageDirection === 1 && extra.atUserList && !isHis` 时写入 | `src/renderer/WebIM/message/MessageModel.js:305-317` |
| `setGroupReceipt` 有三道门：群未登记 / 消息未登记 / 该读者不在 `needReadTimeMap` 里且值不为 0，任一不满足就静默丢弃 | `src/renderer/store/module/storeModule/index.js:153-180` |
| SDK 提供公开 API `RongIMLib.RongIMClient.getInstance().sendReceiptResponse(conversationType, targetId, callback)`，内部按原始发送者分组、带 `isResponse` 去重 | adapter 内 `sendReceiptResponse`；类型见 `node_modules/@rongcloud/imlib-v2/dist/index.d.ts:1026` |
| SDK 初始化签名为 `init(appkey, _, options)`，options 为第三参、`readReceiptTimeout` 单位天、`Math.min(15, Math.max(n.readReceiptTimeout \|\| 1, 1))` | adapter 内 `aP.init`；类型见 `index.d.ts:1542, 264-273` |
| `RongIMLib` 是 UMD 全局变量，`msg-list.vue` 直接用即可，不需要 import（`messageService.js` 已是这么用的） | `src/renderer/main.js:8` |
| 安卓 / iOS 的已读名单来自融云 `readReceiptInfo`，没有服务端接口兜底 | `IM/src/main/java/com/im/groupread/GroupReadDialog.java:134`、`ZXRCMessageModel.h:45` |
| `datasyn/getReadMessage` 是会话级已读时间，PC 只在私聊用（`chatType: 1`），不含群内按人明细 | `src/renderer/service/messageService.js:946`、`msg-list.vue:1270` |

**尚未实测、Task 0 必须先测出结论的一点：** 从手机发出的 `RC:RRReqMsg` 是否会通过多端同步下发到 PC（`messageDirection === SEND`）。若会，SDK 会自动补上 `SENT` 记录，「手机发 @、PC 看已读」场景本身不成立，Task 6 直接跳过；若不会，必须执行 Task 6。

---

## File Structure

- **Create** `apps/desktop/src/renderer/components/chitchat/group-receipt/groupReceiptModel.js` — 无依赖纯逻辑：机器人判定、extra 解析、需回执名单构造、阅读方回执候选筛选、回执字典构造。
- **Create** `apps/desktop/src/renderer/components/chitchat/group-receipt/tests/groupReceiptModel.test.js` — 上述纯逻辑的 vitest 单测。
- **Create** `context/features/20260819-pc端群@消息已读回执丢失/evidence.md` — Task 0 的复现矩阵实测结果。
- **Modify** `apps/desktop/src/renderer/WebIM/IMSDKServer.js:11` — init 传 `readReceiptTimeout`。
- **Modify** `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue:1292, 1427` — 阅读方回执改双保险 + 触发点显式化。
- **Modify** `apps/desktop/src/renderer/WebIM/message/MessageModel.js:305-317` — 发送方登记覆盖历史与多端消息。
- **Modify** `apps/desktop/src/renderer/store/module/storeModule/index.js:113-180` — `setNeedReceipt` 复用纯逻辑、`setGroupReceipt` 补齐缺失登记。
- **Modify** `apps/desktop/src/renderer/WebIM/ReceiveMessageListener.js:246-263` — 去掉重复 case，按需处理 `RC:RRReqMsg`。
- **Modify** `context/features/20260819-pc端群@消息已读回执丢失/status.md` / `impl-notes.md` — 收尾文档。

---

### Task 0: 复现矩阵与诊断埋点

先拿证据，再改代码。本任务不修任何逻辑，只加一个可开关的日志层，跑完矩阵后把结论写进 `evidence.md`。

**Files:**
- Create: `context/features/20260819-pc端群@消息已读回执丢失/evidence.md`
- Modify: `apps/desktop/src/renderer/service/messageService.js`（临时日志，Task 8 移除）
- Modify: `apps/desktop/src/renderer/store/module/messageModule/messageActions.js`（临时日志，Task 8 移除）

**Interfaces:**
- Consumes: 无
- Produces: `evidence.md`，其中必须明确回答「多端同步的 `RC:RRReqMsg` 是否到达 PC」这一问题（Task 6 的分支判据）

- [ ] **Step 1: 切分支**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git checkout -b fix/pc-group-at-read-receipt
git status --short
```

预期：输出里不包含 `package.json` / `electron-builder.yml` / `.env.test` 的新增改动（若有，先 `git restore` 还原）。

- [ ] **Step 2: 在发出回执请求处加日志**

`src/renderer/service/messageService.js`，在 `requestGroupReadReceiptIfNeeded` 的 `.then` 里，把原来的 `console.log("回执请求", res);` 替换为：

```js
      .then((res) => {
        // 【临时诊断】群 @ 已读回执排查，验收后随 Task 8 一并移除
        console.log("[receipt] 发出回执请求", {
          messageUId: msg.messageUId,
          targetId: msg.targetId,
          res,
        });
      })
```

- [ ] **Step 3: 在收到回执响应处加日志**

`src/renderer/store/module/messageModule/messageActions.js`，在 `HandleGroupMsgResp` 函数体第一行插入：

```js
    // 【临时诊断】群 @ 已读回执排查，验收后随 Task 8 一并移除
    const receiptDic =
      message.content && message.content.receiptMessageDic
        ? message.content.receiptMessageDic
        : null;
    console.log("[receipt] 收到回执响应", {
      from: message.senderUserId,
      targetId: message.targetId,
      myId: getters.GetSendUser.id,
      dicKeys: receiptDic ? Object.keys(receiptDic) : null,
      mine: receiptDic ? receiptDic[getters.GetSendUser.id] : null,
    });
```

- [ ] **Step 4: 在消息接收入口加「回执请求消息」日志**

`src/renderer/WebIM/ReceiveMessageListener.js`，在 `onReceived` 的 `switch` 语句之前插入：

```js
    // 【临时诊断】确认多端同步的 RC:RRReqMsg 是否到达 PC，验收后随 Task 8 一并移除
    if (message.objectName === "RC:RRReqMsg") {
      console.log("[receipt] 收到回执请求消息", {
        direction: message.messageDirection, // 1=SEND(自己其他端发的) 2=RECEIVE
        senderUserId: message.senderUserId,
        targetId: message.targetId,
        content: message.content,
      });
    }
```

- [ ] **Step 5: 启动 PC 端**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npm run dev:test
```

预期：窗口起来，devtools console 可见 `融云登录时间` 日志。

- [ ] **Step 6: 跑复现矩阵**

依次执行 6 组用例，每组记录「发送端」「阅读端」「发送端看到的已读结果」「PC console 里三类 `[receipt]` 日志是否出现」：

1. PC 发 @ → 安卓看 → PC 查已读
2. PC 发 @ → iOS 看 → PC 查已读
3. 安卓发 @ → PC 看 → 安卓查已读
4. iOS 发 @ → PC 看 → iOS 查已读
5. 手机（同账号）发 @ → 任意端看 → **PC** 查已读（对应场景 A）
6. PC 发 @ → 对方隔天再看 → PC 查已读（对应场景 D，可用改系统时间或等待替代，测不了就标记「未测」）

- [ ] **Step 7: 写结论**

创建 `context/features/20260819-pc端群@消息已读回执丢失/evidence.md`，模板：

```markdown
# 证据：PC 群 @ 已读回执复现矩阵

> 实测日期：YYYY-MM-DD ｜ PC 分支：fix/pc-group-at-read-receipt ｜ 环境：test

## 矩阵

| # | 发送端 | 阅读端 | 发送端已读是否翻转 | PC 侧 [receipt] 日志 | 结论 |
|---|--------|--------|--------------------|----------------------|------|
| 1 | PC | 安卓 | | | |
| 2 | PC | iOS | | | |
| 3 | 安卓 | PC | | | |
| 4 | iOS | PC | | | |
| 5 | 手机（同账号） | 任意 | 在 PC 上查 | | |
| 6 | PC | 任意（隔天） | | | |

## 关键判据

- **多端同步的 `RC:RRReqMsg` 是否到达 PC**：是 / 否（用例 5 的 `[receipt] 收到回执请求消息` 且 `direction === 1`）
  - 是 → Task 6 跳过，在 status.md 记「Task 6 不适用」
  - 否 → Task 6 必做
- 用例 3/4 中，被 @ 的消息类型：纯文本 / 引用 / 其他（若出现非文本类型，Task 3 的放宽是必需项而非优化项）
```

- [ ] **Step 8: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/service/messageService.js src/renderer/store/module/messageModule/messageActions.js src/renderer/WebIM/ReceiveMessageListener.js
git commit -m "chore(receipt): 群@已读回执临时诊断日志"

cd /Users/nic/w/ai-dev-workspace
git add "context/features/20260819-pc端群@消息已读回执丢失/evidence.md"
git commit -m "docs(pc-group-receipt): 记复现矩阵实测结果"
```

---

### Task 1: 把群回执有效期从 1 天提到 15 天

**Files:**
- Modify: `apps/desktop/src/renderer/WebIM/IMSDKServer.js:11`

**Interfaces:**
- Consumes: 无
- Produces: 无（纯配置）

- [ ] **Step 1: 改初始化参数**

`src/renderer/WebIM/IMSDKServer.js`，把：

```js
    RongIMLib.RongIMClient.init(AppKey);
```

改为：

```js
    // 群回执有效期，单位天，SDK 默认 1 天：超过窗口的回执请求与回执响应会被 SDK 直接丢弃，
    // 导致「对方隔天才看」或「PC 离线超过一天」时已读永远不翻转。取 SDK 上限 15 天。
    RongIMLib.RongIMClient.init(AppKey, null, { readReceiptTimeout: 15 });
```

- [ ] **Step 2: 验证参数被 SDK 接收**

启动后在 devtools console 执行：

```js
JSON.stringify(Object.keys(localStorage).filter((k) => k.indexOf("RCV4") === 0))
```

预期：包含 `"RCV4-API-V2"`。随后发一条群 @ 消息，再执行：

```js
Object.keys(JSON.parse(localStorage.getItem("RCV4-API-V2"))).filter((k) => k.indexOf("SENT") > -1)
```

预期：出现至少一条以 `SENT` 结尾的 key（说明回执请求已被 SDK 记账）。

- [ ] **Step 3: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/WebIM/IMSDKServer.js
git commit -m "fix(receipt): 群回执有效期由默认1天改为15天"
```

---

### Task 2: 抽出纯逻辑模块并覆盖单测

把散在三个文件里的「谁是机器人」「extra 怎么解析」「需回执名单怎么算」「哪些消息该回执」统一成无依赖纯函数，先写测试再写实现。

**Files:**
- Create: `apps/desktop/src/renderer/components/chitchat/group-receipt/groupReceiptModel.js`
- Test: `apps/desktop/src/renderer/components/chitchat/group-receipt/tests/groupReceiptModel.test.js`

**Interfaces:**
- Consumes: 无（本模块不得 import Vue / Vuex / RongIMLib / 任何 `@/` 别名）
- Produces:
  - `isRobotUserId(userId: string): boolean`
  - `parseExtra(extra: string | object | null): object | null`
  - `buildNeedReadMap(extra: string | object | null): { [accountId: string]: 0 }`
  - `hasAtForReceipt(msg: object): boolean`
  - `pickReceiptTargets(messages: object[]): object[]`
  - `buildReceiptDic(messages: object[]): { [senderUserId: string]: string[] }`

- [ ] **Step 1: 写失败的测试**

创建 `apps/desktop/src/renderer/components/chitchat/group-receipt/tests/groupReceiptModel.test.js`：

```js
import { describe, it, expect } from "vitest";
import {
  isRobotUserId,
  parseExtra,
  buildNeedReadMap,
  hasAtForReceipt,
  pickReceiptTargets,
  buildReceiptDic,
} from "../groupReceiptModel";

describe("isRobotUserId", () => {
  it("识别机器人与群智能体前缀", () => {
    expect(isRobotUserId("robot_1")).toBe(true);
    expect(isRobotUserId("ga_1")).toBe(true);
  });

  it("真人与非法值返回 false", () => {
    expect(isRobotUserId("100086")).toBe(false);
    expect(isRobotUserId("")).toBe(false);
    expect(isRobotUserId(null)).toBe(false);
    expect(isRobotUserId(123)).toBe(false);
  });
});

describe("parseExtra", () => {
  it("对象原样返回", () => {
    expect(parseExtra({ a: 1 })).toEqual({ a: 1 });
  });

  it("JSON 字符串解析为对象", () => {
    expect(parseExtra('{"a":1}')).toEqual({ a: 1 });
  });

  it("非法 JSON 与空值返回 null", () => {
    expect(parseExtra("not-json")).toBe(null);
    expect(parseExtra("")).toBe(null);
    expect(parseExtra(null)).toBe(null);
    expect(parseExtra(undefined)).toBe(null);
  });
});

describe("buildNeedReadMap", () => {
  it("atUserList 中的真人计入，初值为 0", () => {
    const extra = { atUserList: [{ atUserId: "u1" }, { atUserId: "u2" }] };
    expect(buildNeedReadMap(extra)).toEqual({ u1: 0, u2: 0 });
  });

  it("机器人与群智能体不计入", () => {
    const extra = {
      atUserList: [{ atUserId: "u1" }, { atUserId: "robot_9" }, { atUserId: "ga_9" }],
    };
    expect(buildNeedReadMap(extra)).toEqual({ u1: 0 });
  });

  it("atAllUserList 也计入并与 atUserList 合并去重", () => {
    const extra = {
      atUserList: [{ atUserId: "u1" }],
      atAllUserList: ["u1", "u2", "robot_9"],
    };
    expect(buildNeedReadMap(extra)).toEqual({ u1: 0, u2: 0 });
  });

  it("只 @ 机器人时返回空对象", () => {
    expect(buildNeedReadMap({ atUserList: [{ atUserId: "robot_9" }] })).toEqual({});
  });

  it("extra 为 JSON 字符串同样生效", () => {
    expect(buildNeedReadMap('{"atUserList":[{"atUserId":"u1"}]}')).toEqual({ u1: 0 });
  });

  it("无 extra 返回空对象", () => {
    expect(buildNeedReadMap(null)).toEqual({});
  });
});

describe("hasAtForReceipt", () => {
  it("@所有人（mentionedInfo.type === 1）需要回执", () => {
    const msg = { content: { mentionedInfo: { type: 1 } } };
    expect(hasAtForReceipt(msg)).toBe(true);
  });

  it("extra 里有真人 @ 需要回执", () => {
    const msg = { content: { extra: '{"atUserList":[{"atUserId":"u1"}]}' } };
    expect(hasAtForReceipt(msg)).toBe(true);
  });

  it("只 @ 机器人不需要回执", () => {
    const msg = { content: { extra: { atUserList: [{ atUserId: "robot_9" }] } } };
    expect(hasAtForReceipt(msg)).toBe(false);
  });

  it("没有 @ 信息不需要回执", () => {
    expect(hasAtForReceipt({ content: { content: "hi" } })).toBe(false);
    expect(hasAtForReceipt({})).toBe(false);
    expect(hasAtForReceipt(null)).toBe(false);
  });
});

describe("pickReceiptTargets", () => {
  const base = {
    bySelf: false,
    messageUId: "uid1",
    isLocalMessage: false,
    content: { extra: { atUserList: [{ atUserId: "u1" }] } },
    senderUserId: "s1",
    targetId: "g1",
  };

  it("非文本类型的 @ 消息同样入选（不再按 messageType 过滤）", () => {
    const msg = Object.assign({}, base, { messageType: "ZXRichMessage" });
    expect(pickReceiptTargets([msg])).toHaveLength(1);
  });

  it("自己发的消息排除", () => {
    const msg = Object.assign({}, base, { bySelf: true });
    expect(pickReceiptTargets([msg])).toHaveLength(0);
  });

  it("本地消息与缺 messageUId 的消息排除", () => {
    const local = Object.assign({}, base, { isLocalMessage: true });
    const noUid = Object.assign({}, base, { messageUId: "" });
    expect(pickReceiptTargets([local, noUid])).toHaveLength(0);
  });

  it("不带 @ 的消息排除", () => {
    const plain = Object.assign({}, base, { content: { content: "hi" } });
    expect(pickReceiptTargets([plain])).toHaveLength(0);
  });

  it("空数组与非数组输入返回空数组", () => {
    expect(pickReceiptTargets([])).toEqual([]);
    expect(pickReceiptTargets(null)).toEqual([]);
  });
});

describe("buildReceiptDic", () => {
  it("按原始发送者分组，值为 messageUId 数组", () => {
    const msgs = [
      { senderUserId: "s1", messageUId: "m1" },
      { senderUserId: "s1", messageUId: "m2" },
      { senderUserId: "s2", messageUId: "m3" },
    ];
    expect(buildReceiptDic(msgs)).toEqual({ s1: ["m1", "m2"], s2: ["m3"] });
  });

  it("同一 messageUId 不重复入组", () => {
    const msgs = [
      { senderUserId: "s1", messageUId: "m1" },
      { senderUserId: "s1", messageUId: "m1" },
    ];
    expect(buildReceiptDic(msgs)).toEqual({ s1: ["m1"] });
  });

  it("空输入返回空对象", () => {
    expect(buildReceiptDic([])).toEqual({});
    expect(buildReceiptDic(null)).toEqual({});
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/group-receipt/tests/groupReceiptModel.test.js
```

预期：FAIL，报错形如 `Failed to resolve import "../groupReceiptModel"`。

- [ ] **Step 3: 写实现**

创建 `apps/desktop/src/renderer/components/chitchat/group-receipt/groupReceiptModel.js`：

```js
/**
 * 群 @ 消息已读回执 —— 纯逻辑层。
 *
 * 本文件不依赖 Vue / Vuex / 融云 SDK，可被 vitest 直接加载。
 * 注意：本仓库 PC 端禁止使用可选链（?.）与空值合并（??），一律用 && 兜底。
 */

// 机器人与「群·个人智能体」的账号前缀，这两类不计入已读名单，也不需要向其回执
const ROBOT_ID_PREFIXES = ["robot_", "ga_"];

/**
 * 是否是机器人 / 群智能体账号
 * @param {*} userId
 * @returns {boolean}
 */
export function isRobotUserId(userId) {
  if (!userId || typeof userId !== "string") {
    return false;
  }
  for (let i = 0; i < ROBOT_ID_PREFIXES.length; i++) {
    if (userId.indexOf(ROBOT_ID_PREFIXES[i]) === 0) {
      return true;
    }
  }
  return false;
}

/**
 * 消息 extra 可能是对象，也可能是 JSON 字符串，统一归一化为对象
 * @param {*} extra
 * @returns {object|null}
 */
export function parseExtra(extra) {
  if (!extra) {
    return null;
  }
  let result = extra;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch (e) {
      return null;
    }
  }
  if (result && typeof result === "object") {
    return result;
  }
  return null;
}

/**
 * 由 extra 构造「需已读名单」，值统一初始化为 0（未读）
 * @param {*} extra
 * @returns {object} { accountId: 0 }
 */
export function buildNeedReadMap(extra) {
  const result = {};
  const parsed = parseExtra(extra);
  if (!parsed) {
    return result;
  }
  const atUserList = parsed.atUserList || [];
  const atAllUserList = parsed.atAllUserList || [];
  for (let i = 0; i < atUserList.length; i++) {
    const item = atUserList[i];
    const atUserId = item && item.atUserId;
    if (atUserId && !isRobotUserId(atUserId)) {
      result[atUserId] = 0;
    }
  }
  for (let j = 0; j < atAllUserList.length; j++) {
    const accountId = atAllUserList[j];
    if (accountId && !isRobotUserId(accountId)) {
      result[accountId] = 0;
    }
  }
  return result;
}

/**
 * 这条消息是否带「需要已读回执的 @」。
 * 判定与消息类型无关：文本、引用、富文本、卡片都可能带 @。
 * @param {object} msg
 * @returns {boolean}
 */
export function hasAtForReceipt(msg) {
  if (!msg || !msg.content) {
    return false;
  }
  const mentionedInfo = msg.content.mentionedInfo;
  // type === 1 为 @所有人
  if (mentionedInfo && mentionedInfo.type === 1) {
    return true;
  }
  return Object.keys(buildNeedReadMap(msg.content.extra)).length > 0;
}

/**
 * 从消息列表里挑出「我作为阅读方应当回执」的消息
 * @param {object[]} messages
 * @returns {object[]}
 */
export function pickReceiptTargets(messages) {
  if (!messages || !messages.length) {
    return [];
  }
  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || msg.bySelf || msg.isLocalMessage) {
      continue;
    }
    if (!msg.messageUId || !msg.senderUserId) {
      continue;
    }
    if (!hasAtForReceipt(msg)) {
      continue;
    }
    result.push(msg);
  }
  return result;
}

/**
 * 构造融云 ReadReceiptResponseMessage 的 receiptMessageDic：
 * key 为原始消息发送者 accountId，value 为其 messageUId 数组。
 * @param {object[]} messages
 * @returns {object}
 */
export function buildReceiptDic(messages) {
  const dic = {};
  if (!messages || !messages.length) {
    return dic;
  }
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || !msg.senderUserId || !msg.messageUId) {
      continue;
    }
    if (!dic[msg.senderUserId]) {
      dic[msg.senderUserId] = [];
    }
    if (dic[msg.senderUserId].indexOf(msg.messageUId) === -1) {
      dic[msg.senderUserId].push(msg.messageUId);
    }
  }
  return dic;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/group-receipt/tests/groupReceiptModel.test.js
```

预期：PASS，`Tests  20 passed`（数量以实际为准，必须 0 failed）。

- [ ] **Step 5: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/group-receipt/
git commit -m "feat(receipt): 抽出群@已读回执纯逻辑模块并补单测"
```

---

### Task 3: 阅读方回执改为「SDK 原生 + 放宽后的自研兜底」

现状只对文本/引用消息回执，且挂在 `msgLength` watcher 上。改为打开会话与消息变化时都显式调用，先走 SDK 原生 `sendReceiptResponse`（只回执真正请求过的消息，带去重），再用放宽后的自研逻辑兜底（覆盖对端没发回执请求的情况，比如安卓只对纯文本消息发请求）。

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue`（`sendGroupReceiptMessage` 方法体、`msgLength` watcher、`OpenDialog` watcher）
- Modify: `apps/desktop/src/renderer/service/messageService.js`（`SendGroupReceiptMessageRes` 增加空字典短路）

**Interfaces:**
- Consumes: Task 2 的 `pickReceiptTargets(messages)`、`buildReceiptDic(messages)`
- Produces: `msg-list.vue` 的方法 `sendGroupReceiptMessage()`（签名不变，可被 watcher 与 `OpenDialog` 复用）

- [ ] **Step 1: 引入纯逻辑模块**

`src/renderer/components/chitchat/message/msg-list.vue`，在 `<script>` 的 import 区末尾加：

```js
import {
  pickReceiptTargets,
  buildReceiptDic,
} from "@/components/chitchat/group-receipt/groupReceiptModel";
```

- [ ] **Step 2: 重写 `sendGroupReceiptMessage`**

把 `msg-list.vue` 中整个 `sendGroupReceiptMessage()` 方法替换为：

```js
    sendGroupReceiptMessage() {
      if (
        this.OpenDialog.conversationType !==
        ConversationModel.IMConversationEnum.GROUP
      ) {
        return;
      }
      const targetId = this.OpenDialog.id;
      if (!targetId) {
        return;
      }
      // 第一路：融云原生回执。SDK 内部按「收到过回执请求且尚未响应」的消息分组发送，
      // 并自己做去重，等价于安卓 sendReadReceiptResponse / iOS _sendReadReceiptResponseForMessages。
      try {
        const client = RongIMLib.RongIMClient.getInstance();
        client.sendReceiptResponse(
          RongIMLib.ConversationType.GROUP,
          targetId,
          {
            onSuccess() {},
            onError(errorCode) {
              console.warn("sendReceiptResponse 失败", errorCode);
            },
          }
        );
      } catch (e) {
        console.warn("sendReceiptResponse 异常", e);
      }
      // 第二路：自研兜底。对端可能没发回执请求（例如安卓只对纯文本消息发请求），
      // 此时仍按消息自身是否带 @ 来回执，避免发送方永远显示未读。
      const needReceiptMsgs = pickReceiptTargets(this.messageList);
      if (!needReceiptMsgs.length) {
        return;
      }
      const receiptMessageDic = buildReceiptDic(needReceiptMsgs);
      setTimeout(() => {
        this.$service.SendGroupReceiptMessageRes({
          targetId,
          receiptMessageDic,
        });
      }, 1000);
    },
```

注意：`targetId` 改为取 `this.OpenDialog.id`，不再取 `needReceiptMsgs[0].targetId`——原写法在列表为空时会越界。

- [ ] **Step 3: 触发点显式化**

把 `msgLength` watcher 由：

```js
    msgLength(len) {
      if (len) {
        this.sendGroupReceiptMessage();
      }
    },
```

改为：

```js
    msgLength(len) {
      // 条数变化（新消息 / 加载历史）时补一次回执
      if (len) {
        this.sendGroupReceiptMessage();
      }
    },
    groupId: {
      // 打开 / 切换群会话时必发一次，避免「两个群消息条数相同导致 watcher 不触发」
      immediate: true,
      handler(id) {
        if (id) {
          this.$nextTick().then(() => {
            this.sendGroupReceiptMessage();
          });
        }
      },
    },
```

**注意：`msg-list.vue` 已有一个 `groupId` watcher（调用 `refreshGroupReceipt`）。同一个 watch 对象里不能有重名 key —— 不要新增，而是把上面的 `sendGroupReceiptMessage()` 调用合并进已有的 `groupId` watcher：**

```js
    groupId: {
      immediate: true,
      handler(id) {
        if (id) {
          this.$nextTick().then(() => {
            this.refreshGroupReceipt();
            // 打开 / 切换群会话时必发一次，避免「两个群消息条数相同导致 msgLength watcher 不触发」
            this.sendGroupReceiptMessage();
          });
        } else {
          this.groupReceipt = null;
        }
      },
    },
```

- [ ] **Step 4: 空字典短路**

`src/renderer/service/messageService.js` 的 `SendGroupReceiptMessageRes`，在函数体第一行插入：

```js
    if (!targetId || !receiptMessageDic || Object.keys(receiptMessageDic).length === 0) {
      return;
    }
```

- [ ] **Step 5: 语法与静态检查**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx eslint --ext .js,.vue src/renderer/components/chitchat/message/msg-list.vue src/renderer/service/messageService.js src/renderer/components/chitchat/group-receipt/
```

预期：exit 0，无 error（既有 warning 可忽略，但不得新增 error）。

- [ ] **Step 6: 真机验证**

```bash
npm run dev:test
```

用安卓发一条群 @ 消息给 PC 账号 → PC 打开该群 → 安卓端查看已读。
预期：安卓已读名单里出现 PC 账号；PC console 无 `sendReceiptResponse 失败`。

再切到另一个群、再切回来，确认不会重复弹错。

- [ ] **Step 7: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/message/msg-list.vue src/renderer/service/messageService.js
git commit -m "fix(receipt): 阅读方回执改为SDK原生+放宽兜底，并在切群时必发"
```

---

### Task 4: 发送方登记表覆盖历史消息与多端同步消息

现状 `!isHis` 使得历史加载路径不登记，导致换机 / 重装 / 离线期间自己发的 @ 消息永远查不到已读。

**Files:**
- Modify: `apps/desktop/src/renderer/WebIM/message/MessageModel.js:300-320`
- Modify: `apps/desktop/src/renderer/store/module/storeModule/index.js:113-151`（`setNeedReceipt` 改用纯逻辑）

**Interfaces:**
- Consumes: Task 2 的 `buildNeedReadMap(extra)`、`hasAtForReceipt(msg)`
- Produces: `setNeedReceipt` 的 payload 增加可选字段 `sentTime: number`（用于时间窗过滤），既有调用方不传时按不过滤处理

- [ ] **Step 1: `setNeedReceipt` 改用纯逻辑**

`src/renderer/store/module/storeModule/index.js`：删除文件顶部的

```js
const isRobotUserId = (userId) => userId.startsWith("robot_") || userId.startsWith("ga_");
```

在 import 区加：

```js
import { buildNeedReadMap } from "@/components/chitchat/group-receipt/groupReceiptModel";
```

把 `setNeedReceipt` 中构造 `needReadTimeMap` 的那段（`const needReadTimeMap = {};` 到 `atAllUserList.forEach(...)` 结束）整体替换为：

```js
          const needReadTimeMap = buildNeedReadMap(extra);
```

其余逻辑（空名单直接 return、写 groupStore、写 groupMsgNeedReceiptStore）保持不变。

- [ ] **Step 2: 放开历史消息登记**

`src/renderer/WebIM/message/MessageModel.js`，把：

```js
        if (
          msg.messageDirection === 1 &&
          txtmsg.extra &&
          txtmsg.extra.atUserList &&
          !isHis &&
          msg.messageUId
        ) {
```

改为：

```js
        // 自己发出的、带 @ 的群消息都要登记「需已读名单」。
        // 历史消息（isHis）同样登记：换机、重装、离线期间自己发的 @ 消息，
        // 只有登记过才可能在收到回执响应时被记账。
        if (
          msg.messageDirection === 1 &&
          txtmsg.extra &&
          (txtmsg.extra.atUserList || txtmsg.extra.atAllUserList) &&
          msg.messageUId
        ) {
```

- [ ] **Step 3: 语法检查**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx eslint --ext .js,.vue src/renderer/WebIM/message/MessageModel.js src/renderer/store/module/storeModule/index.js
```

预期：exit 0。

- [ ] **Step 4: 单测回归**

```bash
npx vitest run src/renderer/components/chitchat/group-receipt/tests/groupReceiptModel.test.js
```

预期：PASS，0 failed。

- [ ] **Step 5: 真机验证**

```bash
npm run dev:test
```

1. 在群里发一条 @ 某人的消息，确认消息下方出现「已读 0/1」。
2. 完全退出 PC 客户端，重新登录，打开同一个群（此时消息走历史加载路径）。
3. 预期：该消息下方**仍显示「已读 x/y」而不是空白**。改动前这里会是空白，因为历史路径不登记名单。
4. 让被 @ 的人此时在手机上打开该群，回到 PC 观察比例翻转为「已读 1/1」。

- [ ] **Step 6: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/WebIM/message/MessageModel.js src/renderer/store/module/storeModule/index.js
git commit -m "fix(receipt): 历史与@所有人消息也登记需已读名单"
```

---

### Task 5: `setGroupReceipt` 不再静默丢弃

三道门里，「群未登记」「消息未登记」两道会让回执响应白来一趟。改为登记缺失时按需补建，并在写入前忽略空数组。

**Files:**
- Modify: `apps/desktop/src/renderer/store/module/storeModule/index.js`（`setGroupReceipt`）
- Modify: `apps/desktop/src/renderer/store/module/messageModule/messageActions.js`（`HandleGroupMsgResp` 增加空数组短路）

**Interfaces:**
- Consumes: Task 2 的 `buildNeedReadMap`
- Produces: 无新增导出

- [ ] **Step 1: 空回执直接返回**

`src/renderer/store/module/messageModule/messageActions.js` 的 `HandleGroupMsgResp`，把判断改为：

```js
  HandleGroupMsgResp({ commit, dispatch, getters }, { message }) {
    /**
     * 处理自己发送的群消息已读回执
     */
    const receiptDic =
      message.content && message.content.receiptMessageDic
        ? message.content.receiptMessageDic
        : null;
    const myMessageUids = receiptDic ? receiptDic[getters.GetSendUser.id] : null;
    // 融云 SDK 会把本机没有回执请求记录的 messageUId 过滤掉，这里可能收到空数组，
    // 空数组没有任何信息量，直接返回，避免后续误写。
    if (!myMessageUids || !myMessageUids.length) {
      return;
    }
    commit("READGROUPRECEIPTRESPONSE", {
      senderUserId: message.senderUserId,
      sentTime: message.sentTime,
      targetId: message.targetId,
      messageUids: myMessageUids,
    });
    commit("electronStore/setGroupReceipt", {
      accountId: getters.GetSendUser.id,
      groupId: message.targetId,
      senderUserId: message.senderUserId,
      sentTime: message.sentTime,
      messageUIds: myMessageUids,
    });
  },
```

- [ ] **Step 2: `setGroupReceipt` 补建缺失登记**

`src/renderer/store/module/storeModule/index.js`，把 `setGroupReceipt` 整体替换为：

```js
    setGroupReceipt(
      state,
      { accountId, groupId, senderUserId, sentTime, messageUIds }
    ) {
      if (!groupId || !messageUIds || !messageUIds.length) {
        return;
      }
      // 该群此前没登记过任何需回执消息时，这里补一个空壳，
      // 否则回执响应会被第一道门直接丢掉（换机 / 重装后必现）。
      if (!state.groupMessageNeedReceiptMap[groupId]) {
        Vue.set(state.groupMessageNeedReceiptMap, groupId, {});
      }
      const groupStore = getGroupStore({ accountId, groupId });
      if (!state.groupMessageReceiptMap[groupId]) {
        state.groupMessageReceiptMap[groupId] = groupStore.store;
      }
      const groupReadState = state.groupMessageReceiptMap[groupId];
      messageUIds.forEach((msgUId) => {
        const msgState = groupReadState[msgUId];
        // 名单里没有这条消息，说明本机没登记过（历史消息 / 换机），
        // 没有 @ 名单就无从判断已读比例，跳过而不是写脏数据。
        if (!msgState) {
          return;
        }
        // 该读者不在 @ 名单里（例如群里其他人也回了执），忽略
        if (typeof msgState[senderUserId] === "undefined") {
          return;
        }
        // 已记过更早的已读时间就不覆盖
        if (msgState[senderUserId]) {
          return;
        }
        msgState[senderUserId] = sentTime;
        Vue.set(groupReadState, msgUId, msgState);
        groupStore.set(msgUId, msgState);
        state.groupMessageNeedReceiptMap[groupId][msgUId] = sentTime;
      });
    },
```

注意：原实现最后一行 `state.groupMessageNeedReceiptMap[groupId][messageUIds] = sentTime;` 把**数组**当 key 用，是笔误，上面已改成 `msgUId`。

- [ ] **Step 3: 语法检查**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx eslint --ext .js,.vue src/renderer/store/module/storeModule/index.js src/renderer/store/module/messageModule/messageActions.js
```

预期：exit 0。

- [ ] **Step 4: 真机验证**

`npm run dev:test` → PC 发一条群 @ → 安卓 / iOS 打开看 → PC 上该消息显示「已读 1/1」。
再退出 PC 重新登录 → 打开同一群 → 已读比例仍在（来自 electron-store 持久化）。

- [ ] **Step 5: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/store/module/storeModule/index.js src/renderer/store/module/messageModule/messageActions.js
git commit -m "fix(receipt): 回执响应不再因登记缺失被静默丢弃"
```

---

### Task 6: 多端场景的回执请求补发（**条件任务**）

**执行前置：** 打开 `evidence.md`，看「多端同步的 `RC:RRReqMsg` 是否到达 PC」。

- 结论为 **是** → **跳过本任务**，在 `status.md` 里写「Task 6 不适用：多端同步已覆盖，实测见 evidence.md」，直接进 Task 7。
- 结论为 **否** → 执行下面的步骤。

原因：SDK 只把「本机存在 `${myId}${messageUId}SENT` 记录」的 messageUId 保留在回执响应里。手机发的 @ 消息在 PC 上没有这条记录，回执名单会被清空。唯一不依赖 SDK 私有存储的补法是：由 PC 补发一次标准 `RC:RRReqMsg`，让 SDK 在 `sendMessage` 成功回调里自己记账。

**Files:**
- Modify: `apps/desktop/src/renderer/service/messageService.js`（新增 `ensureGroupReadReceiptRequest`）
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue`（打开群会话时调用）

**Interfaces:**
- Consumes: Task 2 的 `hasAtForReceipt(msg)`；既有 `requestGroupReadReceiptIfNeeded(msg)`
- Produces: `ensureGroupReadReceiptRequest(messages: object[]): void`

- [ ] **Step 1: 新增补发方法**

`src/renderer/service/messageService.js`，在 `requestGroupReadReceiptIfNeeded` 之后插入：

```js
  /**
   * 补发群 @ 消息的已读回执请求。
   *
   * 场景：同账号在手机上发的 @ 消息同步到 PC 后，PC 本机没有融云 SDK 的回执请求记录，
   * SDK 会把收到的回执响应名单过滤成空数组，导致 PC 上永远显示未读。
   * 这里对「自己发出的、带 @ 的、本机没补发过」的消息补发一次标准回执请求，
   * 由 SDK 在发送成功回调里自行记账。每条消息只补一次，用本地标记去重。
   * @param {object[]} messages 当前会话消息列表
   */
  ensureGroupReadReceiptRequest(messages) {
    if (!messages || !messages.length) {
      return;
    }
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || !msg.bySelf || !msg.messageUId || msg.isLocalMessage) {
        continue;
      }
      if (
        msg.conversationType !== ConversationModel.IMConversationEnum.GROUP
      ) {
        continue;
      }
      if (!this.$service.shouldRequestGroupReadReceipt(msg)) {
        continue;
      }
      if (receiptRequestSentMap[msg.messageUId]) {
        continue;
      }
      receiptRequestSentMap[msg.messageUId] = true;
      this.$service.requestGroupReadReceiptIfNeeded(msg);
    }
  },
```

并在文件顶部 `const readMessageSyncPending = Object.create(null);` 旁边加：

```js
// 已补发过回执请求的 messageUId，进程内去重，避免重复补发骚扰群成员
const receiptRequestSentMap = Object.create(null);
```

- [ ] **Step 2: 在打开群会话时调用**

`src/renderer/components/chitchat/message/msg-list.vue` 的 `sendGroupReceiptMessage()` 末尾（`setTimeout` 之后）加：

```js
      // 补发本机缺失的回执请求（多端场景），详见 group-receipt 模块注释
      this.$service.ensureGroupReadReceiptRequest(this.messageList);
```

- [ ] **Step 3: 语法检查**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx eslint --ext .js,.vue src/renderer/service/messageService.js src/renderer/components/chitchat/message/msg-list.vue
```

预期：exit 0。

- [ ] **Step 4: 验证补发不产生副作用**

`npm run dev:test`，手机发一条群 @ → PC 打开该群。
必须逐项确认：
1. PC console 出现 `[receipt] 发出回执请求`（Task 0 的日志还在）。
2. **群里其他成员的会话列表未读数没有因为这条补发请求 +1**（`RC:RRReqMsg` 在融云是状态消息，正常不计未读；若实测发现计未读，立即回滚本任务并在 `impl-notes.md` 记录，改为放弃场景 A 的修复）。
3. 被 @ 的人重新打开会话后，PC 上该消息的已读比例翻转。
4. 反复进出该群，`[receipt] 发出回执请求` 只出现一次（去重生效）。

- [ ] **Step 5: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/service/messageService.js src/renderer/components/chitchat/message/msg-list.vue
git commit -m "fix(receipt): 多端场景补发群@回执请求"
```

---

### Task 7: 清理消息监听器里的重复 case

`ReceiveMessageListener.js` 里 `ReadReceiptResponseMessage` 出现了两次 case 标签，第二个永远匹配不到，靠 fallthrough 才没出问题；同时 `SyncReadStatusMessage` / `ReadReceiptMessage` 也会掉进 `HandleGroupMsgResp`。这属于「能跑但一改就炸」的结构，顺手理直。

**Files:**
- Modify: `apps/desktop/src/renderer/WebIM/ReceiveMessageListener.js:246-263`
- Modify: `apps/desktop/src/renderer/WebIM/message/MessageModel.js`（`MsgObjectNameEnum` 补 `RC:RRReqMsg` 双向映射）

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 重写 case 分支**

把 `src/renderer/WebIM/ReceiveMessageListener.js` 中这段：

```js
      case MessageModel.MessageType.SyncReadStatusMessage:
      case MessageModel.MessageType.ReadReceiptMessage:
      case MessageModel.MessageType.ReadReceiptResponseMessage:
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
      case MessageModel.MessageType.ReadReceiptResponseMessage:
        store.dispatch("HandleGroupMsgResp", {
          message: MessageModel.Message.convertMsg(message),
        });
        break;
```

替换为：

```js
      case MessageModel.MessageType.SyncReadStatusMessage:
      case MessageModel.MessageType.ReadReceiptMessage:
      case MessageModel.MessageType.ReadReceiptResponseMessage: {
        const converted = MessageModel.Message.convertMsg(message);
        store.dispatch("ReadReceiptMessage", { message: converted });
        if (message.senderUserId === store.getters.GetSendUser.id) {
          store.dispatch("UpdateReminderMap", {
            type: false,
            key: message.targetId,
            data: message,
            number: 0,
          });
        }
        // 群消息已读回执响应，单独交给群已读处理
        if (
          message.messageType ===
          MessageModel.MessageType.ReadReceiptResponseMessage
        ) {
          store.dispatch("HandleGroupMsgResp", { message: converted });
        }
        break;
      }
```

- [ ] **Step 2: 补 `RC:RRReqMsg` 映射**

`src/renderer/WebIM/message/MessageModel.js` 的 `MsgObjectNameEnum`，在 `ReadReceiptResponseMessage: "RC:RRRspMsg",` 之后加：

```js
  ReadReceiptRequestMessage: "RC:RRReqMsg", //群消息已读回执请求
```

在 `"RC:RRRspMsg": "ReadReceiptResponseMessage",` 之后加：

```js
  "RC:RRReqMsg": "ReadReceiptRequestMessage",
```

- [ ] **Step 3: 语法检查**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx eslint --ext .js,.vue src/renderer/WebIM/ReceiveMessageListener.js src/renderer/WebIM/message/MessageModel.js
```

预期：exit 0，且不再有 `no-fallthrough` / `no-duplicate-case` 相关报错。

- [ ] **Step 4: 真机冒烟**

`npm run dev:test`：私聊已读回执仍正常（发一条私聊消息，对方看后显示已读）、群已读仍正常、会话列表未读数正常清零。

- [ ] **Step 5: 提交**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/WebIM/ReceiveMessageListener.js src/renderer/WebIM/message/MessageModel.js
git commit -m "refactor(receipt): 清理已读回执监听的重复case并补RRReqMsg映射"
```

---

### Task 8: 回归矩阵、移除临时日志、文档收尾

**Files:**
- Modify: `apps/desktop/src/renderer/service/messageService.js`、`store/module/messageModule/messageActions.js`、`WebIM/ReceiveMessageListener.js`（删 Task 0 的临时日志）
- Create: `context/features/20260819-pc端群@消息已读回执丢失/impl-notes.md`
- Create: `context/features/20260819-pc端群@消息已读回执丢失/status.md`

**Interfaces:**
- Consumes: 前序全部任务
- Produces: 可交付的分支 + 平台无关实现笔记

- [ ] **Step 1: 跑完整回归矩阵**

重跑 Task 0 的 6 组用例，全部记录到 `evidence.md` 的「修复后」小节。通过标准：

| # | 场景 | 通过标准 |
|---|------|----------|
| 1 | PC 发 → 安卓看 | PC 显示「已读 1/1」 |
| 2 | PC 发 → iOS 看 | PC 显示「已读 1/1」 |
| 3 | 安卓发 → PC 看 | 安卓已读名单含 PC 账号 |
| 4 | iOS 发 → PC 看 | iOS 已读名单含 PC 账号 |
| 5 | 手机发 → 任意看 → PC 查 | PC 显示已读（Task 6 跳过时此项标注「按 evidence 结论不适用」） |
| 6 | 重登 PC 后查旧 @ 消息 | 已读比例仍显示，不为空白 |

任何一项不通过：停止，回到 systematic-debugging 的 Phase 1 重新取证，不要叠加新的修法。

- [ ] **Step 2: 移除临时日志**

删除 Task 0 步骤 2/3/4 加入的三处 `[receipt]` 日志（`messageService.js` 的 `.then` 恢复为 `console.log("回执请求", res);` 或直接留空回调；`messageActions.js` 与 `ReceiveMessageListener.js` 的诊断块整段删除）。

- [ ] **Step 3: 跑单测与 lint**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
npx vitest run src/renderer/components/chitchat/group-receipt/tests/groupReceiptModel.test.js
npx eslint --ext .js,.vue src/renderer
```

预期：vitest 全绿；eslint 无新增 error。

- [ ] **Step 4: 确认提交禁忌文件干净**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git status --short -- package.json package-lock.json electron-builder.yml .env.test
```

预期：**无输出**。有输出就 `git restore` 还原后再提交。

- [ ] **Step 5: 提交 PC 侧**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/service/messageService.js src/renderer/store/module/messageModule/messageActions.js src/renderer/WebIM/ReceiveMessageListener.js
git commit -m "chore(receipt): 移除群@已读回执临时诊断日志"
```

- [ ] **Step 6: 写实现笔记**

创建 `context/features/20260819-pc端群@消息已读回执丢失/impl-notes.md`，必须包含（平台无关表述，供后续其他端参考）：

```markdown
# 实现笔记：群 @ 消息已读回执

## 机制（三端一致）

1. 发送方发出带 @ 的群消息后，补发一条「已读回执请求」（融云 `RC:RRReqMsg`，内容只含被请求消息的 messageUId）。
2. 阅读方打开会话、加载到该消息时，回一条「已读回执响应」（`RC:RRRspMsg`，内容为 `{ 原消息发送者id: [messageUId...] }`）。
3. 发送方收到响应后，把响应者记入该消息的已读名单。
4. 已读名单的「应读人数」来自消息 `extra` 的 `atUserList` / `atAllUserList`，需剔除 `robot_` / `ga_` 前缀账号。

## 坑

- **融云 web SDK 会过滤回执响应**：收到 `RC:RRRspMsg` 时，只保留本机存在 `${当前用户id}${messageUId}SENT` 记录的 messageUId，其余清空。该记录仅在本机发出过对应回执请求时才有。多端场景下必须补发请求，否则名单恒为空。
- **web SDK 群回执有效期默认 1 天**，`RongIMClient.init` 第三参数传 `{ readReceiptTimeout: 15 }` 才够用；原生 SDK 无此限制。
- **回执不能按消息类型过滤**：@ 可能出现在文本、引用、富文本等多种消息里，按 `messageType` 白名单过滤会漏。
- **登记「需已读名单」不能只在发送瞬间做**：历史加载路径也要登记，否则换机 / 重装 / 离线期间发的 @ 消息永远查不到已读。
- （若 Task 6 执行了）补发回执请求要按 messageUId 去重，否则每次进群都骚扰一次群成员。
```

- [ ] **Step 7: 写状态文档**

创建 `context/features/20260819-pc端群@消息已读回执丢失/status.md`：

```markdown
# Status：PC 端群 @ 消息已读回执丢失

> 最后更新：YYYY-MM-DD ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T0 复现矩阵与埋点 | — | — | — | ⬜ |
| T1 回执有效期 15 天 | — | — | — | ⬜ |
| T2 纯逻辑模块 + 单测 | — | — | — | ⬜ |
| T3 阅读方回执双保险 | — | — | — | ⬜ |
| T4 登记覆盖历史/多端 | — | — | — | ⬜ |
| T5 回执响应不再静默丢弃 | — | — | — | ⬜ |
| T6 多端补发回执请求（条件） | — | — | — | ⬜ |
| T7 清理监听器重复 case | — | — | — | ⬜ |
| T8 回归 + 文档收尾 | — | — | — | ⬜ |

## 待办 / 阻塞

- Task 6 是否执行取决于 evidence.md 的实测结论。
- 安卓 `ConversationFragment.java:1549` 只对纯文本消息发回执请求，若 evidence 显示存在非文本 @ 消息，需另开一条安卓侧迭代（本期不做）。
```

- [ ] **Step 8: 提交 context**

```bash
cd /Users/nic/w/ai-dev-workspace
git add "context/features/20260819-pc端群@消息已读回执丢失/"
git commit -m "docs(pc-group-receipt): 补实现笔记与状态矩阵"
```

---

## 不在本计划范围内

- **安卓 `ConversationFragment.java:1549` 只对 `IMMessageType.TXT_MESSAGE` 发回执请求**：若 Task 0 实测发现存在非文本的 @ 消息，这是安卓侧的对称缺陷，需单开迭代。本计划的 Task 3 兜底能缓解「PC 作为阅读方」的那一半，但缓解不了「安卓/iOS 作为阅读方」的那一半。
- **服务端群已读明细接口**：`datasyn/getReadMessage` 是会话级已读时间，不含群内按人明细，三端都没用它做群已读。若后端后续提供按人明细接口，可用它替换整套融云回执链路，那是另一个量级的改造。
- **`context/contracts/` 无需改动**：本计划不涉及新接口。

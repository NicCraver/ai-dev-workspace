# 消息列表 · 个人AI框 tag / 头像名 / 回复菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 群聊消息若 `content.extra` 含 `personalAccountId`，展示为「个人AI框」并用 `content.user` 的名字/头像；右键菜单：仅本人个人 AI 可「@回复」，他人个人 AI 只能「回复」。

**Architecture:** 在 `msg-list.vue` 增加解析 `extra` 的小工具方法（`personalAccountId` / `isPersonalAiMsg`），驱动身份 tag、头像入参与 `isShow.reply`/`replyAt`。名字优先走 `content.user.name`（个人 AI）；群 AI 行为保持不变。实现后删除临时 `[at-personal-ai][msg-*]` 调试 log。

**Tech Stack:** `apps/desktop` Electron + Vue 2.7；改动集中 `msg-list.vue`（必要时微调 `GetSenderName` / `user-photo` 入参）。无单测 → lint + 真机点验。

**依据样例（2026-07-28 实测）：**
```json
{
  "senderUserId": "ga_2079857283709292546",
  "extraParsed": { "fromType": 2, "personalAccountId": "1880150187008081921" },
  "content.user": {
    "name": "李权泓的AI框",
    "portrait": "https://.../aiFrameAvatar.png"
  }
}
```

## Global Constraints

- 仅 desktop；Vue 2.7 禁止 `?.` / `??`
- `extra` 可能是 **JSON 字符串**，必须 `JSON.parse`（失败当无个人字段）
- 主判据：`extra.personalAccountId` 有值 → 个人 AI；**不要**只靠 `ga_` / `fromType`
- 字段名以实测为准：`personalAccountId`（驼峰），不是 `personal-accountId`
- 群 AI（`ga_` 且无 `personalAccountId`）：tag 仍「群AI框」；菜单仍「只出 @回复、不出普通回复」
- 提交只 push `personal-ai-chat`；中文 log/注释

## Plan Defaults（未单独拍板项）

| 项 | 默认 |
|----|------|
| 本人个人 AI 消息菜单 | **对齐群 AI**：只出「@回复」，隐藏普通「回复」 |
| 他人个人 AI 消息菜单 | 只出「回复」，**不出**「@回复」 |
| 名字 | 个人 AI：**优先** `content.user.name`；群 AI / 其它保持 `GetSenderName` 现逻辑 |
| 头像 | 个人 AI：传 `content.user`（含 `portrait`/`portraitUri`/`name`/`id`）给 `user-photo`，勿只传 `senderUserId` 走 map |

若产品改口，先改本文档再改代码。

## File Structure

| 文件 | 改动 |
|------|------|
| `apps/desktop/.../message/msg-list.vue` | 解析 extra；tag；头像；reply/replyAt；删调试 log |
| `context/features/20260727-at个人AI框-先做pc端/spec.md` | 「已决」补消息展示/菜单规则 |
| `context/features/.../status.md` | 待办追加本增量 E2E |

可选（仅当 `parseName` 仍被 map 盖住时）：
| `dialogGetters.js` `GetSenderName` | `ga_` + 有 `personalAccountId` 时优先 `content.user.name` |

---

### Task 1: 解析工具 + 删临时 log

**Files:**
- Modify: `msg-list.vue`（methods + 删 `logMsgForPersonalAiDebug` / click·contextmenu 调用）

**Interfaces:**
- Produces:
  - `parseMsgExtra(msg) → object|null`
  - `getPersonalAccountId(msg) → string|''`
  - `isPersonalAiMsg(msg) → boolean`（`!!getPersonalAccountId(msg)`）

- [x] **Step 1: 增加解析方法（Vue2 无 `?.`）**

```js
parseMsgExtra: function(msg) {
  var raw = msg && msg.content && msg.content.extra;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
},
getPersonalAccountId: function(msg) {
  var extra = this.parseMsgExtra(msg);
  if (!extra || extra.personalAccountId == null || extra.personalAccountId === '') {
    return '';
  }
  return String(extra.personalAccountId);
},
isPersonalAiMsg: function(msg) {
  return !!this.getPersonalAccountId(msg);
},
```

- [x] **Step 2: 删除临时调试**

去掉 `logMsgForPersonalAiDebug` 方法体及 `msgClickMenu` / `msgContextMenu` 内调用与 TODO 注释。

- [x] **Step 3: eslint `msg-list.vue`**

---

### Task 2: 身份 tag「个人AI框」/「群AI框」

**Files:**
- Modify: `msg-list.vue` 模板 ~183–189

- [x] **Step 1: 改 tag 分支**

```html
<span
  v-if="item.senderUserId && item.senderUserId.startsWith('ga_')"
  class="identity-tag tag-agent"
>{{ isPersonalAiMsg(item) ? '个人AI框' : '群AI框' }}</span>
<span
  v-else-if="item.senderUserId && item.senderUserId.startsWith('robot_')"
  class="identity-tag tag-robot"
>机器人</span>
```

- [ ] **Step 2: 真机** — 点含 `personalAccountId` 的消息：旁侧为「个人AI框」；普通群 AI 仍「群AI框」

---

### Task 3: 名字 + 头像走 `content.user`

**Files:**
- Modify: `msg-list.vue` — `parseName`；智能体 `user-photo` 入参（~130–139）

- [x] **Step 1: `parseName` 个人 AI 优先 content.user.name**

```js
parseName(message) {
  if (!message) return '';
  if (this.isPersonalAiMsg(message)) {
    var u = message.content && message.content.user;
    if (u && u.name) return u.name;
  }
  return this.GetSenderName(message, this.OpenDialog) || '';
},
```

- [x] **Step 2: 个人 AI 头像传 user 对象**

```html
<user-photo
  v-else-if="item.content.user && (item.content.user.id || '').includes('ga_')"
  class="user-sign"
  :class="{ 'user-sign-hide': item.hideTimeAndPhoto }"
  :user="isPersonalAiMsg(item) ? personalAiPhotoUser(item) : item.senderUserId"
  :hasInfo="true"
/>
```

```js
personalAiPhotoUser: function(item) {
  var u = (item && item.content && item.content.user) || {};
  return {
    id: u.id || item.senderUserId,
    name: u.name,
    avatar: u.portrait || u.portraitUri || u.avatar,
    portrait: u.portrait || u.portraitUri,
    portraitUri: u.portraitUri || u.portrait
  };
},
```

（若 `user-photo` 对 object 入参字段名不同，对照组件 props 微调，保证用到 `portrait`。）

- [ ] **Step 3: 真机** — 个人 AI 消息名称为「…的AI框」、头像为 AI 框图，不误用群智能体缓存头像

---

### Task 4: 右键回复 / @回复 分流

**Files:**
- Modify: `msg-list.vue` 菜单显隐逻辑 ~1097–1105

- [x] **Step 1: 替换笼统 `ga_` 菜单逻辑**

现网：

```js
if (msg && msg.senderUserId && msg.senderUserId.startsWith("ga_")) {
  isShow.reply = false;
}
```

改为：

```js
var isGa = msg && msg.senderUserId && msg.senderUserId.startsWith('ga_');
var personalId = this.getPersonalAccountId(msg);
var myId = this.GetSendUser && this.GetSendUser.id; // 确认实际 getter/字段名与文件内取登录人一致
if (isGa && personalId) {
  // 个人 AI
  if (String(personalId) === String(myId)) {
    // 本人：只 @回复（对齐群 AI）
    isShow.reply = false;
    isShow.replyAt = isReply && msg.conversationType === ConversationModel.IMConversationEnum.GROUP && !msg.bySelf;
  } else {
    // 他人：只能普通回复
    isShow.reply = isReply;
    isShow.replyAt = false;
  }
} else if (isGa) {
  // 群 AI：只 @回复
  isShow.reply = false;
}
```

**注意：** 实现前在 `msg-list.vue` 内搜现有「当前登录人 id」写法（`GetSendUser` / `corpUser.accountId` 等），与之一致，勿臆造字段。

- [ ] **Step 2: 真机菜单**

| 消息 | 期望菜单 |
|------|----------|
| 群 AI（无 personalAccountId） | 仅 @回复 |
| 本人个人 AI | 仅 @回复 |
| 他人个人 AI | 仅回复 |

- [x] **Step 3: Commit desktop**

```bash
git add src/renderer/components/chitchat/message/msg-list.vue
# 若改了 GetSenderName 一并 add
git commit -m "feat(at-personal-ai): 消息个人AI框标签头像与回复菜单分流"
```

---

### Task 5: 文档同步

**Files:**
- `spec.md` / `status.md` / 本 plan 勾选

- [x] **Step 1: spec「已决」追加**

- 消息 `extra.personalAccountId` → 个人 AI 框展示  
- tag / name / portrait 规则  
- 回复菜单：本人只 @回复；他人只回复；群 AI 不变  

- [x] **Step 2: status 待办** — 本增量 E2E 三行勾选表  

- [x] **Step 3: context commit**

```bash
git commit -m "docs(at-personal-ai): 消息个人AI框展示与回复菜单规则"
```

---

## Self-Review

1. **Spec coverage:** tag / 名头像 / 菜单三分流均有 Task；调试 log 删除在 Task 1。  
2. **Placeholder:** 无 TBD；登录人字段要求实现时对齐现网。  
3. **Type:** `personalAccountId` 字符串比较两端 `String()`。

## Execution Handoff

计划已保存到 `context/features/20260727-at个人AI框-先做pc端/plan-msg-personal-ai-tag.md`。

**执行方式：**

1. **Subagent-Driven（推荐）** — 每任务一个子代理 + 审阅  
2. **Inline** — 本会话按 Task 连续做  

选哪种？

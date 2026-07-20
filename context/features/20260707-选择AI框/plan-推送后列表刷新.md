# 推送后列表刷新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web 收到 `aiBoxSendMessage` 后按规则只刷新数据（AI框列表 / 历史会话 / 当前消息），PC 与移动 `/m/` 共用一套编排，不重挂载对话面板。

**Architecture:** 纯函数 `resolvePushRefreshPlan` + 注入式 `runPushRefresh` 放在 `personal-ai/list/`（对齐 `personalAiSaveSelectedFlow`）。PC `PersonalAiChat`、移动 `MPersonalAiChatWrapper` 只负责规范化 payload、取当前 `sessionId`、注入 `loadAgentList` / History soft refresh / Chat 消息重拉。Chat/History/Home 暴露「只刷数据」方法；禁止改 `chatPaneKey`、禁止 `getLastSessionMessage`。

**Tech Stack:** apps/web — Vue 3 `<script setup>` + 既有 `personalAiFrame` / `session` HTTP；单测 `node --test` `.test.mjs`；契约见 `推送后列表刷新规则.md` + `3端AI框角标推送.md`。

## Global Constraints

- **规则唯一来源**：`context/features/20260707-选择AI框/推送后列表刷新规则.md`。
- **范围**：只改 `apps/web`（+ 本功能 context 文档）；desktop / ios / android 推送门槛已保证非空 `sessionIds`，本计划不改壳。
- **只刷数据**：不整页 `reload`、不重挂 `HomeIndex`/`Chat`（勿 bump `chatPaneKey` / 勿清 `activeAgentId`）。
- **一套逻辑**：判定与编排只写一份；PC / `/m/` 双入口接线，禁止复制两份 if/else。
- **不用** `getLastSessionMessage`（推送场景）。
- **选择弹窗**（最近联系人/群/组织）不因推送刷新。
- **测试**：纯函数写 `.test.mjs`；组件靠 `pnpm exec vue-tsc --noEmit` + 手测。
- **注释**：中文。

## File Structure

**新增**
- `apps/web/src/components/views/personal-ai/list/personalAiPushRefreshFlow.js` — `resolvePushRefreshPlan` / `runPushRefresh`
- `apps/web/src/components/views/personal-ai/tests/personalAiPushRefreshFlow.test.mjs` — 单测

**修改**
- `apps/web/src/components/views/home/Chat.vue` — `defineExpose` 增加 `reloadCurrentSessionMessages`
- `apps/web/src/components/views/home/History.vue` — `defineExpose` 增加 `refresh`
- `apps/web/src/components/views/home/Home.vue` — History/Chat ref；`defineExpose` 当前 sessionId + 刷历史 + 刷消息
- `apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue` — 推送 handler 调 `runPushRefresh`（PC）
- `apps/web/src/components/views/personal/m/MPersonalAiChatWrapper.vue` — 同上（移动 `/m/`）
- `apps/web/src/components/views/personal/m/SelectAiChatPopup.vue` — 听 `historyRefreshNonce` soft 刷 History
- `context/features/20260707-选择AI框/推送后列表刷新规则.md` — 补「情况1为防御；实现入口」
- `context/features/20260707-选择AI框/status.md` — 待办勾进度

**数据流**

```
壳/原生 aiBoxSendMessage（必带非空 sessionIds）
  → normalizeAiBoxSendMessagePayload
  → runPushRefresh({ sessionIds, currentSessionId, loadAgentList, refreshHistory, refreshMessages })
       ├─ 情况1 空 → return
       ├─ 情况2 → loadAgentList({ skipGetFilter:true })
       └─ 情况3 → list + refreshHistory? + reloadCurrentSessionMessages
```

---

### Task 1: 纯函数编排 + 单测

**Files:**
- Create: `apps/web/src/components/views/personal-ai/list/personalAiPushRefreshFlow.js`
- Create: `apps/web/src/components/views/personal-ai/tests/personalAiPushRefreshFlow.test.mjs`

**Interfaces:**
- Consumes: `normalizeSessionIds` from `./aiBoxSendMessageUtils.js`
- Produces:
  - `resolvePushRefreshPlan(sessionIds, currentSessionId) → { refreshAgentList, refreshHistory, refreshMessages, sessionIds }`
  - `runPushRefresh({ sessionIds, currentSessionId, loadAgentList, refreshHistory?, refreshMessages? }) → Promise<plan>`

- [ ] **Step 1: 写失败单测**

```js
// personalAiPushRefreshFlow.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  resolvePushRefreshPlan,
  runPushRefresh
} from "../list/personalAiPushRefreshFlow.js";

test("empty sessionIds → no refresh", () => {
  assert.deepEqual(resolvePushRefreshPlan([], "s1"), {
    refreshAgentList: false,
    refreshHistory: false,
    refreshMessages: false,
    sessionIds: []
  });
});

test("has sessionIds, current not in set → list only", () => {
  assert.deepEqual(resolvePushRefreshPlan(["a", "b"], "c"), {
    refreshAgentList: true,
    refreshHistory: false,
    refreshMessages: false,
    sessionIds: ["a", "b"]
  });
});

test("current session hit → list + history + messages", () => {
  assert.deepEqual(resolvePushRefreshPlan(["a", "b"], "b"), {
    refreshAgentList: true,
    refreshHistory: true,
    refreshMessages: true,
    sessionIds: ["a", "b"]
  });
});

test("no current sessionId → list only", () => {
  assert.deepEqual(resolvePushRefreshPlan(["a"], ""), {
    refreshAgentList: true,
    refreshHistory: false,
    refreshMessages: false,
    sessionIds: ["a"]
  });
});

test("runPushRefresh injects and respects plan", async () => {
  const calls = [];
  const plan = await runPushRefresh({
    sessionIds: ["s1"],
    currentSessionId: "s1",
    loadAgentList: async (opts) => calls.push(["list", opts]),
    refreshHistory: async () => calls.push(["history"]),
    refreshMessages: async () => calls.push(["messages"])
  });
  assert.equal(plan.refreshMessages, true);
  assert.deepEqual(calls, [
    ["list", { skipGetFilter: true }],
    ["history"],
    ["messages"]
  ]);
});

test("runPushRefresh case2 skips history/messages", async () => {
  const calls = [];
  await runPushRefresh({
    sessionIds: ["s1"],
    currentSessionId: "other",
    loadAgentList: async () => calls.push("list"),
    refreshHistory: async () => calls.push("history"),
    refreshMessages: async () => calls.push("messages")
  });
  assert.deepEqual(calls, ["list"]);
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd apps/web && node --test src/components/views/personal-ai/tests/personalAiPushRefreshFlow.test.mjs`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现最小编排**

```js
// personalAiPushRefreshFlow.js
import { normalizeSessionIds } from "./aiBoxSendMessageUtils.js";

/**
 * 推送 → 刷哪些层（平台无关判定）。
 * 规则：推送后列表刷新规则.md
 */
export function resolvePushRefreshPlan(sessionIds, currentSessionId) {
  const ids = normalizeSessionIds(sessionIds);
  if (!ids.length) {
    return {
      refreshAgentList: false,
      refreshHistory: false,
      refreshMessages: false,
      sessionIds: []
    };
  }
  const current =
    currentSessionId != null && currentSessionId !== ""
      ? String(currentSessionId)
      : "";
  const hit = !!current && ids.includes(current);
  return {
    refreshAgentList: true,
    refreshHistory: hit,
    refreshMessages: hit,
    sessionIds: ids
  };
}

/**
 * 注入式执行：宿主提供 loadAgentList / refreshHistory / refreshMessages。
 * History/Chat 未挂载时传入 no-op 即可。
 */
export async function runPushRefresh({
  sessionIds,
  currentSessionId,
  loadAgentList,
  refreshHistory,
  refreshMessages
}) {
  const plan = resolvePushRefreshPlan(sessionIds, currentSessionId);
  if (!plan.refreshAgentList) return plan;
  if (typeof loadAgentList === "function") {
    await loadAgentList({ skipGetFilter: true });
  }
  if (plan.refreshHistory && typeof refreshHistory === "function") {
    await refreshHistory();
  }
  if (plan.refreshMessages && typeof refreshMessages === "function") {
    await refreshMessages();
  }
  return plan;
}
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd apps/web && node --test src/components/views/personal-ai/tests/personalAiPushRefreshFlow.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit（web 仓）**

```bash
cd apps/web
git add src/components/views/personal-ai/list/personalAiPushRefreshFlow.js \
  src/components/views/personal-ai/tests/personalAiPushRefreshFlow.test.mjs
git commit -m "feat(personal-ai): 推送刷新编排纯函数 + 单测"
```

---

### Task 2: Chat / History / Home 暴露「只刷数据」API

**Files:**
- Modify: `apps/web/src/components/views/home/Chat.vue`（`defineExpose` 附近 ~906）
- Modify: `apps/web/src/components/views/home/History.vue`（script 末尾）
- Modify: `apps/web/src/components/views/home/Home.vue`（两处 History + ChatBox ref + expose）

**Interfaces:**
- Consumes: 既有 `getHistoryList`（Chat 内消息拉数）、`getHistoryList(refresh)`（History 会话列表）
- Produces:
  - Chat: `reloadCurrentSessionMessages(): Promise<void>` — `lastFinishAt=0` 后按当前 `sessionId` 全量替换 `messages`（走现有 `getHistoryList`，**不** `handleResetState`、**不**改 sessionId）
  - History: `refresh(): Promise<void>` — `getHistoryList(true)`（soft，无全屏 loading）
  - Home: `getCurrentSessionId(): string`、`refreshHistoryList(): Promise<void>`、`reloadCurrentSessionMessages(): Promise<void>`

- [ ] **Step 1: Chat 增加 reload（不重置会话）**

在 `Chat.vue` `selectSession` 旁新增，并加入 `defineExpose`：

```js
/** 推送命中当前会话：只重拉消息，不重置 sessionId / 不拆组件 */
const reloadCurrentSessionMessages = async () => {
  if (!props.sessionId) return;
  lastFinishAt.value = 0;
  await getHistoryList({ id: props.sessionId });
};

defineExpose({
  startNewChat,
  selectSession,
  updateCurrentSession,
  setPromptRemark,
  reloadCurrentSessionMessages
});
```

- [ ] **Step 2: History expose soft refresh**

```js
defineExpose({
  refresh: () => getHistoryList(true)
});
```

- [ ] **Step 3: Home 挂 ref 并透出**

模板：两处 `HistoryList` 与 `ChatBox` 加同名 ref（`v-if` 互斥，同一时刻一个 History）：

```vue
<HistoryList ref="historyRef" ... />
<ChatBox ref="chatBoxRef" ... />
```

script：

```js
const historyRef = ref(null);
// chatBoxRef 已有

const getCurrentSessionId = () => String(sessionId.value || "");
const refreshHistoryList = async () => {
  await historyRef.value?.refresh?.();
};
const reloadCurrentSessionMessages = async () => {
  await chatBoxRef.value?.reloadCurrentSessionMessages?.();
};

defineExpose({
  getCurrentSessionId,
  refreshHistoryList,
  reloadCurrentSessionMessages
});
```

- [ ] **Step 4: 类型检查**

Run: `cd apps/web && pnpm exec vue-tsc --noEmit`  
Expected: 无新增错误

- [ ] **Step 5: Commit（web 仓）**

```bash
git add src/components/views/home/Chat.vue \
  src/components/views/home/History.vue \
  src/components/views/home/Home.vue
git commit -m "feat(home): 暴露会话消息/历史 soft 刷新供推送用"
```

---

### Task 3: PC `PersonalAiChat` 接线

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue`

**Interfaces:**
- Consumes: `runPushRefresh`、`normalizeAiBoxSendMessagePayload`、`loadAgentList`、`Home` expose
- Produces: 推送后按 plan 刷数据；仍保留联调计数/debug payload（验完再删，本任务不删）

- [ ] **Step 1: Home 加 ref**

```vue
<HomeIndex
  ref="homeRef"
  ...
/>
```

```js
const homeRef = ref(null);
```

- [ ] **Step 2: 抽 `applyAiBoxPushRefresh`，替换 TODO**

```js
import { runPushRefresh } from "./personalAiPushRefreshFlow.js";

const applyAiBoxPushRefresh = async (sessionIds) => {
  pushSessionIds.value = sessionIds;
  await runPushRefresh({
    sessionIds,
    currentSessionId: homeRef.value?.getCurrentSessionId?.() || "",
    loadAgentList,
    refreshHistory: () => homeRef.value?.refreshHistoryList?.(),
    refreshMessages: () => homeRef.value?.reloadCurrentSessionMessages?.()
  });
};

// 在 handleSelectedAgentMessage 的 aiBoxSendMessage 分支里：
// normalize → debug 计数 → await applyAiBoxPushRefresh(normalized.sessionIds)
```

注意：`loadAgentList` 已存在；调用时由 `runPushRefresh` 传入 `{ skipGetFilter: true }`。刷新后若当前 `activeAgentId` 仍在列表中须保留（现有 `loadAgentList` 已处理）。

- [ ] **Step 3: 手测清单（PC）**

1. 打开个人 AI，侧栏有列表；模拟推送（侧栏 send / 壳推送）→ 列表副标题/排序更新，对话面板不闪重挂。
2. 打开某历史会话 A，推送 `sessionIds` 含 A → Network 出现 `list` + `getSessionList` + `getMessageList`；消息区更新且未丢输入框焦点态（尽量）。
3. 停在会话 A，推送只含 B → 仅 `list`，无 `getMessageList`。

- [ ] **Step 4: Commit（web 仓）**

```bash
git add src/components/views/personal-ai/list/PersonalAiChat.vue
git commit -m "feat(personal-ai): PC 推送后按规则刷 list/历史/消息"
```

---

### Task 4: 移动 `/m/` `MPersonalAiChatWrapper` + 弹窗 History

**Files:**
- Modify: `apps/web/src/components/views/personal/m/MPersonalAiChatWrapper.vue`
- Modify: `apps/web/src/components/views/personal/m/SelectAiChatPopup.vue`

**Interfaces:**
- Consumes: 同 Task 1 的 `runPushRefresh`；Wrapper 自有 `sessionId` + `chatBoxRef` + `loadAgentList`
- Produces: 与 PC 同一套判定；弹窗内 History 通过 `popupState.historyRefreshNonce` soft 刷（独立 createApp，无法直接拿 ref）

- [ ] **Step 1: popupState 增加 nonce**

```js
const popupState = reactive({
  agents: [],
  activeId: "",
  selectId: "",
  loading: false,
  filterTypes: null,
  /** 推送情况3：递增后弹窗内 History soft 刷 */
  historyRefreshNonce: 0
});
```

- [ ] **Step 2: SelectAiChatPopup 听 nonce**

```vue
<History
  v-if="state.activeId"
  ref="historyRef"
  :key="state.activeId"
  ...
/>
```

```js
const historyRef = ref(null);

watch(
  () => props.state.historyRefreshNonce,
  async (n, prev) => {
    if (!n || n === prev) return;
    await historyRef.value?.refresh?.();
  }
);
```

- [ ] **Step 3: Wrapper `onAiBoxSendMessage` 调编排**

```js
import { runPushRefresh } from "@/components/views/personal-ai/list/personalAiPushRefreshFlow.js";

const onAiBoxSendMessage = async (source, input) => {
  const normalized = normalizeAiBoxSendMessagePayload(input, user.value?.id);
  debugPushBadgeCount.value += 1;
  debugPushPayload.value = { ...normalized, via: source, at: Date.now() };
  pushSessionIds.value = normalized.sessionIds;

  await runPushRefresh({
    sessionIds: normalized.sessionIds,
    currentSessionId: sessionId.value,
    loadAgentList,
    refreshHistory: async () => {
      popupState.historyRefreshNonce += 1;
    },
    refreshMessages: async () => {
      await chatBoxRef.value?.reloadCurrentSessionMessages?.();
    }
  });
};
```

说明：弹窗未打开时 bump nonce 无监听者，无妨；下次打开 History `onMounted` 会拉最新。情况 3 且弹窗开着时 soft 刷。

- [ ] **Step 4: 手测清单（移动）**

1. `/m/` 个人 AI：推送 → agent 列表（弹窗左栏）更新。
2. 弹窗打开 + 正在看会话 A + 推送含 A → History + Chat 消息更新。
3. `refreshViewDate` 与 postMessage 两条入口都走到同一 `onAiBoxSendMessage`。

- [ ] **Step 5: Commit（web 仓）**

```bash
git add src/components/views/personal/m/MPersonalAiChatWrapper.vue \
  src/components/views/personal/m/SelectAiChatPopup.vue
git commit -m "feat(personal-ai): 移动端推送后按同一规则刷列表"
```

---

### Task 5: 文档收尾

**Files:**
- Modify: `context/features/20260707-选择AI框/推送后列表刷新规则.md`
- Modify: `context/features/20260707-选择AI框/status.md`
- Modify: `context/features/20260707-选择AI框/3端AI框角标推送.md`（勾「刷列表」进度）

- [ ] **Step 1: 规则文档补实现落点**

在规则文末「未决」上增加「实现」：

```markdown
## 6. 实现落点（web）

- 编排：`personal-ai/list/personalAiPushRefreshFlow.js`（PC / 移动共用）
- PC：`PersonalAiChat.vue` → `Home` expose
- 移动：`MPersonalAiChatWrapper.vue` → `Chat` expose + 弹窗 `historyRefreshNonce`
- 情况 1：三端壳已保证非空才推 Web；编排内空数组仍 short-circuit（防御）
```

- [ ] **Step 2: status 待办**

将「web 按该规则落地代码」改为已完成（或 🚧→待真机 E2E）；关键决策可指向本 plan 已实施。

- [ ] **Step 3: Commit（context）**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260707-选择AI框/
git commit -m "docs(选择AI框): 推送列表刷新已落地并更新 status"
```

---

## Self-Review

| 规格点 | 任务 |
|--------|------|
| 空 sessionIds 不刷 | Task 1 |
| 有 sessionIds 必刷 list | Task 1 + 3/4 |
| 当前 session 命中刷 History + getMessageList | Task 1–4 |
| 不用 getLastSessionMessage | Global + Task 2 只用 getMessageList 路径 |
| 只刷数据不重挂 | Task 2/3（不碰 chatPaneKey） |
| PC + /m/ 一套 | Task 1 共用，Task 3/4 接线 |
| 选择弹窗不刷 | 未改 picker |

无 TBD 占位；接口名与 `推送后列表刷新规则.md` 一致。

---

## Execution Handoff

Plan 已保存到 `context/features/20260707-选择AI框/plan-推送后列表刷新.md`。

**执行方式二选一：**

1. **Subagent-Driven（推荐）** — 每任务新开 subagent，任务间 review  
2. **Inline Execution** — 本会话按 executing-plans 连续做，设检查点  

要哪种？

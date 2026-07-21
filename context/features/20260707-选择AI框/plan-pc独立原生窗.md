# PC 独立原生窗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC 个人 AI「打开独立弹窗」改为系统标题栏单例窗，打开完整 `/personal`，按 `agentId/belongId/belongType/sessionId` 默认选中，标题随左侧选中更新，并转发推送刷新。

**Architecture:** desktop 新增 `personalAiWin`（`frame: true` + `ipcNativeFrame`）；web 用 `openPersonalAiNativeWin` 协议打开 `/personal`；PC 复用入口深链匹配（对齐移动端）+ `chat-ready` 后 `selectSession` 覆盖最近会话；推送增量 `refresh-personal-ai-data` 转发到该窗。不改共用 `aiChatWin`。

**Tech Stack:** Electron IPC（desktop）；Vue 3 + vue-router（web `/personal`）；既有 `personalAiSaveSelectedFlow` / `runPushRefresh`；单测 `node --test` `.test.mjs`。

**Spec：** `context/features/20260707-选择AI框/spec-pc独立原生窗.md`

## Global Constraints

- **仅 PC**：apps/web + apps/desktop；不改 ios/android。
- **不改** 共用 `aiChatWin`（设置/其他智能体仍无边框）。
- **单例**：`personalAiWin` 关则 hide；再开 focus + 按新 query 选中。
- **打开内容**：`/personal`（完整左侧列表），禁止再走 `/home/{type}/{id}` 的 `openAiWin`。
- **深链匹配**：先 `agentId`，再 `belongType+belongId`；未命中且 belongType∈{1,3} 才 `saveSelected`；belongType=0 不 save。
- **sessionId**：`chat-ready` 之后 `selectSession`，禁止只靠 `getLastSessionMessage`。
- **推送规则**：`推送后列表刷新规则.md`；独立窗未打开不报错。
- **注释中文**；apps 提交走 `personal-ai-chat`；context 用 `docs(选择AI框): …`。
- **测试**：纯函数 `.test.mjs`；壳/窗手测。

## File Structure

**新增（web）**
- `apps/web/src/components/views/personal-ai/list/personalAiEntryDeepLink.js` — 读 query / 匹配 list（PC 用；可被移动端后续复用）
- `apps/web/src/components/views/personal-ai/tests/personalAiEntryDeepLink.test.mjs`

**修改（web）**
- `apps/web/src/pageUtils.js` — `WindowPostPersonalAiNativeWin`
- `apps/web/src/components/views/home/Chat.vue` — `handleOpenIndependent` 改协议 + 组 query（含 `sessionId`）
- `apps/web/src/components/views/home/Home.vue` — `selectSessionById(sessionId)` expose
- `apps/web/src/components/views/index/index.vue` — 透传 `selectSessionById`
- `apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue` — 深链 + session 选中 + 标题同步 + IPC 推送监听
- `apps/web/src/components/layouts/TheLayout.vue` — `ipcNativeFrame` 时隐藏自定义窗控
- `apps/web/src/components/layouts/TheLayoutIpcBar.vue` — 可选：nativeFrame 时不渲染

**修改（desktop）**
- `apps/desktop/src/main/ipc/popup-ipc.js` — create/open/refresh personal AI win
- `apps/desktop/src/renderer/views/main.vue` — 启动 `create-personal-ai-win`
- `apps/desktop/src/renderer/App.vue` — `openPersonalAiNativeWin` → invoke
- `apps/desktop/src/renderer/plugin/polling-notice/polling-personal-ai-badge.js` — emit 后 invoke refresh
- （或）`AiBrowser/index.vue` 的 `onAiBoxBadgeUpdatedInBrowser` 旁路 invoke —— **优先在 polling 成功处 invoke**，避免依赖 AiBrowser 是否挂载

**文档**
- `context/features/20260707-选择AI框/status.md` / `impl-notes.md`

**数据流**

```
Chat 点独立弹窗
  → WindowPostPersonalAiNativeWin({ path:'/personal', query })
  → desktop App openPersonalAiNativeWin
  → open-personal-ai-win → personalAiWin open-page
  → PersonalAiChat 读 query → list 匹配选中 → chat-ready → selectSessionById
  → watch 选中项 → document.title

融云 aiBoxSendMessage
  → polling getBadgePushInfo
  → iframe postMessage（不变）
  → refresh-personal-ai-data → personalAiWin → runPushRefresh
```

---

### Task 1: 深链纯函数 + 单测

**Files:**
- Create: `apps/web/src/components/views/personal-ai/list/personalAiEntryDeepLink.js`
- Create: `apps/web/src/components/views/personal-ai/tests/personalAiEntryDeepLink.test.mjs`

**Interfaces:**
- Produces:
  - `readEntryDeepLinkFromSearch(search: string) → { agentId, belongId, belongType, sessionId, aiRoleId, title }`
  - `findDeepLinkMatch(list, deepLink) → agent | null`（先 agentId/id，再 belongType+belongId）
  - `findPersonalAiAgent(list) → agent | null`
  - `hasEntryDeepLink(deepLink) → boolean`（有 agentId 或完整 belong）

- [ ] **Step 1: 写失败单测**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  readEntryDeepLinkFromSearch,
  findDeepLinkMatch,
  findPersonalAiAgent,
  hasEntryDeepLink
} from "../list/personalAiEntryDeepLink.js";

test("read query fields", () => {
  const d = readEntryDeepLinkFromSearch(
    "?agentId=a1&belongId=b1&belongType=1&sessionId=s1&aiRoleId=r1&title=张三"
  );
  assert.equal(d.agentId, "a1");
  assert.equal(d.belongId, "b1");
  assert.equal(d.belongType, 1);
  assert.equal(d.sessionId, "s1");
  assert.equal(d.aiRoleId, "r1");
  assert.equal(d.title, "张三");
});

test("findDeepLinkMatch prefers agentId", () => {
  const list = [
    { id: "x", agentId: "a1", belongId: "b1", belongType: 1, title: "A" },
    { id: "y", agentId: "a2", belongId: "b1", belongType: 1, title: "B" }
  ];
  assert.equal(findDeepLinkMatch(list, { agentId: "a1", belongId: "b1", belongType: 1 }).id, "x");
});

test("findDeepLinkMatch falls back to belong", () => {
  const list = [{ id: "y", agentId: "a2", belongId: "b9", belongType: 3, title: "G" }];
  assert.equal(
    findDeepLinkMatch(list, { agentId: "", belongId: "b9", belongType: 3 }).id,
    "y"
  );
});

test("hasEntryDeepLink", () => {
  assert.equal(hasEntryDeepLink({ agentId: "a" }), true);
  assert.equal(hasEntryDeepLink({ belongId: "b", belongType: 1 }), true);
  assert.equal(hasEntryDeepLink({ sessionId: "s" }), false);
});
```

- [ ] **Step 2: 跑测确认失败**

Run（在 `apps/web`）:
```bash
node --test src/components/views/personal-ai/tests/personalAiEntryDeepLink.test.mjs
```
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现纯函数**

```js
// personalAiEntryDeepLink.js
export const readEntryDeepLinkFromSearch = (search = "") => {
  const params = new URLSearchParams(
    String(search || "").startsWith("?") ? search : `?${search || ""}`
  );
  const belongTypeRaw = params.get("belongType");
  const belongType =
    belongTypeRaw != null && belongTypeRaw !== ""
      ? Number(belongTypeRaw)
      : null;
  return {
    agentId: (params.get("agentId") || "").trim(),
    belongId: (params.get("belongId") || "").trim(),
    belongType: Number.isFinite(belongType) ? belongType : null,
    sessionId: (params.get("sessionId") || "").trim(),
    aiRoleId: (params.get("aiRoleId") || "").trim(),
    title: (params.get("title") || "").trim()
  };
};

export const hasEntryDeepLink = (d = {}) =>
  !!d.agentId || (!!d.belongId && d.belongType != null);

export const findPersonalAiAgent = (list) =>
  (list || []).find(
    (item) =>
      item.isPersonal === true ||
      Number(item.belongType) === 0 ||
      Number(item.chatType) === 0
  ) || null;

export const findDeepLinkMatch = (list, deepLink = {}) => {
  if (!list?.length) return null;
  let matched = null;
  if (deepLink.agentId) {
    matched = list.find(
      (item) =>
        String(item.agentId || "") === String(deepLink.agentId) ||
        String(item.id || "") === String(deepLink.agentId)
    );
  }
  if (!matched && deepLink.belongId && deepLink.belongType != null) {
    matched = list.find(
      (item) =>
        String(item.belongId || "") === String(deepLink.belongId) &&
        Number(item.belongType) === Number(deepLink.belongType)
    );
  }
  return matched || null;
};
```

- [ ] **Step 4: 跑测通过**

Run: 同 Step 2  
Expected: PASS

- [ ] **Step 5: Commit（apps/web，分支 personal-ai-chat）**

```bash
git add src/components/views/personal-ai/list/personalAiEntryDeepLink.js \
  src/components/views/personal-ai/tests/personalAiEntryDeepLink.test.mjs
git commit -m "$(cat <<'EOF'
feat(个人AI): 入口深链纯函数与单测

EOF
)"
```

---

### Task 2: Home / Index 暴露按 sessionId 选中

**Files:**
- Modify: `apps/web/src/components/views/home/Home.vue`（`handleStartChat` / `defineExpose` 附近）
- Modify: `apps/web/src/components/views/index/index.vue`（`defineExpose`）

**Interfaces:**
- Consumes: `chatBoxRef.selectSession(session)`（已有，`session.id`）
- Produces: `Home.selectSessionById(sessionId: string) → Promise<void>`；Index 透传

- [ ] **Step 1: Home 增加方法并 expose**

在 `Home.vue`：

```js
const selectSessionById = async (sessionId) => {
  const id = sessionId != null ? String(sessionId).trim() : "";
  if (!id) return;
  sessionId.value = id; // 注意：与 ref 同名时用别名参数，例如 pendingId
  await chatBoxRef.value?.selectSession?.({ id });
};
```

实现时参数名用 `id` / `targetSessionId`，避免与 `const sessionId = ref("")` 阴影冲突：

```js
const selectSessionById = async (targetSessionId) => {
  const id = targetSessionId != null ? String(targetSessionId).trim() : "";
  if (!id) return;
  sessionId.value = id;
  await chatBoxRef.value?.selectSession?.({ id });
};

defineExpose({
  getCurrentSessionId,
  refreshHistoryList,
  reloadCurrentSessionMessages,
  selectSessionById
});
```

- [ ] **Step 2: Index 透传**

```js
defineExpose({
  getCurrentSessionId: () => homePageRef.value?.getCurrentSessionId?.() || "",
  refreshHistoryList: async () => {
    await homePageRef.value?.refreshHistoryList?.();
  },
  reloadCurrentSessionMessages: async () => {
    await homePageRef.value?.reloadCurrentSessionMessages?.();
  },
  selectSessionById: async (id) => {
    await homePageRef.value?.selectSessionById?.(id);
  }
});
```

- [ ] **Step 3: Commit（web）**

```bash
git commit -m "$(cat <<'EOF'
feat(个人AI): Home 支持按 sessionId 选中会话

EOF
)"
```

---

### Task 3: pageUtils 打开原生个人 AI 窗协议

**Files:**
- Modify: `apps/web/src/pageUtils.js`（`WindowPostWinMessage` 旁）

**Interfaces:**
- Produces: `WindowPostPersonalAiNativeWin(data: { path, query })`
- 消息形状：`{ type: "aiChat", data: { openPersonalAiNativeWin: 1, data: { path, query } } }`

- [ ] **Step 1: 实现**

```js
/** 打开 PC 个人 AI 系统原生窗（完整 /personal） */
export const WindowPostPersonalAiNativeWin = (data) => {
  if (isIframe()) {
    WindowPostMessage({
      openPersonalAiNativeWin: 1,
      data
    });
    return;
  }
  const { path, query } = data || {};
  const queryStr = new URLSearchParams(query || {}).toString();
  const p = (path || "/personal").replace(/^\//, "");
  window.open(
    `${import.meta.env.BASE_URL}${p}${queryStr ? `?${queryStr}` : ""}`
  );
};
```

说明：`WindowPostMessage` 已包装 `{ type: "aiChat", data }`，与现有 `openAiWin` 一致。

- [ ] **Step 2: Commit（web）**

```bash
git commit -m "$(cat <<'EOF'
feat(个人AI): 增加打开原生个人AI窗 postMessage 协议

EOF
)"
```

---

### Task 4: Chat「打开独立弹窗」改走原生个人 AI 窗

**Files:**
- Modify: `apps/web/src/components/views/home/Chat.vue`（`handleOpenIndependent`）

**Interfaces:**
- Consumes: `WindowPostPersonalAiNativeWin`；`props.sessionId`；`chatBelongs`；`Assistant.agentId`

- [ ] **Step 1: 改 handleOpenIndependent**

仅在 `hideBuiltinCollapseChrome` 头栏四按钮场景使用该按钮（已有）。实现改为：

```js
import { WindowPostPersonalAiNativeWin } from "@/pageUtils"; // 替换 WindowPostWinMessage 用于此路径

const handleOpenIndependent = () => {
  const belongType = chatBelongs?.belongType;
  const belongId = chatBelongs?.belongId;
  if (belongType == null || belongType === "" || !belongId) {
    console.warn("打开独立弹窗失败：缺少 belongType/belongId", chatBelongs);
    return;
  }
  const query = {
    agentId: Assistant.agentId || "",
    belongId: String(belongId),
    belongType: String(belongType),
    sessionId: props.sessionId ? String(props.sessionId) : "",
    aiRoleId: String(chatBelongs?.aiRoleId || Assistant.id || ""),
    title: chatBelongs?.belongName || ""
  };
  // 去掉空字符串，避免污染 URL
  Object.keys(query).forEach((k) => {
    if (query[k] === "" || query[k] == null) delete query[k];
  });
  WindowPostPersonalAiNativeWin({
    path: "/personal",
    query
  });
};
```

设置页等其它仍用 `WindowPostWinMessage` / `openAiWin`，**不要**改动。

- [ ] **Step 2: Commit（web）**

```bash
git commit -m "$(cat <<'EOF'
feat(个人AI): 独立弹窗改为打开原生 /personal 深链

EOF
)"
```

---

### Task 5: PersonalAiChat — 深链选中 + sessionId + 标题

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue`

**Interfaces:**
- Consumes: Task1 深链函数；`toSaveSelectedItemFromDeepLink` / `deepLinkSaveItemToSelection` / `saveSelectedAndReloadList`；`homeRef.selectSessionById`
- Produces: 打开后默认选中；`document.title` 随选中项 `title` 更新

- [ ] **Step 1: 读深链（支持 route.query 与 location.search）**

```js
import { useRoute } from "vue-router";
import {
  readEntryDeepLinkFromSearch,
  findDeepLinkMatch,
  findPersonalAiAgent,
  hasEntryDeepLink
} from "./personalAiEntryDeepLink.js";

const route = useRoute();

const buildSearchFromRoute = () => {
  const q = route.query || {};
  const sp = new URLSearchParams();
  Object.keys(q).forEach((k) => {
    const v = q[k];
    if (v == null || v === "") return;
    sp.set(k, Array.isArray(v) ? String(v[0]) : String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : window.location.search || "";
};

let entryDeepLink = readEntryDeepLinkFromSearch(buildSearchFromRoute());
const entryDeepLinkApplied = ref(false);
const pendingSessionId = ref(entryDeepLink.sessionId || "");
```

打开时若 query 带 `title`：`document.title = entryDeepLink.title`。

- [ ] **Step 2: 实现 resolveEntryDeepLink（对齐移动端逻辑）**

从 `MPersonalAiChatWrapper.resolveEntryDeepLink` 移植到本文件（调用 Task1 的 `findDeepLinkMatch` / `findPersonalAiAgent` + 已有 `saveSelectedAndReloadList`）。首次 `loadAgentList` 成功后调用；`entryDeepLinkApplied` one-shot。

- [ ] **Step 3: chat-ready 后选中 session**

```js
const onChatReady = async () => {
  chatReady.value = true;
  const sid = pendingSessionId.value;
  if (!sid) return;
  pendingSessionId.value = ""; // 只消费一次
  await homeRef.value?.selectSessionById?.(sid);
};
```

- [ ] **Step 4: 标题随选中更新**

```js
watch(
  () => {
    const agent = agentList.value.find((i) => i.id === activeAgentId.value);
    return agent?.title || agent?.belongName || "";
  },
  (title) => {
    if (title) document.title = title;
  }
);
```

- [ ] **Step 5: 单例再开（新 query）**

`watch(() => route.fullPath, ...)`：若仍在 personal 且 query 深链字段变化，则：
1. 重读 `entryDeepLink`
2. `entryDeepLinkApplied = false`
3. `pendingSessionId = entryDeepLink.sessionId`
4. 若已有 list，立即 `resolveEntryDeepLink(agentList)`；否则等下次 list

- [ ] **Step 6: 原生窗 IPC 推送（与 Task 8 配合，可先留 listener）**

```js
const ipcRenderer = window.webview?.ipcRenderer;
const onRefreshPersonalAiData = async (_e, payload) => {
  const sessionIds = payload?.sessionIds || [];
  await applyAiBoxPushRefresh(sessionIds);
};
onMounted(() => {
  ipcRenderer?.on?.("refresh-personal-ai-data", onRefreshPersonalAiData);
});
onBeforeUnmount(() => {
  ipcRenderer?.off?.("refresh-personal-ai-data", onRefreshPersonalAiData);
});
```

iframe 内无此事件无影响；仅 `ipcNativeFrame` / 独立窗会收到。

- [ ] **Step 7: Commit（web）**

```bash
git commit -m "$(cat <<'EOF'
feat(个人AI): PC /personal 深链选中会话并同步标题

EOF
)"
```

---

### Task 6: TheLayout 隐藏原生窗双顶栏

**Files:**
- Modify: `apps/web/src/components/layouts/TheLayout.vue`
- Modify: `apps/web/src/App.vue` 旁路：确保 `open-page` 仍可用（已有）

**Interfaces:**
- Consumes: `window.ipcNativeFrame === true`（main 注入）

- [ ] **Step 1: 注入标记可读**

`TheLayout` 在 empty 路径写 sessionStorage 时一并持久化 `ipcNativeFrame`（对齐现有 `ipcTargetIsWin`）：

```js
if (window.ipcTargetIsWin || window.ipcNativeFrame) {
  zhixinIpcData.value = {
    ipcTargetIsWin: window.ipcTargetIsWin,
    ipcNativeFrame: window.ipcNativeFrame,
    ipcTargetWebContentsId: window.ipcTargetWebContentsId
  };
}
```

- [ ] **Step 2: 模板分支**

当 `window.ipcNativeFrame || zhixinIpcData.ipcNativeFrame`：
- **不渲染** `TheLayoutIpcBar`（系统标题栏已有 min/max/close）
- 顶栏拖拽 `drag-area` 去掉或缩小，避免与系统栏冲突（可去掉整段 `absolute ... drag-area`）

保留刷新/字号可选；若顶栏过空，可只留 logo + tabs + 刷新。

- [ ] **Step 3: Commit（web）**

```bash
git commit -m "$(cat <<'EOF'
fix(个人AI): 原生窗布局隐藏自定义窗控避免双顶栏

EOF
)"
```

---

### Task 7: desktop personalAiWin 创建与打开

**Files:**
- Modify: `apps/desktop/src/main/ipc/popup-ipc.js`（`create-ai-chat-win` 旁）
- Modify: `apps/desktop/src/renderer/views/main.vue`（`create-ai-chat-win` 旁）
- Modify: `apps/desktop/src/renderer/App.vue`（`openAiWin` 旁）

**Interfaces:**
- IPC: `create-personal-ai-win` / `open-personal-ai-win` / `refresh-personal-ai-data`
- Payload open: `{ data: { path, query } }`（与 `open-ai-chat-win` 一致，web `App.vue` `open-page`）

- [ ] **Step 1: popup-ipc 创建有框单例**

```js
let personalAiWin;
ipcMain.handle("create-personal-ai-win", () => {
  const win = new BrowserWindow({
    ...winOpts,
    frame: true, // 覆盖 winOpts.frame:false
    minWidth: 1120,
    minHeight: 760,
  });
  global.personalAiWin = personalAiWin = win;
  require("@electron/remote/main").enable(win.webContents);
  win.loadURL(process.env.APP_AICHAT + "/empty", {
    extraHeaders: "pragma: no-cache\n",
  });
  win.webContents.on("did-finish-load", () => {
    win.webContents.executeJavaScript(`
      window.ipcTargetIsWin=true;
      window.ipcNativeFrame=true;
      window.myWebContentsId=${win.webContents.id};
      window.ipcTargetWebContentsId=${BrowserWindow.mainWindow.webContents.id};`);
  });
  win.on("close", (e) => {
    win.hide();
    if (!global.ZX_FOCUS_CLOSE_WIN_FLAG && !global.realQuit) {
      e.preventDefault();
    }
  });
  win.webContents.on("new-window", newWindowHandler);
});

ipcMain.handle("open-personal-ai-win", (e, payload) => {
  if (!personalAiWin) return;
  const data = payload?.data || payload || {};
  // 打开瞬间标题
  if (data.query?.title) {
    try { personalAiWin.setTitle(String(data.query.title)); } catch (err) {}
  }
  personalAiWin.webContents.send("open-page", data);
  personalAiWin.show();
  personalAiWin.setSkipTaskbar(false);
  personalAiWin.focus();
});

ipcMain.handle("refresh-personal-ai-data", (e, payload) => {
  if (!personalAiWin || personalAiWin.isDestroyed()) return;
  try {
    personalAiWin.webContents.send("refresh-personal-ai-data", payload || {});
  } catch (err) {}
});
```

注意：`winOpts` 含 `frame: false`，必须显式 `frame: true` 覆盖。

- [ ] **Step 2: main.vue 启动创建**

在 `create-ai-chat-win` 旁：

```js
ipcRenderer.invoke("create-personal-ai-win");
```

- [ ] **Step 3: App.vue 处理消息**

在 `case "aiChat"` 内 `openAiWin` 旁：

```js
if (data.openPersonalAiNativeWin) {
  ipcRenderer.invoke("open-personal-ai-win", data);
}
```

- [ ] **Step 4: Commit（desktop，分支 personal-ai-chat）**

```bash
git commit -m "$(cat <<'EOF'
feat(个人AI): 系统标题栏单例窗 personalAiWin

EOF
)"
```

---

### Task 8: 推送转发到 personalAiWin

**Files:**
- Modify: `apps/desktop/src/renderer/plugin/polling-notice/polling-personal-ai-badge.js`

**Interfaces:**
- Consumes: `setupPolling` 成功后的 `sessionIds`
- Produces: `ipcRenderer.invoke("refresh-personal-ai-data", { sessionIds })`

- [ ] **Step 1: 在 getBadgePushInfo 成功且 emit 之后 invoke**

```js
import { ipcRenderer } from "electron"; // 或项目既有取法

// 在 window.eventHub.$emit("ai-box-badge-updated", ...) 之后：
try {
  ipcRenderer.invoke("refresh-personal-ai-data", {
    sessionIds: (payload && payload.sessionIds) || []
  });
} catch (e) {
  console.warn("[aiBoxSendMessage] refresh-personal-ai-data failed", e);
}
```

保持 AiBrowser iframe `postMessage` 不变。

- [ ] **Step 2: Commit（desktop）**

```bash
git commit -m "$(cat <<'EOF'
feat(个人AI): 角标推送转发到原生独立窗

EOF
)"
```

---

### Task 9: 文档收尾

**Files:**
- Modify: `context/features/20260707-选择AI框/status.md`
- Modify: `context/features/20260707-选择AI框/impl-notes.md`（补「PC 独立原生窗」小节）

- [ ] **Step 1: status 矩阵勾选 / 待办**

记录：desktop 原生窗 + web 深链 session + 推送转发；待 E2E。

- [ ] **Step 2: impl-notes 沉淀**

要点：协议字段、`ipcNativeFrame`、session 在 chat-ready 后选中、推送双通道（iframe + IPC）。

- [ ] **Step 3: Commit（context）**

```bash
git add -A && git commit -m "$(cat <<'EOF'
docs(选择AI框): PC独立原生窗实现说明与状态

EOF
)"
```

---

### Task 10: 手测验收（对照 spec）

- [ ] iframe 内点独立弹窗 → 系统标题栏窗，内容为左侧列表+对话
- [ ] 选中与打开前一致；有 sessionId 时不是被最近会话覆盖
- [ ] 切换左侧 → 系统标题变
- [ ] 推送：独立窗 list/消息按规则刷新；主窗 iframe 仍刷新
- [ ] 设置仍走无边框 `aiChatWin`
- [ ] 关窗再开：单例 + 新 query 生效

---

## Spec coverage（自检）

| Spec 要求 | Task |
|-----------|------|
| `frame:true` 单例 personalAiWin | 7 |
| 打开 `/personal` + query 字段 | 3、4 |
| 深链匹配 + saveSelected | 1、5 |
| sessionId 默认选中 | 2、5 |
| 标题随左侧选中 | 5、7（首开 setTitle） |
| 推送转发 | 5 listener、8 |
| 无双顶栏 | 6 |
| 不改 aiChatWin | 4/7 隔离 |
| status/impl-notes | 9 |

## Placeholder scan

无 TBD /「类似 Task N」未展开项。

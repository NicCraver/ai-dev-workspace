# AI框 Version 检测与选中恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。

**Goal:** PC 从左侧会话 / AiBrowser tab 等入口再次点进 AI 框时，静默对比 `/ai-chat/build_version`；版本变更则强制刷新页面，并用持久化的 `agentId`/`belongId`/`belongType` 恢复刷新前选中的 AI 框会话。

**Architecture:** Web 端维护选中三元组到 `sessionStorage`；暴露纯函数对比 `JENKINS_BUILD_NUMBER` 与线上 `build_version`。Desktop AiBrowser 在切到 `aiId=0` 时向 iframe `postMessage` 触发检测；web 收到后验版，不一致则 `location.reload()`（静默，不弹确认）。刷新后启动路径优先 URL 深链，其次读 `sessionStorage`，复用既有 `findDeepLinkMatch` / `resolveEntryDeepLink` 选中逻辑。`router.onError` 懒加载失败提示保留作兜底。

**Tech Stack:** apps/web（Vue 3）+ apps/desktop AiBrowser（Vue 2.7，禁 `?.`/`??`）；既有 `build_version` / `JENKINS_BUILD_NUMBER` / `personalAiEntryDeepLink.js`。

## Global Constraints

- **范围**：`apps/web`（主）+ `apps/desktop` AiBrowser 触发；**本期不做** ios/android 回前台验版（可复用同模块，另开任务）。
- **交互**：version 变更 → **静默刷新**，不弹「是否更新」。
- **恢复粒度**：只恢复「选中哪个 AI 框」三元组；不强制钉死某条 `sessionId`（续聊仍走现有 lastChatAt / 24h）。
- **匹配优先级**：URL 入口深链 > `sessionStorage` 恢复 > 默认首项（个人框）。
- **agentId 可空**：个人框 / 未补齐时允许；匹配与深链一致——有真实 `agentId` 先按它，否则 `belongId+belongType`。
- **Desktop**：AiBrowser `pageUrlMap` 保活；验版失败/需刷新时由 **iframe 内 reload**（不必改 `src`）；同一会话内 `sessionStorage` 在同 origin reload 后仍在。
- **构建**：CI 须写入 `BUILD_NUMBER`；本地 `NOT_JENKINS_CI` / `NOT_CI` 时检测应 **跳过刷新**（避免开发环境误刷）。
- **分支**：只 push `personal-ai-chat`；context `docs(选择AI框): ...`。

---

## 目标时序

```text
用户从左侧会话 / sider / AiBrowser tab 点进 AI框（aiId=0）
  → Desktop postMessage { source:"zx-pc", type:"aiBoxCheckVersion" }
  → Web 收到（或 document 从隐藏变可见的兜底，可选）
  → fetch("/ai-chat/build_version", { cache:"no-cache" })
  → 解析 build_number，与 JENKINS_BUILD_NUMBER 比较
       ├─ 相同 / 本地 NOT_CI → no-op
       └─ 不同
            → 确保 sessionStorage 已写入当前选中三元组（平时已持续写）
            → location.reload()（或 location.href = location.href）
            → 启动：getFilter → list
            → 恢复选中：URL 深链（若有）否则 sessionStorage 三元组
                 → findDeepLinkMatch → 选中（未命中且 1|3 可走既有 saveSelected 路径）
```

选中态写入时机（与验版解耦）：

```text
activeAgent 变化（点列表 / 弹窗确定 / 深链选中 / 原生回传）
  → writeActiveSelection({ agentId, belongId, belongType })
```

---

## File Structure

**新建：**

| 文件 | 职责 |
|------|------|
| `apps/web/src/components/views/personal-ai/list/personalAiActiveSelection.js` | sessionStorage 读写选中三元组；与深链 shape 对齐 |
| `apps/web/src/components/views/personal-ai/list/personalAiBuildVersion.js` | fetch + 解析 + `shouldForceReload`；触发 reload 封装 |
| `apps/web/src/components/views/personal-ai/tests/personalAiActiveSelection.test.mjs` | 读写 / 空值 / 非法 JSON |
| `apps/web/src/components/views/personal-ai/tests/personalAiBuildVersion.test.mjs` | 比较逻辑纯函数单测 |

**修改：**

| 文件 | 改动 |
|------|------|
| `PersonalAiChat.vue` | watch 选中写入；启动恢复；听 `aiBoxCheckVersion` |
| `MPersonalAiChatWrapper.vue` | 同上（移动端先接线，触发源本期可不做原生） |
| `apps/desktop/.../AiBrowser/index.vue` | `selectPage` / 切到 AI框 时 postMessage |
| `context/bridge.md`（若已有 postMessage 约定表） | 登记 `aiBoxCheckVersion` |
| `status.md` / 本 plan 勾选 | 收尾 |

**不改：** `mergeDist.js` / `vite` define（已有）；`router.onError` 保留。

---

### Task 1: 选中三元组持久化纯模块

**Files:**
- Create: `apps/web/src/components/views/personal-ai/list/personalAiActiveSelection.js`
- Test: `apps/web/src/components/views/personal-ai/tests/personalAiActiveSelection.test.mjs`

**Interfaces:**
- Produces:
  - `PERSONAL_AI_ACTIVE_SELECTION_KEY = "personal-ai:active-selection"`
  - `writeActiveSelection(selection: { agentId?: string, belongId?: string, belongType?: number|null }, storage?: Storage): void`
  - `readActiveSelection(storage?: Storage): { agentId: string, belongId: string, belongType: number|null } | null`
  - `clearActiveSelection(storage?: Storage): void`
  - `hasActiveSelection(d): boolean` — 与 `hasEntryDeepLink` 同语义

- [ ] **Step 1: 写失败单测**

```js
import assert from "node:assert/strict";
import {
  writeActiveSelection,
  readActiveSelection,
  clearActiveSelection,
  hasActiveSelection,
  PERSONAL_AI_ACTIVE_SELECTION_KEY
} from "../list/personalAiActiveSelection.js";

const mem = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
};

{
  const s = mem();
  writeActiveSelection(
    { agentId: "a1", belongId: "b1", belongType: 1 },
    s
  );
  assert.deepEqual(readActiveSelection(s), {
    agentId: "a1",
    belongId: "b1",
    belongType: 1
  });
  assert.equal(hasActiveSelection(readActiveSelection(s)), true);
}

{
  const s = mem();
  writeActiveSelection({ belongId: "0", belongType: 0 }, s);
  assert.deepEqual(readActiveSelection(s), {
    agentId: "",
    belongId: "0",
    belongType: 0
  });
}

{
  const s = mem();
  s.setItem(PERSONAL_AI_ACTIVE_SELECTION_KEY, "{");
  assert.equal(readActiveSelection(s), null);
}

{
  const s = mem();
  writeActiveSelection({ agentId: "x", belongId: "y", belongType: 3 }, s);
  clearActiveSelection(s);
  assert.equal(readActiveSelection(s), null);
}
```

- [ ] **Step 2: 跑测确认失败**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/personalAiActiveSelection.test.mjs
```

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现模块**

```js
export const PERSONAL_AI_ACTIVE_SELECTION_KEY = "personal-ai:active-selection";

const defaultStorage = () =>
  typeof sessionStorage !== "undefined" ? sessionStorage : null;

export const hasActiveSelection = (d = {}) =>
  !!d.agentId || (!!d.belongId && d.belongType != null);

export const writeActiveSelection = (selection = {}, storage) => {
  const store = storage || defaultStorage();
  if (!store) return;
  const agentId = String(selection.agentId || "").trim();
  const belongId = String(selection.belongId || "").trim();
  const belongTypeRaw = selection.belongType;
  const belongType =
    belongTypeRaw != null && belongTypeRaw !== ""
      ? Number(belongTypeRaw)
      : null;
  const payload = {
    agentId,
    belongId,
    belongType: Number.isFinite(belongType) ? belongType : null
  };
  if (!hasActiveSelection(payload)) return;
  store.setItem(PERSONAL_AI_ACTIVE_SELECTION_KEY, JSON.stringify(payload));
};

export const readActiveSelection = (storage) => {
  const store = storage || defaultStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(PERSONAL_AI_ACTIVE_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const agentId = String(parsed.agentId || "").trim();
    const belongId = String(parsed.belongId || "").trim();
    const belongType =
      parsed.belongType != null && parsed.belongType !== ""
        ? Number(parsed.belongType)
        : null;
    const out = {
      agentId,
      belongId,
      belongType: Number.isFinite(belongType) ? belongType : null
    };
    return hasActiveSelection(out) ? out : null;
  } catch {
    return null;
  }
};

export const clearActiveSelection = (storage) => {
  const store = storage || defaultStorage();
  if (!store) return;
  store.removeItem(PERSONAL_AI_ACTIVE_SELECTION_KEY);
};
```

- [ ] **Step 4: 跑测通过**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/personalAiActiveSelection.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit（web）**

```bash
cd apps/web && git add src/components/views/personal-ai/list/personalAiActiveSelection.js \
  src/components/views/personal-ai/tests/personalAiActiveSelection.test.mjs && \
git commit -m "$(cat <<'EOF'
feat(personal-ai): 选中三元组 sessionStorage 读写

EOF
)"
```

---

### Task 2: build_version 检测纯模块

**Files:**
- Create: `apps/web/src/components/views/personal-ai/list/personalAiBuildVersion.js`
- Test: `apps/web/src/components/views/personal-ai/tests/personalAiBuildVersion.test.mjs`

**Interfaces:**
- Consumes: 无（`JENKINS_BUILD_NUMBER` 由调用方传入，便于单测）
- Produces:
  - `parseBuildVersionPayload(text: string): { build_number: string } | null`
  - `shouldForceReloadForBuild({ localBuildNumber: string, remoteBuildNumber: string|null }): boolean`
  - `fetchRemoteBuildNumber(fetchImpl?: typeof fetch): Promise<string|null>`
  - `checkAndReloadIfStale(options): Promise<"reloaded"|"skip"|"error">`

- [ ] **Step 1: 写失败单测**

```js
import assert from "node:assert/strict";
import {
  parseBuildVersionPayload,
  shouldForceReloadForBuild
} from "../list/personalAiBuildVersion.js";

assert.deepEqual(
  parseBuildVersionPayload(
    JSON.stringify({ build_number: "123", branch: "x" })
  ),
  { build_number: "123" }
);
assert.equal(parseBuildVersionPayload("not-json"), null);
assert.equal(parseBuildVersionPayload(""), null);

assert.equal(
  shouldForceReloadForBuild({
    localBuildNumber: "100",
    remoteBuildNumber: "101"
  }),
  true
);
assert.equal(
  shouldForceReloadForBuild({
    localBuildNumber: "100",
    remoteBuildNumber: "100"
  }),
  false
);
assert.equal(
  shouldForceReloadForBuild({
    localBuildNumber: "NOT_JENKINS_CI",
    remoteBuildNumber: "101"
  }),
  false
);
assert.equal(
  shouldForceReloadForBuild({
    localBuildNumber: "100",
    remoteBuildNumber: "NOT_CI"
  }),
  false
);
assert.equal(
  shouldForceReloadForBuild({
    localBuildNumber: "100",
    remoteBuildNumber: null
  }),
  false
);
```

- [ ] **Step 2: 跑测确认失败**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/personalAiBuildVersion.test.mjs
```

Expected: FAIL

- [ ] **Step 3: 实现模块**

```js
const SKIP_MARKERS = ["NOT_JENKINS_CI", "NOT_CI", ""];

export const parseBuildVersionPayload = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    const build_number = String(json.build_number ?? "").trim();
    if (!build_number) return null;
    return { build_number };
  } catch {
    // 兼容极端情况：纯数字文本
    if (/^\d+$/.test(raw)) return { build_number: raw };
    return null;
  }
};

export const shouldForceReloadForBuild = ({
  localBuildNumber,
  remoteBuildNumber
}) => {
  const local = String(localBuildNumber || "").trim();
  const remote = String(remoteBuildNumber || "").trim();
  if (SKIP_MARKERS.includes(local) || SKIP_MARKERS.includes(remote)) {
    return false;
  }
  if (!local || !remote) return false;
  return local !== remote;
};

export const fetchRemoteBuildNumber = async (fetchImpl = fetch) => {
  const res = await fetchImpl("/ai-chat/build_version", {
    cache: "no-cache"
  });
  if (!res.ok) return null;
  const text = await res.text();
  return parseBuildVersionPayload(text)?.build_number ?? null;
};

/**
 * @param {{
 *   localBuildNumber?: string,
 *   fetchImpl?: typeof fetch,
 *   reload?: () => void
 * }} [options]
 */
export const checkAndReloadIfStale = async (options = {}) => {
  const localBuildNumber =
    options.localBuildNumber ??
    (typeof JENKINS_BUILD_NUMBER !== "undefined"
      ? JENKINS_BUILD_NUMBER
      : "NOT_JENKINS_CI");
  const reload =
    options.reload ||
    (() => {
      location.reload();
    });
  try {
    const remote = await fetchRemoteBuildNumber(options.fetchImpl);
    if (
      !shouldForceReloadForBuild({
        localBuildNumber,
        remoteBuildNumber: remote
      })
    ) {
      return "skip";
    }
    reload();
    return "reloaded";
  } catch (e) {
    console.warn("[personal-ai] build_version check failed", e);
    return "error";
  }
};
```

- [ ] **Step 4: 跑测通过**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/personalAiBuildVersion.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit（web）**

```bash
cd apps/web && git add src/components/views/personal-ai/list/personalAiBuildVersion.js \
  src/components/views/personal-ai/tests/personalAiBuildVersion.test.mjs && \
git commit -m "$(cat <<'EOF'
feat(personal-ai): build_version 对比与强制刷新纯函数

EOF
)"
```

---

### Task 3: PersonalAiChat 写入选中 + 启动恢复

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue`
- Modify: `apps/web/src/components/views/personal/m/MPersonalAiChatWrapper.vue`（对称：写 + 恢复；验版触发可后置）

**Interfaces:**
- Consumes: `writeActiveSelection` / `readActiveSelection` / `hasActiveSelection`；`findDeepLinkMatch` / `resolveEntryDeepLink` 既有路径
- Produces: 刷新后能从 storage 恢复选中（无 URL 深链时）

- [ ] **Step 1: 从当前 agent 抽出三元组 helper（同文件或小函数）**

```js
const toSelectionFromAgent = (agent) => {
  if (!agent) return null;
  return {
    agentId: agent.agentId ? String(agent.agentId) : "",
    belongId:
      agent.belongId != null && agent.belongId !== ""
        ? String(agent.belongId)
        : "",
    belongType:
      agent.belongType != null ? Number(agent.belongType) : null
  };
};
```

- [ ] **Step 2: watch `activeAgentId` + `agentList`，变化则 `writeActiveSelection`**

仅在能解析出 `hasActiveSelection` 时写入；隐藏/列表刷新导致短暂空选中不要 `clear`（避免刷新窗口丢态）。

- [ ] **Step 3: 改启动选中优先级**

在 `loadAgentList` 首次路径中，现有顺序改为：

1. `await resolveEntryDeepLink(list)`（URL 有参）
2. 若未写入选中：`const stored = readActiveSelection()`；有则 `findDeepLinkMatch(list, stored)` → `selectAgentFromList`；未命中且 belongType 1|3 可复用深链 save 路径（把 `stored` 当 deepLink），失败回落个人框
3. 仍无选中 → 默认首项

注意：storage 恢复 **不要** 设 `entryDeepLinkApplied` 挡掉真正的 URL 深链；URL 优先已由步骤 1 保证。

- [ ] **Step 4: 手动 / 单测旁路**

纯匹配已有 `personalAiEntryDeepLink.test.mjs`；本任务以手工：选中私聊 → DevTools Application 见 key → `location.reload()` → 仍选中同一框。

- [ ] **Step 5: Commit（web）**

```bash
cd apps/web && git add \
  src/components/views/personal-ai/list/PersonalAiChat.vue \
  src/components/views/personal/m/MPersonalAiChatWrapper.vue && \
git commit -m "$(cat <<'EOF'
feat(personal-ai): 选中态落盘并在刷新后恢复

EOF
)"
```

---

### Task 4: Web 响应 `aiBoxCheckVersion` 并验版刷新

**Files:**
- Modify: `PersonalAiChat.vue`（PC iframe 主路径）
- Modify: `MPersonalAiChatWrapper.vue`（可选对称监听，便于日后移动端壳触发）

**Interfaces:**
- Consumes: `checkAndReloadIfStale`
- Message shape（与推送同族）:
  ```js
  { source: "zx-pc", type: "aiBoxCheckVersion" }
  ```
  兼容 `JSON.stringify` 字符串 payload（对齐 `aiBoxSendMessage` 解析）。

- [ ] **Step 1: 在既有 `message` / IPC 监听旁增加分支**

```js
if (message.source === "zx-pc" && message.type === "aiBoxCheckVersion") {
  // 先落盘当前选中，再验版
  const agent = agentList.value.find((i) => i.id === activeAgentId.value);
  writeActiveSelection(toSelectionFromAgent(agent) || {});
  void checkAndReloadIfStale();
  return;
}
```

防抖：同一页面 5s 内只检测一次（模块内 `lastCheckAt` 或组件 `let`），避免连点 tab 重复 fetch。

- [ ] **Step 2: 本地验证**

1. DevTools 模拟：
   ```js
   window.postMessage(
     JSON.stringify({ source: "zx-pc", type: "aiBoxCheckVersion" }),
     "*"
   );
   ```
2. Network 应出现 `build_version`；本地 `NOT_JENKINS_CI` → 不 reload。
3. 临时改 `shouldForceReloadForBuild` 或 mock fetch 返回另一 build_number → 应 reload 且选中恢复。

- [ ] **Step 3: Commit（web）**

```bash
cd apps/web && git add \
  src/components/views/personal-ai/list/PersonalAiChat.vue \
  src/components/views/personal/m/MPersonalAiChatWrapper.vue && \
git commit -m "$(cat <<'EOF'
feat(personal-ai): 响应 aiBoxCheckVersion 静默验版刷新

EOF
)"
```

---

### Task 5: Desktop AiBrowser 切到 AI框时触发检测

**Files:**
- Modify: `apps/desktop/src/renderer/views/AiBrowser/index.vue`
- Docs: `context/bridge.md`（若有 PC→iframe 消息表则补一行）

**Interfaces:**
- Consumes: 既有 personal iframe 查找（对齐 `aiBoxSendMessage` post 逻辑）
- Produces: 切到 `aiId === "0"` 时 `contentWindow.postMessage`

- [ ] **Step 1: 抽 `postToPersonalAiFrame(message)`（若尚未统一）**

复用现有找 iframe：`dataset.aiPageId === "0"`。payload：

```js
{
  source: "zx-pc",
  type: "aiBoxCheckVersion"
}
```

**禁止** optional chaining（desktop 约束）。

- [ ] **Step 2: 在切 tab 成功且目标为 AI框时调用**

挂点：`selectPage` / `mountPage` 后、`activePageId` 变为 `PERSONAL_AI_TOOL_ID` 的 watch，满足：

- 从**非 AI框**切到 AI框 → 必发
- 已在 AI框再点一次 → 可发（web 侧 5s 防抖）
- iframe 尚未 `loadedMap` / 无 contentWindow → skip（首次加载自然是新包）

示例（示意，按现有函数名嵌入）：

```js
const notifyPersonalAiCheckVersion = () => {
  if (!el.value) return;
  const frames = Array.from(el.value.querySelectorAll("iframe") || []);
  const frame = frames.find(function (item) {
    return String(item.dataset.aiPageId) === PERSONAL_AI_TOOL_ID;
  });
  if (!frame || !frame.contentWindow) return;
  frame.contentWindow.postMessage(
    {
      source: "zx-pc",
      type: "aiBoxCheckVersion"
    },
    "*"
  );
};
```

在 `activePageId` 变为 `"0"` 时调用。

- [ ] **Step 3: 左侧菜单进 AI框**

确认 `main.vue` `@ai-sider-item` → AiBrowser 切 tab 路径最终会改 `activePageId`；若另有「只显示不切 id」分支，在该入口补一次 `notifyPersonalAiCheckVersion`。

- [ ] **Step 4: 真机/本地 E2E 清单**

1. 打开 PC → 进 AI框 → 选中某私聊/群 → 切到左侧普通会话 → 再点 AI框：Network 有 `build_version`，version 相同不闪屏。
2. 部署新包（或改远端 `build_version`）→ 再点进 AI框：iframe 刷新，选中仍是刷新前那个。
3. 首次从未打开过 AI框：点进只加载，不因缺 iframe 报错。

- [ ] **Step 5: Commit（desktop）**

```bash
cd apps/desktop && git add src/renderer/views/AiBrowser/index.vue && \
git commit -m "$(cat <<'EOF'
feat(AiBrowser): 切到 AI框时通知 iframe 验 build_version

EOF
)"
```

---

### Task 6: 文档与 status

**Files:**
- Modify: `context/features/20260707-选择AI框/status.md`
- Modify: 本文件勾选
- Modify: `impl-notes.md`（联调后补「Version 检测」小节）
- Optional: `context/bridge.md` 消息类型表

- [ ] **Step 1: status 平台矩阵新增一行或待办**

示例待办：

```markdown
- (web / desktop) **常驻页 version 检测**：切回 AI框 → `aiBoxCheckVersion` → 对比 `build_version`；变更静默 reload；`sessionStorage` 恢复 agentId/belongId/belongType。方案 `plan-version检测与选中恢复.md`。**待 E2E**
```

- [ ] **Step 2: context commit**

```bash
cd /Users/nic/w/ai-dev-workspace && git add \
  context/features/20260707-选择AI框/plan-version检测与选中恢复.md \
  context/features/20260707-选择AI框/status.md \
  context/bridge.md && \
git commit -m "$(cat <<'EOF'
docs(选择AI框): version 检测与选中恢复开发计划

EOF
)"
```

---

## 非目标（本期不做）

- 常驻在 AI框 tab 内的定时轮询
- 刷新后恢复具体 `sessionId` / History 滚动位置
- ios/android WebView 回前台验版（模块可复用，触发另开）
- 替换或删除 `router.onError` 懒加载失败提示

---

## Self-Review

| 需求 | 对应任务 |
|------|----------|
| 点进 AI框时 version 检测 | T4 + T5 |
| 维护 agentId/belongId/belongType | T1 + T3 |
| 强制刷新后恢复会话（选中框） | T3 |
| 静默、复用 build_version | T2 |
| 本地 CI 标记不误刷 | T2 `shouldForceReloadForBuild` |
| Desktop 保活 iframe 仍能更新 | T5 postMessage + iframe reload |

无 TBD / 占位步骤；类型名与深链模块对齐。

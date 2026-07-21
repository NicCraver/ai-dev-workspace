# 页面可见时 build_version 验版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。

**Goal:** Web 端用 VueUse `useDocumentVisibility`，在页面从隐藏变为可见时拉 `/ai-chat/build_version`，与本地 `JENKINS_BUILD_NUMBER` 对比；不一致则静默强刷，并用已有 `sessionStorage` 三元组恢复选中的 AI 框。

**Architecture:** 复用既有 `checkAndReloadIfStale` / `writeActiveSelection` / 启动恢复链路，不新增 HTTP 模块。PC `PersonalAiChat.vue`（及对称的移动端 Wrapper）在 `visibility === 'visible'` 且相对上一态从非 visible 切入时触发验版。desktop 的 `aiBoxCheckVersion` **本期不改、不删**（AiBrowser 内 tab 切换的兜底）；与 visibility 双触发时靠现有 5s 防抖合并。恢复粒度仍为选中三元组（`agentId`/`belongId`/`belongType`），不恢复具体 `sessionId`。

**Tech Stack:** apps/web Vue 3 + `@vueuse/core` `useDocumentVisibility`；既有 `personalAiBuildVersion.js` / `personalAiActiveSelection.js`。

## Global Constraints

- **范围：只改 web**；不动 `apps/desktop`（含 `notifyPersonalAiCheckVersion`）。
- **触发：** `document.visibilityState` 经 VueUse 暴露；**禁止** `watch(..., { immediate: true })`（避免首屏已 visible 时多余打接口）。
- **交互：** version 变更 → **静默** `location.reload()`，不弹确认（`router.onError` 懒加载失败提示保留不动）。
- **本地：** `NOT_JENKINS_CI` / `NOT_CI` 跳过刷新（`shouldForceReloadForBuild` 已实现）。
- **防抖：** 复用 `checkAndReloadIfStale` 内 5s；visibility 与 `aiBoxCheckVersion` 共用同一时钟。
- **恢复：** URL 深链 > `sessionStorage` > 默认个人 AI 框（既有逻辑）；本期不钉 `sessionId`。
- **分支：** 只 push `personal-ai-chat`；context 提交 `docs(选择AI框): ...`。
- **覆盖预期：** 最左对话/智邮 → AI框（父级 `v-show`）多数能触发 visibility；AiBrowser 内 deepseek→AI框 tab **可能不触发**，依赖既有桌面 postMessage。

---

## 目标时序

```text
页面 / iframe 文档：hidden → visible（useDocumentVisibility）
  → 落盘当前选中三元组（writeActiveSelection）
  → checkAndReloadIfStale()
       → GET /ai-chat/build_version { cache: "no-cache" }
       → 解析 build_number，与 JENKINS_BUILD_NUMBER 比较
            ├─ 相同 / NOT_CI / 防抖 → skip
            └─ 不同 → location.reload()
                 → 启动：getFilter → list
                 → 恢复选中：深链 / sessionStorage / 个人框
```

回参形状示例（线上静态文件）：

```json
{
  "branch": "test-202512",
  "commit": "c5afeea750af4befc28559dd6b6e0e3717b17dbf",
  "build_number": "19555",
  "build_time": 1784656679050
}
```

对比字段仅用 **`build_number`**（与现实现一致）。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `apps/web/.../PersonalAiChat.vue` | PC：挂 `useDocumentVisibility` + watch；抽本地 `runVersionCheckOnActivate` |
| `apps/web/.../MPersonalAiChatWrapper.vue` | 移动端对称（回前台验版）；同函数 |
| `context/.../status.md` | 待办改为「页面可见触发」+ 保留桌面兜底说明 |
| `context/.../impl-notes.md` | 「Version 检测」小节补 visibility 触发 |
| `context/bridge.md` | 一行说明：web 另有 visibility 触发；桌面 postMessage 仍保留 |

**不改：** `personalAiBuildVersion.js`（逻辑已够）、`mergeDist.js`、desktop AiBrowser、`router.onError`。

---

### Task 1: PersonalAiChat 接入 useDocumentVisibility

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue`

**Interfaces:**
- Consumes: `useDocumentVisibility` from `@vueuse/core`；既有 `writeActiveSelection` / `toSelectionFromAgent` / `checkAndReloadIfStale` / `activeAgentId` / `agentList`
- Produces: `runVersionCheckOnActivate()` — 落盘当前选中后调用 `checkAndReloadIfStale`；visibility watch 与既有 `aiBoxCheckVersion` 分支共用它

- [ ] **Step 1: 增加 import**

在 script setup 现有 VueUse / 本地 import 旁增加：

```js
import { useDocumentVisibility } from "@vueuse/core";
```

（若本文件已有 `@vueuse/core` 其它 import，合并到同一条。）

- [ ] **Step 2: 抽出共用激活验版函数，并改 postMessage 分支**

放在 `toSelectionFromAgent` / `checkAndReloadIfStale` import 之后、`handleSelectedAgentMessage` 之前均可：

```js
/** 页面激活 / 壳通知：落盘选中后对比 build_version */
const runVersionCheckOnActivate = () => {
  const agent = agentList.value.find((i) => i.id === activeAgentId.value);
  writeActiveSelection(toSelectionFromAgent(agent) || {});
  void checkAndReloadIfStale();
};
```

将现有：

```js
if (message.source === "zx-pc" && message.type === "aiBoxCheckVersion") {
  const agent = agentList.value.find((i) => i.id === activeAgentId.value);
  writeActiveSelection(toSelectionFromAgent(agent) || {});
  void checkAndReloadIfStale();
  return;
}
```

改为：

```js
if (message.source === "zx-pc" && message.type === "aiBoxCheckVersion") {
  runVersionCheckOnActivate();
  return;
}
```

- [ ] **Step 3: 挂 visibility watch（无 immediate）**

```js
const visibility = useDocumentVisibility();

watch(visibility, (state, prev) => {
  if (state !== "visible") return;
  // 仅从非 visible 切入；首屏已 visible 时无 prev 变化不会走这里（无 immediate）
  if (prev === "visible") return;
  runVersionCheckOnActivate();
});
```

说明：默认 `watch` 无 `immediate`，挂载时不会打接口；用户切走再切回（`hidden`→`visible`）才会跑。

- [ ] **Step 4: 本地手动验证**

1. 浏览器打开 `/zx/personal`（或 PC iframe），DevTools Console：

```js
// 模拟 hidden→visible（部分环境可改 visibilityState；不行则切系统其它窗再切回）
document.dispatchEvent(new Event("visibilitychange"));
```

更稳：把 DevTools 停靠到独立窗 / 切到其它应用再切回 → Network 应出现 `build_version`；本地 `NOT_JENKINS_CI` → 不 reload。

2. 确认首屏加载 **不会** 多打一次 `build_version`（相对加 watch 前）。

3. 既有：`postMessage({source:'zx-pc',type:'aiBoxCheckVersion'},'*')` 仍走同一函数。

- [ ] **Step 5: Commit（web）**

```bash
cd apps/web && git add \
  src/components/views/personal-ai/list/PersonalAiChat.vue && \
git commit -m "$(cat <<'EOF'
feat(personal-ai): 页面可见时对比 build_version 强刷

EOF
)"
```

---

### Task 2: MPersonalAiChatWrapper 对称接入

**Files:**
- Modify: `apps/web/src/components/views/personal/m/MPersonalAiChatWrapper.vue`

**Interfaces:**
- Consumes / Produces：与 Task 1 同名 `runVersionCheckOnActivate`；已有 `aiBoxCheckVersion` 分支改调它

- [ ] **Step 1: import `useDocumentVisibility`**

```js
import { useDocumentVisibility } from "@vueuse/core";
```

- [ ] **Step 2: 抽出 `runVersionCheckOnActivate`，替换 postMessage 分支**

与 Task 1 相同实现（本文件已有 `toSelectionFromAgent` / `writeActiveSelection` / `checkAndReloadIfStale` / `agentList` / `activeAgentId`）：

```js
const runVersionCheckOnActivate = () => {
  const agent = agentList.value.find((i) => i.id === activeAgentId.value);
  writeActiveSelection(toSelectionFromAgent(agent) || {});
  void checkAndReloadIfStale();
};
```

```js
if (message.source === "zx-pc" && message.type === "aiBoxCheckVersion") {
  runVersionCheckOnActivate();
  return;
}
```

- [ ] **Step 3: visibility watch**

```js
const visibility = useDocumentVisibility();

watch(visibility, (state, prev) => {
  if (state !== "visible") return;
  if (prev === "visible") return;
  runVersionCheckOnActivate();
});
```

确认本文件已从 `vue` 导入 `watch`；若无则补上。

- [ ] **Step 4: 真机/模拟器快速验**

切到其它 App 再回个人 AI WebView → 应请求 `build_version`（test 包若 NOT_CI 则不 reload）。失败仅 console warn，不阻断。

- [ ] **Step 5: Commit（web）**

```bash
cd apps/web && git add \
  src/components/views/personal/m/MPersonalAiChatWrapper.vue && \
git commit -m "$(cat <<'EOF'
feat(personal-ai): 移动端页面可见时验 build_version

EOF
)"
```

---

### Task 3: 文档与 status

**Files:**
- Modify: `context/features/20260707-选择AI框/status.md`
- Modify: `context/features/20260707-选择AI框/impl-notes.md`（「常驻页 Version 检测」小节）
- Modify: `context/bridge.md`（`aiBoxCheckVersion` 旁注）
- Modify: 本文件勾选

- [x] **Step 1: 更新 status 待办**

将「常驻页 version 检测」相关条改为类似：

```markdown
- (web / desktop) **页面可见验版**：web 用 `useDocumentVisibility`（hidden→visible）拉 `/ai-chat/build_version`，不一致静默 reload + sessionStorage 恢复选中；desktop `aiBoxCheckVersion` 保留作 AiBrowser 内 tab 切换兜底。方案 `plan-页面可见验版.md`。**待 PC E2E**
```

关键决策可补一行（日期当日）：

```markdown
- 2026-07-21 web：部署强刷触发改为页面可见（`useDocumentVisibility`）；只改 web；桌面 postMessage 保留兜底；恢复仍仅 AI 框三元组
```

- [x] **Step 2: impl-notes 时序补 visibility**

在「常驻页 Version 检测与选中恢复」时序最前增加：

```markdown
0. 文档 `visibilityState`：`hidden` → `visible`（`useDocumentVisibility`）→ 与壳 `aiBoxCheckVersion` 同走验版。
```

边界表补一行：

| 场景 | 预期 |
|------|------|
| AiBrowser 内 tab 切换但 visibility 不变 | 依赖桌面 `aiBoxCheckVersion`；web 侧防抖合并 |

- [x] **Step 3: bridge.md**

在 `aiBoxCheckVersion` 说明后追加：web 另可通过 `useDocumentVisibility` 触发同一验版；desktop 通知仍建议保留。

- [x] **Step 4: Commit（context）**

```bash
cd /Users/nic/w/ai-dev-workspace && git add \
  context/features/20260707-选择AI框/plan-页面可见验版.md \
  context/features/20260707-选择AI框/status.md \
  context/features/20260707-选择AI框/impl-notes.md \
  context/bridge.md && \
git commit -m "$(cat <<'EOF'
docs(选择AI框): 页面可见验版计划与说明

EOF
)"
```

---

## E2E 清单（实施后人工）

1. **最左对话 → AI框**：Network 有 `build_version`；version 同不闪屏；改远端 `build_number` 或部署新包后再进 → 静默刷新且选中 AI 框不变。
2. **deepseek tab → AI框**：若无 `build_version`，确认桌面仍发出 `aiBoxCheckVersion` 且 web 有请求（本期不改 desktop；若桌面未发属既有债，记 status，不在本 plan 修）。
3. **首进 AI框**：不因 visibility watch 多打一次（相对冷启动）。
4. **本地 dev**：`NOT_JENKINS_CI` 不 reload。

---

## 非目标

- 改 desktop / 删除 `aiBoxCheckVersion`
- 定时轮询 `build_version`
- 刷新后恢复 History `sessionId`
- 改 `router.onError` 确认弹窗行为
- 新增 npm 依赖（`@vueuse/core` 已有）

---

## Self-Review

| 需求 | 任务 |
|------|------|
| 用 useDocumentVisibility | T1 / T2 |
| 只改 web | Global + 不改 desktop |
| 调 `/ai-chat/build_version` 强刷 | 复用 `checkAndReloadIfStale` |
| 恢复选中会话（AI 框） | 既有 sessionStorage，T1/T2 激活前落盘 |
| 场景 1 最左切入 | visibility |
| 场景 2 tab 切换兜底 | 保留 postMessage（不改 desktop） |

无 TBD / 占位步骤；函数名与现有模块对齐。

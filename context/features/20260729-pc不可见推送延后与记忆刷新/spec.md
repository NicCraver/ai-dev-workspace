# Spec：PC 不可见时推送消息延后 + 可见时刷新记忆

> 最后更新：2026-07-29  
> 关联：`20260707-选择AI框/推送后列表刷新规则.md`、可见验版（`aiBoxCheckVersion` / `useDocumentVisibility`）

## 背景与目标

PC 个人 AI 框常驻在 iframe 内。用户切到 IM / 其它系统窗 / AiBrowser 其它 tab 时，若推送命中**当前正在看的会话**，立刻刷右侧消息没有意义，还可能抢焦点或白打接口。

成功标准：

1. **不可见**且推送 `sessionIds` 命中当前会话 → **只延后 Chat 消息刷新**；`list` + History 仍立刻刷。
2. **可见**（切回）时：若有延后标记 → 再刷 Chat 消息；并调 `getLastSessionMessage` **只更新记忆栏**（不动消息列表）。
3. 「不可见 / 可见」覆盖：`document.visibility` **与** AiBrowser 内切离/切回个人 AI tab。

## 用户流程

### 推送（页面不可见）

1. 壳/原生把 `aiBoxSendMessage`（含 `sessionIds`）送到 web。
2. 按既有规则：有 `sessionIds` → 立刻刷 AI框 `list` + 中间 History。
3. 若当前 `sessionId ∈ sessionIds`：
   - **页面可见** → 立刻刷 Chat 消息（`getMessageList`）。
   - **页面不可见** → **不刷** Chat；置 `pendingMessageRefresh = true`（多次推送合并为一个标记）。
4. 当前会话未命中 → 不刷 Chat（与现规则一致），也不置 pending。

### 激活（不可见 → 可见）

触发源（任一即可，共用同一入口）：

| 触发 | 来源 |
|------|------|
| `document.visibilityState`：`hidden` → `visible` | web `useDocumentVisibility` |
| 壳 `postMessage`：`{ source:'zx-pc', type:'aiBoxCheckVersion' }` | desktop AiBrowser 切回个人 AI tab（既有） |

激活时顺序：

1. 若 `pendingMessageRefresh` → `reloadCurrentSessionMessages()`，清标记。
2. `refreshMemoryOnly()`：调 `getLastSessionMessage`，仅用 `agentSetDataRangeExpandVo` 回写记忆栏（`conditionMode`）；**不**改 `messages` / `sessionId`。
3. 既有 `runVersionCheckOnActivate`（build_version 验版）照旧，与本流程并列，互不替代。

### 失活（可见 → 不可见）— AiBrowser 内切走

| 触发 | 来源 |
|------|------|
| `document.visibilityState` → `hidden` | 系统切窗 / 父页隐藏等 |
| 壳 `postMessage`：`{ source:'zx-pc', type:'aiBoxDeactivate' }` | **新增**：AiBrowser 从个人 AI tab 切到其它 tab |

失活后：`pageActive = false`；之后命中当前会话的推送只记 pending，不刷消息。

## 范围

### 本期做

- web（PC `PersonalAiChat`）：pending 消息刷新 + 激活时刷记忆；监听 `aiBoxDeactivate`。
- desktop（AiBrowser）：切**离**个人 AI tab 时发 `aiBoxDeactivate`；切**回**仍发既有 `aiBoxCheckVersion`。
- 更新推送规则文档 + bridge/bridge。
- 平台无关判定逻辑单测（`personalAiPushRefreshFlow` 扩展）。

### 本期不做

- 移动端（进页整页重载，无常驻可见性语义）。
- 不可见时延后 `list` / History（明确选 B：只延后 Chat 消息）。
- 可见时完整 `getChatLastMessages`（明确选 A：只更新记忆）。
- 角标数字逻辑变更。

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 延后消息 + 激活刷记忆 | ✅ 仅 PC PersonalAiChat | ❌ | ❌ | 壳发 activate/deactivate |
| `aiBoxDeactivate` | 收 | — | — | 发 |

## 「页面是否激活」判定

web 维护布尔 `pageActive`（初始：若挂载时 `visibility === 'visible'` 则为 true）：

| 事件 | `pageActive` |
|------|----------------|
| visibility → `visible` | `true` |
| visibility → `hidden` | `false` |
| 收到 `aiBoxCheckVersion` | `true`（并走激活流程） |
| 收到 `aiBoxDeactivate` | `false` |

推送判定用 `pageActive`，不用裸 `visibilityState`（否则 AiBrowser 内切 tab 永远判成可见）。

## 依赖的接口

| 接口 | 用途 |
|------|------|
| 既有推送刷新：`list` / `getSessionList` / `getMessageList` | 规则不变；消息层按 `pageActive` 决定立刻或 pending |
| `POST /sessionMsg/getLastSessionMessage` | 激活时只取 `agentSetDataRangeExpandVo` 更新记忆 |

契约：沿用既有 session / personalAi 契约；桥协议新增 `aiBoxDeactivate`（见下）。

## 桥协议增量

```js
// AiBrowser → 个人 AI iframe：切离个人 AI tab
{ "source": "zx-pc", "type": "aiBoxDeactivate" }

// 切回（既有）
{ "source": "zx-pc", "type": "aiBoxCheckVersion" }
```

桌面实现要点（`AiBrowser/index.vue` `selectWebview`）：

- `prev === PERSONAL_AI_TOOL_ID && next !== PERSONAL_AI_TOOL_ID` → `postMessage(aiBoxDeactivate)` 到个人 AI iframe。
- `next === PERSONAL_AI_TOOL_ID` → 既有 `notifyPersonalAiCheckVersion()`。
- 父级 `props.visible` false（关闭 AI 浏览器面板）时：若当前在个人 AI tab，也发一次 `aiBoxDeactivate`（与 visibility hidden 双保险，可合并防抖）。

## 代码落点（实现指引）

1. `personalAiPushRefreshFlow.js`：`resolvePushRefreshPlan(sessionIds, currentSessionId, { pageActive })`  
   - `refreshMessages = hit && pageActive`  
   - 返回值可带 `deferMessages: hit && !pageActive` 供宿主置 pending。
2. `Chat.vue`：新增 `refreshMemoryOnly`（内部 getLastSessionMessage → 只 `updateMemoryFromAgentSetting`），`defineExpose`。
3. `Home.vue`：透传 `refreshMemoryOnly`。
4. `PersonalAiChat.vue`：`pageActive` / `pendingMessageRefresh`；推送与激活/失活编排。
5. `AiBrowser/index.vue`：切离发 `aiBoxDeactivate`。
6. 文档：`推送后列表刷新规则.md`、`context/bridge.md`、本功能 `status.md` / `impl-notes.md`。

## 关键决策记录

- 2026-07-29 延后范围 = **仅 Chat 消息**（list/History 立刻刷）
- 2026-07-29 激活记忆 = **只更新记忆栏**，不走完整 getChatLastMessages
- 2026-07-29 激活触发 = visibility **+** `aiBoxCheckVersion`
- 2026-07-29 失活含 AiBrowser 内切走 → 新增 `aiBoxDeactivate`
- 2026-07-29 仅 PC；移动端不做

## 待用户确认

请审阅本 `spec.md`。确认后进入 `plan.md` 与实现。

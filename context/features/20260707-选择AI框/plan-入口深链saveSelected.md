# 入口深链未命中 → saveSelected 再选中 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。

**Goal:** 移动端从会话列表点进 `/m/personal` 时，若 URL 深链对应的 AI 框不在当前 list 中，先 `saveSelected` 再带 `exemptAgentIds` 刷 list 并选中，保证打开「最近消息」那个 agent；仅 save/再 list 仍失败时回落个人 AI 框。

**Architecture:** 复用既有 `saveSelectedAndReloadList`（或等价入参构造）。入口深链 one-shot 流程改为：读 URL → 首次 list → 命中则选中；未命中且 `belongType∈{1,3}` 则用 URL 三字段构造 selection 调 saveSelected→list(exempt)→再匹配选中；个人框（belongType=0）始终在列表，无需 save。ios/android 仅负责「角标回参有则拼 URL」，本方案不改原生。

**Tech Stack:** apps/web — Vue 3 `MPersonalAiChatWrapper.vue` + `personalAiSaveSelectedFlow.js` + `personalAiFrame.js`；契约 `saveSelected.d.ts` / `getBadgePushInfo.d.ts`。

## Global Constraints

- **范围**：只改 `apps/web`（主）+ `context` 文档；ios/android 入口拼参已落地，本方案不改。
- **个人 AI 框**：`belongType=0` **始终在 list**；深链目标为个人框时只做匹配选中，不调 saveSelected（契约 belongType 仅 1/3）。
- **saveSelected**：`belongType` 仅 `1|3`；须有真实 `belongId`；`agentId` 非合成才写入 / 进 `exemptAgentIds`。
- **落库语义**：角标入口未命中时自动 save = 把该 AI 框加入用户已选（与弹窗确定同效果）；产品已接受。
- **one-shot**：深链消费仍只跑一次，避免推送刷 list 反复 save。
- **调试**：「入口参」弹窗保留至 E2E 验完再删；matchNote 写清命中 / save 后命中 / 回落个人框。
- **提交**：web 只 push `personal-ai-chat`；context `docs(选择AI框): ...`。

---

## 前提（已落地，勿重做）

| 项 | 状态 |
|----|------|
| `getBadgePushInfo` 回参可选 `agentId`/`belongId`/`belongType` | 契约已更 |
| ios/android 有回参才拼进 `/m/personal` URL | 已更（工作区可能未提交） |
| web 读 URL + 首次 list 后按 agentId/belong 选中 | 已提交 `08689be` / `5e3aa64` |
| 未命中当前回落个人 AI 框 | `5e3aa64`（本方案改为：先 save 再回落） |

---

## 目标时序

```text
进 /m/personal（URL 可能带 agentId / belongId / belongType）
  → getFilter → list（当前 filterTypes + exempt）
  → 按 agentId（其次 belongType+belongId）匹配
       ├─ 命中 → 选中该 agent（resume 按 lastChatAt）
       └─ 未命中
            ├─ belongType ∈ {1,3} 且 belongId 非空
            │     → saveSelected({ agentId?, belongType, belongId })
            │     → exempt 追加 agentId → list
            │     → 再匹配
            │          ├─ 命中 → 选中
            │          └─ 仍未命中 → 选中个人 AI 框
            └─ belongType=0 / 缺字段 / save 失败
                  → 选中个人 AI 框
```

无 URL 深链：保持现状（不走 save，选中逻辑仍回落排序首项；首项即个人框）。

---

## File Structure

**改：**

- `apps/web/src/components/views/personal/m/MPersonalAiChatWrapper.vue`  
  - 将 `applyEntryDeepLinkIfNeeded` 改为 async（或拆出 `resolveEntryDeepLink`）  
  - 未命中时调用 save 编排再匹配；失败回落个人框  
  - `loadAgentList` 首次路径 `await` 该流程；推送/改筛的 `skipGetFilter` 路径不重跑深链（已有 `entryDeepLinkApplied`）

- `apps/web/src/components/views/personal-ai/list/personalAiSaveSelectedFlow.js`（可选小改）  
  - 若现有 `toSaveSelectedItem` 只认 `ownerType`：新增从 URL 扁平字段构造 item 的纯函数，例如 `toSaveSelectedItemFromDeepLink({ agentId, belongId, belongType })`，避免在 Vue 里拼 ownerType

**测：**

- `apps/web/src/components/views/personal-ai/tests/` 下为新纯函数补 `.test.mjs`（有则跟现有 saveSelected 单测风格）

**文档：**

- `context/features/20260707-选择AI框/status.md` — 待办改写  
- 本文件勾选进度；联调后 `impl-notes.md` 补一条

**不改：** ios / android 拼 URL；PC `PersonalAiChat.vue`（无此入口深链）。

---

### Task 1: 深链 → saveSelected 入参纯函数 + 单测

**Files:**
- Modify/Create: `apps/web/src/components/views/personal-ai/list/personalAiSaveSelectedFlow.js`
- Modify/Create: 同目录或 `tests/` 下已有 saveSelected 相关 `.test.mjs`

- [x] **Step 1: 增加 `toSaveSelectedItemFromDeepLink`**
- [x] **Step 2: 单测覆盖**
- [x] **Step 3: 跑单测** `node …test.mjs`（跟仓库现有命令）
- [ ] **Step 4: Commit**（web）`feat(personal-ai): 深链字段转 saveSelected 入参`

---

### Task 2: Wrapper 未命中走 saveSelected → list → 再选中

**Files:**
- Modify: `apps/web/src/components/views/personal/m/MPersonalAiChatWrapper.vue`

- [x] **Step 1: 把深链解析改成 async**
- [x] **Step 2: `loadAgentList` 里 `await resolveEntryDeepLink(list)`**
- [ ] **Step 3: 手测清单（开发机可改 URL query）** — 待真机/本地 URL
- [ ] **Step 4: Commit** `feat(personal-ai): 入口深链未命中时 saveSelected 再选中`
- [ ] **Step 5: Push** `origin personal-ai-chat`（仅 web）

---

### Task 3: 文档收尾

**Files:**
- Modify: `context/features/20260707-选择AI框/status.md`
- Modify: `context/features/20260707-选择AI框/impl-notes.md`（联调后）
- Modify: 本 plan 勾选

- [ ] **Step 1: status** 待办改为「未命中 → saveSelected → exempt list → 选中；失败回落个人框」；决策记一条  
- [ ] **Step 2: impl-notes** 补：角标入口自动 save 的落库语义；belongType 0 不 save  
- [ ] **Step 3: context commit** `docs(选择AI框): 入口深链未命中走 saveSelected 方案`

---

## 验收标准

- [ ] 列表已有目标 agent：进页直接打开，无多余 saveSelected  
- [ ] 筛选导致不在 list：自动 save + exempt 后打开目标 agent，不落到个人框  
- [ ] 个人框深链 / 无深链 / save 失败：打开个人 AI 框（始终在列表）  
- [ ] 改筛、推送刷 list 不会再次 save  
- [ ] 「入口参」可核对 URL 与 matchNote  

## 非目标

- 改 getBadgePushInfo **入参**  
- PC 个人 AI 页深链  
- 删除调试「入口参」按钮（验完另开）  
- 改 ios/android 拼参逻辑（除非 E2E 发现 query 未到达 web）

## 风险

| 风险 | 缓解 |
|------|------|
| save 多一次 RTT，进页变慢 | 仅未命中才走；命中零成本 |
| 自动 save 改变用户已选集合 | 与产品确认（本方案已接受） |
| `toSaveSelectedItem` 与 URL 字段映射不一致 | Task 1 专用纯函数 + 单测 |
| await 期间二次 list | `entryDeepLinkApplied` 提前置位 |

---

## 执行建议

实现时用 **subagent-driven-development** 按 Task 1 → 2 → 3 顺序；每 Task 结束后再开下一 Task。

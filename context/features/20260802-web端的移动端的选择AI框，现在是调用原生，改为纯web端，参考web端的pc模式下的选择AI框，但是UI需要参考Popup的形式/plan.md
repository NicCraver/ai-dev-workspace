# 移动端选择 AI 框 · 纯 Web Popup 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。  
> 设计依据：同目录 `spec.md`。

**Goal:** 移动端「选择 AI 框」改为 H5 `XPopup` 多级页，功能/数据对齐 `SelectAiBoxDialog`，默认不再调 `selectAiAgent`。

**Architecture:** 新建 `SelectAiBoxPopup`（壳 + 页面栈）与 home/search 子页；组织复用 `OrgPicker`（`hide-outsource`）；取数复用 `getAllImDialogue` + `aiBoxPickerModel` + `fetchSelectGroupBySearch`；点行即 `submit`。`PersonalAiChat` / `MPersonalAiChatWrapper` 入口改开 Popup；`selectAgentByNative` 保留不删。

**Tech Stack:** Vue 3 `<script setup>` + UnoCSS + `XPopup` + 既有 picker 模块；手测为主，纯函数改动补 `.test.mjs`。

## Global Constraints

- **范围**：只改 `apps/web` 移动端选择入口与新 Popup；PC Dialog、android/ios 原生选择工程、选择数据范围本期不动。
- **功能对齐**：`SelectAiBoxDialog`（含无 agentId 展示、离职后缀、隐藏外联、选中 payload）。
- **UI**：对齐原生截图 + `TimingPopup`（`h-[95vh]`、`rounded-t-xl`）；点行即选，无底部确定栏。
- **回滚**：保留 `selectAgentByNative`，默认不调用。
- **样式**：UnoCSS，对照 `context/dev-rules/unocss-conventions.mdc`；中文注释。
- **提交**：web 代码与 context 文档分开；context 用 `docs(移动选择AI框Popup): …`。

## File Structure

**新增（`apps/web/src/components/views/personal-ai/picker/`）**

| 文件 | 职责 |
|------|------|
| `MobilePickerNav.vue` | 顶栏：左取消/返回、中标题 |
| `SelectAiBoxPopup.vue` | XPopup 壳、页面栈、打开拉 `allItems`、统一 submit/close |
| `SelectAiBoxPopupHome.vue` | 搜索入口 + 选择联系人/群组入口 + 最近聊天 |
| `SelectAiBoxPopupSearch.vue` | 顶栏搜索 + 全部/群组/人员 + 结果（内嵌/复用 SearchPanel 逻辑） |
| `SelectAiBoxPopupGroups.vue` | 组织群列表页（可内联进 Popup 栈，文件可选拆出） |

**修改**

| 文件 | 改动 |
|------|------|
| `AiBoxRow.vue` | 增 `hideCheckbox`；可选群名旁 `(memberCount)` |
| `aiBoxPickerModel.js` | 归一化补 `memberCount`（从 `groupInfo` 人数字段或成员总数）+ 单测 |
| `PersonalAiChat.vue` | mobile 分支：`pickerOpen=true` 挂 Popup，不再 `selectAgentByNative` |
| `MPersonalAiChatWrapper.vue` | 同：挂 Popup + `requestSelectAgent` 开层 |

**不改**：`SelectAiBoxDialog.vue`、`personalAiSelectorMessage.js`（保留 native API）。

---

## Task 1: 模型补 memberCount + AiBoxRow 移动展示 [web]

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/aiBoxPickerModel.js`
- Modify: `apps/web/src/components/views/personal-ai/tests/aiBoxPickerModel.test.mjs`
- Modify: `apps/web/src/components/views/personal-ai/picker/AiBoxRow.vue`

**Interfaces:**
- Produces: `AiBoxItem.memberCount?: number`；`AiBoxRow` props：`hideCheckbox?: boolean`（默认 false）、`showMemberCount?: boolean`（默认 false）

- [ ] **Step 1:** 在 `normalizeAiBoxDialogueList` 群分支写入 `memberCount`（优先 `groupInfo.memberCount` / `groupInfo.userCount` / `groupInfo.memberNum` 等现有字段；否则用 `groupInfo.accountInfoList?.length`，缺省不显示）
- [ ] **Step 2:** 单测覆盖有人数 / 无人数
- [ ] **Step 3:** `AiBoxRow`：`hideCheckbox` 为 true 时不渲染 `CheckboxView`；`showMemberName` 旁在 `showMemberCount && memberCount` 时渲染灰色 `(N)`；`showAgentName` 默认仍 true（Popup 传 false）
- [ ] **Step 4:** `node --test` 相关 test + 目视不影响 Dialog（默认 prop）

---

## Task 2: MobilePickerNav + SelectAiBoxPopup 壳与页面栈 [web]

**Files:**
- Create: `.../picker/MobilePickerNav.vue`
- Create: `.../picker/SelectAiBoxPopup.vue`

**Interfaces:**
- Props: `open: Boolean`（或 `v-model:open`）
- Emits: `update:open`、`submit(selection)` — selection 形态同 Dialog
- 栈页 key：`'home' | 'contacts' | 'groups' | 'search'`（contacts 内由 OrgPicker 自管钻取；若 OrgPicker 需全屏标题同步，用 `@corp-change` 或 watch 更新 nav title）

- [ ] **Step 1:** `MobilePickerNav`：左文案按钮（取消/返回，`text-primary`）+ 居中标题；emit `back`
- [ ] **Step 2:** `SelectAiBoxPopup`：`XPopup` + `h-[95vh] bg-white rounded-t-xl`；`open` 时拉 `getAllImDialogue` + `normalizeAiBoxDialogueList`（照抄 Dialog watch）；失败/空态文案
- [ ] **Step 3:** `stack` / `push` / `pop`；home 取消或遮罩 → close 不 submit；任意页点可选行 → `emit('submit')` + close + 重置栈
- [ ] **Step 4:** 先放占位内容验证开关栈，再接 Task 3/4

---

## Task 3: Home + Groups 页 [web]

**Files:**
- Create: `.../picker/SelectAiBoxPopupHome.vue`
- Create 或内联: groups 列表（可 `SelectAiBoxPopupGroups.vue`）

- [ ] **Step 1:** Home：可点搜索条 → `push('search')`；两行入口「选择联系人」「选择已有群组」→ `push('contacts'|'groups')`；分区头「最近聊天」+ `AiBoxRow`（`hideCheckbox` + `showAgentName=false` + `showMemberCount`）
- [ ] **Step 2:** Groups：nav「返回 · 选择已有群组」；列表 `orgGroupsOnly(allItems)`；无外协 tab；点行 submit
- [ ] **Step 3:** 空态「暂无数据」；加载中文案

---

## Task 4: Contacts / Org 钻取（复用 OrgPicker）[web]

**Files:**
- Modify/复用: `.../picker/OrgPicker.vue`（仅加必要 prop，避免破坏 Dialog）
- Wire in: `SelectAiBoxPopup.vue` contacts 页

- [ ] **Step 1:** contacts 页挂 `OrgPicker`：`hide-outsource`、`:agent-lookup-items="allItems"`；`@select` → Popup submit
- [ ] **Step 2:** 视觉：外联 tab 因 `hide-outsource` 已隐藏；公司层「我加入的/我的下级」保持 OrgPicker 现有分组；必要时微调移动端行高/面包屑以贴截图（勿改 PC Dialog 默认样式，用 prop 或父级 class）
- [ ] **Step 3:** 顶栏标题：未进公司「选择联系人」；进公司后可用当前 corp/dept 名（OrgPicker 若无事件则先固定「选择联系人」+ 组件内面包屑，与截图双标题可后续微调）
- [ ] **Step 4:** 从 contacts 返回 home：`pop`，不卸载 OrgPicker 状态或按需重置（打开 Popup 时整体重置即可）

---

## Task 5: 搜索页 [web]

**Files:**
- Create: `.../picker/SelectAiBoxPopupSearch.vue`
- Reuse: `search/AiBoxSearchPanel.vue`、`search/SearchInput.vue`（或等价）

- [ ] **Step 1:** 顶栏：返回 chevron + pill 搜索框（placeholder「搜索」或「搜索联系人、智能体」——截图主搜为「搜索」，home 入口文案可更长）
- [ ] **Step 2:** 内嵌 `AiBoxSearchPanel`：`:candidates="allItems"`（与侧栏/Dialog 本地滤一致）或空关键词不搜；`show-agent-name=false`；点行 → submit
- [ ] **Step 3:** 有结果时显示「全部 / 群组 / 人员」tab（Panel 已有）；不用 Teleport popover，全高铺满
- [ ] **Step 4:** 无结果空态对齐 Panel

---

## Task 6: 入口接线（双入口）[web]

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue`
- Modify: `apps/web/src/components/views/personal/m/MPersonalAiChatWrapper.vue`

- [ ] **Step 1:** `PersonalAiChat`：模板在 Dialog 旁挂  
  `SelectAiBoxPopup v-model:open="pickerOpen" @submit="onPickerSubmit"`  
  （或 mobile 专用 `mobilePickerOpen`，避免 PC/移动抢同一 ref——推荐 **同一 `pickerOpen`**：PC 渲染 Dialog、移动渲染 Popup，用 `v-if="isMobile()"` 二选一）
- [ ] **Step 2:** `requestSelectAgent`：去掉 mobile 的 `selectAgentByNative` 分支，统一 `pickerOpen = true`（PC/移动都开对应组件）
- [ ] **Step 3:** `MPersonalAiChatWrapper`：增加 `pickerOpen` + `SelectAiBoxPopup`；`requestSelectAgent` 改为开 Popup；`@submit` → 现有 `applySelection`（与 `handleSelectedAgentMessage` 归一化后同路径；Popup 已是 Dialog 形态 item，直接 `applySelection(selection, shouldResumeConversation(selection))`）
- [ ] **Step 4:** 确认 `selectAgentByNative` / `ensureSelectAgentNativeApi` import 可保留（wrapper onMounted 仍可 ensure，或仅保留函数文件）；**不要删除** `personalAiSelectorMessage.js`

---

## Task 7: 手测验收 + 文档 [web / context]

- [ ] **Step 1:** 移动端真机/模拟器：成功标准 1–5（spec）；取消/返回不误提交；搜索/组织/群组/最近四路径
- [ ] **Step 2:** PC：Dialog 仍可用、无回归
- [ ] **Step 3:** 更新本功能 `status.md`；有联调坑则写 `impl-notes.md`（平台无关）
- [ ] **Step 4:** wrapup 提交 context

## Android / iOS / Desktop 移植

本期不做（WebView 内已不调原生选择；壳工程原生页可后续下线，不在本 plan）。

---

## Spec 覆盖自检

| Spec 要求 | Task |
|-----------|------|
| XPopup 多级 + 点行即选 | 2–5 |
| 对齐 Dialog 数据/payload | 1, 3–6 |
| 隐藏外联 | 4 |
| 独立搜索页三 tab | 5 |
| 双入口改 H5、保留 native 代码 | 6 |
| 视觉截图要点 | 1–5 |
| PC 不回归 | 6–7 |

# Spec：移动端选择 AI 框改为纯 Web Popup

> 由 Superpowers brainstorm 产出。最后更新：2026-08-02  
> 活跃功能目录：`context/features/20260802-web端的移动端的选择AI框，现在是调用原生，改为纯web端，参考web端的pc模式下的选择AI框，但是UI需要参考Popup的形式/`

## 背景与目标

PC 已用 H5 `SelectAiBoxDialog`（`AcDialog`）完成「选择 AI 框」；移动端仍走 `wnsdk.aiChat.selectAiAgent` 原生页。本期把 **web 移动端** 改为纯 H5 Popup，功能与数据对齐 `SelectAiBoxDialog`，UI 对齐原生截图 + `TimingPopup`/`XPopup` 外壳，不再依赖原生选择 UI。

**成功标准**：

1. 移动端点「选择 AI 框」打开 H5 Popup，不进入原生选择页
2. 最近聊天 / 联系人组织钻取 / 群组 / 搜索均可单选并切到对应 AI 框会话
3. 选中 payload 与落库链路（`applySelection` → upsert → `saveSelected` → list）与 PC Dialog 一致
4. 无外联/外协；PC `SelectAiBoxDialog` 无回归
5. `selectAgentByNative` 代码保留，默认不调用（便于回滚）

## 用户流程

1. 用户在移动端（`PersonalAiChat` 或 `MPersonalAiChatWrapper` / `SelectAiChatPopup`）点「选择 AI 框」
2. 打开 `SelectAiBoxPopup`（`XPopup`，约 `95vh`），默认 **home** 页
3. 任选路径找到目标并点行：
   - **最近聊天**：直接点人/群
   - **选择联系人** → 公司列表 → 部门钻取 → 点人员
   - **选择已有群组** → 点组织群
   - **搜索**：进入搜索页，tab「全部 / 群组 / 人员」，点结果
4. 点可选行 → **立即** `emit('submit', selection)` 并关闭 Popup（无底部「确定」）
5. 外层 `onPickerSubmit` → `applySelection`（与 PC 相同）
6. 取消 / 遮罩关闭 / 返回仅退栈或关层，不提交

## UI 信息架构

| 页面 | 顶栏 | 内容 |
|------|------|------|
| home | 取消 · 选择AI框 | 搜索入口；「选择联系人」「选择已有群组」；分区「最近聊天」列表 |
| contacts | 返回 · 选择联系人 | 搜索入口；公司列表（我加入的 / 我的下级）；**无外联 tab** |
| org-drill | 返回 · 当前公司/部门名 | 搜索；面包屑；部门（N人 + ›）/ 人员（点选） |
| groups | 返回 · 选择已有群组 | 组织群列表；**无外协 tab** |
| search | ‹ + 搜索框 | tab：全部 / 群组 / 人员 → 结果列表 |

**视觉要点**（对齐截图）：

- 白底、`rounded-t-xl`、顶栏约 48px；左操作主色蓝文案，中标题
- 搜索条：浅灰圆角 pill + 放大镜
- 分区头浅灰条；列表分隔线
- 行：人头像圆 / 群拼图；群名后灰色 `(人数)`；公司/部门右侧「N人」+ ›
- **无** PC 单选圆点、**无** 底部「已选 / 取消 / 确定」
- 列表默认不展示智能体副标题（`showAgentName=false`）；submit 字段仍带 `agentName`

参考截图见会话附件（原生「选择AI框 / 选择联系人 / 组织钻取 / 选择已有群组 / 搜索」）。

## 范围

**本期做（apps/web · 移动端）**

- 新建 `SelectAiBoxPopup` 及子页（home / search；组织复用 `OrgPicker` 能力）
- `PersonalAiChat.requestSelectAgent`、`MPersonalAiChatWrapper.requestSelectAgent`：移动端改为打开 Popup，默认不调 native
- 取数与归一化复用 Dialog 同源逻辑（见下）

**本期不做**

- 改 PC `SelectAiBoxDialog` 行为/布局
- 外联人员 / 外协群
- 多选；选择数据范围弹窗
- 删除 `selectAgentByNative` / 改 android·ios 原生选择工程
- 新增后端接口（沿用现有契约）

## 组件结构

**新建**（`apps/web/src/components/views/personal-ai/picker/`）

| 文件 | 职责 |
|------|------|
| `SelectAiBoxPopup.vue` | `XPopup` 壳 + 页面栈 + 打开拉数 + 点行 submit |
| `SelectAiBoxPopupHome.vue` | 主页：入口行 + 最近聊天 |
| `SelectAiBoxPopupSearch.vue` | 搜索页：输入 + 三 tab + 结果 |
| （可选）`MobilePickerNav.vue` | 统一顶栏：取消/返回/标题 |

**复用**

- `getAllImDialogue` + `normalizeAiBoxDialogueList` / `orgGroupsOnly`（`aiBoxPickerModel`）
- `OrgPicker` + `orgPickerContactApi`（`hide-outsource`）
- `AiBoxRow` / `AcAvatar` / `AcGroupAvatar`（移动端可关副标题、展示人数）
- 搜索：`fetchSelectGroupBySearch` / 与 `AiBoxSearchPanel` 同源过滤；不用 PC Teleport popover 壳
- 外壳范式：`XPopup` + `TimingPopup` 高度/圆角约定

**接线**

- mobile：`pickerOpen` → 挂载 `SelectAiBoxPopup`；`@submit` → 现有 `onPickerSubmit` / `applySelection`
- `selectAgentByNative` 保留不调用

## 数据流与选中

**打开**：`getAllImDialogue({ accountId, selectModel: 1 })` → `normalizeAiBoxDialogueList` → `allItems`（含无 `agentId`；私聊 `leave=1` 后缀「（已离职）」与 Dialog 一致）。

| 页 | 数据 |
|----|------|
| home 最近 | `allItems` |
| groups | `orgGroupsOnly(allItems)` |
| contacts / org-drill | OrgPicker HTTP：`getContract` / `sub_dept_user_pagelist`；人员智能体名对齐 Dialog 的 agent-lookup |
| search | 关键词走 `fetchSelectGroupBySearch`（或与 Dialog SearchPanel 相同策略）；tab 切全部/群组/人员 |

**submit item**：与 Dialog 一致字段（`ownerType` / `id` / `name` / `agentId` / `agentName` / `avatar` / `accountInfoList` / `lastChatAt` 等）。部门/公司只钻取不提交。

**外层**：`applySelection(selection, shouldResumeConversation(selection))` — 本地 upsert → `saveSelected` → list；`PersonalAiChat` 与 `MPersonalAiChatWrapper` 共用。

**异常**：账号未就绪 / 加载失败 / 空列表 / 无搜索结果 — 页内文案（可重试）；不提示「升级客户端」。

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 选择 UI | PC 仍 Dialog；**移动端改 H5 Popup** | 原生选择页本期不改（WebView 内不再调起） | 同左 | — |
| 取数 | Web HTTP / 现有 Dialog 同源 | — | — | 不新增桥 |
| 外联 | 隐藏（同 Dialog `hide-outsource`） | — | — | — |

## 依赖的接口

- `getAllImDialogue`（`personalAiFrame`，`selectModel: 1`）
- `getPersonalAiFrameSelectGroupBySearch` / `fetchSelectGroupBySearch`
- 组织：`getContract`、`sub_dept_user_pagelist`（经 `orgPickerContactApi`）
- 选中后：现有 `savePersonalAiFrameSelected` + `getPersonalAiFrameList`（外层已有，Popup 不直接调）

契约以 `context/contracts/` 既有 personalAiFrame / contact 为准；本期不新增契约。

## 测试策略

- `pnpm` 类型检查 / 相关单测若有模型纯函数改动则补测
- 真机/模拟器手测：§成功标准 + 取消不误提交 + PC Dialog 无回归

## 决策记录

- 2026-08-02 信息架构按原生截图多级页；点行即选（方案 A）
- 2026-08-02 功能对齐 `SelectAiBoxDialog`，全 Web 接口，不调原生选择 UI
- 2026-08-02 隐藏外联（方案 B，同 Dialog）
- 2026-08-02 独立搜索页 + 全部/群组/人员（方案 A）
- 2026-08-02 默认 H5，保留 native 代码作回滚（方案 C）
- 2026-08-02 实现路径：新建 `SelectAiBoxPopup`，不与 Dialog 自适应混写

## 待用户确认的问题

- 无（brainstorm 已确认）

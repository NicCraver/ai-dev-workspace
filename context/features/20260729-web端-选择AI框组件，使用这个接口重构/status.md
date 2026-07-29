# Status：web 端「选择 AI 框」组件用 getAllImDialogue 重构

> 最后更新：2026-07-29（web 代码已提交；**真机抓包/自测未做**；desktop 脏树已核对为别功能）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约 Changelog（selectModel:1 消费方）· plan Task 1 | ✅ | — | — | — |
| 纯逻辑模型 + 单测 · plan Task 2 | ✅ 7/7 | — | — | — |
| 搜索改前端本地过滤 · plan Task 3 | ✅ | — | — | — |
| SelectAiBoxDialog 换数据源 + 藏群子 tab · plan Task 4 | ✅ | — | — | — |
| OrgPicker prop（藏外联 / 要求 agent）· plan Task 5 | ✅ | — | — | — |
| 接口联调（抓包）· plan Task 6 | 🚧 待手测 | — | — | — |
| 自测通过 · plan Task 6 | ⬜ | — | — | — |

> **本轮范围：只做 web PC「选择 AI 框」**。android / ios / desktop 不在本期；数据来源弹窗（`selectModel: 0`）不改行为。

## web 提交（分支 `personal-ai-chat`）

| 内容 | 提交 |
|------|------|
| getAllImDialogue 注释 + aiBoxPickerModel + 弹窗/搜索/OrgPicker | `fe63aa1` |

契约提交（context）：`2e73925`（selectModel:1 消费方 Changelog）。

## 待办 / 阻塞

- (desktop) 工作区未提交改动（`personal-ai-data-scope-dialog` / `data-scope-list-item` / `data-scope-model`：数据来源弹窗 UI 对齐 web、列表行 60 高/圆头像/agentName 副标题/搜索图标）→ 归属 **`20260729-4端重选择构数据来源弹窗`**，**不推进本功能矩阵**（desktop 列保持 —）。
- (web) ⏳ **真机抓包未做**：开窗仅一次 `getAllImDialogue` 且 `selectModel:1`；搜索零 `selectGroupBySearch`；组织架构无外联条；无 agent 人员不展示；确定开聊正常。
- (web) ⏳ 回归：数据来源弹窗仍可外联；定时发送/列表等其它 `AiBoxSearchBox` 入口仍走 HTTP 搜索。
- (web) 兼容点：`candidates` 未传时搜索保持旧 API，避免误伤 `PersonalAiChatAgentList` / `SendTargetPickerDialog` / `SelectAiChatPopup`。

## 关键决策记录

- 2026-07-29 「最近联系人」→「全部」；`selectModel: 1`；前端再滤无 `agentId`
- 2026-07-29 搜索保留 popover + 全部/群组/人员；会话名与智能体名均可搜可高亮
- 2026-07-29 群组顶层 tab 只组织群并隐藏单子 tab；搜索「群组」可含外联（同源缓存）
- 2026-07-29 「全部」含带 agent 的外联群（若后端返回）
- 2026-07-29 OrgPicker：选择 AI 框场景藏外联 + 无 agent 不展示；数据来源场景默认不变
- 2026-07-29 新建 `aiBoxPickerModel.js`，不复用 `dataScopeModel`
- 2026-07-29 打开弹窗仍每次未选中；忽略回参 `selected`
- 2026-07-29 搜索 `candidates === null` 走旧 HTTP；传数组走本地过滤（兼容其它入口）

# Status：web 端「选择 AI 框」组件用 getAllImDialogue 重构

> 最后更新：2026-07-29（spec / plan / 矩阵已初始化；**代码未开工**）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约 Changelog（selectModel:1 消费方）· plan Task 1 | ⬜ | — | — | — |
| 纯逻辑模型 + 单测 · plan Task 2 | ⬜ | — | — | — |
| 搜索改前端本地过滤 · plan Task 3 | ⬜ | — | — | — |
| SelectAiBoxDialog 换数据源 + 藏群子 tab · plan Task 4 | ⬜ | — | — | — |
| OrgPicker prop（藏外联 / 要求 agent）· plan Task 5 | ⬜ | — | — | — |
| 接口联调（抓包）· plan Task 6 | ⬜ | — | — | — |
| 自测通过 · plan Task 6 | ⬜ | — | — | — |

> **本轮范围：只做 web PC「选择 AI 框」**。android / ios / desktop 不在本期；数据来源弹窗（`selectModel: 0`）不改行为。

## 待办 / 阻塞

- (web) ⏳ 按 `plan.md` Task 1→6 实现与抓包自测。
- (web) OrgPicker 必须用 **prop 开关**，默认保持数据来源弹窗可切外联、不强制 agent。
- (全端) — 本期无跨端移植任务。

## 关键决策记录

- 2026-07-29 「最近联系人」→「全部」；`selectModel: 1`；前端再滤无 `agentId`
- 2026-07-29 搜索保留 popover + 全部/群组/人员；会话名与智能体名均可搜可高亮
- 2026-07-29 群组顶层 tab 只组织群并隐藏单子 tab；搜索「群组」可含外联（同源缓存）
- 2026-07-29 「全部」含带 agent 的外联群（若后端返回）
- 2026-07-29 OrgPicker：选择 AI 框场景藏外联 + 无 agent 不展示；数据来源场景默认不变
- 2026-07-29 新建 `aiBoxPickerModel.js`，不复用 `dataScopeModel`（私聊也要 agent 字段）
- 2026-07-29 打开弹窗仍每次未选中；忽略回参 `selected`

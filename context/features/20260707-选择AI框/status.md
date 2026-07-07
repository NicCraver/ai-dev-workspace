# Status：选择AI框

> 最后更新：2026-07-07 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| # | 任务 | web | android | ios | desktop |
|---|------|-----|---------|-----|---------|
| T1 | bridge.md 桥协议（4 项） | ✅ | — | — | ✅ |
| T2 | desktop 桥方法（getMyGroups/getOrgCompanies/getDeptUsers + 补 getRecentContacts 字段） | — | — | — | ⬜ |
| T3 | useAiBoxPickerData 取数组合函数 + 单测 | ✅ | — | — | — |
| T4 | SelectAiBoxDialog 骨架（AcDialog + 三 tab + 单选） | ✅ | — | — | — |
| T5 | 群组 tab（组织群/外联群切换 + AiBoxRow） | ⬜ | — | — | — |
| T6 | OrgPicker 组织架构钻取（公司→部门→人员 + 面包屑） | ⬜ | — | — | — |
| T7 | 搜索前端过滤 + 空态 | ⬜ | — | — | — |
| T8 | 入口接线 + 选中后链路（upsert/sort/24h） | ⬜ | — | — | — |
| T9 | 联调 + 视觉还原验收 + impl-notes | ⬜ | — | — | ⬜ |

> 实现顺序建议：T1（契约）→ T2（desktop）与 T3-T8（web，先用 mock 并行）→ T9（联调）。

## 待办 / 阻塞

- (多端) 待联调确认 `getRecentContacts` 现有返回是否已含 `agentName` + `lastChatAt`（见 spec「待联调确认 1」）
- (web) 待确认 home 页 `switchToAgent`（切换 agent + 加载对话）现状，接入 T8
- (desktop) T2 宿主处理需复用既有 `groupListApi` / `getDeptUserPagelist` / `organization-list` 数据源
- (web) 群组/全公司可私聊人员量级未明，若过大需把搜索从「前端过滤」改为宿主接口（见 spec「待联调确认 4」）

## 关键决策记录

- 2026-07-07 范围聚焦 apps/web + apps/desktop，android / ios 本期不动
- 2026-07-07 AI 框与群/私聊 1:1，列表全显示（不做「有无 AI 框」过滤）
- 2026-07-07 数据全部经 `window.webview.*` 向 desktop 壳取（移动端 `wnsdk.aiChat.*` 预留）
- 2026-07-07 弹窗用 AcDialog 壳，交互对齐 desktop 转发窗，布局按蓝湖稿单栏，单选
- 2026-07-07 选中后复用 `personalAiAgentAdapter`（mapSelectionToAgent/upsertSelectedAgent/sortAgents），24h 判 `lastChatAt`
- 2026-07-07 视觉严格还原蓝湖 4 张截图（UnoCSS 原子类，位图图标换 SvgIcon）

# Status：选择AI框

> 最后更新：2026-07-08 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| # | 任务 | web | android | ios | desktop |
|---|------|-----|---------|-----|---------|
| T1 | bridge.md 桥协议（4 项） | ✅ | — | — | ✅ |
| T2 | desktop 桥方法（getMyGroups/getOrgCompanies/getDeptUsers + 补 getRecentContacts 字段） | — | — | — | 🚧 |
| T3 | useAiBoxPickerData 取数组合函数 + 单测 | ✅ | — | — | — |
| T4 | SelectAiBoxDialog 骨架（AcDialog + 三 tab + 单选） | ✅ | — | — | — |
| T5 | 群组 tab（组织群/外联群切换 + AiBoxRow） | ✅ | — | — | — |
| T6 | OrgPicker 组织架构钻取（公司→部门→人员 + 面包屑） | ✅ | — | — | — |
| T7 | 搜索（当前：主列表前端过滤 + 空态；计划：焦点浮层 + 宿主 API） | 🚧 | — | — | — |
| T8 | 入口接线 + 选中后链路（upsert/sort/24h） | ✅ | — | — | — |
| T9 | 联调 + 视觉还原验收 + impl-notes | 🚧 | — | — | 🚧 |

> 实现顺序建议：T1（契约）→ T2（desktop）与 T3-T8（web，先用 mock 并行）→ T9（联调）。

## 待办 / 阻塞

- (web) **T7 改造中**：搜索改为 focus 触发浮层 + 空态图 + 全部/群组/人员 tab + 关键词高亮；取数对齐 PC `search-result.vue`（`getAccountSearchByUserName` + `getGroupBySearch`，不含机器人）；需新增桥 `searchAiBoxPicker`
- (desktop) T2：代码已落地（`aiBoxPickerHost.js` + `main.vue` 四 channel + `webview.js` preload + AiBrowser postMessage）；**待 E2E 验证**三 tab + 组织架构全链路
- (多端) T9 待视觉对照蓝湖 4 张截图验收；组织架构 `getDeptUsers` 等边界待继续联调
- (desktop) 待联调确认 `getDeptUsers` 是否必须传 `corpType`/`corpAndCorpRelType`（当前只传 corpId/pid）
- (desktop) 待联调确认群组 tab `lastChatAt` 来源（groupListApi 不返回，当前填 0，群组不按时间倒序）
- (web) 待联调确认 zx 页是否支持 `resume=1` 参数（24h 恢复 vs 新建）
- (多端) 待联调确认 `agentName` 是否需独立字段（当前私聊取昵称、群聊取群名）
- (ios) 仓库内有个人 AI / 选择智能体 WIP 改动，**本期矩阵不做**（spec 范围仅 web + desktop）

## 关键决策记录

- 2026-07-07 范围聚焦 apps/web + apps/desktop，android / ios 本期不动
- 2026-07-07 AI 框与群/私聊 1:1，列表全显示（不做「有无 AI 框」过滤）
- 2026-07-07 数据全部经 `window.webview.*` 向 desktop 壳取（移动端 `wnsdk.aiChat.*` 预留）
- 2026-07-07 弹窗用 AcDialog 壳，交互对齐 desktop 转发窗，布局按蓝湖稿单栏，单选
- 2026-07-07 选中后复用 `personalAiAgentAdapter`（mapSelectionToAgent/upsertSelectedAgent/sortAgents），24h 判 `lastChatAt`
- 2026-07-07 视觉严格还原蓝湖 4 张截图（UnoCSS 原子类，位图图标换 SvgIcon）
- 2026-07-08 AiBrowser 个人 AI 改回 **iframe + postMessage 桥**（便于调试）；微应用仍走 webview preload
- 2026-07-08 最近联系人 tab **排序在 web 端**执行（`sortRecentLikeTransmitMessage`，对齐 `transmit-message.vue`）；PC 桥只返回 `hasMessage`/`messageTime` 等字段，不在宿主侧排序
- 2026-07-08 群 2x2 头像经桥字段 `accountInfoList` 下发，web `normalizeRecentItem` 须透传
- 2026-07-08 web 组件拆分为 `AiBoxRow` / `OrgPicker` / `SearchInput` SFC；`PersonalAiChat` PC 入口接 `SelectAiBoxDialog`
- 2026-07-08 搜索将改为焦点浮层 + 宿主双接口（对齐 PC 转发窗），不再对主 tab 列表做内联过滤

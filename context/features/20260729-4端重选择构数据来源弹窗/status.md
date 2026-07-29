# Status：4端重构「选择数据来源」弹窗

> 最后更新：2026-07-29（web/desktop 搜索 UI 对齐发送目标：popover 本地搜；**真机手测未做**；android/ios 未开工）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约更新 · plan Task 1 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 纯逻辑模型 + 单测 · plan Task 3/7/8/9 | ✅ 18/18 | ⬜ | ⬜ | ✅ 18/18 |
| 弹窗/页改造 · plan Task 2/4/5/7/8/9 | ✅ | ⬜ | ⬜ | ✅ |
| 搜索 UI 对齐发送目标（popover）· plan Task 11 | ✅ | — | — | ✅ |
| 接口联调（抓包验证）· plan Task 6 | 🚧 待手测 | ⬜ | ⬜ | 🚧 待手测 |
| 自测通过 · plan Task 10 | ⬜ | ⬜ | ⬜ | ⬜ |

> **已完成**：desktop、web（含搜索 popover）。**未开工**：android、ios（走原生页 + 桥，见 impl-notes）。
> web 只改 PC 分支弹窗；移动端 web 走 `selectDataRangeScope` 桥打开 ios/android 原生页，原生两端改完即自动一致。

## desktop 提交（分支 `personal-ai-chat`）

| 内容 | 提交 |
|------|------|
| 归档前序功能脏树（用户授权） | `6e0708d4` |
| service 接入 `getAllImDialogue` | `eaaab2ce` |
| 纯逻辑模型 + 17 条单测 | `af34b90e` |
| 弹窗改造（前端搜索 / 分区全选 / 列表项子组件） | `b28b381c` |
| 群聊拆为组织群/外联群（先误提顶层 tab，后改为群组内子 tab） | `7489657c` + `9fee09b4` |
| 筛选条透传 accountId + 三个标记 | `5ba8eb7b` |
| 修复：`chat-box` 载荷丢字段 | `f8e78ea5` |
| 整枝审查修复第一轮（8 条） | `32ec5214` |
| 整枝审查修复第二轮（5 条） | `6d936f8e`…`206eb1ad` |
| 三态 null 链路修复 | `ddb2feec` |
| UI 微调 + 列表行对齐 AiBoxRow | 未提交（前序） |
| 搜索 popover 本地搜 + 主列表不过滤 + chip 头像 | 未提交 |

契约提交（context 仓库）：`cf5b9b4`（saveDataRange 三字段）+ 本次 `getAgentDataRange` 三字段 + `67e67bc`（saveDataRange 注释与 getAgentDataRange @unconfirmed 同步）。

## web 提交（分支 `personal-ai-chat`，BASE `a9a6d3e`）

| 内容 | 提交 |
|------|------|
| service `getAllImDialogue` + 纯逻辑模型 + 18 条 node:test | `aef593a2` |
| 弹窗改造（取数 / 本地搜索 / tab「全部」/ emit `{scopes,flags}`） | `90607f2` |
| save 链路全量化 + 三标记三态（conditionMode/Chat/DataScopeBar/FilterBar/ChatInput） | `3ceada40` |
| 整枝审查修复（双 emit 竞态 / SSE 体污染 / 移动端 ACK flags 陈旧） | `7f209c6` |
| 搜索改 AiBoxSearchBox popover（candidates 本地）+ 主列表不过滤 | 未提交 |

## 待办 / 阻塞

- (desktop/web) ⏳ **真机手测未做**（含新搜索 popover：零接口、勾选互通、表头全选仍按全量）。
- (全端) ❌ **后端待实现**：`getAgentDataRange` 回参补三个全选标记（契约已加并标 `@unconfirmed`）。
- (全端) ⏳ 抓包待确认 4 项：返回顺序、`groupInfo.type`、selectAll 补录时机、量级。
- (全端) ⏳ **最脆假设待验证**：私聊 `targetId` 是否等于组织架构 `accountId`。
- (android/ios) **本功能未开工**，走原生页 + `selectDataRangeScope` 桥。

## 关键决策补充（搜索 UI · 2026-07-29）

- 顶栏搜索对齐「选择发送目标」：`AiBoxSearchBox` / desktop 等价 popover；`candidates` 本地过滤，零接口
- 候选始终为全量人+群，与顶层 tab 无关；popover 内「全部 / 群组 / 人员」
- 主列表不随关键字过滤，只更新勾选态；表头全选与上报三标记均按未过滤全量
- web：`selectedKeys` 对搜面板适配为 `ownerType:id`；内部集合仍 `1_id` / `3_id`
- desktop：新建 `data-scope-search-box.vue`，不改全局 `search-box.vue` HTTP 行为；已选 chip 补头像

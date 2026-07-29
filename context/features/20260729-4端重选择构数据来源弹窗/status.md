# Status：4端重构「选择数据来源」弹窗

> 最后更新：2026-07-29（android/ios 代码在工作区未 commit；真机仅做过 onTest 重装排查；四端 E2E/抓包未完成）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约更新 · plan Task 1 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 纯逻辑模型 + 单测 · plan Task 3/7/8/9 | ✅ 18/18 | ✅ 17/17（工作区） | ✅ ZXDataScopeModel（无单测基建） | ✅ 18/18 |
| 弹窗/页改造 · plan Task 2/4/5/7/8/9 | ✅ | 🚧 代码完成·未 commit | 🚧 代码完成·未 commit | ✅ |
| 搜索 UI 对齐发送目标（popover）· plan Task 11 | ✅ | —（独立搜索页本地过滤） | —（独立搜索页本地过滤） | ✅ |
| 接口联调（抓包验证）· plan Task 6 | 🚧 待手测 | 🚧 待真机 | 🚧 待真机 | 🚧 待手测 |
| 自测通过 · plan Task 10 | ⬜ | ⬜ | ⬜ | ⬜ |

> **代码状态**：desktop/web 主体已在分支；android/ios DataScope 改造在工作区 **未 commit**。**真机/E2E 未验收**。
> web 只改 PC 分支弹窗；移动端 web 走 `selectDataRangeScope` 桥打开原生页。

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

## android / ios（分支 `personal-ai-chat`，**工作区未 commit**）

| 端 | 内容 |
|----|------|
| android | `DataScopeModel` + 17 单测；`getAllImDialogue`；SelectDataRange 候选/门闩/三态；Group/Search multi 本地过滤；段头「全部」。顺带：群智能体筛选条 `checkedRangeList` 空指针防护、资料卡本地回退 `isEmpty` 写反修复、badge LayoutParams 安全转型。**SCHEMA 保持 73（按用户要求不改）**。已 onTest 重装，@ 闪退仍待用户确认。 |
| ios | `ZXDataScopeModel`；`API_GetAllImDialogue`；dataRange/`Picker` 路径候选与三态；群/搜本地过滤。入口须改 `ZXPersonalAiPickerController`（见 impl-notes）。 |

## 待办 / 阻塞

- (desktop/web) ⏳ **真机手测未做**（含搜索 popover：零接口、勾选互通、表头全选仍按全量）。
- (android/ios) ⏳ **真机自测 / commit 未做**：打开页只发 2 请求、本地搜、全选联动、save 三标记、桥 ACK 后胶囊刷新；android 已重装 onTest，完整 DataScope E2E 未跑通确认。
- (android) ⏳ `@` 智能体闪退：用户反馈后重装验证中；已修资料卡/群条空指针防护，**根因栈未抓到**，需用户复现后对照 logcat。
- (android/ios) ⏳ 群头像：接口前 4 URL 拼合未完全对齐 PC。
- (全端) ❌ **后端待实现**：`getAgentDataRange` 回参三全选标记（`@unconfirmed`）。
- (全端) ⏳ 抓包 4 项：返回顺序、`groupInfo.type`、selectAll 补录时机、**量级（2k 性能见 impl-notes）**。
- (全端) ⏳ **最脆假设**：私聊 `targetId` ≡ 组织架构 `accountId`。
- (web/desktop) ⏳ 若现网常到 ~2k 条：优先虚拟列表；android 全选可改 DiffUtil（见 impl-notes）。

## 关键决策补充（搜索 UI · 2026-07-29）

- 顶栏搜索对齐「选择发送目标」：`AiBoxSearchBox` / desktop 等价 popover；`candidates` 本地过滤，零接口
- 候选始终为全量人+群，与顶层 tab 无关；popover 内「全部 / 群组 / 人员」
- 主列表不随关键字过滤，只更新勾选态；表头全选与上报三标记均按未过滤全量
- web：`selectedKeys` 对搜面板适配为 `ownerType:id`；内部集合仍 `1_id` / `3_id`
- desktop：新建 `data-scope-search-box.vue`，不改全局 `search-box.vue` HTTP 行为；已选 chip 补头像
- 移动端：保持纵向独立搜索页，但候选改为主页缓存的 `getAllImDialogue` 全量本地过滤（非 DB / 非融云列表）

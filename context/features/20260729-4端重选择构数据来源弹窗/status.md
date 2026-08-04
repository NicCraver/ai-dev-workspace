# Status：4端重构「选择数据来源」弹窗

> 最后更新：2026-08-03（web 全选再优化：选中 Set + 懒搜索候选，本地未 commit）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约更新 · plan Task 1 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 纯逻辑模型 + 单测 · plan Task 3/7/8/9 | ✅ 19/19 | ✅ 18/18 | ✅ ZXDataScopeModel（无单测基建） | ✅ 19/19 |
| 弹窗/页改造 · plan Task 2/4/5/7/8/9 | ✅ | ✅ 已 push（待真机） | ✅ 已 push（待真机） | ✅ |
| 搜索 UI 对齐发送目标（popover）· plan Task 11 | ✅ | —（独立搜索页本地过滤） | —（独立搜索页本地过滤） | ✅ |
| 私聊 leave=1 名字后缀「（已离职）」 | ✅ 本地未 commit | ✅ `22507f131` 已 push | ✅ 本地未 commit | ✅ 本地未 commit |
| 接口联调（抓包验证）· plan Task 6 | 🚧 待手测 | 🚧 待真机 | 🚧 待真机复测 | 🚧 待手测 |
| 自测通过 · plan Task 10 | ⬜ | ⬜ | ⬜ | ⬜ |

> **ios**：前序一版用户不满意已撤回；本轮以当前已提交 Picker 为起点按方案 A 重做。
> 两入口共用 `ZXPersonalAiPickerController`：① 桥 `selectDataRangeScope`；② 群聊 `@` 个人筛选条 `zx_presentPersonalAiDataScopePicker`。
> web 只改 PC 分支弹窗；移动端 web 走桥打开原生页。

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
| （同分支旁路）推送延后到个人 AI 可见再刷 | `b8c632b2` |

契约提交（context 仓库）：`cf5b9b4`（saveDataRange 三字段）+ `getAgentDataRange` 三字段 + `67e67bc`。

## web 提交（分支 `personal-ai-chat`）

| 内容 | 提交 |
|------|------|
| service `getAllImDialogue` + 纯逻辑模型 + 18 条 node:test | `aef593a2` |
| 弹窗改造（取数 / 本地搜索 / tab「全部」/ emit `{scopes,flags}`） | `90607f2` |
| save 链路全量化 + 三标记三态 | `3ceada40` |
| 整枝审查修复（双 emit / SSE / 移动端 ACK flags） | `7f209c6` |
| 搜索改 AiBoxSearchBox popover + 主列表不过滤 | `2ad2f15` |
| （同分支旁路）推送延后激活 + SettingEditClashDialog | `f3913ef` |

## android / ios（分支 `personal-ai-chat`）

| 端 | 内容 | 提交 |
|----|------|------|
| android（已 push） | `DataScopeModel` + 17 单测；`getAllImDialogue`；`SelectDataRangeActivity` 候选/门闩/三态；Group/Search multi 本地过滤；段头「全部」；群头像前 4 URL 拼合 | `55f22b5c9` |
| ios（本轮重做，已 push） | `ZXDataScopeModel`；Manager `getAllImDialogue` + save 三标记；Picker「全部」+ `selectedKeySet`；Group/Search 复用缓存；restore 门闩 + 三态；P1：搜索 cancel delay、restoreEpoch/dirty 防冲选、群页 ready 后补载 | `890905ae3` |

## 待办 / 阻塞

- (四端) ✅ **私聊 leave=1**：`normalize` 后 `name` 后缀 `（已离职）`（列表/搜索/chip 同源）；本地未 commit / push。
- (web) ✅ **外联群子 tab 空列表**：`GROUP_TABS` key `outsource` 与 `splitGroups.outreach` 错位；已改为 `outreach`（本地未 commit）。手测：`groupInfo.type>=10`（如「智信运营测试群」）应出现在「群组→外联群」。
- (desktop/web) ✅ **列表展示对齐 spec**：人用 `privateInfo.avatar`；群用成员前 4 拼图（不用 `agentAvatar`）；**不展示智能体名**（列表/搜索/组织架构）。desktop + web 本地未 commit。
- (desktop/android/ios) ✅ 外联分流本来就对：`isOutreach = groupInfo.type >= 10` + 外联分区消费 `outreach`。
- (web) ✅ **全选/渲染卡顿（二轮）**：`selectedKeySet`（Set）作选中真源，全选不再物化上千条 item Map；搜索候选聚焦后才挂、直接复用 `dialogueItems`（normalize 补 `id`）；OrgPicker 的 `private:id` 不再污染 `1_id` 真源；chip / org / search 适配键均懒算。本地未 commit。手测：上千条点「全部」与打开弹窗应更顺。
- (desktop/web) ⏳ **真机手测未做**（含搜索 popover：零接口、勾选互通、表头全选仍按全量；web 外联子 tab 回归；人头像/无智能体名；离职后缀；**全选流畅度**）。
- (android) ⏳ **真机自测**（含离职后缀）：打开只发 2 请求、本地搜、全选联动、三标记、桥 ACK 后胶囊刷新。
- (ios) ⏳ **真机自测**（含离职后缀）：打开只发 2 请求；段头「全部」；群/搜索零额外列表请求；全选联动；迟到 restore 不冲选；过早进群页后列表能补出；搜索返回不崩；save 三标记；桥 ACK / `@` 再 get。
- (android) ✅ 群头像：接口前 4 URL 拼 2×2（无 URL 退本地拼图）；待真机看列表/已选弹层。
- (ios) ⏳ 群头像：仍可能用首个非空 URL / 本地拼图，未完全对齐 PC。
- (ios) ⏳ 两千条级：整表 `reloadData` 仍可能顿挫；若体感差再拆。
- (全端) ❌ **后端待实现**：`getAgentDataRange` 回参三个全选标记（契约 `@unconfirmed`）。
- (全端) ⏳ 抓包待确认：返回顺序、selectAll 补录时机、量级；私聊 `targetId` === 组织架构 `accountId`。（`groupInfo.type>=10`=外联群：web 空列表已归因于 UI key，模型判据已验证）

## 关键决策补充

### 列表展示 · 离职后缀 · 2026-07-30
- 私聊 `Number(privateInfo.leave) === 1` → 展示名 = `targetName` + `（已离职）`（模型层 normalize，四端一致）
- `leave` 缺省 / 0 / 非 1：不加后缀；群聊不处理

### 列表展示 · 2026-07-30
- 人：`privateInfo.avatar`（联系人头像，不是智能体头像）
- 群：`accountInfoList` 前 4 人拼图（不用 `agentAvatar`）
- **不展示智能体名称**（与「选择 AI 框」区分；搜索也不按智能体名匹配）

### iOS 入口与性能 · 2026-07-29
- 桥 `selectDataRangeScope` → `ZXPersonalAiPickerController`（`Picker/`），不是 `ZXSelectAiAgentController`
- 全量候选后勾选态必须用 key 集合 O(1)，禁止 dataSource×selected 嵌套扫描 + 批量同步查库

### iOS 重做 · 2026-07-29
- 用户撤回前序 ios 改造；本轮方案 A：抽出 `ZXDataScopeModel` + 原地改 Picker；两入口接线不动

### iOS P1（审查）· 2026-07-29
- 搜索页：`viewWillDisappear` / `dealloc` / 回车搜前 `cancelPreviousPerformRequestsWithTarget`
- restore：`restoreEpoch` 丢弃过期回调；`selectionDirtyByUser` 为真时只保留 memory、不 `applyInitialScopes`
- 群页：`onSel` / `viewWillAppear` 在 dialogue ready 且本地空时 `loadGroupsFromDialogueCache`

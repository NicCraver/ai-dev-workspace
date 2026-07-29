# Status：4端重构「选择数据来源」弹窗

> 最后更新：2026-07-29（android/ios 改造落地；ios 已接到真桥入口 Picker 并修全量 O(n²) 卡死；四端真机 E2E 仍待）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约更新 · plan Task 1 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 纯逻辑模型 + 单测 · plan Task 3/7/8/9 | ✅ 18/18 | ✅ 17/17 | ✅（无单测基建，ZXDataScopeModel） | ✅ 18/18 |
| 弹窗/页改造 · plan Task 2/4/5/7/8/9 | ✅ | ✅ 代码完成（未 commit） | ✅ 代码完成（未 commit；入口=Picker） | ✅ |
| 搜索 UI 对齐发送目标（popover）· plan Task 11 | ✅ | —（独立搜索页本地过滤） | —（独立搜索页本地过滤） | ✅ |
| 接口联调（抓包验证）· plan Task 6 | 🚧 待手测 | 🚧 待真机 | 🚧 接口已通；卡死已修待复测 | 🚧 待手测 |
| 自测通过 · plan Task 10 | ⬜ | ⬜ | ⬜ | ⬜ |

> **代码完成**：desktop、web、android、ios。**apps 侧 android/ios 改动尚未 commit/push**。
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

契约提交（context 仓库）：`cf5b9b4`（saveDataRange 三字段）+ `getAgentDataRange` 三字段 + `67e67bc`。

## web 提交（分支 `personal-ai-chat`）

| 内容 | 提交 |
|------|------|
| service `getAllImDialogue` + 纯逻辑模型 + 18 条 node:test | `aef593a2` |
| 弹窗改造（取数 / 本地搜索 / tab「全部」/ emit `{scopes,flags}`） | `90607f2` |
| save 链路全量化 + 三标记三态 | `3ceada40` |
| 整枝审查修复（双 emit / SSE / 移动端 ACK flags） | `7f209c6` |
| 搜索改 AiBoxSearchBox popover + 主列表不过滤 | 未提交 |

## android / ios（分支 `personal-ai-chat`，**未 commit**）

| 端 | 内容 |
|----|------|
| android | `DataScopeModel` + 17 单测；`getAllImDialogue`；`SelectDataRangeActivity` 候选/门闩/三态；Group/Search multi 本地过滤；段头「全部」 |
| ios | `ZXDataScopeModel`；Manager `getAllImDialogue`；**真入口 `ZXPersonalAiPickerController`**（非 SelectAiAgent）；Group/Search 复用缓存；`selectedKeySet` 修全量 O(n²) 打开卡死；三态 save + restore 门闩 |

## 待办 / 阻塞

- (desktop/web) ⏳ **真机手测未做**（含搜索 popover：零接口、勾选互通、表头全选仍按全量）。
- (android) ⏳ **真机自测 + commit/push**：打开只发 2 请求、本地搜、全选联动、三标记、桥 ACK 后胶囊刷新。
- (android) ✅ 已选弹层 id/无头像：记忆返显后用候选清单+本地通讯录回填 name/avatar；列表人头像走本地绑定（2026-07-29 已装机待复测）。
- (ios) ⏳ **复测打开页**（卡死修复后）：列表可交互、全选/滚动两千级体感、save 三标记、桥 ACK；然后 commit/push。
- (android/ios) ⏳ 群头像：接口前 4 URL 拼合未完全对齐 PC。
- (ios) ⏳ 两千条级：整表 `reloadData` + 群头像本地拼图仍可能顿挫；若体感差再拆后台归一化 / 优先接口头像 URL。
- (全端) ❌ **后端待实现**：`getAgentDataRange` 回参三个全选标记（契约 `@unconfirmed`）。
- (全端) ⏳ 抓包待确认：返回顺序、`groupInfo.type`、selectAll 补录时机、量级；私聊 `targetId` === 组织架构 `accountId`。

## 关键决策补充

### 搜索 UI · 2026-07-29
- PC：顶栏 popover 本地搜；主列表不过滤；三标记按未过滤全量
- 移动端：独立搜索页，对 `getAllImDialogue` 缓存本地过滤

### iOS 入口与性能 · 2026-07-29
- 桥 `selectDataRangeScope` → `ZXPersonalAiPickerController`（`Picker/`），不是 `ZXSelectAiAgentController`
- 全量候选后勾选态必须用 key 集合 O(1)，禁止 dataSource×selected 嵌套扫描 + 批量同步查库

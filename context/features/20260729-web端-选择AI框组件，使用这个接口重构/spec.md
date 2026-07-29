# Spec：web 端「选择 AI 框」组件用 getAllImDialogue 重构

> 由 Superpowers brainstorm 产出。最后更新：2026-07-29  
> 用户授权自主拍板后定稿。

## 背景与目标

PC Web 的「选择 AI 框」弹窗（`SelectAiBoxDialog`）当前取数链路：

| 视图 | 现状 |
|------|------|
| 最近联系人 | 桥 `getRecentContacts` + HTTP `recentContactList` 补齐 agent |
| 群组 | 桥 `getMyGroups`（组织群/外联群）+ `batchGetAgent` |
| 搜索 | HTTP `selectGroupBySearch`（popover） |
| 组织架构 | 桥公司/部门树 + `batchGetAgent`；组织/外联双 scope |

与已落地的「选择数据来源」弹窗（`selectModel: 0`）类似，个人 AI 框「选智能体」场景应统一到 `POST /personalAiFrame/getAllImDialogue`，且 **`selectModel: 1`**。

**成功标准**：

1. 打开弹窗发一次 `getAllImDialogue({ accountId, selectModel: 1 })`，再用一次 `batchGetAgent` 补齐智能体字段（组织架构钻取除外）；切顶层 tab、打字搜索**零**额外请求。
2. 「最近联系人」文案改为「全部」，展示有 `agentId` 的人 + 组织群（后端原序）。
3. 「群组」只展示组织群；子 tab 仅剩一项时整条隐藏。
4. 搜索保留 popover +「全部 / 群组 / 人员」，本地过滤；会话名与智能体名均可搜、均可高亮。
5. `OrgPicker` 只保留「选择组织人员」；无 `agentId` 的人员不展示；scope 仅一项时整条隐藏。

## 用户流程

1. 用户打开「选择 AI 框」弹窗。
2. 弹窗以 `accountId`（登录用户 id）调用 `getAllImDialogue`，`selectModel: 1`；结果缓存于弹窗生命周期。
3. 前端归一化 → 丢弃无 `targetId` 的项 → 按人/群 id 调 `batchGetAgent` 补齐 → 丢弃补齐后仍无 `agentId` 的项 → 派生：
   - **全部**：剩余全量（人 + 群，含外联群是否进入「全部」见下方决策）；
   - **群组**：仅组织群（`groupInfo.type < 10` 或缺失）。
4. 用户在「全部 / 群组 / 组织架构」间切换单选；或在右上角搜索框输入，popover 对缓存做本地过滤后选择。
5. 点「确定」提交当前选中项（形态与现网一致：`ownerType` / `id` / `agentId` / `aiRoleId` / `agentName` / `agentAvatar` 等）；关闭弹窗。

**关键分支**：

- 取数失败：列表/空态提示加载失败；搜索无候选时显示空结果（可重试拉全量）。
- 打开弹窗：每次均为未选中（保持现行为）；忽略回参 `selected`（该字段属 `ai_frame_user_setting`，不是本弹窗的选中态）。
- 组织架构：仍可钻公司→部门→人；`batchGetAgent` 补齐后**无 `agentId` 的行不渲染**。

## 范围

**本期做（仅 web）**：

- `SelectAiBoxDialog` 数据源改为 `getAllImDialogue`（`selectModel: 1`）
- 顶层 tab「最近联系人」→「全部」
- 群组子 tab：去掉外联群；仅一项时隐藏子 tab 条
- 搜索：popover 改吃候选缓存；过滤字段含 `name`（会话名）与 `agentName`；高亮两者（`AiBoxSearchRow` 已支持）
- `OrgPicker`：去掉外联人员；仅一项时隐藏 scope 条；过滤无 `agentId`
- 抽出纯逻辑 mapper + `node --test`（与 `dataScopeModel` 分文件，避免把选智能体语义耦进数据来源模型）
- 契约 Changelog 注明本消费方（`selectModel: 1`）

**本期不做**：

- 不改 `SelectDataRangeDialog` / 四端数据来源功能（`selectModel: 0`）
- 不改组织树桥协议与公司/部门取数
- 不移植 android / ios / desktop
- 不做拼音搜索、虚拟列表
- 不强制删除 `selectGroupBySearch` / `fetchRecent` 等旧路径（若仅本弹窗使用可顺带停用调用；其它调用方保留）

## 自主拍板（原待确认项）

| 议题 | 决策 |
|------|------|
| 「全部」是否含外联群 | **含**：与「全部 = 接口过滤后全量」一致；「群组」tab 仍只展示组织群。外联群只能在「全部」或搜索「群组/全部」里出现（若后端在 selectModel=1 仍返回外联且带 agentId） |
| 搜索「群组」是否含外联 | **含**（与全部同源缓存；仅按 `ownerType==='group'` 分 tab）。列表「群组」顶层 tab 仍只组织群 |
| 打开时是否用 `selected` 预勾 | **否**，保持每次未选中 |
| `accountId` 来源 | `user.value?.id`（与 `selectGroupBySearchApi` 一致） |
| 与 `dataScopeModel` 关系 | **新建** `aiBoxPickerModel.js`，不复用数据来源归一化（先保留待 batch 补齐项，补齐后再强制 `agentId` 过滤） |

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本期是否改 | **是（PC 弹窗）** | 否 | 否 | 否 |
| 入口 | `SelectAiBoxDialog` | — | — | — |

## 数据与状态模型

**取数**：开弹窗一次 `getAllImDialogue({ accountId, selectModel: 1 })`，再按 `targetId` 调 `batchGetAgent` 补齐；过滤后的列表存内存，关闭可清空。

**归一化行（供 `AiBoxRow` / 搜索行）**：

- `id` = `targetId`（字符串）
- `ownerType` = `type===3` → `group`，否则 `private`
- `name` = `targetName`（展示层空则兜底 id）
- `agentId` / `aiRoleId` / `agentName` / `agentAvatar` 先取回参；为空时由 `batchGetAgent` 补齐
- 私聊头像：`privateInfo.avatar`；群拼合：`groupInfo.accountInfoList` 前 4
- `isOutreach` = 群且 `groupInfo.type >= 10`
- **丢弃**：归一化阶段丢无 `targetId`；batch 补齐后丢无 `agentId`（空串/null 均丢）

**搜索过滤**：对 `name`、`agentName` 做忽略大小写子串匹配；任一命中即保留。结果分 tab：全部 = 群在前人员在后（保持现 `AiBoxSearchPanel` 顺序约定）；群组/人员为子集。

**子 tab / scope 条可见性**：可选项数组长度为 1 时不渲染切换条，内部固定唯一 key。

## 依赖的接口

- `context/contracts/personalAiFrame/getAllImDialogue.d.ts`（已有；Changelog 追加本功能为 `selectModel: 1` 消费方）
- Web HTTP：`apps/web/src/server/module/personalAiFrame.js` → `getAllImDialogue`（已有）
- 组织架构：现有桥 `getOrgCompanies` / `getDeptUsers` + `batchGetAgent`（不变）

## 错误处理

| 场景 | 行为 |
|------|------|
| `getAllImDialogue` 失败 | 「全部/群组」空态提示失败；搜索无数据；可再次打开弹窗重试 |
| `accountId` 为空 | 不发请求，提示账号未就绪 |
| 组织树 / batchGetAgent 失败 | 保持 OrgPicker 现有兜底（空列表） |

## 与相关功能的边界

- **数据来源弹窗**（`20260729-4端重选择构数据来源弹窗`）：共用同一接口契约，但 `selectModel: 0`、多选、全选标记；本功能单选选智能体，互不改对方代码。
- **OrgPicker** 仍被数据来源弹窗复用：隐藏外联 scope / 过滤无 agentId 时，须用 **prop 开关**（例如 `hideOutsource` / `requireAgent`），默认保持数据来源弹窗旧行为，避免误伤。

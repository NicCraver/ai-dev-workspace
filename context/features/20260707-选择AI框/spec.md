# Spec：选择AI框

> 由 Superpowers brainstorm 产出。最后更新：2026-07-07
> 活跃功能目录：context/features/20260707-选择AI框/

## 背景与目标

web 端「智信 AI 框」目前选择对话对象走宿主 native（`selectAgentByNative` → `wnsdk.aiChat.selectAiAgent`），且 `personalAiAgentAdapter` / `personalAiSelectorMessage` 这套「个人 AI 框 / agent 列表」地基尚未接入真实入口（`selectAgentByNative` 无调用点、adapter 仍用 mock）。

**本期目标**：用 web 自绘的 H5 弹窗替代 native 选择 UI（PC 环境），让用户通过「最近联系人 / 群组 / 组织架构」三 tab + 搜索，**单选**一个群或私聊的 AI 框，选中后切换到该 AI 框对话，并按 24h 规则恢复或新建对话。同时把这套 agent 体系接入第一个真实入口。

**成功标准**：PC（web main/desktop 入口）下，点「选择 AI 框」→ 弹 H5 弹窗 → 三 tab/搜索/组织钻取可用 → 单选 → agent 出现在列表正确位置（置顶区/非置顶区）→ 对话切换且按 24h 恢复/新建。

## 范围

- **本期做（apps/web）**：`SelectAiBoxDialog` 弹窗（三 tab + 搜索 + 组织架构钻取 + 单选）、选中后 agent 出现/定位/对话切换、`bridge.md` 补全协议
- **本期做（apps/desktop，PC 壳）**：实现 `window.webview.*` 桥接口（`getRecentContacts` 补 `agentName`/`lastChatAt`；新增 `getMyGroups` / `getOrgCompanies` / `getDeptUsers`）
- **本期不做**：android / ios（移动端 native 桥与选择 UI 均后续）；web mobile 入口；多选；转发附言/消息预览

## 用户流程

1. home 页点「选择 AI 框」→（PC）打开 `SelectAiBoxDialog`
2. 在三 tab 之一或搜索中找到目标 → 单选一行（底部即时显示「已选：群名 / AI框名」）
3. 点「确定」→ 弹窗关闭，选中结果回 home
4. home：`mapSelectionToAgent` → `upsertSelectedAgent`（未在列表则加入）→ `sortAgents`（置顶区/非置顶区定位）→ 切换当前 agent
5. 加载对话：该 AI 框 `lastChatAt` 在 24h 内 → 恢复最近对话；超过 24h → 新建对话

## UI 设计

**布局**（蓝湖稿 `lanhu_xuanzeaikuang`，单栏）：`AcDialog` 壳（约 690×540，`splitTheme`），顶部标题「选择 AI 框」+ 关闭；内含三 tab + 搜索框；主体列表；底部「已选：xxx / 取消 / 确定」。

**交互范式对齐 desktop 转发窗**（见 `context/platforms/desktop-forward-dialog.md`），差异：单选、无双栏、无留言/消息预览。

- **tab1 最近联系人**：群 + 私聊混合，按 `lastChatAt` 倒序。行 = 单选图标 + 头像（`AcAvatar` / `AcGroupAvatar`）+ 群/人名 + AI 框名（`agentName`，副行）
- **tab2 群组**：顶部「组织群 / 外联群」切换（≈ `organization-outsource` 切换头，对应 `groupType` 0/10）；列表按 `lastChatAt` 倒序；行同上
- **tab3 组织架构**：顶部「选择组织人员 / 选择外联人员」切换；公司列表（入职企业 / 我的下级，或外联企业，带人数）→ 点公司进入部门树 → 点部门进入子部门 + 人员；面包屑可回溯；人员行可单选
- **搜索**：placeholder「搜索联系人、智能体」；前端对已拉数据按 `name` / `agentName` `includes` 过滤（组织架构仅过滤当前展开层）

**单选语义**：单个 `selectedKey`；点行即选并高亮、底部即时更新；再点其他切换；未选时「确定」禁用。

**视觉还原（硬性要求）**：严格按蓝湖设计稿还原视觉——源文件 `/Users/nic/Downloads/LanhuProject/src/views/lanhu_xuanzeaikuang/index.vue` + 4 张截图（最近联系人 / 组织·公司 / 组织·部门树 / 组织·面包屑+人员）。尺寸、间距、圆角、配色一律用 UnoCSS 原子类表达（对照 `context/dev-rules/unocss-conventions.mdc` 与 `apps/web/uno.config.js` token）。设计稿中的位图图标（`SketchPng*.png`）**不直接搬**，替换为项目既有 `SvgIcon` 体系或等价矢量图标；切图缺失则向设计索取 SVG。

## 数据契约（wnsdk / webview 桥）

PC 走 `window.webview.*`（扁平，由 apps/desktop 壳实现）；移动端 `wnsdk.aiChat.*`（命名空间）本期不做、仅协议预留。以下写入 `context/bridge.md`（当前为空模板，需补全通信机制 / 消息格式 / Changelog）：

| 数据 | 方法 | 入参 | 返回字段 | 状态 |
|---|---|---|---|---|
| 最近联系人 | `getRecentContacts()` | - | `accountId/id, name, agentName, avatar, ownerType, lastChatAt` | 现成，**需宿主补 `agentName` + `lastChatAt`** |
| 我的群组 | `getMyGroups({type, pageNum, pageSize})` | `type: 'organization'\|'outsource'` | `id, name, agentName, avatar, memberCount, groupType, lastChatAt` | **新增** |
| 组织·公司 | `getOrgCompanies({type})` | `type: 'organization'\|'outsource'` | `corpId, name, memberCount, corpType`（organization 含入职企业 + 下级分组） | **新增** |
| 组织·部门/人员 | `getDeptUsers({corpId, pid})` | `corpId, pid` | `{ depts:[{id,name,memberCount,pid}], users:[{accountId,name,agentName,avatar}] }` | **新增** |

**统一字段约定**（与 `personalAiAgentAdapter` 对齐）：人员 `accountId`、群 `id`、AI 框名 `agentName`、最近对话 `lastChatAt`、`ownerType` ∈ group/private。

**搜索**：前端过滤，不新增接口（若「全部可私聊人员」数据量过大再议宿主搜索接口）。

## 组件结构

新增（`src/components/views/home/`，与 adapter 同域）：

- **`SelectAiBoxDialog.vue`**：`AcDialog` 壳 + 三 tab 切换 + 搜索 + 单选状态 + 底部「已选/取消/确定」；最近联系人、群组两 tab 内容内联渲染
- **`OrgPicker.vue`**：组织架构钻取（公司 → 部门 → 人员 + 面包屑 + 组织/外联切换），独立子组件

**复用**：`AcDialog` / `AcAvatar` / `AcGroupAvatar` / `CheckboxView` / `SvgIcon` / `ChatSearch`（参考 `ShareTargetDialog.vue`）；`personalAiAgentAdapter`（`mapSelectionToAgent` / `upsertSelectedAgent` / `sortAgents`）；`useMobileEnv`（环境判断）；最近联系人取数 `window.webview.getRecentContacts`。

**入口接线**：home 加「选择 AI 框」按钮 → `useMobileEnv` 判 PC → 打开 `SelectAiBoxDialog`；`@submit(selection)` → 走选中后链路。

## 选中后链路

1. `mapSelectionToAgent(selection)` → agent
2. `upsertSelectedAgent(agents, agent)` → 已存在取消 `hidden` + 刷 `lastChatAt`，否则 push（需求 1.3「出现」）
3. `sortAgents(agents)` → 个人 → 置顶(`pinnedAt`↑) → 普通(`lastChatAt`↓)（需求 1.4「定位」）
4. 切换当前 agent
5. **24h 判定**：`Date.now() - lastChatAt < 24h` → 恢复最近对话；否则新建
6. 加载对话：AI 流式 `API_AI_BASE_URL` + `useEventSource`，按 `chatType/targetId/agentId`

> ⚠️ home 的「agent 列表渲染 + 切换 + 对话加载」链路若尚未实现，需一并搭建（实现阶段确认现状）。

## 异常与边界

- 桥接口缺失（老壳）：打开弹窗探测，缺则提示「请升级到最新版本」
- 取数超时/失败：tab 内「加载失败，点击重试」
- 空列表 / 无搜索结果 / 空部门：空态文案
- 未选时「确定」禁用
- `getRecentContacts` 缺 `agentName`/`lastChatAt`：视为宿主 bug，联调补齐

## 测试策略

web 端无单测：`pnpm build`（vue-tsc）类型检查 + 壳内真机联调。桥不可用时用 mock（仿 `createMockAgents`）跑通 UI。关键手测：三 tab 切换、组织/外联切换、组织钻取 + 面包屑、搜索、单选切换、选中后列表出现/定位、24h 恢复 vs 新建。

## 各端差异点

| 差异点 | web | android | ios | desktop |
|---|---|---|---|---|
| 选择 UI | PC 走 H5 弹窗（本期）；mobile 后续 | 本期不动 | 本期不动 | 本期不动（仅供给数据） |
| 桥接口实现 | 消费 `window.webview.*` | 本期不动 | 本期不动 | 实现 `window.webview.*`（含补 `getRecentContacts` 字段） |
| 移动端选择 | 后续 | 后续 | 后续 | - |

## 待联调确认

1. `getRecentContacts` 现有返回是否已含 `agentName` + `lastChatAt`（决定宿主是否加字段）
2. home 页 agent 列表渲染/切换/对话加载是否已存在（决定是否一并搭建）
3. desktop 壳 `window.webview.*` 接口命名与入参与 web 对齐；移动端 `wnsdk.aiChat.*` 后续再议
4. 群组列表量级 / 全公司可私聊人员量级（决定搜索是否需宿主接口）

## 附录：列表/历史双栏收起悬浮条（2026-07-16）

个人 AI（`PersonalAiChat`）编排，共用 `PersonalAiFloatingDock`：

| 状态 | UI | 内容 |
|------|-----|------|
| 列表收起 · 历史展开 | 白底胶囊，左吸附，可上下拖；初始 top 在头像下 | 展开列表 + 选择AI框 |
| 列表展开 · 历史收起 | 对话区左上；**无白底无圆角** | 展开历史 + 开启新对话 |
| 双收起 | 白底胶囊 | 列表 + 选择AI框 ‖ 历史记录 + 开启新对话 |
| 双展开 | 无悬浮条 | 用各自顶栏收起 |

独立 `zx/home` 不启用；Home 经 `v-model:history-sidebar-open` + `hideBuiltinCollapseChrome` 与父级联动。

## 附录：ios 选择数据范围（2026-07-17）

Home FilterBar「数据范围」在 **ios 原生多选**（方案 1：复用选择 AI 框页，不对齐 web 三 tab/OrgPicker）。

| 项 | 约定 |
|---|---|
| 桥 | `wnsdk.aiChat.selectDataRangeScope`（新建，见 `context/bridge.md`） |
| 入参 | `{ initialScopes:[{scopeDataType,scopeDataId}] }` 预勾 |
| 回传 | `{ type:"personal-ai:selected-data-range", payload:{ scopes:[{scopeDataType,scopeDataId,name?,avatar?}] } }` |
| UI | 标题「选择数据范围」；强制多选；最近聊天/选择已有群组「全部」；选择联系人/搜索多选无全部；底栏已选；0 项确定 disabled |
| 职责 | 原生只选人/群回传；web 写 `conditionMode` + `saveDataRange` |
| web | `DataScopeBar`：`isMobile()` → 原生桥；PC 仍 `SelectDataRangeDialog` |
| android | 已对称：`SelectDataRangeActivity` 独立多选页 + 同名桥（待真机 E2E） |

成功标准：ios 真机点「数据范围」→ 原生多选 → 确定后 scope 回显并可随 aiChat 发送。

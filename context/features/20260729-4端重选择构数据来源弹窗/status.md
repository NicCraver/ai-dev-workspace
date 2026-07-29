# Status：4端重构「选择数据来源」弹窗

> 最后更新：2026-07-29（spec + plan 已产出；尚无代码改动）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约更新（saveDataRange 三字段）· plan Task 1 | ⬜（共用） | ⬜（共用） | ⬜（共用） | ⬜（共用） |
| 纯逻辑模型 + 单测 · plan Task 3/7/8/9 | ⬜ | ⬜ | ⬜ | ⬜ |
| 弹窗/页改造（换数据源 + 前端搜索 + 全选）· plan Task 2/4/5/7/8/9 | ⬜ | ⬜ | ⬜ | ⬜ |
| 接口联调（抓包验证）· plan Task 6 | ⬜ | ⬜ | ⬜ | ⬜ |
| 自测通过 · plan Task 10 | ⬜ | ⬜ | ⬜ | ⬜ |

> 落地顺序：**desktop 先行**（改造 + 抓包 + 沉淀 impl-notes）→ web / ios / android 照 impl-notes 复制。
>
> web 只改 PC 分支弹窗；移动端 web 走 `selectDataRangeScope` 桥打开 ios/android 原生页，原生两端改完即自动一致，web 移动端分支不动。

## 待办 / 阻塞

- (全端) spec 与 plan 已产出（plan 共 10 个任务）；Task 6（desktop 联调 + impl-notes）是 Task 7/8/9 的前置，**未完成前不要开其他三端**
- (全端) 契约 `saveDataRange.d.ts` 需补 `groupAndAccountSelectAll` / `organizationGroupSelectAll` / `outreachGroupSelectAll`（0/1，非必填）+ Changelog；`getAllImDialogue.d.ts` 与 YApi 零 diff，只补「新增消费方」一行
- (desktop) 待改造 `personal-ai-data-scope-dialog.vue`（945 行，唯一消费方 `personal-ai-memory-bar.vue`，无外部回归面），改造时顺带拆分取数与选中集合
- (全端) 抓包待确认 4 项：`getAllImDialogue` 返回顺序是否稳定、组织群的 `groupInfo.type` 实际取值、后端在 `selectAll=1` 时补录新增群的时机、全量数据量级（决定是否需虚拟列表）
- (说明) 本仓库 `apps/android`、`apps/ios`、`apps/desktop` 工作区的既有本地改动属前序功能（`20260728-安卓端@个人AI框` 等），**不属于本功能**

## 关键决策记录

- 2026-07-29 **驱动**：四端行为对齐 + 数据源重构；不做 UI 改版、不加新来源类型
- 2026-07-29 **换数据源**：「最近联系人」改「全部」，统一调 `POST /personalAiFrame/getAllImDialogue`（`selectModel: 0`）一次拉全量人+群；群聊视图复用同一份数据，不再单独调群列表
- 2026-07-29 **列表顺序按后端返回原序**，前端不排序
- 2026-07-29 **搜索改前端**：全局搜人+群，`targetName` 子串、忽略大小写，无网络请求
- 2026-07-29 **已选态以 `dataRangeScopeList` 为准，忽略 `getAllImDialogue` 的 `selected`**（后者来自 `ai_frame_user_setting`，是个人 AI 框列表态）
- 2026-07-29 **三个全选标记为派生值**（选中数 == 分区总数），不独立存；`getAgentDataRange` 回参**不带**这三个字段，靠后端在全选意图下自动补新增群到 `dataRangeScopeList`，故推断法不退化
- 2026-07-29 **群分区判据**：`groupInfo.type >= 10` 为外联群，否则组织群
- 2026-07-29 **头像**：人取 `privateInfo.avatar`；群用 `groupInfo.accountInfoList` 前 4 人头像拼合
- 2026-07-29 **保存**：`dataRangeScopeList` 照传全量明细 + 三个标记，不得空列表覆盖
- 2026-07-29 **落地策略**：desktop 先跑通并抓包 → 沉淀 impl-notes → 其余三端照 notes 移植（不读源端代码）
- 2026-07-29 切换活跃功能：`ACTIVE` 由 `20260728-安卓端@个人AI框` 改为本功能（原功能真机 E2E 未完，见其 status）

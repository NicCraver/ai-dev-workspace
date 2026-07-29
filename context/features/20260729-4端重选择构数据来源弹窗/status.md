# Status：4端重构「选择数据来源」弹窗

> 最后更新：2026-07-29（desktop + web 代码完成过审；**真机手测未做**；android/ios 未开工）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 契约更新 · plan Task 1 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 纯逻辑模型 + 单测 · plan Task 3/7/8/9 | ✅ 18/18 | ⬜ | ⬜ | ✅ 18/18 |
| 弹窗/页改造 · plan Task 2/4/5/7/8/9 | ✅ | ⬜ | ⬜ | ✅ |
| 接口联调（抓包验证）· plan Task 6 | 🚧 待手测 | ⬜ | ⬜ | 🚧 待手测 |
| 自测通过 · plan Task 10 | ⬜ | ⬜ | ⬜ | ⬜ |

> **已完成**：desktop、web。**未开工**：android、ios（走原生页 + 桥，见 impl-notes）。
> web 只改 PC 分支弹窗；移动端 web 走 `selectDataRangeScope` 桥打开 ios/android 原生页，原生两端改完即自动一致。
>
> web 只改 PC 分支弹窗；移动端 web 走 `selectDataRangeScope` 桥打开 ios/android 原生页，原生两端改完即自动一致，web 移动端分支不动。

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
| UI 微调（标题关闭对齐 / 群组等宽子 tab / 表头「全部」） | 未提交 |
| UI 打磨（列表行对齐 AiBoxRow：60 高/圆头像/双行/搜索图标） | 未提交 |

契约提交（context 仓库）：`cf5b9b4`（saveDataRange 三字段）+ 本次 `getAgentDataRange` 三字段 + `67e67bc`（saveDataRange 注释与 getAgentDataRange @unconfirmed 同步）。

## web 提交（分支 `personal-ai-chat`，BASE `a9a6d3e`）

| 内容 | 提交 |
|------|------|
| service `getAllImDialogue` + 纯逻辑模型 + 18 条 node:test | `aef593a2` |
| 弹窗改造（取数 / 本地搜索 / tab「全部」/ emit `{scopes,flags}`） | `90607f2` |
| save 链路全量化 + 三标记三态（conditionMode/Chat/DataScopeBar/FilterBar/ChatInput） | `3ceada40` |
| 整枝审查修复（双 emit 竞态 / SSE 体污染 / 移动端 ACK flags 陈旧） | `7f209c6` |

## 待办 / 阻塞

- (desktop) ⏳ **真机手测未做**，这是 plan Task 6 的主体，也是其余三端移植的前置。手测清单见下。
- (desktop) ⏳ UI 微调待提交：modal 标题/关闭对齐；群组子 tab 等宽满宽；表头「全部」；列表行对齐参考稿（行高 60、圆形拼合头像、agentName 副标题、搜索放大镜）。
- (全端) ❌ **后端待实现**：`getAgentDataRange` 回参补三个全选标记（契约已加并标 `@unconfirmed`）。未实现期间前端按「未知态省略上报」兜底，不会清零后端意图，但也**无法在 restore 后还原全选态**。
- (全端) ⏳ 抓包待确认 4 项：`getAllImDialogue` 返回顺序是否稳定、组织群 `groupInfo.type` 实际取值、后端在 `selectAll=1` 时补录新增群的时机、回参数组量级（是否需虚拟列表）。
- (全端) ⏳ **最脆假设待验证**：`getAllImDialogue` 私聊项的 `targetId` 是否等于组织架构里的 `accountId`。不等则同一人产生两个 key，重复上报 + 返显错位。
- (desktop) 代码审查遗留 Minor（手测时一并看）：`fetchPersonalAiMemorySettings` 触发面被放大（`mounted`/`activated`/切路由/切会话都会拉），若与飞行中的 save 撞上可能出现 UI 回跳；`initRange` 在草稿含 `replyMsgObj` 时提前 return 不走 sync，该路径下筛选条保持隐藏且不拉设置（既有缺陷）。
- (android/ios) **本功能未开工**，走原生页 + `selectDataRangeScope` 桥，等 impl-notes 定稿后移植。web 移动端分支不动（原生页改完自动一致）。
- (web) ⏳ 代码完成过审，**真机手测未做**，清单见下。
- (ios) 工作区未提交改动（筛选条时间弹层右对齐/加宽、个人 `dataRangeList` 透传、save 空列表门闩、类型「类型+N」、联网仅图标）→ 归属 **`20260728-ios端at个人AI框`**，**不推进本功能矩阵**（ios 列保持 ⬜）。

## desktop 手测清单（plan Task 6）

**必须抓包**
- [ ] 打开弹窗只发 `getAgentDataRange` + `getAllImDialogue` 两个请求；切 tab、打字搜索**零请求**
- [ ] 重启客户端 → 不开弹窗直接点「联网」→ `saveDataRange` 请求体里**完全没有**三个 SelectAll key（不是 0、不是 null）
- [ ] 弹窗内让 `getAllImDialogue` 失败 → 点确定 → 同样不带这三个 key；明细 `dataRangeScopeList` 仍为非空全量
- [ ] 会话 A（有明细）→ 切到会话 B（草稿也有 `@个人AI`）→ 立刻点「联网」→ 确认**不发**带空 `dataRangeScopeList` 的 save
- [ ] 故意让 `getAgentDataRange` 失败 → 点「联网」→ 无 save 发出
- [ ] 私聊项 `targetId` 与组织架构 `accountId` 是否同源
- [ ] 勾「全部」确定 → 重开弹窗 → `dataRangeScopeList` 是否与候选清单等长

**交互**
- [ ] 「全部」勾满 → 表头实心勾；去群聊取消一个组织群 → 「全部」与「组织群」同时变半选
- [ ] 搜索关键字 → 勾满所有可见项 → 表头应显**全选**（非半选），再点表头应能全部取消
- [ ] 搜索态点表头全选 → 清空搜索框 → 确定 → 上报的三个标记按**全量**真实勾选
- [ ] 组织架构勾的人与「全部」里的同一人勾选态互通
- [ ] 加载中 / 加载失败时，「全部」与「群聊」两个 tab 都看不到表头全选行
- [ ] 无成员群、无头像成员、缺 `targetName` 的行分别显示默认群头像 / 默认人像 / id 兜底
- [ ] 反复快速切 A/B 会话，筛选条内容与最后停留的会话一致
- [ ] 全量数据量级下的滚动性能（无虚拟列表）

**回归**
- [ ] 群智能体（`@群AI`）主流程：显示 → restore → 改胶囊触发 save → 发送 → 收到回复，确认完全未受本次改动波及

## 关键决策记录

- 2026-07-29 **本轮只做 PC**；其余三端推后
- 2026-07-29 ⚠️ **推翻前案**：三个全选标记改为**由 `getAgentDataRange` 回参携带**（原定「不带，前端自己推断」）。原因：`saveDataRange` 是全量 save，前端推断的值在 restore 后必然回落，用户随手改个联网就会把后端已存意图清零。后端未实现期间前端按**三态**（未知 / 0 / 1）兜底，未知时从载荷**省略这三个 key**
- 2026-07-29 **表头全选与上报标记分离**：搜索态下表头显示与点击按可见列表算，上报的三个标记始终按未过滤全量算，两套独立派生
- 2026-07-29 **restore 门闩**：未成功 restore 前禁止任何 save，防止空 `dataRangeScopeList` 覆盖后端明细；切会话时必须**直接同步**关闸（靠可见性 watcher 不可靠——同批次内先 false 再 true，值没变，回调不执行）
- 2026-07-29 **驱动**：四端行为对齐 + 数据源重构；不做 UI 改版、不加新来源类型
- 2026-07-29 **换数据源**：「最近联系人」改「全部」，统一调 `getAllImDialogue`（`selectModel: 0`）一次拉全量人+群；群聊视图复用同一份数据
- 2026-07-29 **列表顺序按后端返回原序**，前端不排序
- 2026-07-29 **搜索改前端**：全局搜人+群，`targetName` 子串、忽略大小写，无网络请求
- 2026-07-29 **已选态以 `dataRangeScopeList` 为准，忽略 `getAllImDialogue` 的 `selected`**
- 2026-07-29 **群分区判据**：`groupInfo.type >= 10` 为外联群，否则组织群
- 2026-07-29 **头像**：人取 `privateInfo.avatar`；群用 `groupInfo.accountInfoList` 前 4 人拼合；均需默认头像兜底
- 2026-07-29 **保存**：`dataRangeScopeList` 照传全量明细，不得空列表覆盖
- 2026-07-29 **落地策略**：desktop 先跑通并抓包 → 沉淀 impl-notes → 其余三端照 notes 移植
- 2026-07-29 切换活跃功能：`ACTIVE` 由 `20260728-安卓端@个人AI框` 改为本功能（原功能真机 E2E 未完，见其 status）
- 2026-07-29 收尾确认：`apps/ios` 脏树属前序 `@个人AI框` 联调修补，本功能 ios 矩阵保持 ⬜

## web 手测清单

**必须抓包**
- [ ] PC 弹窗选人/群点确定 → 立刻切时间触发 save，抓 `saveDataRange` 体：`dataRangeScopeList` 与三 `selectAllFlags` 都是新值（验证双 emit 竞态已修）
- [ ] 抓 SSE 请求体（普通发送 + 重新生成各一次）：确认**不含** `selectAllFlags`；其余字段（dataRangeList/dataRangeScopeList/netSearch/deepThink/attachmentList/timeType）齐全
- [ ] PC 设全选 → 切移动端原生改数据范围（新协议 ACK）→ 回 PC 切时间触发 save：三 `selectAllFlags` key **物理不存在**
- [ ] 同上走老 iOS（legacy 数组）路径：三 key 同样省略
- [ ] 打开弹窗只发 `getAgentDataRange` + `getAllImDialogue` 两个请求；切 tab、搜索**零请求**

**交互**
- [ ] 弹窗「全部」勾满 → 表头实心勾；去群组取消一个组织群 → 「全部」与组织群表头同时变半选
- [ ] 搜索关键字 → 勾满可见项 → 表头显**全选**（非半选），点表头能全部取消
- [ ] 搜索态点表头全选 → 清空搜索 → 确定 → 上报三标记按**全量**真实勾选
- [ ] 组织架构勾的人与「全部」同一人勾选态互通（OrgPicker 旧 key `"private:id"` 与候选新 key `"1_id"` 经 `selectedKeysForOrg` 互通）
- [ ] 候选清单加载中/失败时表头全选行不显示；失败时确定回传 `flags: null`，save 不带三 key
- [ ] 设置页（`SkillEditFormBody` persist=false）数据范围弹窗正常工作、不写 agent 记忆

**回归**
- [ ] 群智能体（`@群AI`）主流程不受影响：`saveAgentMemory` 不带 `dataRangeScopeList`（群路径）的行为未变
- [ ] 定时任务（persist=false）数据范围弹窗正常

## 关键决策补充（web）

- 2026-07-29 **web save 双路径全量化**：web 两条分散 save（`DataScopeBar.onSubmit` 改数据范围 / `Chat.saveAgentMemory` 改时间·联网·深思）都打同一 endpoint；按用户决定都改全量 + 三态。`changeConditionMode` 的 snapshot 不含 `dataRangeScopeList`/`selectAllFlags`，故改数据范围只走 DataScopeBar 自 save，两路径不重叠
- 2026-07-29 **web 三态链路**：弹窗 `flags:null`（取数失败/加载中）→ DataScopeBar（兼容数组/对象入参）→ `emit('update-flags')` → ChatInput → conditionMode.selectAllFlags=null → 两条 save 的 `if(flags)` 守卫使三 key 物理省略
- 2026-07-29 **web 双 emit 竞态坑**（整枝审查发现）：DataScopeBar 同步连发 `update`+`update-flags`，Vue 3 事件回调内 props 不刷新，若 `updateSelectAllFlags` 用 `{...props.conditionMode}` 会用旧 `dataRangeScopeList` 覆盖新值。修法：只传增量字段（changeConditionMode 内部浅合并）
- 2026-07-29 **SSE 体污染坑**：`...conditionMode.value` 会把 `selectAllFlags` 带进 AI 请求体，拼 SSE 入参时须解构剥离
- 2026-07-29 **移动端 ACK flags 陈旧坑**：`applyNativeAckResult` 须 `emit('update-flags', null)`，否则 PC 缓存的陈旧 flags 会在切回 PC 改时间时覆盖原生刚存的值
- 2026-07-29 web 端 key 格式沿用 model 的 `"<scopeDataType>_<scopeDataId>"`（如 `1_u1`），不学 desktop 旧式；OrgPicker 内部旧 key `"private:id"` 经 `selectedKeysForOrg` computed 适配，不改 OrgPicker

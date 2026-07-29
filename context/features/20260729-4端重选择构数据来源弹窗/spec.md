# Spec：4端重构「选择数据来源」弹窗

> 由 Superpowers brainstorm 产出。最后更新：2026-07-29

## 背景与目标

个人 AI 框筛选条上的 DataScope 胶囊（「数据+N」）点开后是「选择数据范围」弹窗。当前四端各自一套实现，取数来源也各不相同：

| 端 | 现状 |
|----|------|
| desktop | `personal-ai-data-scope-dialog.vue`（945 行）：tab = 最近联系人 / 群组 / 组织架构 + 搜索；数据源复用转发弹窗那套（`GetConversationSort.all` + `groupListApi` + `getAccountSearchByUserName` / `getGroupBySearch` + `getDeptUserPagelist`） |
| web | PC 分支 `SelectDataRangeDialog`（三 tab + OrgPicker）；移动端分支不渲染弹窗，走 `selectDataRangeScope` 桥调原生 |
| android | `SelectDataRangeActivity` 独立多选页 |
| ios | 复用「选择 AI 框」页改造的多选页 |

**本期目标**：

1. **换数据源**——「最近联系人」改为「全部」，统一调新接口 `POST /personalAiFrame/getAllImDialogue` 一次拉全量人 + 群；群聊视图复用同一份数据，不再单独调群列表接口。
2. **搜索改前端**——弹窗内搜索在内存全量数据上本地过滤，不再调后端搜索接口。
3. **四端行为对齐**——列表顺序、分组规则、全选语义、保存载荷四端一致。
4. **支持三段全选记忆**——`saveDataRange` 新增 `groupAndAccountSelectAll` / `organizationGroupSelectAll` / `outreachGroupSelectAll`，让后端在用户勾了「全选」后自动把新增的群补进数据范围。

**成功标准**：四端打开弹窗均由 `getAllImDialogue` 一次取数；搜索无网络请求；勾满某分区后表头显全选、去别的视图移除一项后立刻退回半选；确定后 `saveDataRange` 载荷含全量明细 + 三个全选标记；下次打开返显一致。

## 用户流程

1. 用户在群聊 `@` 自己的个人 AI → 出现个人 AI 筛选条 → 点「数据+N」胶囊。
2. 弹窗打开：
   - 调 `getAgentDataRange`（入参优先 `agentId` + `accountId`）拿 `dataRangeScopeList` 作为已选态；
   - 调 `getAllImDialogue`（`{ accountId, selectModel: 0 }`）拿全量会话作为候选清单，存内存。
3. 用户在「全部 / 群组 / 组织架构」三个顶层视图间切换勾选；「群组」tab 内再以子 tab 切换「组织群 / 外联群」两个分区。或在顶栏搜索 popover 本地搜人/群后勾选（主列表不随关键字过滤）。所有视图共享同一个选中集合，实时互通。
4. 点「确定」：把选中集合序列化为 `dataRangeScopeList`，连同三个派生的全选标记调 `saveDataRange`。
5. 保存成功 → 弹窗关闭 → 筛选条重新 `getAgentDataRange` 刷新胶囊数字。
6. 移动端 web 的这条链路由原生页承担（见「各端差异点」）。

**关键分支**：

- 全选后后端自动扩容：用户勾了「全部」→ 传 `groupAndAccountSelectAll: 1` → 之后新建了群 → 后端在服务端把新群补进 `dataRangeScopeList` → 用户下次打开，全部仍是全选态（因为 get 回来的明细已包含新群，前端推断法自然成立）。
- 局部取消：全选态下去「群聊」视图取消某个群 → 该群移出集合 → 「全部」与对应的组织群/外联群表头由全选变半选 → 保存时对应标记传 0。

## 范围

**本期做**：

- 四端弹窗/页取数改为 `getAllImDialogue` 一次拉全量 + 弹窗内存缓存
- 「最近联系人」改名并改语义为「全部」（人 + 群混排，按后端返回顺序）
- 「群组」tab 内嵌子 tab「组织群 / 外联群」（参考转发弹窗的 tab 结构，子 tab 不占顶层），每个子 tab 内「全选行 + 列表」
- 弹窗内搜索改为顶栏 popover + 前端本地子串过滤（对齐「选择发送目标」；主列表不随关键字过滤）
- 三个全选标记的派生计算与保存
- 头像规则统一：人取 `privateInfo.avatar`；群用 `groupInfo.accountInfoList` 前 4 人头像拼合
- desktop 侧顺带拆分 945 行的 dialog（取数与选中集合抽出，列表项独立），为三端移植提供可读的结构

**本期不做**：

- 不改「组织架构 / 选择联系人」入口的数据来源（仍走各端现有组织接口）
- 不改筛选条本身（知识类型、时间、联网、深思胶囊均不动）
- 不改 `selectDataRangeScope` 桥协议（入参与 ACK 形态保持现状）
- 不加新的数据来源类型（知识库、文件等）
- 不做分页（接口一次给全量）
- 不做拼音/首字母搜索

## 各端差异点

默认四端行为一致。必须不一致的：

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 入口形态 | PC 弹窗；移动端不渲染弹窗，走 `selectDataRangeScope` 桥 | 全屏 Activity | 全屏页 | 弹窗 |
| 导航结构 | 横向顶层 tab：全部 / 群组 / 组织架构 + 搜索框；「群组」内嵌子 tab「组织群 / 外联群」 | 纵向：顶部「选择联系人」「群聊」入口，下方「全部」+ 列表 | 同 android | 同 web PC |
| 组织架构取数 | 现有 OrgPicker | 现有组织页 | 现有组织页 | `getDeptUserPagelist` |
| 是否需改移动端逻辑 | **否**（原生页改完即生效） | 是 | 是 | — |

> 移动端 web 的「数据范围」胶囊通过 `selectDataRangeScope` 打开的就是 ios/android 的原生页，原生页自己 `getAgentDataRange` 返显 + `saveDataRange` 落库、只回 `{ok:true}` ACK，web 收到后再 get 刷新。因此原生两端改完，移动端 web 自动与之一致，web 仓库只需改 PC 分支弹窗。详见 `context/bridge.md`。

## 数据与状态模型（四端统一）

**取数**：开弹窗调一次 `getAllImDialogue`，入参 `{ accountId, selectModel: 0 }`（0 = 个人 AI 框选会话模式）。回参数组存内存，弹窗生命周期内不重拉。

**三个视图共享同一份数据**：

| 视图 | 数据来源 |
|------|----------|
| 全部 | 全量数组，**按后端返回顺序**渲染（前端不排序） |
| 群聊 · 组织群 | `type === 3` 且 `groupInfo.type` 缺省或 `< 10` |
| 群聊 · 外联群 | `type === 3` 且 `groupInfo.type >= 10` |
| 组织架构 | 各端现有组织接口，不变 |

**选中集合是单一真源**：`Set<key>`，`key = "<scopeDataType>_<scopeDataId>"`（私聊 1、群聊 3）。

- 初值来自 `getAgentDataRange` 的 `dataRangeScopeList`；
- **忽略 `getAllImDialogue` 回参里的 `selected` 字段**——它来自 `ai_frame_user_setting`，是个人 AI 框**列表**的选中态，与 DataScope 无关；
- 组织架构里勾选的人写入同一个 Set，三处视图勾选实时互通。

**三个全选态为派生值，不独立存储**：

```
groupAndAccountSelectAll   = 选中数 === 全量数
organizationGroupSelectAll = 组织群全部在 Set 中
outreachGroupSelectAll     = 外联群全部在 Set 中
```

派生保证联动：「全部」勾满后去群聊视图移除一项，回到「全部」立刻由全选变半选。某分区为空时按未全选（0）处理。

**头像**：人 → `privateInfo.avatar`；群 → `groupInfo.accountInfoList` 前 4 人 `avatar` 拼合（各端用自己的九宫格拼图能力）。

**搜索（UI 对齐「选择发送目标」）**：顶栏为 **popover 搜索**（非主列表原地过滤）。候选始终为 `getAllImDialogue` 全量（人+群），与当前顶层 tab 无关；popover 内有「全部 / 群组 / 人员」子 tab。对会话名 + 智能体名做忽略大小写子串匹配，**零网络请求**。popover 勾选写入同一 Set，主列表只更新勾选态、**不随关键字过滤**；表头「全部」始终按当前 tab 未过滤全量算。

## 保存载荷

点「确定」时把选中集合序列化为全量明细，**不得传空列表覆盖**：

```jsonc
{
  "accountId": "...",
  "agentId": "...",
  "dataRangeList": [ /* 知识类型，原样透传，不在本弹窗内改 */ ],
  "timeType": 0, "netSearch": 0, "deepThink": 0,   // 原样透传
  "dataRangeScopeList": [ { "scopeDataType": 1, "scopeDataId": "..." } ],
  "groupAndAccountSelectAll": 0,
  "organizationGroupSelectAll": 0,
  "outreachGroupSelectAll": 0
}
```

三个标记只表达「用户勾了全选」这个意图，供后端在新增群时自动补进 `dataRangeScopeList`；前端下次 get 拿到的是补齐后的列表，因此推断法不会退化成半选。

## 依赖的接口

| 契约文件 | 用途 | 本期变更 |
|----------|------|----------|
| `contracts/personalAiFrame/getAllImDialogue.d.ts` | 弹窗候选清单（全量人 + 群） | 与 YApi（2026-07-28）**零 diff**，只需在 Changelog 补记「新增消费方：选择数据来源弹窗」 |
| `contracts/personalAiFrame/saveDataRange.d.ts` | 确定时落库 | **需补三个字段**：`groupAndAccountSelectAll` / `organizationGroupSelectAll` / `outreachGroupSelectAll`（integer，0/1，非必填），并记 Changelog |
| `contracts/personalAiFrame/getAgentDataRange.d.ts` | 打开时返显已选 | 不变（回参**不带**三个全选字段，前端自行推断） |

## 落地顺序

1. 契约先行：补 `saveDataRange` 三字段 + 两处 Changelog。
2. **desktop 先跑通**：改造 `personal-ai-data-scope-dialog.vue`（含拆分），抓包验证接口实际行为（返回顺序、`groupInfo.type` 取值、全选标记后端是否按预期扩容）。
3. 沉淀 `impl-notes.md`（平台无关的逻辑提炼 + 联调坑）。
4. web / ios / android 照 impl-notes 复制，不读 desktop 源码移植。

## 待用户确认的问题

- [ ] `getAllImDialogue` 回参的返回顺序是否稳定（是否已按 `activeTime` 倒序）——抓包确认；若不稳定需与后端约定
- [ ] `groupInfo.type` 在现网组织群上的实际取值（契约只写了 `>=10` 为外联群，未写组织群取值范围）
- [ ] 后端在 `groupAndAccountSelectAll = 1` 时对新增群的自动补录时机（实时 or 下次 get 时计算）
- [ ] 全量数据量级（影响是否需要虚拟列表——本期按不需要设计）

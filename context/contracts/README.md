# contracts/ —— 接口契约（唯一事实来源）

## 目录组织

- **每个业务域一个文件夹**：`contracts/<域>/`（如 `personalAiFrame/`）。
- **每个接口单独一个文件**：`contracts/<域>/<接口>.d.ts`（一个接口一文件，**不要把多个接口挤在一个文件里**）。文件名用接口动作名，如 `list.d.ts`、`recentContactList.d.ts`。
- **每个接口文件头维护自己的 Changelog**（只记该接口的变更）。
- **域内多接口共享的类型** → `contracts/<域>/_shared.d.ts`（当前若无共享类型可省略）。
- **跨域通用约定**（外层包裹 `ApiResponse`、错误码、时间格式、分页结构）→ 根级 `_common.d.ts`，各接口文件 `import type { ... } from '../_common'`，不要重复定义。

```
contracts/
├─ _common.d.ts            # 跨域通用（ApiResponse / 错误码 …）
├─ personalAiFrame/        # 个人AI框相关接口（含跨路径子域）
│  ├─ _shared.d.ts              # 域内共享类型
│  ├─ list.d.ts                 # POST /personalAiFrame/list
│  ├─ getFilter.d.ts            # POST /personalAiFrame/getFilter
│  ├─ batchGetAgent.d.ts        # POST /personalAiFrame/batchGetAgent（公共接口）
│  ├─ saveSelected.d.ts         # POST /personalAiFrame/saveSelected
│  ├─ selectGroupBySearch.d.ts  # POST /personalAiFrame/selectGroupBySearch
│  ├─ recentContactList.d.ts    # POST /personalAiFrame/recentContactList
│  ├─ updateSetting.d.ts        # POST /personalAiFrame/updateSetting
│  ├─ quickReplyList.d.ts       # POST /quickReply/list
│  ├─ quickReplySave.d.ts       # POST /quickReply/save
│  ├─ quickReplyDelete.d.ts     # POST /quickReply/delete
│  ├─ getLastSessionMessage.d.ts # POST /sessionMsg/getLastSessionMessage
│  ├─ saveDataRange.d.ts        # POST /agentSetDataRangeExpand/saveDataRange
│  ├─ getAgentDataRange.d.ts    # POST /agentSetDataRangeExpand/getAgentDataRange
│  ├─ shareFileData.d.ts        # POST /agentFileShare/shareFileData
│  ├─ shareFileDataList.d.ts    # POST /agentFileShare/shareFileDataList
│  └─ saveAgentSetInfo.d.ts     # POST /agentSetBasic/saveAgentSetInfo
└─ README.md
```

> 组织规则只约束**新增契约**；既有契约在下次改动它时顺手迁到该结构，不为合规专门搬迁。

## 使用规则

1. mock 先行阶段：四端的 mock 数据必须能通过这里的类型检查（web 直接引用类型；android/ios 按字段一一对应）。
2. 接口到位/变更：**先改契约、记 Changelog，再改代码**（用 /sync-contract 走流程）。
3. 联调发现实际行为与契约不符：以实际为准更新契约，并在活跃功能 impl-notes.md 的「联调坑」补一条。

## 写法约定

- 用 TypeScript 类型 + **中文注释**描述每个字段的语义。
- 字段注释里标 mock 值，格式 `mock: <值>`（如 `mock: '280'`、`mock: 0`）。
- 后端**未确认**的字段/行为，用 `@unconfirmed` 注明，联调确认后去除。
- 时间/枚举等取值范围写清楚（如「格式 yyyy-MM-dd HH:mm:ss」「0-全部；1-…」）。

现成范例见 `personalAiFrame/list.d.ts`。

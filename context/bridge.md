# JSBridge 协议（WebView ↔ 原生）

> 三端（Android / iOS / Electron）内嵌 web 的通信契约。任何一端改协议必须先改本文件。
> 最后更新：2026-07-15

## 通信机制

内嵌 web（`apps/web`）经 `window.webview.*`（PC，desktop 壳实现）或 `wnsdk.aiChat.*`（移动端，android/ios 实现）向原生取数。本期仅 desktop 落地，移动端仅命名预留。

| 端 | web → 原生 | 原生 → web |
|----|-----------|-----------|
| desktop（微应用 webview） | 内嵌 web 调 `window.webview.<method>(params)` → preload 生成 `uuid`，`ipcRenderer.sendToHost(<channel>, params, uuid)` | 宿主 `webview-control` `@ipc-message` → `aiBoxPickerHost` 取数 → `webview.send("trigger-result", …)` → preload 按 `uuid` resolve |
| desktop（AiBrowser iframe） | iframe 内 `window.parent.postMessage({ type:"personal-ai:bridge-request", channel, params, uuid })` | **AiBrowser** `handlePersonalAiMessage` → `aiBoxPickerHost` 取数 → `event.source.postMessage({ type:"personal-ai:bridge-result", channel, uuid, data:{code,data} })` |
| desktop（AiBrowser iframe，打开 IM） | iframe 内 `window.parent.postMessage({ type:"personal-ai:open-chat", payload:{ id, type, name?, avatar? } })`（fire-and-forget） | **AiBrowser**（主窗口内）直接 `openConversationById`；列表无会话时用 `name`/`avatar` `PushDialogue` 重建；**不**调 `resume-main-win-size` |
| android | `wnsdk.aiChat.<method>(params)` | 回调 `success(result)` / `error`（选择 AI 框见下表） |
| ios | `wnsdk.aiChat.selectAiAgent` 等 | 回调 `success(result)`：`result` 为 `ZXJSWebResponseModel.result` 解包值 |

> 新增方法需同时在 preload 的 `trigger-result` `switch(type)` 增对应 `case`（或复用 `default` 分支：`code!==0` 即 resolve），并在宿主 `main.vue` 增 `<channel>` 监听处理。

## 消息格式

```jsonc
// 响应（原生 → web，经 trigger-result 或 personal-ai:bridge-result）
{ "type": "<channel>|personal-ai:bridge-result", "uuid": "<uuid>", "data": { "code": 1, "data": <结果>, "msg": "" } }
// code: 1=成功(resolve data.data) / 0=失败(reject)

// AiBrowser iframe 请求（web → AiBrowser）
{ "type": "personal-ai:bridge-request", "channel": "get-recent-contacts", "params": {}, "uuid": "<uuid>" }
// AiBrowser iframe 响应（AiBrowser → web，channel/uuid 与请求一致）
{ "type": "personal-ai:bridge-result", "channel": "get-recent-contacts", "uuid": "<uuid>", "data": { "code": 1, "data": <结果> } }

// AiBrowser iframe 打开 IM（web → AiBrowser，无响应）
{ "type": "personal-ai:open-chat", "payload": { "id": "<belongId>", "type": "group" | "chat", "name"?: "<显示名>", "avatar"?: "", "corpId"?: "", "groupType"?: 0 } }
// type: "group"=群聊 / 其它（如 "chat"）=私聊；宿主 openConversationById：列表有则选中，无则用 name/avatar 重建会话再打开
```

## 方法清单

> 完整方法集见 `apps/desktop/static/plugin/webview.js`；本表记录各功能用到的契约面，新增/变更须在此登记并写 Changelog。

| method | channel | 方向 | params | 返回（resolve 值） | 支持端 | 状态 |
|--------|---------|------|--------|------------------|--------|------|
| `getRecentContacts` | `get-recent-contacts` | web→原生 | — | `[{accountId/id, name, agentName, avatar, ownerType:'group'\|'private', groupType?, lastChatAt:number, hasMessage?:boolean, messageTime?:number, accountInfoList?:[{id,nickName,avatar}]}]`（群项含 `accountInfoList` 供 2×2 头像；`hasMessage`/`messageTime` 供 web 排序） | desktop | 已有，选择AI框联调中 |
| `getMyGroups` | `get-my-groups` | web→原生 | `{type:'organization'\|'outsource', pageNum?:number, pageSize?:number}` | `[{id, name, agentName, avatar, memberCount, groupType:0\|10, lastChatAt}]` | desktop | 新增（选择AI框） |
| `getOrgCompanies` | `get-org-companies` | web→原生 | `{type:'organization'\|'outsource'}` | `[{id, corpId, name, memberCount, corpType, rootDeptId?, corpAndCorpRelType?, labelType?, category?}]`（宿主 `getContactTree({isGroup:1})` 对齐 PC 转发；`corpId`=`id`；进公司后 `getDeptUsers` 用 `rootDeptId`+附加字段） | desktop | 新增（选择AI框） |
| `getDeptUsers` | `get-dept-users` | web→原生 | `{corpId, pid, corpType?, corpAndCorpRelType?, labelType?}`（对齐 PC `company-dept-user.getUsers`；进公司首屏 `pid=rootDeptId\|\|id`，勿裸传 `'0'`） | `{depts:[{id,name,memberCount,pid}], users:[{accountId,name,agentName,avatar}]}` | desktop | 新增（选择AI框） |
| `searchAiBoxPicker` | `search-ai-box-picker` | web→原生 | `{search:string}` | `{users:[{accountId,name,agentName,avatar,ownerType:'private',lastChatAt}], groups:[{id,name,agentName,avatar,accountInfoList?,ownerType:'group',groupType?,lastChatAt}]}` | desktop | 新增（选择AI框搜索） |
| `openChat` | `openChat` | web→原生 | `{ id:string, type:'group'\|'chat', name?:string, avatar?:string, corpId?:string, groupType?:number }`（`id`=belongId；`type`='group' 群 / 其它私聊；`name`/`avatar` 供列表无会话时重建） | 无（fire-and-forget）；主窗口 `openConversationById`（缺失则 PushDialogue 重建）选中左侧会话 | desktop | 已有（个人 AI 列表「打开私聊/群聊」） |
| `selectAiAgent` | —（wnsdk `aiChat.selectAiAgent`） | web→原生 | — | 见下「selectAiAgent 回传」 | ios / android | ios 已落地；android 已落地（真机 E2E 通过） |
| `selectDataRangeScope` | —（wnsdk `aiChat.selectDataRangeScope`） | web→原生 | `{ initialScopes?:[{scopeDataType:1\|3, scopeDataId:string}] }` | 见下「selectDataRangeScope 回传」 | ios / android | ios 落地中；android 落地中 |

### `selectAiAgent` 回传（ios → web）

`wnsdk.aiChat.selectAiAgent` 成功时 `success` 收到（已解包 `response.result`）：

```jsonc
{
  "type": "personal-ai:selected-agent",
  "payload": {
    "id": "<ownerId>",              // 与 PC 弹窗 selection.id 对齐
    "name": "<显示名>",
    "ownerType": "group" | "private",
    "ownerId": "<groupId|accountId>", // saveSelected.belongId
    "ownerName": "<显示名>",
    "agentName": "<AI框名，暂等同显示名>",
    "avatar": "",
    "lastChatAt": 0,                // 毫秒；缺省 0 → 不按 24h 恢复
    "agentId": "<真实智能体id>"       // 可选；无真实 id 时省略（勿传 group:name 合成值）
  }
}
```

取消：`code=-1`。web 收到后走 `saveSelected` → `list(exemptAgentIds)`（编排与 PC 弹窗共用）。

### `selectDataRangeScope` 回传（ios → web）

Home「数据范围」胶囊（移动端）调 `wnsdk.aiChat.selectDataRangeScope`。原生复用选择 AI 框页形态，**强制多选**；最近聊天 / 选择已有群组支持「全部」；底栏展示已选。成功时 `success` 收到（已解包 `response.result`）：

```jsonc
{
  "type": "personal-ai:selected-data-range",
  "payload": {
    "scopes": [
      {
        "scopeDataType": 1,          // 1=私聊(人)；3=群聊
        "scopeDataId": "<accountId|groupId>",
        "name": "<显示名>",          // 可选，展示用
        "avatar": ""                 // 可选
      }
    ]
  }
}
```

取消：`code=-1`。web 收到后写 `conditionMode.dataRangeScopeList` → `saveDataRange`（与 PC `SelectDataRangeDialog` 同源；原生不调接口）。

**统一字段约定**（与 `apps/web/src/components/views/home/personalAiAgentAdapter.js` 对齐）：
- 人员主键 `accountId`、群主键 `id`、AI 框名 `agentName`、最近对话时间 `lastChatAt`（毫秒时间戳）
- `ownerType` ∈ `group`（群） / `private`（私聊）
- `groupType`：`0`=组织群 / `10`=外联群（沿用 desktop 转发窗，见 `context/platforms/desktop-forward-dialog.md`）

## 版本与兼容

- 老 desktop 壳无 `getMyGroups`/`getOrgCompanies`/`getDeptUsers`/`searchAiBoxPicker` 时，web 端 `useAiBoxPickerData` 捕获异常 → 弹窗提示「请升级到最新版本」。
- `getRecentContacts` 缺 `agentName`/`lastChatAt`：视为宿主 bug，联调时由 desktop 侧补齐（见选择AI框 spec「待联调确认 1」）。
- 移动端（`wnsdk.aiChat.*`）取数类接口（最近联系人/群组/组织）本期不实现；**`selectAiAgent` ios/android 均已落地**（android 见上表；原生只回传选中项，saveSelected/list 在 web H5）。

## Changelog

- 2026-07-17 ios/android 数据范围搜索子页：底栏与主页同形态；子页无「取消」、主按钮「完成」；仅完成写回主页（返回不 live sync）；已选名须本地补齐。
- 2026-07-17 android `selectDataRangeScope`：镜像 selectAiAgent 桥通路（requestCode 239）+ 独立多选页；底栏已选仅人/群名与头像；最近/群「全部」；web 移动端已接线。
- 2026-07-17 登记 ios `selectDataRangeScope`：入参 `initialScopes`；回传 `personal-ai:selected-data-range` + `scopes[{scopeDataType,scopeDataId,name?,avatar?}]`；复用选择 AI 框页多选 + 最近/群「全部」；web 移动端 `DataScopeBar` 走原生，PC 仍 H5 弹窗。
- 2026-07-16 android `selectAiAgent` 落地并**真机 E2E 通过**：`aiChat.selectAiAgent` → 独立原生选择页（最近/选择联系人/选择已有群组/搜索 四路单选）→ 回传 `personal-ai:selected-agent`（无真实 agentId 省略；取消 code=-1），与 ios 回传契约一致。
- 2026-07-15 登记 `openChat`（微应用 `window.webview.openChat`）与个人 AI 列表「打开私聊/群聊」；AiBrowser iframe 通路 `personal-ai:open-chat` → 主窗口直接 `openConversationById`（缺会话则 PushDialogue 重建）；payload 透传 `name`/`avatar`。
- 2026-07-15 `getOrgCompanies` 对齐 PC 转发：`getContactTree({isGroup:1})`，回参补 `id`/`rootDeptId`/`corpAndCorpRelType`/`labelType`；`getDeptUsers` 入参对齐 `company-dept-user`（透传 corpType 等；进公司首屏 pid=`rootDeptId||id`，勿裸传 `'0'`）。
- 2026-07-14 登记 ios `selectAiAgent` 回传契约：`personal-ai:selected-agent` payload（`ownerId`/`id`/`lastChatAt`；无真实 `agentId` 时省略）；web 收后走 saveSelected→list。
- 2026-07-08 新增 `searchAiBoxPicker`（`search-ai-box-picker`）：搜索联系人/群，宿主并行 `getAccountSearchByUserName` + `getGroupBySearch`。
- 2026-07-08 AiBrowser 个人 AI 改回 **iframe + postMessage**（`personal-ai:bridge-request/result`）；微应用仍走 webview preload。
- 2026-07-08 `getRecentContacts` 补 `accountInfoList`（群 2×2 头像）、`hasMessage`/`messageTime`（web 端排序）。
- 2026-07-07 新增 `getMyGroups`/`getOrgCompanies`/`getDeptUsers`；`getRecentContacts` 补 `agentName`/`lastChatAt`（选择AI框功能）。
- 2026-07-07 初始化：补全真实通信机制（preload `registerCallback`+`sendToHost`/`trigger-result`）与消息格式。
# JSBridge 协议（WebView ↔ 原生）

> 三端（Android / iOS / Electron）内嵌 web 的通信契约。任何一端改协议必须先改本文件。
> 最后更新：2026-07-14

## 通信机制

内嵌 web（`apps/web`）经 `window.webview.*`（PC，desktop 壳实现）或 `wnsdk.aiChat.*`（移动端，android/ios 实现）向原生取数。本期仅 desktop 落地，移动端仅命名预留。

| 端 | web → 原生 | 原生 → web |
|----|-----------|-----------|
| desktop（微应用 webview） | 内嵌 web 调 `window.webview.<method>(params)` → preload 生成 `uuid`，`ipcRenderer.sendToHost(<channel>, params, uuid)` | 宿主 `webview-control` `@ipc-message` → `aiBoxPickerHost` 取数 → `webview.send("trigger-result", …)` → preload 按 `uuid` resolve |
| desktop（AiBrowser iframe） | iframe 内 `window.parent.postMessage({ type:"personal-ai:bridge-request", channel, params, uuid })` | **AiBrowser** `handlePersonalAiMessage` → `aiBoxPickerHost` 取数 → `event.source.postMessage({ type:"personal-ai:bridge-result", channel, uuid, data:{code,data} })` |
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
```

## 方法清单

> 完整方法集见 `apps/desktop/static/plugin/webview.js`；本表记录各功能用到的契约面，新增/变更须在此登记并写 Changelog。

| method | channel | 方向 | params | 返回（resolve 值） | 支持端 | 状态 |
|--------|---------|------|--------|------------------|--------|------|
| `getRecentContacts` | `get-recent-contacts` | web→原生 | — | `[{accountId/id, name, agentName, avatar, ownerType:'group'\|'private', groupType?, lastChatAt:number, hasMessage?:boolean, messageTime?:number, accountInfoList?:[{id,nickName,avatar}]}]`（群项含 `accountInfoList` 供 2×2 头像；`hasMessage`/`messageTime` 供 web 排序） | desktop | 已有，选择AI框联调中 |
| `getMyGroups` | `get-my-groups` | web→原生 | `{type:'organization'\|'outsource', pageNum?:number, pageSize?:number}` | `[{id, name, agentName, avatar, memberCount, groupType:0\|10, lastChatAt}]` | desktop | 新增（选择AI框） |
| `getOrgCompanies` | `get-org-companies` | web→原生 | `{type:'organization'\|'outsource'}` | `[{corpId, name, memberCount, corpType}]`（organization 含「入职企业」「我的下级」分组字段） | desktop | 新增（选择AI框） |
| `getDeptUsers` | `get-dept-users` | web→原生 | `{corpId:string, pid:string}`（`pid:'0'` 表公司根部门） | `{depts:[{id,name,memberCount,pid}], users:[{accountId,name,agentName,avatar}]}` | desktop | 新增（选择AI框） |
| `searchAiBoxPicker` | `search-ai-box-picker` | web→原生 | `{search:string}` | `{users:[{accountId,name,agentName,avatar,ownerType:'private',lastChatAt}], groups:[{id,name,agentName,avatar,accountInfoList?,ownerType:'group',groupType?,lastChatAt}]}` | desktop | 新增（选择AI框搜索） |
| `selectAiAgent` | —（wnsdk `aiChat.selectAiAgent`） | web→原生 | — | 见下「selectAiAgent 回传」 | ios | 已落地；android 待移植 |

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

**统一字段约定**（与 `apps/web/src/components/views/home/personalAiAgentAdapter.js` 对齐）：
- 人员主键 `accountId`、群主键 `id`、AI 框名 `agentName`、最近对话时间 `lastChatAt`（毫秒时间戳）
- `ownerType` ∈ `group`（群） / `private`（私聊）
- `groupType`：`0`=组织群 / `10`=外联群（沿用 desktop 转发窗，见 `context/platforms/desktop-forward-dialog.md`）

## 版本与兼容

- 老 desktop 壳无 `getMyGroups`/`getOrgCompanies`/`getDeptUsers`/`searchAiBoxPicker` 时，web 端 `useAiBoxPickerData` 捕获异常 → 弹窗提示「请升级到最新版本」。
- `getRecentContacts` 缺 `agentName`/`lastChatAt`：视为宿主 bug，联调时由 desktop 侧补齐（见选择AI框 spec「待联调确认 1」）。
- 移动端（`wnsdk.aiChat.*`）取数类接口（最近联系人/群组/组织）本期不实现；**`selectAiAgent` ios 已落地**（见上表）。

## Changelog

- 2026-07-14 登记 ios `selectAiAgent` 回传契约：`personal-ai:selected-agent` payload（`ownerId`/`id`/`lastChatAt`；无真实 `agentId` 时省略）；web 收后走 saveSelected→list。
- 2026-07-08 新增 `searchAiBoxPicker`（`search-ai-box-picker`）：搜索联系人/群，宿主并行 `getAccountSearchByUserName` + `getGroupBySearch`。
- 2026-07-08 AiBrowser 个人 AI 改回 **iframe + postMessage**（`personal-ai:bridge-request/result`）；微应用仍走 webview preload。
- 2026-07-08 `getRecentContacts` 补 `accountInfoList`（群 2×2 头像）、`hasMessage`/`messageTime`（web 端排序）。
- 2026-07-07 新增 `getMyGroups`/`getOrgCompanies`/`getDeptUsers`；`getRecentContacts` 补 `agentName`/`lastChatAt`（选择AI框功能）。
- 2026-07-07 初始化：补全真实通信机制（preload `registerCallback`+`sendToHost`/`trigger-result`）与消息格式。
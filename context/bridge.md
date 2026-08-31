# JSBridge 协议（WebView ↔ 原生）

> 三端（Android / iOS / Electron）内嵌 web 的通信契约。任何一端改协议必须先改本文件。
> 最后更新：2026-08-05

## 通信机制

内嵌 web（`apps/web`）经 `window.webview.*`（PC，desktop 壳实现）或 `wnsdk.aiChat.*`（移动端，android/ios 实现）向原生取数。本期仅 desktop 落地，移动端仅命名预留。

| 端 | web → 原生 | 原生 → web |
|----|-----------|-----------|
| desktop（微应用 webview） | 内嵌 web 调 `window.webview.<method>(params)` → preload 生成 `uuid`，`ipcRenderer.sendToHost(<channel>, params, uuid)` | 宿主 `webview-control` `@ipc-message` → `aiBoxPickerHost` 取数 → `webview.send("trigger-result", …)` → preload 按 `uuid` resolve |
| desktop（AiBrowser iframe） | iframe 内 `window.parent.postMessage({ type:"personal-ai:bridge-request", channel, params, uuid })` | **AiBrowser** `handlePersonalAiMessage` → `aiBoxPickerHost` 取数 → `event.source.postMessage({ type:"personal-ai:bridge-result", channel, uuid, data:{code,data} })` |
| desktop（AiBrowser iframe，打开 IM） | iframe 内 `window.parent.postMessage({ type:"personal-ai:open-chat", payload:{ id, type, name?, avatar? } })`（fire-and-forget） | **AiBrowser**（主窗口内）直接 `openConversationById`；列表无会话时用 `name`/`avatar` `PushDialogue` 重建；**不**调 `resume-main-win-size` |
| desktop（AiBrowser iframe，首屏就绪） | iframe 内 `window.parent.postMessage({ type:"personal-ai:ready" })`（fire-and-forget） | **AiBrowser** 收到即撤个人 AI 框首屏 loading 遮罩；宿主 **8s 超时**兜底（老版本 web 不发也不死锁） |
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

// AiBrowser iframe 首屏就绪（web → AiBrowser，无响应）
{ "type": "personal-ai:ready" }
// web 在 PersonalAiChat onMounted 后发；宿主收到即撤个人 AI 框首屏 loading 遮罩。
// 宿主 8s 超时兜底：老版本 web 不发此消息也不会死锁。

// AiBrowser → AI框 iframe：切到 AI框 tab 时通知验版 + 激活（对象或 JSON 字符串均可）
{ "source": "zx-pc", "type": "aiBoxCheckVersion" }
// web：pageActive=true；冲延后消息刷新；getAgentDataRange 只更新记忆栏；再对比 /ai-chat/build_version
// （勿用 getLastSessionMessage：会清未读/角标；aiBoxCheckVersion 激活工作 web 侧 300ms 去重）
// 与 JENKINS_BUILD_NUMBER；不一致则先把当前选中写入 URL query（agentId/belongId/belongType/sessionId），再静默 location.reload()
// 刷新后：URL 深链（belongType 1|3）一律 saveSelected → list → 选中 AI 框；chat-ready 后再按 sessionId 选会话；个人框直接匹配；否则默认个人 AI 框
// PC web 另可通过 `useDocumentVisibility`（hidden→visible）触发同一激活/验版（须 shellActive 仍为 true）；移动端不做

// AiBrowser → AI框 iframe：切离个人 AI tab / 关闭面板
{ "source": "zx-pc", "type": "aiBoxDeactivate" }
// web：shellActive=false；之后推送命中当前会话只记 pending，不立刻刷 Chat 消息（list/History 仍刷）
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
| `selectDataRangeScope` | —（wnsdk `aiChat.selectDataRangeScope` / 安卓 `window.WebView.selectDataRangeScope`） | web→原生 | `{ agentId:string, accountId?:string }`（安卓为该对象的 JSON 字符串；**禁止**传 `initialScopes`） | 见下「selectDataRangeScope 回传」 | ios / android | 原生落库 ACK 改造中（见 plan-数据范围原生落库） |
| `openKnowledgeDoc` | —（wnsdk `aiChat.openKnowledgeDoc`） | web→原生 | `{ docId:string, agentId:string, agentVersionId?:number, docName?:string, fromType?:number }` | 见下「openKnowledgeDoc 回传」 | **仅 ios** | 新增（知识来源文件下载进度与取消） |
| `selectDateRange` | —（wnsdk `aiChat.selectDateRange` / 安卓 `window.WebView.selectDateRange`） | **web→原生（上报）** | 见下「selectDateRange 上报」 | ios：ACK `{"ok":true}`；安卓无回参 | ios / android | 新增（记忆条自定义时间区间 timeType=0） |
| `reportDataRange` | —（wnsdk `aiChat.reportDataRange` / 安卓 `window.WebView.reportDataRange`） | **web→原生（上报）** | 见下「reportDataRange 上报」 | ios：ACK `{"ok":true}` | ios（安卓待接） | 新增（数据范围选择改纯 webview） |

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

### `selectDataRangeScope` 回传（ios / android → web）

Home「数据范围」胶囊（移动端、`persist=true`）调原生多选。

**开页入参（双协议兼容）**：同时传 `agentId`（新）+ `initialScopes`（老 iOS）；各端各取所需。

- **ios**：`wnsdk.aiChat.selectDataRangeScope({ agentId, accountId?, initialScopes?, success, error })`（长回调）
- **android**：`window.WebView.selectDataRangeScope(JSON.stringify({ agentId, accountId?, initialScopes? }))`；回传 `javascript:dataRangeScopeResultFromAndroid(...)`

**新协议**（未上线 / 新包）：原生 `getAgentDataRange` 返显 + 确认 `saveDataRange`；成功 ACK：

```jsonc
{ "type": "personal-ai:selected-data-range", "payload": { "ok": true } }
```

web 收到 `ok` → `getAgentDataRange` 刷本地（不在此路径 save）。

**老协议**（已上线 iOS）：用 `initialScopes` 返显；成功回传 scopes；web 写本地 + `saveDataRange`：

```jsonc
{
  "type": "personal-ai:selected-data-range",
  "payload": { "scopes": [{ "scopeDataType": 1, "scopeDataId": "...", "name?": "", "avatar?": "" }] }
}
```

web 分流：`payload.ok` → 新；有 `payload.scopes` → 老。取消：`code=-1`（android 亦可空串）。PC 仍 H5 + web save。

### `selectDateRange` 上报（web → 原生）

记忆条时间档选「自定义」（`timeType=0`）时，原生拉起 web 的 `/date-range` 免鉴权独立页（半屏 webview / PC iframe）。**方向与其它桥相反**：不是 web 找原生要数据，而是 H5 选完把结果上报给原生，原生据此关层并落库。

载荷（三端同一份）：

```jsonc
{ "type": "date-range:confirm", "startTime": 1756310400000, "endTime": 1756396799999 } // 毫秒
{ "type": "date-range:cancel" }
```

各宿主通路（web 侧判定见 `apps/web/src/pages/date-range/host-bridge.js`，优先级 android > ios > parent）：

| 宿主 | 调用形态 |
|------|---------|
| android | `window.WebView.selectDateRange(JSON.stringify(payload))` |
| ios | `wnsdk.aiChat.selectDateRange({ ...payload, success, error })`（业务字段**平铺**，勿套 `data`） |
| PC iframe | `window.parent.postMessage(payload, "*")` |

**iOS 两个必踩的坑（已修，勿回退）**：

1. **载荷必须平铺在参数顶层**（既不能放 `success`，也不能套 `data`）。wnsdk `callInner` 的实际行为是：把**整个参数对象**复制一份、只把 `success`/`error`/`dataFilter` 置空，然后整个当作 `data` 下发原生（`n=extend({},params); n.success=n.error=n.dataFilter=undefined; callHandler(proto, handlerName, n, cb)`）。
   - 塞进 `success` → 被当回调取走，原生收到空 data；
   - 套一层 `data: payload` → 原生收到 `{"data":{...}}`，顶层没有 `type`，按「非法载荷 → 取消」收口：**弹层关了但区间回不来**（2026-08-31 iOS 真机验出）。
   - 平铺即与 `selectDataRangeScope`（业务参数平铺）一致；原生解析平铺优先，另留 `data` / `success` 嵌套兼容分支。
2. **`/date-range` 页必须自行注册 namespace**。该页属 main 入口，`mpa/mobile/App.vue` 的 `extendModule` 不作用于它；且 `@tjmt/wnsdk` 是 UMD 包，经 Vite 走 CommonJS 分支打包**不挂 `window.wnsdk`**。故页面 `onMounted` 自注册 `selectDateRange`（`os:["MTCoreApi"]`，一次性上报无需 `isLongCb`），并把实例传给 `postToHost`。非 iOS 客户端不得触碰 `wnsdk.aiChat`——os 不匹配时模块 getter 会弹 `showError`。

原生 ACK：`code=0`，`result="{\"ok\":true}"`；web 侧 fire-and-forget，不消费。

### `reportDataRange` 上报（web → 原生）

筛选条「数据范围」改纯 webview：原生开全屏 webview 加载 `/ai-chat/m/data-range`（`needCode=YES`，
带 userCode 换登录态），**web 页自己 `getAgentDataRange` 取底 + `saveDataRange` 落库**，
只把结果上报给原生，原生据此关页并重拉记忆刷筛选条。

载荷：

```jsonc
{ "type": "data-range:confirm", "ok": true }
{ "type": "data-range:cancel" }
```

| 宿主 | 调用形态 |
|------|---------|
| android | `window.WebView.reportDataRange(JSON.stringify(payload))`（待接） |
| ios | `wnsdk.aiChat.reportDataRange({ ...payload, success, error })`（业务字段**平铺**） |
| PC iframe | `window.parent.postMessage(payload, "*")` |

坑与 `selectDateRange` 完全一致（载荷平铺、非 iOS 不碰 `wnsdk.aiChat`），web 侧判定已提到
`apps/web/src/utils/hostReportBridge.js`，两条链路共用。原生 ACK `code=0`、`result="{\"ok\":true}"`。

### `openKnowledgeDoc` 回传（ios → web）

H5（移动端 AI 会话页）点知识来源具体链接时调用。**整条链路交给原生**：拉 `agentFileDataByDocId` 元数据 → 飞书/WPS 授权兜底 → OSS 签名 → 下载（带环形进度浮层，可取消）→ 预览（文档 / 图片 / 智文 Web 页 / 外链）。web 不再自行拼 url。

入参：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `docId` | string | 是 | 知识文档 ID |
| `agentId` | string | 是 | 智能体 ID |
| `agentVersionId` | number | 否 | 默认 0 |
| `docName` | string | 否 | 文件名（缓存目录与预览标题） |
| `fromType` | number | 否 | 0/1 本地文件、2 智文、3 飞书、4 公开链接、6 WPS；原生以接口返回为准，此字段仅兜底 |

回参：

| 场景 | code | result |
|------|------|--------|
| 打开成功 | 0 | `{"status":"success"}` |
| 用户取消下载 | 0 | `{"status":"cancel"}` |
| 飞书 / WPS 未授权（原生已拉起授权页，本次打开未完成） | 0 | `{"status":"cancel"}` |
| 失败（原生已 toast） | -1 | — |

**平台降级**：安卓**未实现**该桥。web 侧按 UA 判断（`MTCoreApi` + iPhone/iPad/iPod，见 `knowledgeNativeOpen.js` 的 `shouldOpenKnowledgeOnIosNative`），非 iOS 客户端继续走 web 自己的 `previewKnowledgeFile`（`multimediaPreview` / `window.open`）。

**统一字段约定**（与 `apps/web/src/components/views/home/personalAiAgentAdapter.js` 对齐）：
- 人员主键 `accountId`、群主键 `id`、AI 框名 `agentName`、最近对话时间 `lastChatAt`（毫秒时间戳）
- `ownerType` ∈ `group`（群） / `private`（私聊）
- `groupType`：`0`=组织群 / `10`=外联群（沿用 desktop 转发窗，见 `context/platforms/desktop-forward-dialog.md`）

## 版本与兼容

- 老 desktop 壳无 `getMyGroups`/`getOrgCompanies`/`getDeptUsers`/`searchAiBoxPicker` 时：组织架构与搜索已改走 HTTP，**不依赖**这些桥；仅最近联系人/群组仍可能提示「请升级到最新版本」。
- `getRecentContacts` 缺 `agentName`/`lastChatAt`：视为宿主 bug，联调时由 desktop 侧补齐（见选择AI框 spec「待联调确认 1」）。
- 移动端（`wnsdk.aiChat.*`）取数类接口（最近联系人/群组/组织）本期不实现；**`selectAiAgent` ios/android 均已落地**（android 见上表；原生只回传选中项，saveSelected/list 在 web H5）。

## Changelog

- 2026-08-31 登记 `reportDataRange`（ios，web→原生上报；安卓待接）：全屏 webview 加载 `/ai-chat/m/data-range`，web 以 `getAgentDataRange` 为底 `saveDataRange` 后上报 `{type:"data-range:confirm",ok:true}` / `cancel`。载荷必须平铺（同 `selectDateRange`）。判定共用 `hostReportBridge.js`。
- 2026-08-28 登记 `selectDateRange`（ios / android，web→原生上报）：`/date-range` 页确认/取消回传 `{type,startTime,endTime}`。iOS 修两处：载荷从 `success` 键移到 `data`（`success`/`error` 是 wnsdk 保留回调键），`/date-range` 页自注册 namespace（main 入口无 wnsdk，UMD 也不挂 window）；原生解析改平铺优先、保留嵌套兼容。
- 2026-08-18 新增 `openKnowledgeDoc`（仅 ios）：H5 点知识来源链接改由原生全包（元数据 + 授权 + OSS 签名 + 下载进度 + 预览），回传 `{status:success|cancel}`，失败 `code=-1`；安卓未实现，web 按 UA 降级。
- 2026-08-05 登记 `personal-ai:ready`（web → AiBrowser，fire-and-forget）：web 首屏挂载完成信号，宿主据此撤个人 AI 框首屏假 loading；宿主 8s 超时兜底兼容老版本 web。
- 2026-07-31 web 选择 AI 框组织架构改直调 contact（`getContract` / `sub_dept_user_pagelistV3`），不再调桥 `getOrgCompanies`/`getDeptUsers`；desktop 桥 handler 保留不动。
- 2026-07-23 web 兼容老 iOS：开页同时传 `agentId`+`initialScopes`；回传按 `ok`（新）/ `scopes`（老）分流。
- 2026-07-22 选择数据范围（ios/android）：入参改 `{agentId,accountId?}`；原生 `getAgentDataRange` 返显 + `saveDataRange` 落库；桥成功只 ACK `{ok:true}`；web 再拉记忆。方案 `plan-数据范围原生落库.md`。
- 2026-07-29 AiBrowser → iframe：新增 `aiBoxDeactivate`（切离个人 AI / 关面板）；`aiBoxCheckVersion` 兼作激活（冲延后消息 + 只刷记忆 + 验版）。web `pageActive = docVisible && shellActive`。
- 2026-07-22 android 选择数据范围：web 打开走 `WebView.selectDataRangeScope`；回传 `javascript:dataRangeScopeResultFromAndroid(...)`（不再 pull `getSelectDataRangeResult`）；已被上条原生落库方案取代入参/回传形态。
- 2026-07-21 强刷选中改 URL：`aiBoxCheckVersion` / visibility 验版变更前 `writeActiveSelectionToUrl`；reload 后 1|3 一律 save→list→选中（不再用 sessionStorage）。
- 2026-07-21 AiBrowser → iframe：`aiBoxCheckVersion`（切到 AI框 tab）；web 静默对比 `build_version`，变更则 reload。
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
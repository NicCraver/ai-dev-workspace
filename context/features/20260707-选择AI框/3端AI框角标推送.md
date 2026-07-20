# 三端 AI框角标推送（aiBoxSendMessage）

> 最后更新：2026-07-20  
> 用途：PC 已联调落地；**写 iOS / Android 时以本文 + PC 代码为准**。  
> 对照：行动中心同类链路见文末「附录：actionCornerRefresh」。

---

## 0. 一句话流程

```
融云 RC:CmdMsg name=aiBoxSendMessage
  → 解析 pushAccountIdSessionIdSetMap
  → 当前 accountId 在 map 且 sessionIds 非空 → 命中
  → 命中则 POST /agentSetBasic/getBadgePushInfo（原生/壳刷黄角标）
  → 通知内嵌 Web（sessionIds 非空才推）：仅 type + source + sessionIds
```

**原则**：角标数字以 HTTP 为准，不要用融云 payload 里的数字直接写 UI。

---

## 1. 契约（三端共用）

### 1.1 融云 cmd

| 项 | 值 |
|---|---|
| objectName | `RC:CmdMsg` / `CommandMessage` |
| name | **`aiBoxSendMessage`** |
| data | JSON 字符串（见下） |

**实测 data 形状**（勿当成顶层 Map）：

```json
{
  "pushAccountIdSessionIdSetMap": {
    "<accountId>": ["<sessionId>", "..."]
  }
}
```

例：`{"pushAccountIdSessionIdSetMap":{"1880150187008081921":["2079019710535434241"]}}`  
→ key=`1880…` 当前登录人；value=`["2079…"]` 即 `sessionIds`。

**命中规则（三端统一）**

1. 当前登录 `accountId` 是 map 的 key  
2. 且对应 `sessionIds` **非空**  

两者同时满足才拉角标 / 向 Web 推送。仅 key 存在但数组为空 → **不处理**。

### 1.1.1 传给 Web 的载荷（唯一形状）

PC iframe `postMessage` 与移动 `refreshViewDate.extra` **相同**，只含三字段：

```json
{
  "type": "aiBoxSendMessage",
  "source": "zx-pc",
  "sessionIds": ["2079019710535434241"]
}
```

- **不要**再带 `cmdMsg` / `badge`（角标只在原生侧用 HTTP 结果）
- 启动补拉角标：可更新原生入口，**不**向 Web 推上述消息

### 1.2 HTTP：`getBadgePushInfo`

- 契约：`context/contracts/personalAiFrame/getBadgePushInfo.d.ts`
- YApi：`POST /agentSetBasic/getBadgePushInfo`（#14196）
- PC 实现：`apps/desktop/src/renderer/service/aiBasic.js` → `getBadgePushInfo`
- path 前缀：desktop 用 `$apipath.aiBasicPath`（与其它 `agentSetBasic/*` 一致）

**入参**

| 字段 | 说明 |
|---|---|
| `accountId` | 当前登录账号 |

**回参 data**

| 字段 | 说明 |
|---|---|
| `yellowUnreadNumber` | 黄色角标数（**ios/android：>0 才显示角标**；desktop 左侧仍可含 0） |
| `lastAbbreviationInfo` | 最新缩略（会话列表副标题等；可为 null） |

### 1.3 模拟推送（联调）

web 个人 AI 侧栏：刷新旁 `send` 图标 → `GET /agentSetBasic/testBadgePush`  
（`accountId`=当前用户；固定模拟 `zxAccountId` / `zxClientType`）

---

## 2. Desktop（已完成，移植对照）

### 2.1 调用链

```
ReceiveMessageListener.js          case "aiBoxSendMessage"
  → PollingPersonalAiBadge.setupPolling({ accountId, sessionIds, raw })
       polling-personal-ai-badge.js
  → getBadgePushInfo → Vuex SetPersonalAiBadge { yellowUnreadNumber, lastAbbreviationInfo, visible:true }
  → eventHub.$emit("ai-box-badge-updated", { badge, personalAiSiderItem, sessionIds, raw })
       ├─ main.vue              左侧 sider 图标强制切回 AI框（aiId=0）
       ├─ new-aside-menu.vue    黄角标（Badge + num-yellow；0 用字符串 "0"）
       └─ AiBrowser/index.vue   postMessage → personal AI iframe
            → PersonalAiChat.vue 监听 source=zx-pc type=aiBoxSendMessage（log + 联调推送次数角标）
```

### 2.2 关键文件

| 文件 | 职责 |
|---|---|
| `apps/desktop/.../WebIM/ReceiveMessageListener.js` | 解析 `pushAccountIdSessionIdSetMap`，命中则 setupPolling |
| `apps/desktop/.../plugin/polling-notice/polling-personal-ai-badge.js` | 调 API + emit |
| `apps/desktop/.../service/aiBasic.js` | `getBadgePushInfo` |
| `apps/desktop/.../store/{stateTemplate,actions,mutations,getters}.js` | `PersonalAiBadge` |
| `apps/desktop/.../layouts/new-aside-menu.vue` | 左侧黄角标；点击 aibrowser 时 emit 切 tab |
| `apps/desktop/.../views/main.vue` | `onAiBoxBadgeUpdated` 设 `aiBrowserSiderItem` |
| `apps/desktop/.../views/AiBrowser/index.vue` | iframe `postMessage`；听 `ai-browser-select-sider-item` |
| `apps/web/.../personal-ai/list/PersonalAiChat.vue` | PC：收 zx-pc 推送 log + 联调次数角标（验完删） |
| `apps/web/.../personal/m/MPersonalAiChatWrapper.vue` | 移动：postMessage + `refreshViewDate` + 顶栏联调次数（验完删） |

### 2.3 壳 → Web 消息格式（对齐行动中心）

参考 o5-shortcut / 行动中心：PC iframe 用 `postMessage(JSON.stringify(...))`，web 判断 `source === "zx-pc"`。

```js
// 壳发出（AiBrowser → AI框 iframe）
JSON.stringify({
  source: "zx-pc",
  type: "aiBoxSendMessage",
  cmdMsg: "<原始 data 字符串或再 stringify>",
  sessionIds: ["..."],
  badge: { yellowUnreadNumber, lastAbbreviationInfo, visible: true }
})
```

web PC（`PersonalAiChat`）与移动（`MPersonalAiChatWrapper`）均已监听（log + 联调推送次数）；**刷 list 已落地**（`personalAiPushRefreshFlow`，见 `推送后列表刷新规则.md` §6）。

移动端：原生 → WebView 用 **`wnsdk.page.refreshViewDate`**（行动中心 / 呼叫群同款），**id/name 均必填**；`extra` 扁平带 `type/sessionIds/badge`。web `4aca44d` 已按 microAppId 注册，并校验 `extra.type === "aiBoxSendMessage"` 再 bump（联调计数）。

### 2.4 PC 行为摘要

| 行为 | 说明 |
|---|---|
| 黄角标 | 接口成功即 `visible=true`，含 0 |
| sider 图标 | 推送后切回 AI框（`aiId=0`），避免停在其它 AI 工具 logo |
| 点左侧 AI 入口 | emit `ai-browser-select-sider-item` → AiBrowser 选中 AI框 tab |
| iframe 未挂载 | 从未打开过 AI框则 postMessage 失败（壳有 warn log） |

### 2.5 联调 log 关键字

过滤：`[aiBoxSendMessage]`

| 位置 | 日志 |
|---|---|
| 壳 | `received` / `hit=` / `getBadgePushInfo request|result` / `postMessage → personal AI iframe` |
| iframe | `web iframe received from zx-pc` |

---

## 3. iOS / Android 移植清单（已落地，待真机 E2E）

### 3.1 建议对称步骤

| # | 步骤 | iOS | Android | 参考 |
|---|---|---|---|---|
| 1 | 融云入口加 `aiBoxSendMessage` | ✅ `AppDelegate+RCIM.m` | ✅ `RongIM.java`（`!offline && left==0`） | 同文件内 `actionCornerRefresh` 旁 |
| 2 | 解析 `pushAccountIdSessionIdSetMap` | ✅ | ✅ Gson `AiBoxSendMessageCmd` | **不要**当顶层 Map |
| 3 | accountId 命中判断 | ✅ `ZXDataInstance.accountModel.accountId` | ✅ `RongIM.getCurrentUserId()` | 与 PC `GetCompany.accountId` 对齐确认 |
| 4 | 调 `getBadgePushInfo` | ✅ `ZXIMShortcutManager` | ✅ `PersonalAiBadgeController` + `AiChatBasicInterface` | path 同契约 |
| 5 | 入口角标 UI | ✅ PersonalAI Cell 黄角标 + 副标题 | ✅ `PersonalAiListCellBinder` | PC 是左侧 aside；移动是会话列表入口 |
| 6 | 通知 Web | ✅ `refreshViewDate` | ✅ `refreshDate`（`AI_FRAME_ID`） | PC：`source:zx-pc` postMessage |
| 7 | 离线策略 | 默认进合并 | ✅ **离线忽略**；启动/回前台补拉 | 显式选型 |

### 3.2 通知 Web 时建议 extra / payload

与 PC 对齐，便于 `PersonalAiChat`（及后续移动宿主）统一处理：

```jsonc
{
  "type": "aiBoxSendMessage",
  "sessionIds": ["..."],
  "badge": {
    "yellowUnreadNumber": 0,
    "lastAbbreviationInfo": null
  },
  // 原始融云 data 字符串，可选
  "cmdMsg": "{\"pushAccountIdSessionIdSetMap\":{...}}"
}
```

- **PC**：外层再包 `source: "zx-pc"`（已实现）
- **移动**：`wnsdk.page.refreshViewDate({ id, name, success })`，**id/name 均必填**（wnsdk 缺 id 直接 error）
  - 统一微应用 Id：`1915674367645798402`（Android `AI_FRAME_ID` / iOS `ZXPersonalAIAppId`）
  - success 的 `extra` 为扁平 JSON：`{ type, sessionIds, badge, cmdMsg? }`（勿再包一层）
  - web `MPersonalAiChatWrapper` 已按 id 注册并校验 `extra.type === "aiBoxSendMessage"`

### 3.3 挂点速查

| 端 | 文件 | 状态 |
|---|---|---|
| Desktop | `ReceiveMessageListener.js` → `case "aiBoxSendMessage"` | ✅ |
| iOS | `AppDelegate+RCIM.m` → `aiBoxSendMessage` → `refreshPersonalAiBadgeWithRCCmd` | ✅ |
| Android | `RongIM.java` → `aiBoxSendMessage` → `PersonalAiBadgeController` | ✅ |
| web | PC `PersonalAiChat` + 移动 `MPersonalAiChatWrapper`（含 refreshViewDate） | ✅ 听推送 + 刷 list 已落地；联调次数待删；待真机/PC E2E |

### 3.4 iOS / Android 实现摘要（2026-07-17）

对齐呼叫群（`callAccountIdSet` → 拉数 → 会话列表 Cell 黄角标 + 副标题）：

| 步骤 | iOS | Android |
|---|---|---|
| 融云 cmd | `AppDelegate+RCIM` `aiBoxSendMessage` | `RongIM` `!offline && left==0` |
| 命中 | `pushAccountIdSessionIdSetMap` 含 `accountId` | 同左，`RongIM.getCurrentUserId()` |
| HTTP | `ZXIMShortcutManager refreshPersonalAiBadgeWithRCCmd` → `getBadgePushInfo` | `PersonalAiBadgeController` → `AiChatBasicInterface.getBadgePushInfo` |
| 列表 UI | `ZXConversationListCell` PersonalAI：黄角标 knowNum + 副标题 abbr | `PersonalAiListCellBinder`：LEVEL_SECOND 黄标 + desc |
| 通知 Web | `ZXPersonalAIChatController` → `refreshViewDate` | 打开中且 `microAppId=AI_FRAME_ID` → `refreshDate` |
| 启动补拉 | `ZXChatMenuController` 与呼叫群同批 | `ZhiXinFragmentThing` initData / case 121 |
| 离线 | 进 `onReceivedAllCmdMessage` 合并（未单独 filter） | **离线忽略**（与行动中心同） |

角标展示：**ios/android**——`yellowUnreadNumber > 0` 才显示黄角标（**0 不展示**）；desktop 左侧仍可含 0。

### 3.4 内容侧（另线，非本推送必做）

| 项 | 说明 |
|---|---|
| `answerType = 11` | 文本 + 文件组合 |
| `fixedAttachmentListStr` | 定时推送附件列表 JSON 字符串 |

主要在 web 消息渲染；与角标推送可并行。

### 3.5 仍待产品 / 联调

- [ ] 点进 AI框 / 打开入口后是否清角标、何时清
- [x] web 收到推送后解析并落 `sessionIds`（`aiBoxSendMessageUtils`；顶层 / Map 回退）
- [x] web 收到推送后：按 `sessionIds` 刷列表（规则见 `推送后列表刷新规则.md`；`personalAiPushRefreshFlow` 已落地，待 E2E）
- [ ] 移动端入口副标题是否展示 `lastAbbreviationInfo`
- [ ] iOS 离线 cmd：合并 vs 不合并（`filterNames`）
- [ ] Android 回前台是否补拉 `getBadgePushInfo`

---

## 4. 快速打开代码

```
# Desktop（已落地）
apps/desktop/src/renderer/WebIM/ReceiveMessageListener.js
apps/desktop/src/renderer/plugin/polling-notice/polling-personal-ai-badge.js
apps/desktop/src/renderer/views/AiBrowser/index.vue
apps/desktop/src/renderer/components/layouts/new-aside-menu.vue
apps/desktop/src/renderer/views/main.vue
apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue
apps/web/src/components/views/personal/m/MPersonalAiChatWrapper.vue  # 移动 refreshViewDate + 联调次数

# 契约
context/contracts/personalAiFrame/getBadgePushInfo.d.ts

# iOS（已落地，对齐呼叫群）
apps/ios/SmartMessage/ZX_Base/ZX_AppDelegate/AppDelegate+RCIM.m
apps/ios/.../ZXIMShortcutManager.m          # refreshPersonalAiBadgeWithRCCmd
apps/ios/.../ZXConversationListCell.m       # PersonalAI 黄角标 + 缩略
apps/ios/.../ZXPersonalAIChatController.m   # refreshViewDate
apps/ios/.../ZXPersonalAiBadgeModel.{h,m}

# Android（已落地，对齐呼叫群）
apps/android/IM/src/main/java/com/im/base/RongIM.java
apps/android/IM/.../conversation/personal_ai/PersonalAiBadgeController.java
apps/android/IM/.../conversation/PersonalAiListCellBinder.java
apps/android/android_net/.../AiChatBasicInterface.java  # getBadgePushInfo

# 行动中心 Web 刷新参考（o5-shortcut）
/Users/nic/w/dev-o5-shortcut/src/components/action-call/store/useACRefreshListener.js
/Users/nic/w/dev-o5-shortcut/src/components/clients/list/index.vue   # source===zx-pc / refreshViewDate
```

---

## 附录 A：行动中心对照（actionCornerRefresh）

AI框挂点与下列 cmd **同入口、不同 name**。

| cmd | 语义 |
|---|---|
| `actionCornerRefresh` | 行动中心总角标 |
| `weekWorkCornerRefresh` | 周工作 |
| `newOkrCornerRefresh` | OKR |

| 端 | 入口 |
|---|---|
| Desktop | `ReceiveMessageListener.js` → `polling-action-unread` → Vuex；iframe `{ source:"zx-pc" }` |
| iOS | `AppDelegate+RCIM.m`；Web：`refreshViewDate` |
| Android | `RongIM.java`；注意仅 `!offline && left==0` |

差异速记：iOS 有离线合并；Android 离线丢、前台门控；Desktop 5s 节流。

---

## 附录 B：PC 进度表

| 步骤 | 状态 |
|---|---|
| 监听 + 解析 `pushAccountIdSessionIdSetMap` | ✅ |
| `getBadgePushInfo` + Vuex | ✅ |
| 左侧黄角标（含 0） | ✅ |
| sider 切回 AI框图标 | ✅ |
| 点击入口打开 AI框 tab | ✅ |
| iframe / 移动 refreshViewDate + web 联调次数 | ✅ |
| web 刷 list | ✅ 已落地，待 E2E |
| web 清角标 | ⬜ |
| iOS / Android 推送→角标→缩略（对齐呼叫群） | ✅ 代码落地，待真机 E2E |

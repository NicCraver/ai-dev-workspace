# 三端 AI框角标推送（aiBoxSendMessage）

> 最后更新：2026-07-17  
> 用途：PC 已联调落地；**写 iOS / Android 时以本文 + PC 代码为准**。  
> 对照：行动中心同类链路见文末「附录：actionCornerRefresh」。

---

## 0. 一句话流程

```
融云 RC:CmdMsg name=aiBoxSendMessage
  → 解析 pushAccountIdSessionIdSetMap，当前 accountId 是否命中
  → 命中则 POST /agentSetBasic/getBadgePushInfo
  → 原生/壳：刷入口黄角标（+ PC 左侧菜单图标切回 AI框）
  → 通知内嵌 personal AI Web：刷 list / 会话（web 目前仅 log）
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

- key = 账号 id（字符串）
- value = 该账号受影响的 `sessionId` 集合（数组）
- **仅当当前登录 `accountId` 在 Map 的 key 中**才继续拉角标 / 通知 Web

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
| `yellowUnreadNumber` | 黄色角标数（联调时 **0 也显示**） |
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
            → PersonalAiChat.vue 监听 source=zx-pc type=aiBoxSendMessage（目前仅 log）
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
| `apps/web/.../personal-ai/list/PersonalAiChat.vue` | 收 zx-pc 推送 log |

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

web（`PersonalAiChat`）已监听；**刷 list 仍 TODO**。

移动端应对齐：原生 → WebView 用 **`wnsdk.page.refreshViewDate`**（行动中心 / 呼叫群同款），`extra` 里带同等字段；或向 WebView 注入 / evaluate 等价消息。web 侧最终应能区分 PC `postMessage` 与移动 `refreshViewDate`。

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

## 3. iOS / Android 移植清单（待做）

### 3.1 建议对称步骤

| # | 步骤 | iOS | Android | 参考 |
|---|---|---|---|---|
| 1 | 融云入口加 `aiBoxSendMessage` | `AppDelegate+RCIM.m` → `onReceivedCommandMessage:` | `RongIM.java` → `RC:CmdMsg` 且 `!offline && left==0` | 同文件内 `actionCornerRefresh` 旁 |
| 2 | 解析 `pushAccountIdSessionIdSetMap` | `mj_JSONObject` | Gson / JSONObject | **不要**当顶层 Map |
| 3 | accountId 命中判断 | `ZXDataInstance.accountModel.accountId` | `RongIM.getCurrentUserId()` | 与 PC `GetCompany.accountId` 对齐确认 |
| 4 | 调 `getBadgePushInfo` | `ZXActionManager` 或新建 AI 框 API 封装 | `NewActionInterface` 或 aiBasic 模块 | path 同契约 |
| 5 | 入口角标 UI | 会话列表「AI框」Cell（`ConversationType_PersonalAI`）黄角标 + 副标题 `lastAbbreviationInfo` | `PersonalAiListCellBinder` 等同位置 | PC 是左侧 aside；移动是会话列表入口 |
| 6 | 通知 Web | 若 personal AI WebView 已打开：`refreshViewDate` 或等价，`extra` 含 sessionIds / badge / raw | 同左（EventBus → WebView） | PC：`source:zx-pc` postMessage |
| 7 | 离线策略 | 默认会进 `onReceivedAllCmdMessage` 合并；AI框是否合并需定 | **离线忽略**（与行动中心同）；回前台可补拉 getBadgePushInfo | 显式选型 |

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
- **移动**：`wnsdk.page.refreshViewDate({ id, name, success })`，在 success 的 `extra` 里带上述 JSON；web 需补监听（目前只听了 zx-pc postMessage）

### 3.3 挂点速查

| 端 | 文件 | 状态 |
|---|---|---|
| Desktop | `ReceiveMessageListener.js` → `case "aiBoxSendMessage"` | ✅ |
| iOS | `AppDelegate+RCIM.m` ~255 旁加分支 | ⬜ |
| Android | `RongIM.java` ~410 旁加 `else if` | ⬜ |
| web | `PersonalAiChat.vue` 听 zx-pc；移动 refreshViewDate 待补 | 🚧 仅 PC log |

### 3.4 内容侧（另线，非本推送必做）

| 项 | 说明 |
|---|---|
| `answerType = 11` | 文本 + 文件组合 |
| `fixedAttachmentListStr` | 定时推送附件列表 JSON 字符串 |

主要在 web 消息渲染；与角标推送可并行。

### 3.5 仍待产品 / 联调

- [ ] 点进 AI框 / 打开入口后是否清角标、何时清
- [ ] web 收到推送后：刷 `list`、命中 `sessionIds` 是否拉当前会话消息
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

# 契约
context/contracts/personalAiFrame/getBadgePushInfo.d.ts

# iOS（待接，仿 actionCornerRefresh）
apps/ios/SmartMessage/ZX_Base/ZX_AppDelegate/AppDelegate+RCIM.m
apps/ios/.../ZXIMShortcutManager.m          # 角标 API / 通知可对照
# 个人 AI 入口 Cell / WebView 宿主：ZXPersonalAIChatController 一带

# Android（待接，仿 actionCornerRefresh）
apps/android/IM/src/main/java/com/im/base/RongIM.java
apps/android/IM/src/main/java/com/im/manager/RongMessageHandlerManager.java
# 个人 AI 入口：PersonalAiListCellBinder / personal WebView

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
| iframe postMessage + web log | ✅ |
| web 刷 list / 清角标 | ⬜ |
| iOS / Android | ⬜ |

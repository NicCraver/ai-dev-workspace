# Spec：PC 个人 AI「打开独立弹窗」→ 系统原生窗

> 由 brainstorm 产出。最后更新：2026-07-21  
> 活跃功能：`context/features/20260707-选择AI框/`  
> 范围：apps/web + apps/desktop（仅 PC；android/ios 不做）

## 背景与目标

PC 个人 AI（AiBrowser iframe 内 `/zx/personal`）头栏「打开独立弹窗」当前走 `WindowPostWinMessage` → 共用无边框 `aiChatWin`，打开的是单会话 `/home/{belongType}/{belongId}`，且推送只转发到 AiBrowser iframe，**独立窗收不到** `aiBoxSendMessage`。

**目标**：点击后打开 **系统标题栏原生窗**（`frame: true`），加载完整个人 AI 页（含左侧列表），按深链默认选中当前 AI 框与当前会话；系统标题随左侧选中项变化；独立窗具备与主窗 iframe 同规则的推送刷新。

**成功标准**

1. 点「打开独立弹窗」→ Electron 系统标题栏窗（非无边框 `aiChatWin`、非 `window.open`）。
2. 窗内为完整 `/zx/personal`（左侧列表 + 对话），不是裸 `/home/...`。
3. 打开后默认选中打开前的 AI 框；若有当前 `sessionId`，选中该历史会话并展示消息（不是一律「最近会话」）。
4. 左侧切换选中项 → 系统标题栏文案更新为该项 `title`。
5. 融云 `aiBoxSendMessage` 命中后，独立窗按《推送后列表刷新规则》刷 list / History / 消息。
6. 设置页、其他智能体独立窗仍走原 `aiChatWin`，不受影响。

## 非目标

- 不改共用 `aiChatWin` 为有框窗。
- 不改移动端入口深链（可复用匹配逻辑，但不在本期改 ios/android）。
- 不做多开个人 AI 原生窗（单例：再点则 focus + 按新 query 导航/选中）。

## 窗口模型（desktop）

新建单例 **`personalAiWin`**（与 `aiChatWin` / `operationWin` 并列）：

| 项 | 约定 |
|----|------|
| 创建 | `ipcMain.handle("create-personal-ai-win")`，启动主流程时创建（同 `create-ai-chat-win`） |
| 外观 | `frame: true`（系统标题栏）；尺寸可参考主窗/aiChat 常用宽高；`show: false` 预创建 |
| 加载 | `APP_AICHAT` 域（可先 `/empty` 再 `open-page`，或直接 load 带 query 的 personal URL） |
| 打开 | `open-personal-ai-win`：`webContents.send("open-page", { path, query })` → `show` + `focus` |
| 关闭 | hide 不销毁（对齐 `aiChatWin`），除非真退出 |
| 注入 | 需能走智信 token/IPC；**新增** `ipcNativeFrame=true`（或等价），与 `ipcTargetIsWin` 区分 |

**布局**：`ipcNativeFrame` 为真时，web `TheLayout` **隐藏**自定义最小化/最大化/关闭（系统栏已有），避免双顶栏。仍可保留刷新/字号等业务控件（若现有布局需要）；拖拽区不要抢系统栏。

## 打开协议（web → 壳）

个人 AI **内嵌**头栏「打开独立弹窗」不再走「打开 `/home/...` 的 `openAiWin`」。

改为：

1. 从当前态组装 query（见下表）。
2. 通知壳打开原生个人 AI 窗，例如：
   - `postMessage`：`{ type: "aiChat", data: { openPersonalAiNativeWin: 1, data: { path: "/personal", query } } }`  
   - 或沿用 `WindowPostMessage` 扩展字段（实现时二选一，保持与 `App.vue` `case "aiChat"` 一致）。
3. desktop `App.vue`：`openPersonalAiNativeWin` → `ipcRenderer.invoke("open-personal-ai-win", payload)`。

非 iframe（浏览器直开）可降级 `window.open`，本期不作为验收重点。

### Query 字段

| 字段 | 必填 | 来源 | 用途 |
|------|------|------|------|
| `agentId` | 有则带 | 当前左侧选中项 | list 优先匹配 |
| `belongId` | 有则带 | 选中项 `belongId` / `targetId` | 匹配回退；选中后 Home `targetId` |
| `belongType` | 有则带 | 选中项 `belongType` / `chatType` | 匹配回退；选中后 Home `chatType` |
| `sessionId` | 有则带 | `homeRef.getCurrentSessionId()` | 打开后选中该历史会话并拉消息 |
| `aiRoleId` | 建议 | 选中项 / `activeChat` | 列表补齐前兜底；与现独立窗一致 |
| `title` | 建议 | 选中项 `title` / `belongName` | 打开瞬间即可 `setTitle`，不等 list |

不必传：`accountId`（壳 `userCode`）、完整消息列表、会话标题文案。

缺 `agentId` 且缺 `belongId+belongType` 时：仍可打开 `/personal`，走页内默认首项（与无深链一致）；并打 warn。

## 默认选中（web `/personal`）

对齐移动端入口深链（`MPersonalAiChatWrapper`），并 **补 PC + `sessionId`**：

1. 读 URL / `open-page` query（one-shot，避免改筛/推送刷 list 反复抢选中）。
2. 首次 `list` 成功后：
   - 先按 `agentId`，再按 `belongType+belongId` 匹配；
   - 未命中且 `belongType ∈ {1,3}` 且 `belongId` 非空 → `saveSelected` → exempt → 再 list → 再匹配（同 `plan-入口深链saveSelected.md`）；
   - `belongType=0` 不调 saveSelected。
3. 选中 AI 框并挂载 Home 后：
   - 若有 `sessionId`：在 `chat-ready`（或 History 首次拉取完成）后调用现有 `selectSession` / 等价路径加载该会话消息；
   - **不要**只靠 `getLastSessionMessage`（那是「最近会话」，会偏离打开前会话）。
4. 无 `sessionId`：保持现有「最近会话」行为。

> 现状缺口：PC `PersonalAiChat` 尚无入口深链；Home/Chat 无「初始 sessionId」入参。本期需补。

## 系统标题栏

- 打开时：优先用 query `title`；若无则用匹配到的列表项 `title`。
- 之后：`activeAgentId` / 选中项变化 → 更新标题（`document.title` 和/或 IPC `setTitle`，以 Electron `frame:true` 窗实际生效方式为准）。
- 标题文案 = 左侧列表当前项展示名（adapter 的 `title`，即归属名）。

## 推送（独立窗）

主窗链路不变：融云 → `PollingPersonalAiBadge` → AiBrowser iframe `postMessage`。

**增量**：角标/sessionIds 就绪后，再向 `personalAiWin` 转发（对齐周工作 `refresh-weekwork-data`）：

- 例如 `ipcRenderer.invoke("refresh-personal-ai-data", { sessionIds })`  
- main：若 `personalAiWin` 存在且未销毁 → `webContents.send(...)`  
- web（`/personal`）：监听后走既有 `normalizeAiBoxSendMessagePayload` + `runPushRefresh`（与 iframe 同源规则，见 `推送后列表刷新规则.md`）。

独立窗未打开：不创建、不报错。

## 关键文件（实现指引）

| 侧 | 文件 | 改动要点 |
|----|------|----------|
| desktop main | `popup-ipc.js` | `create/open-personal-ai-win`；`refresh-personal-ai-data` |
| desktop renderer | `App.vue`、`main.vue` | 监听 `openPersonalAiNativeWin`；启动时 create |
| desktop | `polling-personal-ai-badge.js` / AiBrowser 或 ReceiveMessage 链路 | 推送转发到独立窗 |
| web | `Chat.vue` `handleOpenIndependent` | 组 query；改打开协议 |
| web | `pageUtils.js` / 宿主约定 | 新 open API（勿误走 `openAiWin`→`/home`） |
| web | `PersonalAiChat.vue` | PC 深链 + sessionId 选中；标题同步 |
| web | `Home.vue` / `Chat.vue` | 初始/指令式选中指定 `sessionId` |
| web | `TheLayout*.vue` | `ipcNativeFrame` 隐藏系统窗控重复 UI |

## 验收清单

- [ ] 个人 AI iframe 内点独立弹窗 → 系统标题栏窗，内容为个人 AI 完整页
- [ ] 打开后左侧选中与打开前一致（agentId / belong 深链）
- [ ] 有 sessionId 时对话为该会话，不是被最近会话覆盖
- [ ] 切换左侧项 → 系统标题变化
- [ ] 独立窗打开时推送：情况 2 刷 list；情况 3 刷 list+History+消息
- [ ] 设置/其他智能体仍走无边框 `aiChatWin`
- [ ] 关闭独立窗再打开：单例复用，按新 query 选中

## 风险与依赖

- `TheLayout` 多标签模型与「单页 personal」并存：原生窗建议打开后固定在 `/personal`，避免用户再开一堆 tab 导致标题语义混乱（实现时可限制或接受，联调时定）。
- `sessionId` 选中时序：须等 Home `chat-ready` / History 就绪，避免与 `getLastSessionMessage` 竞态。
- 有框窗 + 旧 `ipcTargetIsWin` 注入若未区分，会出现双顶栏——必须以 `ipcNativeFrame` 显式分支。

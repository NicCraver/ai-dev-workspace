# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-07-31（iOS 合并详情隐藏「x条回复」）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 个人 badge + `fixTaskMessage===1` 门闩 · plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 群 AI badge「来自群AI框」· plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 自己消息详情 badge | — | ✅ 仅循环时间 + 反序对齐 PC（`cc79be12c`） | ✅ 仅循环时间 + 反序对齐 PC | ✅ 触发名+循环时间（`ff400773`）+ 样式（`0b648606`） |
| 合并转发保留字段 + 合并详情列表 badge | — | ✅ `37a06f9ce`（待真机） | ✅ `e88ac08cb`（待真机·须重合并）；隐藏「x条回复」`9f18faced` | ✅ `126d78d6` |
| 逐条转发抹 badge（含 ActionCard） | — | ✅（文本裁剪；ActionCard 新建无 extra） | 🚧 本地已修（待 commit/push；原仅 Text/Reply 裁剪） | ✅ |
| 个人/群 AI 列表昵称取实时资料 | — | ⬜ 待对齐 | ✅ `a68a68261`（`feat/personal-ai-list-realtime-nickname` 已推远端，待合入 `personal-ai-chat`） | ✅ `a4371382`（`feat/personal-ai-list-realtime-nickname` 已推远端，待合入 `personal-ai-chat`） |
| impl-notes 补全 · plan Task 4 | ✅（共用） | ✅ | ✅ | ✅ |
| 自测通过 | — | ⬜ 待真机 | ⬜ 待真机（须**重新合并转发**后再开聊天记录） | ⬜ 待手测 |

> web：本期不做。tag（昵称旁文案）未改；仅发送者展示名改为实时资料。

## 提交（分支 `personal-ai-chat`）

| 端 | 提交 |
|----|------|
| desktop | `126d78d6`（合并列表 MsgPersonalAiRow + 保留字段）· `0b648606`（样式）· `ff400773`（详情）· `8444e7c3` · `2cb02be3`；旁路回执 `a9bb3136`；`personal-ai-chat` HEAD `4218fae4`；列表实时昵称 `a4371382`；登录补拉角标 `a10650b4`（`feat/personal-ai-list-realtime-nickname`，待合入 `personal-ai-chat`） |
| android | `37a06f9ce`（合并保留字段 + CombineAdapter badge + ActionCard/引用还原）· `cc79be12c`（右对齐 + pill 顺序）· `02cef0fdc`（来源）· `fe6d1687f`（详情）· `6ecb5ae92`（定时图标） |
| ios | `9f18faced`（合并详情隐藏「x条回复」）· `e88ac08cb`（合并保留字段 + 读 baseExtra/extra + 打包 parseMsgExtra + senderUserId + 昵称拉取刷新）· `1193d3595`（反序）· `80d7870db`（详情+图标）· `5f3167a13`（来源）；列表实时昵称 `a68a68261`（`feat/personal-ai-list-realtime-nickname`，已与 `origin` 同步；待合入 `personal-ai-chat`）；逐条抹 badge（含 ActionCard）本地未 commit |

## 待办 / 阻塞

- (旁路 · web · 选择AI框) ✅ 组织架构 HTTP 直调 + 智能体名补齐 + 隐藏本人 + 人员行对齐 AiBoxRow：已 push `personal-ai-chat` `2962c88` / `a272701`（见 `20260707-选择AI框`）。
- (旁路 · web · 选择AI框) ✅ OrgPicker 隐藏本人：`imAccount`（缺省 `accountId`）=== 登录人 id 不展示。
- (旁路 · web · 选择AI框) ✅ OrgPicker 人员行对齐 AiBoxRow：人头像 40px + 姓名/智能体双行（`avatar` 只用通讯录，不用 agentAvatar）。
- (旁路 · web · 选择AI框) ✅ 组织架构人员副标题：对齐 `getAllImDialogue` 的 `agentName`（会话缓存按 accountId 合并，缺口 `batchGetAgent`）；通讯录不再用人名冒充。
- (旁路 · web · 选择AI框) ✅ 组织架构改 HTTP 直调 `getContract`/`sub_dept_user_pagelist`（不经 PC 桥；desktop handler 保留）；见 `20260707-选择AI框`。
- (旁路 · web/desktop · 选择数据范围) ✅ 外联群子 tab key `outreach`；**列表：人头像 + 群拼图、不展示智能体名**；**私聊 leave=1 后缀「（已离职）」**（本地未 commit，见 `20260729-4端重选择构数据来源弹窗`）。
- (旁路 · web · 选择AI框) ✅ 群头像拼图 + 默认全部 tab + 停用 batchGetAgent + **不过滤无 agentId** + 人头像 privateInfo + 侧栏 focus 拉 getAllImDialogue 本地搜；**私聊 leave=1 后缀「（已离职）」**；未 commit（见 `20260707-选择AI框`）。
- (旁路 · web · 选择AI框) ✅ FloatingDock 收起态黄角标 + 移动端顶栏总角标：已 push `personal-ai-chat` `9796bca`（见 `20260707-选择AI框`）。
- (旁路 · web · FloatingDock 新对话) ✅ Dock「开启新对话」偶发无反应：根因同 AI 框再点把 `chatReady=false` 且不重挂载，`bumpNewChat` 空等 ready；已改为直调 `Home.startNewChat`（对齐 History），同 agent 再选 early-return。已 push `personal-ai-chat` `343757c`。
- (desktop) ⏳ 手测 badge + 合并聊天记录内仍有来源/详情 badge；逐条发出后无 badge。另：手测 `parseName` 实时名；`a4371382` 已在 `origin/feat/personal-ai-list-realtime-nickname`，**待合入** `personal-ai-chat`。工作区脏文件仅为本地调试（`.env.test` / `electron-builder.yml` / `package.json`），**不入库**。
- (旁路 · desktop · 角标) ✅ `main.vue` mounted 登录后调 `PollingPersonalAiBadge.setupPolling()` → `getBadgePushInfo`（无 sessionIds，只刷壳角标不推 iframe）；`a10650b4` @ `feat/personal-ai-list-realtime-nickname`。
- (android) ⏳ 真机：会话 badge + 合并详情「来自群AI框」（ActionCard）；须**重新合并转发**（`37a06f9ce` 已 push）。列表昵称是否已取实时资料待对齐确认。
- (ios) ⏳ 真机：会话 badge + 合并详情 badge；须用含 `e88ac08cb` 的包**重新合并转发**后再打开（旧 OSS 无字段）。另：手测 `getSenderNickName` 实时名；`a68a68261` 已在 `origin/feat/personal-ai-list-realtime-nickname`，**待合入** `personal-ai-chat`。
- (ios) 🚧 逐条转发漏抹 badge：原 `convertModelByOriginModel` 只处理 Text/Reply，ActionCard（群 AI）原样带出 `fixTaskMessage` 等，其它端会显示来源 pill。已本地修：非文本 `createMessageByContent` 复制后走 `getForwardExtraByMsgExtra`；dict extra 也只留 richList。待 commit/push + 真机确认「逐条发出后无 badge」。
- (ios) ✅ 合并详情误显「x条回复」：`isCombine` 时 attach 不查本地回复扩展、高度也不计入；已 push `9f18faced` @ `personal-ai-chat`。
- (全端) ⏳ 联调确认后端 `extra.fixTaskMessage` 为数字 `1`；`dealForExtraInfo` 字段形态与文档一致。
- 2026-07-31 个人/群 AI 消息列表昵称：**优先实时资料**（iOS `groupAgentRels` / 群 `ZXAIAgentModel`；PC `AiAgentAccountInfoMap`），消息体 `user.name` 仅兜底；改名后历史消息同步更新。
- (旁路 · web · 角标误清) ✅ 激活刷记忆改 `getAgentDataRange`；`aiBoxCheckVersion` 激活 300ms 去重（见 `20260729-pc不可见推送延后与记忆刷新`）；桌面 sider 强切仍待改。
- 2026-07-31 本回合：iOS 合并详情隐藏「x条回复」。
- (旁路 · web · 选择数据来源) ✅ 全选卡顿：虚拟列表 + shallowRef + 去掉 mapRowItem 每帧浅拷贝 + 已选 chip 懒渲染（本地未 commit，见 `20260729-4端重选择构数据来源弹窗`）。

## 关键决策记录

- 2026-07-30 只改 badge，不改 identity tag
- 2026-07-30 门闩：`content.extra.fixTaskMessage === 1`（严格数字）
- 2026-07-30 个人：`来自{nick}个人AI框`；群：`来自群AI框`
- 2026-07-30 布局：气泡 → 表情 → N条回复 → badge（`ui-mock.html`）
- 2026-07-30 各端现有个人 badge 挂载点扩展，不做独立组件大迁
- 2026-07-30 PC badge 与上方内容间距 `mt-1.5`（6px），略紧于气泡与表情区
- 2026-07-30 PC：群聊已读回执请求仅当 @所有人或 atUserList 含真人；仅 robot_/ga_ 不请求（对齐 iOS）
- 2026-07-30 PC：自己个人 AI 定时消息详情 pill = 触发名 + 循环时间
- 2026-07-30 安卓 / iOS：详情 pill **仅循环时间**，不展示 `agentSetAbilityTriggerName`；双 pill 并排；他人/群不展示详情
- 2026-07-30 安卓 / iOS：详情 pill 左侧加定时图标 12px，与文案间距 4px（`ic_personal_ai_schedule` / `icon_personal_ai_schedule`）
- 2026-07-30 PC `0b648606`：详情 pill 加 `timing` 图标；自己消息 `flex-row-reverse`（视觉 **详情|来源**，来源贴右）；pill 间距 `gap-2`（8px）。安卓/iOS 同步反序与 8 间距；文案仍仅循环时间
- 2026-07-30 **转发**（对齐 PC `126d78d6`）：逐条抹掉 badge 字段；合并 OSS 保留字段，且**合并聊天记录列表**渲染 badge。安卓写 `extra`+`baseExtra`；读侧 `baseExtra` 优先、`extra` 兜底；`extra` 为对象时转字符串勿清空
- 2026-07-31 个人 AI 列表昵称与群 AI 一致：取最新资料，不冻结消息体 name
- 2026-07-31 合并聊天记录详情不展示「N条回复」（对齐安卓 CombineAdapter / PC 合并列表；iOS `isCombine` 短路）

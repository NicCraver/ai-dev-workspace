# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-08-05（修：转发勿污染原消息；iOS 新建 model / 安卓合并不 setExtra）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 个人 badge + `fixTaskMessage===1` 门闩 · plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 群 AI badge「来自群AI框」· plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 自己消息详情 badge | — | ✅ 仅循环时间 + 反序对齐 PC（`cc79be12c`） | ✅ 仅循环时间 + 反序对齐 PC | ✅ 触发名+循环时间（`ff400773`）+ 样式（`0b648606`） |
| 合并转发保留字段 + 合并详情列表 badge | — | ✅ `37a06f9ce`（待真机） | ✅ `e88ac08cb`（待真机·须重合并）；隐藏「x条回复」`9f18faced` | ✅ `126d78d6` |
| 逐条转发抹 badge（含 ActionCard） | — | 🚧 本地已修（ActionCard 白名单只留 richList + encode 拷贝；待 commit/push） | 🚧 本地已修（dict 只留 richList + 非文本复制后裁剪；待 commit/push） | ✅ 文本走 `getForwardExtraByMsgExtra`；ActionCard 单条仍不走该函数 |
| 个人/群 AI 列表昵称取实时资料 | — | ⬜ 待对齐 | ✅ `a68a68261`（`feat/personal-ai-list-realtime-nickname` 已推远端，待合入 `personal-ai-chat`） | ✅ `a4371382`（`feat/personal-ai-list-realtime-nickname` 已推远端，待合入 `personal-ai-chat`） |
| impl-notes 补全 · plan Task 4 | ✅（共用） | ✅ | ✅ | ✅ |
| 自测通过 | — | ⬜ 待真机 | ⬜ 待真机（须**重新合并转发**后再开聊天记录） | ⬜ 待手测 |

> web：本期不做。tag（昵称旁文案）未改；仅发送者展示名改为实时资料。

## 提交（分支 `personal-ai-chat`）

| 端 | 提交 |
|----|------|
| desktop | `126d78d6`（合并列表 MsgPersonalAiRow + 保留字段）· `0b648606`（样式）· `ff400773`（详情）· `8444e7c3` · `2cb02be3`；旁路回执 `a9bb3136`；`personal-ai-chat` HEAD `4218fae4`；列表实时昵称 `a4371382`；登录补拉角标 `a10650b4`（`feat/personal-ai-list-realtime-nickname`，待合入 `personal-ai-chat`） |
| android | `37a06f9ce`（合并保留字段 + CombineAdapter badge + ActionCard/引用还原）· `cc79be12c`（右对齐 + pill 顺序）· `02cef0fdc`（来源）· `fe6d1687f`（详情）· `6ecb5ae92`（定时图标）；**逐条 ActionCard 白名单裁剪本地未 commit** |
| ios | `9f18faced`（合并详情隐藏「x条回复」）· `e88ac08cb`（合并保留字段 + 读 baseExtra/extra + 打包 parseMsgExtra + senderUserId + 昵称拉取刷新）· `1193d3595`（反序）· `80d7870db`（详情+图标）· `5f3167a13`（来源）；列表实时昵称 `a68a68261`（`feat/personal-ai-list-realtime-nickname`，已与 `origin` 同步；待合入 `personal-ai-chat`）；**逐条抹 badge（含 ActionCard）本地未 commit** |

## 待办 / 阻塞

- (android / ios) 🚧 逐条转发 extra 白名单对齐 PC（只留 `richList`）+ **禁止污染原消息**（iOS 新建 model；安卓合并打包不 `setExtra` 原 content）：代码已改，**待 commit/push + 真机**
- (desktop) ⏳ 手测 badge + 合并聊天记录内仍有来源/详情 badge；逐条文本发出后无 badge。另：PC ActionCard 单条仍不走 `getForwardExtraByMsgExtra`（与移动端本次收紧不一致，若产品要求三端 ActionCard 也抹，需另改 PC）
- (android) ⏳ 真机：会话 badge + 合并详情「来自群AI框」（ActionCard）；须**重新合并转发**（`37a06f9ce` 已 push）
- (ios) ⏳ 真机：会话 badge + 合并详情 badge；须用含 `e88ac08cb` 的包**重新合并转发**后再打开（旧 OSS 无字段）
- (ios) ✅ 合并详情误显「x条回复」：已 push `9f18faced`
- (全端) ⏳ 联调确认后端 `extra.fixTaskMessage` 为数字 `1`

## 关键决策记录

- 2026-07-30 只改 badge，不改 identity tag
- 2026-07-30 门闩：`content.extra.fixTaskMessage === 1`（严格数字）
- 2026-07-30 个人：`来自{nick}个人AI框`；群：`来自群AI框`
- 2026-07-30 **转发**：逐条抹掉 badge 字段；合并 OSS 保留字段，且合并聊天记录列表渲染 badge
- 2026-08-05 **逐条 extra 裁剪对齐 PC**：白名单只保留 `richList`（格式）；抹掉 `@`、AI 来源字段及其它任意键。无 `richList` → extra 清空。iOS/安卓 ActionCard 逐条亦走同一白名单；合并路径仍保留三字段
- 2026-07-31 合并聊天记录详情不展示「N条回复」

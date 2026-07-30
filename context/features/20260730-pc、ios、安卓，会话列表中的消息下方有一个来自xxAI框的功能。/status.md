# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-07-30（PC 合并转发已 push；安卓/iOS 合并转发仍本地未 commit）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 个人 badge + `fixTaskMessage===1` 门闩 · plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 群 AI badge「来自群AI框」· plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 自己消息详情 badge | — | ✅ 仅循环时间 + 反序对齐 PC（`cc79be12c`） | ✅ 仅循环时间 + 反序对齐 PC | ✅ 触发名+循环时间（`ff400773`）+ 样式（`0b648606`） |
| 合并转发保留 badge 字段 / 逐条抹掉 | — | 🚧 本地未 commit | 🚧 本地未 commit | ✅ 已 push（`126d78d6`） |
| impl-notes 补全 · plan Task 4 | ✅（共用） | ✅ | ✅ | ✅ |
| 自测通过 | — | ⬜ 待真机 | ⬜ 待真机 | ⬜ 待手测 |

> web：本期不做。tag（昵称旁）未改。

## 提交（分支 `personal-ai-chat`）

| 端 | 提交 |
|----|------|
| desktop | `126d78d6`（合并转发保留 badge + 列表展示来源标记）· `0b648606`（样式：定时图标 + 自己消息反序 + 间距）· `ff400773`（详情 badge）· `8444e7c3`（间距）· `2cb02be3`（功能）；旁路回执门闩已在 `a9bb3136` |
| android | `cc79be12c`（右对齐 + pill 顺序）· `02cef0fdc`（来源）· `fe6d1687f`（详情）· `6ecb5ae92`（定时图标）；**本地未 commit**：**合并转发保留 badge 字段** |
| ios | `5f3167a13`（来源）· `80d7870db`（详情+图标）· `1193d3595`（反序 + 间距 8）；**本地未 commit**：**合并转发保留 badge 字段** |

## 待办 / 阻塞

- (旁路 · web · 选择AI框) ⏳ 群头像拼图 + 默认全部 tab + 停用 batchGetAgent + 人头像 privateInfo + 侧栏 focus 拉 getAllImDialogue 本地搜；未 commit（见 `20260707-选择AI框`）。
- (desktop) ⏳ 手测 badge：个人/群 × 定时/非定时；`"1"` 不显示；tag 不变；自己消息右侧详情 badge；**合并转发打开聊天记录仍有 badge、逐条无**。
- (android) ⏳ 真机：来源/详情 badge + 合并转发打开聊天记录仍有 badge；逐条转发无 badge。合并转发改动待 commit / push。
- (ios) ⏳ 真机：同上（合并有 / 逐条无）。合并转发改动待 commit / push。
- (全端) ⏳ 联调确认后端 `extra.fixTaskMessage` 为数字 `1`；`dealForExtraInfo` 字段形态与文档一致。

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
- 2026-07-30 **转发**：逐条（含单条长按）继续抹掉 badge 字段（仅留 richList）；**合并转发** OSS txt 内保留 `fixTaskMessage` / `personalAccountId` / `dealForExtraInfo`（+ richList）；PC 已 push（`126d78d6`），安卓/iOS 本地未 commit

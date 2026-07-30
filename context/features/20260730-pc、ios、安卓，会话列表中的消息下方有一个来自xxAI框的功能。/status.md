# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-07-30（安卓/iOS 详情 badge 已实现，未 commit / 未真机）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 个人 badge + `fixTaskMessage===1` 门闩 · plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 群 AI badge「来自群AI框」· plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 自己消息详情 badge（触发名+循环时间） | — | 🚧 代码已写未 commit | 🚧 代码已写未 commit | ✅ 已 push（`ff400773`） |
| impl-notes 补全 · plan Task 4 | ✅（共用） | ✅ | ✅ | ✅ |
| 自测通过 | — | ⬜ 待真机 | ⬜ 待真机 | ⬜ 待手测 |

> web：本期不做。tag（昵称旁）未改。

## 提交（分支 `personal-ai-chat`）

| 端 | 提交 |
|----|------|
| desktop | `ff400773`（详情 badge）· `8444e7c3`（间距）· `2cb02be3`（功能）；旁路回执门闩 **未 commit**（`messageService` / `storeModule` / `msg-list`） |
| android | `02cef0fdc`（来源）；详情 badge **未 commit** |
| ios | `5f3167a13`（来源）；详情 badge **未 commit** |

## 待办 / 阻塞

- (desktop) ⏳ 手测 badge：个人/群 × 定时/非定时；`"1"` 不显示；tag 不变；自己消息右侧详情 badge（触发名+循环时间）。
- (desktop) ⏳ 旁路：仅 @ 群/个人智能体（`ga_`）不发群已读回执请求（对齐 iOS）；另含进会话跳过 `ga_`/`robot_` 发件人回执风暴。代码已改未 commit / 未手测。@ 真人、@所有人应仍发回执。
- (android / ios) ⏳ 真机：来源 badge + 自己消息详情双 pill（触发名+循环时间）；他人/群仅来源。
- (android / ios) ⏳ commit + push `personal-ai-chat`。
- (全端) ⏳ 联调确认后端 `extra.fixTaskMessage` 为数字 `1`；`dealForExtraInfo` 字段形态与文档一致。

## 关键决策记录

- 2026-07-30 只改 badge，不改 identity tag
- 2026-07-30 门闩：`content.extra.fixTaskMessage === 1`（严格数字）
- 2026-07-30 个人：`来自{nick}个人AI框`；群：`来自群AI框`
- 2026-07-30 布局：气泡 → 表情 → N条回复 → badge（`ui-mock.html`）
- 2026-07-30 各端现有个人 badge 挂载点扩展，不做独立组件大迁
- 2026-07-30 PC badge 与上方内容间距 `mt-1.5`（6px），略紧于气泡与表情区
- 2026-07-30 PC：群聊已读回执请求仅当 @所有人或 atUserList 含真人；仅 robot_/ga_ 不请求（对齐 iOS）
- 2026-07-30 PC / 安卓 / iOS：自己的个人 AI 定时消息，来源 badge 右侧再展示独立详情 pill「触发名 + 循环时间」（读 `extra.dealForExtraInfo`）；他人/群不展示；双 pill 并排

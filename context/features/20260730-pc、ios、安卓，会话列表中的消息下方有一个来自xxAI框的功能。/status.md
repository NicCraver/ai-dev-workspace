# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-08-06（PC 多选转发三坑修复：空列表 / 引用误判不存在 / 保留 Reference）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 个人 badge + `fixTaskMessage===1` 门闩 · plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 群 AI badge「来自群AI框」· plan Task 1/2/3 | — | ✅ 已 push | ✅ 已 push | ✅ 已 push |
| 自己消息详情 badge | — | ✅ 仅循环时间 + 反序对齐 PC（`cc79be12c`） | ✅ 仅循环时间 + 反序对齐 PC | ✅ 触发名+循环时间（`ff400773`）+ 样式（`0b648606`） |
| 合并转发保留字段 + 合并详情列表 badge | — | ✅ `37a06f9ce`（待真机） | ✅ `e88ac08cb`（待真机·须重合并）；隐藏「x条回复」`9f18faced` | ✅ `126d78d6` |
| 合并详情个人 AI 框名/头像 +「个人AI框」tag | — | ✅ 已 push `a026626b2` | ✅ 已 push `26466f949` | ✅ 已 push `419d5b9d` |
| 逐条转发抹 badge（含 ActionCard） | — | 🚧 本地已修（待 commit/push） | 🚧 本地已修（待 commit/push） | ✅ 文本走白名单；ActionCard 单条仍不走 |
| 个人/群 AI 列表昵称取实时资料 | — | ⬜ 待对齐 | ✅ `a68a68261` | ✅ `a4371382` |
| PC 多选转发：选中不丢 / 引用展示 / string extra | — | — | — | 🚧 本地已修（待 commit/push / 真机） |
| impl-notes 补全 · plan Task 4 | ✅（共用） | ✅ | ✅ | ✅ |
| 自测通过 | — | ⬜ 待真机 | ⬜ 待真机 | ⬜ 待手测 |

> web：本期不做。

## 待办 / 阻塞

- (desktop) ⏳ **多选转发三坑**本地已修：①`selectMessage` 无 `emojiContent` 抛错→列表空仍报「请至少选择一项」②转发后引用靠 `referMsgUid` 查当前会话误显示「撤回或不存在」③保留 `ReferenceMessage`；`packmysend` 兼容 string `extra`。**待 commit/push + 真机**
- (desktop / android / ios) ⏳ 合并详情个人 AI 名头像 tag：已 push hotfix，**待真机**（须重新合并转发）
- (android / ios) ⏳ 逐条转发 extra 白名单 + 不污染：已 push，**待真机**
- (desktop) ⏳ ActionCard 单条仍不走 `getForwardExtraByMsgExtra`（若产品要求三端一致需另改）
- (全端) ⏳ 联调确认后端 `extra.fixTaskMessage` 为数字 `1`

## 关键决策记录

- 2026-08-06：(desktop) 多选转发修复——非筛选条引入；`selectMessage` 兜底缺省 `emojiContent`；转发剥离 `referMsgUid` + 读侧仅「会话内已撤回」才隐藏；保留 `ReferenceMessage`；`packmysend` 先 parse string `extra`

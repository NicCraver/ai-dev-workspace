# Status：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-07-30｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| 个人 badge + `fixTaskMessage===1` 门闩 · plan Task 1/2/3 | — | ⬜ | ⬜ | ⬜ |
| 群 AI badge「来自群AI框」· plan Task 1/2/3 | — | ⬜ | ⬜ | ⬜ |
| impl-notes 补全 · plan Task 4 | ⬜（共用） | ⬜ | ⬜ | ⬜ |
| 自测通过 | — | ⬜ | ⬜ | ⬜ |

> web：本期不做（消息列表在原生 / desktop）。  
> tag（昵称旁「个人AI框/群AI框」）本期不改。

## 待办 / 阻塞

- (全端) ⏳ 按 plan 实现桌面 / Android / iOS。
- (全端) ⏳ 手测 / 真机：个人+群 × 定时/非定时 × tag 不变。
- (全端) ⏳ 需后端/联调消息带数字型 `extra.fixTaskMessage`（字符串 `"1"` 故意不认）。

## 关键决策记录

- 2026-07-30 只改 badge，不改 identity tag
- 2026-07-30 门闩：`content.extra.fixTaskMessage === 1`（严格数字）
- 2026-07-30 个人：`来自{nick}个人AI框`；群：`来自群AI框`
- 2026-07-30 布局：气泡 → 表情 → N条回复 → badge（`ui-mock.html` 已确认）
- 2026-07-30 方案：各端现有个人 badge 挂载点扩展，不做独立组件大迁

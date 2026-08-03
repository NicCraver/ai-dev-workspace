# Status：选择数据范围 · 群拼图无头像用名字末字

> 最后更新：2026-08-03（spec/plan 已就绪，待编码）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| T1 Desktop 归一化 groupMembers | — | — | — | ⬜ |
| T2 Desktop 拼图组件 + 列表/搜索/chip | — | — | — | ⬜ |
| T3 Android 归一化 groupMembers | — | ⬜ | — | — |
| T4 Android Helper 末字拼图 + 接线 | — | ⬜ | — | — |
| T5 impl-notes + 手测验收 | — | ⬜ | — | ⬜ |
| 自测通过 | — | ⬜ | — | ⬜ |

> Web 已有 `AcGroupAvatar`→`AcAvatar` 末字能力，本期不改。iOS 本期不做。缺右下空位底色四端差异本期不动。

## 待办 / 阻塞

- (desktop) ⏳ 按 plan T1–T2 实现并手测三路径
- (android) ⏳ 按 plan T3–T4 实现并手测三路径
- (全端) 空位底色对齐：明确不做

## 关键决策记录

- 2026-08-03 范围：仅 Desktop + Android；名字仅 `accountInfoList.nickName`
- 2026-08-03 覆盖：主列表 + 搜索 + 底栏已选 chip
- 2026-08-03 方案：归一化 `groupMembers` 对象驱动渲染（对齐 Web）
- 2026-08-03 缺右下空位底色（`#f3f3f3` / 白 / 透出）本期不动

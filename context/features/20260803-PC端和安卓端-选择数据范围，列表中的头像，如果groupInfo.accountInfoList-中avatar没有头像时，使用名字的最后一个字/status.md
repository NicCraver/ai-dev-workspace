# Status：选择数据范围 · 群拼图无头像用名字末字

> 最后更新：2026-08-03（Desktop + Android：归一化 `groupMembers` + 末字拼图代码/单测已就位，均待真机手测）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan / status 初始化 | ✅（共用） | ✅（共用） | ✅（共用） | ✅（共用） |
| T1 Desktop 归一化 groupMembers | — | — | — | ✅ |
| T2 Desktop 拼图组件 + 列表/搜索/chip | — | — | — | 🚧 代码+单测已完成，待手测 |
| T3 Android 归一化 groupMembers | — | ✅ | — | — |
| T4 Android Helper 末字拼图 + 接线 | — | 🚧 代码+单测已完成，待手测 | — | — |
| T5 impl-notes + 手测验收 | — | 🚧 impl-notes 已写；手测待做 | — | 🚧 impl-notes 已写；手测待做 |
| 自测通过 | — | ⬜ 待真机 | — | ⬜ 待真机 |

> Web 已有末字能力，本期不改。iOS 本期不做。缺右下空位底色不动。

## 待办 / 阻塞

- (desktop) ⏳ 手测：无 avatar 有 nickName → 末字；搜索 / chip 同
- (android) ⏳ 重装后手测列表 / 搜索 / 已选弹层：空头像格应显示末字，不再灰默认图
- (全端) 空位底色对齐：明确不做

## 关键决策记录

- 2026-08-03 范围：仅 Desktop + Android；名字仅 `accountInfoList.nickName`
- 2026-08-03 覆盖：主列表 + 搜索 + 底栏已选 chip
- 2026-08-03 方案：归一化 `groupMembers` 对象驱动渲染
- 2026-08-03 Android：去掉 `collectNonEmptyUrls` 跳过空 URL；空格用 `ImageUtils.createNameImage` 画末字
- 2026-08-03 Desktop：新增群拼图组件，按 `groupMembers` 单格：图 → 末字 → 默认人像
- 2026-08-03 缺右下空位底色本期不动

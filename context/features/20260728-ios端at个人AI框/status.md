# Status：ios端at个人AI框

> 最后更新：2026-07-28 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | — | — | ⬜ | — |
| 接口联调 | — | — | ⬜ | — |
| 自测通过 | — | — | ⬜ | — |

> 本期范围仅 iOS；web/android/desktop 不在本功能迭代。PC 能力见 `20260727-at个人AI框-先做pc端`。

## 待办 / 阻塞
- (ios) **规格 + 计划已就绪**，可按 `plan.md` Task 1–9 开工
- (ios) ⚠️ 本期会动群智能体路径（`agentKind` 分流、`aiRobtChat` 补 `agentId`、胶囊「类型+N」），改完须回归群智能体主流程并告知测试
- (ios) DataScope 复用现有 `ZXPersonalAiPickerController`（与 web bridge 同源），勿重写 Picker

## 关键决策记录
- 2026-07-28 产品目标与 PC 一致：群聊支持 `@个人AI框`；产品规则整表继承 PC spec
- 2026-07-28 实现路径：独立个人 AI 筛选条 + `agentKind` 分流（不与 `ZXAIAgentFilterBar` 共用实例）
- 2026-07-28 个人 `agentId`：`group/get` → `groupAgentRels[]` 中 `accountId === 当前登录人` 的对象
- 2026-07-28 DataScope：直接 present `ZXPersonalAiPickerController`（`SelectDataRange`），不经 bridge
- 2026-07-28 共享判断对齐 PC：不能只靠 `ga_`；群行为不变、按 `agentKind` 分支
- 2026-07-28 `plan.md` 已产出（Task 1–9），进入实现环节

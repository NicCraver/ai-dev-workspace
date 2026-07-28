# Status：ios端at个人AI框

> 最后更新：2026-07-28（本回合 android 改动属 `20260707-选择AI框` 选择壳对齐，非本功能）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | — | — | 🚧 | — |
| 接口联调 | — | — | ⬜ | — |
| 自测通过 | — | — | ⬜ | — |

> 本期范围仅 iOS；web/android/desktop 不在本功能迭代。PC 能力见 `20260727-at个人AI框-先做pc端`。

## 待办 / 阻塞

- (ios) **已开工**：仅新增未跟踪头文件 `ZXPersonalAiFilterBar.h`（接口声明）；**无** `.m`、未入 Xcode target、未接线
- (ios) **按 `plan.md` 推进**：Task 1 模型（`agentKind` + `groupAgentRels`）仍未做 → 再 Task 2–9
- (ios) ⚠️ 本期会动群智能体路径，改完须回归群智能体主流程并告知测试
- (ios) DataScope 复用现有 `ZXPersonalAiPickerController`，勿重写 Picker
- (android) 本回合 `personal_ai_select` Contact/OrgDrill 改动 → 记在 **`20260707-选择AI框`**，非本功能进展
- (desktop) 本地打包改动不属于本功能；勿提交

## 关键决策记录
- 2026-07-28 产品目标与 PC 一致：群聊支持 `@个人AI框`；产品规则整表继承 PC spec
- 2026-07-28 实现路径：独立个人 AI 筛选条 + `agentKind` 分流（不与 `ZXAIAgentFilterBar` 共用实例）
- 2026-07-28 个人 `agentId`：`group/get` → `groupAgentRels[]` 中 `accountId === 当前登录人` 的对象
- 2026-07-28 DataScope：直接 present `ZXPersonalAiPickerController`（`SelectDataRange`），不经 bridge
- 2026-07-28 共享判断对齐 PC：不能只靠 `ga_`；群行为不变、按 `agentKind` 分支
- 2026-07-28 `plan.md` 已产出（Task 1–9），进入实现环节

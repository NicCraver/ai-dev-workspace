# Status：ios端at个人AI框

> 最后更新：2026-07-28（ios：仅落地 `ZXPersonalAiFilterBar.h` 桩，Task 1–9 未完成）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | — | — | 🚧 | — |
| 接口联调 | — | — | ⬜ | — |
| 自测通过 | — | — | ⬜ | — |

> 本期范围仅 iOS；web/android/desktop 不在本功能迭代。PC 能力见 `20260727-at个人AI框-先做pc端`。

## 待办 / 阻塞

- (ios) **已开工**：仅新增未跟踪头文件 `ZXPersonalAiFilterBar.h`（接口声明：知识类型 / DataScope / 时间 / 联网回调）；**无** `.m`、未入 Xcode target、未接线工具栏
- (ios) **按 `plan.md` 推进**：Task 1 模型（`agentKind` + `groupAgentRels`）仍未做 → 再 Task 2–9（@列表 / 筛选条实现与挂载 / 发送旁路 / 胶囊文案 / E2E）
- (ios) ⚠️ 本期会动群智能体路径（`agentKind` 分流、`aiRobtChat` 补 `agentId`、胶囊「类型+N」），改完须回归群智能体主流程并告知测试
- (ios) DataScope 复用现有 `ZXPersonalAiPickerController`（与 web bridge 同源），勿重写 Picker
- (desktop) 工作区有本地改动（`.env.test` / 打包配置 / `personal-ai-*-dialog` 等）——**不属于本功能**；勿当本迭代进展，打包配置仍勿提交

## 关键决策记录
- 2026-07-28 产品目标与 PC 一致：群聊支持 `@个人AI框`；产品规则整表继承 PC spec
- 2026-07-28 实现路径：独立个人 AI 筛选条 + `agentKind` 分流（不与 `ZXAIAgentFilterBar` 共用实例）
- 2026-07-28 个人 `agentId`：`group/get` → `groupAgentRels[]` 中 `accountId === 当前登录人` 的对象
- 2026-07-28 DataScope：直接 present `ZXPersonalAiPickerController`（`SelectDataRange`），不经 bridge
- 2026-07-28 共享判断对齐 PC：不能只靠 `ga_`；群行为不变、按 `agentKind` 分支
- 2026-07-28 `plan.md` 已产出（Task 1–9），进入实现环节

# Status：安卓端@个人AI框

> 最后更新：2026-07-28（spec/plan 已就绪，待开发）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | — | ⬜ | — | — |
| 接口联调 | — | ⬜ | — | — |
| 自测通过 | — | ⬜ | — | — |

> 本期范围仅 Android；web/ios/desktop 不在本功能迭代。PC 见 `20260727-at个人AI框-先做pc端`；iOS 见 `20260728-ios端at个人AI框`。
>
> Android 无独立 mock 阶段：计划直接接真实接口（对齐 iOS）。

## 计划任务（见 plan.md）

| # | 任务 | 状态 |
|---|------|------|
| 1 | 模型 agentKind + groupAgentRels | ⬜ |
| 2 | @ 列表注入个人 AI + 互斥 | ⬜ |
| 3 | 筛选条挂载 agentKind 分流 | ⬜ |
| 4 | PersonalAiFilterBar UI | ⬜ |
| 5 | 挂载 + get/save + SelectDataRange | ⬜ |
| 6 | aiRobtChat agentId + scopes | ⬜ |
| 7 | 群条胶囊「类型+N」 | ⬜ |
| 8 | 消息发送人回显 | ⬜ |
| 9 | E2E 与文档收尾 | ⬜ |

## 待办 / 阻塞

- (android) **开发未开始**：按 `plan.md` Task 1–9 推进
- (android) ⚠️ **群智能体回归**：本期改 `@` 列表与知识类型胶囊「类型+N」，完成后须回归并**告知测试**
- (android) DataScope：经 `CoreApiUtil` 调现有 `SelectDataRangeActivity`；勿推进「选择AI框」未提交扩展债
- (ios/desktop) 工作区其他脏树 **不属于本功能**；勿当成本期进展提交

## 关键决策记录

- 2026-07-28 产品目标与 PC/iOS 一致：群聊支持 `@个人AI框`；产品规则整表继承
- 2026-07-28 实现路径：独立个人 AI 筛选条 + `agentKind` 分流（不与 `GroupChatAgentDataCheckView` 共用实例）
- 2026-07-28 DataScope：直接经 `CoreApiUtil.selectDataRangeScope` 打开 `SelectDataRangeActivity`
- 2026-07-28 个人 `agentId`：`group/get` → `groupAgentRels[]` 中 `accountId === 当前登录人`
- 2026-07-28 共享判断对齐 PC/iOS：不能只靠 `ga_`；群行为不变、按 `agentKind` 分支
- 2026-07-28 `spec.md` / `plan.md` 已产出（Task 1–9），待实现

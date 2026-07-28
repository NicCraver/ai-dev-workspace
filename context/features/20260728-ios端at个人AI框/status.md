# Status：ios端at个人AI框

> 最后更新：2026-07-28（契约补 getAllImDialogue；iOS E2E 仍待手测；android/desktop 脏树非本期）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | — | — | ✅ | — |
| 接口联调 | — | — | 🚧 | — |
| 自测通过 | — | — | 🚧 | — |

> 本期范围仅 iOS；web/android/desktop 不在本功能迭代。PC 能力见 `20260727-at个人AI框-先做pc端`。
>
> iOS 无独立 mock 阶段：筛选条、Picker 接线、发送载荷等代码已落地，直接接真实接口。

## E2E 验收清单（待手测）

- [ ] 群聊 `@` 列表出现自己的个人 AI；他人个人 AI 不出
- [ ] `@` 个人 → 独立筛选条；DataScope 条件与 Picker 正常；改筛选会 save
- [ ] 发送后 AI 回复群内可见；请求含 `agentId` + `dataRangeScopeList`
- [ ] 回复消息后再 `@` 个人 AI，`referUuid` 有值
- [ ] 群智能体主流程回归：`@` → 改筛选 → 发送 → 回复；胶囊为「类型+N」
- [ ] 互斥：不能同时 `@` 群+个人；已有后再 `@` 不出智能体
- [ ] 取消/清空/发送成功立即藏条
- [ ] `xcodebuild` zhixinAppTest 通过

## 待办 / 阻塞

- (ios) **E2E 手测**：上表 8 项均未勾选，须逐条真机/模拟器验证并抓包确认 `aiRobtChat` 载荷
- (ios) ⚠️ **群智能体回归**：本期改动群 `@` 列表与 `ZXAIAgentFilterBar` 胶囊文案（「类型+N」），改完须回归群智能体主流程并**告知测试**
- (ios) ⚠️ **胶囊文案变更**：知识类型胶囊由「数据+N」→「类型+N」（群侧同步）；DataScope 仍「数据+N」——用户可感知，须单独验证
- (ios) 接口联调：代码已接真实 get/save/aiRobtChat，但 get 返显、save 落库、发送抓包尚未完成确认
- (ios) DataScope 复用现有 `ZXPersonalAiPickerController`，勿重写 Picker
- (contracts) 已新增 `POST /personalAiFrame/getAllImDialogue`（选会话/选智能体全量 IM 列表）；**非本功能 iOS @ 主路径**，Picker/选框若接入另记所属功能
- (android) 工作区仍有 `personal_ai_select`（Contact/OrgDrill 等）未提交改动 → 归属 **`20260707-选择AI框`**，**不推进本功能矩阵**
- (desktop) 工作区仍有打包/`.env`/DataScope 等本地改动 → **不属于本功能**；勿当成本期进展提交

## 关键决策记录

- 2026-07-28 产品目标与 PC 一致：群聊支持 `@个人AI框`；产品规则整表继承 PC spec
- 2026-07-28 实现路径：独立个人 AI 筛选条 + `agentKind` 分流（不与 `ZXAIAgentFilterBar` 共用实例）
- 2026-07-28 个人 `agentId`：`group/get` → `groupAgentRels[]` 中 `accountId === 当前登录人` 的对象
- 2026-07-28 DataScope：直接 present `ZXPersonalAiPickerController`（`SelectDataRange`），不经 bridge
- 2026-07-28 共享判断对齐 PC：不能只靠 `ga_`；群行为不变、按 `agentKind` 分支
- 2026-07-28 `plan.md` 已产出（Task 1–9），进入实现环节
- 2026-07-28 **Task 1–8 实现完成**（模型、`@` 列表、筛选条、get/save、发送、群侧胶囊、回显）；Task 9 文档同步，E2E 待手测
- 2026-07-28 契约补齐 `getAllImDialogue`；android/desktop 脏树与本期 iOS `@` 无关，矩阵不变

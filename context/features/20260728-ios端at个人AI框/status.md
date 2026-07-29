# Status：ios端at个人AI框

> 最后更新：2026-07-29（联调修包续·未提交：save 空列表门闩 + 条内状态回写 + 时间弹层 Right 对齐；E2E 仍待手测）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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

**消息列表 · 个人AI框展示（`plan-msg-personal-ai-tag`，代码已合，待手测）**

| # | 步骤 | 期望 |
|---|------|------|
| M1 | 含 `extra.personalAccountId` 的消息 | tag「个人AI框」；名/头像来自 `content.user` |
| M2 | 普通群 AI（无该字段） | tag「群AI框」；菜单仅 @回复 |
| M3 | 本人个人 AI 消息长按 | 仅 @回复 |
| M4 | 他人个人 AI 消息长按 | 仅回复（无 @回复） |

## 待办 / 阻塞

- (ios) **消息展示增量已合** `personal-ai-chat`：`ZXIMCellLogic` + `UIImageView+Avatar`；待上表 M1–M4 真机点验
- (ios) **E2E 手测**：上表 8 项均未勾选；须再抓包确认修包后 `aiRobtChat`/`saveDataRange` 的 `dataRangeList`（个人应为 3/4/1/2 透传，禁止空数组覆盖）
- (ios) ⚠️ **群智能体回归**：本期改动群 `@` 列表与 `ZXAIAgentFilterBar` 胶囊文案（「类型+N」），改完须回归群智能体主流程并**告知测试**
- (ios) ⚠️ **胶囊文案变更**：知识类型「类型+N」（无前置图标）；DataScope「数据+N」；联网仅图标；时间弹层右对齐——须单独验证
- (ios) 接口联调：已修 `aiRobtChat` 个人 `dataRangeList` 误压成 0/1/2、`saveDataRange` 空列表覆盖、个人 `@` 发送后 `atUserList` 漏写导致不高亮；仍待完整手测勾选
- (ios) **未提交脏树（工作区）**：`saveDataRange` 前从筛选条回写现场状态；`dataRangeList` 为空则跳过 save；个人路径 `dataRangeParamsFromPersonalList` 透传；类型胶囊「类型+N」/联网仅图标；时间弹层 Right 对齐（个人宽 225、群侧 245）——须装包后抓包确认再提交
- (ios) 筛选条 UI：时间弹层右对齐并右偏；个人时间宽 225、群智能体时间宽 245（「近一年」）
- (ios) DataScope 复用现有 `ZXPersonalAiPickerController`，勿重写 Picker
- (contracts) 已新增 `POST /personalAiFrame/getAllImDialogue`；**非本功能 iOS @ 主路径**
- (android/desktop) 工作区其他脏树 → 分属他功能 / 本地改动，**不推进本功能矩阵**
- (说明) 当前 ACTIVE 为 `20260729-4端重选择构数据来源弹窗`；本功能脏树勿记入该矩阵

## 关键决策记录

- 2026-07-28 **增量已实现**：消息 `extra.personalAccountId` →「个人AI框」+ `content.user` 名头像；本人只 @回复、他人只回复；群 AI 不变 —— `ZXIMCellLogic` / Avatar
- 2026-07-28 **增量**：消息 `extra.personalAccountId` →「个人AI框」+ `content.user` 名头像；本人只 @回复、他人只回复；群 AI 不变 —— 见 `plan-msg-personal-ai-tag.md`（对齐 PC）
- 2026-07-28 产品目标与 PC 一致：群聊支持 `@个人AI框`；产品规则整表继承 PC spec
- 2026-07-28 实现路径：独立个人 AI 筛选条 + `agentKind` 分流（不与 `ZXAIAgentFilterBar` 共用实例）
- 2026-07-28 个人 `agentId`：`group/get` → `groupAgentRels[]` 中 `accountId === 当前登录人` 的对象
- 2026-07-28 DataScope：直接 present `ZXPersonalAiPickerController`（`SelectDataRange`），不经 bridge
- 2026-07-28 共享判断对齐 PC：不能只靠 `ga_`；群行为不变、按 `agentKind` 分支
- 2026-07-28 `plan.md` 已产出（Task 1–9），进入实现环节
- 2026-07-28 **Task 1–8 实现完成**（模型、`@` 列表、筛选条、get/save、发送、群侧胶囊、回显）；Task 9 文档同步，E2E 待手测；**消息 tag/菜单增量另见 plan-msg**
- 2026-07-28 契约补齐 `getAllImDialogue`；android/desktop 脏树与本期 iOS `@` 无关，矩阵不变
- 2026-07-28 联调修包：个人 `aiRobtChat.dataRangeList` 须原样透传（含 3/4）；群侧仍补齐 0/1/2；`saveDataRange` 禁止用空 `dataRangeList` 覆盖；筛选条 UI 收敛为「类型+N / 数据+N / 时间 / 联网图标」
- 2026-07-29 联调修包续：个人 `@` 写入 `atUserList`（发后高亮）；时间弹层右对齐/右偏；个人时间宽 225、群智能体 245

# Status：at个人AI框-先做pc端

> 最后更新：2026-07-29 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | ⬜ | ⬜ | ⬜ | 🚧 |
| 接口联调 | ⬜ | ⬜ | ⬜ | 🚧 |
| 自测通过 | ⬜ | ⬜ | ⬜ | ⬜ |
| **@回复个人 AI 误走群**（spec 已知缺陷） | — | ✅ 已修 | ✅ 已修 | ✅ 已修 |

> desktop 说明：页面开发 🚧 = Task 1–8 + 消息个人AI框展示（`msg-list`，`8f2abbb5`/`f4a5121e`）已落地，待真机 E2E；接口联调 🚧 = get/save/aiRobtChat 已接线，待抓包验证；自测 ⬜ = 本 session 未跑 E2E。

## 待办 / 阻塞

### 人工 E2E（Task 9，desktop）

**个人 AI**

| # | 步骤 | 期望 |
|---|------|------|
| 1 | 群聊 `@` 列表 | 有个人 AI（自己的） |
| 2 | 选个人 AI | 出现个人筛选条；get 用 accountId+agentId |
| 3 | 改类型/时间/联网/DataScope | 每次 save 全量含 scope |
| 4 | 发送 | IM 成功后 aiRobtChat 含 agentId + scope |
| 5 | 回复 + `@` 个人 AI | referUuid 有值；回复群内可见 |
| 5b | **@回复本人个人 AI 消息** | **出个人筛选条**；aiRobtChat.agentId=个人（非群） |
| 6 | 再 `@` | 列表无智能体，可 `@人` |
| 7 | 删 `@` / 清空 / 发送后 | 条立即隐藏 |
| 8 | 草稿恢复 | 条再现 + 重新 get |

**消息列表 · 个人AI框展示（`plan-msg-personal-ai-tag`，代码已合）**

| # | 步骤 | 期望 |
|---|------|------|
| M1 | 含 `extra.personalAccountId` 的消息 | tag「个人AI框」；名/头像来自 `content.user` |
| M2 | 普通群 AI（无该字段） | tag「群AI框」；菜单仅 @回复 |
| M3 | 本人个人 AI 消息右键 | 仅 @回复 |
| M4 | 他人个人 AI 消息右键 | 仅回复（无 @回复） |

**群智能体回归（必做）**

| # | 步骤 | 期望 |
|---|------|------|
| G1 | `@` 群 / 工具栏 `@智能体` | 现网 AgentMemoryBar |
| G2 | 改筛选 → 发送 | AI 回复正常；aiRobtChat **现含 agentId** |
| G3 | 胶囊 | 「类型+N」 |
| G4 | 草稿含群 `@` | 条恢复；行为同改前 |
| G5 | **@回复群 AI 消息** | 仍走群条（修 5b 时回归） |

- (desktop/android/ios) ✅ **已修**：@回复本人个人 AI 写入 `agentKind=personal` + `agentId`（PC `buildReplyAtMention`；Android `fillReferAtAgentIdentity`；iOS `addReplyAtUser:`）。待真机复测 5b / G5。
- (desktop) ⚠️ **须告知测试**：本期动群智能体路径三处（共享判断分流、`aiRobtChat` 补 `agentId`、胶囊「类型+N」），上表 G1–G5 回归通过前勿签收
- (desktop) 抓包确认 get/save/aiRobtChat 入参后，可将接口联调升为 ✅
- (desktop) 消息展示增量代码已合 `personal-ai-chat`（`f4a5121e`），待上表 M1–M4 真机点验
- (desktop) 2026-07-28 修：`@` 列表智能体偶发成对重复（`initList` 并发 splice）→ 序号守卫 + 原子写回 + id|kind 去重；复测：切群后立刻 `@`，群/个人各只应出现一次

## 关键决策记录

- 2026-07-29 **@回复须带 agentKind**：本人个人 AI → `personal`+`agentId`；群 AI → `group`。三端均已修（PC/Android/iOS）——见 spec「已知缺陷」
- 2026-07-28 消息展示：`content.extra.personalAccountId` 有值 → 个人 AI 框；tag「个人AI框」；名/头像用 `content.user.name` / `portrait`；本人只出 @回复，他人只出回复；群 AI（无该字段）不变 —— 见 `plan-msg-personal-ai-tag.md`
- 2026-07-27 已有智能体 `@` 后再 `@`：列表**不显示**群/个人智能体；仍可 `@人`
- 2026-07-27 工具栏「@智能体」只插群智能体
- 2026-07-27 个人 AI 筛选对齐 FilterBar 普通模式；PC 新写 DataScope；勾 1/2/4 才出
- 2026-07-27 右键回复 + `@` 群智能体/个人 AI 均需支持（`referUuid`）
- 2026-07-27 `@` 群智能体路径零改动、不回归；个人 AI 逻辑隔离
- 2026-07-27 `groupAgentRels.accountId` 实测已返回；`groupAgentType` 群=3 / 个人=0
- 2026-07-27 个人 AI 筛选记忆逻辑对齐群智能体：显示时 get、变更时 save；群路径不动
- 2026-07-28 「群路径零改动」修正为「群路径**行为**不变」：现网只靠 `ga_` 前缀认智能体，个人 AI 同样是 `ga_`，共享判断点必须按 `agentKind` 分支（spec 已列 9 处改造点）
- 2026-07-28 `aiRobtChat.agentId` 群与个人**均必传**（群取 `agentMemoryAgentId`）；`aiRoleId` 两边仍传 `'1'`
- 2026-07-28 个人 AI 的回复群内其他人可见；与群 AI 框/AI 框分析不做互斥联动
- 2026-07-28 知识类型胶囊改「类型+N」（群侧同步），DataScope 胶囊保持「数据+N」；DataScope 选择无上限
- 2026-07-28 PC 为全新实现，web 只作 UI/选择交互参考，不移植其组件与判断逻辑
- 2026-07-28 DataScope 显示条件：PC 组件只在 @ 个人 AI 时挂载，故内部只判「勾选含 1/2/4」；web 的 `belongType===0` 是其共用组件所需，PC 不搬
- 2026-07-28 契约已存 `POST /v1/aiRobtChat`（`agentChatData` 旁路）；见 `context/contracts/personalAiFrame/aiRobtChat.d.ts`
- 2026-07-28 开项默认：取消/清空立即藏条；草稿只恢复可见性再 get；`groupAgentRels` 随 `initList`；get/save 失败仅打日志（见 plan Plan Defaults）
- 2026-07-28 `plan.md` 已产出（Task 1–9），进入实现环节

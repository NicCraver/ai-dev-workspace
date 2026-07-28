# Status：at个人AI框-先做pc端

> 最后更新：2026-07-28 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 页面开发（mock） | ⬜ | ⬜ | ⬜ | ⬜ |
| 接口联调 | ⬜ | ⬜ | ⬜ | ⬜ |
| 自测通过 | ⬜ | ⬜ | ⬜ | ⬜ |

## 待办 / 阻塞
- (desktop) 文档迭代中，暂不开发
- (desktop) 待补：草稿恢复是否带回筛选态；`groupAgentRels` 刷新时机；get/save 失败的错误路径
- (desktop) ⚠️ 本期会动群智能体路径三处（共享判断分流、`aiRobtChat` 补 `agentId`、胶囊文案改「类型+N」），改完须回归群智能体主流程并告知测试

## 关键决策记录
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

# Status：iOS 智能体正文与消息气泡字号对齐

> 最后更新：2026-08-04（代码已完成，待真机手测）｜图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan | — | — | ✅ | — |
| T1 `ZXIMCellLogic` 正文字典工厂 | — | — | ✅ | — |
| T2 `ZXIMAgentStreamReplyCell` 接线 | — | — | ✅ | — |
| T3 `ZXGroupRobotCell` 接线 | — | — | ✅ | — |
| T4 `ZXIMChatCell` 行高预估同步 | — | — | ✅ | — |
| 自测（默认/中/大档 + 折叠/流式） | — | — | ⬜ 待真机 | — |

> web / android / desktop 本期不做。

## 待办 / 阻塞

- (ios) ⏳ 真机/模拟器手测：默认档智能体正文与普通气泡并排对比；切换中/大字号档验证同步放大；折叠卡片与流式回复行高正常
- (ios) 本地 `xcodebuild` 编译通过，链接阶段有环境既有问题（融云模拟器 slice），与本次改动无关

## 关键决策记录

- 2026-08-04 目标：智能体正文 `Font(14)` → `FSC(kT)`，与普通气泡对齐
- 2026-08-04 范围：仅 iOS；非智能体群 robot 卡片仍 14pt
- 2026-08-04 方案：在 `ZXIMCellLogic` 集中提供 `agentMessageBodyTextAttributesWithColor:`，渲染与行高共用

# iOS 智能体正文字号对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 iOS 智能体卡片/流式 @回复正文从固定 14pt 改为 `FSC(kT)`，与普通文本气泡一致。

**Architecture:** 在 `ZXIMCellLogic` 集中提供 `agentMessageBodyTextAttributesWithColor:`，渲染 Cell 与 `ZXIMChatCell` 行高预估共用同一字典，避免高度漂移。

**Tech Stack:** Objective-C、UIKit、`ZXUiMacro`（`FSC`/`kT`）

## Global Constraints

- 仅 iOS；非智能体群 robot 卡片正文仍 `Font(14)`
- 辅助文案（引用区、按钮、知识来源）不改
- 行距 `lineSpacing = 6` 不变
- push 分支：`personal-ai-chat`（若提交 apps/ios）

---

### Task 1: 正文字典工厂（ios）

**Files:** `ZXIMCellLogic.h`、`ZXIMCellLogic.m`

- [ ] 声明 `+agentMessageBodyTextAttributesWithColor:`
- [ ] 实现：`FSC(kT)` + `lineSpacing=6` + 传入颜色

### Task 2: 流式 @回复 Cell（ios）

**Files:** `ZXIMAgentStreamReplyCell.m`

- [ ] `zx_markdownAttributes` 改用 Logic 工厂
- [ ] `contentLab.font` fallback 改为 `FSC(kT)`

### Task 3: 智能体卡片 Cell（ios）

**Files:** `ZXGroupRobotCell.m`

- [ ] `setModel` 智能体 Markdown attrs 改用工厂
- [ ] `zx_streamingTextAttributesForAgent:` 在 `isAgent` 时改用工厂
- [ ] `contentLab.font` fallback 改为 `FSC(kT)`

### Task 4: 行高预估（ios）

**Files:** `ZXIMChatCell.m`

- [ ] 机器人消息高度计算：`isAgent` 分支用工厂 attrs，非智能体仍 `Font(14)`

### Task 5: 文档与验证

- [ ] 更新 `status.md`
- [ ] context 仓库 commit
- [ ] apps/ios commit（业务源码）

**Test plan:** 默认/中/大字号档对比智能体与普通气泡；折叠/流式/非智能体 robot 回归。

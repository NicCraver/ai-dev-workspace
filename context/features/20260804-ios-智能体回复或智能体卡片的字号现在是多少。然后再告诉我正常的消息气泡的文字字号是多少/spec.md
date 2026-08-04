# Spec：iOS 智能体正文与消息气泡字号对齐

> 最后更新：2026-08-04

## 背景与目标

**现状**

| 场景 | 字号 | 是否跟随用户字号设置 |
|------|------|---------------------|
| 普通文本气泡（`ZXIMTextCell`） | `FSC(kT)`，基准 **16pt** | ✅ |
| 智能体卡片正文（`ZXGroupRobotCell`） | `Font(14)` 固定 **14pt** | ❌ |
| 智能体流式 @回复（`ZXIMAgentStreamReplyCell`） | `Font(14)` 固定 **14pt** | ❌ |

智能体正文比同会话普通消息小 2pt，且用户调大字号时不生效。

**目标**

将 iOS 端**智能体回复 / 智能体卡片**的正文 Markdown 字号，与普通文本气泡对齐为 `FSC(kT)`（默认 16pt，随用户字号档位缩放）。

**成功标准**

- 默认字号档位下，智能体正文与普通文本气泡视觉一致（16pt）。
- 切换「设置 → 字号」中/大档后，智能体正文同步放大（18pt / 26pt）。
- 列表行高、折叠/展开、流式打字机阶段高度计算与渲染一致，无截断或留白异常。

## 用户流程

无新交互。用户进入含智能体消息的会话，正文自动以新字号展示。

## 范围

### 本期做（ios）

- 智能体卡片（`ZXGroupRobotCell`，`senderUserId` 以 `ga_` 前缀）正文 Markdown
- 智能体流式 @回复（`ZXIMAgentStreamReplyCell`）正文 Markdown
- 上述场景在 `ZXIMChatCell` 中的**行高预估**同步改用 `FSC(kT)`

### 本期不做

| 项 | 说明 |
|----|------|
| web / android / desktop | 仅 iOS |
| 非智能体群机器人卡片正文 | 仍保持 `Font(14)` |
| @回复引用区、知识来源、卡片按钮、底部「聊天记录」等辅助文案 | 字号不变 |
| 「查看更多」按钮 | 保持 `FSC(14)` |
| 行距 `lineSpacing = 6` | 不变 |

## 方案对比

| 方案 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **A（推荐）** | 在 `ZXIMCellLogic` 新增 `+agentMessageBodyTextAttributesWithColor:`，渲染与行高统一引用 | 单一事实来源，高度计算不易漂移 | 需改 Logic + 3 个调用方 |
| B | 各 Cell 内直接把 `Font(14)` 替换为 `FSC(kT)` | 改动面小 | 4 处硬编码，后续易漏改 |
| C | 全局把 `kT` 改为 14 | 一行搞定 | 会误伤普通气泡，不可行 |

**推荐 A**：抽取智能体正文字典，与 `ZXIMTextCell` 使用同一宏体系 `FSC(kT)`。

## 实现要点

### 1. 新增属性工厂（`ZXIMCellLogic`）

```objc
+ (NSDictionary *)agentMessageBodyTextAttributesWithColor:(UIColor *)color;
```

返回：

- `NSFontAttributeName` → `FSC(kT)`（即 16pt 基准 + `SCALE_TEXT` 缩放）
- `NSParagraphStyleAttributeName` → `lineSpacing = 6`（与现网一致）
- `NSForegroundColorAttributeName` → 传入颜色（智能体 `Color_H1`，非智能体 robot 仍走原 `Font(14)` 分支，不改）

### 2. 调用方替换

| 文件 | 改动 |
|------|------|
| `ZXIMAgentStreamReplyCell.m` | `zx_markdownAttributes`、`contentLab.font` |
| `ZXGroupRobotCell.m` | `setModel` 内 Markdown attrs；`zx_streamingTextAttributesForAgent:` 在 `isAgent` 时；`contentLab.font`（仅作 fallback，以 attributedText 为准） |
| `ZXIMChatCell.m` | 机器人消息行高预估：`isAgent` 分支用 `FSC(kT)`，非智能体 robot 仍 `Font(14)` |

### 3. 行高一致性

`ZXIMChatCell` 中 `boundingRectWithSize:` 的 `attDic` 必须与 Cell 渲染使用同一字体，否则列表滚动时会出现高度跳动。智能体路径统一走 `agentMessageBodyTextAttributesWithColor:`。

### 4. 缓存失效

字号档位变更后，已有 `ZXIMAgentStreamReplyCell` 布局缓存（`kZXIMAgentStreamLayoutCacheKey`）可能过期。需在 `ZXFontSizeLogic` 设置字号或相关通知处触发列表 `reloadData`（若现网已有字号切换刷新逻辑则复用，无需新增）。

## 各端差异

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本期改动 | — | — | ✅ | — |

## 测试要点

1. **默认档**：智能体 @回复、智能体卡片正文与普通文本气泡并排对比，字号一致。
2. **中/大档**：设置里切换字号，智能体正文随普通消息同步放大。
3. **折叠卡片**：长内容「查看更多 / 收起」高度正常，无裁切。
4. **流式回复**：打字机过程中行高平滑增长，完成后与静态消息一致。
5. **非智能体 robot**：群机器人卡片（非 `ga_`）正文仍为 14pt，行为不变。

## 依赖

无接口变更，纯客户端 UI 调整。

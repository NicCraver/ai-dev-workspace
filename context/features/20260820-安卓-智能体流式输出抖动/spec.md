# Spec：安卓端 @智能体 / 个人AI框 流式输出抖动

## 场景

群里 @智能体、或个人 AI 框里提问，智能体回答**边出边显**（仿流式）时，
消息气泡里的文字与整个列表在滚动上表现为一顿一顿、忽快忽慢、来回跳。

## 载体（必须先说清，否则改错地方）

- 回答**进行中**：一条 `ReferenceMessage`（引用消息）当「流式座位」，
  `extra.fromType == 1` → `UIMessage.agentAnswerStreamSeat = true`，
  由 `ReferenceMessageItemProvider` 渲染。**本 feature 只管这一段。**
- 回答**结束**：座位消息被撤回，服务端另发一条 `ZX:ActionCardMsg`（AI 卡片，
  `ActionCardMessageItemProvider` + 段栈渲染）。卡片本身不流式，
  它的截断/折叠问题属 `20260820-安卓-markdown表格消息截断且无查看更多按钮`。
- 内容来源不是 SSE，是**轮询**：`AgentAnswerGetManager` 每 2s 拉一次**整篇**最新答案，
  发 `Event.AgentAnswerContent`；本地再把新增部分按 150ms / 每步 ≥10 字「假装」流式吐出来。

## 目标

1. 文字吐字匀速，不因为别的消息刷新/绑定而被打断或突然蹦一大段。
2. 列表跟随到底部要连续，不要走走停停。
3. 长回答后半段不掉帧（每帧不再整篇重新解析 markdown）。
4. 结构不在帧间跳变（半成品表格 / 未闭合粗体），此项上一轮已做，保留。

## 不做

- 不改后端轮询协议（不上 SSE）。
- 不改折叠上限 `maxHeightDP = 520`、不动 AI 卡片段栈那条链路。
- 不改「仿流式时长 1500ms / 最小步长 10 字」的手感参数。

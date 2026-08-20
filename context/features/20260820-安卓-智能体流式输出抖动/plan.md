# Plan：安卓端 @智能体 / 个人AI框 流式输出抖动

分支：`fix/md-table-fold-truncate`（沿用，未另开）

| Task | 内容 | 落点 |
|------|------|------|
| T1 | 打字机按 msgUid 独立排队，新内容只延长目标、不重排节拍 | 新增 `IM/dialogue/agent_stream/AgentStreamPlayer.java` |
| T2 | markdown 稳定前缀渲染 + 前缀结果缓存，Markwon 实例复用 | 新增 `IM/dialogue/agent_stream/AgentStreamMarkdownRenderer.java` |
| T3 | provider 接过 T1/T2，删掉全局 Handler / Runnable / `cancelStream()` | `IM/widge/provider/ReferenceMessageItemProvider.java` |
| T4 | holder 复用护栏：`ViewHolder.boundUid`、绑定时清高度地板 | 同上 |
| T5 | 跟随滚动改 `onPreDraw` + 瞬时 `scrollBy` | `IM/dialogue/ConversationFragment.java` |
| T6 | `./gradlew :IM:compileOnTestDebugJavaWithJavac` | — |
| T7 | 真机验收（见 status 待办四点） | 待你跑 |

不做：不上 SSE、不改手感参数、不动 AI 卡片段栈链路、不动 `maxHeightDP = 520`。

---
description: 用 codebase-memory MCP 检索代码结构（优先于 grep/大量读文件）
argument-hint: [端: web|android|ios|desktop] <搜索词或自然语言描述>
---

代码库检索任务。用户输入：$ARGUMENTS

**硬性要求**：本命令必须通过 **codebase-memory MCP** 完成检索，禁止用内置 Grep/Glob/Read 代替。只有 MCP 返回的 `qualified_name` 需要看源码时，才调用 `get_code_snippet`。

## 1. 解析参数

- 第一个词若是 `web` / `android` / `ios` / `desktop`，视为目标端，其余为搜索词。
- 否则搜索全部已索引项目（或根据上下文推断最相关的端）。

端 → 仓库路径映射（用于在 `list_projects` 结果中匹配 `root_path`）：

| 端 | 路径 |
|----|------|
| web | `apps/web/` |
| android | `apps/android/` |
| ios | `apps/ios/` |
| desktop | `apps/desktop/` |

先调用 `list_projects`，用 `root_path` 后缀匹配上表，得到 MCP 的 `project` 名。匹配不到时列出可用项目并请用户指定。

## 2. 选择工具

按意图选工具（可对同一 `project` 组合多次调用）：

| 意图 | 工具 | 典型参数 |
|------|------|----------|
| 找函数/类/路由定义、自然语言发现 | `search_graph` | `query`（BM25 全文）；或 `name_pattern`（正则）；或 `semantic_query`（**数组**，如 `["login","auth"]`） |
| 搜字符串/调用点/注释 | `search_code` | `pattern`；`mode: compact`（默认）或 `full`；`file_pattern` / `path_filter` 缩小范围 |
| 查调用链/影响面/数据流 | `trace_path` | `function_name`；`direction: inbound\|outbound\|both`；`mode: calls\|data_flow\|cross_service` |
| 看某符号源码 | `get_code_snippet` | 先用 `search_graph` 拿 `qualified_name`，再传入 |
| 架构概览 | `get_architecture` | `project` |
| 复杂图查询 | `query_graph` | Cypher；结果超限时加 `LIMIT` |

默认 `limit` 偏小（`search_code` 10、`search_graph` 200）。若响应含 `total_grep_matches`/`total_results` 或 `has_more` 表明截断，提高 `limit` 或收窄查询后重试。

## 3. 执行与输出

对每个命中的 `project` 执行检索，然后以结构化摘要回复：

1. **查询**：用了哪些工具、哪些 `project`、关键参数。
2. **结果**：按相关性列出符号（`qualified_name`、文件路径、一行摘要）。多条命中时合并去重。
3. **下一步**（可选）：若用户意图是改代码/排 bug，点出最相关的 1–3 个落点；需要源码时对 Top 命中调用 `get_code_snippet`。

若某端仓库未索引，明确告知用户需先对 `apps/<端>/` 执行 `index_repository`，不要退回到 Grep。

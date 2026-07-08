# context/ —— 唯一事实来源

| 内容 | 谁维护 | 更新频率 |
|------|--------|---------|
| `platforms/*.md` 各端一页纸约定 | AI（/distill 结晶）+ 人工修正 | 每周 |
| `bridge.md` JSBridge 协议 | 人工审核，AI 起草 | 协议变更时 |
| `contracts/` 接口契约 | /sync-contract 流程 | 接口变更时 |
| `features/` 迭代文档 | wrapup 技能自动维护 | 每次编码会话 |
| `dev-rules/` 端内开发规范（如 UnoCSS） | 人工维护 | 规范变更时 |

`dev-rules/` 中的 `.mdc` 通过 `.cursor/rules/` 符号链接接入 Cursor；`globs` 限定到对应 `apps/<端>/`，非该端文件不加载。

不放在这里的东西：会话过程记忆（claude-mem 负责）、代码结构索引（codebase-memory 负责）、代码本身（apps/ 各仓库负责）。

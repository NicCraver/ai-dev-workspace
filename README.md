# ai-dev-workspace

四端（web / android / ios / electron）多仓库协同的 AI 开发编排工作区。`context/` 存唯一事实文档，`apps/` 挂四个独立项目仓库，从本目录启动统一调度（Claude Code 与 Cursor 均支持）。

配套插件分工：Superpowers 负责 spec→plan→执行的工作流；claude-mem 负责跨会话过程记忆；codebase-memory 负责代码结构索引。本仓库只保留人需要审计的四类文档：spec、进度矩阵、实现笔记、接口契约。

## 首次安装

```bash
# 1. clone 本仓库后，把四个项目挂进 apps/（见 apps/README.md）
git clone <web仓库>     apps/web
git clone <android仓库> apps/android
git clone <ios仓库>     apps/ios
git clone <electron仓库> apps/desktop

# 2. 初始化（git init、hook 权限、打印插件安装指引）
bash scripts/bootstrap.sh

# 3. 按 bootstrap 打印的指引安装三个插件，并让 Claude 生成各端文档初稿
```

## 日常工作流（你只做 4 件事）


| 你说的话                           | 发生什么                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `/new-feature 语音消息`            | 建文档目录、设为活跃功能，Superpowers 开始 brainstorm，产出 spec.md 供你**审核**    |
| "开始执行"                         | Superpowers 写 plan（你**审核**）→ 执行 → wrapup 技能自动更新 status.md 并提交 |
| `/sync-contract 语音接口更新了，字段如下…` | 更新契约 → 分析四端影响面 → 待办进 status.md                                |
| `/port ios`                    | 按 impl-notes + 契约 + iOS 约定移植，完成后自动收尾                          |


其余全自动：每次会话开头 SessionStart hook 注入活跃功能状态；每次结束 Stop hook 检查"改了代码必须更新文档"，没更新会强制 Claude 补齐；每周跑一次 `/distill` 把 claude-mem 的碎片知识结晶回 `context/platforms/`。

## 目录说明

```
CLAUDE.md                  全局规则（路由、契约、移植、收尾）
.claude/                   Claude Code 配置（hooks / commands / skills）
.cursor/                   Cursor 配置（hooks / commands / skills / rules）
context/                   文档（见 context/README.md）
scripts/                   new-feature.sh / bootstrap.sh
apps/                      四个项目仓库挂载点（被 gitignore）
```

两套配置内容对齐：`.claude/commands/` 与 `.cursor/commands/` 提供相同的 `/new-feature`、`/port`、`/sync-contract`、`/distill`、`/codebase` 斜杠命令；wrapup 技能在两边均有注册。

## 约定速查

- 活跃功能：`context/features/ACTIVE`，同一时间只推进一个功能（多功能并行时切换此文件）。
- 状态图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞；"完成"= 自测通过，不是"代码写完"。
- 功能上线后目录改名加 `done-` 前缀归档。
- 文档守门 hook 只在 apps 有未提交改动且 status.md 未动时触发一次；纯问答会话不受影响（Claude 阻止结束，Cursor 自动续跑提示补齐）。


# 五端工作区与 git 状态汇总

**立即执行，不要自行拼 git 命令：**

```bash
bash scripts/code-status.sh
```

（编排仓 `context` + `apps/web` / `apps/android` / `apps/ios` / `apps/desktop`，共五处 git 仓库。）

## 输出要求

按以下顺序回复，**简洁、有序**：

### 1. 原始数据

把脚本 stdout **原样贴出**（结构化事实；脚本**不做**语义总结）。

### 2. AI 总结（必做，表格）

阅读脚本输出 + `context/features/ACTIVE` 对应 `status.md`，在原始数据下方输出 **一张 Markdown 表格**，一行一端，列固定为：

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |

列说明（单元格宜短句，勿长段落）：

| 列 | 填什么 |
|----|--------|
| 端 | `context` / `web` / `android` / `ios` / `desktop` |
| 分支 | 当前分支名 |
| 同步 | `synced` / `ahead N` / `behind N` / `ahead N·behind M` / `no upstream` |
| 脏区 | `干净` 或 `脏(N)` |
| 活跃功能 | `相关` / `旁路` / `—`（无关或未设置 ACTIVE） |
| 备注 | 1 句：关键脏文件方向、是否需 push/pull/commit/wrapup |

**禁止**在表格外再写长段 prose；**禁止**为填表对各仓库再跑 `git status` / `git diff`（除非用户追问某端细节）。

可选：`bash scripts/code-status.sh --short` 仅一行摘要/端（仍须上表总结，不可只贴一行）。

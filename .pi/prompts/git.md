# 各仓库 git 状态（仅表格）

**立即执行，不要自行拼 git 命令：**

```bash
bash scripts/code-status.sh
```

覆盖：编排仓 `context` + `apps/web` / `android` / `ios` / `desktop` + `meeting` / `action-center`。

## 输出要求

**只回一张 Markdown 表格**，不要贴脚本原文、不要表格外 prose、不要再对各仓库跑 `git status` / `git diff`。

| 端 | 分支 | 与远端 | 工作区 |

| 列 | 填什么 |
|----|--------|
| 端 | `编排仓` / `Web` / `Android` / `iOS` / `PC` / `meeting` / `action-center`（脚本里的 `context`→编排仓，`desktop`→PC） |
| 分支 | 当前分支名 |
| 与远端 | `synced` / `ahead N` / `behind N` / `ahead N·behind M` / `no upstream` |
| 工作区 | 见下 |

### 工作区列

- 无未提交改动 → `干净`
- **PC 例外**：脏文件**全部**属于 `{.env.test, electron-builder.yml, package.json}`（可只有其中一部分）→ 视为干净，填 `干净（配置信息）`。出现其它路径则按真实脏文件算 `脏(N)`，N 用脚本计数。
- 其余仓库有脏文件 → `脏(N)`

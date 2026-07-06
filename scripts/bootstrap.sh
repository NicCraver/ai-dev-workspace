#!/usr/bin/env bash
# 一次性初始化：git 仓库、hook 可执行权限、检查 apps。
# 插件安装是 Claude Code 会话内命令，脚本无法代跑，最后会打印出来让你复制。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x .claude/hooks/*.sh scripts/*.sh

if [[ ! -d .git ]]; then
  git init -b main
  git add -A
  git commit -m "chore: init ai-dev-workspace"
  echo "[ok] 已初始化 git 仓库并完成首次提交"
else
  echo "[skip] 已是 git 仓库"
fi

echo
echo "检查 apps/ 下的四个项目仓库："
for name in web android ios desktop; do
  if [[ -d "apps/$name/.git" ]]; then
    echo "  [ok]   apps/$name"
  else
    echo "  [缺失] apps/$name  →  git clone <你的${name}仓库地址> apps/$name"
  fi
done

cat << 'EOF'

────────────────────────────────────────────
接下来请手动完成（各只需一次）：

1. 安装 claude-mem（终端执行）：
     npx claude-mem install

2. 安装 Superpowers（在本目录启动 claude 后，会话内执行）：
     /plugin marketplace add obra/superpowers-marketplace
     /plugin install superpowers@superpowers-marketplace

3. 安装 codebase-memory MCP（按其官方文档，在本目录注册，
   使四个 app 仓库共用同一索引）。

4. 让 Claude Code 为每个老项目生成初稿文档（会话内逐个执行）：
     探索 apps/web，填写 context/platforms/web.md 的空缺小节，
     并在 apps/web/ 下生成该仓库自己的 CLAUDE.md（构建/测试/lint 命令与代码规范）
   （android / ios / desktop 同理，然后人工校对一遍）

5. 验证 hooks 已注册：会话内执行 /hooks 应能看到 SessionStart 和 Stop。
────────────────────────────────────────────
EOF

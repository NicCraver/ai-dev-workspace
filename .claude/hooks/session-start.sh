#!/usr/bin/env bash
# SessionStart hook：把当前活跃功能的状态注入会话上下文。
# stdout（exit 0）会被追加进 Claude 的上下文。
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ACTIVE_FILE="$ROOT/context/features/ACTIVE"

if [[ ! -f "$ACTIVE_FILE" ]]; then
  exit 0
fi

FEATURE="$(head -n1 "$ACTIVE_FILE" | tr -d '[:space:]')"
[[ -z "$FEATURE" || "$FEATURE" == "none" ]] && exit 0

STATUS_MD="$ROOT/context/features/$FEATURE/status.md"

echo "=== 当前活跃功能: $FEATURE ==="
if [[ -f "$STATUS_MD" ]]; then
  echo "--- context/features/$FEATURE/status.md ---"
  cat "$STATUS_MD"
else
  echo "(该功能尚无 status.md，若开始开发请先用 /new-feature 或补建文档)"
fi
echo "=== 提示：编码任务完成后必须更新上面的 status.md（Stop hook 会检查） ==="

exit 0

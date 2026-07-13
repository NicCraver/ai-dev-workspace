#!/usr/bin/env bash
# sessionStart hook：把当前活跃功能的状态注入会话上下文。
# stdout 输出 JSON：{ "additional_context": "..." }
set -euo pipefail

INPUT="$(cat 2>/dev/null || true)"
ROOT="$(pwd)"

if [[ -n "$INPUT" ]]; then
  parsed="$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    roots = data.get("workspace_roots") or []
    print(roots[0] if roots else "")
except Exception:
    print("")
' 2>/dev/null || true)"
  [[ -n "$parsed" ]] && ROOT="$parsed"
fi

ACTIVE_FILE="$ROOT/context/features/ACTIVE"
CONTEXT=""

if [[ ! -f "$ACTIVE_FILE" ]]; then
  CONTEXT="(无活跃功能：context/features/ACTIVE 不存在)"
else
  FEATURE="$(head -n1 "$ACTIVE_FILE" | tr -d '[:space:]')"
  if [[ -z "$FEATURE" || "$FEATURE" == "none" ]]; then
    CONTEXT="(无活跃功能)"
  else
    STATUS_MD="$ROOT/context/features/$FEATURE/status.md"
  {
    echo "=== 当前活跃功能: $FEATURE ==="
    if [[ -f "$STATUS_MD" ]]; then
      echo "--- context/features/$FEATURE/status.md ---"
      cat "$STATUS_MD"
    else
      echo "(该功能尚无 status.md，若开始开发请先用 /new-feature 或补建文档)"
    fi
    echo "=== 提示：编码任务完成后必须更新上面的 status.md（stop hook 会检查） ==="
  } > /tmp/cursor-session-start-ctx.$$
    CONTEXT="$(cat /tmp/cursor-session-start-ctx.$$)"
    rm -f /tmp/cursor-session-start-ctx.$$
  fi
fi

python3 -c 'import json,sys; print(json.dumps({"additional_context": sys.stdin.read()}))' <<<"$CONTEXT"
exit 0

#!/usr/bin/env bash
# sessionStart hook：把当前活跃功能的状态注入会话上下文。
# ACTIVE 支持多行（每行一个功能名，第一行为主功能，# 开头与空行忽略）：
#   主功能注入 status.md 全文，其余只列名，需要时由 Agent 自行读取。
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
  FEATURES=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="$(printf '%s' "$line" | tr -d '[:space:]')"
    [[ -z "$line" || "$line" == \#* || "$line" == "none" ]] && continue
    FEATURES+=("$line")
  done < "$ACTIVE_FILE"

  if [[ ${#FEATURES[@]} -eq 0 ]]; then
    CONTEXT="(无活跃功能)"
  else
    MAIN="${FEATURES[0]}"
    STATUS_MD="$ROOT/context/features/$MAIN/status.md"
    TMP="$(mktemp)"
    {
      echo "=== 当前活跃功能(主): $MAIN ==="
      if [[ -f "$STATUS_MD" ]]; then
        echo "--- context/features/$MAIN/status.md ---"
        cat "$STATUS_MD"
      else
        echo "(该功能尚无 status.md，若开始开发请先用 /new-feature 或补建文档)"
      fi
      if [[ ${#FEATURES[@]} -gt 1 ]]; then
        echo
        echo "=== 其余活跃功能（未注入全文）==="
        for f in "${FEATURES[@]:1}"; do
          echo "- $f"
        done
        echo "提示：需要时自行读 context/features/<名>/status.md"
      fi
      echo "=== 提示：编码任务完成后必须更新对应功能的 status.md（stop hook 会检查） ==="
    } > "$TMP"
    CONTEXT="$(cat "$TMP")"
    rm -f "$TMP"
  fi
fi

python3 -c 'import json,sys; print(json.dumps({"additional_context": sys.stdin.read()}))' <<<"$CONTEXT"
exit 0

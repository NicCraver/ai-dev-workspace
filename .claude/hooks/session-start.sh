#!/usr/bin/env bash
# SessionStart hook：把当前活跃功能的状态注入会话上下文。
# ACTIVE 支持多行（每行一个功能名，第一行为主功能，# 开头与空行忽略）：
#   主功能注入 status.md 全文，其余只列名，需要时由 AI 自行读取。
# stdout（exit 0）会被追加进 Claude 的上下文。
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ACTIVE_FILE="$ROOT/context/features/ACTIVE"

if [[ ! -f "$ACTIVE_FILE" ]]; then
  exit 0
fi

FEATURES=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="$(printf '%s' "$line" | tr -d '[:space:]')"
  [[ -z "$line" || "$line" == \#* || "$line" == "none" ]] && continue
  FEATURES+=("$line")
done < "$ACTIVE_FILE"

[[ ${#FEATURES[@]} -eq 0 ]] && exit 0

MAIN="${FEATURES[0]}"
STATUS_MD="$ROOT/context/features/$MAIN/status.md"

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

echo "=== 提示：编码任务完成后必须更新对应功能的 status.md（Stop hook 会检查） ==="

exit 0

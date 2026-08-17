#!/usr/bin/env bash
# stop hook：文档守门员。
# 规则：任一 app 仓库工作区有未提交的代码改动，而活跃功能的 status.md
#       没有任何本会话内的更新痕迹，则输出 followup_message 让 Agent 先补文档。
# 注意：
#   - loop_count > 0 时直接放行，防止无限循环（对应 Claude 的 stop_hook_active）。
#   - 纯问答会话（apps 无改动）不拦截。
set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"
ROOT="$(pwd)"

if [[ -n "$INPUT" ]]; then
  parsed_root="$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    roots = data.get("workspace_roots") or []
    print(roots[0] if roots else "")
except Exception:
    print("")
' 2>/dev/null || true)"
  [[ -n "$parsed_root" ]] && ROOT="$parsed_root"

  loop_count="$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    print(int(json.load(sys.stdin).get("loop_count", 0)))
except Exception:
    print(0)
' 2>/dev/null || echo 0)"
  if [[ "${loop_count:-0}" -gt 0 ]]; then
    printf '{}\n'
    exit 0
  fi
fi

ACTIVE_FILE="$ROOT/context/features/ACTIVE"
[[ -f "$ACTIVE_FILE" ]] || { printf '{}\n'; exit 0; }

FEATURE="$(head -n1 "$ACTIVE_FILE" | tr -d '[:space:]')"
[[ -z "$FEATURE" || "$FEATURE" == "none" ]] && { printf '{}\n'; exit 0; }

STATUS_MD_REL="context/features/$FEATURE/status.md"
STATUS_MD="$ROOT/$STATUS_MD_REL"

apps_dirty=""
for app in "$ROOT"/apps/*/; do
  [[ -d "$app/.git" ]] || continue
  if [[ -n "$(git -C "$app" status --porcelain 2>/dev/null)" ]]; then
    apps_dirty+=" $(basename "$app")"
  fi
done

[[ -z "$apps_dirty" ]] && { printf '{}\n'; exit 0; }

docs_touched=""
if [[ -f "$STATUS_MD" ]]; then
  if git -C "$ROOT" status --porcelain -- "$STATUS_MD_REL" 2>/dev/null | grep -q .; then
    docs_touched="yes"
  elif [[ -n "$(find "$STATUS_MD" -mmin -30 2>/dev/null)" ]]; then
    docs_touched="yes"
  fi
fi

if [[ -z "$docs_touched" ]]; then
  reason="检测到 apps 下有代码改动（${apps_dirty# }），但活跃功能 [$FEATURE] 的 $STATUS_MD_REL 没有更新。请先：1) 运行 bash scripts/code-status.sh，由 AI 根据输出与会话上下文总结各端现状；2) 据此更新 status.md 的平台矩阵与「待办/阻塞」；3) 若本次是 web 端联调完成，生成/更新 impl-notes.md；4) 在工作区根目录 git commit context 的变更。完成后回复「收尾完成」。"
  python3 -c 'import json,sys; print(json.dumps({"followup_message": sys.stdin.read()}))' <<<"$reason"
  exit 0
fi

printf '{}\n'
exit 0

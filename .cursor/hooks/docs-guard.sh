#!/usr/bin/env bash
# stop hook：文档守门员。
# 规则：任一 app 仓库工作区有未提交的代码改动，而**所有**活跃功能的 status.md
#       都没有本会话内的更新痕迹，则输出 followup_message 让 Agent 先补文档。
#       多任务并行时只要有一个活跃功能的 status.md 被更新就放行。
# 注意：
#   - ACTIVE 支持多行，每行一个功能名，# 开头与空行忽略。
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

FEATURES=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="$(printf '%s' "$line" | tr -d '[:space:]')"
  [[ -z "$line" || "$line" == \#* || "$line" == "none" ]] && continue
  FEATURES+=("$line")
done < "$ACTIVE_FILE"

[[ ${#FEATURES[@]} -eq 0 ]] && { printf '{}\n'; exit 0; }

# PC 端（desktop）的本地调试配置按项目规则永远不提交，会长期处于脏状态，
# 不能算作「代码改动」，否则每回合都会误拦截。
DESKTOP_IGNORE='/(\.env\.test|electron-builder\.yml|package\.json|package-lock\.json)$'
apps_dirty=""
for app in "$ROOT"/apps/*/; do
  [[ -d "$app/.git" ]] || continue
  porcelain="$(git -C "$app" status --porcelain 2>/dev/null)"
  if [[ "$(basename "$app")" == "desktop" ]]; then
    # porcelain 行形如 " M .env.test"，补一个前导 / 让上面的正则统一匹配路径末段
    porcelain="$(printf '%s\n' "$porcelain" | sed 's#^\(...\)#\1/#' | grep -Ev "$DESKTOP_IGNORE" || true)"
  fi
  if [[ -n "$(printf '%s' "$porcelain" | tr -d '[:space:]')" ]]; then
    apps_dirty+=" $(basename "$app")"
  fi
done

[[ -z "$apps_dirty" ]] && { printf '{}\n'; exit 0; }

docs_touched=""
status_list=""
for feature in "${FEATURES[@]}"; do
  rel="context/features/$feature/status.md"
  status_list+="、$rel"
  abs="$ROOT/$rel"
  [[ -f "$abs" ]] || continue
  if git -C "$ROOT" status --porcelain -- "$rel" 2>/dev/null | grep -q .; then
    docs_touched="yes"
    break
  elif [[ -n "$(find "$abs" -mmin -30 2>/dev/null)" ]]; then
    docs_touched="yes"
    break
  fi
done

if [[ -z "$docs_touched" ]]; then
  reason="检测到 apps 下有代码改动（${apps_dirty# }），但活跃功能的 status.md 均未更新（${status_list#、}）。请先：1) 运行 bash scripts/code-status.sh，由 AI 根据输出与会话上下文总结各端现状；2) 判断本次改动归属哪个活跃功能，更新那个功能 status.md 的平台矩阵与「待办/阻塞」；3) 若本次是 web 端联调完成，生成/更新 impl-notes.md；4) 在工作区根目录 git commit context 的变更。完成后回复「收尾完成」。"
  python3 -c 'import json,sys; print(json.dumps({"followup_message": sys.stdin.read()}))' <<<"$reason"
  exit 0
fi

printf '{}\n'
exit 0

#!/usr/bin/env bash
# Stop hook：文档守门员。
# 规则：任一 app 仓库工作区有未提交的代码改动，而**所有**活跃功能的 status.md
#       都没有本会话内的更新痕迹（既不脏也非近 30 分钟修改），
#       则输出 {"decision":"block", ...} 让 Claude 先补文档再结束。
#       多任务并行时只要有一个活跃功能的 status.md 被更新就放行。
# 注意：
#   - ACTIVE 支持多行，每行一个功能名，# 开头与空行忽略。
#   - 读 stdin JSON 的 stop_hook_active，为 true 时直接放行，防止无限循环。
#   - 纯问答会话（apps 无改动）不拦截。
set -uo pipefail

INPUT="$(cat || true)"

# 防死循环：上一个 Stop hook 已经 block 过一次，本次放行
if printf '%s' "$INPUT" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ACTIVE_FILE="$ROOT/context/features/ACTIVE"
[[ -f "$ACTIVE_FILE" ]] || exit 0

FEATURES=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="$(printf '%s' "$line" | tr -d '[:space:]')"
  [[ -z "$line" || "$line" == \#* || "$line" == "none" ]] && continue
  FEATURES+=("$line")
done < "$ACTIVE_FILE"

[[ ${#FEATURES[@]} -eq 0 ]] && exit 0

# 1) 检查 apps/* 是否有代码改动（未提交的工作区改动，含未跟踪文件）
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

# apps 无改动 → 纯问答/纯文档会话，放行
[[ -z "$apps_dirty" ]] && exit 0

# 2) 任一活跃功能的 status.md 在本会话被更新过即放行：
#    a) 在工作区 git 中处于脏状态（改了未提交），或
#    b) 文件 mtime 在最近 30 分钟内（覆盖 wrapup 已更新并提交的情况）
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
  reason="检测到 apps 下有代码改动（${apps_dirty# }），但活跃功能的 status.md 均未更新（${status_list#、}）。请先：1) 运行 bash scripts/code-status.sh，由 AI 根据输出与会话上下文总结各端现状；2) 判断本次改动归属哪个活跃功能，更新那个功能 status.md 的平台矩阵与「待办/阻塞」；3) 若本次是 web 端联调完成，生成/更新 impl-notes.md；4) 在工作区根目录 git commit context 的变更。完成后再结束。"
  printf '{"decision":"block","reason":"%s"}\n' "$reason"
  exit 0
fi

exit 0

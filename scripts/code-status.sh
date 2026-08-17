#!/usr/bin/env bash
# 五端（context 编排仓 + web/android/ios/desktop）工作区与 git 状态汇总。
# 用法: bash scripts/code-status.sh [--short]
# 各 AI 工具斜杠命令均调用此脚本，保证输出一致；语义总结由 AI 撰写，脚本只输出事实。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHORT=0
[[ "${1:-}" == "--short" ]] && SHORT=1

# name|path（相对 ROOT）
REPOS=(
  "context|."
  "web|apps/web"
  "android|apps/android"
  "ios|apps/ios"
  "desktop|apps/desktop"
)

count_dirty() {
  local dir="$1"
  git -C "$dir" status --porcelain 2>/dev/null | wc -l | tr -d ' '
}

list_changes() {
  local dir="$1" limit="${2:-8}"
  local lines total
  lines="$(git -C "$dir" status --porcelain 2>/dev/null || true)"
  total="$(printf '%s\n' "$lines" | sed '/^$/d' | wc -l | tr -d ' ')"
  if [[ "$total" -eq 0 ]]; then
    return
  fi
  printf '%s\n' "$lines" | head -n "$limit" | while IFS= read -r line; do
    local xy="${line:0:2}"
    local file="${line:3}"
    case "$xy" in
      "??") printf '    ? %s\n' "$file" ;;
      " M"|"M "|"MM") printf '    M %s\n' "$file" ;;
      " A"|"A "|"AM") printf '    A %s\n' "$file" ;;
      " D"|"D "|"MD") printf '    D %s\n' "$file" ;;
      "R "*|"RM") printf '    R %s\n' "$file" ;;
      *) printf '    %s %s\n' "$xy" "$file" ;;
    esac
  done
  if [[ "$total" -gt "$limit" ]]; then
    printf '    … 另有 %d 个文件\n' "$((total - limit))"
  fi
}

summarize_repo() {
  local name="$1" relpath="$2"
  local dir="$ROOT/$relpath"

  if [[ ! -d "$dir" ]]; then
    if [[ "$SHORT" -eq 1 ]]; then
      echo "[$name] 缺失(无目录)"
    else
      echo "[$name] 缺失 — 目录不存在: $relpath"
    fi
    return
  fi

  if [[ ! -d "$dir/.git" ]]; then
    if [[ "$SHORT" -eq 1 ]]; then
      echo "[$name] 缺失(无git)"
    else
      echo "[$name] 缺失 — 未初始化 git: $relpath"
    fi
    return
  fi

  local branch tracking sync dirty last
  branch="$(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")"
  tracking="$(git -C "$dir" rev-parse --abbrev-ref '@{u}' 2>/dev/null || true)"
  dirty="$(count_dirty "$dir")"
  last="$(git -C "$dir" log -1 --format='%h %s' 2>/dev/null || echo "")"

  local sync_str=""
  if [[ -n "$tracking" ]]; then
    local left right
    if counts="$(git -C "$dir" rev-list --left-right --count HEAD...'@{u}' 2>/dev/null)"; then
      left="$(printf '%s' "$counts" | awk '{print $1}')"
      right="$(printf '%s' "$counts" | awk '{print $2}')"
    else
      left=0
      right=0
    fi
    if [[ "$left" -gt 0 && "$right" -gt 0 ]]; then
      sync_str="ahead $left · behind $right"
    elif [[ "$left" -gt 0 ]]; then
      sync_str="ahead $left"
    elif [[ "$right" -gt 0 ]]; then
      sync_str="behind $right"
    else
      sync_str="synced"
    fi
  else
    sync_str="no upstream"
  fi

  local work_str
  if [[ "$dirty" -eq 0 ]]; then
    work_str="干净"
  else
    work_str="脏 ($dirty)"
  fi

  if [[ "$SHORT" -eq 1 ]]; then
    echo "[$name] $branch · $sync_str · $work_str"
    return
  fi

  echo "[$name]  $branch · $sync_str · $work_str"
  if [[ -n "$tracking" ]]; then
    echo "    ↑ $tracking"
  fi
  if [[ -n "$last" ]]; then
    echo "    @ $last"
  fi
  if [[ "$dirty" -gt 0 ]]; then
    list_changes "$dir"
  fi
}

# ── 输出 ──────────────────────────────────────────────
if [[ "$SHORT" -eq 0 ]]; then
  echo "=== 五端工作区状态 ==="
  active_file="$ROOT/context/features/ACTIVE"
  if [[ -f "$active_file" ]]; then
    active="$(tr -d '[:space:]' < "$active_file")"
    echo "活跃功能: $active"
    status_file="$ROOT/context/features/$active/status.md"
    if [[ -f "$status_file" ]]; then
      updated="$(grep -m1 '^> 最后更新' "$status_file" 2>/dev/null | sed 's/^> 最后更新：//' | sed 's/｜.*//' || true)"
      [[ -n "$updated" ]] && echo "status 更新: $updated"
    fi
  else
    echo "活跃功能: (未设置 ACTIVE)"
  fi
  echo
fi

for entry in "${REPOS[@]}"; do
  name="${entry%%|*}"
  path="${entry#*|}"
  summarize_repo "$name" "$path"
done

if [[ "$SHORT" -eq 0 ]]; then
  echo
  echo "图例: 干净=无未提交改动 · 脏(N)=N 个变更项 · ahead/behind=相对 upstream"
  echo ">>> 以上为事实输出；下方须由 AI 输出一张六列表格总结（端/分支/同步/脏区/活跃功能/备注），脚本不自动生成。"
fi

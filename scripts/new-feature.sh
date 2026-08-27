#!/usr/bin/env bash
# 用法: bash scripts/new-feature.sh <功能名>
# 从 _template 创建功能目录，并将其设为活跃功能。
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: bash scripts/new-feature.sh <功能名>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="$(echo "$1" | tr ' /' '--')"
DIR_NAME="$(date +%Y%m%d)-$NAME"
DEST="$ROOT/context/features/$DIR_NAME"

if [[ -e "$DEST" ]]; then
  echo "已存在: $DEST" >&2
  exit 1
fi

cp -r "$ROOT/context/features/_template" "$DEST"

# 替换模板占位
TODAY="$(date +%Y-%m-%d)"
for f in "$DEST"/*.md; do
  sed -i.bak "s/<功能名>/$NAME/g; s/YYYY-MM-DD/$TODAY/g" "$f" && rm -f "$f.bak"
done

# ACTIVE 支持多个活跃功能：新功能置顶为主功能，原有的保留在后面
ACTIVE_FILE="$ROOT/context/features/ACTIVE"
OTHERS=""
if [[ -f "$ACTIVE_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="$(printf '%s' "$line" | tr -d '[:space:]')"
    [[ -z "$line" || "$line" == \#* || "$line" == "none" || "$line" == "$DIR_NAME" ]] && continue
    OTHERS+="$line"$'\n'
  done < "$ACTIVE_FILE"
fi
printf '%s\n%s' "$DIR_NAME" "$OTHERS" > "$ACTIVE_FILE"

echo "已创建: context/features/$DIR_NAME"
echo "已设为主活跃功能 (context/features/ACTIVE 第一行)"
if [[ -n "$OTHERS" ]]; then
  echo "同时活跃的还有:"
  printf '%s' "$OTHERS" | sed 's/^/  - /'
  echo "（做完的功能请手动从 ACTIVE 删掉那一行）"
fi

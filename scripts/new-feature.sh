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

echo "$DIR_NAME" > "$ROOT/context/features/ACTIVE"

echo "已创建: context/features/$DIR_NAME"
echo "已设为活跃功能 (context/features/ACTIVE)"

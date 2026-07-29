#!/usr/bin/env bash
# 转发到 apps/android 唯一实现（勿在此维护业务逻辑）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
exec bash "$ROOT/apps/android/.cursor/commands/scripts/anzhuo-build-test.sh" "$@"

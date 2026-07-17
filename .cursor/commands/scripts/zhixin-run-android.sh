#!/usr/bin/env bash
# 智信 Android 真机调试：默认 onTest（192.168.10.25）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ANDROID_DIR="$REPO_ROOT/apps/android"

FLAVOR="onTest"
PKG="com.cnmts.smart_message.test"
ACTIVITY="com.cnmts.smart_message.activity.AppStartSplashActivity"
GRADLE_TASK="installOnTestDebug"
APK_DIR="smart_message/build/outputs/apk/onTest/debug"
FORCE_BUILD=false
QUICK=false

usage() {
  cat <<'EOF'
用法: zhixin-run-android.sh [--build] [--quick] [--develop]

  默认 onTest 测试环境，自动判断是否需要重新编译。
  --build    强制 Gradle 编译安装
  --quick    跳过编译，仅 adb install 已有 APK
  --develop  开发环境（192.168.5.47，包名 .develop）
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --develop)
      FLAVOR="develop"
      PKG="com.cnmts.smart_message.develop"
      GRADLE_TASK="installDevelopDebug"
      APK_DIR="smart_message/build/outputs/apk/develop/debug"
      ;;
    --quick|--no-build) QUICK=true ;;
    --build) FORCE_BUILD=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $1"; usage; exit 1 ;;
  esac
  shift
done

cd "$ANDROID_DIR"

echo "==> JDK"
java -version 2>&1 | head -1

echo "==> 设备"
adb devices -l
if ! adb devices | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
  echo "错误: 无已连接设备（请插线并允许 USB 调试）"
  exit 1
fi

chmod +x ./gradlew 2>/dev/null || true

latest_apk() {
  shopt -s nullglob
  local apks=("$APK_DIR"/*.apk)
  shopt -u nullglob
  if [[ ${#apks[@]} -eq 0 ]]; then
    echo ""
    return
  fi
  ls -t "${apks[@]}" | head -1
}

needs_build() {
  if [[ "$FORCE_BUILD" == true ]]; then return 0; fi
  if [[ "$QUICK" == true ]]; then return 1; fi
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    echo "检测到工作区有改动，需要重新编译"
    return 0
  fi
  local apk
  apk="$(latest_apk)"
  if [[ -z "$apk" ]]; then
    echo "未找到 APK，需要编译"
    return 0
  fi
  if find smart_message core_function_api IM android_net basis_function_api \
      -type f \( -name '*.java' -o -name '*.kt' -o -name '*.xml' \) -newer "$apk" 2>/dev/null | grep -q .; then
    echo "源码比 APK 新，需要重新编译"
    return 0
  fi
  return 1
}

install_apk() {
  local apk="$1"
  echo "==> 安装: $apk"
  if ! adb install -r "$apk"; then
    echo ""
    echo "若报 INSTALL_FAILED_USER_RESTRICTED：请在手机开启开发者选项「USB 安装」或点允许，然后重跑本脚本 --quick"
    exit 1
  fi
}

if needs_build; then
  echo "==> 编译并安装 ($GRADLE_TASK)"
  if ! ./gradlew "$GRADLE_TASK" --no-daemon; then
    echo "错误: Gradle 构建失败"
    exit 1
  fi
else
  apk="$(latest_apk)"
  if [[ -z "$apk" ]]; then
    echo "错误: 无可用 APK，请去掉 --quick 重新运行"
    exit 1
  fi
  install_apk "$apk"
fi

echo "==> 启动 ($PKG)"
adb shell am start -n "$PKG/$ACTIVITY"
sleep 2
echo "==> 前台 Activity"
adb shell dumpsys window | grep -E 'mFocusedApp' | tail -1 || true

echo ""
echo "完成 | flavor=$FLAVOR | pkg=$PKG | 后端=$([ "$FLAVOR" = onTest ] && echo 192.168.10.25 || echo 192.168.5.47)"

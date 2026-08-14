#!/usr/bin/env node
/**
 * 智信 Android：构建正式（publish/release）APK，重命名后打开产物目录（不安装）
 * 工作区根目录入口，Android 工程在 apps/android
 *
 * flavor=publish（applicationId com.cnmts.smart_message，app_name 智物联信），buildType=release（release 签名）
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(WORKSPACE_ROOT, 'apps/android');

// 带模块前缀：只打 app 模块，资源在 app 层合并。
// 无前缀的 assemblePublishRelease 会顺带给 IM / basis_function_api 等 library 模块打 release，
// 触发 library 孤立资源校验 verifyPublishReleaseResources——library 里引用了 app 模块的 drawable
//（如 IM 的 dialog_other_apps.xml 引用 smart_message 的 shape_rect_two_horn），孤立校验看不到 app 资源必挂。
const TASK = ':smart_message:assemblePublishRelease';
const OUT_DIR = path.join(ANDROID_DIR, 'smart_message/build/outputs/apk/publish/release');
const RENAMED_PREFIX = 'zx-android-prod';

function formatElapsed(ms) {
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const sec = Math.round(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function trackElapsed() {
  const startedAt = Date.now();
  process.on('exit', () => {
    console.log(`用时 ${formatElapsed(Date.now() - startedAt)}`);
  });
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function printHelp() {
  console.log('用法: prod-android-build [--clean] [--no-open]');
  console.log('  默认: Gradle daemon 增量编译 :smart_message:assemblePublishRelease，重命名为 zx-android-prod_v*.apk，再 open 产物目录');
  console.log('  --clean    先跑 clean 再全量编（换分支/改 flavor 后建议带上）');
  console.log('  --no-open  成功后不打开产物目录');
}

function parseArgs(argv) {
  const opts = { clean: false, open: true, help: false };

  for (const arg of argv) {
    switch (arg) {
      case '--clean':
        opts.clean = true;
        break;
      case '--no-open':
        opts.open = false;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        console.error(`未知参数: ${arg}`);
        process.exit(1);
    }
  }

  return opts;
}

function assertAndroidDir() {
  if (!fs.existsSync(path.join(ANDROID_DIR, 'gradlew'))) {
    console.error(`错误: 找不到 Android 工程 ${ANDROID_DIR}`);
    process.exit(1);
  }
}

function chmodGradlew() {
  try {
    fs.chmodSync(path.join(ANDROID_DIR, 'gradlew'), 0o755);
  } catch {
    // 无权限时忽略，后续 spawn 会报错
  }
}

function gradle(tasks) {
  console.log(`==> ${tasks.join(' ')}`);
  const result = spawnSync('./gradlew', [...tasks, '--console=plain', '-q'], {
    cwd: ANDROID_DIR,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function findLatestApk() {
  if (!fs.existsSync(OUT_DIR)) return null;
  const apks = fs
    .readdirSync(OUT_DIR)
    .filter((name) => name.endsWith('.apk'))
    .map((name) => {
      const fullPath = path.join(OUT_DIR, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return apks[0]?.fullPath ?? null;
}

/** APK 名形如 smart_message-publish-release_v3.6.18.apk（build.gradle 里拼的 versionName） */
function parseVersion(apkName) {
  const match = apkName.match(/_v([0-9][0-9A-Za-z._-]*)\.apk$/);
  return match?.[1] ?? null;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  trackElapsed();
  assertAndroidDir();
  chmodGradlew();

  if (opts.clean) gradle(['clean']);
  gradle([TASK]);

  const apk = findLatestApk();
  if (!apk) {
    console.error(`错误: 构建完成但未找到 APK（${OUT_DIR}/*.apk）`);
    process.exit(1);
  }

  const version = parseVersion(path.basename(apk));
  if (!version) {
    console.error(`错误: 无法从 APK 文件名解析版本号: ${path.basename(apk)}`);
    process.exit(1);
  }

  const renamed = path.join(OUT_DIR, `${RENAMED_PREFIX}_v${version}.apk`);
  if (apk !== renamed) {
    if (fs.existsSync(renamed)) fs.unlinkSync(renamed);
    fs.renameSync(apk, renamed);
  }

  const size = formatSize(fs.statSync(renamed).size);
  console.log(`==> 产物: ${renamed} (${size})`);
  if (opts.open) {
    console.log(`==> open ${OUT_DIR}`);
    spawnSync('open', [OUT_DIR], { stdio: 'inherit' });
  }
  console.log(`完成 | smart_message/publish-release | ${renamed}`);
}

main();

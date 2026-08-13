#!/usr/bin/env node
/**
 * 智信 Android：构建测试环境 APK，并打开产物目录（不安装）
 * 工作区根目录入口，Android 工程在 apps/android
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(WORKSPACE_ROOT, 'apps/android');

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
  console.log('用法: anzhuo-build-test [--develop]');
  console.log('  默认: Gradle daemon 增量编译 assembleOnTestDebug，再 open 产物目录');
  console.log('  --develop  开发环境 APK');
}

function parseArgs(argv) {
  const opts = { develop: false };

  for (const arg of argv) {
    switch (arg) {
      case '--develop':
        opts.develop = true;
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

function resolveConfig(develop) {
  if (develop) {
    return {
      task: 'assembleDevelopDebug',
      outDir: path.join(ANDROID_DIR, 'smart_message/build/outputs/apk/develop/debug'),
      label: 'develop',
      renamedPrefix: 'zx-android-develop',
    };
  }

  return {
    task: 'assembleOnTestDebug',
    outDir: path.join(ANDROID_DIR, 'smart_message/build/outputs/apk/onTest/debug'),
    label: 'onTest',
    renamedPrefix: 'zx-android-test',
  };
}

function assertAndroidDir() {
  if (!fs.existsSync(path.join(ANDROID_DIR, 'gradlew'))) {
    console.error(`错误: 找不到 Android 工程 ${ANDROID_DIR}`);
    process.exit(1);
  }
}

function chmodGradlew() {
  const gradlew = path.join(ANDROID_DIR, 'gradlew');
  try {
    fs.chmodSync(gradlew, 0o755);
  } catch {
    // 无权限时忽略，后续 spawn 会报错
  }
}

function findLatestApk(outDir) {
  if (!fs.existsSync(outDir)) return null;
  const apks = fs
    .readdirSync(outDir)
    .filter((name) => name.endsWith('.apk'))
    .map((name) => {
      const fullPath = path.join(outDir, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return apks[0]?.fullPath ?? null;
}

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

  const config = resolveConfig(opts.develop);

  console.log(`==> ${config.task}`);
  const result = spawnSync('./gradlew', [config.task, '--console=plain', '-q'], {
    cwd: ANDROID_DIR,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const apk = findLatestApk(config.outDir);
  if (!apk) {
    console.error(`错误: 构建完成但未找到 APK（${config.outDir}/*.apk）`);
    process.exit(1);
  }

  const version = parseVersion(path.basename(apk));
  if (!version) {
    console.error(`错误: 无法从 APK 文件名解析版本号: ${path.basename(apk)}`);
    process.exit(1);
  }

  const renamed = path.join(config.outDir, `${config.renamedPrefix}_v${version}.apk`);
  if (apk !== renamed) {
    fs.renameSync(apk, renamed);
  }

  const size = formatSize(fs.statSync(renamed).size);
  console.log(`==> 产物: ${renamed} (${size})`);
  console.log(`==> open ${config.outDir}`);
  spawnSync('open', [config.outDir], { stdio: 'inherit' });
  console.log(`完成 | ${config.label} | ${renamed}`);
}

main();

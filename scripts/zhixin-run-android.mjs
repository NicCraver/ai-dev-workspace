#!/usr/bin/env node
/**
 * 智信 Android：尽快把 onTest 装到真机并启动
 * 工作区根目录入口，Android 工程在 apps/android
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(WORKSPACE_ROOT, 'apps/android');

const ACTIVITY = 'com.cnmts.smart_message.activity.AppStartSplashActivity';

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

function assertAndroidDir() {
  if (!fs.existsSync(path.join(ANDROID_DIR, 'gradlew'))) {
    console.error(`错误: 找不到 Android 工程 ${ANDROID_DIR}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log('用法: zhixin-run-android [--quick] [--develop]');
  console.log('  默认: Gradle daemon 增量编译并安装 onTest，再启动');
  console.log('  --quick    跳过编译，仅 adb 重装已有 APK');
  console.log('  --develop  开发环境');
}

function parseArgs(argv) {
  const opts = { quick: false, develop: false };

  for (const arg of argv) {
    switch (arg) {
      case '--quick':
        opts.quick = true;
        break;
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

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ANDROID_DIR,
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function assertAdbDevice() {
  const result = run('adb', ['get-state'], { stdio: 'pipe' });
  if (result.status !== 0) {
    console.error('错误: 无已连接设备（请插线并允许 USB 调试）');
    run('adb', ['devices', '-l'], { stdio: 'inherit' });
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

function resolveConfig(develop) {
  if (develop) {
    return {
      pkg: 'com.cnmts.smart_message.develop',
      task: 'installDevelopDebug',
      apkDir: path.join(
        ANDROID_DIR,
        'smart_message/build/outputs/apk/develop/debug',
      ),
    };
  }

  return {
    pkg: 'com.cnmts.smart_message.test',
    task: 'installOnTestDebug',
    apkDir: path.join(
      ANDROID_DIR,
      'smart_message/build/outputs/apk/onTest/debug',
    ),
  };
}

function findLatestApk(apkDir) {
  if (!fs.existsSync(apkDir)) {
    return null;
  }

  const apks = fs
    .readdirSync(apkDir)
    .filter((name) => name.endsWith('.apk'))
    .map((name) => {
      const fullPath = path.join(apkDir, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return apks[0]?.fullPath ?? null;
}

function installQuick(apkDir) {
  const apk = findLatestApk(apkDir);
  if (!apk) {
    console.error('错误: 无 APK，去掉 --quick 重新运行');
    process.exit(1);
  }

  console.log(`==> adb install -r ${path.basename(apk)}`);
  const result = run('adb', ['install', '-r', apk], { stdio: 'inherit' });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (output.includes('INSTALL_FAILED_USER_RESTRICTED')) {
      console.error(
        '若报 INSTALL_FAILED_USER_RESTRICTED：手机开「USB 安装」或点允许后重跑 --quick',
      );
    }
    process.exit(result.status ?? 1);
  }
}

function installWithGradle(task) {
  console.log(`==> ${task}`);
  const result = run('./gradlew', [task, '--console=plain', '-q'], {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function launchApp(pkg) {
  console.log(`==> 启动 ${pkg}`);
  const result = run(
    'adb',
    ['shell', 'am', 'start', '-n', `${pkg}/${ACTIVITY}`],
    { stdio: 'pipe' },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  trackElapsed();
  assertAndroidDir();
  const config = resolveConfig(opts.develop);

  assertAdbDevice();
  chmodGradlew();

  if (opts.quick) {
    installQuick(config.apkDir);
  } else {
    installWithGradle(config.task);
  }

  launchApp(config.pkg);
  console.log(
    `完成 | ${config.pkg} | onTest=192.168.10.25（除非 --develop）`,
  );
}

main();

#!/usr/bin/env node
/**
 * 智信 Android：尽快把 onTest 装到真机并启动
 * 工作区根目录入口，Android 工程在 apps/android
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyAdbLine,
  classifyGradleLine,
  createCli,
  dumpTail,
  formatElapsed,
  ink,
  spawnLogged,
} from './lib/build-cli.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(WORKSPACE_ROOT, 'apps/android');
const GRADLEW = path.join(ANDROID_DIR, 'gradlew');

const ACTIVITY = 'com.cnmts.smart_message.activity.AppStartSplashActivity';

/** @type {ReturnType<typeof parseArgs> | null} */
let cliOpts = null;
/** @type {ReturnType<typeof createCli>} */
let cli;

function printHelp() {
  console.log(`用法: zhixin-run-android [--quick] [--develop] [选项]

  （无）        Gradle daemon 增量编译并安装 onTest，再启动
  --quick       跳过编译，仅 adb 重装已有 APK
  --develop     开发环境

  --verbose     子进程日志全量输出（默认只留当前 Task + 错误）
`);
}

function parseArgs(argv) {
  const opts = { quick: false, develop: false, help: false, verbose: false };

  for (const arg of argv) {
    switch (arg) {
      case '--quick':
        opts.quick = true;
        break;
      case '--develop':
        opts.develop = true;
        break;
      case '-v':
      case '--verbose':
        opts.verbose = true;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        console.error(`未知参数: ${arg}\n跑 --help 看用法`);
        process.exit(1);
    }
  }

  return opts;
}

function die(msg) {
  if (cli) cli.close();
  console.error(`错误: ${msg}`);
  process.exit(1);
}

function assertAndroidDir() {
  if (!fs.existsSync(GRADLEW)) {
    die(`找不到 Android 工程 ${ANDROID_DIR}`);
  }
}

function chmodGradlew() {
  try {
    fs.chmodSync(GRADLEW, 0o755);
  } catch {
    // 无权限时忽略，后续 spawn 会报错
  }
}

function resolveConfig(develop) {
  if (develop) {
    return {
      pkg: 'com.cnmts.smart_message.develop',
      task: 'installDevelopDebug',
      label: 'develop debug',
      apkDir: path.join(ANDROID_DIR, 'smart_message/build/outputs/apk/develop/debug'),
    };
  }

  return {
    pkg: 'com.cnmts.smart_message.test',
    task: 'installOnTestDebug',
    label: 'onTest debug',
    apkDir: path.join(ANDROID_DIR, 'smart_message/build/outputs/apk/onTest/debug'),
  };
}

function findLatestApk(apkDir) {
  if (!fs.existsSync(apkDir)) return null;
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

async function logged(cmd, args, classifyLine, extra = {}) {
  const result = await spawnLogged(cmd, args, {
    cwd: extra.cwd ?? ANDROID_DIR,
    env: process.env,
    classifyLine,
    verbose: cliOpts?.verbose,
    cli,
  });
  if (result.status !== 0) {
    dumpTail(result.outputText);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (output.includes('INSTALL_FAILED_USER_RESTRICTED')) {
      throw new Error(
        'INSTALL_FAILED_USER_RESTRICTED：手机开「USB 安装」或点允许后重跑 --quick',
      );
    }
    throw new Error(`${[cmd, ...args].join(' ')} 失败 (exit ${result.status})`);
  }
  return result;
}

function assertAdbDevice() {
  const result = spawnSync('adb', ['get-state'], { encoding: 'utf8' });
  if (result.status !== 0) {
    spawnSync('adb', ['devices', '-l'], { stdio: 'inherit' });
    throw new Error('无已连接设备（请插线并允许 USB 调试）');
  }
  return (result.stdout ?? '').trim();
}

function summarize({ mode, ok, pkg }) {
  const elapsed = formatElapsed(Date.now() - cli.startedAt);
  console.log('');
  console.log(`  ${ink.dim('─'.repeat(42))}`);
  console.log(`  模式    ${mode}`);
  console.log(`  结果    ${ok ? ink.green('成功') : ink.red('失败')}  ${ink.dim(elapsed)}`);
  if (pkg) console.log(`  包名    ${pkg}`);
  console.log('');
}

function planSteps(opts) {
  const steps = ['检查设备'];
  steps.push(opts.quick ? 'adb 安装' : 'Gradle 安装');
  steps.push('启动应用');
  return steps;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  cliOpts = opts;
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  cli = createCli();
  process.on('exit', () => cli.close());

  assertAndroidDir();
  chmodGradlew();

  const config = resolveConfig(opts.develop);
  const steps = planSteps(opts);
  let stepIndex = 0;
  const total = steps.length;
  const next = (label) => {
    stepIndex += 1;
    cli.begin(stepIndex, total, label);
  };

  cli.header([
    ink.bold('Android 安装启动') + ink.dim(`  ·  ${config.label}`),
    ink.dim(opts.quick ? 'adb install -r（跳过编译）' : config.task),
  ]);

  try {
    next('检查设备');
    const state = assertAdbDevice();
    cli.succeed(state || 'device');

    if (opts.quick) {
      next('adb 安装');
      const apk = findLatestApk(config.apkDir);
      if (!apk) {
        throw new Error('无 APK，去掉 --quick 重新运行');
      }
      cli.note(path.basename(apk));
      await logged('adb', ['install', '-r', apk], classifyAdbLine, { cwd: undefined });
      cli.succeed(path.basename(apk));
    } else {
      next('Gradle 安装');
      await logged(GRADLEW, [config.task, '--console=plain'], classifyGradleLine);
      cli.succeed();
    }

    next('启动应用');
    await logged(
      'adb',
      ['shell', 'am', 'start', '-n', `${config.pkg}/${ACTIVITY}`],
      classifyAdbLine,
      { cwd: undefined },
    );
    cli.succeed(config.pkg);
  } catch (err) {
    cli.fail(err.message);
    summarize({
      mode: `${config.label}${opts.quick ? ' / quick' : ''}`,
      ok: false,
      pkg: config.pkg,
    });
    process.exit(1);
  }

  summarize({
    mode: `${config.label}${opts.quick ? ' / quick' : ''}`,
    ok: true,
    pkg: config.pkg,
  });
}

main().catch((err) => {
  if (cli) cli.close();
  console.error(`错误: ${err.message}`);
  process.exit(1);
});

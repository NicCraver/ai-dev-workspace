#!/usr/bin/env node
/**
 * 智信 Android：构建测试环境 APK，并打开产物目录（不安装）
 * 工作区根目录入口，Android 工程在 apps/android
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyGradleLine,
  createCli,
  dumpTail,
  formatElapsed,
  formatSize,
  ink,
  spawnLogged,
} from './lib/build-cli.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(WORKSPACE_ROOT, 'apps/android');
const GRADLEW = path.join(ANDROID_DIR, 'gradlew');

/** @type {ReturnType<typeof parseArgs> | null} */
let cliOpts = null;
/** @type {ReturnType<typeof createCli>} */
let cli;

function printHelp() {
  console.log(`用法: anzhuo-build-test [--develop] [选项]

  （无）        Gradle 增量 assembleOnTestDebug，重命名，打开产物目录
  --develop     开发环境 APK

  --no-open     成功后不打开产物目录
  --verbose     子进程日志全量输出（默认只留当前 Task + 错误）
`);
}

function parseArgs(argv) {
  const opts = { develop: false, open: true, help: false, verbose: false };

  for (const arg of argv) {
    switch (arg) {
      case '--develop':
        opts.develop = true;
        break;
      case '--no-open':
        opts.open = false;
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

function resolveConfig(develop) {
  if (develop) {
    return {
      task: 'assembleDevelopDebug',
      outDir: path.join(ANDROID_DIR, 'smart_message/build/outputs/apk/develop/debug'),
      label: 'develop debug',
      renamedPrefix: 'zx-android-develop',
    };
  }

  return {
    task: 'assembleOnTestDebug',
    outDir: path.join(ANDROID_DIR, 'smart_message/build/outputs/apk/onTest/debug'),
    label: 'onTest debug',
    renamedPrefix: 'zx-android-test',
  };
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

function die(msg) {
  if (cli) cli.close();
  console.error(`错误: ${msg}`);
  process.exit(1);
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

async function gradle(tasks) {
  const result = await spawnLogged(GRADLEW, [...tasks, '--console=plain'], {
    cwd: ANDROID_DIR,
    env: process.env,
    classifyLine: classifyGradleLine,
    verbose: cliOpts?.verbose,
    cli,
  });
  if (result.status !== 0) {
    dumpTail(result.outputText);
    throw new Error(`${tasks.join(' ')} 失败 (exit ${result.status})`);
  }
}

function summarize({ mode, ok, apk, size, opened }) {
  const elapsed = formatElapsed(Date.now() - cli.startedAt);
  console.log('');
  console.log(`  ${ink.dim('─'.repeat(42))}`);
  console.log(`  模式    ${mode}`);
  console.log(`  结果    ${ok ? ink.green('成功') : ink.red('失败')}  ${ink.dim(elapsed)}`);
  if (apk) {
    console.log(
      `  产物    ${path.basename(apk)}  ${size ?? ''}${opened ? ink.dim('  已打开产物目录') : ''}`,
    );
    console.log(`  ${ink.dim(apk)}`);
  }
  console.log('');
}

function planSteps(opts) {
  const steps = ['前置检查', 'Gradle'];
  steps.push('重命名产物');
  if (opts.open) steps.push('打开产物');
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
    ink.bold('Android test 包') + ink.dim(`  ·  ${config.label}`),
    ink.dim(config.task),
  ]);

  let apkPath;
  let size;
  let opened = false;

  try {
    next('前置检查');
    cli.succeed(ANDROID_DIR);

    next('Gradle');
    await gradle([config.task]);
    cli.succeed();

    next('重命名产物');
    const apk = findLatestApk(config.outDir);
    if (!apk) {
      throw new Error(`构建完成但未找到 APK（${config.outDir}/*.apk）`);
    }
    const version = parseVersion(path.basename(apk));
    if (!version) {
      throw new Error(`无法从 APK 文件名解析版本号: ${path.basename(apk)}`);
    }
    const renamed = path.join(config.outDir, `${config.renamedPrefix}_v${version}.apk`);
    if (apk !== renamed) {
      if (fs.existsSync(renamed)) fs.unlinkSync(renamed);
      fs.renameSync(apk, renamed);
    }
    apkPath = renamed;
    size = formatSize(fs.statSync(renamed).size);
    cli.succeed(`${path.basename(renamed)}  ${size}`);

    if (opts.open) {
      next('打开产物');
      spawnSync('open', [config.outDir], { stdio: 'inherit' });
      opened = true;
      cli.succeed(config.outDir);
    }
  } catch (err) {
    cli.fail(err.message);
    summarize({ mode: config.label, ok: false, apk: apkPath, size, opened });
    process.exit(1);
  }

  summarize({ mode: config.label, ok: true, apk: apkPath, size, opened });
}

main().catch((err) => {
  if (cli) cli.close();
  console.error(`错误: ${err.message}`);
  process.exit(1);
});

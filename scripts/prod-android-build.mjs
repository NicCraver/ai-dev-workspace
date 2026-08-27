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

// 带模块前缀：只打 app 模块，资源在 app 层合并。
// 无前缀的 assemblePublishRelease 会顺带给 IM / basis_function_api 等 library 模块打 release，
// 触发 library 孤立资源校验 verifyPublishReleaseResources——library 里引用了 app 模块的 drawable
//（如 IM 的 dialog_other_apps.xml 引用 smart_message 的 shape_rect_two_horn），孤立校验看不到 app 资源必挂。
const TASK = ':smart_message:assemblePublishRelease';
const OUT_DIR = path.join(ANDROID_DIR, 'smart_message/build/outputs/apk/publish/release');
const RENAMED_PREFIX = 'zx-android-prod';

/** @type {ReturnType<typeof parseArgs> | null} */
let cliOpts = null;
/** @type {ReturnType<typeof createCli>} */
let cli;

function printHelp() {
  console.log(`用法: prod-android-build [--clean] [选项]

  （无）        Gradle 增量 :smart_message:assemblePublishRelease，重命名，打开产物目录
  --clean       先跑 clean 再全量编（换分支/改 flavor 后建议带上）

  --no-open     成功后不打开产物目录
  --verbose     子进程日志全量输出（默认只留当前 Task + 错误）
`);
}

function parseArgs(argv) {
  const opts = { clean: false, open: true, help: false, verbose: false };

  for (const arg of argv) {
    switch (arg) {
      case '--clean':
        opts.clean = true;
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
  const steps = ['前置检查'];
  if (opts.clean) steps.push('clean');
  steps.push('Gradle', '重命名产物');
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

  const steps = planSteps(opts);
  let stepIndex = 0;
  const total = steps.length;
  const next = (label) => {
    stepIndex += 1;
    cli.begin(stepIndex, total, label);
  };

  cli.header([
    ink.bold('Android prod 包') + ink.dim('  ·  publish release'),
    ink.dim(TASK),
  ]);

  let apkPath;
  let size;
  let opened = false;

  try {
    next('前置检查');
    cli.succeed(ANDROID_DIR);

    if (opts.clean) {
      next('clean');
      await gradle(['clean']);
      cli.succeed();
    }

    next('Gradle');
    await gradle([TASK]);
    cli.succeed();

    next('重命名产物');
    const apk = findLatestApk();
    if (!apk) {
      throw new Error(`构建完成但未找到 APK（${OUT_DIR}/*.apk）`);
    }
    const version = parseVersion(path.basename(apk));
    if (!version) {
      throw new Error(`无法从 APK 文件名解析版本号: ${path.basename(apk)}`);
    }
    const renamed = path.join(OUT_DIR, `${RENAMED_PREFIX}_v${version}.apk`);
    if (apk !== renamed) {
      if (fs.existsSync(renamed)) fs.unlinkSync(renamed);
      fs.renameSync(apk, renamed);
    }
    apkPath = renamed;
    size = formatSize(fs.statSync(renamed).size);
    cli.succeed(`${path.basename(renamed)}  ${size}`);

    if (opts.open) {
      next('打开产物');
      spawnSync('open', [OUT_DIR], { stdio: 'inherit' });
      opened = true;
      cli.succeed(OUT_DIR);
    }
  } catch (err) {
    cli.fail(err.message);
    summarize({
      mode: opts.clean ? 'publish-release + clean' : 'publish-release',
      ok: false,
      apk: apkPath,
      size,
      opened,
    });
    process.exit(1);
  }

  summarize({
    mode: opts.clean ? 'publish-release + clean' : 'publish-release',
    ok: true,
    apk: apkPath,
    size,
    opened,
  });
}

main().catch((err) => {
  if (cli) cli.close();
  console.error(`错误: ${err.message}`);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * PC 端：Mac ARM64 正式（prod）包构建
 * 与 pc-build-test.mjs 同源，差别只有三处：
 *   1. 命名走正式：package.json name=zhiwulianxin，electron-builder productName=zhixin / appId=zhixin.zhiguaniot.com / 快捷方式=智信
 *   2. 构建命令走 pack:mac-prod（MODE_ENV=prod，吃 .env.prod，脚本不改 .env.prod）
 *   3. 产物重命名为 zx-mac-prod_v{version}.dmg（afterAllArtifactBuild 钩子只管 test 包，不会碰它）
 *
 * 工作区约定：apps/desktop 的 package.json / electron-builder.yml / .env.* 本地改动禁止提交。
 * 本脚本对这两个文件的修改是「原文快照 → 打包 → 原样写回」，构建失败或中途异常也会回写。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const DESKTOP = path.join(WORKSPACE_ROOT, 'apps/desktop');
const SNAPSHOT = path.join(os.tmpdir(), 'prod-pc-build-snapshot.json');

const NODE = '14.21.3';
const ELECTRON = '19.0.10';
const PYTHON_CANDIDATES = ['/opt/homebrew/bin/python3.9', '/usr/local/bin/python3.9'];
const PROXY = {
  https_proxy: 'http://127.0.0.1:7890',
  http_proxy: 'http://127.0.0.1:7890',
  all_proxy: 'socks5://127.0.0.1:7890',
};

// 正式包命名（与仓库 HEAD 一致，即未被本地 test 改动污染的值）
const PROD = {
  pkgName: 'zhiwulianxin',
  productName: 'zhixin',
  appId: 'zhixin.zhiguaniot.com',
  shortcutName: '智信',
};
const DMG_PREFIX = 'zx-mac-prod';

const ELECTRON_CACHE = path.join(
  os.homedir(),
  'Library/Caches/electron',
  `electron-v${ELECTRON}-darwin-arm64.zip`,
);

const SYMPTOMS = [
  {
    test: /digital envelope routines::unsupported/,
    hint: '没用 Node 14 → 确认 vp env exec --node 14.21.3 生效',
  },
  {
    test: /zip: not a valid zip file/,
    hint: `删掉损坏缓存后开代理重跑：rm -f ${ELECTRON_CACHE}`,
  },
  {
    test: /env: python: No such file or directory/,
    hint: '先 --native 编原生模块，构建必须带 --config.npmRebuild=false',
  },
  {
    test: /invalid mode: 'rU'|No module named 'distutils'/,
    hint: '确认 Python 3.9；sqlite3 用 node-pre-gyp，leveldown 用 node-gyp@9',
  },
  {
    test: /sqlite3@6|wanted: \{"node":">=20"\}/,
    hint: '装回 sqlite3@5.0.2，勿裸 npm install sqlite3',
  },
  {
    test: /spawn .*Electron ENOENT/,
    hint: '删 node_modules/electron/dist 后跑 node node_modules/electron/install.js',
  },
];

function printHelp() {
  console.log(`用法: prod-pc-build [--dmg-only|--check|--native|--restore] [--proxy] [--no-open]

  （无）        完整流程：检查 → 按需编原生 → 切正式命名 → pack:mac-prod → 验证 → 重命名 → 还原本地配置 → 打开产物目录
  --dmg-only   webpack 已编过，只跑 electron-builder 打 DMG
  --check      仅前置检查（不改任何文件）
  --native     检查后强制重编译 sqlite3 / leveldown
  --restore    仅把 package.json / electron-builder.yml 从快照还原（上次异常中断时用）

  --proxy      全程走 127.0.0.1:7890（下载失败时脚本也会自动重试一次）
  --no-open    成功后不打开 build/ 目录
`);
}

function parseArgs(argv) {
  const opts = { mode: 'full', proxy: false, open: true, help: false };
  let modeSet = false;

  for (const arg of argv) {
    switch (arg) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '--dmg-only':
      case '--check':
      case '--native':
      case '--restore':
        if (modeSet) die(`不能同时指定多个模式（已有 ${opts.mode}，又收到 ${arg}）`);
        opts.mode = arg.slice(2);
        modeSet = true;
        break;
      case '--proxy':
        opts.proxy = true;
        break;
      case '--no-open':
        opts.open = false;
        break;
      default:
        die(`未知参数: ${arg}\n跑 --help 看用法`);
    }
  }
  return opts;
}

function die(msg, extra) {
  console.error(`错误: ${msg}`);
  if (extra) console.error(extra);
  process.exit(1);
}

function fail(msg, extra) {
  if (extra) console.error(extra);
  throw new Error(msg);
}

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

function log(msg) {
  console.log(`==> ${msg}`);
}

function warn(msg) {
  console.log(`警告: ${msg}`);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content);
}

function exists(file) {
  return fs.existsSync(file);
}

function mergeEnv(extra = {}) {
  return { ...process.env, ...extra };
}

function withProxy(env) {
  return { ...env, ...PROXY };
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd ?? DESKTOP,
    env: options.env ?? mergeEnv(),
    encoding: 'utf8',
    stdio: options.stdio ?? ['inherit', 'pipe', 'pipe'],
    shell: options.shell ?? false,
  });

  if (result.error) {
    const err = result.error;
    err.stdout = result.stdout ?? '';
    err.stderr = result.stderr ?? '';
    throw err;
  }

  if (result.stdout && options.stdio !== 'inherit' && !options.quiet) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr && options.stdio !== 'inherit' && !options.quiet) {
    process.stderr.write(result.stderr);
  }

  result.outputText = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return result;
}

function vp(args, options = {}) {
  return run('vp', ['env', 'exec', '--node', NODE, '--', ...args], options);
}

function diagnose(output) {
  const hits = SYMPTOMS.filter((s) => s.test.test(output));
  if (hits.length === 0) return;
  console.error('\n对照 test 包构建流程文档 §7：');
  for (const hit of hits) console.error(`  - ${hit.hint}`);
}

function isDownloadFailure(output) {
  return /zip: not a valid zip file|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|getaddrinfo/i.test(
    output,
  );
}

function runVpRetry(args, options = {}) {
  const env = options.env ?? mergeEnv();
  let result = vp(args, { ...options, env });
  if (result.status === 0) return result;

  const output = result.outputText;
  diagnose(output);

  if (!options.proxyTried && isDownloadFailure(output)) {
    warn('下载失败，开代理重试一次');
    if (/zip: not a valid zip file/.test(output) && exists(ELECTRON_CACHE)) {
      fs.unlinkSync(ELECTRON_CACHE);
      log(`已删除损坏缓存 ${ELECTRON_CACHE}`);
    }
    result = vp(args, { ...options, env: withProxy(env), proxyTried: true });
    if (result.status === 0) return result;
    diagnose(result.outputText);
  }

  const err = new Error(`${args.join(' ')} 失败 (exit ${result.status})`);
  err.outputText = result.outputText;
  throw err;
}

function fileCmd(target) {
  if (!exists(target)) return '';
  const result = spawnSync('file', [target], { encoding: 'utf8' });
  return (result.stdout ?? '').trim();
}

function isArm64(fileOutput) {
  return /\barm64\b/.test(fileOutput);
}

function findSqlite3Node() {
  const candidates = [
    path.join(DESKTOP, 'node_modules/sqlite3/build/Release/node_sqlite3.node'),
    path.join(DESKTOP, 'node_modules/sqlite3/lib/binding/napi-v3-darwin-arm64/node_sqlite3.node'),
  ];
  const bindingRoot = path.join(DESKTOP, 'node_modules/sqlite3/lib/binding');
  if (exists(bindingRoot)) {
    for (const dir of fs.readdirSync(bindingRoot)) {
      const p = path.join(bindingRoot, dir, 'node_sqlite3.node');
      if (exists(p)) candidates.push(p);
    }
  }
  return [...new Set(candidates)].find((p) => exists(p)) ?? null;
}

function findPython() {
  for (const p of PYTHON_CANDIDATES) {
    if (exists(p)) return p;
  }
  const which = spawnSync('which', ['python3.9'], { encoding: 'utf8' });
  const found = (which.stdout ?? '').trim();
  return found && exists(found) ? found : null;
}

function parseDotenv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) values[m[1]] = m[2];
  }
  return values;
}

function readJson(file) {
  return JSON.parse(read(file));
}

/** package.json 的 version 去掉环境后缀（-test / -develop / -stage） */
function stripEnvSuffix(version) {
  return String(version).replace(/-(test|develop|stage)$/, '');
}

const PKG_PATH = path.join(DESKTOP, 'package.json');
const YML_PATH = path.join(DESKTOP, 'electron-builder.yml');
const ENV_PROD_PATH = path.join(DESKTOP, '.env.prod');

function saveSnapshot() {
  write(
    SNAPSHOT,
    `${JSON.stringify(
      { packageJson: read(PKG_PATH), builderYml: read(YML_PATH) },
      null,
      2,
    )}\n`,
  );
}

function loadSnapshot() {
  if (!exists(SNAPSHOT)) return null;
  try {
    return JSON.parse(read(SNAPSHOT));
  } catch {
    return null;
  }
}

/** 把 package.json / electron-builder.yml 原样写回，本地 test 调试配置一字不改地回来 */
function restoreSnapshot({ quiet = false } = {}) {
  const snapshot = loadSnapshot();
  if (!snapshot) {
    if (!quiet) warn(`没有快照 ${SNAPSHOT}，跳过还原`);
    return false;
  }
  if (typeof snapshot.packageJson === 'string') write(PKG_PATH, snapshot.packageJson);
  if (typeof snapshot.builderYml === 'string') write(YML_PATH, snapshot.builderYml);
  fs.unlinkSync(SNAPSHOT);
  log('已还原 package.json / electron-builder.yml（本地 test 配置原样回来）');
  return true;
}

function setProdPackageJson(text) {
  let next = text.replace(/("name"\s*:\s*")[^"]*(")/, `$1${PROD.pkgName}$2`);
  const versionMatch = next.match(/"version"\s*:\s*"([^"]+)"/);
  if (versionMatch) {
    const stripped = stripEnvSuffix(versionMatch[1]);
    if (stripped !== versionMatch[1]) {
      next = next.replace(versionMatch[0], `"version": "${stripped}"`);
    }
  }
  return next;
}

function setProdBuilderYml(text) {
  let next = text
    .replace(/^(\s*shortcutName:\s*).*$/m, `$1"${PROD.shortcutName}"`)
    .replace(/^(\s*uninstallDisplayName:\s*).*$/m, `$1"${PROD.shortcutName}"`)
    .replace(/^(productName:\s*).*$/m, `$1"${PROD.productName}"`)
    .replace(/^(appId:\s*).*$/m, `$1"${PROD.appId}"`);

  // mac.arch 统一 arm64（本机架构，与 test 包脚本一致）
  const macMatch = next.match(/^mac:\n(?:[ \t].*\n|\n)*/m);
  if (macMatch) {
    const patched = macMatch[0].replace(/(arch:\n\s+-\s*)"[^"]*"/, '$1"arm64"');
    next = next.replace(macMatch[0], patched);
  }

  // sqlite3 必须 asarUnpack，否则打包后原生模块加载失败
  if (!/asarUnpack:/.test(next)) {
    const block = 'asarUnpack:\n  - "**/node_modules/sqlite3/**"\n';
    const filesMatch = next.match(/^files:\n(?:[ \t].*\n)*/m);
    next = filesMatch
      ? next.replace(filesMatch[0], `${filesMatch[0]}${block}`)
      : `${next.replace(/\s*$/, '\n')}${block}`;
  }
  return next;
}

function assertDesktop() {
  if (!exists(PKG_PATH)) die(`找不到 desktop 工程 ${DESKTOP}`);
  if (process.platform !== 'darwin') die('仅支持 macOS（Mac ARM64 prod 包）');
}

function assertVp() {
  const result = spawnSync('which', ['vp'], { encoding: 'utf8' });
  if (result.status !== 0) die('找不到 vp，无法切换 Node 14.21.3');
}

function checkNode() {
  const result = vp(['node', '-v'], { stdio: ['ignore', 'pipe', 'pipe'], quiet: true });
  const version = (result.stdout ?? '').trim();
  if (result.status !== 0 || !version.includes('v14.')) {
    fail(`Node 版本不对：${version || '(空)'}，期望 v14.21.3`);
  }
  return version;
}

function preflight() {
  log('§1 前置检查（正式包）');
  const issues = [];
  const fixes = [];

  if (!exists(YML_PATH)) issues.push('缺少 electron-builder.yml');
  if (!exists(ENV_PROD_PATH)) issues.push('缺少 .env.prod');
  if (issues.length) return { ok: false, issues, fixes, sqlite3Arm64: false };

  // .env.prod 是提交在仓库里的正式配置，脚本只读不改
  const envValues = parseDotenv(read(ENV_PROD_PATH));
  for (const key of ['BASE_URL', 'APP_ACTIONCENTER', 'APP_AICHAT']) {
    const value = envValues[key] ?? '';
    console.log(`${key}=${value}`);
    if (!value) issues.push(`.env.prod 缺少 ${key}`);
    else if (/localhost|127\.0\.0\.1|192\.168\./.test(value)) {
      issues.push(`.env.prod ${key}=${value} 指向本地/测试地址，不能打正式包`);
    }
  }

  const pkg = readJson(PKG_PATH);
  const version = stripEnvSuffix(pkg.version);
  console.log(`name=${pkg.name} → 打包时用 ${PROD.pkgName}`);
  console.log(`version=${pkg.version}${version === pkg.version ? '' : ` → ${version}`}`);
  console.log(`volta.node=${pkg.volta?.node}`);
  console.log(`sqlite3=${pkg.dependencies?.sqlite3}`);
  console.log(`leveldown=${pkg.dependencies?.leveldown}`);

  if (pkg.volta?.node !== NODE) issues.push(`volta.node=${pkg.volta?.node}，期望 ${NODE}`);
  if (!/^(\^|~)?5\./.test(String(pkg.dependencies?.sqlite3 ?? ''))) {
    issues.push(`sqlite3=${pkg.dependencies?.sqlite3}，必须是 5.x（禁止 6.x）`);
  }
  if (String(pkg.name).includes('test')) {
    fixes.push(`package.json name=${pkg.name}，打包时临时改为 ${PROD.pkgName}（结束后原样还原）`);
  }

  const yml = read(YML_PATH);
  if (!/productName:\s*"zhixin"\s*$/m.test(yml)) {
    fixes.push(`electron-builder.yml 命名将临时切正式（productName=${PROD.productName} / appId=${PROD.appId} / 快捷方式=${PROD.shortcutName}）`);
  }
  const macMatch = yml.match(/^mac:\n(?:[ \t].*\n|\n)*/m)?.[0] ?? '';
  if (!/\barm64\b/.test(macMatch)) fixes.push('electron-builder.yml mac.arch 将临时改为 arm64');
  if (!/asarUnpack:/.test(yml)) fixes.push('electron-builder.yml 将补 asarUnpack sqlite3');

  console.log(`node ${checkNode()}`);

  const sqlite3Path = findSqlite3Node();
  const sqlite3File = sqlite3Path ? fileCmd(sqlite3Path) : '';
  console.log(sqlite3File || 'sqlite3.node: 未找到');
  const sqlite3Arm64 = isArm64(sqlite3File);
  if (!sqlite3Arm64) fixes.push('sqlite3 不是 arm64，将执行 §2 原生编译');

  for (const f of fixes) warn(f);
  const ok = issues.length === 0;
  if (!ok) for (const i of issues) console.error(`检查失败: ${i}`);
  else log('前置检查通过');

  return { ok, issues, fixes, sqlite3Arm64, version };
}

function applyProdConfig() {
  log('切正式命名（本地临时，结束后原样还原）');
  saveSnapshot();
  write(PKG_PATH, setProdPackageJson(read(PKG_PATH)));
  write(YML_PATH, setProdBuilderYml(read(YML_PATH)));
  const pkg = readJson(PKG_PATH);
  log(`package.json name=${pkg.name} version=${pkg.version}`);
  log(`electron-builder.yml productName=${PROD.productName} appId=${PROD.appId} mac.arch=arm64`);
  return pkg.version;
}

function nativeEnv(python) {
  return mergeEnv({
    PYTHON: python,
    npm_config_python: python,
    npm_config_arch: 'arm64',
    npm_config_target_arch: 'arm64',
    npm_config_target: ELECTRON,
    npm_config_runtime: 'electron',
    npm_config_disturl: 'https://electronjs.org/headers',
    npm_config_build_from_source: 'true',
  });
}

function rebuildSqlite3(python) {
  log('§2.2 编译 sqlite3（node-pre-gyp）');
  const sqliteDir = path.join(DESKTOP, 'node_modules/sqlite3');
  if (!exists(sqliteDir)) fail('没有 node_modules/sqlite3，先在 apps/desktop 安装依赖');

  runVpRetry(
    [
      'npx',
      'node-pre-gyp',
      'rebuild',
      `--target=${ELECTRON}`,
      '--runtime=electron',
      '--target_arch=arm64',
      '--dist-url=https://electronjs.org/headers',
    ],
    { cwd: sqliteDir, env: nativeEnv(python) },
  );

  const binding = path.join(sqliteDir, 'lib/binding/napi-v3-darwin-arm64/node_sqlite3.node');
  const found = exists(binding) ? binding : findSqlite3Node();
  if (!found) fail('编译后仍找不到 node_sqlite3.node');

  const destDir = path.join(sqliteDir, 'build/Release');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, 'node_sqlite3.node');
  fs.copyFileSync(found, dest);
  const info = fileCmd(dest);
  console.log(info);
  if (!isArm64(info)) fail(`sqlite3 仍不是 arm64：${info}`);
}

function rebuildLeveldown(python) {
  log('§2.3 编译 leveldown（node-gyp@9）');
  const dir = path.join(DESKTOP, 'node_modules/leveldown');
  if (!exists(dir)) {
    warn('没有 node_modules/leveldown，跳过');
    return;
  }

  runVpRetry(
    [
      'npx',
      'node-gyp@9',
      'rebuild',
      `--target=${ELECTRON}`,
      '--arch=arm64',
      '--dist-url=https://electronjs.org/headers',
      '--runtime=electron',
    ],
    { cwd: dir, env: mergeEnv({ PYTHON: python, npm_config_python: python, npm_config_arch: 'arm64' }) },
  );

  const info = fileCmd(path.join(dir, 'build/Release/leveldown.node'));
  console.log(info || 'leveldown.node: 未找到');
  if (!isArm64(info)) warn(`leveldown 未检测到 arm64：${info}`);
}

function rebuildNative() {
  const python = findPython();
  if (!python) fail('找不到 Python 3.9', '期望 /opt/homebrew/bin/python3.9');
  log(`PYTHON=${python}`);
  rebuildSqlite3(python);
  rebuildLeveldown(python);
}

function buildFull() {
  log('§3 完整构建 pack:mac-prod');
  runVpRetry(['npm', 'run', 'pack:mac-prod', '--', '--config.npmRebuild=false']);
}

function buildDmgOnly() {
  log('§3 仅 electron-builder 打 DMG（MODE_ENV=prod）');
  runVpRetry(
    ['npx', 'electron-builder', '-c', './electron-builder.yml', '-m', '--config.npmRebuild=false'],
    { env: mergeEnv({ MODE_ENV: 'prod' }) },
  );
}

const BUILD_DIR = path.join(DESKTOP, 'build');

/** 找本次构建产出的 DMG：先认 electron-builder 的默认命名，再兜底认已重命名的正式包 */
function findProdDmg(version) {
  if (!exists(BUILD_DIR)) return null;
  const patterns = [
    new RegExp(`^${PROD.pkgName}_v${version.replace(/\./g, '\\.')}-mac-arm64\\.dmg$`),
    new RegExp(`^${PROD.pkgName}_v.*\\.dmg$`),
    new RegExp(`^${DMG_PREFIX}_v.*\\.dmg$`),
  ];
  const dmgs = fs
    .readdirSync(BUILD_DIR)
    .filter((name) => name.endsWith('.dmg'))
    .map((name) => {
      const fullPath = path.join(BUILD_DIR, name);
      return { name, fullPath, stat: fs.statSync(fullPath) };
    })
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  for (const re of patterns) {
    const hit = dmgs.find((d) => re.test(d.name));
    if (hit) return hit;
  }
  return null;
}

function findUnpackedSqlite3() {
  if (!exists(BUILD_DIR)) return null;
  const result = spawnSync('find', [BUILD_DIR, '-name', 'node_sqlite3.node'], { encoding: 'utf8' });
  const first = (result.stdout ?? '').split('\n').map((s) => s.trim()).find(Boolean);
  return first || null;
}

function verifyAndRename(version) {
  log('§4 验证产物并重命名');
  const dmg = findProdDmg(version);
  if (!dmg) fail(`未找到正式包 DMG（${BUILD_DIR}/${PROD.pkgName}_v*.dmg）`);

  const target = path.join(BUILD_DIR, `${DMG_PREFIX}_v${version}.dmg`);
  if (dmg.fullPath !== target) {
    if (exists(target)) fs.unlinkSync(target);
    fs.renameSync(dmg.fullPath, target);
    log(`重命名 ${dmg.name} → ${path.basename(target)}`);
  }

  const size = fs.statSync(target).size;
  console.log(`${target}  ${formatSize(size)}`);

  const unpacked = findUnpackedSqlite3();
  const sqlite3File = unpacked ? fileCmd(unpacked) : '';
  console.log(sqlite3File || 'app 内 sqlite3.node: 未找到');
  if (unpacked && !isArm64(sqlite3File)) fail(`产物 sqlite3 不是 arm64：${sqlite3File}`);

  return { dmgPath: target, size, sqlite3File };
}

/** 打包不会动 Electron 二进制，这里只体检；异常时才重装，避免本机 dev 起不来 */
function ensureElectronArm64() {
  const dist = path.join(DESKTOP, 'node_modules/electron/dist');
  const bin = path.join(dist, 'Electron.app/Contents/MacOS/Electron');
  const info = fileCmd(bin);
  if (info && isArm64(info)) {
    console.log(info);
    return info;
  }

  warn(`Electron 不是 arm64 或缺失（${info || '未找到'}），重装二进制`);
  fs.rmSync(dist, { recursive: true, force: true });
  runVpRetry(['node', 'node_modules/electron/install.js'], {
    env: mergeEnv({ npm_config_arch: 'arm64' }),
  });
  const after = fileCmd(bin);
  console.log(after || 'Electron: 未找到');
  if (!isArm64(after)) fail(`Electron 仍不是 arm64：${after}`);
  return after;
}

function openBuild() {
  if (!exists(BUILD_DIR)) {
    warn('没有 build/，跳过 open');
    return false;
  }
  log('打开产物目录');
  spawnSync('open', [BUILD_DIR], { stdio: 'inherit' });
  return true;
}

function summarize({ mode, ok, dmgPath, size, sqlite3File, electronFile, opened }) {
  console.log('');
  console.log(`模式: prod / ${mode}`);
  console.log(`结果: ${ok ? '成功' : '失败'}`);
  if (dmgPath) {
    console.log(`产物: ${dmgPath}  ${formatSize(size)}${opened ? '（已 open build）' : ''}`);
  }
  if (sqlite3File) console.log(`校验 sqlite3: ${sqlite3File}`);
  if (electronFile) console.log(`校验 Electron: ${electronFile}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  trackElapsed();
  assertDesktop();

  if (opts.mode === 'restore') {
    const done = restoreSnapshot();
    process.exit(done ? 0 : 1);
  }

  assertVp();

  if (opts.proxy) {
    log('使用代理 127.0.0.1:7890');
    Object.assign(process.env, PROXY);
  }

  let mutated = false;
  let dmgPath;
  let size;
  let sqlite3File;
  let electronFile;
  let opened = false;

  try {
    const check = preflight();
    if (!check.ok) fail('前置检查未通过，已停止（未改动任何文件）');

    if (opts.mode === 'check') {
      const sqlite3 = findSqlite3Node();
      summarize({ mode: opts.mode, ok: true, sqlite3File: sqlite3 ? fileCmd(sqlite3) : '' });
      return;
    }

    if (opts.mode === 'native') {
      rebuildNative();
      const sqlite3 = findSqlite3Node();
      summarize({ mode: opts.mode, ok: true, sqlite3File: sqlite3 ? fileCmd(sqlite3) : '' });
      return;
    }

    if (!check.sqlite3Arm64) rebuildNative();
    else log('sqlite3 已是 arm64，跳过 §2');

    const version = applyProdConfig();
    mutated = true;

    if (opts.mode === 'dmg-only') buildDmgOnly();
    else buildFull();

    const verified = verifyAndRename(version);
    dmgPath = verified.dmgPath;
    size = verified.size;
    sqlite3File = verified.sqlite3File;
  } catch (err) {
    diagnose(err.outputText ?? err.message ?? '');
    console.error(`错误: ${err.message}`);
    if (mutated) {
      warn('构建失败，仍还原本地配置');
      try {
        restoreSnapshot();
      } catch (restoreErr) {
        console.error(`还原失败: ${restoreErr.message}（可手动跑 --restore）`);
      }
    }
    summarize({ mode: opts.mode, ok: false, dmgPath, size, sqlite3File, electronFile, opened });
    process.exit(1);
  }

  try {
    restoreSnapshot();
    electronFile = ensureElectronArm64();
  } catch (err) {
    diagnose(err.outputText ?? err.message ?? '');
    die(`还原本地配置失败: ${err.message}（可手动跑 --restore）`);
  }

  if (opts.open && dmgPath) opened = openBuild();

  summarize({ mode: opts.mode, ok: true, dmgPath, size, sqlite3File, electronFile, opened });
}

main();

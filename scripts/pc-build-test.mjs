#!/usr/bin/env node
/**
 * PC 端：Mac ARM64 test 包构建
 * 流程对照 apps/desktop/docs/Mac ARM64 test 包构建流程.md
 * 工作区根目录入口，desktop 工程在 apps/desktop
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const DESKTOP = path.join(WORKSPACE_ROOT, 'apps/desktop');
const SNAPSHOT = path.join(os.tmpdir(), 'pc-build-test-env-snapshot.json');

const NODE = '14.21.3';
const ELECTRON = '19.0.10';
const PYTHON_CANDIDATES = [
  '/opt/homebrew/bin/python3.9',
  '/usr/local/bin/python3.9',
];
const PROXY = {
  https_proxy: 'http://127.0.0.1:7890',
  http_proxy: 'http://127.0.0.1:7890',
  all_proxy: 'socks5://127.0.0.1:7890',
};
const PACK_ENV = {
  APP_ACTIONCENTER: 'http://192.168.10.25/action-center',
  APP_AICHAT: 'http://192.168.10.25/ai-chat',
};
const DEV_ENV = {
  APP_ACTIONCENTER: 'http://localhost:6173/action-center',
  APP_AICHAT: 'http://localhost:6173/ai-chat',
};
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
    test: /Undefined variable module_name/,
    hint: '不要裸跑 node-gyp 编 sqlite3，改用 node-pre-gyp',
  },
  {
    test: /sqlite3@6|wanted: \{"node":">=20"\}/,
    hint: '装回 sqlite3@5.0.2，勿裸 npm install sqlite3',
  },
  {
    test: /spawn .*Electron ENOENT/,
    hint: '执行 --recover 重装 Electron 二进制',
  },
];

function printHelp() {
  console.log(`用法: pc-build-test [--dmg-only|--check|--recover|--native] [--proxy] [--no-open]

  （无）        完整流程：检查 → 按需编原生 → 构建 → 验证 → 恢复本地 dev → 打开产物
  --dmg-only   webpack 已编过，只打 DMG
  --check      仅前置检查
  --recover    仅构建后恢复本地 dev
  --native     检查后强制重编译 sqlite3 / leveldown

  --proxy      全程走 127.0.0.1:7890（下载失败时脚本也会自动重试一次）
  --no-open    成功后不打开 build/ 目录
`);
}

function parseArgs(argv) {
  const opts = {
    mode: 'full',
    proxy: false,
    open: true,
    help: false,
  };
  let modeSet = false;

  for (const arg of argv) {
    switch (arg) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '--dmg-only':
      case '--check':
      case '--recover':
      case '--native':
        if (modeSet) {
          die(`不能同时指定多个模式（已有 ${opts.mode}，又收到 ${arg}）`);
        }
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
  const env = { ...process.env, ...extra };
  return env;
}

function withProxy(env) {
  return { ...env, ...PROXY };
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
  console.error('\n对照文档 §7：');
  for (const hit of hits) {
    console.error(`  - ${hit.hint}`);
  }
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
    path.join(
      DESKTOP,
      'node_modules/sqlite3/lib/binding/napi-v3-darwin-arm64/node_sqlite3.node',
    ),
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

function setDotenvVars(content, map) {
  let next = content;
  for (const [key, value] of Object.entries(map)) {
    const re = new RegExp(`^(${key}=).*`, 'm');
    if (re.test(next)) next = next.replace(re, `$1${value}`);
    else next += `${next.endsWith('\n') ? '' : '\n'}${key}=${value}\n`;
  }
  return next;
}

function readJson(file) {
  return JSON.parse(read(file));
}

function loadSnapshot() {
  if (!exists(SNAPSHOT)) return null;
  try {
    return JSON.parse(read(SNAPSHOT));
  } catch {
    return null;
  }
}

function saveSnapshot(data) {
  write(SNAPSHOT, `${JSON.stringify(data, null, 2)}\n`);
}

function recoverTargetsFromCurrentEnv(envValues) {
  const out = {};
  for (const key of Object.keys(PACK_ENV)) {
    const current = envValues[key] ?? '';
    if (current.includes('localhost')) out[key] = current;
    else out[key] = DEV_ENV[key];
  }
  return out;
}

function patchMacArm64(yml) {
  const macMatch = yml.match(/^mac:\n(?:[ \t].*\n|\n)*/m);
  if (!macMatch) return { yml, changed: false };
  const original = macMatch[0];
  if (/\barm64\b/.test(original)) return { yml, changed: false };
  const patched = original.replace(
    /arch:\n(\s+)-\s*"x64"/,
    'arch:\n$1- "arm64"',
  );
  if (patched === original) return { yml, changed: false };
  return { yml: yml.replace(original, patched), changed: true };
}

function ensureAsarUnpack(yml) {
  if (/asarUnpack:/.test(yml)) return { yml, changed: false };
  const block = 'asarUnpack:\n  - "**/node_modules/sqlite3/**"\n';
  const filesMatch = yml.match(/^files:\n(?:[ \t].*\n)*/m);
  if (filesMatch) {
    return { yml: yml.replace(filesMatch[0], `${filesMatch[0]}${block}`), changed: true };
  }
  return { yml: `${yml.replace(/\s*$/, '\n')}${block}`, changed: true };
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function findDmgs() {
  const dir = path.join(DESKTOP, 'build');
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^zx-mac-test_v.*\.dmg$/.test(name))
    .map((name) => {
      const fullPath = path.join(dir, name);
      return { fullPath, size: fs.statSync(fullPath).size, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function findUnpackedSqlite3() {
  const root = path.join(DESKTOP, 'build');
  if (!exists(root)) return null;
  const result = spawnSync(
    'find',
    [root, '-name', 'node_sqlite3.node'],
    { encoding: 'utf8' },
  );
  const first = (result.stdout ?? '').split('\n').map((s) => s.trim()).find(Boolean);
  return first || null;
}

function assertDesktop() {
  if (!exists(path.join(DESKTOP, 'package.json'))) {
    die(`找不到 desktop 工程 ${DESKTOP}`);
  }
  if (process.platform !== 'darwin') {
    die('仅支持 macOS（Mac ARM64 test 包）');
  }
}

function assertVp() {
  const result = spawnSync('which', ['vp'], { encoding: 'utf8' });
  if (result.status !== 0) {
    die('找不到 vp，无法切换 Node 14.21.3');
  }
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
  log('§1 前置检查');
  const issues = [];
  const fixes = [];

  const envPath = path.join(DESKTOP, '.env.test');
  const pkgPath = path.join(DESKTOP, 'package.json');
  const ymlPath = path.join(DESKTOP, 'electron-builder.yml');

  if (!exists(envPath)) issues.push('缺少 .env.test');
  if (!exists(pkgPath)) issues.push('缺少 package.json');
  if (!exists(ymlPath)) issues.push('缺少 electron-builder.yml');
  if (issues.length) return { ok: false, issues, fixes, sqlite3Arm64: false };

  const envValues = parseDotenv(read(envPath));
  for (const [key, packValue] of Object.entries(PACK_ENV)) {
    const current = envValues[key] ?? '';
    console.log(`${key}=${current}`);
    if (current.includes('localhost')) {
      fixes.push(`.env.test ${key} 是 localhost，打包时会改成 ${packValue}`);
    } else if (current !== packValue) {
      issues.push(`.env.test ${key}=${current}，期望打包值为 ${packValue}`);
    }
  }

  const pkg = readJson(pkgPath);
  console.log(`name=${pkg.name}`);
  console.log(`volta.node=${pkg.volta?.node}`);
  console.log(`leveldown=${pkg.dependencies?.leveldown}`);
  console.log(`sqlite3=${pkg.dependencies?.sqlite3}`);

  if (!String(pkg.name || '').includes('test')) {
    issues.push(`package.json name=${pkg.name}，应含 -test`);
  }
  if (pkg.volta?.node !== NODE) {
    issues.push(`volta.node=${pkg.volta?.node}，期望 ${NODE}`);
  }
  if (!/^(\^|~)?5\./.test(String(pkg.dependencies?.sqlite3 ?? ''))) {
    issues.push(`sqlite3=${pkg.dependencies?.sqlite3}，必须是 5.x（禁止 6.x）`);
  }
  if (!/^(\^|~)?6\./.test(String(pkg.dependencies?.leveldown ?? ''))) {
    warn(`leveldown=${pkg.dependencies?.leveldown}，文档建议 ^6.1.1（将按现有版本编译）`);
  }

  const yml = read(ymlPath);
  const ymlNeedles = {
    shortcutName: /shortcutName:\s*"智信-test"/,
    uninstallDisplayName: /uninstallDisplayName:\s*"智信-test"/,
    productName: /productName:\s*"zhixin-test"/,
    appId: /appId:\s*"zhixin-test\.zhiguaniot\.com"/,
  };
  for (const [name, re] of Object.entries(ymlNeedles)) {
    if (!re.test(yml)) issues.push(`electron-builder.yml ${name} 不是 test 命名`);
  }
  const macMatch = yml.match(/^mac:\n(?:[ \t].*\n|\n)*/m)?.[0] ?? '';
  if (!/\barm64\b/.test(macMatch)) {
    fixes.push('electron-builder.yml mac.arch 将改为 arm64（本地改，不提交）');
  }
  if (!/asarUnpack:/.test(yml)) {
    fixes.push('electron-builder.yml 将补 asarUnpack: **/node_modules/sqlite3/**（本地改，不提交）');
  }

  const nodeVersion = checkNode();
  console.log(`node ${nodeVersion}`);

  const sqlite3Path = findSqlite3Node();
  const sqlite3File = sqlite3Path ? fileCmd(sqlite3Path) : '';
  console.log(sqlite3File || 'sqlite3.node: 未找到');
  const sqlite3Arm64 = isArm64(sqlite3File);
  if (!sqlite3Arm64) {
    fixes.push('sqlite3 不是 arm64，将执行 §2 原生编译');
  }

  const ok = issues.length === 0;
  if (fixes.length) {
    for (const f of fixes) warn(f);
  }
  if (!ok) {
    for (const i of issues) console.error(`检查失败: ${i}`);
  } else {
    log('前置检查通过');
  }
  return { ok, issues, fixes, sqlite3Arm64, envValues };
}

function applyPackConfig(envValues) {
  log('应用打包配置（本地临时，不提交）');
  const envPath = path.join(DESKTOP, '.env.test');
  const ymlPath = path.join(DESKTOP, 'electron-builder.yml');

  const recoverEnv = recoverTargetsFromCurrentEnv(envValues);
  saveSnapshot({ env: recoverEnv });

  let envContent = read(envPath);
  envContent = setDotenvVars(envContent, PACK_ENV);
  write(envPath, envContent);
  log('.env.test 已切到 192.168.10.25');

  let yml = read(ymlPath);
  const arch = patchMacArm64(yml);
  yml = arch.yml;
  const unpack = ensureAsarUnpack(yml);
  yml = unpack.yml;
  if (arch.changed || unpack.changed) {
    write(ymlPath, yml);
    if (arch.changed) log('electron-builder.yml mac.arch → arm64');
    if (unpack.changed) log('electron-builder.yml 已补 asarUnpack sqlite3');
  }
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

  const binding = path.join(
    sqliteDir,
    'lib/binding/napi-v3-darwin-arm64/node_sqlite3.node',
  );
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

  const env = mergeEnv({
    PYTHON: python,
    npm_config_python: python,
    npm_config_arch: 'arm64',
  });

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
    { cwd: dir, env },
  );

  const nodePath = path.join(dir, 'build/Release/leveldown.node');
  const info = fileCmd(nodePath);
  console.log(info || 'leveldown.node: 未找到');
  if (!isArm64(info)) warn(`leveldown 未检测到 arm64：${info}`);
}

function rebuildNative() {
  const python = findPython();
  if (!python) {
    fail('找不到 Python 3.9', '期望 /opt/homebrew/bin/python3.9');
  }
  log(`PYTHON=${python}`);
  rebuildSqlite3(python);
  rebuildLeveldown(python);
}

function buildFull() {
  log('§3 完整构建 pack:mac-test');
  runVpRetry([
    'npm',
    'run',
    'pack:mac-test',
    '--',
    '--config.npmRebuild=false',
  ]);
}

function buildDmgOnly() {
  log('§3 仅 electron-builder 打 DMG');
  runVpRetry(
    [
      'npx',
      'electron-builder',
      '-c',
      './electron-builder.yml',
      '-m',
      '--config.npmRebuild=false',
    ],
    { env: mergeEnv({ MODE_ENV: 'test' }) },
  );
}

function verify() {
  log('§4 验证产物');
  const dmgs = findDmgs();
  if (dmgs.length === 0) fail('未找到 build/zx-mac-test_v*.dmg');
  for (const dmg of dmgs) {
    console.log(`${dmg.fullPath}  ${formatSize(dmg.size)}`);
  }

  const unpacked = findUnpackedSqlite3();
  const info = unpacked ? fileCmd(unpacked) : '';
  console.log(info || 'app 内 sqlite3.node: 未找到');
  if (unpacked && !isArm64(info)) {
    fail(`产物 sqlite3 不是 arm64：${info}`);
  }
  return { dmg: dmgs[0], sqlite3File: info };
}

function recover() {
  log('§6 恢复本地 dev');

  const envPath = path.join(DESKTOP, '.env.test');
  const pkgPath = path.join(DESKTOP, 'package.json');
  const snapshot = loadSnapshot();
  const envValues = exists(envPath) ? parseDotenv(read(envPath)) : {};
  const recoverEnv = snapshot?.env ?? recoverTargetsFromCurrentEnv(envValues);

  if (exists(envPath)) {
    write(envPath, setDotenvVars(read(envPath), recoverEnv));
    log(`.env.test 已还原 ${recoverEnv.APP_ACTIONCENTER} / ${recoverEnv.APP_AICHAT}`);
  }

  if (exists(pkgPath)) {
    const pkgText = read(pkgPath);
    const versionMatch = pkgText.match(/"version"\s*:\s*"([^"]+)"/);
    const version = versionMatch?.[1] ?? '';
    if (version.endsWith('-test')) {
      const next = version.slice(0, -5);
      write(pkgPath, pkgText.replace(versionMatch[0], `"version": "${next}"`));
      log(`package.json version 已去掉 -test → ${next}`);
    } else {
      log(`package.json version=${version}（无需改）`);
    }
  }

  log('§6.3 重装 Electron 二进制');
  const dist = path.join(DESKTOP, 'node_modules/electron/dist');
  fs.rmSync(dist, { recursive: true, force: true });
  runVpRetry(['node', 'node_modules/electron/install.js'], {
    env: mergeEnv({ npm_config_arch: 'arm64' }),
  });

  const electronBin = path.join(dist, 'Electron.app/Contents/MacOS/Electron');
  const electronFile = fileCmd(electronBin);
  console.log(electronFile || 'Electron: 未找到');
  if (!isArm64(electronFile)) {
    fail(`Electron 不是 arm64：${electronFile}`);
  }

  const sqlite3 = findSqlite3Node();
  const sqlite3File = sqlite3 ? fileCmd(sqlite3) : '';
  const leveldown = path.join(
    DESKTOP,
    'node_modules/leveldown/build/Release/leveldown.node',
  );
  const leveldownFile = fileCmd(leveldown);
  console.log(sqlite3File || 'sqlite3.node: 未找到');
  console.log(leveldownFile || 'leveldown.node: 未找到');
  if (sqlite3 && !isArm64(sqlite3File)) {
    warn('sqlite3 恢复后不是 arm64，需要 --native');
  }

  if (exists(SNAPSHOT)) fs.unlinkSync(SNAPSHOT);
  log('§6 完成；dev:test 请手动：vp env exec --node 14.21.3 -- npm run dev:test');
  return { electronFile, sqlite3File };
}

function openBuild() {
  const dir = path.join(DESKTOP, 'build');
  if (!exists(dir)) {
    warn('没有 build/，跳过 open');
    return;
  }
  log('打开产物目录');
  spawnSync('open', [dir], { stdio: 'inherit' });
}

function summarize({ mode, ok, dmg, sqlite3File, electronFile, opened }) {
  console.log('');
  console.log(`模式: ${mode}`);
  console.log(`结果: ${ok ? '成功' : '失败'}`);
  if (dmg) {
    console.log(`产物: ${dmg.fullPath}  ${formatSize(dmg.size)}${opened ? '（已 open build）' : ''}`);
  }
  if (sqlite3File) console.log(`校验 sqlite3: ${sqlite3File}`);
  if (electronFile) console.log(`校验 Electron: ${electronFile}`);
  if (ok && (mode === 'full' || mode === 'dmg-only')) {
    console.log('§6 恢复: .env.test / version / Electron 已处理；dev:test 需手动验证');
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  trackElapsed();
  assertDesktop();
  assertVp();

  if (opts.proxy) {
    log('使用代理 127.0.0.1:7890');
    Object.assign(process.env, PROXY);
  }

  let mutated = false;
  let dmg;
  let sqlite3File;
  let electronFile;
  let opened = false;

  try {
    if (opts.mode === 'recover') {
      const recovered = recover();
      electronFile = recovered.electronFile;
      sqlite3File = recovered.sqlite3File;
      summarize({ mode: opts.mode, ok: true, sqlite3File, electronFile, opened });
      return;
    }

    const check = preflight();
    if (!check.ok) {
      fail('前置检查未通过，已停止');
    }

    if (opts.mode === 'check') {
      summarize({ mode: opts.mode, ok: true, sqlite3File: findSqlite3Node() ? fileCmd(findSqlite3Node()) : '' });
      return;
    }

    if (opts.mode === 'native') {
      rebuildNative();
      const sqlite3 = findSqlite3Node();
      summarize({
        mode: opts.mode,
        ok: true,
        sqlite3File: sqlite3 ? fileCmd(sqlite3) : '',
      });
      return;
    }

    applyPackConfig(check.envValues);
    mutated = true;

    if (!check.sqlite3Arm64 || opts.mode === 'native') {
      rebuildNative();
    } else {
      log('sqlite3 已是 arm64，跳过 §2');
    }

    if (opts.mode === 'dmg-only') buildDmgOnly();
    else buildFull();

    const verified = verify();
    dmg = verified.dmg;
    sqlite3File = verified.sqlite3File;
  } catch (err) {
    diagnose(err.outputText ?? err.message ?? '');
    console.error(`错误: ${err.message}`);
    if (mutated) {
      warn('构建失败，仍执行 §6 恢复，避免本机 dev:test 起不来');
      try {
        const recovered = recover();
        electronFile = recovered.electronFile;
        sqlite3File = sqlite3File ?? recovered.sqlite3File;
      } catch (recoverErr) {
        console.error(`恢复也失败: ${recoverErr.message}`);
      }
    }
    summarize({ mode: opts.mode, ok: false, dmg, sqlite3File, electronFile, opened });
    process.exit(1);
  }

  try {
    const recovered = recover();
    electronFile = recovered.electronFile;
    sqlite3File = sqlite3File ?? recovered.sqlite3File;
  } catch (err) {
    diagnose(err.outputText ?? err.message ?? '');
    die(`§6 恢复失败: ${err.message}`);
  }

  if (opts.open && dmg) {
    openBuild();
    opened = true;
  }

  summarize({ mode: opts.mode, ok: true, dmg, sqlite3File, electronFile, opened });
}

main();

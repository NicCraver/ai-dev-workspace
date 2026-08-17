#!/usr/bin/env node
/**
 * PC 端：Mac ARM64 test 包构建
 * 流程对照 apps/desktop/docs/Mac ARM64 test 包构建流程.md
 * 工作区根目录入口，desktop 工程在 apps/desktop
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

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
const MAX_CAPTURE = 256 * 1024;

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

const NOISE_RE =
  /^(Hash:|Version: webpack|Time:|Built at:|Entrypoint |Child |WARNING in chunk)|\b\[(emitted|built|from \d+ modules)\]|^\+\s+\d+ hidden|Hidden modules|^\s*Asset\s+Size|lets-build|^-{5,}(after pack|afterAllArtifactBuild)|^\s*\[.+\d+\/\d+\]/;

/** @type {ReturnType<typeof parseArgs> | null} */
let cliOpts = null;
/** @type {ReturnType<typeof createCli>} */
let cli;
/** @type {import('node:child_process').ChildProcess | null} */
let currentChild = null;

function printHelp() {
  console.log(`用法: pc-build-test [--dmg-only|--check|--recover|--native] [选项]

  （无）        完整流程：检查 → 按需编原生 → webpack → DMG → 验证 → 恢复本地 → 打开产物
  --dmg-only   webpack 已编过，只打 DMG
  --check      仅前置检查
  --recover    仅构建后恢复本地 dev（强制重装 Electron）
  --native     检查后强制重编译 sqlite3 / leveldown

  --proxy      全程走 127.0.0.1:7890（下载失败时脚本也会自动重试一次）
  --no-open    成功后不打开 build/ 目录
  --verbose    子进程日志全量输出（默认只留关键行 + 进度）
  --compress=  electron-builder 压缩：normal（默认，更快）| maximum | store
`);
}

function parseArgs(argv) {
  const opts = {
    mode: 'full',
    proxy: false,
    open: true,
    help: false,
    verbose: false,
    compress: 'normal',
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
      case '-v':
      case '--verbose':
        opts.verbose = true;
        break;
      default: {
        const compress = arg.match(/^--compress=(normal|maximum|store)$/);
        if (compress) {
          opts.compress = compress[1];
          break;
        }
        die(`未知参数: ${arg}\n跑 --help 看用法`);
      }
    }
  }
  return opts;
}

function colorEnabled() {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === '0') return false;
  return Boolean(process.stdout.isTTY);
}

function paint(code, text) {
  return colorEnabled() ? `\x1B[${code}m${text}\x1B[0m` : text;
}

const ink = {
  bold: (s) => paint('1', s),
  dim: (s) => paint('2', s),
  red: (s) => paint('31', s),
  green: (s) => paint('32', s),
  yellow: (s) => paint('33', s),
  cyan: (s) => paint('36', s),
  gray: (s) => paint('90', s),
};

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

function bar(width, ratio, pulse = 0) {
  const w = Math.max(8, width);
  if (ratio == null) {
    const pos = pulse % (w + 4) - 2;
    let out = '';
    for (let i = 0; i < w; i += 1) {
      out += i >= pos && i < pos + 4 ? '█' : '░';
    }
    return out;
  }
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * w);
  return '█'.repeat(filled) + '░'.repeat(w - filled);
}

function createCli() {
  const tty = Boolean(process.stdout.isTTY);
  const startedAt = Date.now();
  let liveLines = 0;
  let timer = null;
  let pulse = 0;
  let cursorHidden = false;
  const state = {
    total: 0,
    index: 0,
    label: '',
    note: '',
    fraction: null,
    stepStartedAt: 0,
  };

  function hideCursor() {
    if (tty && !cursorHidden) {
      process.stdout.write('\x1B[?25l');
      cursorHidden = true;
    }
  }

  function showCursor() {
    if (cursorHidden) {
      process.stdout.write('\x1B[?25h');
      cursorHidden = false;
    }
  }

  function clearLive() {
    if (!tty || liveLines <= 0) return;
    process.stdout.write(`\x1B[${liveLines}A\x1B[0J`);
    liveLines = 0;
  }

  function liveBlock() {
    const cols = Math.max(40, Math.min(process.stdout.columns || 80, 88));
    const barWidth = Math.min(28, cols - 18);
    const overall =
      state.total > 0
        ? (state.index - 1 + (state.fraction ?? (pulse % 20) / 40)) / state.total
        : 0;
    const elapsed = formatElapsed(Date.now() - startedAt);
    const stepMs = state.stepStartedAt
      ? formatElapsed(Date.now() - state.stepStartedAt)
      : '';
    const head = `  ${ink.cyan(bar(barWidth, overall, pulse))}  ${ink.bold(`${state.index}/${state.total}`)}  ${elapsed}`;
    const current = `  ${ink.cyan('▸')} ${state.label}${stepMs ? ink.dim(`  ${stepMs}`) : ''}`;
    const note = state.note ? `  ${ink.gray(truncate(state.note, cols - 4))}` : '';
    return [head, current, note].filter(Boolean).join('\n') + '\n';
  }

  function redraw() {
    if (!tty || !state.label) return;
    hideCursor();
    clearLive();
    const text = liveBlock();
    process.stdout.write(text);
    liveLines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  }

  function startPulse() {
    stopPulse();
    if (!tty) return;
    timer = setInterval(() => {
      pulse += 1;
      redraw();
    }, 90);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stopPulse() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    startedAt,
    header(lines) {
      console.log('');
      for (const line of lines) console.log(`  ${line}`);
      console.log('');
    },
    begin(index, total, label) {
      stopPulse();
      clearLive();
      state.total = total;
      state.index = index;
      state.label = label;
      state.note = '';
      state.fraction = null;
      state.stepStartedAt = Date.now();
      if (tty) {
        startPulse();
        redraw();
      } else {
        console.log(`==> [${index}/${total}] ${label}`);
      }
    },
    note(text, fraction) {
      const next = String(text || '').replace(/\s+/g, ' ').trim();
      if (!next) return;
      if (typeof fraction === 'number' && Number.isFinite(fraction)) {
        state.fraction = Math.min(1, Math.max(0, fraction));
      }
      state.note = next;
      if (tty) redraw();
      else console.log(`    ${next}`);
    },
    succeed(detail) {
      const ms = Date.now() - state.stepStartedAt;
      stopPulse();
      clearLive();
      const extra = detail || formatElapsed(ms);
      console.log(`  ${ink.green('✓')} ${state.label}  ${ink.dim(extra)}`);
      state.label = '';
      state.note = '';
      liveLines = 0;
    },
    skip(detail) {
      this.succeed(detail || '跳过');
    },
    fail(detail) {
      stopPulse();
      clearLive();
      console.log(`  ${ink.red('✕')} ${state.label || '失败'}  ${ink.red(detail || '')}`);
      state.label = '';
      liveLines = 0;
    },
    warn(msg) {
      const restart = Boolean(state.label && tty);
      if (restart) clearLive();
      console.log(`  ${ink.yellow('⚠')} ${msg}`);
      if (restart) redraw();
    },
    persist(msg) {
      const restart = Boolean(state.label && tty);
      if (restart) clearLive();
      console.log(`  ${ink.dim(msg)}`);
      if (restart) redraw();
    },
    error(msg) {
      const restart = Boolean(state.label && tty);
      if (restart) clearLive();
      console.error(`  ${ink.red('错误')} ${msg}`);
      if (restart) redraw();
    },
    close() {
      stopPulse();
      clearLive();
      showCursor();
    },
  };
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function stripDangerousAnsi(text) {
  return text
    .replace(/\x1B\[[0-9;]*[Hf]/g, '')
    .replace(/\x1B\[[0-3]?J/g, '')
    .replace(/\x1B\[\?25[lh]/g, '')
    .replace(/\x1B\[\d+[ABCD]/g, '')
    .replace(/\x1B\[[su]/g, '');
}

function builderFraction(msg) {
  if (/electron-builder/.test(msg)) return 0.08;
  if (/loaded configuration|writing effective/.test(msg)) return 0.12;
  if (/packaging/.test(msg)) return 0.45;
  if (/building.*(?:dmg|nsis)|target=DMG/i.test(msg)) return 0.78;
  if (/renamed|afterAllArtifactBuild/.test(msg)) return 0.96;
  return null;
}

function classifyLine(raw, verbose) {
  const cleaned = stripDangerousAnsi(raw);
  const plain = stripVTControlCharacters(cleaned).trim();
  if (!plain) return null;

  if (/error|fail|gyp ERR!/i.test(plain) && !/0 error/i.test(plain)) {
    return { text: plain, persist: true, fraction: null };
  }

  if (verbose) return { text: plain, persist: true, fraction: null };
  if (NOISE_RE.test(plain)) return null;

  const pct = plain.match(/(?:^|[^\d.])(\d{1,3}(?:\.\d+)?)\s*%/);
  const fractionFromPct =
    pct && Number(pct[1]) <= 100 ? Number(pct[1]) / 100 : null;

  const bullet = plain.match(/^•\s+(.+)/);
  if (bullet) {
    return {
      text: bullet[1],
      persist: false,
      fraction: builderFraction(bullet[1]) ?? fractionFromPct,
    };
  }

  if (/take it away/.test(plain)) {
    return { text: 'webpack 完成，交给 electron-builder', persist: false, fraction: 0.5 };
  }
  if (/building (main|renderer)/i.test(plain)) {
    return { text: plain, persist: false, fraction: 0.22 };
  }
  if (/\[afterAllArtifactBuild\].*renamed/.test(plain)) {
    return { text: plain, persist: true, fraction: 0.98 };
  }
  if (/SOLINK_MODULE|node-pre-gyp.*ok|built to |installing electron/i.test(plain)) {
    return { text: plain, persist: false, fraction: fractionFromPct };
  }
  if (fractionFromPct != null) {
    return { text: plain, persist: false, fraction: fractionFromPct };
  }
  return null;
}

function die(msg, extra) {
  if (cli) cli.close();
  console.error(`错误: ${msg}`);
  if (extra) console.error(extra);
  process.exit(1);
}

function fail(msg, extra) {
  if (extra) console.error(extra);
  throw new Error(msg);
}

function log(msg) {
  if (cli) cli.persist(msg);
  else console.log(`==> ${msg}`);
}

function warn(msg) {
  if (cli) cli.warn(msg);
  else console.log(`警告: ${msg}`);
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

function packEnv() {
  return mergeEnv({
    MODE_ENV: 'test',
    CI: '1',
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    FORCE_COLOR: colorEnabled() ? '1' : '0',
  });
}

function appendCapture(buf, chunk) {
  const next = buf + chunk;
  return next.length > MAX_CAPTURE ? next.slice(-MAX_CAPTURE) : next;
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd ?? DESKTOP,
      env: options.env ?? mergeEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: options.shell ?? false,
    });

    let captured = '';
    let stdout = '';
    let stderr = '';
    let stdoutBuf = '';
    let stderrBuf = '';

    const handleChunk = (chunk, stream) => {
      captured = appendCapture(captured, chunk);
      if (stream === 'stdout') stdout += chunk;
      else stderr += chunk;

      let buf = stream === 'stdout' ? stdoutBuf : stderrBuf;
      buf += stripDangerousAnsi(chunk);
      const parts = buf.split(/\r|\n/);
      buf = parts.pop() ?? '';
      if (stream === 'stdout') stdoutBuf = buf;
      else stderrBuf = buf;

      for (const line of parts) {
        const classified = classifyLine(line, options.verbose ?? cliOpts?.verbose);
        if (!classified) continue;
        if (classified.persist) cli.persist(classified.text);
        else cli.note(classified.text, classified.fraction);
        if (options.onLine) options.onLine(classified);
      }
    };

    currentChild = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => handleChunk(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => handleChunk(chunk, 'stderr'));

    child.on('error', (err) => {
      if (currentChild === child) currentChild = null;
      err.stdout = stdout;
      err.stderr = stderr;
      err.outputText = captured;
      reject(err);
    });

    child.on('close', (status) => {
      if (currentChild === child) currentChild = null;
      for (const leftover of [stdoutBuf, stderrBuf]) {
        if (!leftover.trim()) continue;
        const classified = classifyLine(leftover, options.verbose ?? cliOpts?.verbose);
        if (!classified) continue;
        if (classified.persist) cli.persist(classified.text);
        else cli.note(classified.text, classified.fraction);
      }
      resolve({
        status: status ?? 1,
        stdout,
        stderr,
        outputText: captured,
      });
    });
  });
}

function runSync(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: options.cwd ?? DESKTOP,
    env: options.env ?? mergeEnv(),
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    shell: options.shell ?? false,
  });
}

function vp(args, options = {}) {
  return run('vp', ['env', 'exec', '--node', NODE, '--', ...args], options);
}

function diagnose(output) {
  const hits = SYMPTOMS.filter((s) => s.test.test(output));
  if (hits.length === 0) return;
  console.error(`\n  ${ink.yellow('对照文档 §7：')}`);
  for (const hit of hits) {
    console.error(`  ${ink.dim('·')} ${hit.hint}`);
  }
}

function killCurrentChild() {
  if (!currentChild || currentChild.killed) return;
  try {
    currentChild.kill('SIGTERM');
  } catch {
    // 进程可能已退出
  }
}

function isDownloadFailure(output) {
  return /zip: not a valid zip file|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|getaddrinfo/i.test(
    output,
  );
}

async function runVpRetry(args, options = {}) {
  const env = options.env ?? mergeEnv();
  let result = await vp(args, { ...options, env });
  if (result.status === 0) return result;

  const output = result.outputText;
  diagnose(output);

  if (!options.proxyTried && isDownloadFailure(output)) {
    warn('下载失败，开代理重试一次');
    if (/zip: not a valid zip file/.test(output) && exists(ELECTRON_CACHE)) {
      fs.unlinkSync(ELECTRON_CACHE);
      log(`已删除损坏缓存 ${ELECTRON_CACHE}`);
    }
    result = await vp(args, { ...options, env: withProxy(env), proxyTried: true });
    if (result.status === 0) return result;
    diagnose(result.outputText);
  }

  const tail = result.outputText.trim().split(/\r?\n/).slice(-40).join('\n');
  if (tail) console.error(`\n${ink.dim(tail)}\n`);
  const err = new Error(`${args.join(' ')} 失败 (exit ${result.status})`);
  err.outputText = result.outputText;
  throw err;
}

function fileCmd(target) {
  if (!exists(target)) return '';
  const result = runSync('file', [target]);
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

function findLeveldownNode() {
  const p = path.join(DESKTOP, 'node_modules/leveldown/build/Release/leveldown.node');
  return exists(p) ? p : null;
}

function findPython() {
  for (const p of PYTHON_CANDIDATES) {
    if (exists(p)) return p;
  }
  const which = runSync('which', ['python3.9']);
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
      const st = fs.statSync(fullPath);
      return { fullPath, size: st.size, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function findUnpackedSqlite3() {
  const roots = [
    path.join(
      DESKTOP,
      'build/mac-arm64/zhixin-test.app/Contents/Resources/app.asar.unpacked',
    ),
    path.join(
      DESKTOP,
      'build/mac/zhixin-test.app/Contents/Resources/app.asar.unpacked',
    ),
  ];
  const rels = [
    'node_modules/sqlite3/build/Release/node_sqlite3.node',
    'node_modules/sqlite3/lib/binding/napi-v3-darwin-arm64/node_sqlite3.node',
  ];
  for (const root of roots) {
    for (const rel of rels) {
      const p = path.join(root, rel);
      if (exists(p)) return p;
    }
    const bindingRoot = path.join(root, 'node_modules/sqlite3/lib/binding');
    if (!exists(bindingRoot)) continue;
    for (const dir of fs.readdirSync(bindingRoot)) {
      const p = path.join(bindingRoot, dir, 'node_sqlite3.node');
      if (exists(p)) return p;
    }
  }
  return null;
}

function electronDistOk() {
  const dist = path.join(DESKTOP, 'node_modules/electron/dist');
  const bin = path.join(dist, 'Electron.app/Contents/MacOS/Electron');
  const framework = path.join(
    dist,
    'Electron.app/Contents/Frameworks/Electron Framework.framework',
  );
  if (!exists(bin) || !exists(framework)) return false;
  return isArm64(fileCmd(bin));
}

function electronBinPath() {
  return path.join(
    DESKTOP,
    'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
  );
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
  const result = runSync('which', ['vp']);
  if (result.status !== 0) {
    die('找不到 vp，无法切换 Node 14.21.3');
  }
}

async function checkNode() {
  const result = await vp(['node', '-v'], { verbose: false });
  const version = (result.stdout ?? '').trim();
  if (result.status !== 0 || !version.includes('v14.')) {
    fail(`Node 版本不对：${version || '(空)'}，期望 v14.21.3`);
  }
  return version;
}

async function preflight() {
  const issues = [];
  const fixes = [];

  const envPath = path.join(DESKTOP, '.env.test');
  const pkgPath = path.join(DESKTOP, 'package.json');
  const ymlPath = path.join(DESKTOP, 'electron-builder.yml');

  if (!exists(envPath)) issues.push('缺少 .env.test');
  if (!exists(pkgPath)) issues.push('缺少 package.json');
  if (!exists(ymlPath)) issues.push('缺少 electron-builder.yml');
  if (issues.length) {
    return { ok: false, issues, fixes, sqlite3Arm64: false, leveldownArm64: false };
  }

  const envValues = parseDotenv(read(envPath));
  for (const [key, packValue] of Object.entries(PACK_ENV)) {
    const current = envValues[key] ?? '';
    if (current.includes('localhost')) {
      fixes.push(`.env.test ${key} 是 localhost，打包时会改成 ${packValue}`);
    } else if (current !== packValue) {
      issues.push(`.env.test ${key}=${current}，期望打包值为 ${packValue}`);
    }
  }

  const pkg = readJson(pkgPath);
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

  const nodeVersion = await checkNode();
  const sqlite3Path = findSqlite3Node();
  const sqlite3File = sqlite3Path ? fileCmd(sqlite3Path) : '';
  const sqlite3Arm64 = isArm64(sqlite3File);
  const leveldownPath = findLeveldownNode();
  const leveldownFile = leveldownPath ? fileCmd(leveldownPath) : '';
  const leveldownArm64 = isArm64(leveldownFile);

  cli.persist(
    `${nodeVersion}  ·  sqlite3 ${sqlite3Arm64 ? 'arm64' : '需编译'}  ·  leveldown ${leveldownArm64 ? 'arm64' : '需编译'}  ·  ${pkg.name}`,
  );

  if (!sqlite3Arm64) fixes.push('sqlite3 不是 arm64，将执行 §2 原生编译');
  if (!leveldownArm64 && leveldownPath) {
    fixes.push('leveldown 不是 arm64，将执行 §2 原生编译');
  }

  const ok = issues.length === 0;
  if (fixes.length) {
    for (const f of fixes) warn(f);
  }
  if (!ok) {
    for (const i of issues) cli.error(i);
  }
  return { ok, issues, fixes, sqlite3Arm64, leveldownArm64, envValues };
}

function applyPackConfig(envValues) {
  const envPath = path.join(DESKTOP, '.env.test');
  const ymlPath = path.join(DESKTOP, 'electron-builder.yml');

  const recoverEnv = recoverTargetsFromCurrentEnv(envValues);
  saveSnapshot({ env: recoverEnv });

  let envContent = read(envPath);
  envContent = setDotenvVars(envContent, PACK_ENV);
  write(envPath, envContent);

  let yml = read(ymlPath);
  const arch = patchMacArm64(yml);
  yml = arch.yml;
  const unpack = ensureAsarUnpack(yml);
  yml = unpack.yml;
  const bits = ['.env.test → 192.168.10.25'];
  if (arch.changed || unpack.changed) {
    write(ymlPath, yml);
    if (arch.changed) bits.push('mac.arch → arm64');
    if (unpack.changed) bits.push('补 asarUnpack sqlite3');
  }
  return bits.join('  ·  ');
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

async function rebuildSqlite3(python) {
  const sqliteDir = path.join(DESKTOP, 'node_modules/sqlite3');
  if (!exists(sqliteDir)) fail('没有 node_modules/sqlite3，先在 apps/desktop 安装依赖');

  await runVpRetry(
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
  if (!isArm64(info)) fail(`sqlite3 仍不是 arm64：${info}`);
  return info;
}

async function rebuildLeveldown(python) {
  const dir = path.join(DESKTOP, 'node_modules/leveldown');
  if (!exists(dir)) {
    warn('没有 node_modules/leveldown，跳过');
    return '';
  }

  const env = mergeEnv({
    PYTHON: python,
    npm_config_python: python,
    npm_config_arch: 'arm64',
  });

  await runVpRetry(
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
  if (!isArm64(info)) warn(`leveldown 未检测到 arm64：${info}`);
  return info;
}

async function rebuildNative({ force = false, sqlite3Arm64 = false, leveldownArm64 = false } = {}) {
  const python = findPython();
  if (!python) {
    fail('找不到 Python 3.9', '期望 /opt/homebrew/bin/python3.9');
  }

  const needSqlite = force || !sqlite3Arm64;
  const needLevel = force || !leveldownArm64;
  if (!needSqlite && !needLevel) {
    return '已是 arm64，跳过';
  }

  cli.note(`PYTHON=${python}`);
  const jobs = [];
  if (needSqlite) jobs.push(['sqlite3', rebuildSqlite3(python)]);
  if (needLevel) jobs.push(['leveldown', rebuildLeveldown(python)]);

  const results = await Promise.allSettled(jobs.map(([, p]) => p));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? `${jobs[i][0]}: ${r.reason?.message ?? r.reason}` : null))
    .filter(Boolean);
  if (failed.length) fail(failed.join('；'));

  const done = jobs.map(([name]) => name).join(' + ');
  return `已编译 ${done}`;
}

function builderArgs() {
  return [
    'npx',
    'electron-builder',
    '-c',
    './electron-builder.yml',
    '-m',
    '--config.npmRebuild=false',
    '--publish',
    'never',
    `--config.compression=${cliOpts.compress}`,
  ];
}

async function buildWebpack() {
  await runVpRetry(
    ['node', '--max-old-space-size=4096', '.electron-vue/build.js'],
    { env: packEnv() },
  );
}

async function buildDmg() {
  await runVpRetry(builderArgs(), { env: packEnv() });
}

function verify() {
  const dmgs = findDmgs();
  if (dmgs.length === 0) fail('未找到 build/zx-mac-test_v*.dmg');
  const unpacked = findUnpackedSqlite3();
  const info = unpacked ? fileCmd(unpacked) : '';
  if (unpacked && !isArm64(info)) {
    fail(`产物 sqlite3 不是 arm64：${info}`);
  }
  return { dmg: dmgs[0], sqlite3File: info };
}

async function recover({ forceElectron = false } = {}) {
  const envPath = path.join(DESKTOP, '.env.test');
  const pkgPath = path.join(DESKTOP, 'package.json');
  const snapshot = loadSnapshot();
  const envValues = exists(envPath) ? parseDotenv(read(envPath)) : {};
  const recoverEnv = snapshot?.env ?? recoverTargetsFromCurrentEnv(envValues);
  const bits = [];

  if (exists(envPath)) {
    write(envPath, setDotenvVars(read(envPath), recoverEnv));
    bits.push('.env.test 已还原 localhost');
  }

  if (exists(pkgPath)) {
    const pkgText = read(pkgPath);
    const versionMatch = pkgText.match(/"version"\s*:\s*"([^"]+)"/);
    const version = versionMatch?.[1] ?? '';
    if (version.endsWith('-test')) {
      const next = version.slice(0, -5);
      write(pkgPath, pkgText.replace(versionMatch[0], `"version": "${next}"`));
      bits.push(`version → ${next}`);
    }
  }

  const dist = path.join(DESKTOP, 'node_modules/electron/dist');
  let electronFile = fileCmd(electronBinPath());
  if (!forceElectron && electronDistOk()) {
    bits.push('Electron 已是 arm64，跳过重装');
  } else {
    cli.note('重装 Electron 二进制');
    fs.rmSync(dist, { recursive: true, force: true });
    await runVpRetry(['node', 'node_modules/electron/install.js'], {
      env: mergeEnv({ npm_config_arch: 'arm64' }),
    });
    electronFile = fileCmd(electronBinPath());
    if (!isArm64(electronFile)) {
      fail(`Electron 不是 arm64：${electronFile}`);
    }
    bits.push('Electron 已重装');
  }

  const sqlite3 = findSqlite3Node();
  const sqlite3File = sqlite3 ? fileCmd(sqlite3) : '';
  if (sqlite3 && !isArm64(sqlite3File)) {
    warn('sqlite3 恢复后不是 arm64，需要 --native');
  }

  if (exists(SNAPSHOT)) fs.unlinkSync(SNAPSHOT);
  return { electronFile, sqlite3File, detail: bits.join('  ·  ') };
}

function openBuild() {
  const dir = path.join(DESKTOP, 'build');
  if (!exists(dir)) {
    warn('没有 build/，跳过 open');
    return false;
  }
  runSync('open', [dir], { stdio: 'inherit' });
  return true;
}

function summarize({ mode, ok, dmg, sqlite3File, electronFile, opened }) {
  const elapsed = formatElapsed(Date.now() - cli.startedAt);
  console.log('');
  console.log(`  ${ink.dim('─'.repeat(42))}`);
  console.log(`  模式    ${mode}`);
  console.log(`  结果    ${ok ? ink.green('成功') : ink.red('失败')}  ${ink.dim(elapsed)}`);
  if (dmg) {
    console.log(
      `  产物    ${path.basename(dmg.fullPath)}  ${formatSize(dmg.size)}${opened ? ink.dim('  已打开 build/') : ''}`,
    );
    console.log(`  ${ink.dim(dmg.fullPath)}`);
  }
  if (sqlite3File) console.log(`  sqlite3 ${ink.dim(sqlite3File)}`);
  if (electronFile) console.log(`  Electron ${ink.dim(electronFile)}`);
  if (ok && (mode === 'full' || mode === 'dmg-only')) {
    console.log(`  ${ink.dim('dev:test 请手动：vp env exec --node 14.21.3 -- npm run dev:test')}`);
  }
  console.log('');
}

function planSteps(opts) {
  if (opts.mode === 'recover') return ['恢复本地'];
  if (opts.mode === 'check') return ['前置检查'];
  if (opts.mode === 'native') return ['前置检查', '原生模块'];
  const steps = ['前置检查', '打包配置', '原生模块'];
  if (opts.mode === 'dmg-only') steps.push('electron-builder');
  else steps.push('webpack', 'electron-builder');
  steps.push('验证产物', '恢复本地');
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

  assertDesktop();
  assertVp();

  const steps = planSteps(opts);
  let stepIndex = 0;
  const total = steps.length;
  const next = (label) => {
    stepIndex += 1;
    cli.begin(stepIndex, total, label);
  };

  cli.header([
    ink.bold('PC test 包') + ink.dim('  ·  Mac ARM64'),
    ink.dim(`Node ${NODE}  ·  Electron ${ELECTRON}  ·  compress=${opts.compress}`),
  ]);

  if (opts.proxy) {
    log('使用代理 127.0.0.1:7890');
    Object.assign(process.env, PROXY);
  }

  let mutated = false;
  let recovering = false;
  let dmg;
  let sqlite3File;
  let electronFile;
  let opened = false;

  const recoverOnce = async (forceElectron = false) => {
    if (recovering) return null;
    recovering = true;
    next('恢复本地');
    const recovered = await recover({ forceElectron });
    cli.succeed(recovered.detail);
    return recovered;
  };

  const onSignal = async () => {
    killCurrentChild();
    if (mutated && !recovering) {
      cli.warn('收到中断，执行 §6 恢复，避免本机 dev:test 起不来');
      try {
        await recoverOnce(false);
      } catch (err) {
        cli.error(`恢复失败: ${err.message}`);
      }
    }
    cli.close();
    process.exit(130);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    if (opts.mode === 'recover') {
      const recovered = await recoverOnce(true);
      electronFile = recovered.electronFile;
      sqlite3File = recovered.sqlite3File;
      summarize({ mode: opts.mode, ok: true, sqlite3File, electronFile, opened });
      return;
    }

    next('前置检查');
    const check = await preflight();
    if (!check.ok) fail('前置检查未通过，已停止');
    cli.succeed('通过');

    if (opts.mode === 'check') {
      summarize({
        mode: opts.mode,
        ok: true,
        sqlite3File: findSqlite3Node() ? fileCmd(findSqlite3Node()) : '',
      });
      return;
    }

    if (opts.mode === 'native') {
      next('原生模块');
      const detail = await rebuildNative({ force: true });
      cli.succeed(detail);
      const sqlite3 = findSqlite3Node();
      summarize({
        mode: opts.mode,
        ok: true,
        sqlite3File: sqlite3 ? fileCmd(sqlite3) : '',
      });
      return;
    }

    next('打包配置');
    const configDetail = applyPackConfig(check.envValues);
    mutated = true;
    cli.succeed(configDetail);

    next('原生模块');
    const nativeDetail = await rebuildNative({
      force: false,
      sqlite3Arm64: check.sqlite3Arm64,
      leveldownArm64: check.leveldownArm64,
    });
    cli.succeed(nativeDetail);

    if (opts.mode === 'dmg-only') {
      next('electron-builder');
      await buildDmg();
      cli.succeed();
    } else {
      next('webpack');
      await buildWebpack();
      cli.succeed();
      next('electron-builder');
      await buildDmg();
      cli.succeed();
    }

    next('验证产物');
    const verified = verify();
    dmg = verified.dmg;
    sqlite3File = verified.sqlite3File;
    cli.succeed(`${path.basename(dmg.fullPath)}  ${formatSize(dmg.size)}`);
  } catch (err) {
    if (err.outputText) diagnose(err.outputText);
    cli.fail(err.message);
    if (mutated) {
      warn('构建失败，仍执行 §6 恢复，避免本机 dev:test 起不来');
      try {
        const recovered = await recoverOnce(false);
        if (recovered) {
          electronFile = recovered.electronFile;
          sqlite3File = sqlite3File ?? recovered.sqlite3File;
        }
      } catch (recoverErr) {
        cli.error(`恢复也失败: ${recoverErr.message}`);
      }
    }
    summarize({ mode: opts.mode, ok: false, dmg, sqlite3File, electronFile, opened });
    process.exit(1);
  }

  try {
    const recovered = await recoverOnce(false);
    if (recovered) {
      electronFile = recovered.electronFile;
      sqlite3File = sqlite3File ?? recovered.sqlite3File;
    }
  } catch (err) {
    if (err.outputText) diagnose(err.outputText);
    die(`§6 恢复失败: ${err.message}`);
  }

  if (opts.open && dmg) {
    next('打开产物');
    opened = openBuild();
    cli.succeed(opened ? path.join(DESKTOP, 'build') : '跳过');
  }

  summarize({ mode: opts.mode, ok: true, dmg, sqlite3File, electronFile, opened });
}

main().catch((err) => {
  if (cli) cli.close();
  console.error(`错误: ${err.message}`);
  process.exit(1);
});

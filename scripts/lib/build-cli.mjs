/**
 * 构建脚本共用的 TTY 进度条 / 流式日志。
 * 管道或 NO_COLOR 下退化成普通行。
 */
import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

const MAX_CAPTURE = 256 * 1024;

const PACK_NOISE_RE =
  /^(Hash:|Version: webpack|Time:|Built at:|Entrypoint |Child |WARNING in chunk)|\b\[(emitted|built|from \d+ modules)\]|^\+\s+\d+ hidden|Hidden modules|^\s*Asset\s+Size|lets-build|^-{5,}(after pack|afterAllArtifactBuild)|^\s*\[.+\d+\/\d+\]/;

const GRADLE_NOISE_RE =
  /^(Note: |warning: |w: |Transform |Skipping |Deprecated Gradle|This is an incubating|Consider enabling|The following |WARNING: |Download https)/;

export function colorEnabled() {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === '0') return false;
  return Boolean(process.stdout.isTTY);
}

function paint(code, text) {
  return colorEnabled() ? `\x1B[${code}m${text}\x1B[0m` : text;
}

export const ink = {
  bold: (s) => paint('1', s),
  dim: (s) => paint('2', s),
  red: (s) => paint('31', s),
  green: (s) => paint('32', s),
  yellow: (s) => paint('33', s),
  cyan: (s) => paint('36', s),
  gray: (s) => paint('90', s),
};

export function formatElapsed(ms) {
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const sec = Math.round(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function truncate(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function stripDangerousAnsi(text) {
  return text
    .replace(/\x1B\[[0-9;]*[Hf]/g, '')
    .replace(/\x1B\[[0-3]?J/g, '')
    .replace(/\x1B\[\?25[lh]/g, '')
    .replace(/\x1B\[\d+[ABCD]/g, '')
    .replace(/\x1B\[[su]/g, '');
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

export function createCli() {
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
      const next = String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
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

export function appendCapture(buf, chunk, max = MAX_CAPTURE) {
  const next = buf + chunk;
  return next.length > max ? next.slice(-max) : next;
}

function emitClassified(cli, classified) {
  if (!classified || !classified.text) return;
  if (classified.persist) cli.persist(classified.text);
  else cli.note(classified.text, classified.fraction);
}

/**
 * 跑子进程：实时按行分类，默认只刷新进度条 note，错误行持久打印。
 * @returns {Promise<{ status: number, stdout: string, stderr: string, outputText: string }>}
 */
export function spawnLogged(cmd, args, options = {}) {
  const {
    cwd,
    env = process.env,
    shell = false,
    verbose = false,
    classifyLine,
    cli,
    onSpawn,
    onClose,
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell,
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
        const classified = classifyLine
          ? classifyLine(line, verbose)
          : { text: stripVTControlCharacters(line).trim(), persist: true, fraction: null };
        emitClassified(cli, classified);
      }
    };

    if (onSpawn) onSpawn(child);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => handleChunk(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => handleChunk(chunk, 'stderr'));

    child.on('error', (err) => {
      if (onClose) onClose(child);
      err.stdout = stdout;
      err.stderr = stderr;
      err.outputText = captured;
      reject(err);
    });

    child.on('close', (status) => {
      if (onClose) onClose(child);
      for (const leftover of [stdoutBuf, stderrBuf]) {
        if (!leftover.trim()) continue;
        const classified = classifyLine
          ? classifyLine(leftover, verbose)
          : { text: leftover.trim(), persist: true, fraction: null };
        emitClassified(cli, classified);
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

export function dumpTail(output, inkFn = ink) {
  const tail = String(output || '')
    .trim()
    .split(/\r?\n/)
    .slice(-40)
    .join('\n');
  if (tail) console.error(`\n${inkFn.dim(tail)}\n`);
}

function builderFraction(msg) {
  if (/electron-builder/.test(msg)) return 0.08;
  if (/loaded configuration|writing effective/.test(msg)) return 0.12;
  if (/packaging/.test(msg)) return 0.45;
  if (/building.*(?:dmg|nsis)|target=DMG/i.test(msg)) return 0.78;
  if (/renamed|afterAllArtifactBuild/.test(msg)) return 0.96;
  return null;
}

/** webpack / electron-builder / node-gyp 行分类（PC test / prod 共用） */
export function classifyPackLine(raw, verbose) {
  const cleaned = stripDangerousAnsi(raw);
  const plain = stripVTControlCharacters(cleaned).trim();
  if (!plain) return null;

  if (/error|fail|gyp ERR!/i.test(plain) && !/0 error/i.test(plain)) {
    return { text: plain, persist: true, fraction: null };
  }

  if (verbose) return { text: plain, persist: true, fraction: null };
  if (PACK_NOISE_RE.test(plain)) return null;

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

/** Gradle / Kotlin 行分类 */
export function classifyGradleLine(raw, verbose) {
  const cleaned = stripDangerousAnsi(raw);
  const plain = stripVTControlCharacters(cleaned).trim();
  if (!plain) return null;

  if (
    /^(e: |\* What went wrong|FAILURE:|BUILD FAILED|Execution failed)/.test(plain) ||
    (/\b(error|FAIL(?:ED)?)\b/i.test(plain) && !/0 error|UP-TO-DATE|FROM-CACHE/i.test(plain))
  ) {
    return { text: plain, persist: true, fraction: null };
  }

  if (verbose) return { text: plain, persist: true, fraction: null };
  if (GRADLE_NOISE_RE.test(plain)) return null;

  if (/^BUILD SUCCESSFUL/.test(plain)) {
    return { text: plain, persist: false, fraction: 1 };
  }

  const task = plain.match(
    /^> Task (:\S+)(?:\s+(UP-TO-DATE|FROM-CACHE|NO-SOURCE|SKIPPED|FAILED))?/,
  );
  if (task) {
    if (task[2] === 'FAILED') {
      return { text: `${task[1]} FAILED`, persist: true, fraction: null };
    }
    if (task[2]) return null;
    return { text: task[1], persist: false, fraction: null };
  }

  const pct = plain.match(/(\d{1,3})%\s+(INITIALIZING|CONFIGURING|EXECUTING|WAITING)/);
  if (pct && Number(pct[1]) <= 100) {
    return {
      text: `${pct[2].toLowerCase()} ${pct[1]}%`,
      persist: false,
      fraction: Number(pct[1]) / 100,
    };
  }

  return null;
}

/** adb install / am start */
export function classifyAdbLine(raw, verbose) {
  const cleaned = stripDangerousAnsi(raw);
  const plain = stripVTControlCharacters(cleaned).trim();
  if (!plain) return null;

  if (/error|fail|denied/i.test(plain) && !/0 error/i.test(plain)) {
    return { text: plain, persist: true, fraction: null };
  }
  if (verbose) return { text: plain, persist: true, fraction: null };
  if (/^(Performing Streamed Install|Success|Starting: Intent)/.test(plain)) {
    return { text: plain, persist: false, fraction: plain === 'Success' ? 1 : 0.5 };
  }
  return null;
}

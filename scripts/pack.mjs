#!/usr/bin/env node
/**
 * 智信打包统一入口：选端 → 选环境 → 选动作，再转调现有脚本。
 *
 *   npm run pack
 *   node scripts/pack.mjs
 *   node scripts/pack.mjs pc 测试
 *   node scripts/pack.mjs 安卓 正式
 *   node scripts/pack.mjs android test 装机
 *   回车 = 重复上次
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { ink } from './lib/build-cli.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAST_PATH = path.join(os.homedir(), '.zx-pack-last.json');

const FLAG_SET = new Set([
  '--proxy',
  '--no-open',
  '--verbose',
  '-v',
  '--help',
  '-h',
  '--develop',
  '--quick',
  '--clean',
  '--dmg-only',
  '--check',
  '--recover',
  '--native',
  '--restore',
]);

const TARGETS = [
  {
    id: 'pc-test',
    label: 'PC · 测试',
    aliases: ['pc-test', 'pctest', 'mac-test'],
    script: 'pc-build-test.mjs',
  },
  {
    id: 'pc-prod',
    label: 'PC · 正式',
    aliases: ['pc-prod', 'pcprod', 'mac-prod'],
    script: 'prod-pc-build.mjs',
  },
  {
    id: 'android-test',
    label: '安卓 · 测试',
    aliases: ['android-test', 'anzhuo-test', 'apk-test'],
    script: 'anzhuo-build-test.mjs',
  },
  {
    id: 'android-prod',
    label: '安卓 · 正式',
    aliases: ['android-prod', 'anzhuo-prod', 'apk-prod'],
    script: 'prod-android-build.mjs',
  },
];

const ACTIONS = {
  'pc-test': [
    { id: 'full', label: '完整打包', args: [], aliases: ['pack', 'full', '打包'] },
    { id: 'dmg', label: '只打 DMG（webpack 已编过）', args: ['--dmg-only'], aliases: ['dmg', 'dmg-only'] },
    { id: 'check', label: '只检查，不打包', args: ['--check'], aliases: ['check', '检查'] },
    { id: 'native', label: '强制编原生模块', args: ['--native'], aliases: ['native', '原生'] },
    { id: 'recover', label: '恢复本地（打包失败/中断后）', args: ['--recover'], aliases: ['recover', '恢复'] },
  ],
  'pc-prod': [
    { id: 'full', label: '完整打包', args: [], aliases: ['pack', 'full', '打包'] },
    { id: 'dmg', label: '只打 DMG（webpack 已编过）', args: ['--dmg-only'], aliases: ['dmg', 'dmg-only'] },
    { id: 'check', label: '只检查，不打包', args: ['--check'], aliases: ['check', '检查'] },
    { id: 'native', label: '强制编原生模块', args: ['--native'], aliases: ['native', '原生'] },
    { id: 'restore', label: '还原配置（上次异常中断）', args: ['--restore'], aliases: ['restore', '还原'] },
  ],
  'android-test': [
    { id: 'apk', label: '出 APK（打开产物目录）', args: [], aliases: ['pack', 'apk', '打包', '出包'] },
    { id: 'develop', label: '出 APK · 开发环境', args: ['--develop'], aliases: ['develop', '开发'] },
    { id: 'install', label: '编译并装机启动', script: 'zhixin-run-android.mjs', args: [], aliases: ['install', 'run', '装机'] },
    { id: 'quick', label: '快速重装已有 APK', script: 'zhixin-run-android.mjs', args: ['--quick'], aliases: ['quick', '重装'] },
  ],
  'android-prod': [
    { id: 'apk', label: '出 APK（增量）', args: [], aliases: ['pack', 'apk', '打包', '出包'] },
    { id: 'clean', label: '出 APK · 先 clean', args: ['--clean'], aliases: ['clean', '全量'] },
  ],
};

function printHelp() {
  console.log(`用法: npm run pack [-- 端 环境 [动作] [选项]]

  无参数且在终端里：交互菜单（回车 = 上次）

  端        pc | 安卓 | android | a
  环境      测试 | 正式 | test | prod | t | p
  动作      打包（默认）| dmg | 检查 | 原生 | 恢复 | 还原
            装机 | 重装 | 开发 | clean

  例子
    npm run pack
    npm run pack -- pc 测试
    npm run pack -- 安卓 正式
    npm run pack -- android test 装机
    npm run pack -- pc prod dmg --proxy

  选项（原样转给底层脚本）
    --proxy  --no-open  --verbose  --clean  --develop  --quick
`);
}

function loadLast() {
  try {
    return JSON.parse(fs.readFileSync(LAST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveLast(targetId, actionId) {
  fs.writeFileSync(LAST_PATH, `${JSON.stringify({ targetId, actionId }, null, 2)}\n`);
}

function splitArgv(argv) {
  const flags = [];
  const words = [];
  for (const arg of argv) {
    if (arg.startsWith('--compress=')) {
      flags.push(arg);
      continue;
    }
    if (FLAG_SET.has(arg) || arg.startsWith('--')) {
      flags.push(arg);
      continue;
    }
    words.push(arg);
  }
  return { flags, words };
}

function norm(s) {
  return String(s).trim().toLowerCase();
}

function matchToken(value, table) {
  const v = norm(value);
  for (const [id, aliases] of table) {
    if (v === id || aliases.includes(v)) return id;
  }
  return null;
}

const PLATFORM = [
  ['pc', ['pc', 'mac', '桌面', '电脑']],
  ['android', ['android', 'a', '安卓', 'anzhuo', 'apk']],
];

const ENV = [
  ['test', ['test', 't', '测试', '联调']],
  ['prod', ['prod', 'p', '正式', '生产', 'release']],
];

function targetFromParts(platform, env) {
  if (!platform || !env) return null;
  return TARGETS.find((t) => t.id === `${platform}-${env}`) ?? null;
}

function findAction(targetId, token) {
  if (!token) return ACTIONS[targetId][0];
  const v = norm(token);
  return (
    ACTIONS[targetId].find((a) => a.id === v || a.aliases.some((x) => norm(x) === v)) ?? null
  );
}

function resolveFromWords(words) {
  if (words.length === 0) return { target: null, action: null, error: null };

  const joined = norm(words.join(' '));
  const byId = TARGETS.find((t) => t.id === joined || t.aliases.includes(joined.replace(/\s+/g, '-')));
  if (byId && words.length === 1) {
    return { target: byId, action: ACTIONS[byId.id][0], error: null };
  }

  let platform = matchToken(words[0], PLATFORM);
  let env = words[1] ? matchToken(words[1], ENV) : null;
  let actionToken = words[2];

  if (!platform) {
    return { target: null, action: null, error: `无法识别端：${words[0]}（pc / 安卓）` };
  }

  if (!env && words.length === 1) {
    return { target: null, action: null, platform, error: null };
  }

  if (!env) {
    return { target: null, action: null, error: `无法识别环境：${words[1]}（测试 / 正式）` };
  }

  const target = targetFromParts(platform, env);
  if (!target) {
    return { target: null, action: null, error: `没有 ${platform} + ${env} 这个组合` };
  }

  if (words.length > 3) {
    return { target, action: null, error: `多余参数：${words.slice(3).join(' ')}` };
  }

  const action = findAction(target.id, actionToken);
  if (!action) {
    const names = ACTIONS[target.id].map((a) => a.id).join(' / ');
    return { target, action: null, error: `无法识别动作：${actionToken}（${names}）` };
  }
  return { target, action, error: null };
}

async function ask(rl, question) {
  const raw = await rl.question(question);
  return raw.trim();
}

function printChoices(items, selectedId) {
  items.forEach((item, i) => {
    const mark = item.id === selectedId ? ink.cyan(' ←') : '';
    console.log(`  ${ink.bold(String(i + 1))}  ${item.label}${mark}`);
  });
}

function pickByInput(items, raw) {
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1];
  const v = norm(raw);
  const hits = items.filter(
    (item) =>
      item.id === v ||
      item.aliases?.some((a) => norm(a) === v) ||
      norm(item.label) === v,
  );
  if (hits.length === 1) return hits[0];
  return null;
}

async function askAction(rl, target, lastActionId) {
  const actions = ACTIONS[target.id];
  const preferred = actions.find((x) => x.id === lastActionId)?.id ?? actions[0].id;
  console.log('');
  console.log(`  ${ink.dim('做什么')}  ${ink.dim(target.label)}`);
  printChoices(actions, preferred);
  const raw = await ask(rl, '\n  > ');
  if (!raw) return actions.find((x) => x.id === preferred) ?? actions[0];
  const action = pickByInput(actions, raw);
  if (!action) {
    console.error('  没选中。输入序号即可');
    process.exit(1);
  }
  return action;
}

async function interactive(last) {
  if (!input.isTTY) {
    printHelp();
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });
  console.log('');
  console.log(`  ${ink.bold('智信打包')}`);
  if (last) {
    const t = TARGETS.find((x) => x.id === last.targetId);
    const a = ACTIONS[last.targetId]?.find((x) => x.id === last.actionId);
    if (t && a) {
      console.log(`  ${ink.dim('回车 = 上次')}  ${t.label}  ·  ${a.label}`);
    }
  }
  console.log('');

  console.log(`  ${ink.dim('打哪个')}`);
  printChoices(TARGETS, last?.targetId);
  const tRaw = await ask(rl, '\n  > ');
  if (!tRaw && last) {
    const target = TARGETS.find((x) => x.id === last.targetId);
    const action = ACTIONS[last.targetId]?.find((x) => x.id === last.actionId);
    rl.close();
    if (!target || !action) {
      console.error('  上次记录无效，重新选一次');
      process.exit(1);
    }
    return { target, action };
  }

  const target = pickByInput(TARGETS, tRaw);
  if (!target) {
    rl.close();
    console.error('  没选中。输入 1–4');
    process.exit(1);
  }

  const action = await askAction(
    rl,
    target,
    last?.targetId === target.id ? last.actionId : ACTIONS[target.id][0].id,
  );
  rl.close();
  return { target, action };
}

async function completeMissing({ platform, flags }) {
  if (!input.isTTY) {
    console.error(`还差环境：测试 / 正式\n例如：npm run pack -- ${platform} 测试`);
    process.exit(1);
  }
  const rl = readline.createInterface({ input, output });
  const envs = [
    { id: 'test', label: '测试', aliases: ['t', '测试'] },
    { id: 'prod', label: '正式', aliases: ['p', '正式'] },
  ];
  console.log('');
  console.log(`  ${ink.bold(platform === 'pc' ? 'PC' : '安卓')}  ${ink.dim('测试还是正式？')}`);
  printChoices(envs);
  const raw = await ask(rl, '\n  > ');
  const env = pickByInput(envs, raw) ?? (raw ? null : envs[0]);
  if (!env) {
    rl.close();
    console.error('  输入 1 测试 / 2 正式');
    process.exit(1);
  }
  const target = targetFromParts(platform, env.id);
  const last = loadLast();
  const action = await askAction(
    rl,
    target,
    last?.targetId === target.id ? last.actionId : ACTIONS[target.id][0].id,
  );
  rl.close();
  run({ target, action, flags });
}

function run({ target, action, flags }) {
  const scriptName = action.script ?? target.script;
  const script = path.join(__dirname, scriptName);
  const args = [...(action.args ?? []), ...flags.filter((f) => f !== '--help' && f !== '-h')];

  console.log('');
  console.log(`  ${ink.cyan('→')}  ${target.label}  ·  ${action.label}`);
  console.log(`  ${ink.dim(`node scripts/${scriptName}${args.length ? ` ${args.join(' ')}` : ''}`)}`);
  console.log('');

  saveLast(target.id, action.id);

  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

async function main() {
  const { flags, words } = splitArgv(process.argv.slice(2));
  if (flags.includes('--help') || flags.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const resolved = resolveFromWords(words);
  if (resolved.error) {
    console.error(`错误: ${resolved.error}`);
    printHelp();
    process.exit(1);
  }

  if (resolved.platform && !resolved.target) {
    await completeMissing({ platform: resolved.platform, flags });
    return;
  }

  if (resolved.target && resolved.action) {
    run({ target: resolved.target, action: resolved.action, flags });
    return;
  }

  const picked = await interactive(loadLast());
  run({ ...picked, flags });
}

main().catch((err) => {
  console.error(`错误: ${err.message}`);
  process.exit(1);
});

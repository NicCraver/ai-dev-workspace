#!/usr/bin/env node
/** 转发到 apps/android 唯一实现（勿在此维护业务逻辑） */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const script = path.join(
  root,
  'apps/android/.cursor/commands/scripts/zhixin-run-android/index.mjs',
);

const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);

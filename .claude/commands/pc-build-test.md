# PC 端：Mac ARM64 test 包构建

**工作目录**：`apps/desktop/`（以下命令均在此目录执行，除非另有说明）

**唯一流程文档**：`apps/desktop/docs/Mac ARM64 test 包构建流程.md` —— 命令细节、校验期望、失败症状表以该文档为准。执行前先通读一遍，再按节推进。

**立即执行，不要探索无关代码、不要自行发明构建命令。**

用户参数：`$ARGUMENTS`

## 模式解析

| 参数 | 行为 |
|------|------|
| （无） | 完整流程：§1 前置检查 → 按需 §2 → §3 构建 → §4 验证 → **§6 恢复本地 dev（必做）** → **打开产物目录** |
| `--dmg-only` | §1 前置检查 → §3 仅 `electron-builder`（webpack 已编过）→ §4 验证 → §6 → **打开产物目录** |
| `--check` | 仅 §1 前置检查，汇报结果后停止 |
| `--recover` | 仅 §6 构建后恢复本地 dev |
| `--native` | §1 检查 → §2 原生依赖编译 → 汇报 `file` 结果后停止 |

## 执行要求

1. **优先最快路径**：§1 中 `sqlite3` 已是 arm64 → 跳过 §2；下载失败再按文档 §0 开代理。
2. **Node 版本**：所有 npm / npx / node 命令必须包在 `vp env exec --node 14.21.3 --` 内。
3. **构建命令**：完整构建用 `npm run pack:mac-test -- --config.npmRebuild=false`；只打 DMG 用 `cross-env MODE_ENV=test npx electron-builder -c ./electron-builder.yml -m --config.npmRebuild=false`。禁止省略 `npmRebuild=false`。
4. **打包后必做 §6**：还原 `.env.test`（localhost）、去掉 `package.json` 的 `-test` version 后缀、重装 Electron 二进制；否则本机 `dev:test` 起不来。
5. **禁止 git 提交**：`.env.test`、`electron-builder.yml`、`package.json`、`package-lock.json` 的 test 本地改动不得 stage / commit（工作区约定）。
6. **自动打开产物目录（必做）**：凡产出 DMG 的模式（完整流程 / `--dmg-only`），在 §6 完成后**必须**执行：

```bash
open build   # 在 apps/desktop/ 下；用 Finder 打开 build/，无需用户确认
```

失败且未生成 DMG 时跳过；`--check` / `--recover` / `--native` 不打开。

## 汇报格式

完成后用简短条目汇报：

- **模式** / **结果**（成功 / 失败）
- **产物**：`build/zx-mac-test_v*.dmg` 路径与大小（成功时）；注明已 `open build`
- **校验**：`sqlite3.node` / `Electron` 的 `file` 输出一行摘要
- **§6 恢复**：`.env.test`、version、Electron 重装是否完成；`dev:test` 是否已验证（或用户需手动验证）
- **失败时**：对照文档 §7 症状表，给出已尝试的修复与下一步（不要无脑重跑全流程）

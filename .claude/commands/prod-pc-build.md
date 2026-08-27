# PC 端：Mac ARM64 正式（prod）包构建

**立即执行，不要探索代码、不要自行拼命令：**

```bash
node scripts/pack.mjs pc 正式 $ARGUMENTS
```

（统一入口；desktop 工程在 `apps/desktop`。）

流程：前置检查（含 `.env.prod` 不得指向本地/测试地址）→ 按需编 sqlite3/leveldown → **临时**切正式命名（`package.json` name=`zhiwulianxin`、`electron-builder.yml` productName=`zhixin` / appId=`zhixin.zhiguaniot.com` / 快捷方式=`智信`，mac.arch=arm64 + asarUnpack）→ `pack:mac-prod` → 验证 → 重命名 `build/zx-mac-prod_v*.dmg` → **原样还原**本地 test 配置 → `open build`。

可选：`--dmg-only`（webpack 已编过）、`--check`（只检查不改文件）、`--native`（强制重编原生）、`--restore`（上次异常中断后手动还原配置）、`--proxy`、`--no-open`、`--verbose`。

## 硬性要求

1. `package.json` / `electron-builder.yml` 的改动是脚本临时行为，结束时按快照原样写回；**这两个文件与 `.env.*` 一律不得 `git add` / commit**。
2. 若脚本报「还原本地配置失败」，先跑 `node scripts/pack.mjs pc 正式 还原`，再确认 `git -C apps/desktop diff` 只剩原本的 test 本地改动。
3. 不要手动 `npm install`（工作区禁令）。

完成后只汇报一行结果：成功/失败、DMG 路径与大小、已 `open` 产物目录；失败时给症状与下一步，不要无脑重跑全流程。

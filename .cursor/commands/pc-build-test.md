# PC 端：Mac ARM64 test 包构建

**立即执行，不要探索代码、不要自行拼命令：**

```bash
node scripts/pack.mjs pc 测试 $ARGUMENTS
```

（统一入口；desktop 工程在 `apps/desktop`。流程对照 `apps/desktop/docs/Mac ARM64 test 包构建流程.md`。）

完成后按脚本末尾摘要汇报：模式 / 结果 / 产物 / 校验 / §6 恢复。失败时对照文档 §7，不要无脑重跑全流程。

可选：`--dmg-only`、`--check`、`--recover`、`--native`、`--proxy`、`--no-open`、`--verbose`。

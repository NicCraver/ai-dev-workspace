# 智信打包（PC / 安卓 · 测试 / 正式）

**立即执行，不要探索代码、不要自行拼 Gradle/electron-builder 命令：**

```bash
node scripts/pack.mjs $ARGUMENTS
```

无参数时：终端交互选「打哪个」→「做什么」；回车重复上次。
有参数时直接开跑，例如：`pc 测试`、`安卓 正式`、`android test 装机`、`pc prod dmg --proxy`。

底层仍是原来的脚本，选项原样转发：`--proxy` `--no-open` `--verbose` `--clean` `--develop` `--quick`。

完成后按子脚本末尾摘要汇报一行：成功/失败、产物路径与大小。失败对照脚本提示，不要无脑重跑全流程。

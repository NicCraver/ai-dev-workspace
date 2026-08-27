# 智信 Android：构建测试环境并装到真机

**立即执行，不要探索代码、不要自行拼命令：**

```bash
node scripts/pack.mjs 安卓 测试 装机 $ARGUMENTS
```

完成后只汇报一行结果（成功/失败、包名）。失败且含 `INSTALL_FAILED_USER_RESTRICTED` 时，提醒开「USB 安装」后用 `--quick` 重试。

可选：`--quick`（只重装已有 APK）、`--develop`（开发环境）、`--verbose`。

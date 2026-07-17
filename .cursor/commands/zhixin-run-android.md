# 智信 Android 真机调试（onTest）

**硬性要求**：不要读 skill、不要探索代码、不要自行拼 Gradle/adb 命令。立即在仓库根目录执行：

```bash
bash .cursor/commands/scripts/zhixin-run-android.sh $ARGUMENTS
```

将脚本输出摘要汇报给用户（flavor、包名、是否安装/启动成功）。失败时按脚本提示处理；`INSTALL_FAILED_USER_RESTRICTED` 提醒用户开「USB 安装」后加 `--quick` 重试。

可选参数透传 `$ARGUMENTS`：`--build`（强制编译）、`--quick`（仅重装）、`--develop`（开发环境）。

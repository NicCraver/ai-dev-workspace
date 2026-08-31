# Plan：安卓会话页NPE崩溃

| # | 任务 | 端 | 状态 |
|---|------|-----|------|
| 1 | 定位根因：`? 0L : higher()` 三元自动拆箱 | android | ✅ |
| 2 | 三处改为 `? null : higher()`，加中文注释 | android | ✅ |
| 3 | `./gradlew :IM:compileDevelopDebugJavaWithJavac` 编译通过 | android | ✅ |
| 4 | 真机 onTest 自测已读回执路径 | android | ⬜ |
| 5 | 提交 / 合入分支 | android | ⬜ |

## 任务 4 自测清单

1. A 给 B 发消息，B 不读；A 退出会话再进 → 不崩，气泡显示「已读」文案不带时间。
2. B 读消息 → A 侧气泡刷成「HH:mm丨已读」。
3. 全局搜索跳进会话后收到已读回执 → 不崩（对应 `isFromGlobalSearch` 分支）。
4. 超出 `limitTime` 窗口的老消息 → 只显示「已读」，不带时间，行为同修复前。

# Status：安卓会话页NPE崩溃

> 最后更新：2026-09-03（**已收尾关闭**：`a1ff41b44` 已在 `origin/master-3.6.23`，用户验收通过）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

线上崩溃：v3.6.22 / versionCode 299，华为 VOG-AL00 (Android 10)。
`ConversationFragment$8.onSuccess` 触发 `NullPointerException: 'long java.lang.Long.longValue()' on a null object reference`。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 定位根因（三元表达式自动拆箱） | — | ✅ | — | — |
| 修复三处 `higher()` 拆箱写法 | — | ✅ | — | — |
| 编译验证（`:IM:compileDevelopDebugJavaWithJavac`） | — | ✅ | — | — |
| 真机自测（onTest） | — | ✅ 用户验收通过 | — | — |

web / ios / desktop 不涉及：崩溃在 Android 原生单聊已读回执逻辑，无对应端实现。

## 待办 / 阻塞

- 无。2026-09-03 收尾：`a1ff41b44` 已确认在 `origin/master-3.6.23`（同分支上的配色 `89febfb4e`、时间弹层 `ab9b723b0` 亦已 push），真机验收通过，功能从 ACTIVE 移除。

## 关键决策记录

- 2026-08-31 修法取 `? null :` 而非 `? 0L :`——下游 `messageAsRead` 与调用处判断均为
  `readTime != null && readTime != 0`，null 与 0L 走同一分支，语义不变且不再拆箱
- 2026-08-31 `MessageListAdapter.java:2007` 同名调用不改：直接赋给 `Long`，没有三元提升，本就安全

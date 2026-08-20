# Status：安卓端 @智能体 / 个人AI框 流式输出抖动

> 最后更新：2026-08-20 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 定位抖动根因（4 条） | — | ✅ | — | — |
| 打字机按 msgUid 独立排队（新 `AgentStreamPlayer`） | — | ✅ 代码 | — | — |
| markdown 前缀渲染缓存（新 `AgentStreamMarkdownRenderer`） | — | ✅ 代码 | — | — |
| 跟随滚动改 preDraw + 瞬时 `scrollBy` | — | ✅ 代码 | — | — |
| holder 复用护栏（`boundUid` + 清高度地板） | — | ✅ 代码 | — | — |
| `:IM:compileOnTestDebugJavaWithJavac` | — | ✅ 无 error | — | — |
| **真机验收** | — | 🚧 | — | — |

> ✅ 只代表「代码写完 + 编译过」。本仓库无单测，抖动是观感问题，**必须真机看**。

## 待办 / 阻塞

- (android) **请你真机验收**：`bash apps/android/.cursor/commands/scripts/zhixin-run-android.sh`
  或 `/anzhuo-build-test`（当前无设备连接，未装包）。看四点：
  1. 群里 @智能体，回答吐字是否匀速（不再一顿一顿、不再突然蹦一大段）；
  2. 吐字时列表是否连续跟到底部（不再走走停停）；
  3. 回答很长时，后半段是否还卡；
  4. 边吐字边往上翻历史，不被拽回；翻回来内容完整。
- (android) 代码改动**未 commit**，留在 `fix/md-table-fold-truncate` 工作区。
- (android) 未覆盖：同屏两条智能体同时回答（本次专门为它做了按 uid 排队，但没有构造场景验证）。

## 关键决策记录

- 2026-08-20 流式载体确认是 **ReferenceMessage 流式座位**（`extra.fromType==1`），
  不是 ActionCard；上一 feature「ActionCard 不走 refreshAgentNewAnswerContent」的结论
  指的是**回答结束后**那条卡片，两者不冲突。
- 2026-08-20 抖动主因不是渲染慢，是**全局单例 provider 上只有一个 Handler/Runnable**：
  任意一条普通引用消息重新绑定（`cancelStream()`）或另一条回答刷新，都会掐掉正在跑的打字机。
- 2026-08-20 跟随滚动改 `onPreDraw` + `scrollBy`：原来在 `setText` 当场用
  `itemView.getBottom()` 算（布局还没跑，慢一拍），又用 `smoothScrollBy`
  把列表置成 SETTLING，下一步被自己的 IDLE 判定挡掉 → 走走停停。
- 2026-08-20 不重启节拍：新轮询到货只把「要追的目标」变长，不 removeCallbacks 重排。
- 2026-08-20 手感参数（1500ms / 10 字 / 150ms）原样保留，只改调度与渲染。

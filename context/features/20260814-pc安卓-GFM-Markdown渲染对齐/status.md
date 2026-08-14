# Status：pc安卓-GFM-Markdown渲染对齐

> 最后更新：2026-08-14 15:10（功能代码无变化；本次仅在工作区加 prod 打包脚本工具，desktop 脏区修正为 2）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

本功能**只动 PC（desktop）与安卓**，web 与 iOS 不涉及（iOS 上一轮已完成，web 的 `marked` 管线只服务 AI 卡片弹窗、不是消息气泡）。行号对应 `plan.md` 的 Task。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 现状勘察（两端管线与差距） | — | ✅ | — | ✅ |
| spec 定稿 | — | ✅ | — | ✅ |
| plan 拆解（13 个 Task） | — | ✅ | — | ✅ |
| 切分支 `feat/gfm-markdown` | — | ✅ | — | ✅ |
| T1 markdown-it 选项 + 兜底 + 开关 | — | — | — | ✅ |
| T2 任务列表 core rule | — | — | — | ✅ |
| T3 表格横滚容器 + 配色 | — | — | — | ✅ |
| T4 AI 卡片判定放宽 | — | — | — | ✅ |
| T5 折叠不切块（`pickFoldHeight`） | — | — | — | ✅ |
| T6 30 条用例页（已建，**待自测**） | — | — | — | 🚧 |
| T7 依赖补齐 + `ZXMarkwonFactory` 收敛 | — | ✅ | — | — |
| T8 AST 切段器 | — | ✅ | — | — |
| T9 可横滚表格控件 | — | ✅ | — | — |
| T10 段栈容器 + 按段折叠 | — | ✅ | — | — |
| T11 气泡接段栈 + 折叠改造 | — | ✅ | — | — |
| T12 31 条用例页（已建，**待自测**） | — | 🚧 | — | — |
| T13 收尾（impl-notes + status） | — | ✅ | — | ✅ |

> ✅ 的判据是**代码写完 + 编译通过**（PC：`npm run lint` 干净 + vitest 23 条全绿；安卓：`assembleDevelopDebug` BUILD SUCCESSFUL）。
> **不含任何运行时验证**——表格横滚、折叠不切块、长按不被吞、配色观感，一眼都没看过。

## 本次代码量

| 端 | commit | 内容 |
|----|--------|------|
| desktop | `180e0d6c` → `d7f27ca9` → `5c8f4cb8` → `cee18ade` → `f2c3ab8b` → `f2a7d5f6` | 6 个 |
| android | `08a0a2c05` → `6553d4b19` → `786d1d50d` → `db3fc34dd` → `203f01126` → `e92542ee3` | 6 个 |

**PC 新增单测 23 条**（`markdown-render.spec.js` 18 + `markdown-fold-model.spec.js` 5），全绿。安卓无单测（工程本来就没有）。

**安卓新增 4 个类**：`ZXMarkwonFactory`（配置收敛 + 兜底 + 开关）、`ZXMarkdownSegment` / `ZXMarkdownSegmenter`（AST 切段）、`ZXMarkdownTableView`（横滚表格）、`ZXMarkdownContentView`（段栈 + 按段折叠）。

## 各端工作区现状（2026-08-14 14:20，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 110 | 脏 11 | spec/plan/status/impl-notes | 其余脏区是 hooks/skills/README/`.pi/`，与本功能无关 |
| web | `feat/data-scope-secret-tag` | synced | 干净 | 不涉及 | 停在涉密标签功能 |
| android | **`feat/gfm-markdown`** | **未 push** | 干净 | **本功能** | 基点 `f5f2d0ce3`；最新 `e92542ee3` |
| ios | `feat/ios-gfm-markdown` | synced | 干净 | 上一轮已完成 | `c4d50e28b` |
| desktop | **`feat/gfm-markdown`** | **未 push** | 脏 2 | **本功能** | 基点 `763cd15e`；最新 `f2a7d5f6`。脏的是 `electron-builder.yml`/`package.json` 本地调试配置（`.env.test` 已还原），切分支带过来的，**禁止提交** |

> **工具脚本（与本功能无关，记录备查）**：2026-08-14 在工作区新增 `scripts/prod-pc-build.mjs`（Mac arm64 正式 DMG，`npm run prod:pc-build`）与 `scripts/prod-android-build.mjs`（`:smart_message:assemblePublishRelease` 正式 APK，`npm run prod:android-build`），构建完各自重命名产物并 `open` 目录。安卓任务**必须带 `:smart_message:` 模块前缀**——无前缀会给 IM / basis_function_api 等 library 也打 release，触发 `verifyPublishReleaseResources` 孤立资源校验，library 引用 app 模块 drawable 必挂。

## 待办 / 阻塞

### 下一步全是运行时自测（我做不了，需要你跑）

- **(desktop)** `npm run dev:test` 起应用 → 访问 `#/debug/markdown` → 按 30 条用例逐条对照。重点：L4 checkbox 不显示原始括号、T4 三种对齐、T7 能横滚且不夺纵向滚动、I3 中文粘连不变斜体、I8 换行生效、H1 蓝字且保持粗体
- **(desktop)** ⚠️ **`breaks: true` 专项**：这是本轮唯一会改变**存量消息**排版的改动（当前单换行被吞成空格）。上线前拿至少 5 条真实存量消息对比开关前后
- **(desktop)** 复用点确认：`message-info.vue` / `msg-reply-poll.vue` 吃同一个 `convertMarkdownToHtml`，但表格样式写在 `msg-actioncard.vue` 的非 scoped style 里——**实测这两个组件里表格样式是否生效**，没生效就把 `.md-table-wrap` / `table` 那段提到全局 scss
- **(android)** 装 `smart_message-develop-debug_v3.6.18.apk` → `adb shell am start -n com.cnmts.smart_message.develop/com.im.debug.MarkdownGfmCasesActivity` → 逐条对照（31 条，比 PC 多一条删除线）
- **(android)** ⚠️ **段栈三个高风险点**，真实会话里必须验：①含表格的消息**长按能弹转发/回复菜单**（最容易翻车）；②表格横滚时上下滑动仍能滚会话列表；③折叠时表格不被切一半
- **(android)** View 复用验证：含表格消息与纯文本消息**交替滚动**，看有没有留白或串内容
- **(两端)** 真实样本三条：值班播报（内联 HTML 上色）、含表格 + 插图 + 角标的长回复、普通机器人卡片。两种气泡底色（自己发的淡蓝 / 收到的白）都看
- **(两端)** 自测通过后**删用例页**：PC 删 `components/debug/MarkdownGfmCases.vue` + router 那条；安卓删 `com/im/debug/MarkdownGfmCasesActivity.java` + manifest 那条

### 已知未做

- **脚注 `[^1]`**：PC 不能装包（工作区禁 `npm install`）、Markwon 无官方插件、真实消息里没见过。要做得自写 commonmark 扩展
- **数学公式**：与 iOS 同，GFM 无此语法，尚无真实样本
- **代码块语法高亮 / 表格首列固定**：范围外
- **(android)** `isReferUnitPrimary`（回复聚合列表首条源消息，阈值 78/123dp）那条折叠路径**没接段栈**，仍是 `setMaxHeight` 硬切。含表格的消息出现在那个位置时，折叠仍可能切断表格。优先级低（该位置本就只显示一小截），但要知道

## 关键决策记录

- 2026-08-14 范围只做 **PC + 安卓**，web 不动（`AcMarkdown.vue` 只服务 AI 卡片/文本优化弹窗，非消息气泡）
- 2026-08-14 **行为 spec 的「PC 复用 web 渲染」前提被证伪**：PC 自有 `markdown-it` 管线，与 web 的 `marked` 无关。本轮是两套独立管线各自补齐
- 2026-08-14 **两端均无流式打字机链路**（智能体回复整条推送）→ 行为 spec 第 6 节流式规则本轮 N/A
- 2026-08-14 **遮罩配色划出范围**：PC 用 `-webkit-mask-image` 透明淡出、安卓 4 张 drawable 按 `isSend` 分好，iOS 那个白遮罩 bug 两端都不存在
- 2026-08-14 **折叠阈值三端不统一**（PC 400px / 安卓 480dp / iOS 另有一套）—— 字号行距屏宽都不同，对齐数值反而不对齐观感
- 2026-08-14 安卓表格横滚走**段栈 + `HorizontalScrollView` 包 `TableLayout`**（与 iOS 同思路）。附带收益：折叠从像素硬切改为按段取舍，直接满足「裁剪线不切表格」
- 2026-08-14 **无表格消息不走段栈**，保持原单 `TextView` 路径 —— 段栈改造的回归面只覆盖含表格消息
- 2026-08-14 PC 开 `breaks: true` 对齐 spec I8，接受存量消息排版变化
- 2026-08-14 PC 禁装包 → 任务列表**自写 core rule**（约 25 行），脚注直接不做
- 2026-08-14 安卓表格用 Markwon 自带的 `Table.parse(Markwon, TableBlock)`，**不手写 commonmark AST 遍历**（plan 里的原方案代码量翻倍且没必要）
- 2026-08-14 段栈暴露 `SegmentPostProcessor` 钩子接住 AI 卡片的角标/图片 Span 后处理；知识来源列表走单独的 `appendExtraText()` 挂最后（塞进 processor 的话，最后一段是表格时它没地方去）
- 2026-08-14 验收走**两端各建临时 debug 用例页**，验完删，与 iOS 上一轮做法一致

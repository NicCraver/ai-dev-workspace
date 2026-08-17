# Status：pc安卓-GFM-Markdown渲染对齐

> 最后更新：2026-08-17（安卓登录崩溃**已定位并修复**，真机验证通过；与本功能无关，代码落 `personal-ai-chat-hotfix` 并合进 GFM 分支）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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

## 各端工作区现状（2026-08-17，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 119 | 干净 | 本功能 status 仅刷新工作区表 | 上一笔 `8288cbc`（记 desktop/ios 预存脏区非本功能） |
| web | `feat/data-scope-secret-tag` | synced | 干净 | **不涉及** | 标题栏涉密按钮黄色已 push `749d1f3`，属 `20260812-数据范围-涉密标签` |
| android | **`feat/gfm-markdown`** | **无 upstream** | 干净 | **本功能分支** | 最新 `856b176cc`（merge `personal-ai-chat-hotfix`）。本会话只改了登录崩溃（base_data 转换器），**没碰任何 GFM 代码**；`personal-ai-chat-hotfix` 停在 `1b97741e4`。两条分支均未 push |
| ios | `master-3.5.30` | synced | 脏 1 | **不涉及** | 脏的是 `project.pbxproj`（本地工程文件，非本功能、本会话未改） |
| desktop | **`feat/gfm-markdown`** | **无 upstream** | 脏 2 | **本功能分支，脏区不是 GFM** | 最新仍 `f2a7d5f6`。脏的是 `electron-builder.yml`/`package.json` 本地调试配置，**禁止提交** |

> **工具脚本（与本功能无关，记录备查）**：2026-08-14 新增 `scripts/prod-pc-build.mjs` / `prod-android-build.mjs`。2026-08-17 优化 `scripts/pc-build-test.mjs`：TTY 阶段进度条、webpack/electron-builder 实时流式输出、默认 `compression=normal`、Electron 已是 arm64 则跳过重装、sqlite3/leveldown 并行编译。安卓正式包任务**必须带 `:smart_message:` 模块前缀**——无前缀会给 IM / basis_function_api 等 library 也打 release，触发 `verifyPublishReleaseResources` 孤立资源校验，library 引用 app 模块 drawable 必挂。

## 安卓真机首轮自测暴露的问题（2026-08-14，已修复，待复验）

| # | 症状 | 根因 | 处理 | commit |
|---|------|------|------|--------|
| 1 | 表格**有格子没文字**（表头背景色可见、单元格被 padding 撑出大小，文字全空） | `Table.parse(markwon, block)` 传的是**带 `TablePlugin` 的实例**。该插件注册的 `NodeVisitor<TableCell>` 会把单元格文本渲进 builder 后**再抽走**存成 `TableRowSpan.Cell`（span 表格的拼法），于是 `markwon.render(tableCell)` 拿回来永远是空 | 新增 `ZXMarkwonFactory.createForTableCell()`：同样插件表但**不装 TablePlugin**，专供 `Table.parse` 渲染单元格 | `df460e27c` |
| 2 | 表格无边框线 | `TABLE_BORDER` 常量定义了却从未使用，只设了表头背景色。`TableTheme` 的 border 只作用于 Markwon 的 span 表格，段栈路径完全绕开 | 每格一个 `GradientDrawable` 带 1px stroke；顺带补显式 `TableRow.LayoutParams`（原来吃默认的 `MATCH_PARENT`） | `df460e27c` |
| 3 | 卡片高度失控：收起了一部分内容，但卡片仍极高，滚很久才到消息顶部 | `applyFold()` 里的 `i > 0` 守卫。「第一块超限高则整块显示不切」这条规则的本意是**不可分割的块**（表格/图片）不切一半，我对所有段一律套用；而安卓的富文本段是**多个块合并成的一个 TextView**，AI 长回复第一段就几千 px，于是整段免疫折叠，只收起了后面的表格和知识来源 | 折叠区分两类段：富文本段（TextView）**可切**，按剩余高度 `setMaxHeight` 截断；表格段**不可切**，放不下整段隐藏（仅当它是第一段且超限时才整块显示） | `df460e27c` |
| 4 | **消息列表无法往上滚，一直被拽回底部**（严重） | `TextView.setMovementMethod()` 内部执行 `fixFocusableAndClickableSettings()`，把 focusable / clickable / longClickable **一并强制设回 true**。我在 `newSegmentTextView()` 里设的 false 在 `setMovementMethod()` **之前**，全部作废。加上 `HorizontalScrollView` 构造函数自带 `setFocusable(true)` → 段栈每个子 View 都可获焦 → RecyclerView 布局时 `requestChildFocus` 把它滚进可视区 → 往上滚被反复拽回 | 段栈 `setDescendantFocusability(FOCUS_BLOCK_DESCENDANTS)` 一刀切断；表格控件显式 `setFocusable(false)` + `setScrollContainer(false)`；TextView 抽出 `disableFocusAndLongClick()`，**在 `setMovementMethod()` 之后**调用 | `7b9f7872c` |

> 第 4 条**顺带修掉了另一个还没测到的问题**：`longClickable` 被打回 true 后，含表格的消息长按弹不出转发/回复菜单——正是先前标为「段栈最容易翻车」的那条。
>
> 链接点击不受影响：`LinkMovementMethod` 在 `onTouchEvent` 里先于 clickable 判定处理事件，按在链接上会被消费，按在空白处冒泡给气泡。

## 待办 / 阻塞

### ✅ 已解决：安卓「点击登录后崩溃退出」（2026-08-17，与本功能无关）

**结论：不是 GFM 改动引起的，是 greenDAO 转换器的既有 bug。** 真机验证已通过（修复包装机后登录不再崩）。

**崩溃**
```
java.lang.IllegalArgumentException: the bind value at index 71 is null
  at greendao.bean_dao.ChatMessageAsRouteDao.bindValues(ChatMessageAsRouteDao.java:887)
  at greendao.util.DataCenter.saveDialogueLastMessageFromServer(DataCenter.java:2041)
  at com.cnmts.smart_message.login.InitPersonalDataActivity$5.onSuccess(InitPersonalDataActivity.java:334)
```

**根因**：greenDAO 生成的 `bindValues` 只判 `list != null` 就调 `bindString`，而 `KnowledgeDocConverter.convertToDatabaseValue` 对**非 null 的空列表**返回 null（`if (entityProperty == null || entityProperty.size() == 0) return null;`），空列表穿过 null 守卫后 `bindString(71, null)` 直接抛。登录后 `InitPersonalDataActivity` 拉会话最后一条消息入库时触发。

**为什么只有正式包崩**：与 buildType / 混淆 / 签名全都无关（release 的 `minifyEnabled` 本就是 false）。纯粹是正式环境某条会话的最后一条消息带了**空的** `knowledgeDocList`，测试环境的样本不为空，碰不到这条边界。

**为什么难查**：App 自己的 `com.cnmts.smart_message.common.crash_handler.CrashHandler` 捕获后直接 `App.killProcess()`，非 debug 分支**不打堆栈**，logcat 里连 `FATAL EXCEPTION` 都没有，只有一行 `Process is going to kill itself!`。真堆栈落在手机 `/sdcard/ZhiXin/Log/crash/crash-<yyyyMMdd_HHmmss>.txt`（路径来自 `SDCardUtils.getCrashReportPath()`）。**这条排查经验已写进 `context/platforms/android.md`。**

**修复**（commit `1b97741e4` on `personal-ai-chat-hotfix`，已 merge 进 `feat/gfm-markdown` = `856b176cc`，**两条分支都未 push**）：
- `KnowledgeDocConverter`：空列表序列化成 `"[]"`，只有 null 才返回 null
- `AccountStartConverter`：同源隐患一并修（`AccountAppraisingDao.bindValues` 同样只判 null，尚未爆但迟早）
- 新增两个转换器单测共 8 条（先写先跑红：3 条空列表断言 FAILED → 改完全绿）；`base_data/build.gradle` 补 `testImplementation 'junit:junit:4.12'`（该模块原先无 test 依赖）
- 已审计 `base_data` 下全部 19 个 `PropertyConverter`，有此 bug 的**只有这两个**；`BtnDataConverter`（管 69/70 两列）等其余均只在入参为 null 时返回 null，安全

**验证**：`:base_data:testDebugUnitTest` 8/8 绿；`:smart_message:assembleDevelopDebug` 与 `:smart_message:assemblePublishRelease` 均 BUILD SUCCESSFUL；正式包装真机复测登录**不再崩溃**。

**遗留**：排查期间为绕开 MIUI 覆盖安装限制，**卸载过一次** `com.cnmts.smart_message`，手机本地聊天缓存已清（登录后服务端重新同步）。合并 hotfix 后 GFM 分支版本号从 `295/v3.6.18` 跟到 `297/v3.6.20`。

### 安卓复验清单（新包 `smart_message-develop-debug_v3.6.18.apk`，`7b9f7872c`）

1. **消息列表上下滚动流畅**，尤其滚过含表格的消息（第 4 条）
2. 含表格消息**长按能弹转发/回复菜单**（第 4 条顺带修的）
3. 表格里的链接还能点（验证 `setClickable(false)` 没把链接点击一起关掉）
4. 表格文字与边框（第 1、2 条）
5. 长回复的折叠高度（第 3 条）

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

# Status：pc安卓-GFM-Markdown渲染对齐

> 最后更新：2026-08-17（**三端样式统一已落码**：PC lint + 23 单测绿、安卓 `assembleDevelopDebug` 通过、iOS 只改代码未构建。**全部运行时观感待你自测**）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| T14 三端样式统一（token 表落地，**运行时未验**） | — | ✅ | ✅ | ✅ |

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
| context | `main` | ahead 123 | 干净 | 本次落 token 表 + 样式改动清单 | 新增 `context/design/markdown-style-tokens.md`（三端样式唯一事实来源） |
| web | `feat/data-scope-secret-tag` | synced | 干净 | **不涉及** | 标题栏涉密按钮黄色已 push `749d1f3`，属 `20260812-数据范围-涉密标签` |
| android | **`feat/gfm-markdown`** | **无 upstream** | 干净 | **本功能分支** | 最新 `a092b0c3c`（样式统一）。`personal-ai-chat-hotfix` 停在 `1b97741e4`。两条分支均未 push |
| ios | **`feat/ios-gfm-markdown`** | ahead 1 | 干净 | **本轮一起改了样式** | 最新 `9e5437ee3`（样式统一，未 push）。本会话从 `master-3.5.30` 切过来的，切前把本地脏的 `project.pbxproj` 排序噪声 **stash 了，回主干记得 pop** |
| desktop | **`feat/gfm-markdown`** | **无 upstream** | 脏 2 | **本功能分支，脏区不是 GFM** | 最新 `884ff628`（样式统一）。脏的是 `electron-builder.yml`/`package.json` 本地调试配置，**禁止提交**，本次提交已排除 |

> **工具脚本（与本功能无关，记录备查）**：2026-08-14 新增 `scripts/prod-pc-build.mjs` / `prod-android-build.mjs`。2026-08-17 优化 `scripts/pc-build-test.mjs`：TTY 阶段进度条、webpack/electron-builder 实时流式输出、默认 `compression=normal`、Electron 已是 arm64 则跳过重装、sqlite3/leveldown 并行编译。安卓正式包任务**必须带 `:smart_message:` 模块前缀**——无前缀会给 IM / basis_function_api 等 library 也打 release，触发 `verifyPublishReleaseResources` 孤立资源校验，library 引用 app 模块 drawable 必挂。

## 三端 UI 样式一致性审计（2026-08-17，只读代码，未改任何代码）

三端 GFM 语法都能识别、表格都能横滚之后，样式观感仍不统一。**根因：三端各自吃了各自框架的默认值**，当初只刻意对齐过表格配色（4% 黑表头 / 12% 黑边框）。正文色三端一致（`#1F2329`，iOS `Color_H1` = `1F2329`）。

### drift 的三个源头

| # | 源头 | 落点 | 带来的默认值 |
|---|------|------|-------------|
| 1 | **PC 挂着 `prose`**（UnoCSS `presetTypography` 0.50） | `msg-actioncard.vue:58` | `:not(pre) > code::before/after { content: "\`" }` → **行内代码带反引号**；`tr:nth-child(2n)` → **表格斑马纹**；`blockquote{font-style:italic}` → **引用斜体**；`p,ul,ol,pre{line-height:1.75}`；h1/h2 一堆 em 边距（h5/h6 没有，标题间距不匀）。**另两端都没有前三条** |
| 2 | **安卓从没配 `MarkwonTheme`** | `ZXMarkwonFactory.java:85` 只设了 table 主题 | 反编译 `core-4.6.2` 确认：`HEADING_SIZES={2,1.5,1.17,1,.83,.67}` → 15sp 正文下 **H1=30sp、H6=10sp**；H1/H2 自带 `headingBreakHeight=1` 横线；行内代码/代码块底色 = 正文色 25% alpha；引用竖条 25% alpha 且不变字色；链接色 = 主题 `textColorLink`（从没显式设过） |
| 3 | **安卓段栈丢了行距（这条算 bug）** | `ZXMarkdownContentView.java:117` `newSegmentTextView()` | `rc_item_action_card_message.xml:72` 的 `tv_content` 有 `lineSpacingExtra=5dp`，段栈新建的 TextView 没设，`addView` 也没给 margin → **同一会话里含表格的消息行距比不含表格的窄，段间无间距** |

### 逐项差异（基准：PC 13px / 安卓 15sp / iOS 16pt）

| 项 | PC | 安卓 | iOS |
|---|---|---|---|
| 标题 H1–H6 | 18/17/16/15/14/13 px | 30/22.5/17.6/15/12.5/10 sp（默认倍率） | 22/20/18/16/15/14 pt |
| H1/H2 下横线 | 无 | **有** | 无 |
| 行距 | 1.75em | 1.33em（**段栈里 1.0**） | +6pt ≈ 1.37em |
| 段间距 | 1em | Markwon 空行 + 段栈 0 | 6pt（`paragraphSpacing`） |
| 行内代码 | **带反引号**、.875em、600、透明底 | 25% alpha 底 | `#F5F6F7` 底、Menlo、base−1 |
| 代码块 | padding 1.25rem/1.5rem、圆角 6、透明底 | 25% alpha 底、8dp margin | `#F5F6F7` 底、缩进 12 |
| 引用 | .25em 左边框 + **斜体** + 1em padding | 2dp 竖条、字色不变 | `▎` 字符 + 45% 白字色 + 缩进 12 |
| 列表缩进 / marker | 1.25em、各级同 disc | Markwon span、圆/空心/方 | 18pt/级、`•`/`◦`/`▪` |
| 任务列表 | 原生 `<input type=checkbox disabled>`（系统灰方框） | `TaskListPlugin` drawable（主题色） | `☑`/`☐` 字符 |
| 链接 | `#3E7EFF` 无下划线 | 主题 `textColorLink`（未设） | `#006AFF` |
| hr | 1px `#e7e7e7` + 2em margin | 25% alpha 黑 | 空行画删除线，12% 黑 |
| 表格 cell padding | 4/8 px | **8/4 dp（横竖反了）** | 8/8 pt |
| 表格边框 | 1px 无圆角 | 每格 1px → **相邻格叠成 2px**，无圆角 | 0.5px 外框 + 圆角 4 |
| 最大列宽 | 无上限 + `white-space:nowrap`（**永不换行**） | 220dp 后换行 | 160pt 后换行 |
| 斑马纹 | **有** | 无 | 无 |

### 落地情况（2026-08-17 已按下述方案改完，见文末「样式统一改动清单」）

**绝对数值不对齐**（13px/15sp/16pt 是各端既有正文规格，硬对齐反而不对齐观感），对齐的是**相对基准字号的倍率 + 颜色 + 结构**。

已建 `context/design/markdown-style-tokens.md` 作唯一事实来源，三端照抄：

| token | 值 |
|---|---|
| 标题倍率 | 1.40 / 1.25 / 1.15 / 1.08 / 1.00 / 1.00，全部粗体（H5/H6 不缩小，靠加粗区分——现在 iOS/安卓的 H5/H6 比正文还小，像降级正文） |
| 标题横线 / 边距 | 无横线（安卓 `headingBreakHeight(0)`）；上 0.75em 下 0.35em |
| 行距 / 段间距 | 1.4em / 0.5em |
| 正文色 / 链接色 | `#1F2329` / `#3E7EFF` 无下划线（iOS 从 `#006AFF` 改，安卓显式设） |
| 行内代码 | 底 `rgba(0,0,0,.06)`、圆角 2、0.92em、等宽、**无反引号** |
| 代码块 | 底 `rgba(0,0,0,.04)`、圆角 4、padding 8/10、0.92em、不做高亮 |
| 引用 | 左竖条 2px `rgba(0,0,0,.2)`、字色 `#5D616B`、**不斜体**、左内边距 8 |
| 列表 | 缩进 1.2em/级，marker 三级 disc / circle / square |
| 任务列表 | 1em 蓝色勾选方框（primary）——三端都做成勾选框外观，iOS 的字符染 primary |
| hr | 1px `rgba(0,0,0,.12)`，上下 0.75em |
| 表格 | cell padding 竖 0.35em 横 0.6em；表头 4% 黑 + 粗体；边框 1px 12% 黑；**无圆角、无斑马纹**；最大列宽 12em 后换行 |

各端落点：

- **PC**（2 文件）：`msg-actioncard.vue:58` **去掉 `prose`**，把 `:700–768` 的非 scoped style 扩成完整一套（约 +50 行）。留 prose 再逐条覆盖也行，但 preset 升版还会飘。顺带解决 spec 第 8 节遗留第 4 条：这段样式提到全局 scss，让 `message-info.vue` / `msg-reply-poll.vue` 一起吃到。`th/td` 去掉 `nowrap`，改 `max-width:12em` + 允许换行
- **安卓**（3 文件）：`ZXMarkwonFactory` 加 `AbstractMarkwonPlugin.configureTheme()` 设标题倍率 / `headingBreakHeight(0)` / code 与 blockQuote 配色 / `linkColor` / `bulletWidth`，`TaskListPlugin.create(...)` 传 primary；`ZXMarkdownContentView:117` 补行距 + 段间 `topMargin`；`ZXMarkdownTableView:95` padding 横竖改回来，边框改成每格只画右+下、容器画左+上（消双线）
- **iOS**（1 文件，在 `feat/ios-gfm-markdown` 分支）：`ZXMarkdownStyle.m` 本来就是集中式样式表，改常量即可——`headerFontSizes` 按倍率重算（16pt 基准 → 22/20/18/17/16/16）、`linkColor` 改 primary、引用字色改 `#5D616B`、`tableCellPadding` 拆横/竖两个、表格去圆角、`tableMaxColumnWidth` 160→192

> iOS 的 `ZXMarkdownStyle` 是三端里结构最好的，建议当模板：安卓与 PC 也各收敛出一个「样式常量入口」（安卓一个 `configureTheme` 块、PC 一段 scss 变量），以后改一处不用翻三处。

**顺序**：先跑完下面「下一步全是运行时自测」那批，**再动样式**。现在两端改动只到「编译通过」，样式与功能混一起改，回归时分不清谁的锅。样式改完后三端用例页各截一遍并排比对，再一起删用例页。

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

### 样式统一改动清单（2026-08-17 已提交，运行时全未验）

| 端 | commit | 文件 | 内容 | 验证到什么程度 |
|----|--------|------|------|---------------|
| desktop | `884ff628` | 4 | 新增全局 `assets/styles/markdown.scss` + `main.js` 引入；`msg-actioncard.vue` / `msg-reply-poll.vue` 去掉 `prose` 类并删掉组件内那份样式 | `npm run lint` 干净 + markdown 相关 23 条单测全绿 |
| android | `a092b0c3c` | 4 | `ZXMarkwonFactory` 加 `configureTheme` + `configureSpansFactory`（引用字色）；`ZXMarkdownContentView` 补行距 6dp / 段间距 7dp、折叠计入 topMargin；`ZXMarkdownTableView` padding 9/5、列宽 180dp、边框换 `EdgeLineDrawable`；布局 `tv_content` 行距 5dp→6dp | `:IM:assembleDevelopDebug` 与 `:smart_message:assembleDevelopDebug` 均 BUILD SUCCESSFUL |
| ios | `9e5437ee3` | 4 | `ZXMarkdownStyle` 标题改倍率、链接 primary、代码/引用配色拆开、缩进与段间距按字号折算、表格 padding 拆横竖 + 去圆角；`ZXMarkdownAttributedBuilder` / `ZXMarkdownTableView` 跟着改引用 | **未构建**（本仓库 CLAUDE.md 规定 AI 不跑 xcodebuild），只做了属性引用静态核对 |

**iOS 分支处理**：为改这些文件把 ios 仓库从 `master-3.5.30` 切到了 **`feat/ios-gfm-markdown`**（样式代码只在这条分支上）。切之前把本地脏的 `project.pbxproj` 用 `git stash push` 暂存了（那 16 行是 Xcode 的 entry 排序噪声）——**要回 `master-3.5.30` 时记得 `git stash pop`**。

**新增的三端样式自测项**（并入下面的运行时自测批次）：

1. **(PC 专项)** 去掉 `prose` 是本轮回归面最大的改动——`prose` 还提供了 `img/video max-width`、`figure`、`kbd`、`abbr` 等零散规则。真实消息里过一遍：行内代码**不再有反引号**、表格**没有斑马纹**、引用**不斜体**、长表格单元格**换行而不是把表格撑爆**
2. **(安卓)** 表格边框：任意两格之间只有一条线、整表四周也只有一条线（原来相邻格叠 2px）
3. **(安卓)** 含表格消息与纯文本消息**行距一致**（这次修的 bug）
4. **(安卓)** 折叠高度：段间距计入后，折叠态实际高度没超过 480dp
5. **(三端)** 同一条含 H1~H6 / 任务列表 / 引用 / 行内代码 / 表格的消息，三端并排截图比对
6. **(iOS)** iOS 的 GFM 用例页已在 `c4d50e28b` 删掉了，比对得用真实消息或临时再建一个

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

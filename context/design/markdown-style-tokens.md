# Markdown 渲染视觉 token（三端唯一事实来源）

> 建立于 2026-08-17，来源：`context/features/20260814-pc安卓-GFM-Markdown渲染对齐` 的三端样式一致性审计。
> 适用范围：机器人 / 智能体消息气泡里的 markdown 正文渲染（PC `markdown-it` / 安卓 Markwon / iOS 自绘 `ZXMarkdownStyle`）。
> web 端 `AcMarkdown.vue`（个人 AI 框 +「AI 优化文本」）对齐本表的**表格行**和**行内代码**；标题 / 代码块 / 引用 / 列表仍是 AI 框自有皮肤，不要按本表改。

## 原则

1. **不对齐绝对数值，对齐相对倍率 + 颜色 + 结构。** 三端正文基准字号本来就不同（PC 13px / 安卓 15sp / iOS 16pt），硬对齐数值反而不对齐观感。
2. **不吃框架默认值。** 三端 drift 的根因就是各自吃了 UnoCSS `presetTypography` / Markwon `MarkwonTheme` 的默认值。每端必须有一个显式的「样式常量入口」，所有值从本表抄。
3. **颜色一律半透明黑**（代码、引用、hr）。消息气泡底色有淡蓝和白两种，写死浅灰白叠上去会突兀。
   **例外：表格表体单元格底 `#fff`；表头底仍 `rgba(0,0,0,.08)`，表头字重 600。**
   > 2026-09-02：普通自己发退回线上色（PC `#CCE0FE`、安卓 / iOS `#DEE8FF`）。`#F0F5FF` 只属于自己发的 ActionCard（转发 AI 回复、定时用我身份），并加 `1px #F4F6F8` 描边（对齐 web `BaseMsgCard` 白卡，无 box-shadow）。半透明黑百分比不用跟着改。气泡色本身不属于 markdown token，入口见下表脚注。

## Token 表

| token | 值 | PC 13px | 安卓 15sp | iOS 16pt |
|---|---|---|---|---|
| 正文色 | `#1F2329` | ✅ 已一致 | ✅ | ✅ |
| 正文行距 | 1.4em | `line-height: 1.4` | `lineSpacingExtra 6sp` | `lineSpacing 6` |
| 段间距 | 0.5em | `margin: .5em 0` | 段间 `topMargin 7dp` | `paragraphSpacing 8` |
| 标题倍率 | 1.40 / 1.25 / 1.15 / 1.08 / 1.00 / 1.00，**全部粗体** | 18/16/15/14/13/13 px | 21/19/17/16/15/15 sp | 22/20/18/17/16/16 pt |
| 标题色 | `#3E7EFF`（primary），**只染 H1–H4**；H5 / H6 跟正文色（它们字号不缩小，再上色会和正文强调混淆）。2026-09-01 加，来源是 web `AcMarkdown.vue` | `h1~h4 { color }` | `appendFactory(Heading.class, …)` 追加 `ForegroundColorSpan`，**不能 setFactory**（会顶掉默认的加粗 / 字号 span） | `ZXMarkdownStyle.headerColor` + `headerColorMaxLevel`；标题里的链接保持链接色，只染没单独指定过颜色的片段 |
| 标题边距 | 上 0.75em，下 0.35em | | | |
| 标题下横线 | **无**（Markwon 默认 H1/H2 带横线，须关掉） | — | `headingBreakHeight(0)` | — |
| 链接色 | `#3E7EFF`（primary），**无下划线** | | `linkColor` 显式设 | 从 `#006AFF` 改 |
| 行内代码 | 底 `rgba(0,0,0,.08)`、圆角 2、0.92em、等宽字体、**不加反引号** | 须干掉 prose 的 `code::before/after` | | |
| 代码块 | 底 `rgba(0,0,0,.10)`、圆角 4、padding 竖 8 横 10、0.92em 等宽、**不做语法高亮** | 淡蓝气泡上 4% 黑几乎看不见 | | |
| 引用块 | 左竖条 2px `rgba(0,0,0,.28)`、字色 `#5D616B`、左内边距 8、**不斜体** | 须干掉 prose 的 `font-style: italic` | | |
| 列表缩进 | 1.2em / 级 | | | 19pt |
| 列表 marker | 三级 disc / circle / square，视觉重量要一致 | | Markwon 默认即此（自绘，尺寸统一） | `•` / `◦` / `▪` 字面大小差得多，按 `listMarkerFontScales` = 1.2 / 1.4 / 0.85 拉平 |
| 引用竖条实现 | 必须覆盖整段，不能只覆盖第一行 | `border-left` | Markwon `BlockQuoteSpan`（leading margin） | **真视图画**（独立引用块）。字符 `▎` 逐行前缀只能落在逻辑行首，软换行后面几行就没有了 |
| 任务列表 | 1em 方框 + 勾，选中色 `#3E7EFF` | `appearance: none` 自绘（**不能靠 `accent-color`**，disabled 的原生 checkbox 会被整个画成灰色） | `TaskListPlugin` 传 primary | 字符染 primary；`☐` 放大 1.15 拉平（它比 `☑` 小一圈） |
| hr | 1px `rgba(0,0,0,.12)`，上下 0.75em | | | |
| 表格 · 表体单元格底 | `#fff` | | | |
| 表格 · 表头底 | `rgba(0,0,0,.08)`（不改） | | 8% 黑 `0x14000000` | 4% 黑（iOS 原值） |
| 表格 · 表头字重 | `600`（semibold） | `font-weight: 600` | API 28+ `Typeface.create(_, 600, false)`；以下退 medium | `UIFontWeightSemibold` |
| 表格 · 边框 | 1px `rgba(0,0,0,.22)`，**单线、无圆角** | 12% 在自己发的淡蓝气泡上几乎看不见格子 | 每格只画右+下，容器画左+上（否则相邻格叠成 2px） | 去圆角 |
| 表格 · cell padding | 竖 0.35em 横 0.6em | 5/8 px | 5/9 dp | 6/10 pt |
| 表格 · 换行 | 单元格有列宽上限，超出折行；多列仍靠横滚。不要把整表设成 100% 宽再换行（会挤成一列一个字）。短列随内容，不要 min-width 把窄表撑开 | `max-width: 375px`（整段设计稿宽） | 列宽上限 360dp | 列宽上限 24em（384pt） |
| 表格 · 斑马纹 | **无**（prose 默认有，须干掉） | | | |
| 表格 · 横滚条 | 溢出即常驻（不等滑、不淡出）；窄表不画。细胶囊 overlay，约 35% 黑。**无左右渐变罩** | 6px 常驻 webkit 条；窄表底 8px；溢出时条上 4px、条下 margin 20px | 3dp 自绘胶囊 | 3pt 自绘胶囊 |

## 有意不统一的项

| 项 | 原因 |
|---|---|
| 正文基准字号（13px / 15sp / 16pt） | 各端既有正文规格，属各端设计体系，不在本表管辖范围 |
| 折叠阈值（PC 400px / 安卓 480dp / iOS 另一套） | 字号、行距、屏宽都不同，对齐数值反而不对齐观感 |
| 行内代码的横向内边距 | iOS 用 `NSBackgroundColorAttributeName` 上色，attributed string 没有 padding 概念，只有底色。PC / 安卓有 2px 横向内边距，iOS 没有 |
| 代码字号（PC/iOS 0.92em、安卓 0.87em） | Markwon 只接受绝对 px（`codeTextSize`），写死会和正文字号脱钩，故留它的默认 0.87 倍 |
| 引用块缩进（安卓 18dp，PC/iOS ≈10） | Markwon 的引用缩进与列表缩进共用 `blockMargin`，拆不开。取列表要的 1.2em，引用因此偏深 |
| 代码块语法高亮、表格首列固定、脚注、数学公式 | 三端都不做，见功能 spec 第 7 节 |

## 各端样式入口（改样式只需动这几处）

| 端 | 入口 |
|---|---|
| PC | `apps/desktop/src/renderer/assets/styles/markdown.scss`（全局，`main.js` 引入；`.md-html-wrapper` 下一套规则，**不挂 `prose`**） |
| 安卓 | `apps/android/IM/src/main/java/com/im/message_type/robot/ZXMarkwonFactory.java` 的 `configureTheme()`；表格控件 `ZXMarkdownTableView`；段栈 `ZXMarkdownContentView` |
| iOS | `apps/ios/SmartMessage/ZX_Base/ZX_Manager/Markdown/ZXMarkdownStyle.m` 的 `defaultStyleWithBaseAttributes:` |
| 气泡底色（非 markdown token，但正文配色依赖它） | PC **以 `chat-box.vue` 为准**：`.chat-box-organization .message-item-self .msg-box` 带 `!important`，普通自己发 `#CCE0FE`；自己发 ActionCard 另加 `msg-box-actioncard` 走 `#F0F5FF` + `1px #F4F6F8` 描边。`msg-list.vue` / `reply-msg-list.vue` / `winbox-wrapper.vue` 基底要一起改。折叠渐变 `foldParentBg_Or_Send` 跟普通气泡。卡头 `.message-wrapper-self .actioncard-header` 仍 `#D7E5FF`。安卓普通自己发 `shape_solid_dee8ff_...16dp.xml`（solid `#DEE8FF`）；ActionCard 自己发另用 `shape_solid_f0f5ff_...16dp.xml`（`#F0F5FF` + stroke `#F4F6F8`）。iOS `Color_Chat_ZZ_Send` 是普通自己发 `#DEE8FF`；`ZXGroupRobotCell` 自己发覆盖 `#F0F5FF` + `#F4F6F8` 描边。字号设置页预览图跟普通气泡。web 无聊天气泡 |
| web（表格 + 行内代码） | `apps/web/src/components/common/AcMarkdown.vue`：表格走 `.tableWrapper` / `table`；行内 `code` 走 `:not(pre) > code`（干掉 prose 的 `code::before/after` 反引号）。直播 DOM 的表格外壳来自 Tiptap `TableView`（`resizable: false` 时总会包一层）；`EditorWrapper` 仅在 `markdownAsHtml` 时打开 `renderWrapper`，让 `getHTML()` 也带外壳。横滚条 6px、表底恒 8px，**不对齐** PC 列里溢出时 4px+20px 那套 gutter。单元格 `max-width: 187.5px`（375/2）后换行。PC 会话列是 **max-width 375px**（不要 min-width，短列随内容）。横滚要生效：气泡链路上每层 `min-width: 0` + `max-width: 100%`，不要 `max-width: max-content`。波浪下划线走 `ExtendUnderline` + `ExtendInlineSpanStyle` 的 `text-decoration`。 |

## 内联 HTML 标签（2026-08-25）

| 标签 / 样式 | 观感 | iOS | 安卓 | web |
|---|---|---|---|---|
| `<small>` / `<big>` | 0.83em / 1.2em | `processHTMLTags` | Markwon 默认 | 浏览器默认（Tiptap 可能剥掉，靠 CSS 兜底不够） |
| `<code>` / `<kbd>` / `<samp>` / `<tt>` | 等宽 + 浅底胶囊 | `processHTMLTags`（原先漏了 `<code>`，会原样露标签） | Markwon 默认 | StarterKit Code |
| `<del>` / `<s>` / `<strike>` | 删除线 | `processHTMLTags` | Markwon Strike | StarterKit Strike |
| `<i>` / `<em>` / `<cite>` / `<dfn>` / `<var>` | 斜体。中文必须 `obliqueness`，不能只换 italic 字体 | `NSObliquenessAttributeName` | Markwon Emphasis | StarterKit Italic |
| `<u>` / `<ins>` | 下划线 | `NSUnderlineStyleSingle` | `UnderlineSpan` | `ExtendUnderline` |
| `text-decoration: underline wavy` | 波浪线 | 系统没有 wavy，仍画直线 | `WavyUnderlineSpan` | `text-decoration-style: wavy` |

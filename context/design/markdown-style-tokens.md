# Markdown 渲染视觉 token（三端唯一事实来源）

> 建立于 2026-08-17，来源：`context/features/20260814-pc安卓-GFM-Markdown渲染对齐` 的三端样式一致性审计。
> 适用范围：机器人 / 智能体消息气泡里的 markdown 正文渲染（PC `markdown-it` / 安卓 Markwon / iOS 自绘 `ZXMarkdownStyle`）。
> **不适用** web 端的 `AcMarkdown.vue`（那是 AI 卡片弹窗，不是消息气泡）。

## 原则

1. **不对齐绝对数值，对齐相对倍率 + 颜色 + 结构。** 三端正文基准字号本来就不同（PC 13px / 安卓 15sp / iOS 16pt），硬对齐数值反而不对齐观感。
2. **不吃框架默认值。** 三端 drift 的根因就是各自吃了 UnoCSS `presetTypography` / Markwon `MarkwonTheme` 的默认值。每端必须有一个显式的「样式常量入口」，所有值从本表抄。
3. **颜色一律半透明黑**（表格、代码、引用、hr）。消息气泡底色有淡蓝（自己发）和白（收到）两种，写死浅灰白叠上去会突兀。

## Token 表

| token | 值 | PC 13px | 安卓 15sp | iOS 16pt |
|---|---|---|---|---|
| 正文色 | `#1F2329` | ✅ 已一致 | ✅ | ✅ |
| 正文行距 | 1.4em | `line-height: 1.4` | `lineSpacingExtra 6sp` | `lineSpacing 6` |
| 段间距 | 0.5em | `margin: .5em 0` | 段间 `topMargin 7dp` | `paragraphSpacing 8` |
| 标题倍率 | 1.40 / 1.25 / 1.15 / 1.08 / 1.00 / 1.00，**全部粗体** | 18/16/15/14/13/13 px | 21/19/17/16/15/15 sp | 22/20/18/17/16/16 pt |
| 标题边距 | 上 0.75em，下 0.35em | | | |
| 标题下横线 | **无**（Markwon 默认 H1/H2 带横线，须关掉） | — | `headingBreakHeight(0)` | — |
| 链接色 | `#3E7EFF`（primary），**无下划线** | | `linkColor` 显式设 | 从 `#006AFF` 改 |
| 行内代码 | 底 `rgba(0,0,0,.06)`、圆角 2、0.92em、等宽字体、**不加反引号** | 须干掉 prose 的 `code::before/after` | | |
| 代码块 | 底 `rgba(0,0,0,.04)`、圆角 4、padding 竖 8 横 10、0.92em 等宽、**不做语法高亮** | | | |
| 引用块 | 左竖条 2px `rgba(0,0,0,.2)`、字色 `#5D616B`、左内边距 8、**不斜体** | 须干掉 prose 的 `font-style: italic` | | |
| 列表缩进 | 1.2em / 级 | | | 19pt |
| 列表 marker | 三级 disc / circle / square | | Markwon 默认即此 | `•` / `◦` / `▪` |
| 任务列表 | 1em 方框 + 勾，选中色 `#3E7EFF` | | `TaskListPlugin` 传 primary | 字符染 primary |
| hr | 1px `rgba(0,0,0,.12)`，上下 0.75em | | | |
| 表格 · 表头底 | `rgba(0,0,0,.04)` + 粗体 | ✅ 已一致 | ✅ | ✅ |
| 表格 · 边框 | 1px `rgba(0,0,0,.12)`，**单线、无圆角** | | 每格只画右+下，容器画左+上（否则相邻格叠成 2px） | 去圆角 |
| 表格 · cell padding | 竖 0.35em 横 0.6em | 5/8 px | 5/9 dp | 6/10 pt |
| 表格 · 最大列宽 | 12em，超出则单元格内换行 | 156px（须去掉 `white-space: nowrap`） | 180dp | 192pt |
| 表格 · 斑马纹 | **无**（prose 默认有，须干掉） | | | |

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

# Impl Notes：PC + 安卓 GFM Markdown 渲染对齐

> 平台无关的实现提炼。最后更新：2026-08-14
> 本功能不涉及接口、不涉及 bridge、无状态机——是纯渲染层改造，故不套模板的接口时序/状态流转小节。

## 1. 两端管线不共享，别指望改一处惠及两端

| 端 | 解析器 | 入口 |
|----|--------|------|
| PC | `markdown-it` 14.1.0 | `src/lib/markdownUtils.js` → `msg-actioncard.vue` / `msg-reply-poll.vue` / `message-info.vue` |
| 安卓 | Markwon 4.6.2 | `ZXMarkwonFactory` → `ActionCardMessageItemProvider` |
| web | `marked` 14.1.4 | `AcMarkdown.vue`（只服务 AI 卡片弹窗，**不是消息气泡**） |

上一轮的移植 spec 写了「PC 复用 web 渲染」，**是错的**。下次别再按这个前提估工作量。

## 2. 不装包也能补齐 GFM

PC 端禁 `npm install`，`node_modules` 里只有裸 `markdown-it`。两条自写规则解决问题：

- **任务列表**：一条 `md.core.ruler.after("inline", ...)`，约 25 行。判据必须是「父级 token 序列为 `list_item_open` → `paragraph_open` → `inline`」，**不能只看首个 text token 是否以 `[x]` 开头**——否则正文里的 `数组下标写作 [x] 这种形式` 会被误改成 checkbox。
- **表格横滚容器**：覆盖 `md.renderer.rules.table_open` / `table_close` 输出 `<div class="md-table-wrap"><table>` / `</table></div>`。比写 plugin 简单，两行。

删除线 markdown-it default preset 自带，不用管。**脚注两端都没做**（PC 无包可用、Markwon 无官方插件、真实消息里没见过）。

## 3. Markwon 自带表格模型，别手写 AST 遍历

`io.noties.markwon.ext.tables.Table.parse(Markwon, TableBlock)` 直接返回：

```
Table.rows() -> List<Table.Row>
  Row.header() -> boolean
  Row.columns() -> List<Table.Column>
    Column.alignment() -> Table.Alignment { LEFT, CENTER, RIGHT }
    Column.content() -> Spanned   // 行内 markdown 已渲染好
```

原本按 commonmark 节点（`TableHead`/`TableBody`/`TableRow`/`TableCell`）手写遍历、再包 `Paragraph` 交给 `markwon.render()` 的方案，代码量是它的两倍，**没必要**。

注意 `org.commonmark.ext.gfm.tables.TableBlock` 来自 commonmark 传递依赖，不在 `io.noties.markwon.ext.tables` 包里。

## 3.1 ⚠️ `Table.parse` 不能用带 `TablePlugin` 的实例

**真机自测踩到的第一个坑，表现是「表格有格子没文字」。**

`TablePlugin` 注册了 `NodeVisitor<TableCell>`，它把单元格文本渲染进 builder 之后**又从 builder 里抽走**，存进 `TableRowSpan.Cell`——span 表格就是这么拼出来的。而 `Table.parse` 内部对每个 `TableCell` 调 `markwon.render(cell)`，若这个实例带 `TablePlugin`，拿回来的 `Spanned` 一律为空。

结论：**自绘表格必须准备两个 Markwon 实例**——正文那个带 `TablePlugin`（用于切段判定与非表格内容），单元格那个不带。其余插件（html / strikethrough / tasklist / linkify / softbreak）两边保持一致，否则单元格里的行内样式会和正文不一致。

## 3.2 ⚠️ 自绘表格要自己画边框

`TableTheme` 的 `tableBorderColor` / `tableBorderWidth` **只作用于 Markwon 的 span 表格**。一旦改成自绘的 `TableLayout`，这套主题就完全绕开了，边框得自己画（每格一个带 stroke 的 `GradientDrawable` 最省事，相邻格两条 1px 线视觉上就是一条稍重的线）。

## 4. Markwon `HtmlPlugin` 默认注册的 Handler 比想象中多

反编译 `html:4.6.2` 确认默认已含 `SuperScriptHandler` / `SubScriptHandler` / `StrikeHandler` / `UnderlineHandler` / `LinkHandler` / `EmphasisHandler` / `StrongEmphasisHandler` / `BlockquoteHandler` / `HeadingHandler` / `ImageHandler` / `ListHandler`。

**只有 `<span style="color:x">` 需要自己写**（项目里的 `SpanTagHandler`，325 行含 CSS 命名色表）。上下标不用补。

## 5. 软换行三端一致要显式配

CommonMark 原义把单换行当空格。聊天场景必须按换行显示：

- PC：`new MarkdownIt({ breaks: true })`
- 安卓：`SoftBreakAddsNewLinePlugin.create()`（这个插件存在本身就证明默认不是换行）

**这条会改变所有存量消息的排版**，上线前必须拿真实样本对比。

## 6. 折叠：裁剪线必须落在块边界

两端原来都是按像素硬切（PC `max-height: 400px`，安卓 `setMaxHeight(dp2px(480))`），切到表格第 3 行中间就是切一半。

**⚠️ 「第一块超限高则整块显示不切」这条规则只对「不可分割的块」成立**，照搬到粒度更粗的段上会出大问题：

- PC 的 block 是 `<p>` / `<ul>` / `<table>` **单个元素**，粒度细，规则成立。抽成纯函数 `pickFoldHeight(blocks, limit)`（`src/lib/markdownFoldModel.js`），DOM 量测留组件里，逻辑可单测（5 条用例），对应分支 `picked === 0`
- 安卓的段是**连续多个块合并成的一个 TextView**，AI 长回复的典型结构就是「一大段正文 + 表格」，第一段动辄几千 px。照搬会让第一段**免疫折叠**——真机上表现为「收起了一部分内容，但卡片还是极高，滚很久才到消息顶部」

**正确判据：按段是否可切分类处理。**

| 段类型 | 放不下时 |
|--------|---------|
| 富文本段（TextView）——**可切** | `setMaxHeight(剩余高度)` 截断 |
| 表格段 / 图片段——**不可切** | 整段隐藏；仅当它是第一段且超限时才整块显示 |

展开时记得把 `maxHeight` 复原成 `MAX_VALUE`。

段栈天然是块级列表，所以安卓做完段栈，折叠这条是**附带解决**的，不是额外工作。

阈值三端不统一（PC 400px / 安卓 480dp / iOS 另有一套），有意为之：字号行距屏宽都不同，对齐数值反而不对齐观感。

## 7. ⚠️ 段栈子 View 必须禁获焦，且顺序不能反

**真机自测踩到的最严重一个坑：消息列表无法往上滚，一直被拽回底部。**

两个来源叠加：

1. `TextView.setMovementMethod()` 内部会执行 `fixFocusableAndClickableSettings()`，把 `focusable` / `clickable` / `longClickable` **一并强制设回 true**。在它之前设的 false 全部作废。
2. `HorizontalScrollView` 的构造函数自带 `setFocusable(true)`。

于是段栈里每个子 View 都可获焦。**RecyclerView 在布局时会 `requestChildFocus` 把获焦子 View 滚进可视区**——往上滚，上面的 item 一绑定就抢焦点，列表被拽回去。

同一根因的第二个后果：`longClickable` 被打回 true → 正文吞掉气泡长按 → 转发/回复菜单弹不出来（iOS 上一轮栽的也是这条，那边是 `UITextView` 默认可选中）。

**做法**：

- 段栈容器 `setDescendantFocusability(FOCUS_BLOCK_DESCENDANTS)` —— 一刀切断所有子 View 获焦，最省事也最可靠
- 横滚容器额外 `setFocusable(false)` + `setScrollContainer(false)`
- TextView 的 `setFocusable(false)` / `setClickable(false)` / `setLongClickable(false)` **必须写在 `setMovementMethod()` 之后**

**链接点击不受影响**：`LinkMovementMethod` 在 `TextView.onTouchEvent` 里先于 clickable 判定处理事件——按在链接上会消费事件（链接可点），按在空白处返回 false（事件冒泡给气泡，长按正常）。这正是想要的行为。

> 通用教训：**往列表 item 里放任何滚动容器或带 MovementMethod 的 TextView 之前，先想清楚焦点归属。**

## 8. 段栈要能接住业务后处理

安卓 AI 卡片那条链路是 7 步流水线：preprocess（自定义标签换占位符）→ parse → render → `SpannableStringBuilder` → 角标可点击 Span → 图片可点击 Span → 知识来源列表。

改段栈后不能把这套丢掉。做法：段栈暴露一个后处理钩子，自己不掺和业务。

```
interface SegmentPostProcessor { CharSequence process(Spanned rendered); }
```

每个富文本段各自过一遍角标/图片 Span 替换。`orderAndDocIdMap` 是全局的，按段替换不受影响（它匹配的是 `[数字]` 文本模式）。

知识来源列表不是 markdown，走单独的 `appendExtraText()` 挂在最后一段之后——**不能塞进 post processor**，否则最后一段是表格时它就没地方去。

## 9. 分流规则：无表格不走段栈

绝大多数消息没有表格。`hasTable(segments) == false` 时保持原来的单 `TextView` 路径，段栈改造的回归面因此只覆盖含表格消息。

配套：**View 复用必须重置**。`ActionCardMessageItemProvider` 复用 holder，上条消息走过段栈、这条没表格时，若不显式把段栈设成 `GONE` 就会留一块空白。两处「正文可见」分支旁边都要补。

## 10. 表格配色一律半透明黑

自己发的消息是淡蓝气泡，写死浅灰白的表头/边框叠上去很突兀。两端统一：

- 表头底色 `rgba(0,0,0,0.04)` / `0x0A000000`
- 边框 `rgba(0,0,0,0.12)` / `0x1F000000`

安卓通过 `TableTheme.buildWithDefaults(context).tableHeaderRowBackgroundColor(...).tableBorderColor(...)` 配；PC 直接改 scss。

**遮罩不用改**：PC 用 `-webkit-mask-image` 透明淡出天然跟随底色，安卓那 4 张「查看更多」九图本来就按 `isSend` × 组织/外链分好了。iOS 那个白遮罩 bug 两端都没有。

## 11. AI 卡片判定：安卓本来就是对的

行为 spec 第 8 节说「不能只靠发送人 ID 前缀判断」，这是 iOS 的坑。实际：

- **安卓不存在此问题**——判据本来就是 `agentKnowledgeList` 非空
- **PC 存在**——`markdownUtils.js` 的会话列表摘要用 `senderUserId.indexOf("ga_") === 0`，已抽成 `isAgentCardMessage(message)`：前缀命中 **或** `agentKnowledgeList` 非空

## 12. 兜底三件套

两端一致：

1. 解析异常 → 静默回退纯文本（PC 返回**转义后**的原文，不是空串），只打日志
2. 正文 > 20000 字符 → 直接走纯文本
3. 留一个开关常量（PC `USE_MARKDOWN`，安卓 `ZXMarkwonFactory.USE_MARKDOWN`），线上出问题不发版可回退

安卓 AI 分支外层本来就有 `try/catch` 回退纯文本，`renderSafely` 是给另外两条渲染路径补的。

## 12.1 样式一致的前提：不吃框架默认值

「语法都支持了但三端观感不一样」的根因**不是漏配某一项，是三端各自吃了各自框架的默认值**：

| 端 | 默认值来源 | 典型坑 |
|----|-----------|--------|
| PC | UnoCSS `presetTypography` 的 `prose` 类 | 行内代码自动加反引号（`code::before/after`）、表格斑马纹、引用斜体、行高 1.75。**升版还会再飘** |
| 安卓 | `MarkwonTheme` 默认 | 标题倍率 `{2, 1.5, 1.17, 1, .83, .67}`（H1 是正文两倍、H6 只有 0.67 倍）、H1/H2 底下自带横线、代码与引用配色取正文色 25% alpha、链接色吃系统 `textColorLink` |
| iOS | 自绘，无框架默认 | 反倒最可控——`ZXMarkdownStyle` 一个集中式样式表，改常量即可 |

**做法**：一张 token 表（`context/design/markdown-style-tokens.md`）+ 每端一个显式的样式入口。**对齐倍率与颜色，不对齐绝对数值**——三端正文基准字号本来就是 13px / 15sp / 16pt，硬对齐数值反而不对齐观感。

三条踩到的实现细节：

- **`MarkwonTheme` 管不到引用文字颜色**，它只管竖条颜色。要压文字色得 `configureSpansFactory` 里 `appendFactory(BlockQuote.class, …)` 追加一个 `ForegroundColorSpan`
- **Markwon 的引用缩进与列表缩进共用 `blockMargin`**，拆不开。取列表要的值，引用就会偏深，只能接受
- **自绘表格的边框不能每格画四边**（相邻格叠成 2px，比外框粗一倍）。正确做法：每格只画右 + 下线，容器补左 + 上线。也**不能**用「底层铺边框色 + 上层内缩填充」的 LayerDrawable 取巧——单元格底色是透明的（要透出气泡底色），底层会整格露出来

## 12.2 段栈里 new 出来的 View 不继承 XML 的文本属性

安卓段栈的 TextView 是 `new` 的，布局文件 `tv_content` 上的 `lineSpacingExtra` 一点都带不过来。表现是**同一会话里含表格的消息行距比纯文本消息窄**——两条渲染路径的文本属性必须逐项对齐（字号、字色是通过参数传的，行距当时漏了）。

顺带：给段加了 `topMargin` 之后，折叠的高度累加必须改成「measuredHeight + topMargin」，否则折叠态实际高度会超过限高。

## 13. 工程坑

- **本机 `grep` / `find` 被 shell 函数包装过**，某些会话里会报 `Unexpected argument '-G'` / `'-S'`。用 `command grep` / `command find` 绕开。
- 安卓构建走 flavor：`./gradlew :IM:assembleDevelopDebug`（最快）或 `assembleDevelopDebug` 整包，**没有** `assembleDebug` 这个任务。
- `./gradlew :模块:dependencies --configuration developDebugCompileClasspath` 只下载 POM，AAR 要等真正编译时才拉。想反编译新加的库看 API，得先跑一次编译。

## 联调坑（实际接口 ≠ 文档之处）

无。本功能不涉及接口变更。

## 与 bridge 的交互

无。

# Impl Notes：PC + 安卓 GFM Markdown 渲染对齐

> 平台无关的实现提炼。最后更新：2026-08-25
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

**`<span>` / `<mark>` 的 style 需要自己写**（项目里的 `SpanTagHandler`）。Markwon 默认 Handler 没有这两类。必须解析：

- `color`（正则前面不能是字母或 `-`，否则会把 `background-color` 当成字色）
- `background-color` / `background` 简写 → 背景色
- `font-weight: bold` / `font-style: italic` / `text-decoration: line-through`
- `<mark>` 无背景时用 HTML 默认黄底

只上前景色、或把 `background-color` 误解析成字色，表现就是「安卓没有背景色」。`padding` / `border-radius` 用 Span 画不了，圆角胶囊只能做成矩形色块。上下标不用补。

有底色之后还有第二刀：聊天正文额外行距加在字下面，系统行背景按整行盒子填色，色块就会偏下。背景必须贴字形的上升部~下降部，并且用可折行的行背景，不能用替换整段的 ReplacementSpan（高亮一折行就会断）。不要用平移基线去「抬字」——旁边没高亮的字不会一起动。

第三刀在引用和列表里：块级缩进把字往右推，自绘行背景拿到的左边缘仍是行的最左边。用「从行首量文字宽度」当 x、却不加这段缩进，黄底会往左偏大约一个汉字（盖到前面的顿号上）。列表同样。波浪下划线如果也是自绘行背景，同一处漏。

引用的默认字色如果是「整段再挂一层前景色」，挂的时机在子节点之后，会盖掉引用里的行内颜色（加粗/删除线不受影响，因为不是同一层字色）。整段字色必须让行内颜色能盖回来。

## 5. 软换行三端一致要显式配

CommonMark 原义把单换行当空格。聊天场景必须按换行显示：

- PC：`new MarkdownIt({ breaks: true })`
- 安卓：`SoftBreakAddsNewLinePlugin.create()`（这个插件存在本身就证明默认不是换行）

**这条会改变所有存量消息的排版**，上线前必须拿真实样本对比。

## 6. 折叠：裁剪线必须落在块边界

两端原来都是按像素硬切（PC `max-height: 400px`，安卓 `setMaxHeight(dp2px(480))`），切到表格第 3 行中间就是切一半。

**⚠️ 「第一块超限高则整块显示不切」这条规则只对「不可分割的块」成立**，段落/标题/列表不能套：

- PC 的 block 虽是 `<p>` / `<ul>` / `<table>` **单个元素**，但按块取舍会让不同结构的卡片折叠高度不一致：短标题+长列表几乎空白，带表的又停在表底或把整表撑开。2026-08-19 改为**超限一律裁到限高**（PC 400px），各卡片折叠态同高；表格可能被切到，点「查看更多」看全文
- 安卓的段是**连续多个块合并成的一个 TextView**，AI 长回复的典型结构就是「一大段正文 + 表格」，第一段动辄几千 px。照搬会让第一段**免疫折叠**——真机上表现为「收起了一部分内容，但卡片还是极高，滚很久才到消息顶部」

**正确判据：按段是否可切分类处理。**

| 段类型 | 放不下时 |
|--------|---------|
| 富文本（段落 / 标题 / 列表）与表格 / 图片 | PC 折叠超限一律裁到限高，高度一致；安卓段栈仍按可切/不可切取舍 |

展开时记得把 `maxHeight` 复原成 `MAX_VALUE`。

**入口必须两处一起改。** 会话里折叠有两条路：气泡底部按钮，以及列表右侧悬浮的「收起内容」。后者走独立方法，只改气泡内那条会漏。含表格的正文不在原来的文本控件上，只压文本高度等于没压。

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

## 7.1 ⚠️ 段栈的**每个**子 View 都吞按下事件，长按只能由段栈统一代判（2026-08-27 两轮真机打回）

上面第 115 行「`longClickable` 被打回 true 才吞长按」这条是**错的**，`clickable` / `longClickable` 在这里根本不是决定因素。真机两轮打回：先是长按表格区弹不出转发/回复菜单，修完表格后，长按**其余 markdown 正文**照样弹不出来。

**根因（两个源头，效果同一个：按下事件到不了气泡根）**

1. **文字段**：装了 MovementMethod 的文本控件，其 `onTouchEvent` 只要 movement 返回 handled 就 `return true`；而链接 movement 没命中链接时会落到基类的滚动处理，那里 **ACTION_DOWN 无条件返回 handled**。所以按在正文空白处照样被吞。
2. **表格段**：横滚容器自成一套触摸处理，**从不回调基类 `onTouchEvent`**——不看 `clickable` / `longClickable`（设 false 无效），基类那套「按下计时、超时判长按」也没机会跑，只要它有子 View 按下事件一律判为已消费。

两条合起来：段栈整片区域都是长按死区，气泡根的长按监听只在段栈**之外**（标题、留白）才收得到手势。

**做法：判定上收到段栈容器一处，子段一律不各判各的**（各判各的会一次长按弹两次菜单）。

- 段栈**旁观**触摸序列（不改变分发结果），只在「这一 ACTION_DOWN 被子 View 消费了」时才代为计时。没被消费说明事件本来就会冒泡到气泡根，那边自己会判，段栈不能重复判；
- 计时用系统长按时长；移动超滑动阈值 / 抬起 / 收到 cancel 一律撤销——横滚表格、纵滚消息列表都不误弹；
- 超时后沿 parent 链逐级 `performLongClick`，第一个消费的祖先（气泡根）弹菜单；
- 弹出后**补发一个 cancel 给子 View**把这半截手势收走，否则抬手时链接 movement 会把这次长按当成一次链接点击；
- 覆写容器的 `cancelLongPress` 并在 detach 时清理，父级拦截手势时同步撤销。

**上抛的写法有坑**：`ActionCardMessageItemProvider` 里那段 while 每轮都取**同一个** `v.getParent()`，没有祖先消费时是死循环。正确写法是每轮把游标换成刚试过的那个祖先的 parent。

**仍是死区**（本轮未动，按需再说）：卡片底部按钮列表（自身是可滚列表）、引用块内部（它有自己的一套点击/长按监听）。

> 通用教训（三端同理）：**列表 item 里凡是自带手势处理的子控件——滚动容器、装了 movement/手势识别器的文本控件——都会截断父级手势**。要冒泡的交互（长按菜单）不能指望标志位，得由承载容器显式代判并转交。iOS 侧对应的是 `UIScrollView` / `UITextView` 的手势识别器。

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

自己发的消息是淡蓝气泡，写死浅灰白的表头/边框叠上去很突兀。两端统一（2026-08-25 再加一档，淡蓝上旧值几乎看不见）：

- 表头底色 `rgba(0,0,0,0.08)` / `0x14000000`（原先 4%）
- 边框 `rgba(0,0,0,0.22)` / `0x38000000`（原先 12%）
- 代码块 `rgba(0,0,0,0.10)`；行内代码 `0.08`；引用竖条 `0.28`

安卓通过 `TableTheme` + 自绘表格边框配；PC 改 `markdown.scss`。PC 上「看起来不支持行内代码」是同一根因：解析器一直产出 `<code>`，6% 黑底叠在 `#d7e5ff` 上看不见。

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

## 12.1.1 自测打回来的四条（都是「看起来配好了其实没生效」）

| 症状 | 根因 | 修法 |
|------|------|------|
| **PC** 待办勾选框是灰的，不是 primary | 任务列表用的是 `<input type="checkbox" disabled>`，浏览器对 disabled 控件**整个画成灰色**，`accent-color` 在 disabled 态不生效 | `appearance: none` 自绘：未勾选空心方框、已勾选 primary 实心 + 白勾。勾用 **SVG 背景图**而不是 `::after`——原生 input 上的伪元素在部分 Chromium 版本不渲染 |
| **PC** 窄表格被挤成一列一个字 | 上一轮为了防「长文本把表格撑到无限宽」，把 `nowrap` 换成 `max-width: 12em` + 允许换行。方向错了：气泡本来就窄，一换行就挤 | 恢复 `white-space: nowrap`、去掉列宽上限，宽出去的部分交给 `.md-table-wrap` 横滚。安卓 / iOS 的列宽上限同步提到 24em（比屏宽还大，等效不换行） |
| **iOS** 引用只有第一行左侧有竖线 | 竖条是靠 `▎` 字符逐行加前缀，按 `lineRangeForRange` 切的是**逻辑行**（`\n` 分隔）。一个段落软换行成多行，只有第一行有行首 | 引用改成**独立块 + 真视图画竖条**（见下条） |
| **iOS** 待办勾选态比未勾选态大一圈 | `☑`(U+2611) 与 `☐`(U+2610) 在系统字体里字面大小不同 | 未勾选字号 × 1.15 拉平。同理 `•`/`◦`/`▪` 也差得多，按 1.2 / 1.4 / 0.85 拉平 |

**「字符画装饰」这条路的通用教训**：attributed string 里用字符模拟竖条 / 边框，只能落在逻辑行首，**遇到软换行必露馅**。需要覆盖整段的装饰（引用竖条、代码块边框），要么用真视图，要么自定义 `NSLayoutManager` 的 `drawBackgroundForGlyphRange:`。

## 12.1.2 iOS 引用块：升格为独立块类型

做法与表格同构 —— `ZXMarkdownBlockTypeQuote`，段栈里渲染成「左侧通高竖条 + 内缩 textView」的容器。连带影响三处：

- 段栈的进入判据从「含表格」扩成「含表格**或引用**」（`hasTableBlockInBlocks` → `needsBlockStackInBlocks`）。**回归面因此从「含表格消息」扩到「含引用消息」**
- 折叠时引用与表格同属**不可切**块，整块取舍
- `flattenedRichTextFromBlocks`（非段栈路径的兜底）要把引用块也拼进去，否则正文会缺一段
- 嵌套在列表项里的引用仍走字符竖条兜底（那条路径没有独立视图可用），属已知降级

## 12.2 段栈里 new 出来的 View 不继承 XML 的文本属性

安卓段栈的 TextView 是 `new` 的，布局文件 `tv_content` 上的 `lineSpacingExtra` 一点都带不过来。表现是**同一会话里含表格的消息行距比纯文本消息窄**——两条渲染路径的文本属性必须逐项对齐（字号、字色是通过参数传的，行距当时漏了）。

顺带：给段加了 `topMargin` 之后，折叠的高度累加必须改成「measuredHeight + topMargin」，否则折叠态实际高度会超过限高。

## 12.3 ⚠️ `<reference>` 必须在进解析器之前折掉前后换行

后端常把知识来源标签单独放一行（节末、表后、列表后空一行再写 `<reference data-ref="…"></reference>`）。解析器会把它当成独立块，角标就另起一段；开了「单换行当 `<br>`」之后，两个连续角标还会被拆到两行。

产品要求角标是**行内**的，贴着前面的字。安卓 / iOS / PC 都要在进解析器之前做同一件事：

1. 标签前的换行折掉，贴到前一个非空白字符
2. 连续多个标签之间的换行也折掉，几个 `[n]` 连在一起
3. **表格后的标签不能跟在行尾 `|` 后面**——GFM 把 `|` 之后当行尾垃圾丢掉，角标会消失。要先塞进最后一个单元格（吃掉那根行尾 `|`）

插图标签不要折。本来就贴在句子里的标签不要动。

## 12.4 ⚠️ 「回复 @某人：」前缀不能和正文拼进同一段落

智能体回复常带引用前缀。若把「回复 @xxx：」写进 markdown 源、只插一个换行，再拼上一张以 `|` 开头的表：

```
回复 @张三：
| 序号 | 名称 |
|---|---|
| 1 | 晨光计划 |
```

GFM 规定**表格不能打断段落**。前缀所在行是段落，后面的表行被吃进同一段，渲染结果就是管道符原文，看起来像「没有表格样式」。用例页 T9「表格紧跟段落无空行」描述的就是这条规则。

PC 没踩坑：前缀是 markdown 容器外面的独立节点，送进解析器的只有正文。

正确做法二选一：

1. 前缀放在 markdown 外面（与 PC 同构）
2. 前缀与正文之间空一行（`\n\n`），让表格独立成块

安卓选了 2，卡片气泡 / 引用悬浮 / 流式座位三处必须走同一拼接函数，只改一处会漏。

iOS 走第三条路：先剥掉前缀再解析正文，再把前缀并进第一个富文本块。正文以表格开头时并不进去，前缀单独成块——这时段栈不能再把表格往上收（那是给 markdown 段末空白用的），否则会叠到「回复 @xx：」上。

## 13. 工程坑

- **本机 `grep` / `find` 被 shell 函数包装过**，某些会话里会报 `Unexpected argument '-G'` / `'-S'`。用 `command grep` / `command find` 绕开。
- 安卓构建走 flavor：`./gradlew :IM:assembleDevelopDebug`（最快）或 `assembleDevelopDebug` 整包，**没有** `assembleDebug` 这个任务。
- `./gradlew :模块:dependencies --configuration developDebugCompileClasspath` 只下载 POM，AAR 要等真正编译时才拉。想反编译新加的库看 API，得先跑一次编译。

## 联调坑（实际接口 ≠ 文档之处）

- 2026-08-25：HTML `color:green` 在浏览器里是 CSS 命名色 `#008000`。原生端若直接套系统基础绿（`#00FF00`），会比 PC 亮一截。命名色表必须跟 CSS 走；亮绿对应的名字是 `lime`。

## 与 bridge 的交互

无。

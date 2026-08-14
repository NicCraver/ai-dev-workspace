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

判据两端一致：**累加块高度，第一个放不下的块整体不显示；若第一块就超限高则整块显示不切**。

- PC 抽成纯函数 `pickFoldHeight(blocks, limit)`（`src/lib/markdownFoldModel.js`），DOM 量测留在组件里，逻辑可单测（5 条用例）。对应分支是 `picked === 0`。
- 安卓在 `ZXMarkdownContentView.applyFold()` 里，对应判据是 `i > 0`。

段栈天然是块级列表，所以安卓做完段栈，折叠这条是**附带解决**的，不是额外工作。

阈值三端不统一（PC 400px / 安卓 480dp / iOS 另有一套），有意为之：字号行距屏宽都不同，对齐数值反而不对齐观感。

## 7. 段栈子 View 必须关掉文本选中

`TextView` 一旦装上文本选择手势就会抢走气泡长按（转发/回复菜单）。段栈里每个子 View 一律：

```
setTextIsSelectable(false)
setLongClickable(false)
```

iOS 上一轮就是栽在同一条（`UITextView` 默认可选中）。表格单元格同理，横滚容器本身也要 `setLongClickable(false)`。

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

## 13. 工程坑

- **本机 `grep` / `find` 被 shell 函数包装过**，某些会话里会报 `Unexpected argument '-G'` / `'-S'`。用 `command grep` / `command find` 绕开。
- 安卓构建走 flavor：`./gradlew :IM:assembleDevelopDebug`（最快）或 `assembleDevelopDebug` 整包，**没有** `assembleDebug` 这个任务。
- `./gradlew :模块:dependencies --configuration developDebugCompileClasspath` 只下载 POM，AAR 要等真正编译时才拉。想反编译新加的库看 API，得先跑一次编译。

## 联调坑（实际接口 ≠ 文档之处）

无。本功能不涉及接口变更。

## 与 bridge 的交互

无。

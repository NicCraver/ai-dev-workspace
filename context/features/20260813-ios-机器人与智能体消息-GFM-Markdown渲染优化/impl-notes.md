# Impl Notes：ios-机器人与智能体消息-GFM-Markdown渲染优化

> 平台无关的实现笔记，是其他端移植的唯一逻辑依据。
> 本功能只动 iOS（web/android 已用真 GFM 解析器），但「块切分 + 表格独立视图」这套思路对其他端同样成立。

## 接入点链路（Task 1 排查结论，2026-08-13）

四个展示位实际只有 **两个 cell 实现**，另外两个展示位复用它们：

| 接入点 | 入口 | 承载 cell | 正文控件 | 渲染调用 | 是否需单独改造 |
|--------|------|-----------|----------|----------|----------------|
| 会话页 · 机器人消息 | `ZXRCIMBaseChatController` | `ZXGroupRobotCell` | `contentLab`（`UITextView`） | `ZXMarkdownManager renderMarkdownBy:param:`（`ZXGroupRobotCell.m:810`） | **是** |
| 会话页 · 智能体消息 | `ZXRCIMBaseChatController` | `ZXIMAgentStreamReplyCell` | `contentLab`（`UITextView`） | `ZXIMCellLogic agentReplyRenderedContent:…` → `renderMarkdownBy:param:`（`ZXIMCellLogic.m:1708`） | **是** |
| 回复聚合弹窗 | `ZXPolymerPopView` | 自己写了 `cellForRowAtIndexPath`，但**直接复用** `ZXIMAgentStreamReplyCell`（`:541`）与 `ZXGroupRobotCell`（`:834/839`） | 同上 | 同上 | **否**，改完两个 cell 自动生效，只需验证 |
| 合并转发详情页 | `ZXRCIMCommbineChatController : ZXRCIMBaseChatController`（`ZXRCIMCommbineChatController.h:13`），由 `configCombineMessageWithOrginData:` push（`ZXRCIMBaseChatController+Events.m:2847`） | 继承父类的 cell 分发，同一套 cell | 同上 | 同上 | **否**，同上 |

**结论**：真正要改的只有 `ZXGroupRobotCell` 与 `ZXIMAgentStreamReplyCell` 两个 cell（plan 的 Task 10 / 11）。Task 12、13 从「改造」降级为「验证」。

## 现有 Markdown 渲染的结构性缺陷（换解析器的原因）

老实现是**一串正则按固定顺序在富文本上就地替换**，没有块级/行内的语法层次概念。跨端通用教训：

- 正则实现无法表达嵌套。列表只能匹配单层行首标记，多级缩进必然塌成一层。
- 正则实现无法表达"作用域"。表格解析一旦按行扫描并 `break`，全文只会渲染第一个表格。
- 就地替换会丢样式。表格用纯字符串重建单元格，行内粗体/链接/代码全部失效。
- 分隔符规则（`**`/`_` 左右侧是否算 flanking）是 GFM 规范里最细的一块，正则近似必然出错，中文粘连场景尤其明显。

**任何端遇到同类问题，答案都是换成真解析器，而不是继续补正则。**

## 渲染架构要点（平台无关）

1. **解析与渲染分离**：解析器只回答"结构是什么"，输出 AST；渲染层决定每种结构画成什么。
2. **块切分**：AST 顶层节点按类型分成两类——「可以塞进同一段富文本的」和「必须独立成视图的」（当前只有表格）。连续的前者合并成一个富文本块，减少视图数量。
3. **表格独立视图**：移动端窄屏放不下多列表格，表格必须能横向滚动，这在纯富文本流里做不到，只能独立视图。列宽取该列所有单元格自然宽的最大值，并设上限（超出则单元格内换行）。
4. **高度 = 各块高度之和**，表格块高度与可见宽度无关（横滚不改变高度）。
5. **收起态裁剪**：裁剪线落在表格块内时，整块要么全显示要么全不显示，不能半截切——与图片附件同一规则。

## 流式（打字机）渲染的关键约定

- 流式过程中正文是**语法不完整**的：表格可能只吐了表头、代码围栏可能没闭合。
- 规则（实现时从「只降级末尾表格」简化而来）：**流式期间所有表格一律按等宽纯文本显示**；流结束后重新解析（非流式）才成表。
  - 简化理由：流式路径的正文承载控件是单个富文本控件，中途出现表格视图会让「流式渲染」与「最终渲染」两条路径的高度体系分叉；统一降级后流式路径永远只有富文本，高度只在流结束时跳一次。
- 缓存注意：布局快照按内容做缓存时，**streaming 标志必须进缓存 key**，否则流结束后会命中流式期间那份「表格是纯文本」的快照，表格永远不成表。
- 反例：每个 token 都重建表格视图会掉帧，且高度反复抖动。

## 兜底策略（三层）

1. 消息不含表格 → 退化成改造前的单一富文本控件路径，绝大多数消息零回归风险
2. 解析异常 或 正文超长（阈值 20000 字符）→ 回退老实现
3. 全局开关（iOS 为 `ZXMarkdownUseCMark`）→ 线上出问题一行关掉

## 内联 HTML 为什么必须自己实现（跨端通用结论）

后端正文会混用 Markdown 与 HTML，典型：`**<span style="color:blue;">值班总负责人：赵富文</span>**`。

- 这是**合法 GFM**：CommonMark 允许正文内嵌 raw HTML，行内 HTML 只匹配「标签本身」，标签之间的文字照常按 Markdown 解析。
- 但规范对 HTML 的规定仅是**原样透传到 HTML 输出**，不解析属性、不配对开闭标签、不管嵌套。所以任何 Markdown 解析器（cmark-gfm 也一样）给到的都只是一坨字面量字符串。
- web / PC 渲染目标就是 HTML，透传给浏览器就自动上色，零成本；**原生端没有浏览器接盘，必须自己写一个 mini HTML 渲染器**。
- 后端用 HTML 上色不是乱来 —— Markdown 本身没有颜色语法，内嵌 HTML 是唯一出路。
- 补充事实：GitHub 站点自己的 sanitizer 会剥掉 `style` 属性（这层不在 GFM 规范里），所以同样内容在 GitHub 上并不会变蓝；web 端能变蓝是因为没接 sanitizer。

**结论：换任何 Markdown 库都省不掉内联 HTML 这套自实现代码。** 想更稳（嵌套同名标签、属性里含 `>`），方向是用 HTML 解析器（如系统自带 libxml2）替换正则，而不是换 Markdown 库。

## 与自定义标签共存

正文里混有非 Markdown 的自定义标签（引用角标 `reference`、插图 `illustration`）。解析器不认识它们。

**做法**：进解析器**之前**把这些标签替换成一个不带任何 Markdown 语义的私有区占位字符 + 序号；解析渲染完成后，再按序号把占位符替换成真正的角标/图片附件。占位符必须避开 `_`、`*`、`[` 等 Markdown 标点，否则会被解析器当成语法。

## 边界情况

| 场景 | 预期行为 |
|------|----------|
| 正文为空 | 不出任何块，气泡按最小高度 |
| 表格表头列数与数据行不一致 | 按 GFM：以表头列数为准，多余单元格丢弃，缺失补空 |
| 表格单元格为空 | 保留空格占位，列不错位（老实现会丢弃空格导致整行错列） |
| 未闭合代码围栏 | 解析到文末结束，不吃掉后续结构 |
| 超长表格（列很多） | 横向可拖动；纵向手势仍归会话列表（方向锁） |
| 内联 HTML（`<span>` / `<mark>` + style） | 解析器原样吐出 raw HTML 节点，由既有 HTML 后处理二次加工。必须同时认 **字色与背景色**，且 `color:` 不能误匹配 `background-color`。`<mark>` 是合法 HTML 短语标签，不能当未知标签原样露出；无背景时用黄底。`padding` / `border-radius` 原生富文本做不到，矩形底色即可。行内背景必须按**字形行高**画：额外行距加在字下面，按整行盒子填色就会偏下。web 虽然渲染目标是 HTML，但展示走编辑器 schema，**不会**像浏览器那样原样保留 span 上的 style；背景 / 内边距 / 圆角要作为 schema 属性显式收下，否则只剩字色或变成普通文字 |
| 正文 `<reference data-ref="toutiao_article">`（联网搜索）且未出现在 `agentKnowledgeList` | **不是知识来源**：不展示底部列表、不渲染角标，标签直接剥掉。定时发布的群 AI 框新闻就是这种——消息体会带上智能体知识库整表，但正文引用的是搜索来源类型名 |
| 顶层引用块末尾的 `<reference>` | 必须渲染成高亮角标（如 `[1]`）。引用是独立块，后处理不能只走富文本/表格；漏处理时占位符会原样显示成方框 + `R0` |
| 回复前缀 + 正文只有表格 | 「回复 @xx：」无法并进表格块，会单独成段。段栈不能把后表往上收进前缀（那 10pt 上收只适合吃掉 markdown 段末空白）。PC 前缀在 markdown 外、安卓前缀与表之间空一行，都不踩这个布局坑 |

## 错误处理策略

解析失败不向用户暴露任何提示，静默回退老实现渲染，仅打日志。Markdown 渲染属于展示层，不应因解析问题让消息不可读。

## 工程坑（iOS 本地环境，2026-08-13 实测）

1. **`pod install` 会拆掉 `zhixinAppTest` / `zhixinAppProd` 的 Pods 配置**。Podfile 里只声明了 `target 'zhixinApp'`，另两个 target 的 `baseConfigurationReference` 是人工指到 `Pods-zhixinApp.*.xcconfig` 的；跑一次 `pod install` 就被 CocoaPods 清空，之后这两个 target 编译直接报 `'AFNetworking/AFNetworking.h' file not found`。
   - 应对：`pod install` 后把 `zhixinApp.xcodeproj/project.pbxproj` 还原（`git checkout HEAD -- zhixinApp.xcodeproj/project.pbxproj`），xcconfig 文件本身已重新生成、内容含新依赖，指回去即可。
   - 根治办法（未做，需团队决定）：把三个 target 都写进 Podfile（共享 `def` 或 `abstract_target`）。
2. **`pod` 在 Ruby 3.2 + activesupport 7.0.8 下直接崩**：`uninitialized constant ActiveSupport::LoggerThreadSafeLevel::Logger`。绕过方式：`RUBYOPT="-rlogger" pod install`。
3. **本机 CocoaPods Specs 仓只有 `.git` 没有工作树**（`~/.cocoapods/repos/cocoapods` 空目录 + 1.5G `.git`，本地分支 `main` 无提交），导致任何 pod 都找不到 spec。修复：`git -C ~/.cocoapods/repos/cocoapods checkout -B master origin/master`。
4. `Pods/` 与 `Podfile.lock` 都在 `.gitignore` 里 —— 依赖变更只提交 `Podfile`，其他人必须自己跑 `pod install`（会踩坑 1）。
5. 新文件必须写进 `project.pbxproj`（工程 `objectVersion = 48`，不支持文件夹同步组）。批量加可用 CocoaPods 自带的 `xcodeproj` gem，注意挂 `zhixinApp` / `zhixinAppProd` / `zhixinAppTest` 三个 target（`NOtificationService` / `ZXShare` 不挂，与既有 `ZXMarkdownManager.m` 一致）。
6. **M 芯片上模拟器这条路走不通，只能真机**。融云 5.3.7 的 xcframework 模拟器 slice 只有 `ios-i386_x86_64-simulator`，没有 arm64。Apple Silicon 默认 arm64 模拟器构建会在链接阶段报 `ld: library 'Pods-zhixinApp' not found`；强制 `ARCHS=x86_64` 能编过但跑不起来。**验证一律走真机 Debug（generic/platform=iOS 只能验编译，不能验运行）**。
7. cmark-gfm 头文件落在 `Pods/Headers/Public/libcmark_gfm/`，导入写 `<libcmark_gfm/cmark-gfm.h>`。为兼容源码内置等其它集成方式，统一走 `ZXMarkdownCMark.h` 的 `__has_include` 兜底，未集成时宏 `ZX_MARKDOWN_CMARK_AVAILABLE=0`，解析器返回空、调用方自动回退老正则。

## 联调坑（实际接口 ≠ 文档之处）

- 2026-08-19：定时群 AI 框会把智能体知识库整表塞进 `agentKnowledgeList`，同时正文用 `toutiao_article` 标联网搜索，还会**没有 referMsg**。两件独立的事：① 知识来源必须取「知识库 ∩ 正文真实文档引用」；② 不能从会话近期历史里找最近一次 @智能体来充当引用条 /「回复 @xx：」，否则会把无关提问显示成这条定时新闻的回复对象。
- 2026-08-20：顶层 `>` 引用被切成独立 Quote 块后，后处理仍只走富文本块和表格单元格。引用里的 `<reference>` 占位符（`U+E000` + `R0` + `U+E001`）会原样漏出，看起来像方框和 `R0`，而不是高亮 `[1]`。Quote 块必须同样走角标/插图后处理。
- 2026-08-24：智能体「回复 @xx：」在正文只有表格时会单独成块。段栈里「非首块表格上收 10pt」是为了吃掉 markdown 段落后的空白；套到这段没有段后距的前缀上，就会叠到第一行。前一块不是「带段末换行的正文」时不要上收。PC 把前缀放在 markdown 容器外，安卓用空行把前缀和表拆成两段，都不会踩这个布局坑。
- 2026-08-25：行内高亮有底色之后，色块仍会「沉」到字下面。原生富文本的背景填的是整行盒子，而聊天正文额外行距全加在字下方。背景高度要裁回字形行高（从底部削），不能靠平移基线——平移会让高亮字和旁边的字错位。创建正文控件时就要换上能裁背景的排版器；默认控件创建后再换排版器，新系统不允许。
- 2026-08-25：HTML `color:green` 在浏览器里是 CSS 命名色 `#008000`。原生端若直接套系统基础绿（`#00FF00`），会比 PC 亮一截。命名色表必须跟 CSS 走；亮绿对应的名字是 `lime`。

## 与 bridge 的交互

无。

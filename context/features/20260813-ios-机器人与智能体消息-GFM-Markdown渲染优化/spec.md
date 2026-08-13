# Spec：ios-机器人与智能体消息-GFM-Markdown渲染优化

> 由 Superpowers brainstorm 产出。最后更新：2026-08-13

## 背景与目标

iOS 端机器人消息与智能体消息的 Markdown 渲染由 `SmartMessage/ZX_Base/ZX_Manager/ZXMarkdownManager.m`（1926 行）承担，实现方式是**一串正则按固定顺序在 `NSMutableAttributedString` 上就地替换**。这种做法没有块级/行内的语法层次概念，结构稍复杂就渲染错乱。

对比其他端：web 用 `marked`（GFM），android 用 Markwon（commonmark-java + ext-tables），只有 iOS 是手写正则——这是根因，不是个别 bug。

已确认的具体缺陷（读代码可直接定位）：

| 缺陷 | 位置 | 现象 |
|------|------|------|
| 列表只认单层 `^[-*] ` / `^\d+\. ` | `ZXMarkdownManager.m:1515-1516` | 多级缩进列表全部塌成一层；`+` 号列表不识别；任务列表 `- [x]` 不渲染；有序列表序号原样透出不重排 |
| 表格只处理全文**第一个** | `ZXMarkdownManager.m:1636-1639`（找到一段就 `break`） | 第二个及以后的表格完全不渲染 |
| 表格降级成纯文本拼接 | `ZXMarkdownManager.m:1663-1669` | 表头包成 `【a \| b】`，单元格用 `" \| "` 拼接，无列对齐、无边框 |
| 表格空单元格被丢弃 | `ZXMarkdownManager.m:1656`（`trimmed.length > 0` 才入列） | 有空单元格的行整行列错位 |
| 表格丢失行内样式 | `ZXMarkdownManager.m:1682`（用纯 `NSString` 重建） | 单元格里的粗体/链接/代码全部失效 |
| 粗体不允许内部含 `*` | `ZXMarkdownManager.m:964`（`\*\*([^*]+)\*\*`） | `**含*星号*的粗体**` 不渲染 |
| 缺 `__bold__` / `_italic_` 分隔符规则 | 无对应实现 | 下划线语法不生效；中文粘连时误命中 |
| 行内码不支持多反引号 | `ZXMarkdownManager.m:1002`（`` `([^`]+)` ``） | ` ``含反引号`` ` 失效 |
| 代码块必须围栏且贪婪匹配 | `ZXMarkdownManager.m:1709` | 无缩进代码块；未闭合围栏吃掉后文 |
| 无 autolink | 无对应实现 | 裸 URL 不成链接 |
| 无段落/软换行概念 | 整体设计 | 软换行与空行分段间距不符合 GFM |

**目标**：用真正的 GFM 解析器替换正则实现，让 iOS 的机器人/智能体消息按 <https://github.github.com/gfm/> 的结构规则正确渲染，重点解决列表与表格。

**成功标准**：spec 附录的 GFM 用例集在 iOS 上逐条渲染正确；四个接入点（会话页机器人气泡、会话页智能体气泡、回复聚合弹窗、合并转发详情页）表现一致；不含表格的普通消息渲染与改造前无可感知差异（无回归）。

## 关键决策（brainstorm 已定）

| 决策点 | 结论 | 理由 |
|--------|------|------|
| 正确性基准 | **GFM 规范本身**，不追像素级对齐安卓/web | 样式（字号/间距/颜色）iOS 自定，只保证结构正确 |
| 解析器 | 引入 **`pod 'libcmark_gfm', '~> 0.29.4'`** | trunk 上唯一在维护的 cmark-gfm 绑定（`cmark-gfm` pod 停在 2018 年的 0.1.0）；GitHub 官方实现，5 个 GFM 扩展齐全 |
| 依赖落地方式 | 走 CocoaPods（用户拍板） | 代价已知：`Podfile`/`Podfile.lock` 需一起提交、所有人须 `pod install`、依赖 spec 源网络、与 `docs/local-dev-patch.md` 可能冲突 |
| 表格呈现 | **独立子视图，可横向滚动** | 手机窄屏放不下多列表格，子视图可横拖。代价：气泡内容视图从单 `UITextView` 变成段栈；单元格用 `UILabel`，本身不可选中，复制仍走整条消息长按复制 |
| 流式表格 | **未闭合先当纯文本，收完再成表** | 避免每个 token 重建子视图掉帧；高度只跳一次 |
| 覆盖范围 | 会话页两类气泡 + 回复聚合弹窗 + 合并转发详情页 | 个人 AI 会话页本期不动 |

包体影响：只编 parser + 5 个扩展（不需要 html/latex/man/xml 输出后端），预计二进制 +200~350 KB，App Store 下载增量更小。实测方式：archive 后对比 Xcode Organizer 的 App Thinning Size Report。

## 架构

解析与渲染彻底分离：cmark-gfm 只回答"这段文字的结构是什么"，出 AST；我们把 AST 压成**块序列**，再决定每块用富文本还是子视图画。

```
原文
 └ 转义归一化 (zx_normalizeAgentContentEscapes)
 └ 占位替换: reference 标签 / illustration 标签 → 私有区字符 + slot 编号
 └ 流式未闭合表格判定 → 标记该区间"暂当纯文本"
 └ cmark_parse_document (GFM 扩展: table/strikethrough/autolink/tasklist/tagfilter)
 └ AST 遍历: 表格节点 → ZXMarkdownTableModel；其余连续节点 → 累积成一个 NSAttributedString
 └ 回填 attachment（引用角标 / illustration 图片）
 └ 块序列 [富文本块, 表格块, 富文本块…]
 └ ZXMarkdownContentView 段栈 → 布局 + 出高
```

### 组件

全部新增在 `SmartMessage/ZX_Base/ZX_Manager/Markdown/`（功能内聚，见上级 CLAUDE.md）。

| 组件 | 职责 | 依赖 |
|------|------|------|
| `ZXMarkdownParser` | **唯一** `#import` cmark-gfm 的地方；C AST → 块模型；启用 5 个 GFM 扩展 | libcmark_gfm |
| `ZXMarkdownBlock` | 块模型：`ZXMarkdownBlockTypeRich`（持 `NSAttributedString`）/ `ZXMarkdownBlockTypeTable`（持 `ZXMarkdownTableModel`） | 无 |
| `ZXMarkdownTableModel` | 表格数据：列对齐方式数组、表头行、数据行（每格是 `NSAttributedString`，保留行内样式） | 无 |
| `ZXMarkdownAttributedBuilder` | 行内 AST → `NSAttributedString`；块级负责列表缩进、序号重排、段落间距 | ZXMarkdownStyle |
| `ZXMarkdownStyle` | 字号/行距/列表缩进/代码块底色/表格边框色等集中定义，调用方可覆盖 | 无 |
| `ZXMarkdownTableView` | `UIScrollView` 横滚 + 网格绘制（表头底色、单元格分隔线），单元格用 `UILabel` 承载富文本 | ZXMarkdownTableModel |
| `ZXMarkdownContentView` | 段栈容器：纵向排 `[textView, tableView, textView…]`；统一出高、收起态裁剪、点击事件转发 | 上面全部 |

**兼容策略**：`ZXMarkdownManager` 现有对外 API 一个不删（`renderMarkdownBy:param:`、`renderMarkdown:defaultAttrs:`、`handleTapInTextView:…`、`zx_adjustedClipHeightForAttributedText:…` 等），内部改走新解析。这样 `ZXAgentKnowledgeItem` 等非气泡调用方零改动。三个改造点新增段栈入口。

**保留机制**：现有 reference 角标 / illustration 图片的「先替换成无 Markdown 语义的占位 slot、渲染后回填 attachment」流程原样保留——它恰好绕开了解析器不认识自定义标签的问题。占位符继续用不含下划线、不含 Markdown 标点的私有区字符。

**内联 HTML**：cmark 把 `<span style="color:x">`、`<b>`、`<br>` 等原样吐成 raw HTML 节点，不解释语义。现有 `processHTMLTags` 那套（颜色解析、CSS 命名色表、实体解码，`ZXMarkdownManager.m:1036-1485`）**保留复用**，改为作用在 raw HTML 节点及其相邻文本上。tagfilter 扩展只过滤 `script`/`iframe`/`style` 等危险标签，不影响 `span`/`b`/`i`/`u`。

### 高度与收起态

改造前高度计算散在三处：`ZXGroupRobotCell.m:645/825` 的 `sizeThatFits`、`ZXGroupRobotCell.m:508` 的全局共享测量 textView、`ZXMarkdownManager` 的 `zx_adjustedClipHeightForAttributedText`。统一收进 `ZXMarkdownContentView`：

- `- (CGFloat)heightForWidth:` —— 各块高度求和。富文本块走 TextKit 测量；表格块高度 = 行高 × 行数（横滚不影响高度）
- `- (CGFloat)clipHeightForTargetHeight:` —— 收起态裁剪线落在表格块中间时，整块下推到块底不半截切（与现有图片附件规则一致）
- 全局共享测量实例从 `UITextView` 换成 `ZXMarkdownContentView`，流式测量路径形态不变

### 降级与兜底

1. 消息**不含表格** → 段栈只含一个 textView，约束与旧代码等价，走原路径（绝大多数消息零回归）
2. 解析异常，或正文超过 20000 字符 → 回退老 `renderMarkdown:` 正则实现
3. 全局开关 `ZXMarkdownUseCMark`（默认 `YES`）→ 出问题一行关掉回老逻辑

## 用户流程

1. 用户在群里收到机器人消息 / 智能体回复（含流式）
2. 消息正文按 GFM 渲染：多级列表正确缩进、任务列表出勾选框、表格成真表格
3. 表格列数多放不下时，用户在表格区域**横向拖动**查看剩余列；纵向滚动仍归会话列表
4. 流式输出中的表格：吐到一半时按纯文本显示，吐完自动变成表格视图（高度跳一次）
5. 长消息收起态：裁剪线不会把表格切一半
6. 同一条消息在回复聚合弹窗、合并转发详情页里渲染一致

## 范围

**本期做**
- 引入 libcmark_gfm，新建 `Markdown/` 组件组，`ZXMarkdownManager` 内部换解析器
- 块序列模型 + `ZXMarkdownContentView` 段栈 + `ZXMarkdownTableView` 横滚表格
- 四个接入点：会话页机器人气泡（`ZXGroupRobotCell`）、会话页智能体气泡（`ZXIMAgentStreamReplyCell` / `ZXIMCellLogic`）、回复聚合弹窗（`ZXPolymerPopView`）、合并转发详情页（`ZXCombineMessageLogic` 链路，实施第一步先排查其是否复用会话页 cell）
- 流式未闭合表格降级规则
- Debug-only Markdown 自测页（内置附录用例集）

**本期不做**
- 个人 AI 会话页（`ZXPersonalAIChatController`）
- 语法高亮（代码块只给等宽字体 + 底色，不按语言着色）
- 表格首列固定、单元格内换行策略优化（先按内容宽度撑开，列宽上限截断）
- 数学公式 / mermaid / 脚注等 GFM 之外的扩展
- 与安卓/web 的像素级样式对齐
- 其他三端（本功能只动 iOS）

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| Markdown 解析器 | `marked` 14.1.4 | Markwon 4.6.2（commonmark + ext-tables） | **本期改为 libcmark_gfm 0.29.4** | 复用 web |
| 表格呈现 | HTML 表格，容器可滚 | Markwon ext-tables span | **独立子视图横向滚动** | 复用 web |
| 本期是否改动 | 否 | 否 | 是 | 否 |

## 依赖的接口

无。纯客户端渲染改造，不涉及 `context/contracts/` 任何契约，无新增/变更接口。

## GFM 用例集（验收清单）

Debug 自测页内置这些用例，逐条对照期望结果验收。

### 列表
| # | 输入 | 期望 |
|---|------|------|
| L1 | 三层缩进无序列表 | 三级缩进层次分明，各级 marker 区分（•／◦／▪） |
| L2 | `+ item` | 识别为无序列表（当前不识别） |
| L3 | `3.` 起始的有序列表 | 从 3 开始连续编号 |
| L4 | `- [ ]` / `- [x]` | 渲染空/勾选任务框，不显示原始括号 |
| L5 | 有序列表内嵌无序列表 | 嵌套层级与缩进正确 |
| L6 | 列表项内含粗体/行内码/链接 | 行内样式保留 |
| L7 | 列表项内含多段（空行 + 缩进续行） | 同一项内多段落，缩进对齐 |
| L8 | 紧凑列表 vs 松散列表 | 松散列表项间距更大 |

### 表格
| # | 输入 | 期望 |
|---|------|------|
| T1 | 标准 3 列表格 | 真表格：表头底色 + 单元格边框 |
| T2 | 同一条消息含**两个**表格 | 两个都渲染（当前只渲染第一个） |
| T3 | 含空单元格的行 | 空格保留占位，列不错位 |
| T4 | 对齐符 `:---` / `:---:` / `---:` | 左/居中/右对齐生效 |
| T5 | 单元格内 `\|` 转义 | 显示为字面竖线，不拆列 |
| T6 | 单元格内粗体/链接/行内码 | 行内样式保留 |
| T7 | 8 列宽表格 | 可横向拖动查看，纵向滚动仍归会话列表 |
| T8 | 表头列数与数据行列数不一致 | 按 GFM：多余单元格丢弃，缺失补空 |
| T9 | 表格紧跟段落无空行 | 正确断块 |

### 行内与块级
| # | 输入 | 期望 |
|---|------|------|
| I1 | `**含*星号*的粗体**` | 正确加粗（当前失败） |
| I2 | `__bold__` / `_italic_` | 生效 |
| I3 | 中文粘连 `中文_不是斜体_中文` | 按 GFM 左右侧分隔符规则**不**变斜体 |
| I4 | 多反引号行内码 | 正确渲染 |
| I5 | 4 空格缩进代码块 | 渲染为代码块 |
| I6 | 未闭合 ``` 围栏 | 到文末结束，不吃掉后续结构（流式常见） |
| I7 | 裸 URL `https://…` | autolink 成可点链接 |
| I8 | 软换行（行尾单换行） | 按 GFM 视为空格/软断行，间距正确 |
| I9 | 空行分段 | 段落间距正确 |
| I10 | `> ` 引用块，含嵌套 | 左侧引用条 + 缩进，嵌套层次可见 |
| I11 | 反斜杠转义 `\*` `\_` `\|` | 显示字面字符 |
| I12 | 标题 `#`~`######` + setext 标题 | 六级字号递减；setext 亦识别 |

### 与既有能力共存
| # | 场景 | 期望 |
|---|------|------|
| C1 | 正文含 reference 角标 + Markdown | 角标编号正确，点击跳知识来源 |
| C2 | 正文含 illustration 图片 + 表格 | 图片异步加载后高度刷新正确，表格不受影响 |
| C3 | 正文含内联 HTML（`<span style="color:x">` 等，现有能力） | 颜色/加粗仍生效（GFM tagfilter 不能误杀） |
| C4 | 流式：表格边吐边显 | 未闭合当纯文本，收完变表格，高度只跳一次 |
| C5 | 长消息收起态 | 裁剪线不切半个表格 |
| C6 | 纯文本消息（无任何 Markdown） | 与改造前渲染无可感知差异 |

## 验证方式

仓库无单测、无 lint（纯 OC），质量靠编译 + 人工自测：

1. **Debug 自测页**：内置上述用例集，一屏滚动逐条对照
2. **真机/模拟器自测清单**：会话页机器人气泡 → 会话页智能体流式气泡 → 回复聚合弹窗 → 合并转发详情页，四处各跑一遍用例集里的代表用例
3. **构建验证**（人工，AI 不执行）：`zhixinAppTest` 模拟器 Debug、真机 Debug、`zhixinAppProd` archive 三档都要过；archive 后记录 App Thinning Size Report 的体积增量
4. **回归重点**：C6（纯文本消息无差异）、C1/C2（角标与图片）、收起/展开、流式高度抖动

## 待用户确认的问题

- 合并转发详情页（`ZXCombineMessageLogic` 链路）是否直接复用会话页 cell —— 未验证，plan 第一步排查；若是独立实现，工作量会增加一个接入点
- `pod install` 与三档构建由人工执行（仓库 CLAUDE.md 规定 AI 不执行 pod/xcodebuild）

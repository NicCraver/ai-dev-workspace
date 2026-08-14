# Status：ios-机器人与智能体消息-GFM-Markdown渲染优化

> 最后更新：2026-08-14 11:20（首轮自测修复已提交并 push；分支 feat/ios-gfm-markdown）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

本功能**只动 iOS**，其余三端不涉及（web 已用 marked、android 已用 Markwon，均为真 GFM 解析器）。行号对应 `plan.md` 的 Task。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec 定稿 | — | — | ✅ | — |
| plan 拆解（14 个 Task） | — | — | ✅ | — |
| T0 先落袋现有 505 行未提交改动 | — | — | ✅ | — |
| T1 摸清四个接入点真实链路 | — | — | ✅ | — |
| T2 引入 libcmark_gfm + 冒烟解析 | — | — | ✅ | — |
| T3 ZXMarkdownStyle / Block / TableModel | — | — | ✅ | — |
| T4 ZXMarkdownAttributedBuilder | — | — | ✅ | — |
| T5 ZXMarkdownParser 块序列 + 流式降级 | — | — | ✅ | — |
| T6 ZXMarkdownTableView 横滚表格 | — | — | ✅ | — |
| T7 ZXMarkdownContentView 段栈 + 高度/收起态 | — | — | ✅ | — |
| T8 Debug 摇一摇自测页（31 条用例） | — | — | ✅ | — |
| T9 ZXMarkdownManager 切换 + 三重兜底 | — | — | ✅ | — |
| T10 接入机器人气泡 | — | — | ✅ | — |
| T11 接入智能体气泡 + 流式 | — | — | ✅ | — |
| T12+13 验证聚合弹窗 / 合并转发详情页（纯验证） | — | — | 🚧 | — |
| T14 三档构建 + 全量自测 + 收尾 | — | — | 🚧 | — |

> ✅ 的判据是**代码写完 + `xcodebuild` 编译通过**（`zhixinAppTest` Debug、generic/platform=iOS、BUILD SUCCEEDED），
> **不含任何运行时验证**——渲染效果、表格横滚、流式抖动、收起展开都还没在真机/模拟器上看过一眼。
>
> 代码：`a973897d2`（渲染层）→ `dd9051b0c`（机器人气泡）→ `ee7108d63`（智能体气泡）。
> 依赖：`libcmark_gfm 0.29.4` 已装，头文件路径 `<libcmark_gfm/cmark-gfm.h>`；`nm` 确认 `ZXMarkdownParser.o` 引用了 `_cmark_parser_new` 等符号，走的是真解析分支而非 `__has_include` 降级分支。

## 各端工作区现状（2026-08-14 00:40，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 99 | 脏 9 | 本功能 spec/plan/status/impl-notes 已提交 | 其余脏区是 hooks/skills/README/`.pi/`，与本功能无关 |
| web | `feat/data-scope-secret-tag` | synced | 干净 | 不涉及 | 停在涉密标签功能 |
| android | `personal-ai-chat-hotfix` | synced | 脏 1 | 不涉及 | 仅一张相机图标资源未跟踪，历史遗留 |
| ios | **`feat/ios-gfm-markdown`** | **已 push，synced** | 干净 | **本功能全部产出** | `a67d3d364` 内联 HTML → `a973897d2` 渲染层 → `dd9051b0c` 机器人气泡 → `ee7108d63` 智能体气泡 → `482998e1a` 自测页全链路+真实用例 → `ffce3b99f` + `f4c08c11b` 两轮精简。**未 push** |
| desktop | `personal-ai-chat-hotfix` | synced | 脏 3 | 不涉及 | `.env.test`/`electron-builder.yml`/`package.json` 本地调试配置，按规矩**禁止提交** |

本次迭代代码量（`a67d3d364^..HEAD`，含 T0 内联 HTML）：**28 文件，+2228 / -191**。两轮精简共删 382 行：

| 轮次 | commit | 删掉的东西 |
|------|--------|-----------|
| 一 | `ffce3b99f` | 解析器/构建器的 `#if ZX_MARKDOWN_CMARK_AVAILABLE` 降级空实现与 `isAvailable`；`ZXMarkdownCMark.h` 三条 `__has_include` 分支收成一条；死属性 `quoteBarColor` / `firstTextView`；两个 cell 各写一遍的 hasTable / flatten 上提到 `ZXMarkdownBlock` |
| 二 | `f4c08c11b` | `ZXIMCellLogic` 里零调用方的 `agentReplyRenderedContent:` 4 个重载 + `agentReplyAttributedContent:`；零调用方的异步 `renderMarkdownBy:param:completion:`；CSS 命名色表 158 行字典字面量 → 19 行单串解析（148 个颜色一个不少） |

**有意留下的**：老正则 markdown 管线（`renderMarkdown:` + 13 个 `process*`，约 600 行）是 `ZXMarkdownUseCMark=NO` 的落点，删了就失去不发版回退的能力。

## 待办 / 阻塞

### 真机首轮自测暴露的问题（2026-08-14，已修复并提交 `f37f66326`，待复验）

| # | 症状 | 根因 | 处理 |
|---|------|------|------|
| 1 | 列表、引用块、代码块**缩进全部无效** | `agentMessageBodyTextAttributes` 返回的属性自带 `NSParagraphStyle`（lineSpacing），而 `zx_applyParagraphStyleTo` 判据写成「已有段落样式就跳过」→ 缩进一次都没设上 | 判据改成「已有缩进才跳过」。三个症状同一根因 |
| 2 | 引用块无视觉标识、嵌套看不出层级 | 只染了灰色，没有左侧竖条（`UITextView` 段落样式画不了左边框） | 每行行首加 `▎` 字符，嵌套自然叠成多根 |
| 3 | 上标下标无效果 | GFM **无此语法**，只能走 HTML `<sup>`/`<sub>` | 加进 `processHTMLTags`（缩小字号 + baselineOffset） |
| 4 | 脚注无效果 | 扩展没开 | cmark-gfm 的 `footnotes` 扩展加进注册列表 |
| 5 | 数学公式无效果 | GFM 无公式语法，GitHub 是渲染层另接 MathJax | **未做**，需单独定方案（先确认后端发的格式） |
| 6 | **含表格的消息里 illustration 图片不显示** | 含表格走段栈，正文在 `ZXMarkdownContentView` 内部 textView 上，而两个 cell 的异步图片回调只往 `contentLab` 打，那视图是空的 → early return | 段栈加 `applyLoadedImageFromNotification:` 遍历内部 textView 回填 + 重排；两个 cell 回调改成段栈优先 |
| 7 | 表格单元格内的角标/插图留下不可见字符 | 后处理只作用于富文本块，没管表格单元格 | 抽出 `zx_postProcessRichText:`，表格单元格一并过 |
| 8 | **个人 AI 卡片的角标 / 知识来源 / 折叠全失效** | `isAgentCardMessage:` 只认 `senderUserId` 带 `ga_` 前缀；个人 AI 框回复推送到本人会话时发送人是**本人 id**，判定为普通卡片 → `parseReference=NO`、知识来源传 `@[]`、折叠判据直接 NO | `isAgentCardMessage:` 增加判据：`ZXGroupRobotMessage` 且 `agentKnowledgeList` 非空也算 AI 卡片。cell 渲染分支与正文字号一并改用它。**注：这条在改造前也是坏的（老代码非 agent 分支连 markdown 都不渲染），不是本次回归** |

| 9 | 长按不弹转发/回复菜单，只有标题能长按 | 段栈里新建的 `UITextView` 漏了 `selectable = NO`（`contentLab` 一直有这句），默认 YES 时 UITextView 装上文本选择长按手势，抢走气泡长按。标题头没被段栈覆盖故不受影响 | 段栈 textView 补 `selectable = NO`；表格 scrollView 补 `delaysContentTouches = NO` |
| 10 | 自己发的消息里表格与「查看更多」遮罩发白、与淡蓝气泡不搭 | 表头/边框写死浅灰白；遮罩用的是白色渐变图 `zx_chat_mask_up`。折叠功能是第 8 条放宽判据后才对这类消息生效，白遮罩因此才暴露 | 表格改半透明黑（表头 4%、边框 12%），叠任意气泡底色都协调；遮罩改成按 `getBubbleColor:` 现算的 `CAGradientLayer` |

> 子代理审查（`cavecrew-reviewer`）跑过一轮：8 条发现里 4 条经核对为误报（parser 泄漏、表格间距重复计算、lineSpacing 被覆盖、两个正文视图可能同时可见），其余 4 条属实但不值得现在改（共享测量单例无线程保护是既有写法、tableModel 就地改属性当前无共享持有者、图片回填与动画竞争无具体触发路径、lineRangeForRange 模式脆）。**无必须修复项**。

- (ios) **下一步全是运行时自测，且只能真机**：M 芯片上模拟器走不通（融云无 arm64 模拟器 slice，链接报 `ld: library 'Pods-zhixinApp' not found`），已试过并放弃。真机跑起来 → 摇一摇打开 GFM 用例对照页 → 按 31 条用例逐条看。大概率要调的是缩进量、段间距、表格列宽/内边距这类观感参数，改 `ZXMarkdownStyle` 一个文件即可。
- (ios) 会话页实测清单：机器人气泡含表格 / 智能体流式（盯表格从纯文本变成表格视图、高度只跳一次）/ 引用角标点击 / 插图与表格共存 / 长消息收起展开 / 纯文本消息与改造前无差异。
- (ios) T12+13：聚合弹窗与合并转发详情页复用同两个 cell，代码无需改，只需实测；若宽度不对，改成按容器实际宽度推导（现在写死 `kChatMsgContentW - 32`）。
- (ios) T14：`zhixinAppProd` archive 那档还没验；archive 后记 App Thinning Size Report 的包体增量。
- (ios) **数学公式未做**（spec 里就列在「本期不做」）。原因：①GFM 规范无数学语法，GitHub 是前端另挂 MathJax，换解析器不自动带来；②真做需引 LaTeX 排版引擎（推荐 iosMath，纯 OC、MIT，渲成 `NSTextAttachment`；WKWebView+KaTeX 逐条渲染会卡；服务端转图片要后端改）；③**尚无带公式的真实样本**，不知道后端发的是 `$...$` / `$$...$$` / `\(...\)` 还是 `<math>`。推进前先要样本 + 确认出现频率。
- (ios) ⚠️ **`pod install` 会拆掉 `zhixinAppTest`/`zhixinAppProd` 的 Pods xcconfig 挂载**，之后编译报 `'AFNetworking/AFNetworking.h' file not found`。本次已通过还原 `project.pbxproj` 修好；其他人拉到这个分支跑 `pod install` 会再踩一次。根治要把三个 target 都写进 Podfile（需团队决定，本次未做）。详见 impl-notes「工程坑」。
- (ios) 本机 `pod` 需 `RUBYOPT="-rlogger"` 前缀才能跑（Ruby 3.2 + activesupport 7.0.8 的 Logger 常量问题）。
- (ios) **老正则管线退休排期**（下个迭代，不是现在）：cmark 路径线上跑稳一版后，删 `renderMarkdown:` 及其 13 个 `process*` 方法与 `ZXMarkdownUseCMark` 开关，白赚约 600 行。现在删等于放弃回滚手段。

> 已了结：T0 那 505 行内联 HTML 改动已提交（`a67d3d364`）；合并转发详情页链路已查清（复用会话页 cell，见 impl-notes）。

## 关键决策记录

- 2026-08-13 正确性基准取 **GFM 规范本身**（<https://github.github.com/gfm/>），不追像素级对齐安卓/web，样式 iOS 自定
- 2026-08-13 解析器换 **`pod 'libcmark_gfm', '~> 0.29.4'`**（trunk 上 `cmark-gfm` pod 停在 2018 年 0.1.0，不可用）；走 CocoaPods 而非源码内置，由用户拍板
- 2026-08-13 表格改 **独立子视图横向滚动**（`ZXMarkdownTableView`），气泡内容视图从单 `UITextView` 改为段栈；单元格 `UILabel` 不可选中，复制走整条消息长按
- 2026-08-13 流式表格：**未闭合先当纯文本，收完再成表**，高度只跳一次
- 2026-08-14 **数学公式暂不做**（评估后拍板）。评估结论存档，避免下次重复讨论：改动本身不大（约 2-3 天，块序列+段栈架构已就位，占位符机制可直接复用 reference/illustration 那套），但三个成本更值得权衡——①iosMath 自带数学字体，**包体 +约 1MB**，比 cmark 大一个量级；②`$` 定界符与正文里的货币符号（`$100`）歧义，需照抄 GitHub 的分界规则，最易出 bug；③iosMath 只覆盖常用 TeX 子集，`\begin{align}`/宏包/复杂矩阵仍会失败走兜底。若将来要做，建议分两步：先花半天做「识别公式区间 + 等宽原样显示源码」保证不被 `*`/`_` 搅乱排版，拿到真实样本与频率后再决定是否投入引擎。
- 2026-08-14 实现时把上一条简化为「**流式期间所有表格都按纯文本**」：流式路径只有单个富文本控件，中途插表格视图会让流式与最终两条高度体系分叉。布局快照缓存 key 必须带 streaming 标志，否则收完后命中流式那份快照、表格永远不成表
- 2026-08-13 三重兜底：无表格消息走原单 textView 路径 / 解析异常或超 20000 字符回退老正则 / 全局开关 `ZXMarkdownUseCMark`
- 2026-08-13 `ZXMarkdownManager` 对外 API 一个不删，内部换解析器，非气泡调用方零改动

# Status：iOS 群AI框卡片消息对齐安卓（标题头 + 正文 HTML 高亮）

> 最后更新：2026-08-13 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 问题

群AI框（定时任务推送）发的 `ZX:ActionCardMsg`（`senderUserId` 带 `ga_` 前缀）：

- **android**：蓝底标题条（2 行截断）+ 正文 markdown 加粗 + `<span style="color:blue|orange">` 彩色高亮
- **iOS**：标题整条不显示；正文把 `<span style="color:blue;">…</span>` 原样当文本打出来

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 智能体卡片显示标题头 | ➖ | ✅ 已有 | ✅ | ⬜ 未查 |
| 正文 `<span>` 颜色高亮 | ➖ | ✅ 已有 | ✅ | ⬜ 未查 |
| 真机自测 | ➖ | ➖ | 🚧 待人工构建验证 | ⬜ |

## 本次改动落点（ios）

- `SmartMessage/.../ZX_IMChatCell/ZXGroupRobotCell.m`
  - `showTitleHeader` 去掉 `!isAgent`（`setModel:` 与流式测高 `zx_streamingBubbleSizeForModel:` 两处），
    智能体卡片也画 `headerView`（收到 `#EBF2FF` 底 + `#2E6BE6` 粗体标题）。
  - 新增静态函数 `ZXGroupRobotTitleHeaderHeight()`：按 `kChatMsgContentW - 32` 宽度测高，
    上限 2 行、上下各 12pt、最小 44；替换原先写死的 `44`（三处高度计算）。
  - `titleLab` 改 `numberOfLines = 2` + `NSLineBreakByTruncatingTail`，对齐安卓
    `rc_item_action_card_message.xml` 的 `maxLines=2 / ellipsize=end`。
- `SmartMessage/ZX_Base/ZX_Manager/ZXMarkdownManager.m`
  - `renderMarkdown:defaultAttrs:` 链路里新增 `processHTMLTags:defaultAttrs:`，位置在粗体/斜体之后、
    链接之前——`**<span style="color:blue">x</span>**` 先由粗体拿到 bold 字体，HTML 步骤只叠加颜色。
  - 支持 `<br>`/`<p>`（换行）、`<span style="color:…">`（着色）、`<b>/<strong>`、`<i>/<em>`、`<u>`；
    未知标签保持原样不吞。最后做 `&nbsp;/&lt;/&gt;/&quot;/&amp;` 实体解码（`&amp;` 放最后）。
  - 颜色解析 `zx_colorFromCSSValue:` 逐条对齐安卓 `SpanTagHandler.extractColorFromStyle()`：
    `#RGB`/`#RRGGBB`/`#AARRGGBB`、`rgb()`/`rgba()`（分量支持百分比）、CSS 颜色名表
    （名单与取值照搬安卓 `COLOR_NAME_MAP`，`green` 沿用安卓的 `#00FF00`）。
  - `color:` 提取用 `(?<![a-zA-Z-])color\s*:` 避免命中 `background-color`。
  - 嵌套 span：内层已着色片段不被外层覆盖（内部标记属性 `kZXHTMLSpanColorMark`，渲染结束前清掉）。

生效范围：`renderMarkdown:` 只被 `renderMarkdownBy:param:` → `ZXIMCellLogic agentReplyRenderedContent:` 调用，
即所有智能体回复正文（聊天页气泡、流式 cell、合并详情、聚合弹窗）；普通文本消息不走 markdown，不受影响。

## 待办 / 阻塞

- **iOS 未编译验证**：本仓库约定 AI 不执行 `xcodebuild`/`pod install`，需人工在 Xcode
  （`zhixinAppTest` + iPhone 15/iOS 17 模拟器）clean build 并自测。
- 自测点：出问题的那条消息（群 `1816016632343183361`，`messageUId=CVV7-VU8I-0F2F-32C8`）——
  标题条 2 行省略号、正文「值班总负责人：赵富文」蓝色加粗、结尾祝福语橙色、看不到 `<span …>` 原文、
  气泡下仍是「来自群AI框」。
- 回归点：@智能体流式回复（无 title 时不应多出空白标题头、打字机过程高度不跳）、
  群机器人卡片（有 title，高度由固定 44 变为按内容）、长回复「查看更多」折叠。
- 会话列表/引用行的纯文本摘要（`stripMarkdownSyntaxFromText`）**按决定保持现状**，仍会露出 `<span …>` 原文；
  安卓 `AgentReplyDisplayUtil` 同样不剥，两端一致。
- desktop / web 是否有同类问题未查。

## 关键决策记录

- 2026-08-13：HTML 支持范围取「span + 常见标签（br/p/b/strong/i/em/u）」而不是只做 span——
  更贴近安卓 Markwon `HtmlPlugin` 的整体行为；未知标签不剥离，避免吃掉正文里的正常尖括号内容。
- 2026-08-13：标题头高度改为按文本算而非固定 44——安卓标题最多 2 行，长标题（本例）固定 44 会被压。
- 2026-08-13：颜色名表照搬安卓取值（含 `green=#00FF00` 这种与 CSS 标准不一致的），优先保证两端同色。

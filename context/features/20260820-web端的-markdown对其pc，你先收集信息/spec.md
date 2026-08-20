# Spec：web markdown 表格对齐 PC

> 由 Superpowers brainstorm 产出。最后更新：2026-08-20

## 1. 背景与目标

个人 AI 框（web）和 PC 会话里的智能体卡片会渲染**同一段 markdown 正文**，但管线不同：

| | Web 个人 AI 框 | PC 会话 ActionCard |
|---|---|---|
| 解析 | `marked` → Tiptap / ProseMirror | `markdown-it` → `innerHTML` |
| 表格样式 | `AcMarkdown.vue`：半透明边、列宽上限 187.5px 后换行、表级横滚 | `markdown.scss`：同一套配色；列 **min/max 375px**、`.md-table-wrap` 横滚 |

上一轮 PC / 安卓 / iOS GFM 对齐**刻意排除 web**（当时认为 `AcMarkdown` 只是弹窗）。实际它就是个人 AI 框的回复气泡；从 AI 框转发到会话后，用户会看到「同一张表、两套样子」。

**目标（本期收窄后）**：web 上所有走 `AcMarkdown` 的 markdown 表格，在**配色、列宽上限内换行、宽表左右横滚**上对齐 PC 会话卡片的表格观感。标题、代码、引用、列表、折叠、单换行维持现状。

**成功标准**：

1. 宽表可以左右滑完，不把整段 Markdown（标题/段落）一起拖走。
2. 窄表不出现无意义的横滚。
3. 表头底、边框是半透明黑，没有写死白底 / 实色浅灰、没有斑马纹。
4. 单元格有列宽上限（`187.5px`，375 设计稿一半），长文在格内换行；多列仍可左右滑。
5. 个人 AI 框回复气泡、设置「AI 优化文本」弹窗两处表现一致（共用 `AcMarkdown`）。
6. 输入框、人格设定等可编辑 Tiptap **不变**。

## 2. 用户流程

1. 用户在个人 AI 框收到一条含宽表格的回复（或打开「AI 优化文本」看到带表的 markdown）。
2. 默认贴左，可用触控/触控板/Shift+滚轮左右滑；纵向滑动仍归对话列表（或弹窗自身的竖滚）。
3. 表比气泡窄时，没有横滑，也没有空白滚动条占一大块。
4. 长回复仍按现有 `ExpandableContent`（默认 240px）折叠；折叠可能切到表格，点「查看更多」看全文——**本期不改折叠**。

## 3. 范围

### 本期做

- 端：**只做 web**。
- 落点：`AcMarkdown.vue` 的表格视觉 + 横滚。消费方无需各改一遍：
  - `AiMsgCard.vue`（正文；思考过程 `reasoningContent` 若含表也走同一组件）
  - `AiTextOptimizerPopup.vue`
- 横滚外壳：Tiptap Table 的 `renderWrapper`（DOM 为 `.tableWrapper`），**仅当** `flags.markdownAsHtml === true`（`AcMarkdown` 已这样传）时打开。
- 配色与结构抄 `context/design/markdown-style-tokens.md` 的**表格行**（表头底 / 边框 / cell padding / 无斑马纹 / 横滚条形态）。单元格换行上限：`187.5px`（375/2）。

### 本期不做

| 项 | 原因 |
|----|------|
| 标题（含 h1–h4 蓝色、绝对 px 字号） | 用户选定维持现状 |
| 行内代码、代码块（含黑底白字代码块） | 同上 |
| 引用、列表、任务列表、单换行 `breaks`、折叠阈值 | 同上 |
| 左右渐变遮罩 | 用户只要能滑，不要 PC/安卓/iOS 那期的罩 |
| 换解析器 / 回退 `v-html` | 角标、插图、知识来源走 Tiptap 扩展 |
| 改 `EditorWrapper` 全局表格（输入框、人格设定） | 回归面超出「只改展示」 |
| PC / 安卓 / iOS 代码 | 它们已经按 token 画表 |
| 脚注、数学公式、语法高亮、首列固定 | 与三端既有「不做」清单一致 |

## 4. 设计

### 4.1 方案（已定：方案 1）

只让 **markdown 展示态**长出横滚外壳，表格皮肤写在 `AcMarkdown`：

- `EditorWrapper` 里 `Table.configure({ resizable: false, renderWrapper: isMarkdownAsHtml() })`。Tiptap 3.22 在 `resizable: false` 时直播 DOM **已经**由 `TableView` 包 `.tableWrapper`；`renderWrapper` 主要让 `getHTML()` 也带外壳。皮肤仍只写在 `AcMarkdown` 的 `.at-answer` 下，避免输入框表格吃到 nowrap/横滚条。
- 气泡是 flex + `overflow-hidden`。展示态必须 `min-width: 0` 且 `max-width: 100%`（含 `ExpandableContent` 与把原来的 `!max-w-unset` 改成 `!max-w-full`），否则 nowrap 表会撑破宽度被裁掉、里面却滑不了。
- `AcMarkdown` 用 `:deep(.tableWrapper)` 对齐 PC 的 `.md-table-wrap`：`max-width: 100%`、`overflow-x: auto`、`overscroll-behavior-x: contain`、6px 常驻细条（溢出才看得到滑块）。
- 去掉现有 `width: 100%` / `table-layout: fixed` / `background: #fff`；单元格 `max-width: 187.5px`（375/2）后换行。
- 显式关掉 `prose` 的斑马纹（`tr:nth-child(2n)` 透明）。

不在 ProseMirror 根上开横滚（会把标题一起拖走）。不把 table 从 Tiptap DOM 里掏出来再包一层（会打坏 contentDOM）。

### 4.2 表格视觉（对齐 token，相对 web 正文字号）

正文字号仍由调用方传入（桌面 `0.875rem` / 移动 `0.9375rem`），**不改成 PC 的 13px**。

| 项 | 值 |
|----|-----|
| 表头底 | `rgba(0,0,0,.04)` + 粗体 |
| 边框 | `1px solid rgba(0,0,0,.12)`，单线、无圆角 |
| cell padding | 竖 `0.35em` 横 `0.6em` |
| 单元格 | `max-width: 187.5px`（375 设计稿一半）后换行；短列仍随内容，多列靠横滚 |
| 斑马纹 | 无 |
| 表背景 | 透明（不写死 `#fff`） |
| 横滚条 | 溢出常驻；高 6px；滑块约 35% 黑；窄表不画有效滑块 |
| 左右渐变罩 | 无 |

### 4.3 交互

- 横滚只发生在 `.tableWrapper` 内。一条消息多张表，各滚各的。
- `overscroll-behavior-x: contain`：横滑到头不把纵向滚交给外层会话。
- 折叠：维持 `ExpandableContent` 240px；宽表在收起态被竖向裁切是接受的。收起态父级 `overflow-hidden` 仍允许内部 `overflow-x: auto`（外壳 `max-width: 100%`）。

### 4.4 组件边界

| 单元 | 做什么 | 怎么用 | 依赖 |
|------|--------|--------|------|
| `EditorWrapper` Table `renderWrapper` | markdown 展示态给每张表一个 `.tableWrapper` | `flags.markdownAsHtml` 为真即开 | `@tiptap/extension-table` 3.22 |
| `AcMarkdown` 表格 CSS | 皮肤 + 横滚行为 | 包住 `EditorWrapper` | token 表表格行 |
| `AiMsgCard` / `AiTextOptimizerPopup` | 不改 | 继续传 content 给 `AcMarkdown` | 无 |

## 5. 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本期是否改 | ✅ 表格展示 | ❌ | ❌ | ✅ 表格列宽 min/max 375px |
| 正文字号 | 14px / 15px（调用方原样） | 15sp | 16pt | 13px |
| 折叠 | 240px 不改 | 480dp | 自有 | 400px |
| 表格横滚外壳 | `.tableWrapper` | 段栈 `HorizontalScrollView` | 段栈 `UIScrollView` | `.md-table-wrap` |
| 左右渐变罩 | 无 | 已有（上期） | 已有 | 已有 |

## 6. 依赖的接口

无。不改 `context/contracts/`，不改 bridge。

## 7. 验收

在个人 AI 框（PC 内嵌 webview 或独立 web）和设置「AI 优化文本」各看一遍：

1. 宽表（≥6 列或长单元格）能左右滑完，标题/段落不跟着横移。
2. 窄表（2～3 列短字）没有横滑，配色已是半透明边/浅表头。
3. 无斑马纹、无白底色块。
4. 思考过程折叠卡里若出现表，同样规则（同一组件）。
5. 输入框里手动插的表（若有）与改前一致。
6. 长回复「查看更多」仍在，折叠高度仍是约 240px。

## 8. 已确认的问题（brainstorm）

- 场景：个人 AI 框 + AI 优化文本弹窗（选项 C）。
- 对齐层：表格观感 + 横滚；不是全量 GFM / 不是整张 token 表。
- 标题保持现状（含蓝色 h1–h4）。
- 代码保持现状（含黑底代码块）。
- 单元格不换行，宽表左右滑（不是换行挤进气泡）。
- 实现：方案 1（展示态外壳 + `AcMarkdown` CSS），不换管线、不改全局编辑器表格。

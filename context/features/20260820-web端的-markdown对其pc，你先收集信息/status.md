# Status：web markdown 表格对齐 PC

> 最后更新：2026-08-25（波浪下划线 + 表格/代码/引用对比度，页面未点）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

行号对应 `plan.md` 的 Task。本期从「只做 web」扩到 **web + PC 会话表格列宽**（web 187.5px / PC 375px）。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T0 切分支 `feat/web-markdown-table-align-pc` | ✅ | — | — | — |
| T1 Table `renderWrapper` 仅 markdown 展示态 | ✅ | — | — | — |
| T2 `AcMarkdown` 表格皮肤 + 横滚 CSS | ✅ | — | — | — |
| T3 token 表补 web 表格适用范围 | ✅ | — | — | — |
| T4 `vue-tsc --noEmit` | ✅ | — | — | — |
| T5 status / impl-notes | ✅ | — | — | — |
| 真机验收（宽表横滚 / 窄表无滑 / 输入框未回归） | 🚧 | — | — | — |
| 列宽上限格内换行 | 187.5px（375/2）🚧 | — | — | min/max **375px** ✅ |
| 行内代码：干掉 prose 反引号 + 浅底胶囊 | ✅ | — | — | — |
| 内联 span：background / padding / border-radius | ✅ 代码已补，页面未点 | — | — | — |
| 波浪下划线 `text-decoration: wavy` | ✅ 代码已补，页面未点 | — | — | — |

> T0–T5 的 ✅ 是代码 + `vue-tsc`。真机格子在你看过之前保持 🚧。

## 各端工作区现状（2026-08-20，`scripts/code-status.sh --short`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 |
|----|------|------|------|--------------|
| context | `main` ahead 173 | 脏 21 | 本功能 docs + **GFM 角标贴行笔记**；还有构建脚本等其他脏文件，勿一并提交 |
| web | **`feat/web-markdown-table-align-pc`** | synced | 干净 | **本功能**（待真机验收） |
| android | `fix/md-table-fold-truncate` | 无 upstream | 脏 4 | 不涉及 |
| ios | `feat/ios-file-download-progress` | synced | 脏 6 | 不涉及 |
| desktop | **`feat/gfm-markdown`** | synced | 脏 | **本功能**：`markdown.scss` 列 min/max 375px。另有角标贴行 + 本地调试文件（禁止提交） |

## 待办 / 阻塞

- (web) 2026-08-25 **波浪下划线**：`<u>` / `<span style="text-decoration: underline wavy">` 原先只出直线。已加 `ExtendUnderline`（吃 `text-decoration-style`）+ `ExtendInlineSpanStyle` 的 `textDecoration`；`AcMarkdown` 补 `text-decoration-style: wavy`。表格边框 12%→22%、代码块 10% 黑底、引用竖条 28%。`vue-tsc --noEmit` 干净。**请在个人 AI 框看这条样本。** 未 commit / push。
- (web) 2026-08-25 **内联 HTML 高亮**：个人 AI 框这段 `<span style="background-color;padding;border-radius">` 看起来没样式。根因：`marked` 会把 HTML 透传，但 Tiptap 的 `textStyle` 只占位、`Color` 只吃字色，背景/内边距/圆角进不了 schema。已加 `ExtendInlineSpanStyle`（`EditorWrapper` + `htmlToMarkdown` 同源）。字色 / 加粗 / 删除线本来就有（`Color` + Bold/Strike 的 style 解析）。**请在个人 AI 框看这条样本。** 未 commit / push。
- (web) 2026-08-24 已补行内代码皮肤（`AcMarkdown.vue`）：prose 不再用伪元素画反引号；单反引号与双反引号（内容含 `` ` ``）均已在本地 `AcMarkdown` 路径看过。未 commit / push。
- (web) **请你验收**：窄屏长单元格应在约 **187.5px** 处折行，375 宽大约能看清两列。
- (web) 列宽上限改动在 `feat/web-markdown-table-align-pc` 工作区，**尚未 commit / push**。
- (desktop) 列宽改为 **min/max 375px**（不要 187.5）。热更新后看：一列大约一个 375 设计稿宽，长文格内折行，多列横滚。未 commit / push。
- (desktop，旁路，属 `20260814-pc安卓-GFM-Markdown渲染对齐`) Eric「报销」消息里单独成行的 `<reference>` 会换行：已在 `feat/gfm-markdown` 把标签前换行折掉，角标贴前文。**请你热更新后看那条消息**。未 commit / push。

## 关键决策记录

- 2026-08-20 场景 = 个人 AI 框 +「AI 优化文本」弹窗；只对齐表格，标题/代码/引用/列表不动。
- 2026-08-20 单元格 nowrap + 表级左右横滚；不要左右渐变罩。
- 2026-08-20 真机：纯 nowrap 窄屏滑过去看不见几个字 → 列宽上限改为 **187.5px**（375/2），手机上一屏大约两列。
- 2026-08-20 同一 187.5px 上限接到 PC 会话后太窄；改成列 **min-width / max-width: 375px**（整段设计稿）。
- 2026-08-20 方案 1：皮肤写在 `AcMarkdown`；`renderWrapper` 只闸 `getHTML()`。直播 DOM 在 `resizable: false` 时本来就有 `TableView` 的 `.tableWrapper`。
- 2026-08-20 为让横滚在 flex 气泡里生效：`!max-w-unset` → `!max-w-full`，`ExpandableContent` / `AcMarkdown` 加 `min-w-0 max-w-full`。
- 2026-08-20 子代理审查：无 Critical；status 已按真实进度改；`renderWrapper` 注释已写清 TableView vs getHTML。
- 2026-08-20 旁路（PC GFM）：后端常把 `<reference>` 单独成行，解析器会当成独立块；PC 对齐安卓/iOS，解析前折掉标签前换行。表格后的标签必须塞进最后一格，否则 GFM 会丢掉。
- 2026-08-24 web 行内代码：解析一直是 `marked` → `<code>`；看起来「不支持」是因为 UnoCSS `prose` 的 `code::before/after` 又画回反引号。按 token 表做成浅底胶囊并关掉伪元素。代码块黑底皮肤不动。

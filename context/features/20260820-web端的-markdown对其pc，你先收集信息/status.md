# Status：web markdown 表格对齐 PC

> 最后更新：2026-09-02（iOS 折叠裁剪对齐 PC/安卓 + 表格与「回复 @xx：」间距，待真机验）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| 列宽上限格内换行 | 187.5px（375/2）🚧 | 🚧 三档 | 🚧 三档 | 🚧 三档（不再定死 375） |
| 行内代码：干掉 prose 反引号 + 浅底胶囊 | ✅ | — | — | — |
| 内联 span：background / padding / border-radius | ✅ 代码已补，页面未点 | — | — | — |
| 波浪下划线 `text-decoration: wavy` | ✅ 代码已补，页面未点 | — | — | — |
| 一/两列表格 `width:100%` 铺满容器 | 🚧 已 push `dd0a47d`，客户端未验 | 🚧 已 push `9a3b6d172` | 🚧 已 push `6e964addc` | 🚧 已 push `0d00470c` |
| 两列表首列内容 `min-width:5em`（标签列不被挤扁） | 🚧 已 push `dd0a47d`，客户端未验 | 🚧 同左 | 🚧 同左 | 🚧 同左 |
| 三列以上单列上限 = 半个气泡（JS 写 CSS 变量） | 🚧 已 push `dd0a47d`，客户端未验 | 🚧 同左 | 🚧 上限含 padding，同 commit | 🚧 JS 打标，同 commit |
| 折叠超限一律裁到限高（不整块取舍） | — | ✅ 早已如此 | 🚧 代码已改，未提交/未真机 | ✅ 早已如此 |
| 表格与前一块间距（前缀块不被压） | — | ✅ 16dp | 🚧 同左 | — |
| 普通长文本消息折叠（非卡片） | — | ✅ 550dp | 🚧 新增，未提交/未真机 | ✅ 已有 |

> T0–T5 的 ✅ 是代码 + `vue-tsc`。真机格子在你看过之前保持 🚧。

## 各端工作区现状（2026-08-20，`scripts/code-status.sh --short`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 |
|----|------|------|------|--------------|
| context | `main` ahead 173 | 脏 21 | 本功能 docs + **GFM 角标贴行笔记**；还有构建脚本等其他脏文件，勿一并提交 |
| web | **`feat/web-markdown-table-align-pc`** | synced | 干净 | **本功能**（待真机验收） |
| android | `fix/md-table-fold-truncate` | 无 upstream | 脏 4 | 不涉及 |
| ios | `feat/ios-file-download-progress` | synced | 脏 6 | 不涉及 |
| desktop | **`feat/gfm-markdown`** | synced | 脏 3 | 表格宽度已 push `d987d746`。剩 `.env.test` / `electron-builder.yml` / `package.json` **禁止提交** |

## 本回合各端现状（code-status，2026-09-02 表格白底 + 表头 600）

本回合改 PC / 安卓 / iOS 表格皮肤（表体 `#fff`、表头底不改、表头字重 600）+ token 表。web 未改。desktop 剩 `.env.test` / `electron-builder.yml` / `package.json` 本地调试，禁止提交。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| desktop | master-3.4.27 | synced | 脏(5)：2 业务 + 3 本地调试勿提交 | **本功能** | scss 单元格 #fff；单测 12 绿 |
| android | master-3.6.23 | synced | 脏(2) 本功能 | **本功能** | `TABLE_CELL_BG` + 表头 600；`:IM:compileOnTestDebugJavaWithJavac` 过 |
| ios | feat/ios-agent-date-range | synced | 脏(4) 本功能 | **本功能** | 格子白底 + `UIFontWeightSemibold`；本回合追加 `ZXMarkdownContentView.m` 折叠裁剪 + 表格上间距 |
| web | feat/data-scope-storage-group | synced | 干净 | 数据范围选择周工作 | 本回合未改 |
| context | main | ahead 7 | 本功能 docs + token 表 | **本功能** | — |

## 待办 / 阻塞

- (ios) 2026-09-02 **含表格的 AI 卡片收起态几乎空白（已改代码，请再验）**：正文是「回复 @xx：」一行 + 一张长表时，收起态只剩前缀 + 「查看更多」，表整块不见。根因是 iOS 折叠仍按「块级取舍」，表格塞不进限高就整块丢弃；PC / 安卓 2026-08-19 起已改成「超限一律裁到限高」。iOS 已对齐。**请看群里那条「今晚汇报要点」表格卡**：收起态应看到表格上半截 + 渐变遮罩 + 查看更多，展开后完整。
- (ios) 2026-09-02 **普通长文本消息不折叠（已改代码，请再验）**：群里那条「Markdown 渲染样式全量预览」是 `RC:TxtMsg`（定时任务推送，`fixTaskMessage=1`，非 ActionCard），iOS 的折叠只挂在 AI 卡片 / 流式回复上，普通文本气泡没有任何折叠，8000 多字整条铺开。安卓 `TextMessageItemProvider` 550dp 就折、PC 也折。iOS 已补：超过限高收起 + 底部渐变遮罩「查看更多」，展开后底部给「收起」。第一版真机整条白掉（气泡在、正文没了），根因是 iOS 正文控件垂直居中绘制，只把控件高度夹小会把绘制起点推到界外；已改成限制行数 + 控件高度取「按该行数量出来的高度」。**请看那条超长文本**：收起态高度约等于半屏多一点、正文从顶部开始显示、底部有查看更多；展开后能看全并能收起；再滚动几屏看普通短消息没被误夹。
- (ios) 2026-09-02 **表格压住「回复 @xx：」前缀（已改代码，请再验）**：表格块对前一块固定上收 10pt，这是按「段落块尾部多一行空行」调的；前缀块没有那行空行，于是表格上移压到文字上。已改成看前一块是否以换行收尾，收尾才上收 10pt，否则正向补 16pt（= 安卓 `TABLE_SEGMENT_TOP_MARGIN_DP`）。**请看同一条消息展开态**：「回复 @李博雅：」与表框之间应有一指间距，且普通「正文段 + 表格」的间距不应变大。
- (android) 2026-09-02 **表体改白底后左边框消失（已改代码，请再验）**：左/上线原先画在表格外壳上，格子透明时能透出来；格子改成不透明白底后把外壳线盖住了。已改成首列自己画左、首行自己画上。请看表的左框和上框是否都在。
- (ios) 2026-09-02 **≥3 列一屏看不全两列（已改代码，请再验）**：上限先封内容再加左右 padding，两列合计超出气泡约 4×单侧边距。已改成上限封整列宽（内容+padding），两列顶格时合计 = 可用宽。请看 4～5 列长文：气泡里应能完整看到两列，再横滑看后面的列。
- (android / ios) 2026-09-02 **两列表横条 + 一列竖字（已改代码，请再验）**：未折行自然宽把第一列铺满，第二列剩 1 个字，表比外壳宽就画出横条。已改成两列都保 5 字下限、剩余按比例分满可用宽，1/2 列关掉横滚。请再看「项目及事项 / 长正文」那张两列表：应铺满气泡、两列都能读、没有横条。
- (三端) 2026-09-02 **列宽三档代码已写、客户端未验**：验收清单：1 列表、2 列表（标签列 + 长正文）、3 列短字、4~5 列长文各看一遍——短表不被撑宽、标签列不被压成一个字、宽表一屏约两列可横滑、气泡不裁切。
- (desktop) `.env.test` / `electron-builder.yml` / `package.json` 仍是本地调试，未随 `0d00470c` 提交。

- (web) 2026-09-02 **一/两列表格铺满容器**：`AcMarkdown.vue` 加 `table:not(:has(tr:first-child > :nth-child(3))) { width:100% }`（首行没有第 3 格 => 列数 ≤ 2），并对这类表把单元格 `max-width` 放开为 `none`（否则每列封顶 187.5px，宽容器里撑不满）。先只写了两列的选择器，一列表格没进去，已改成按「不足 3 列」判定。已随 `7294897` 单独提交并 push 到 `feat/data-scope-storage-group`（只含这 2 个文件，数据范围的改动未混入）。**请在个人 AI 框看一条一列 / 两列表格**：应铺满气泡宽度，三列及以上维持原来的 max-content + 横滚。
- (web) 2026-09-02 **三列及以上：单列上限 = 半个气泡**（不是定死宽）。规则在 `BaseMsgCard.vue` 非 scoped `<style>`：整行 `.zx-msg-row` 加 `container-type: inline-size`（块级、宽度来自父级，容器化不会塌；气泡/内容列是 shrink-to-fit，放那儿会塌成 `min-w-30`——这是之前那版窄条 bug 的根因），气泡内 `table:has(tr > :nth-child(3))` 的 `th/td` 只写 `max-width: calc(50cqw - 45px)`。45px = 头像 40 + 间距 10 + 气泡内边距的一半左右，把「半行」折算成「半个气泡」。headless 量（680 宽会话）：3 列短字表气泡收到 86px、列各 27（不再被撑满）；5 列短字表 564 宽无横滚；4 列长文列宽 207/295/295/284、外壳 596、横滚 1082（一屏两列 + 一截第三列）。先前那版「`width: 50cqw` 定死」已废弃：会把短内容也撑成半个气泡。**请看短表和宽表各一条**。
- (web) 2026-09-02 **踩坑（已修）**：`container-type: inline-size` 先写在 `.tableWrapper` 上，导致外壳没有内容贡献，shrink-to-fit 的气泡塌成 `min-w-30`（用户截图里的窄条）。容器必须放在一个宽度确定的祖先上，所以改成气泡层 `width:100%` + 容器化。
- (web) 2026-09-02 **两列表首列下限 5em**：`AcMarkdown.vue` 对两列表的 `tr > :first-child > *` 写 `min-width: 5em`（下限写在单元格内容上，不是单元格）。**为什么默认会被挤扁**：auto 布局先给每列 min-content，再把富余宽度按各列 `max-content` 的比例分；标签列 max-content ≈ 一行短词，正文列 ≈ 整段，量级差十倍，富余几乎全给了正文列，标签列就退到 min-content——中文逐字可断，min-content 就是 1 个字宽。踩坑（headless 逐个量过 292px 外壳）：① 单元格上的 `min-width: 33%/40%` **完全不生效**（表格单元格忽略百分比 min/max-width）；② `width: min(35%, max-content)` 也不生效，退化成 auto；③ `table-layout: fixed` 生效但会把表格固有宽度变成满宽，短两列表的气泡被撑到整行（465→630）；④ 固定 `width: 35%` 生效，但长短标签一律 35%（短标签 102px，本来 70px 就够）。最终取 5em 下限：长标签 110px（38%）、短标签 91px（31%），仍随内容变。**请看那条「项目/事项 / 关键信息」的两列表**；嫌窄就把 5em 调到 6~7em（7em 时长标签 133px / 46%）。
- (web) 2026-09-02 兼容性缺口：`:has()` 要 Chrome 105+ / Safari 15.4+，容器查询单位 `cqw` 要 Chrome 105+ / Safari 16，都用 `@supports` / 选择器失效自然降级——老 WebView 上退回 `width:max-content` + 单元格 187.5px 上限（不坏，只是不铺满 / 不是恰好两列）。真要兜底得渲染后用 MutationObserver 打 class + JS 算宽，暂未做。

- (web) 2026-08-25 **波浪下划线** 已 commit/push `f5616c5`：`<u>` / `<span style="text-decoration: underline wavy">` 原先只出直线。已加 `ExtendUnderline`（吃 `text-decoration-style`）+ `ExtendInlineSpanStyle` 的 `textDecoration`；`AcMarkdown` 补 `text-decoration-style: wavy`。表格边框 12%→22%、代码块 10% 黑底、引用竖条 28%。**请在个人 AI 框看这条样本。**
- (web) 2026-08-25 **内联 HTML 高亮** 已在 `87d3921`：个人 AI 框这段 `<span style="background-color;padding;border-radius">` 看起来没样式。根因：`marked` 会把 HTML 透传，但 Tiptap 的 `textStyle` 只占位、`Color` 只吃字色，背景/内边距/圆角进不了 schema。已加 `ExtendInlineSpanStyle`（`EditorWrapper` + `htmlToMarkdown` 同源）。**请在个人 AI 框看这条样本。**
- (web) 2026-08-24 行内代码皮肤已在 `92efddc`：prose 不再用伪元素画反引号；单反引号与双反引号均已在本地 `AcMarkdown` 路径看过。
- (web) **请你验收**：窄屏长单元格应在约 **187.5px** 处折行，375 宽大约能看清两列。列宽改动已在分支上（`868f780`）。
- (desktop) 2026-08-26 **表格宽度对齐 web** 已 commit/push `d987d746`：原先 `min+max 375px` 把短列也撑满，且卡片根节点 `!max-w-[max-content]` 让宽表撑破气泡再被裁掉、滑条出不来。已改成与 web 同一套算法——`table width:max-content`、单元格只有 `max-width:375px`、从 `.message-wrapper` / `.msg-box` / `.md-html-wrapper` / `.md-table-wrap` 一路 `min-width:0; max-width:100%`。**请热更新后看**：窄表（2～3 列短字）不应再被撑到每列 375；宽表/长单元格应格内折行并在表内横滚，标题不跟着横移。
- (desktop，旁路，属 `20260814-pc安卓-GFM-Markdown渲染对齐`) Eric「报销」消息里单独成行的 `<reference>` 会换行：已在 `feat/gfm-markdown` 把标签前换行折掉，角标贴前文。**请你热更新后看那条消息**。未 commit / push。

## 关键决策记录

- 2026-08-20 场景 = 个人 AI 框 +「AI 优化文本」弹窗；只对齐表格，标题/代码/引用/列表不动。
- 2026-08-20 单元格 nowrap + 表级左右横滚；不要左右渐变罩。
- 2026-08-20 真机：纯 nowrap 窄屏滑过去看不见几个字 → 列宽上限改为 **187.5px**（375/2），手机上一屏大约两列。
- 2026-08-20 同一 187.5px 上限接到 PC 会话后太窄；改成列 **max-width: 375px**（整段设计稿）。2026-08-25 去掉 min-width（短列随内容，对齐 web），并补上 flex 收缩链，否则横滚出不来。
- 2026-08-20 方案 1：皮肤写在 `AcMarkdown`；`renderWrapper` 只闸 `getHTML()`。直播 DOM 在 `resizable: false` 时本来就有 `TableView` 的 `.tableWrapper`。
- 2026-08-20 为让横滚在 flex 气泡里生效：`!max-w-unset` → `!max-w-full`，`ExpandableContent` / `AcMarkdown` 加 `min-w-0 max-w-full`。
- 2026-08-20 子代理审查：无 Critical；status 已按真实进度改；`renderWrapper` 注释已写清 TableView vs getHTML。
- 2026-08-20 旁路（PC GFM）：后端常把 `<reference>` 单独成行，解析器会当成独立块；PC 对齐安卓/iOS，解析前折掉标签前换行。表格后的标签必须塞进最后一格，否则 GFM 会丢掉。
- 2026-09-02 `cqw` 只在聊天气泡内用（规则写在 BaseMsgCard）：没有查询容器时 `cqw` 会退回视口宽，人格设定 / AI 优化弹窗里的表会变成半屏一列，所以气泡外仍保留 187.5px 上限。
- 2026-09-02 列宽基准从固定 187.5px 改成「气泡的一半」：187.5px 是按 375 设计稿写死的，气泡实际宽度随端/窗口变，只有容器查询单位 `50cqw` 能让「正好两列」在各宽度下都成立。
- 2026-09-02 列数只能靠 CSS `:has()` 数（首行有没有第 3 格）——Tiptap `resizable:false` 不出 `colgroup`，也没有渲染后打 class 的钩子，纯 CSS 最省；不支持时优雅降级。用 `:not(:has(...:nth-child(3)))` 反向判定，一列两列一条规则覆盖。
- 2026-09-02 原生端「半个气泡」：气泡是 shrink-to-fit，不能拿它当前宽去除以 2。desktop 取消息行宽再减 58（头像 40 + 间距 10 + 气泡内边距一半 8）；android / iOS 布局时已经能拿到内容区的父级上限，直接用「可用内容宽 / 2」，下限 120。
- 2026-09-02 换绑必须清掉上次算出的列宽 / 可用宽，否则窄气泡会沿用宽消息的上限。
- 2026-09-02 窗口缩放 / 旋转 / 分屏要重算；列表高度缓存若不含可用宽，旋转后会命中旧列宽。
- 2026-09-02 两列表禁止横滚：列宽按可用宽分满（两列都有 5em 下限），不要按未折行自然宽把一列铺满。
- 2026-09-02 ≥3 列上限封的是整列宽（含格内边距）。自绘表格若先封内容再加 padding，两列会超出气泡，一屏看不全两列。
- 2026-09-02 表体单元格底改为 `#fff`，表头字重 600；**表头底色不改**（仍半透明黑）。web 个人 AI 框这轮没改。
- 2026-09-02 安卓格子改成不透明底之后，不能再把左/上边框只画在表格外壳上——子格子会盖住。外框要画在首列/首行格子自己身上。
- 2026-08-24 web 行内代码：解析一直是 `marked` → `<code>`；看起来「不支持」是因为 UnoCSS `prose` 的 `code::before/after` 又画回反引号。按 token 表做成浅底胶囊并关掉伪元素。代码块黑底皮肤不动。

## 2026-09-02 补：PC 端 Chrome 102 兼容返工

`process.versions.chrome = 102.0.5005.167`——PC 端 Electron 内核比 `:has()`（Chrome 105）和容器查询单位 `cqw`（105/106）都老，
上一版三档规则在 PC 上**整条不生效**，只有 web/移动的新内核能看到效果。已改成 JS 打标，新旧内核走同一条路径：

| 层 | 做法 |
|---|---|
| `AcMarkdown.vue` `stampTables()` | 按首行单元格数给 `<table>` 打 `data-md-cols="1｜2｜3plus"`；3 列以上再用最近的 `.zx-msg-row` 宽度算 `Math.max(120, rowWidth/2 - 45)` 写进 `--md-cell-max` |
| 触发时机 | `onMounted` + `watch(content)` + `MutationObserver`（childList/subtree，只读不写属性，不会自触发）+ `ResizeObserver`（观察消息行）；统一 rAF 合并，流式输出不会每 token 重算 |
| 样式 | 只认 `table[data-md-cols=...]` 与 `var(--md-cell-max, 187.5px)`，不再有 `:has()` / `cqw` |
| `BaseMsgCard.vue` | 删掉 `container-type` 与 cqw 规则，只留 `.zx-msg-row` 类名给脚本定位（已在模板注释「勿删」） |

要点：
- 气泡外（人格设定 / AI 优化弹窗）找不到 `.zx-msg-row`，不写变量，退回 187.5px——与改版前一致。
- 两列表首列的 5em 下限同时写在单元格和其内容上：Tiptap 每格都是 `<p>`，但纯文本格时 `> *` 选不到，实测单元格自身那条仍能把 45.78px 抬到 70px。
- headless 复跑 JS 路径，数值与 cqw 版逐格一致（3 列短字 86 / 5 列短字 564 / 3 列长文 563 / 4 列长文 596 + 横滚 1082）。
- 仓库里另一处 `:has()` 在 `KnowledgeListTable.vue:738`，早有 JS 兜底，未动。

# Status：安卓端 @智能体 / 个人AI框 流式输出抖动

> 最后更新：2026-08-21（第三轮包已装机，正在抓 `ZX:Stream` 日志）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 定位抖动根因（4 条） | — | ✅ | — | — |
| 打字机按 msgUid 独立排队（新 `AgentStreamPlayer`） | — | ✅ 代码 | — | — |
| 跟随滚动改 preDraw + 瞬时 `scrollBy` | — | ✅ 代码 | — | — |
| holder 复用护栏（`boundUid` + 清高度地板） | — | ✅ 代码 | — | — |
| 第二轮：「查看更多」每帧判 + 幂等显隐 + 锁 focusable | — | ✅ 代码 | — | — |
| 第三轮：渲染缓存改**按块累积** + 未闭合表格块退回纯文本 | — | ✅ 代码 | — | — |
| `:IM:compileOnTestDebugJavaWithJavac` | — | ✅ 无 error | — | — |
| 正式包装机（`adb install -r` Success，设备 `cbaf94cf` 小米 2509FPN0BC） | — | ✅ | — | — |
| **真机验收 + 日志分析** | — | 🚧 抓取中 | — | — |

> ✅ 只代表「代码写完 + 编译过 + 装上」。本仓库无单测，抖动是观感问题，**必须真机看**。

## 各端工作区现状（2026-08-21，`scripts/code-status.sh --short`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 |
|----|------|------|------|--------------|
| context | `main` ahead 178 | 脏 15 | 本功能 docs + 其他功能遗留脏文件，勿一并提交 |
| web | `feat/web-markdown-table-align-pc` | synced | 脏 1 | 不涉及（属 web markdown 对齐 PC 那个功能） |
| android | `fix/md-table-fold-truncate` | 无 upstream | 脏 4 | **本功能**，未 commit |
| ios | `feat/ios-file-download-progress` | synced | 脏 6 | 不涉及 |
| desktop | `feat/gfm-markdown` | synced | 脏 6 | 不涉及 |

## 第二轮（真机反馈后，2026-08-20 18:0x）

用户实测反馈：**仍抖，形态是「列表上下跳」**；且**进行中的气泡超过阈值后不显示「查看更多」**。
（进行中气泡 = ReferenceMessage 流式座位，确认改对了链路。）

| 处理 | 状态 |
|------|------|
| 「查看更多」改成**每帧判**（原来只在一批追平后判，批中间超限时按钮迟迟不出现） | ✅ 代码 |
| `setVisibility` 幂等（可见性没变就不设，省掉每帧一次 requestLayout） | ✅ 代码 |
| 流式中途不再撤高度地板（撤了气泡会缩回去，列表跟着跳） | ✅ 代码 |
| **每次 setText 后锁掉 focusable/clickable/longClickable** | ✅ 代码 |
| preDraw 里加 `isComputingLayout()` 保护 | ✅ 代码 |
| 临时打点 `ZX:Stream`（answerEvent / dispatch / rebind / refresh / tick / frame / foldCheck / follow / dead） | ✅ 待抓日志 |

关键新证据（`javap` 反编译 markwon core 4.6.2 确认，不是猜）：
`CorePlugin.afterSetText` 会在**每次 setText 后**调 `TextView.setMovementMethod(LinkMovementMethod)`，
而 `setMovementMethod` 内部的 `fixFocusableAndClickableSettings()` 把
focusable / clickable / longClickable 一并强制设回 true。流式每 150ms setText 一次，
等于每 150ms 把气泡正文重新变成「可获焦 + 可长按」。同一坑 AI 卡片段栈已踩过
（`ZXMarkdownContentView#disableFocusAndLongClick`），本次在流式渲染器里补同样的锁。

## 第三轮：闪烁真因 = 表格 span 每帧重建（2026-08-20，用户三张截图 + 反编译坐实）

用户截图直接给出证据：流式开始时表格是**正常态**（有边框、行高大），抖动时是**另一种态**
（无边框、行挤在一起），两态高度差一百多 px。

反编译 `markwon ext-tables 4.6.2` 确认机制：
- `TableRowSpan.getSize()` 读内部 `layouts` 缓存算高度；**新建的 span 还没有 layout**，
  先按很矮的高度参与测量（= 无边框紧凑那一帧）；
- `draw()` 里 `SpanUtils.width(canvas, text)` → `recreateLayouts(width)` 建好 layout，
  再由 invalidator `textView.setText(getText())` 重排一次才变成正常表格。
- 结论：**每新建一批 TableRowSpan 就闪一次「矮→高」**。

而第二轮的缓存是「前缀长度 + 指纹」——表格后面每多一个字前缀就变，整段重新解析，
于是每 150ms 新建一批表格 span，一直闪、列表一直上下跳。

处理（都在 `AgentStreamMarkdownRenderer`）：
1. 缓存改成**按块累积**（`committed` + `committedLen` + `committedHash`）：
   空行闭合的块渲染一次就永久留着，之后每帧只把同一批 span 复制进新 builder，
   layout 缓存还在，不再「矮→高」。
2. 未闭合的块**只要带 `|` 就整块退回纯文本**（原来只挡「还没出现分隔行」的半张表）。
   写表格的那两三秒显示 `| a | b |` 原文，空行闭合后一次性变成真表格——
   **一次跳变，取代持续闪烁**。这是取舍，觉得原文太丑就改回来（一个判断条件）。
3. 块之间补空行、尾巴接在空行后另起段，跟整篇渲染的块间距对齐。

> 仍未根治的部分：流式座位是**单 TextView + Markwon 表格 span**，最终卡片是
> **段栈 + 真表格控件**（`ZXMarkdownTableView`），两者表格样式本来就不一致（截图 1 vs 3）。
> 要完全一致得让流式座位也走段栈，工作量更大，列为后备方案。

## 待办 / 阻塞

- (android) **进行中**：设备已连本机，第三轮正式包已装。用户在「报销答疑+员工手册」群
  发 `@Eric 报销` 复现，我这边 `adb logcat -v time -s ZX:Stream:I` 抓日志。
  待判定：`dispatch` 的 provider 是不是 `ReferenceMessageItemProvider`；
  `commitBlock` 出现次数（表格块是否只渲染一次）；`follow` 的 `offset=A->B` 是否来回反复；
  `rebind` 频率；`foldCheck` 的 `h` 是否到 `cap`。
- (android) 打点是**临时**的（代码里标了 `TODO 临时打点`），定位完必须删掉再交付。
- (android) 代码改动**未 commit**，留在 `fix/md-table-fold-truncate` 工作区。
- (android) 未覆盖：同屏两条智能体同时回答（本次专门为它做了按 uid 排队，但没有构造场景验证）。

## 关键决策记录

- 2026-08-20 流式载体确认是 **ReferenceMessage 流式座位**（`extra.fromType==1`），
  不是 ActionCard；上一 feature「ActionCard 不走 refreshAgentNewAnswerContent」的结论
  指的是**回答结束后**那条卡片，两者不冲突。
- 2026-08-20 抖动主因不是渲染慢，是**全局单例 provider 上只有一个 Handler/Runnable**：
  任意一条普通引用消息重新绑定（`cancelStream()`）或另一条回答刷新，都会掐掉正在跑的打字机。
- 2026-08-20 跟随滚动改 `onPreDraw` + `scrollBy`：原来在 `setText` 当场用
  `itemView.getBottom()` 算（布局还没跑，慢一拍），又用 `smoothScrollBy`
  把列表置成 SETTLING，下一步被自己的 IDLE 判定挡掉 → 走走停停。
- 2026-08-20 不重启节拍：新轮询到货只把「要追的目标」变长，不 removeCallbacks 重排。
- 2026-08-20 手感参数（1500ms / 10 字 / 150ms）原样保留，只改调度与渲染。

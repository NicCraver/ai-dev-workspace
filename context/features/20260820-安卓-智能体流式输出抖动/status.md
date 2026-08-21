# Status：安卓端 @智能体 / 个人AI框 流式输出抖动

> 最后更新：2026-08-21（六轮全部真机通过，9 个提交压成 `8275a307c` 并已推 `feat/gfm-markdown`）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| **真机验收**（不抖不闪、与卡片一致、前缀不重复） | — | ✅ 通过 | — | — |
| 本地 9 个提交压成一个 `8275a307c` | — | ✅ | — | — |
| push | — | ✅ `8275a307c` → `origin/feat/gfm-markdown`（快进） | — | — |

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

## 第四轮：抖动已消除，转样式对齐（2026-08-21）

用户真机确认：**不抖了**（第三轮的按块累积 + 表格延后成型生效）。
> 说明：这轮结论来自肉眼，不是日志——`adb logcat -s ZX:Stream:I` 抓不到，
> 因为 tag 里带冒号，`-s` 的 `tag:priority` 语法表达不了。要抓得用
> `adb logcat -v time | grep "ZX:Stream"`。

新问题：**流式中的表格与回答完成后卡片里的表格样式不一致**。原因是两套渲染器：

| | 流式座位（进行中） | 最终 AI 卡片 |
|---|---|---|
| 载体 | 单 TextView | 段栈 `ZXMarkdownContentView` |
| 表格实现 | Markwon `TableRowSpan`（span 自绘） | `ZXMarkdownTableView` 真控件 |
| 表格样式来源 | **自建 Markwon**：边框 `#e7e7e7` / 2px，其余全默认 | `ZXMarkwonFactory` token：边框 `0x1F000000`、表头 `0x0A000000`、内边距 9dp/5dp |
| 列宽 | 按可用宽度均分，不能横滚 | 单列上限 188dp，超了横滚 + 指示条 |
| 标题 | Markwon 默认 H1 = 2 倍且自带横线 | 1.40 倍、无横线 |
| 软换行 | CommonMark 原义（单换行并成空格） | `SoftBreakAddsNewLinePlugin` 按换行显示 |

处理：流式渲染器改用 **`ZXMarkwonFactory.create(app, null)`**（原来那套自建 builder 是历史遗留，
本功能只是把它原样搬进了新类）。标题、代码、引用、链接色、删除线、任务列表、软换行、
表格配色全部与卡片对齐；图片插件传 null（座位消息不带图，且每 150ms 重设文本会反复触发异步调度）。

**仍然不一致的只剩表格本身**：span 表格做不到「单列 188dp 上限 + 横滚」，单元格内边距也吃
Markwon 默认。要完全一致得让流式座位也走段栈（后备方案 B，见下）。

## 第五轮：流式一次性对齐卡片（2026-08-21，计划已批准并实施）

抖动那条线已收口并 commit（`6591514c0`，作为本轮回退点）。本轮按批准的计划把**流式座位
整条链路切到与 AI 卡片同一套渲染**：

| 任务 | 落点 | 状态 |
|------|------|------|
| T1 抽出共用标签预处理，卡片改为调用它 | 新增 `robot/AgentMarkdownPreprocessor.java`；`ActionCardMessageItemProvider#preprocess` 瘦身 | ✅ 代码 |
| T2 段栈支持流式增量（`beginStream` / `appendClosedSegments` / `setTailText`） | `robot/ZXMarkdownContentView.java`，`bind()` 未动 | ✅ 代码 |
| T3 渲染器改为「喂段栈」，且**自身无状态** | `agent_stream/AgentStreamMarkdownRenderer.java` | ✅ 代码 |
| T4 provider 流式分支切段栈 + 折叠照抄卡片 + 「回复 @xxx：」前缀 | `ReferenceMessageItemProvider` + `rc_item_reference_message.xml` 加 `md_content_stack` | ✅ 代码 |
| T5 删除全部 `ZX:Stream` 临时打点 | 4 个文件 | ✅ 代码 |
| 编译 `:IM:compileOnTestDebugJavaWithJavac` | — | ✅ 无 error |
| 出包 + 装机 | 包已出（77.7 MB）；**装机失败：设备已拔** | ❌ 待重连 |

实施中补掉的两个设计缺陷（计划里没写，实现时发现）：
- **流式进度状态必须挂在段栈这个 View 上**，不能放渲染器里：provider 是全局单例，
  段栈会随 holder 复用给另一条消息，渲染器记状态会把新消息的段接在旧消息内容后面。
  现在 `streamUid / streamCommittedLen / streamCommittedHash` 都在 `ZXMarkdownContentView` 上，
  `isStreaming(uid)` 不匹配就整条重来。
- 「查看更多」「收起」在布局里锚在 `text_message_content` 上（`alignBottom` / `below`），
  段栈上场后锚点必须用代码切到 `md_content_stack`，否则按钮贴在一个 GONE 的 View 上。
- 引用聚合弹窗里的首条源消息仍用 `maxReferUnitHeightDP` 限高，没被 480 一刀切。

## 第六轮：修「回复 @xxx：」重复（2026-08-21）

真机验收第五轮：**流式与卡片的呈现一致、不抖不闪，通过**。新缺陷：占位阶段显示成
「回复 @李权泓：回复 李权泓：正在生成回答…」——前缀出现两次。

原因：座位消息的**正文本身**就带「回复 李权泓：」（占位文案就是这种），
第五轮又在渲染前拼了一遍带颜色的前缀。
修法：渲染前先用现成的 `AgentReplyDisplayUtil.bodyByStrippingReplyPrefix()` 剥掉自带前缀
（该工具的注释本来就写着「正文自带会重复」，合并详情那条链路早就在用），再拼样式前缀。
已重新出包装机，待验收。

## 待办 / 阻塞

- (android) **已全部真机验收通过**（含占位阶段前缀不再重复）。
- (android) 历史已整理：**本地未推送的 9 个提交全部压成一个** `8275a307c`
  （`git reset --soft 9998908ea` 后重新提交；压缩前的 tip 在 reflog 里可找回）。
  9 个 = AI 卡片 markdown 渲染修复 7 个 + 表格列宽 1 个 + 流式抗抖与对齐 1 个。
  **没有动**分支上另外 44 个提交——它们已经在 `origin/personal-ai-chat-hotfix`、
  `origin/feat/gfm-markdown` 等远程分支上，压了就是改写已发布历史。
- (android) 已推送：`git push origin HEAD:feat/gfm-markdown`，快进 `9998908ea..8275a307c`，
  推送后 `origin/feat/gfm-markdown..HEAD` = 0。本地分支仍是 `fix/md-table-fold-truncate`（无 upstream）。
  远端提示可开 MR：`merge_requests/new?source_branch=feat/gfm-markdown`。
- (android) `ActionCardMessageItemProvider` 里还留着两处 `ZXMarkwonCost` 绑定耗时打点
  （注释写着「验完删」，251 / 609 行），下次动这个文件时顺手删。
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

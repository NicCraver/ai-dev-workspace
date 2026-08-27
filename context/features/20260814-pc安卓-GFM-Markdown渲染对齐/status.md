# Status：pc安卓-GFM-Markdown渲染对齐

> **已结项（2026-08-27）**——用户判定功能完成，已从 `context/features/ACTIVE` 移出，不再是活跃功能。
> 最后更新：2026-08-27（T15 已 commit + push `4a283b741`，真机仍未验）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 结项说明（2026-08-27）

功能按用户判定完成。下面的矩阵与待办**保持结项当刻的事实原样，未做乐观刷绿**，留给日后回溯。

**结项时的遗留，均由用户自行处理，非阻塞**：

- (android) T15 长按修复已提交并 push：`4a283b741`（`feat/gfm-markdown`，synced）。真机长按四点仍未验。
- (desktop) `feat/gfm-markdown` 结项时 **behind 1**（origin `5213e645`），本地调试三件套 `.env.test` / `electron-builder.yml` / `package.json` 仍脏且**禁止提交**。
- 矩阵里 T6 / T12（两端用例页）仍是 🚧：用例页已建但未逐条自测，**结项时也未删**。日后清理时删 PC `components/debug/MarkdownGfmCases.vue` + router 那条、安卓 `com/im/debug/MarkdownGfmCasesActivity.java` + manifest 那条。
- 下方「下一步全是运行时自测」整批**未执行**——全部 ✅ 的判据始终是「代码写完 + 编译通过」，不含运行时验证。已真机验过的只有：登录崩溃修复、issue #9 之前的几轮自测反馈项。

**沉淀去处**：三端样式唯一事实来源是 `context/design/markdown-style-tokens.md`（未随本功能结项失效，后续改 markdown 样式仍以它为准）。安卓崩溃排查经验已写进 `context/platforms/android.md`。

## 平台矩阵

本功能**只动 PC（desktop）与安卓**，web 与 iOS 不涉及（iOS 上一轮已完成，web 的 `marked` 管线只服务 AI 卡片弹窗、不是消息气泡）。行号对应 `plan.md` 的 Task。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 现状勘察（两端管线与差距） | — | ✅ | — | ✅ |
| spec 定稿 | — | ✅ | — | ✅ |
| plan 拆解（13 个 Task） | — | ✅ | — | ✅ |
| 切分支 `feat/gfm-markdown` | — | ✅ | — | ✅ |
| T1 markdown-it 选项 + 兜底 + 开关 | — | — | — | ✅ |
| T2 任务列表 core rule | — | — | — | ✅ |
| T3 表格横滚容器 + 配色 | — | — | — | ✅ |
| T4 AI 卡片判定放宽 | — | — | — | ✅ |
| T5 折叠不切块（`pickFoldHeight`） | — | — | — | ✅ |
| T6 30 条用例页（已建，**待自测**） | — | — | — | 🚧 |
| T7 依赖补齐 + `ZXMarkwonFactory` 收敛 | — | ✅ | — | — |
| T8 AST 切段器 | — | ✅ | — | — |
| T9 可横滚表格控件 | — | ✅ | — | — |
| T10 段栈容器 + 按段折叠 | — | ✅ | — | — |
| T11 气泡接段栈 + 折叠改造 | — | ✅ | — | — |
| T12 31 条用例页（已建，**待自测**） | — | 🚧 | — | — |
| T13 收尾（impl-notes + status） | — | ✅ | — | ✅ |
| T14 三端样式统一（token 表落地，**运行时未验**） | — | ✅ | ✅ | ✅ |
| T15 表格/段栈长按弹窗修复（计划外，**真机未验**） | — | 🚧 | — | — |

> ✅ 的判据是**代码写完 + 编译通过**（PC：`npm run lint` 干净 + vitest 23 条全绿；安卓：`assembleDevelopDebug` BUILD SUCCESSFUL）。
> **不含任何运行时验证**——表格横滚、折叠不切块、长按不被吞、配色观感，一眼都没看过。

## 本次代码量

| 端 | commit | 内容 |
|----|--------|------|
| desktop | `180e0d6c` → `d7f27ca9` → `5c8f4cb8` → `cee18ade` → `f2c3ab8b` → `f2a7d5f6` | 6 个 |
| android | `08a0a2c05` → `6553d4b19` → `786d1d50d` → `db3fc34dd` → `203f01126` → `e92542ee3` | 6 个 |

**PC 新增单测 35 条**（`markdown-render.spec.js` 23 + `markdown-fold-model.spec.js` 12），全绿。安卓无单测（工程本来就没有）。

**安卓新增 4 个类**：`ZXMarkwonFactory`（配置收敛 + 兜底 + 开关）、`ZXMarkdownSegment` / `ZXMarkdownSegmenter`（AST 切段）、`ZXMarkdownTableView`（横滚表格）、`ZXMarkdownContentView`（段栈 + 按段折叠）。

## 2026-08-27 安卓同分支旁路：mention 整条回退（已 push `4439ae468`）

`feat/gfm-markdown` 上除 GFM 外还搭着一摊 mention 改动（`9db9de690` 复制@个人粘贴按实际 belongId 补 `agentKind`）。该提交导致**个人智能体发送后端不认**，本次整条 revert 并 push。与 GFM 无关，但同分支，记在这里免得下次翻分支时困惑。

**根因**：`extra.atUserList` 是三端硬契约，只允许 `atUserId / atUserName / startIndex / endIndex`——iOS `ZXRCIMBaseChatController+SendMessage.m:1236-1240`、desktop `send-box.vue:1588-1593` 都只有这四个。`9db9de690` 单方面多塞 `agentKind` / `agentId`，只有安卓这条链路与另两端不同构。真机验证：回退后 @个人AI框 发送恢复正常。

**对 markdown 无影响**，三条证据：

1. 相对 HEAD 全是删除、零新增：`8 files changed, 412 deletions(-)`
2. 文件集与 markdown 那串提交（`a092b0c3c` ~ `9c62212a1`，21 个文件）只在 `ConversationFragment.java` 相交，而该文件只差两行——`:1855-1856` 的 `setAgentKind` / `setAgentId`，位置在发送 extra 的 `atUserList` 组装处，与渲染无关
3. `:IM:testOnTestDebugUnitTest` 16/16 绿：`AgentMarkdownPreprocessorTest` 3 + `SpanTagHandlerTest` 10 + `VerticalCenterBackgroundSpanTest` 3

**回退的代价**（归 `20260728-安卓端@个人AI框`）：复制一条带 @个人AI 的消息再粘贴，个人 AI 重新被识别成群智能体——`fillMissingAgentKind` 那套按缓存补 kind 一并退掉，待另找不改 extra 的方案。

**顺带查实的坑**：`aiRobtChat` 的业务错误码被完全吞掉——`ConversationFragmentParent.java:219-221` 的 `onSuccess` 拿着 `JsonObjectResult.getCode()` / `getMsg()` 一个都没读，后端报错客户端零提示。下次查智能体链路先补日志再猜。

**本轮出的包**（均基于回退后代码）：`zx-android-test_v3.6.21.apk`（onTest debug，88.4 MB）、`zx-android-prod_v3.6.21.apk`（publish release，77.7 MB）。**2026-08-27 午后**另出 `zx-android-prod_v3.6.22.apk`（publish release，约 78 MB，tip `a3934d51f`；构建时工作区带脏 `ZXMarkdownTableView` → 包内**可能已含**部分 T15）。该包已装真机 `2509FPN0BC`，**功能未验**。完整 T15（含段栈代判）在之后的 `4a283b741`，**未打进该 v3.6.22 包**。

## 各端工作区现状（2026-08-27 傍晚 T15 push，`apps/android`）

安卓 `feat/gfm-markdown` 干净、synced。T15 已 push `4a283b741`。真机未验；v3.6.22 装机包仍停在 `a3934d51f`。

## 各端工作区现状（2026-08-27 傍晚收尾，`scripts/code-status.sh`）

**本回合零编码**（会话只有一句打招呼）。stop hook 由上一回合遗留的 apps 脏区触发，各端状态与下方「下午收尾」快照完全一致：安卓 T15 两文件仍未提交、未真机验；desktop 仍 behind 1、脏区仍是禁提交三件套。唯一变化是 context 自身文档提交推进（ahead 271→272，脏 24→26，多出 `迭代.md` 等笔记）。

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 272 | 脏 26（脚本/commands/笔记） | 本功能只改本 status | tip `d97c714`。打包脚本 / `pack.md` / `pnpm-lock` / 根目录周五总结与 `迭代.md` **勿并入本 commit** |
| web | `feat/web-markdown-table-align-pc` | synced | 干净 | 旁路 | tip `f5616c5` |
| android | **`feat/gfm-markdown`** | synced | **脏 2** | **本功能 T15** | `ZXMarkdownTableView.java` + `ZXMarkdownContentView.java`（+118/−2）。文字段 `LinkMovementMethod` 同样吞 DOWN，段栈 `dispatchTouchEvent` 旁观代判长按再 `performLongClick`。**未提交、真机未验**。tip `a3934d51f`（v3.6.22） |
| ios | `master-3.5.31` | synced | 干净 | 旁路 | GFM 已合进主干（`16146b73f`） |
| desktop | `feat/gfm-markdown` | **behind 1** | 脏 3 | 本功能分支 | 仍是 `.env.test` / `electron-builder.yml` / `package.json` **禁止提交**；远端多 `5213e645`，本地 tip `41c5caf9` |
| action-center | `release` | synced | 脏 7 | **旁路** | 仅删 `@tiptap-pro/extension-unique-id/dist/*`，勿 stage。根目录 `周五总结-*-版本字段汇总.md` 是查阅笔记，不属本功能 |
| meeting | `fix/meeting-full-app-gaps` | 无 upstream | 脏多 | **旁路** | 预订/房间/助手，非 GFM |

## 各端工作区现状（2026-08-27 午收尾，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 269 | 脏 23 | 本功能文档 | 打包脚本 / commands 与本功能无关；`meeting-agent` 文档在 `b88459b`，勿混提交 |
| web | `feat/web-markdown-table-align-pc` | synced | 干净 | 旁路 | tip `f5616c5` |
| android | **`feat/gfm-markdown`** | synced | **脏 1** | **本功能** | `ZXMarkdownTableView.java` = T15 长按修复，**未提交**。tip `a3934d51f`（v3.6.22 / versionCode 299） |
| ios | `master-3.5.31` | synced | 干净 | 旁路 | GFM 已合进主干（`16146b73f`） |
| desktop | `feat/gfm-markdown` | **behind 1** | 脏 3 | 本功能分支 | 脏区 `.env.test` / `electron-builder.yml` / `package.json` **禁止提交**；远端多 `5213e645`（v3.4.26），本地 tip `41c5caf9` |
| action-center | `release` | synced | 脏 7 | **旁路** | 删 `@tiptap-pro/extension-unique-id/dist/*`，勿 stage |
| meeting | `fix/meeting-full-app-gaps` | — | 脏 39 | **旁路** | 会议室基建/助手，非 GFM |

## 各端工作区现状（2026-08-25，`scripts/code-status.sh --short`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 245 | 脏 26 | 本功能 status | 打包脚本 / commands 与本功能无关，勿一并提交 |
| web | `feat/web-markdown-table-align-pc` | synced | 干净 | 旁路 | 波浪下划线 + 对比度已 push |
| android | **`feat/gfm-markdown`** | synced | 脏 12 | 本功能 + 旁路 | 本回合修引用里高亮左偏。提交 GFM 时不要带 `MentionAgentKindResolver` |
| ios | `feat/ios-file-download-progress` | synced | 脏 11 | 旁路（色表同步） | 本回合色表 `green:008000`，GFM 已合进该分支 |
| desktop | **`feat/gfm-markdown`** | synced | 脏 3 | **本功能** | 表格宽度已 push `d987d746`（详情属 `20260820`）。剩 `.env.test` / `electron-builder.yml` / `package.json` **禁止提交** |

## 各端工作区现状（2026-08-24，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 204 | 脏（打包脚本/commands 与本功能无关；本功能文档已改） | 文档更新 | — |
| web | `feat/web-markdown-table-align-pc` | synced | 脏 1 | 旁路 | `AcMarkdown` 行内代码样式，与表格无关 |
| android | **`feat/gfm-markdown`** | **synced** | **脏 7** | **本功能分支 + 旁路** | GFM 引用前缀+表格（5）**加上**粘贴个人 `@` 误识别为群（`MentionAgentKindResolver` 等，见 `20260728-安卓端@个人AI框`）。**提交 GFM 时不要带上 mention 那几份。** tip `8275a307c` |
| ios | `feat/ios-file-download-progress` | synced | 干净 | 旁路 | — |
| desktop | **`feat/gfm-markdown`** | synced | 脏 3 | **本功能分支** | `.env.test` / `electron-builder.yml` / `package.json` **禁止提交** |

## 各端工作区现状（2026-08-17 历史快照）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 125 | 干净 | 本次落自测反馈与修复 | `context/design/markdown-style-tokens.md` 是三端样式唯一事实来源 |
| web | `feat/data-scope-secret-tag` | synced | 脏 2 | **不涉及** | 标题栏涉密按钮黄色已 push `749d1f3`，属 `20260812-数据范围-涉密标签`。脏区是下方「旁路改动」的 `hideChat` 显隐，**未提交** |
| android | **`feat/gfm-markdown`** | **无 upstream** | 干净 | **本功能分支** | 最新 `d175966e7`（表格列宽）。会话中途该仓库曾被切到 `personal-ai-chat-hotfix`（停在 `1b97741e4`），我切回 GFM 分支才改的。两条分支均未 push |
| ios | **`feat/ios-gfm-markdown`** | ahead 2 | 干净 | **本轮一起改了样式** | 最新 `0e37761d3`（自测修复，未 push）。从 `master-3.5.30` 切过来的，切前把本地脏的 `project.pbxproj` 排序噪声 **stash 了，回主干记得 pop** |
| desktop | **`feat/gfm-markdown`** | **ahead 10**（含 merge `origin/release`，未 push） | 干净（merge 当下） | **本功能分支** | 最新 `5dc75dbc` 合入 `origin/release`（版本号跟到 `3.4.25`）。冲突只在 `msg-actioncard.vue`：release 的 h2 `17x→17px` 被本分支全局 `markdown.scss` 覆盖。本地调试文件仍**禁止提交** |

> **工具脚本（与本功能无关，记录备查）**：2026-08-14 新增 `scripts/prod-pc-build.mjs` / `prod-android-build.mjs`。2026-08-17 优化 `scripts/pc-build-test.mjs`：TTY 阶段进度条、webpack/electron-builder 实时流式输出、默认 `compression=normal`、Electron 已是 arm64 则跳过重装、sqlite3/leveldown 并行编译。安卓正式包任务**必须带 `:smart_message:` 模块前缀**——无前缀会给 IM / basis_function_api 等 library 也打 release，触发 `verifyPublishReleaseResources` 孤立资源校验，library 引用 app 模块 drawable 必挂。

## 三端 UI 样式一致性审计（2026-08-17，只读代码，未改任何代码）

三端 GFM 语法都能识别、表格都能横滚之后，样式观感仍不统一。**根因：三端各自吃了各自框架的默认值**，当初只刻意对齐过表格配色（4% 黑表头 / 12% 黑边框）。正文色三端一致（`#1F2329`，iOS `Color_H1` = `1F2329`）。

### drift 的三个源头

| # | 源头 | 落点 | 带来的默认值 |
|---|------|------|-------------|
| 1 | **PC 挂着 `prose`**（UnoCSS `presetTypography` 0.50） | `msg-actioncard.vue:58` | `:not(pre) > code::before/after { content: "\`" }` → **行内代码带反引号**；`tr:nth-child(2n)` → **表格斑马纹**；`blockquote{font-style:italic}` → **引用斜体**；`p,ul,ol,pre{line-height:1.75}`；h1/h2 一堆 em 边距（h5/h6 没有，标题间距不匀）。**另两端都没有前三条** |
| 2 | **安卓从没配 `MarkwonTheme`** | `ZXMarkwonFactory.java:85` 只设了 table 主题 | 反编译 `core-4.6.2` 确认：`HEADING_SIZES={2,1.5,1.17,1,.83,.67}` → 15sp 正文下 **H1=30sp、H6=10sp**；H1/H2 自带 `headingBreakHeight=1` 横线；行内代码/代码块底色 = 正文色 25% alpha；引用竖条 25% alpha 且不变字色；链接色 = 主题 `textColorLink`（从没显式设过） |
| 3 | **安卓段栈丢了行距（这条算 bug）** | `ZXMarkdownContentView.java:117` `newSegmentTextView()` | `rc_item_action_card_message.xml:72` 的 `tv_content` 有 `lineSpacingExtra=5dp`，段栈新建的 TextView 没设，`addView` 也没给 margin → **同一会话里含表格的消息行距比不含表格的窄，段间无间距** |

### 逐项差异（基准：PC 13px / 安卓 15sp / iOS 16pt）

| 项 | PC | 安卓 | iOS |
|---|---|---|---|
| 标题 H1–H6 | 18/17/16/15/14/13 px | 30/22.5/17.6/15/12.5/10 sp（默认倍率） | 22/20/18/16/15/14 pt |
| H1/H2 下横线 | 无 | **有** | 无 |
| 行距 | 1.75em | 1.33em（**段栈里 1.0**） | +6pt ≈ 1.37em |
| 段间距 | 1em | Markwon 空行 + 段栈 0 | 6pt（`paragraphSpacing`） |
| 行内代码 | **带反引号**、.875em、600、透明底 | 25% alpha 底 | `#F5F6F7` 底、Menlo、base−1 |
| 代码块 | padding 1.25rem/1.5rem、圆角 6、透明底 | 25% alpha 底、8dp margin | `#F5F6F7` 底、缩进 12 |
| 引用 | .25em 左边框 + **斜体** + 1em padding | 2dp 竖条、字色不变 | `▎` 字符 + 45% 白字色 + 缩进 12 |
| 列表缩进 / marker | 1.25em、各级同 disc | Markwon span、圆/空心/方 | 18pt/级、`•`/`◦`/`▪` |
| 任务列表 | 原生 `<input type=checkbox disabled>`（系统灰方框） | `TaskListPlugin` drawable（主题色） | `☑`/`☐` 字符 |
| 链接 | `#3E7EFF` 无下划线 | 主题 `textColorLink`（未设） | `#006AFF` |
| hr | 1px `#e7e7e7` + 2em margin | 25% alpha 黑 | 空行画删除线，12% 黑 |
| 表格 cell padding | 4/8 px | **8/4 dp（横竖反了）** | 8/8 pt |
| 表格边框 | 1px 无圆角 | 每格 1px → **相邻格叠成 2px**，无圆角 | 0.5px 外框 + 圆角 4 |
| 最大列宽 | 无上限 + `white-space:nowrap`（**永不换行**） | 220dp 后换行 | 160pt 后换行 |
| 斑马纹 | **有** | 无 | 无 |

### 落地情况（2026-08-17 已按下述方案改完，见文末「样式统一改动清单」）

**绝对数值不对齐**（13px/15sp/16pt 是各端既有正文规格，硬对齐反而不对齐观感），对齐的是**相对基准字号的倍率 + 颜色 + 结构**。

已建 `context/design/markdown-style-tokens.md` 作唯一事实来源，三端照抄：

| token | 值 |
|---|---|
| 标题倍率 | 1.40 / 1.25 / 1.15 / 1.08 / 1.00 / 1.00，全部粗体（H5/H6 不缩小，靠加粗区分——现在 iOS/安卓的 H5/H6 比正文还小，像降级正文） |
| 标题横线 / 边距 | 无横线（安卓 `headingBreakHeight(0)`）；上 0.75em 下 0.35em |
| 行距 / 段间距 | 1.4em / 0.5em |
| 正文色 / 链接色 | `#1F2329` / `#3E7EFF` 无下划线（iOS 从 `#006AFF` 改，安卓显式设） |
| 行内代码 | 底 `rgba(0,0,0,.06)`、圆角 2、0.92em、等宽、**无反引号** |
| 代码块 | 底 `rgba(0,0,0,.04)`、圆角 4、padding 8/10、0.92em、不做高亮 |
| 引用 | 左竖条 2px `rgba(0,0,0,.2)`、字色 `#5D616B`、**不斜体**、左内边距 8 |
| 列表 | 缩进 1.2em/级，marker 三级 disc / circle / square |
| 任务列表 | 1em 蓝色勾选方框（primary）——三端都做成勾选框外观，iOS 的字符染 primary |
| hr | 1px `rgba(0,0,0,.12)`，上下 0.75em |
| 表格 | cell padding 竖 0.35em 横 0.6em；表头 4% 黑 + 粗体；边框 1px 12% 黑；**无圆角、无斑马纹**；最大列宽 12em 后换行 |

各端落点：

- **PC**（2 文件）：`msg-actioncard.vue:58` **去掉 `prose`**，把 `:700–768` 的非 scoped style 扩成完整一套（约 +50 行）。留 prose 再逐条覆盖也行，但 preset 升版还会飘。顺带解决 spec 第 8 节遗留第 4 条：这段样式提到全局 scss，让 `message-info.vue` / `msg-reply-poll.vue` 一起吃到。`th/td` 去掉 `nowrap`，改 `max-width:12em` + 允许换行
- **安卓**（3 文件）：`ZXMarkwonFactory` 加 `AbstractMarkwonPlugin.configureTheme()` 设标题倍率 / `headingBreakHeight(0)` / code 与 blockQuote 配色 / `linkColor` / `bulletWidth`，`TaskListPlugin.create(...)` 传 primary；`ZXMarkdownContentView:117` 补行距 + 段间 `topMargin`；`ZXMarkdownTableView:95` padding 横竖改回来，边框改成每格只画右+下、容器画左+上（消双线）
- **iOS**（1 文件，在 `feat/ios-gfm-markdown` 分支）：`ZXMarkdownStyle.m` 本来就是集中式样式表，改常量即可——`headerFontSizes` 按倍率重算（16pt 基准 → 22/20/18/17/16/16）、`linkColor` 改 primary、引用字色改 `#5D616B`、`tableCellPadding` 拆横/竖两个、表格去圆角、`tableMaxColumnWidth` 160→192

> iOS 的 `ZXMarkdownStyle` 是三端里结构最好的，建议当模板：安卓与 PC 也各收敛出一个「样式常量入口」（安卓一个 `configureTheme` 块、PC 一段 scss 变量），以后改一处不用翻三处。

**顺序**：先跑完下面「下一步全是运行时自测」那批，**再动样式**。现在两端改动只到「编译通过」，样式与功能混一起改，回归时分不清谁的锅。样式改完后三端用例页各截一遍并排比对，再一起删用例页。

## 安卓真机首轮自测暴露的问题（2026-08-14，已修复，待复验）

| # | 症状 | 根因 | 处理 | commit |
|---|------|------|------|--------|
| 1 | 表格**有格子没文字**（表头背景色可见、单元格被 padding 撑出大小，文字全空） | `Table.parse(markwon, block)` 传的是**带 `TablePlugin` 的实例**。该插件注册的 `NodeVisitor<TableCell>` 会把单元格文本渲进 builder 后**再抽走**存成 `TableRowSpan.Cell`（span 表格的拼法），于是 `markwon.render(tableCell)` 拿回来永远是空 | 新增 `ZXMarkwonFactory.createForTableCell()`：同样插件表但**不装 TablePlugin**，专供 `Table.parse` 渲染单元格 | `df460e27c` |
| 2 | 表格无边框线 | `TABLE_BORDER` 常量定义了却从未使用，只设了表头背景色。`TableTheme` 的 border 只作用于 Markwon 的 span 表格，段栈路径完全绕开 | 每格一个 `GradientDrawable` 带 1px stroke；顺带补显式 `TableRow.LayoutParams`（原来吃默认的 `MATCH_PARENT`） | `df460e27c` |
| 3 | 卡片高度失控：收起了一部分内容，但卡片仍极高，滚很久才到消息顶部 | `applyFold()` 里的 `i > 0` 守卫。「第一块超限高则整块显示不切」这条规则的本意是**不可分割的块**（表格/图片）不切一半，我对所有段一律套用；而安卓的富文本段是**多个块合并成的一个 TextView**，AI 长回复第一段就几千 px，于是整段免疫折叠，只收起了后面的表格和知识来源 | 折叠区分两类段：富文本段（TextView）**可切**，按剩余高度 `setMaxHeight` 截断；表格段**不可切**，放不下整段隐藏（仅当它是第一段且超限时才整块显示） | `df460e27c` |
| 4 | **消息列表无法往上滚，一直被拽回底部**（严重） | `TextView.setMovementMethod()` 内部执行 `fixFocusableAndClickableSettings()`，把 focusable / clickable / longClickable **一并强制设回 true**。我在 `newSegmentTextView()` 里设的 false 在 `setMovementMethod()` **之前**，全部作废。加上 `HorizontalScrollView` 构造函数自带 `setFocusable(true)` → 段栈每个子 View 都可获焦 → RecyclerView 布局时 `requestChildFocus` 把它滚进可视区 → 往上滚被反复拽回 | 段栈 `setDescendantFocusability(FOCUS_BLOCK_DESCENDANTS)` 一刀切断；表格控件显式 `setFocusable(false)` + `setScrollContainer(false)`；TextView 抽出 `disableFocusAndLongClick()`，**在 `setMovementMethod()` 之后**调用 | `7b9f7872c` |

> 第 4 条**顺带修掉了另一个还没测到的问题**：`longClickable` 被打回 true 后，含表格的消息长按弹不出转发/回复菜单——正是先前标为「段栈最容易翻车」的那条。
>
> 链接点击不受影响：`LinkMovementMethod` 在 `onTouchEvent` 里先于 clickable 判定处理事件，按在链接上会被消费，按在空白处冒泡给气泡。

## 安卓自测反馈（2026-08-19）：右侧「收起内容」高度不对

| # | 症状 | 根因 | 处理 |
|---|------|------|------|
| 5 | 展开含表格的 markdown 后，点会话页**右侧「收起内容」**，卡片几乎不矮（「查看更多」出现在超高气泡底部） | 气泡内收起走了 `mdContentStack.applyFold(true, 480dp)`，右侧快捷按钮走 `defaultModuleLongMessageContentExpandOrFold`，后者只 `tv_content.setMaxHeight`。含表格时 `tv_content` 是 GONE、正文在段栈上，所以高度不动 | 该方法按段栈是否可见分流，与气泡内展开/收起同一套 `applyFold`。`:IM:compileDevelopDebugJavaWithJavac` 绿。**未提交、未真机验** |

> 无表格的 markdown 仍走单 `TextView`，这条路径原来就会收，观感应与改前一致。

## PC 自测反馈（2026-08-19）：markdown 消息折叠高度过矮

截图两条智能体卡片：「群内@我的消息整理」底部「二、我已回复」被遮罩削掉一截；「GitHub Trending」几乎只剩蓝标题 +「查看更多」，正文看不见。

| # | 症状 | 根因 | 处理 |
|---|------|------|------|
| 6 | 折叠态高度远低于 400px：短标题/前言后面跟长列表或宽表时，卡片几乎被「查看更多」占满 | `pickFoldHeight` 把每个顶层 DOM 节点都当不可切整块。`<h2>` 很矮、后面整段 `<ol>` / 表格超限 → 整块藏掉，裁剪高度停在标题底（~80–96px）。安卓 issue #3 是同一条规则用在粗粒度段上卡片**过高**；PC 粒度细，同样的规则会卡片**过矮** | 先改成标题/列表可切。复验后仍不一致（见 #7） |
| 7 | 第一条（带表）折叠卡片明显高于第二条（带列表） | 按块取舍：带表停在第一张表底边（~278px 或整表撑开），带列表裁到 400px。两条真实消息结构不同，折叠高度就不同 | **超限一律 `max-height: 400px`**，不再按块边界取不同高度。表格可能被切到。`markdown-fold-model` 12/12 绿。**未在会话里复验** |

## PC 自测反馈（2026-08-20）：知识来源角标另起一行

真实样本：Eric「报销」智能体回复（正文大量 `<reference data-ref="…"></reference>` 单独成行，例如白名单节末的 `_agent_file_doc_id_2056623120894918866`）。

| # | 症状 | 根因 | 处理 |
|---|------|------|------|
| 8 | 角标应该贴着前文（行内 `[1]`），实际换到下一行；连续两个角标还被 `breaks: true` 拆成 `<br>` | 后端常把 `<reference>` 单独放一行。进解析器后自成 `<p>` 或变成 `<br>`。安卓 / iOS 解析前会把标签前的换行折掉，PC 漏了这一步。另外：折到表格行尾 `|` 后面时，GFM 当行尾垃圾丢掉，角标会消失 | 解析前折叠：标签贴到前一个非空白字符；连续标签之间的换行也吃掉；表格后的标签塞进最后一个单元格（吃掉行尾 `\|`）。`markdown-render` 23/23 绿。**待会话复验该条报销消息** |

## 安卓自测反馈（2026-08-24）：引用前缀后的表格没有表格样式

真实样本：群里 @个人 AI 框「生成 md 的表格」，智能体回 `ZX:ActionCardMsg`，正文整篇是 GFM 表，且带 `referMsg`。

| # | 症状 | 根因 | 处理 |
|---|------|------|------|
| 9 | 安卓气泡里表格是管道符原文，没有表头底/边框/分列 | GFM 规定表格不能打断段落。安卓把「回复 @xxx：」用单个 `\n` 拼进 markdown 源，前缀与表并成同一段落，解析不出 `TableBlock`，段栈判定 `hasTable=false`，整篇当纯文本。PC 把前缀放在 markdown 容器外面，所以同条消息 PC 正常 | `joinReplyPrefix` 改为 `\n\n`；卡片两入口 + 流式座位三处共用。单测 3/3 先红后绿。**真机未验** |

## 待办 / 阻塞

- (android) **T15 真机复验（优先）**：代码已在 `4a283b741`。装机包 `zx-android-prod_v3.6.22` 仍是 `a3934d51f`，**不含段栈代判**。需重出包含 `4a283b741` 的包再验 issue #10：① 长按表格区弹菜单 ② 长按**段栈文字区**（含链接空白处）也能弹、且只弹一次 ③ 横滚中途松手不误弹 ④ 表格上纵滑列表不误弹。
- (desktop) `feat/gfm-markdown` **behind 1**（origin `5213e645` v3.4.26），pull 前确认本地调试三件套不 stage。
- (android) **真机验 #9**：装当前 `feat/gfm-markdown` 包，打开那条带 `referMsg` 的智能体表格回复，应出现可横滚表格（表头底 + 边框），「回复 @xxx：」在表上方单独一行。无表格的 @ 回复回归一次（前缀与正文之间会多一段间距，对齐 PC 把前缀放在 markdown 外）。
- (android) 2026-08-24 仓库在 `feat/gfm-markdown`（origin 同步）。#9 的 5 个文件**未提交**。收纳组未提交改动已丢弃，不并入本分支。
- (android) **真机验 ActionCard HTML 高亮**：群机器人 `ZX:ActionCardMsg` 正文含 `<mark style="background:…">` 与 `span` 的 `background-color` / `background`。PC 正确；修前安卓无底色（`SpanTagHandler` 只上前景色，且 `color:` 正则会误吃 `background-color`）。代码已改，`SpanTagHandlerTest` 7/7。**与 `MentionAgentKindResolver` 不要混提交。**
- (android) 2026-08-25 **高亮背景偏下、没有上下居中**。根因：`lineSpacingExtra = 6dp` 加在字下面，系统 `BackgroundColorSpan` 按整行 top~bottom 填色。已换成按 `baseline+ascent ~ baseline+descent` 自绘的 `VerticalCenterBackgroundSpan`（`LineBackgroundSpan`，可折行；不要用 `ReplacementSpan`）。`SpanTagHandlerTest` + `VerticalCenterBackgroundSpanTest` 共 8 条绿。**真机未验**。提交只带 `SpanTagHandler` / `VerticalCenterBackgroundSpan` / 对应单测 / `IM/build.gradle` 的 junit，不要带 mention 与 #9 引用前缀那几份。
- (android) 2026-08-25 **波浪下划线**：`text-decoration: underline wavy` / `text-decoration-style: wavy` 原先只认 `line-through`。已加 `WavyUnderlineSpan`（`LineBackgroundSpan` 自绘正弦波），`SpanTagHandler` 接管 `u`/`ins`。自己发的淡蓝气泡上，表格边框 12%→22%、代码块 4%→10%、引用竖条 20%→28%。`SpanTagHandlerTest` 9/9。**真机未验**。提交不要带 `MentionAgentKindResolver`。
- (android) 2026-08-25 **`color:green` 过亮**：命名色表把 `green` 写成系统 `Color.GREEN`（`#00FF00`，等于 CSS `lime`），PC/浏览器是 CSS `#008000`。已改成 `#008000`，`lime` 仍是 `#00FF00`。`SpanTagHandlerTest` 9/9（含 `namedGreenIsCssGreenNotAndroidLime`）。**真机未验**。提交仍不要带 `MentionAgentKindResolver`。
- (android) 2026-08-25 **引用里高亮左偏约一个字**（用户发的 HTML 样式示例，引用段「加粗、高亮、蓝色文字」）。根因：自绘行背景用「行左缘 + 行首到高亮的文字宽」当 x，没加引用/列表的块级缩进（约 18dp，看起来就是往左错一个汉字）。同一刀修了波浪下划线。顺带：引用整段字色挂在子节点之后且 priority=0，会盖掉引用里的 `color:blue`。字色改成高 priority，让行内颜色后 apply。`SpanTagHandlerTest` 10/10 + `VerticalCenterBackgroundSpanTest` 3/3。**真机未验**。提交不要带 `MentionAgentKindResolver`。
- (desktop) 2026-08-26 表格宽度对齐 web 已 push `d987d746`：去掉单元格 `min-width:375px`，只留 `max-width:375px`；markdown 根从 `!max-w-[max-content]` 改成 `min-w-0 max-w-full`；会话气泡链补 `min-width:0; max-width:100%`。**请热更新看窄表不再撑开、宽表表内横滚。** 详情属 `20260820-web端的-markdown对其pc，你先收集信息`。
- (desktop) 2026-08-25 **自己发的淡蓝气泡看不清引用 / 表格线 / 代码块**。根因不是解析器：`` `code` `` 一直渲成 `<code>`；是 token 还停在 4%/6%/12%/20%，叠在 `#d7e5ff` 上几乎看不见，看起来像「不支持行内代码」。已对齐 token：行内代码 8%、代码块 10%、引用竖条 28%、表头 8%、边框 22%。卡片顶部 `referMsg` 与普通回复引用条（`#c9cfd8` / `#8f959e`）在自己发气泡上同样洗掉，改成同一套 28% 黑 / `#5D616B`。已在 `f899e7e1`。**请热更新后看自己发的那条。**

### PC 已本地合入 `origin/release`（2026-08-18，未 push）

GitLab「把 release 合进 feat/gfm-markdown」已做完：`git fetch origin` + `git merge --no-ff origin/release`。

- 唯一冲突：`msg-actioncard.vue` 的 `.md-html-wrapper` 样式块。release 只修了 h2 笔误 `17x → 17px`；本分支早已把整套样式迁到 `assets/styles/markdown.scss`（h2 = `1.25em`，相对 13px 正文）。**保留本分支**，没有把旧样式块写回去。
- 顺带吃进 release 的 `package.json` 版本号 `3.4.24 → 3.4.25`。
- 验证：冲突标记已清；该 vue 文件 eslint 通过；markdown 相关 23 条单测全绿。
- **未执行** `git push origin feat/gfm-markdown`（等你确认后再推）。


### 旁路改动：web 设置页 `hideChat` 显隐（2026-08-17，与本功能无关，勿并入本功能）

问答设置「知识可调用范围」按 `getAgentSetInfo` 回参 `hideChat === 1` 隐藏「调用聊天记录」「调用聊天文件」两项 **与「全部」勾选框**（只前端显隐，`dataRangeList` 已保存 status 与保存 payload 都不动）。

- `useSettingData.js` 的 `getAgentBelongs` 补透出 `hideChat`（原来这字段在回参里被丢掉）；`KnowledgeQASet.vue` 加 `hideChat` / `visibleRanges` computed
- 契约 `contracts/personalAiFrame/getAgentSetInfo.d.ts` 早已有 `hideChat`，无需改契约
- 验证：`vue-tsc --noEmit` 干净；**未运行时验证**（需后端给 `hideChat=1` 的数据）。`pnpm format` 跑不了——web 仓库 `node_modules` 里没装 prettier
- 归属：Agent 设置域，属于 `hideChat` 那批遗留改动（见 `20260812-数据范围-涉密标签/status.md` 的旁路记录），**未 commit**，留给对应负责人

### ✅ 已解决：安卓「点击登录后崩溃退出」（2026-08-17，与本功能无关）

**结论：不是 GFM 改动引起的，是 greenDAO 转换器的既有 bug。** 真机验证已通过（修复包装机后登录不再崩）。

**崩溃**
```
java.lang.IllegalArgumentException: the bind value at index 71 is null
  at greendao.bean_dao.ChatMessageAsRouteDao.bindValues(ChatMessageAsRouteDao.java:887)
  at greendao.util.DataCenter.saveDialogueLastMessageFromServer(DataCenter.java:2041)
  at com.cnmts.smart_message.login.InitPersonalDataActivity$5.onSuccess(InitPersonalDataActivity.java:334)
```

**根因**：greenDAO 生成的 `bindValues` 只判 `list != null` 就调 `bindString`，而 `KnowledgeDocConverter.convertToDatabaseValue` 对**非 null 的空列表**返回 null（`if (entityProperty == null || entityProperty.size() == 0) return null;`），空列表穿过 null 守卫后 `bindString(71, null)` 直接抛。登录后 `InitPersonalDataActivity` 拉会话最后一条消息入库时触发。

**为什么只有正式包崩**：与 buildType / 混淆 / 签名全都无关（release 的 `minifyEnabled` 本就是 false）。纯粹是正式环境某条会话的最后一条消息带了**空的** `knowledgeDocList`，测试环境的样本不为空，碰不到这条边界。

**为什么难查**：App 自己的 `com.cnmts.smart_message.common.crash_handler.CrashHandler` 捕获后直接 `App.killProcess()`，非 debug 分支**不打堆栈**，logcat 里连 `FATAL EXCEPTION` 都没有，只有一行 `Process is going to kill itself!`。真堆栈落在手机 `/sdcard/ZhiXin/Log/crash/crash-<yyyyMMdd_HHmmss>.txt`（路径来自 `SDCardUtils.getCrashReportPath()`）。**这条排查经验已写进 `context/platforms/android.md`。**

**修复**（commit `1b97741e4` on `personal-ai-chat-hotfix`，已 merge 进 `feat/gfm-markdown` = `856b176cc`，**两条分支都未 push**）：
- `KnowledgeDocConverter`：空列表序列化成 `"[]"`，只有 null 才返回 null
- `AccountStartConverter`：同源隐患一并修（`AccountAppraisingDao.bindValues` 同样只判 null，尚未爆但迟早）
- 新增两个转换器单测共 8 条（先写先跑红：3 条空列表断言 FAILED → 改完全绿）；`base_data/build.gradle` 补 `testImplementation 'junit:junit:4.12'`（该模块原先无 test 依赖）
- 已审计 `base_data` 下全部 19 个 `PropertyConverter`，有此 bug 的**只有这两个**；`BtnDataConverter`（管 69/70 两列）等其余均只在入参为 null 时返回 null，安全

**验证**：`:base_data:testDebugUnitTest` 8/8 绿；`:smart_message:assembleDevelopDebug` 与 `:smart_message:assemblePublishRelease` 均 BUILD SUCCESSFUL；正式包装真机复测登录**不再崩溃**。

**遗留**：排查期间为绕开 MIUI 覆盖安装限制，**卸载过一次** `com.cnmts.smart_message`，手机本地聊天缓存已清（登录后服务端重新同步）。合并 hotfix 后 GFM 分支版本号从 `295/v3.6.18` 跟到 `297/v3.6.20`。

### 安卓复验清单（新包 `smart_message-develop-debug_v3.6.18.apk`，`7b9f7872c`）

1. **消息列表上下滚动流畅**，尤其滚过含表格的消息（第 4 条）
2. 含表格消息**长按能弹转发/回复菜单**（第 4 条顺带修的）
3. 表格里的链接还能点（验证 `setClickable(false)` 没把链接点击一起关掉）
4. 表格文字与边框（第 1、2 条）
5. 长回复的折叠高度（第 3 条）

### 下一步全是运行时自测（我做不了，需要你跑）

- **(desktop，本轮优先)** 热更新或重启后看 Eric「报销」那条：各节末尾的 `[n]` 角标应贴着前文（白名单流程末尾两个角标连在一起），不要另起一行；表格最后一格可以带角标。折叠态仍应一样高（都是 400px）
- **(desktop)** `npm run dev:test` 起应用 → 访问 `#/debug/markdown` → 按 30 条用例逐条对照。重点：L4 checkbox 不显示原始括号、T4 三种对齐、T7 能横滚且不夺纵向滚动、I3 中文粘连不变斜体、I8 换行生效、H1 蓝字且保持粗体
- **(desktop)** ⚠️ **`breaks: true` 专项**：这是本轮唯一会改变**存量消息**排版的改动（当前单换行被吞成空格）。上线前拿至少 5 条真实存量消息对比开关前后
- **(desktop)** 复用点确认：`message-info.vue` / `msg-reply-poll.vue` 吃同一个 `convertMarkdownToHtml`，但表格样式写在 `msg-actioncard.vue` 的非 scoped style 里——**实测这两个组件里表格样式是否生效**，没生效就把 `.md-table-wrap` / `table` 那段提到全局 scss
- **(android)** 装 `smart_message-develop-debug_v3.6.18.apk` → `adb shell am start -n com.cnmts.smart_message.develop/com.im.debug.MarkdownGfmCasesActivity` → 逐条对照（31 条，比 PC 多一条删除线）
- **(android)** ⚠️ **段栈三个高风险点**，真实会话里必须验：①含表格的消息**长按能弹转发/回复菜单**（最容易翻车）；②表格横滚时上下滑动仍能滚会话列表；③折叠时表格不被切一半
- **(android)** 含表格长回复：先点「查看更多」展开，再点右侧「收起内容」——高度应回到约 480dp，与气泡内折叠按钮一致，不能仍是展开态。无表格长回复回归一次（单 TextView 路径）
- **(android)** View 复用验证：含表格消息与纯文本消息**交替滚动**，看有没有留白或串内容
- **(两端)** 真实样本三条：值班播报（内联 HTML 上色）、含表格 + 插图 + 角标的长回复、普通机器人卡片。两种气泡底色（自己发的淡蓝 / 收到的白）都看
- **(两端)** 自测通过后**删用例页**：PC 删 `components/debug/MarkdownGfmCases.vue` + router 那条；安卓删 `com/im/debug/MarkdownGfmCasesActivity.java` + manifest 那条

### 样式统一改动清单（2026-08-17 已提交，运行时全未验）

| 端 | commit | 文件 | 内容 | 验证到什么程度 |
|----|--------|------|------|---------------|
| desktop | `884ff628` | 4 | 新增全局 `assets/styles/markdown.scss` + `main.js` 引入；`msg-actioncard.vue` / `msg-reply-poll.vue` 去掉 `prose` 类并删掉组件内那份样式 | `npm run lint` 干净 + markdown 相关 23 条单测全绿 |
| android | `a092b0c3c` | 4 | `ZXMarkwonFactory` 加 `configureTheme` + `configureSpansFactory`（引用字色）；`ZXMarkdownContentView` 补行距 6dp / 段间距 7dp、折叠计入 topMargin；`ZXMarkdownTableView` padding 9/5、列宽 180dp、边框换 `EdgeLineDrawable`；布局 `tv_content` 行距 5dp→6dp | `:IM:assembleDevelopDebug` 与 `:smart_message:assembleDevelopDebug` 均 BUILD SUCCESSFUL |
| ios | `9e5437ee3` | 4 | `ZXMarkdownStyle` 标题改倍率、链接 primary、代码/引用配色拆开、缩进与段间距按字号折算、表格 padding 拆横竖 + 去圆角；`ZXMarkdownAttributedBuilder` / `ZXMarkdownTableView` 跟着改引用 | **未构建**（本仓库 CLAUDE.md 规定 AI 不跑 xcodebuild），只做了属性引用静态核对 |

**iOS 分支处理**：为改这些文件把 ios 仓库从 `master-3.5.30` 切到了 **`feat/ios-gfm-markdown`**（样式代码只在这条分支上）。切之前把本地脏的 `project.pbxproj` 用 `git stash push` 暂存了（那 16 行是 Xcode 的 entry 排序噪声）——**要回 `master-3.5.30` 时记得 `git stash pop`**。

### 样式第一轮自测反馈与修复（2026-08-17，第二轮待验）

| # | 端 | 反馈 | 根因 | commit |
|---|----|------|------|--------|
| 1 | PC | 待办勾选框颜色不对（灰的） | `<input disabled>` 被浏览器整体画灰，`accent-color` 在 disabled 态不生效 | `bf06e013` |
| 2 | PC | 窄表格挤，要横滚不要换行 | 上一轮把 `nowrap` 换成 `max-width: 12em` + 换行，方向错了 | `bf06e013` |
| 3 | iOS | 引用只有**第一行**左侧有竖线，应整段都有 | 竖条是 `▎` 字符逐行前缀，按逻辑行切，段落软换行后面几行没有行首 | `0e37761d3` |
| 4 | iOS | 无序列表一二级 marker 太小、三四级太大 | `•`/`◦`/`▪` 字面大小差得多，一律用正文字号 | `0e37761d3` |
| 5 | iOS | 待办勾选态比未勾选态大一圈 | `☐` 在系统字体里比 `☑` 小一圈 | `0e37761d3` |
| 6 | android | （你未测，预防性同步）表格列宽上限 180dp → 360dp | 与 PC / iOS 的「尽量不换行」同取向 | `d175966e7` |

**iOS 第 3 条的做法有结构性影响**：引用升格成独立块类型 `ZXMarkdownBlockTypeQuote`，用真视图画通高竖条。段栈进入判据从「含表格」扩成「含表格**或引用**」——**回归面从「含表格消息」扩到「含引用消息」**，二次自测要专门覆盖含引用的消息（折叠、长按菜单、图片回填、流式）。

**安卓分支提醒**：本会话开始时安卓仓库被切到 `personal-ai-chat-hotfix`，我切回了 `feat/gfm-markdown` 才改的。

**新增的三端样式自测项**（并入下面的运行时自测批次）：

1. **(PC 专项)** 去掉 `prose` 是本轮回归面最大的改动——`prose` 还提供了 `img/video max-width`、`figure`、`kbd`、`abbr` 等零散规则。真实消息里过一遍：行内代码**不再有反引号**、表格**没有斑马纹**、引用**不斜体**、长表格单元格**换行而不是把表格撑爆**
2. **(安卓)** 表格边框：任意两格之间只有一条线、整表四周也只有一条线（原来相邻格叠 2px）
3. **(安卓)** 含表格消息与纯文本消息**行距一致**（这次修的 bug）
4. **(安卓)** 折叠高度：段间距计入后，折叠态实际高度没超过 480dp
5. **(三端)** 同一条含 H1~H6 / 任务列表 / 引用 / 行内代码 / 表格的消息，三端并排截图比对
6. **(iOS)** iOS 的 GFM 用例页已在 `c4d50e28b` 删掉了，比对得用真实消息或临时再建一个

### 安卓自测反馈（2026-08-27）：表格区域长按弹不出操作菜单

| # | 症状 | 根因 | 处理 |
|---|------|------|------|
| 10 | 含表格的 markdown 消息，长按**表格区域**弹不出转发/回复菜单；同一条消息长按文字区域正常 | `ZXMarkdownTableView` 继承 `HorizontalScrollView`，其 `onTouchEvent` 自处理全部触摸、**从不调 `super.onTouchEvent`**：既不看 `clickable`/`longClickable`（`:73` 那句 `setLongClickable(false)` 无效），`View.checkForLongClick` 也永远排不上，末尾还无条件 `return true` 把 DOWN 吞掉 → 气泡根的长按监听（`MessageListAdapter:620`）收不到手势。表格段是 `MATCH_PARENT` 宽，等于气泡中间一条通栏死区。**2026-08-14 第 4 条「顺带修掉长按被吞」对表格段不成立** | 最终方案：段栈 `ZXMarkdownContentView.dispatchTouchEvent` 旁观代判长按再上抛（表格与 `LinkMovementMethod` 文字段都吞 DOWN）。已 push `4a283b741`。**真机四点未验**；v3.6.22 装机包不含此提交 |

> 表格区域的**单击**同样被横滚容器吞着，本次未动（用户只报了长按；表格区吞单击对横滚体验反而更稳）。要放行再说。
>
> 复验点：① 长按表格区域弹菜单 ② 长按表格外**段栈文字**仍正常且不双弹 ③ 横滚表格中途松手不误弹 ④ 在表格上纵向滑动，消息列表照常滚且不误弹。
>
> **2026-08-27 傍晚**：上述两文件已 commit + push `4a283b741`。v3.6.22 装机包仍不含段栈代判，真机四点未验。

### 已知未做

- **脚注 `[^1]`**：PC 不能装包（工作区禁 `npm install`）、Markwon 无官方插件、真实消息里没见过。要做得自写 commonmark 扩展
- **数学公式**：与 iOS 同，GFM 无此语法，尚无真实样本
- **代码块语法高亮 / 表格首列固定**：范围外
- **(android)** `isReferUnitPrimary`（回复聚合列表首条源消息，阈值 78/123dp）那条折叠路径**没接段栈**，仍是 `setMaxHeight` 硬切。含表格的消息出现在那个位置时，折叠仍可能切断表格。优先级低（该位置本就只显示一小截），但要知道

## 关键决策记录

- 2026-08-14 范围只做 **PC + 安卓**，web 不动（`AcMarkdown.vue` 只服务 AI 卡片/文本优化弹窗，非消息气泡）
- 2026-08-14 **行为 spec 的「PC 复用 web 渲染」前提被证伪**：PC 自有 `markdown-it` 管线，与 web 的 `marked` 无关。本轮是两套独立管线各自补齐
- 2026-08-14 **两端均无流式打字机链路**（智能体回复整条推送）→ 行为 spec 第 6 节流式规则本轮 N/A
- 2026-08-14 **遮罩配色划出范围**：PC 用 `-webkit-mask-image` 透明淡出、安卓 4 张 drawable 按 `isSend` 分好，iOS 那个白遮罩 bug 两端都不存在
- 2026-08-14 **折叠阈值三端不统一**（PC 400px / 安卓 480dp / iOS 另有一套）—— 字号行距屏宽都不同，对齐数值反而不对齐观感
- 2026-08-14 安卓表格横滚走**段栈 + `HorizontalScrollView` 包 `TableLayout`**（与 iOS 同思路）。附带收益：折叠从像素硬切改为按段取舍，直接满足「裁剪线不切表格」
- 2026-08-14 **无表格消息不走段栈**，保持原单 `TextView` 路径 —— 段栈改造的回归面只覆盖含表格消息
- 2026-08-14 PC 开 `breaks: true` 对齐 spec I8，接受存量消息排版变化
- 2026-08-14 PC 禁装包 → 任务列表**自写 core rule**（约 25 行），脚注直接不做
- 2026-08-14 安卓表格用 Markwon 自带的 `Table.parse(Markwon, TableBlock)`，**不手写 commonmark AST 遍历**（plan 里的原方案代码量翻倍且没必要）
- 2026-08-14 段栈暴露 `SegmentPostProcessor` 钩子接住 AI 卡片的角标/图片 Span 后处理；知识来源列表走单独的 `appendExtraText()` 挂最后（塞进 processor 的话，最后一段是表格时它没地方去）
- 2026-08-20 表格列宽：web 187.5px（375/2）；PC 会话列 **max-width 375px**（不要 min-width）。横滚保留。归属 `20260820-web端的-markdown对其pc，你先收集信息`。
- 2026-08-25 PC 表格要横滚，气泡链必须能缩：`max-width: max-content` 会让表撑破气泡再被裁掉。对齐 web 用 `min-width:0` + `max-width:100%`。

# Status：三端 markdown 表格横滚（已撤左右渐变罩，条改常驻）

> 最后更新：2026-08-19（产品改口：去掉左右渐变，溢出即常驻横滚条）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

行号对应 `plan.md` 的 Task。web 整列不涉及（AI 卡片弹窗，不是消息气泡）。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T1 显隐公式纯函数 + 单测 | — | — | — | ~~✅~~ 已撤 |
| T2 CSS 伪元素 + 气泡色变量 | — | — | — | ~~✅~~ 已撤 |
| T3 三个消费方挂 bind | — | — | — | ~~✅~~ 已撤 |
| T4 运行时自测 | — | — | — | 🚧 改验常驻条 |
| T5 TableView 自绘左右渐变 | — | ~~✅~~ 已撤 | — | — |
| T6 气泡色传入表格 | — | ~~✅~~ 已撤 | — | — |
| T7 真机自测 | — | 🚧 改验常驻条 | — | — |
| T8 外壳 CAGradientLayer | — | — | ~~✅~~ 已撤 | — |
| T9 段栈 + 两 cell 下发气泡色 | — | — | ~~✅~~ 已撤 | — |
| T10 真机自测 | — | — | 🚧 改验常驻条 | — |
| T11 token 表 | — | ✅ | ✅ | ✅ |
| T12 去掉左右罩 + 横条常驻 | — | ✅ 代码 | ✅ 代码 | ✅ 代码 |

> T12 代码已写、未提交、未编译。PC 折叠单测 12/12；安卓 / iOS 需人工装包。T4 / T7 / T10 改为验常驻条，不再验罩。

## 各端工作区现状（2026-08-19，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 160 | 脏 19 | 本次补文档 | 打包脚本 / 命令文件仍脏、不进本功能提交；**不 push main** |
| web | `dev-knowledge-not-found` | synced | 干净 | **不涉及** | |
| android | **`feat/gfm-markdown`** | synced | 脏 6 | **本功能** + 旁路 | 本功能：`ZXMarkdownTableView` / `ZXMarkdownContentView` / `ActionCardMessageItemProvider` 去罩+常驻条。旁路勿混提：`ConversationFragment` / `AgentAnswerGetManager` / `ReferenceMessageItemProvider` |
| ios | `feat/ios-file-download-progress` | ahead 48 | 脏 6 | **本功能叠在文件进度分支上** | markdown 去罩+自绘常驻条；文件进度主干已提交 `56fab29b6`。另有 `feat/ios-gfm-markdown` 未带这笔 |
| desktop | **`feat/gfm-markdown`** | synced | 脏 16 | **本功能** | 删 `markdownTableFade.js` / mixin / 单测；`.md-table-wrap` 强制 webkit 横条常驻。`.env.test` / `electron-builder.yml` / `package.json` 勿 stage |

## 待办 / 阻塞

- (desktop T4) 宽表一出现就有 6px 横条，贴左/滑到中间/贴右条都在，窄表没有条。表底 8px 空隙还在。热更新若没带上，重启 `npm run dev:test`
- (android T7) 宽表一出现就有细胶囊，不等滑、松手不淡出；窄表没有。长按与纵滚不受影响。旁路文件勿跟这笔混提
- (ios T10) 必须真机。系统 indicator 已关，自绘 3pt 胶囊溢出即常驻。流式结束成表后才出条；聚合 / 合并转发看一眼
- (desktop) 本地调试三文件保持脏、勿 stage
- (ios) 这笔改在 `feat/ios-file-download-progress` 上；若还要合回 `feat/ios-gfm-markdown`，需另 cherry-pick
- (ios) `project.pbxproj` 排序噪声若还在 stash 里，回主干记得 pop——与本功能无关

## 关键决策记录

- 2026-08-19：**去掉左右渐变罩。** 宽表改靠常驻横滚条提示可滑。罩色跟气泡、触边显隐、PC `--md-table-fade-color` 全部作废
- 2026-08-19：**滚动条默认直接显示、常驻。** 溢出立刻画，不等用户先滑；松手不淡出。窄表（差值 ≤1px）不画。安卓 / iOS 自绘 3dp/3pt 胶囊（35% 黑、贴底 overlay）；PC 给 `.md-table-wrap` 写死 `::-webkit-scrollbar { height: 6px }`，否则 Chromium overlay 条只在滑/悬停时出现
- 2026-08-18：3 端 = PC + 安卓 + iOS，web 不做
- 2026-08-18：同一套管线的 markdown 表格都做（会话 / 详情 / 合并 / 引用）
- 2026-08-18：继续叠在 `feat/gfm-markdown`；iOS 当时在 `feat/ios-gfm-markdown`，本回合实际改的是当前 checkout 的 `feat/ios-file-download-progress`（该分支已含表格代码）
- 2026-08-18：安卓横滚条不要用系统 scrollbar（各 ROM 又粗又黑）。compileSdk 28 没有 `setHorizontalScrollbarThumbDrawable`，在 `dispatchDraw` 里自绘
- 2026-08-18：PC 表格横滚条离表底要**真留空**。`.md-table-wrap` `padding-bottom: 8px`
- 2026-08-18：（已作废）遮罩方案 / 罩跟气泡底 / 同色 alpha=0 / 触边 24 宽——见 git 历史，代码已删

# Status：ios-机器人与智能体消息-GFM-Markdown渲染优化

> 最后更新：2026-08-13 19:30（spec + plan 已定稿，代码未动）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

本功能**只动 iOS**，其余三端不涉及（web 已用 marked、android 已用 Markwon，均为真 GFM 解析器）。行号对应 `plan.md` 的 Task。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec 定稿 | — | — | ✅ | — |
| plan 拆解（14 个 Task） | — | — | ✅ | — |
| T0 先落袋现有 505 行未提交改动 | — | — | ⬜ | — |
| T1 摸清四个接入点真实链路 | — | — | ⬜ | — |
| T2 引入 libcmark_gfm + 冒烟解析 | — | — | ⬜ | — |
| T3 ZXMarkdownStyle / Block / TableModel | — | — | ⬜ | — |
| T4 ZXMarkdownAttributedBuilder | — | — | ⬜ | — |
| T5 ZXMarkdownParser 块序列 + 流式降级 | — | — | ⬜ | — |
| T6 ZXMarkdownTableView 横滚表格 | — | — | ⬜ | — |
| T7 ZXMarkdownContentView 段栈 + 高度/收起态 | — | — | ⬜ | — |
| T8 Debug 摇一摇自测页（30 条用例） | — | — | ⬜ | — |
| T9 ZXMarkdownManager 切换 + 三重兜底 | — | — | ⬜ | — |
| T10 接入机器人气泡 | — | — | ⬜ | — |
| T11 接入智能体气泡 + 流式 | — | — | ⬜ | — |
| T12 接入回复聚合弹窗 | — | — | ⬜ | — |
| T13 接入合并转发详情页 | — | — | ⬜ | — |
| T14 三档构建 + 全量自测 + 收尾 | — | — | ⬜ | — |

## 各端工作区现状（2026-08-13 19:10，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 93 | 脏 10 | 本功能 spec 已提交 | 其余脏区是 hooks/skills/README 与上一功能 status |
| web | `feat/data-scope-secret-tag` | synced | 干净 | 不涉及 | 停在涉密标签功能 |
| android | `personal-ai-chat-hotfix` | synced | 脏 1 | 不涉及 | 仅一张相机图标资源未跟踪 |
| ios | `personal-ai-chat-hotfix` | synced | 脏 2 | **有关** | `ZXMarkdownManager.m` +460 行、`ZXGroupRobotCell.m` +64 行未提交——是上一轮做的**内联 HTML 渲染**（`processHTMLTags`，对齐安卓 Markwon HtmlPlugin），不是本功能产物 |
| desktop | `personal-ai-chat-hotfix` | synced | 脏 3 | 不涉及 | `.env.test`/`electron-builder.yml`/`package.json` 本地调试配置，按规矩**禁止提交** |

## 待办 / 阻塞

- (ios) **先处理 iOS 工作区那 505 行未提交改动**：内联 HTML 那套是本功能要复用的基础（spec「内联 HTML」章节直接引用 `processHTMLTags`），本功能动刀前先把它 commit 掉，否则两轮改动混在一个 diff 里没法回滚
- (ios) plan.md 已定稿（14 个 Task，含每步代码与人工构建卡点），下一步开始执行 T0
- (ios) 合并转发详情页（`ZXCombineMessageLogic` 链路）是否复用会话页 cell 未验证 —— plan 第一步排查任务；若是独立实现则多一个接入点
- (ios) `pod install` 与三档构建（模拟器 Debug / 真机 Debug / Prod archive）由人工执行，AI 不跑
- (ios) 包体增量待实测：archive 后看 Xcode Organizer 的 App Thinning Size Report

## 关键决策记录

- 2026-08-13 正确性基准取 **GFM 规范本身**（<https://github.github.com/gfm/>），不追像素级对齐安卓/web，样式 iOS 自定
- 2026-08-13 解析器换 **`pod 'libcmark_gfm', '~> 0.29.4'`**（trunk 上 `cmark-gfm` pod 停在 2018 年 0.1.0，不可用）；走 CocoaPods 而非源码内置，由用户拍板
- 2026-08-13 表格改 **独立子视图横向滚动**（`ZXMarkdownTableView`），气泡内容视图从单 `UITextView` 改为段栈；单元格 `UILabel` 不可选中，复制走整条消息长按
- 2026-08-13 流式表格：**未闭合先当纯文本，收完再成表**，高度只跳一次
- 2026-08-13 三重兜底：无表格消息走原单 textView 路径 / 解析异常或超 20000 字符回退老正则 / 全局开关 `ZXMarkdownUseCMark`
- 2026-08-13 `ZXMarkdownManager` 对外 API 一个不删，内部换解析器，非气泡调用方零改动

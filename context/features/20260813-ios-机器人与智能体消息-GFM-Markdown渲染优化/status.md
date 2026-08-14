# Status：ios-机器人与智能体消息-GFM-Markdown渲染优化

> 最后更新：2026-08-14 01:10（T0-T11 完成并编译通过；自测页补真实用例；运行时自测未开始，只能真机）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| ios | `personal-ai-chat-hotfix` | **ahead 5** | 干净 | **本功能全部产出** | `a67d3d364` 内联 HTML → `a973897d2` 渲染层 → `dd9051b0c` 机器人气泡 → `ee7108d63` 智能体气泡 → `482998e1a` 自测页全链路+真实用例。**未 push** |
| desktop | `personal-ai-chat-hotfix` | synced | 脏 3 | 不涉及 | `.env.test`/`electron-builder.yml`/`package.json` 本地调试配置，按规矩**禁止提交** |

本次功能代码量（`a67d3d364..HEAD`）：**28 文件，+1956 / -83**。新建 `Markdown/` 渲染层 13 个文件约 1100 行、Debug 用例页 3 个文件约 250 行；改既有文件只有 4 个（`ZXMarkdownManager`、`ZXIMCellLogic`、`ZXGroupRobotCell`、`ZXIMAgentStreamReplyCell`），其余是 `project.pbxproj`。

## 待办 / 阻塞

- (ios) **下一步全是运行时自测，且只能真机**：M 芯片上模拟器走不通（融云无 arm64 模拟器 slice，链接报 `ld: library 'Pods-zhixinApp' not found`），已试过并放弃。真机跑起来 → 摇一摇打开 GFM 用例对照页 → 按 31 条用例逐条看。大概率要调的是缩进量、段间距、表格列宽/内边距这类观感参数，改 `ZXMarkdownStyle` 一个文件即可。
- (ios) 会话页实测清单：机器人气泡含表格 / 智能体流式（盯表格从纯文本变成表格视图、高度只跳一次）/ 引用角标点击 / 插图与表格共存 / 长消息收起展开 / 纯文本消息与改造前无差异。
- (ios) T12+13：聚合弹窗与合并转发详情页复用同两个 cell，代码无需改，只需实测；若宽度不对，改成按容器实际宽度推导（现在写死 `kChatMsgContentW - 32`）。
- (ios) T14：真机 Debug + `zhixinAppProd` archive 两档还没验；archive 后记 App Thinning Size Report 的包体增量。
- (ios) ⚠️ **`pod install` 会拆掉 `zhixinAppTest`/`zhixinAppProd` 的 Pods xcconfig 挂载**，之后编译报 `'AFNetworking/AFNetworking.h' file not found`。本次已通过还原 `project.pbxproj` 修好；其他人拉到这个分支跑 `pod install` 会再踩一次。根治要把三个 target 都写进 Podfile（需团队决定，本次未做）。详见 impl-notes「工程坑」。
- (ios) 本机 `pod` 需 `RUBYOPT="-rlogger"` 前缀才能跑（Ruby 3.2 + activesupport 7.0.8 的 Logger 常量问题）。

> 已了结：T0 那 505 行内联 HTML 改动已提交（`a67d3d364`）；合并转发详情页链路已查清（复用会话页 cell，见 impl-notes）。

## 关键决策记录

- 2026-08-13 正确性基准取 **GFM 规范本身**（<https://github.github.com/gfm/>），不追像素级对齐安卓/web，样式 iOS 自定
- 2026-08-13 解析器换 **`pod 'libcmark_gfm', '~> 0.29.4'`**（trunk 上 `cmark-gfm` pod 停在 2018 年 0.1.0，不可用）；走 CocoaPods 而非源码内置，由用户拍板
- 2026-08-13 表格改 **独立子视图横向滚动**（`ZXMarkdownTableView`），气泡内容视图从单 `UITextView` 改为段栈；单元格 `UILabel` 不可选中，复制走整条消息长按
- 2026-08-13 流式表格：**未闭合先当纯文本，收完再成表**，高度只跳一次
- 2026-08-14 实现时把上一条简化为「**流式期间所有表格都按纯文本**」：流式路径只有单个富文本控件，中途插表格视图会让流式与最终两条高度体系分叉。布局快照缓存 key 必须带 streaming 标志，否则收完后命中流式那份快照、表格永远不成表
- 2026-08-13 三重兜底：无表格消息走原单 textView 路径 / 解析异常或超 20000 字符回退老正则 / 全局开关 `ZXMarkdownUseCMark`
- 2026-08-13 `ZXMarkdownManager` 对外 API 一个不删，内部换解析器，非气泡调用方零改动

# Status：三端 markdown 表格横滚左右渐变遮罩

> 最后更新：2026-08-18（spec / plan / token 已落盘，**三端代码均未动**）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

行号对应 `plan.md` 的 Task。web 整列不涉及（AI 卡片弹窗，不是消息气泡）。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T1 显隐公式纯函数 + 单测 | — | — | — | ⬜ |
| T2 CSS 伪元素 + 气泡色变量 | — | — | — | ⬜ |
| T3 三个消费方挂 bind | — | — | — | ⬜ |
| T4 运行时自测 | — | — | — | ⬜ |
| T5 TableView 自绘左右渐变 | — | ⬜ | — | — |
| T6 气泡色传入表格 | — | ⬜ | — | — |
| T7 真机自测 | — | ⬜ | — | — |
| T8 外壳 CAGradientLayer | — | — | ⬜ | — |
| T9 段栈 + 两 cell 下发气泡色 | — | — | ⬜ | — |
| T10 真机自测 | — | — | ⬜ | — |
| T11 token 表补遮罩宽 | — | ✅ | ✅ | ✅ |

> T11 只改了 `context/design/markdown-style-tokens.md`，三端代码仍是 ⬜。

## 各端工作区现状（2026-08-18，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 127 | 脏 2 | **本功能文档** | `ACTIVE` 已指向本目录；功能目录未提交 |
| web | `feat/data-scope-secret-tag` | synced | 干净 | **不涉及** | 涉密标签旁路 |
| android | **`feat/gfm-markdown`** | synced | 干净 | **本功能继续叠在 GFM 分支上**（横滚容器只在这里） | `d175966e7` 表格列宽 |
| ios | **`feat/ios-gfm-markdown`** | ahead 2 | 干净 | **同上** | `0e37761d3` 自测修复，未 push |
| desktop | **`feat/gfm-markdown`** | synced | 脏 3 | **同上** | 脏的是 `.env.test` / `electron-builder.yml` / `package.json`，**禁止提交** |

## 待办 / 阻塞

- (三端) 代码未开工。建议按 plan 先 PC（有单测）再安卓再 iOS
- (desktop) 本地调试三文件保持脏、勿 stage
- (ios) 自测必须真机（融云无 arm64 模拟器 slice）
- (ios) `project.pbxproj` 排序噪声若还在 stash 里，回主干记得 pop——与本功能无关

## 关键决策记录

- 2026-08-18：3 端 = PC + 安卓 + iOS，web 不做
- 2026-08-18：遮罩方案 = 左右叠渐变层（不 mask 表格内容、不写死两套图）
- 2026-08-18：实色跟随当前气泡真实底色（含安卓外链 / iOS 微信）
- 2026-08-18：同一套管线的 markdown 表格都做（会话 / 详情 / 合并 / 引用）
- 2026-08-18：宽 24、触边阈值 1px；差值 ≤1px 当不溢出
- 2026-08-18：继续叠在 `feat/gfm-markdown` / `feat/ios-gfm-markdown`，不另切分支

# Status：web markdown 表格对齐 PC

> 最后更新：2026-08-20（代码已写、vue-tsc 绿、子代理审查无 Critical；待你真机验收）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

行号对应 `plan.md` 的 Task。本期**只做 web**。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T0 切分支 `feat/web-markdown-table-align-pc` | ✅ | — | — | — |
| T1 Table `renderWrapper` 仅 markdown 展示态 | ✅ | — | — | — |
| T2 `AcMarkdown` 表格皮肤 + 横滚 CSS | ✅ | — | — | — |
| T3 token 表补 web 表格适用范围 | ✅ | — | — | — |
| T4 `vue-tsc --noEmit` | ✅ | — | — | — |
| T5 status / impl-notes | ✅ | — | — | — |
| 真机验收（宽表横滚 / 窄表无滑 / 输入框未回归） | 🚧 | — | — | — |

> T0–T5 的 ✅ 是代码 + `vue-tsc`。真机格子在你看过之前保持 🚧。

## 各端工作区现状（2026-08-20，`scripts/code-status.sh --short`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 |
|----|------|------|------|--------------|
| context | `main` ahead 172 | 脏 24 | 本功能 docs + token 表；**还有其他功能的脏文件，勿一并提交** |
| web | **`feat/web-markdown-table-align-pc`**（无 upstream） | 脏 3 | **本功能**：`AcMarkdown.vue`、`EditorWrapper.vue`、`ExpandableContent.vue` |
| android | `fix/md-table-fold-truncate` | 脏 2 | 不涉及 |
| ios | `feat/ios-file-download-progress` ahead 48 | 脏 7 | 不涉及 |
| desktop | `feat/gfm-markdown` synced | 脏 3 | 不涉及（PC 表格已在 GFM 分支） |

## 待办 / 阻塞

- (web) **请你验收**：个人 AI 框宽表只在表内左右滑、标题不跟着走；2～3 列窄表没有有效滑块；无斑马纹、无写死白底；思考过程折叠卡里的表同样规则；输入框手插表与改前一致；「查看更多」仍约 240px。
- (web) 代码在 `feat/web-markdown-table-align-pc`，**尚未 commit / push**。

## 关键决策记录

- 2026-08-20 场景 = 个人 AI 框 +「AI 优化文本」弹窗；只对齐表格，标题/代码/引用/列表不动。
- 2026-08-20 单元格 nowrap + 表级左右横滚；不要左右渐变罩。
- 2026-08-20 方案 1：皮肤写在 `AcMarkdown`；`renderWrapper` 只闸 `getHTML()`。直播 DOM 在 `resizable: false` 时本来就有 `TableView` 的 `.tableWrapper`。
- 2026-08-20 为让横滚在 flex 气泡里生效：`!max-w-unset` → `!max-w-full`，`ExpandableContent` / `AcMarkdown` 加 `min-w-0 max-w-full`。
- 2026-08-20 子代理审查：无 Critical；status 已按真实进度改；`renderWrapper` 注释已写清 TableView vs getHTML。

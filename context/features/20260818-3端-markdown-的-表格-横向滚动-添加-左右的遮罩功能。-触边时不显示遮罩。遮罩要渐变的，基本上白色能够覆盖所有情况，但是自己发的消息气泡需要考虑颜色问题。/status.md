# Status：三端 markdown 表格横滚左右渐变遮罩

> 最后更新：2026-08-18（三端已 push 到当前功能分支；T4/T7/T10 仍待人工再验）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

行号对应 `plan.md` 的 Task。web 整列不涉及（AI 卡片弹窗，不是消息气泡）。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T1 显隐公式纯函数 + 单测 | — | — | — | ✅ |
| T2 CSS 伪元素 + 气泡色变量 | — | — | — | ✅ |
| T3 三个消费方挂 bind | — | — | — | ✅ |
| T4 运行时自测 | — | — | — | 🚧 |
| T5 TableView 自绘左右渐变 | — | ✅ | — | — |
| T6 气泡色传入表格 | — | ✅ | — | — |
| T7 真机自测 | — | 🚧 | — | — |
| T8 外壳 CAGradientLayer | — | — | ✅ | — |
| T9 段栈 + 两 cell 下发气泡色 | — | — | ✅ | — |
| T10 真机自测 | — | — | 🚧 | — |
| T11 token 表补遮罩宽 | — | ✅ | ✅ | ✅ |

> T1–T3 / T5–T6 / T8–T9 是代码完成（PC 单测 8/8；安卓 `assembleDevelopDebug` 绿；iOS 未跑 xcodebuild）。T4 / T7 / T10 必须人工自测。

## 各端工作区现状（2026-08-18，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 133 | 脏（scripts / 命令 / status） | 文档待补记 push | 打包脚本输出对齐未提交；**不 push main** |
| web | `feat/data-scope-secret-tag` | synced | 干净 | **不涉及** | 涉密标签旁路 |
| android | **`feat/gfm-markdown`** | synced | 干净 | **本功能** | `e39334844` 滚动条 + 表格段 16dp；已 push |
| ios | **`feat/ios-gfm-markdown`** | synced | 干净 | **本功能** | `5c37b8a20` 非首块表格上收 10pt；已 push |
| desktop | **`feat/gfm-markdown`** | synced | 脏 3（禁提交） | **本功能** | `ba07ab66` 表底 padding 8px；已 push。`.env.test` 等勿 stage |

## 待办 / 阻塞

- (desktop T4) 已改成滚动容器**外侧**绝对定位罩。请再验 `#/debug/markdown` 宽表 T7：贴左只右罩、中间双侧、贴右只左罩；窄表无罩。**再验**表底与横滚条之间应有约 8px 空隙（不是贴边）。热更新若没带上，重启 `npm run dev:test`。
- (android T7) 组织白 / `#DEE8FF`、外链 `#99F0CB` / `#EFF2F6`；复用换色；长按与纵滚。**再验**：宽表横滑时出滚动条、松手淡出；正文下方表格上边距是否够松。
- (ios T10) 必须真机。组织白 / `#DEE8FF`、微信 `#B3ECCF`；流式结束才出罩；聚合 / 合并转发看一眼。**再验**：正文与表格之间是否还偏空。
- (desktop) 本地调试三文件保持脏、勿 stage
- (ios) `project.pbxproj` 排序噪声若还在 stash 里，回主干记得 pop——与本功能无关

## 关键决策记录

- 2026-08-18：3 端 = PC + 安卓 + iOS，web 不做
- 2026-08-18：遮罩方案 = 左右叠渐变层（不 mask 表格内容、不写死两套图）
- 2026-08-18：实色跟随当前气泡真实底色（含安卓外链 / iOS 微信）
- 2026-08-18：同一套管线的 markdown 表格都做（会话 / 详情 / 合并 / 引用）
- 2026-08-18：宽 24、触边阈值 1px；差值 ≤1px 当不溢出
- 2026-08-18：继续叠在 `feat/gfm-markdown` / `feat/ios-gfm-markdown`，不另切分支
- 2026-08-18：渐变透明端必须是**同色 alpha=0**。安卓 `Color.TRANSPARENT`（`#00000000`）会往黑插值发灰，已改 `Color.argb(0, r, g, b)`，与 iOS `colorWithAlphaComponent:0` 对齐
- 2026-08-18：PC 回复列表 `reply-msg-list.vue` 补了同一套 `--md-table-fade-color`（plan 只写了 `msg-list.vue`）
- 2026-08-18：PC 伪元素（float+sticky）自测看不见罩。右罩在宽表后面、初始视口外；空伪元素 height:100% 在 auto 容器上为 0。改为滚动容器外侧兄弟 + 实色条 mask 渐变
- 2026-08-18：自测微调——安卓宽表横滑显示 overlay 滚动条（不占高度）；非首段表格上边距 7→16dp 对齐 iOS 松一点的观感；iOS 非首块表格上收 10pt（吃掉上一段段间距 / 文本框底空）
- 2026-08-18：PC 表格横滚条离表底要**真留空**。槽加高 + thumb 透明上边在 Chromium 里仍贴着表的下边框（4px 在槽内部）。改为 `.md-table-wrap` `padding-bottom: 8px`，条高继续用全局 6px；左右罩 `bottom: 6px` 只让开条本身。

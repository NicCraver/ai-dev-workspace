# Status：pc安卓-GFM-Markdown渲染对齐

> 最后更新：2026-08-14 12:5x（spec 定稿并提交，两端分支已切，等用户过 spec 后出 plan）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

本功能**只动 PC（desktop）与安卓**，web 与 iOS 不涉及（iOS 上一轮已完成，web 的 `marked` 管线只服务 AI 卡片弹窗、不是消息气泡）。

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 现状勘察（两端管线与差距） | — | ✅ | — | ✅ |
| spec 定稿 | — | ✅ | — | ✅ |
| 切分支 `feat/gfm-markdown` | — | ✅ | — | ✅ |
| plan 拆解 | — | ⬜ | — | ⬜ |
| markdown 配置补齐（插件/选项/兜底） | — | ⬜ | — | ⬜ |
| 表格横滚 + 配色 | — | ⬜ | — | ⬜ |
| 折叠不切块 | — | ⬜ | — | ⬜ |
| AI 卡片判定放宽 | — | ⬜ | — | ⬜ |
| debug 用例页（30 条，验完删） | — | ⬜ | — | ⬜ |
| 自测通过 | — | ⬜ | — | ⬜ |

## 各端工作区现状（2026-08-14 12:5x，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 | 备注 |
|----|------|------|------|--------------|------|
| context | `main` | ahead 107 | 脏 9 | spec 已提交 `d1627b1` | 脏区是 hooks/skills/README/`.pi/`，与本功能无关 |
| web | `feat/data-scope-secret-tag` | synced | 干净 | 不涉及 | 停在涉密标签功能 |
| android | **`feat/gfm-markdown`** | 无 upstream（未 push） | 干净 | **本功能** | 基点 `f5f2d0ce3`（原 `personal-ai-chat-hotfix`） |
| ios | `feat/ios-gfm-markdown` | synced | 干净 | 上一轮，已完成 | `c4d50e28b` 移除自测页 |
| desktop | **`feat/gfm-markdown`** | 无 upstream（未 push） | 脏 3 | **本功能** | 基点 `763cd15e`（原 `personal-ai-chat-hotfix`）。脏的是 `.env.test`/`electron-builder.yml`/`package.json` 本地调试配置，切分支时带过来的，**按规矩禁止提交** |

## 待办 / 阻塞

- (全部) **等用户过 spec**：`spec.md` 已提交，用户确认后进 writing-plans 出 `plan.md`
- (desktop) `breaks: true` 是本轮唯一会影响**存量消息排版**的改动（当前单换行被吞成空格）。上线前必须拿至少 5 条真实存量消息对比开关前后
- (desktop) 禁 `npm install` → 任务列表只能自写 renderer rule，脚注本轮直接不做
- (android) `ext-strikethrough` / `ext-tasklist` 不在本机 gradle 缓存里，需一次联网 sync
- (android) 正文段栈改造会动到气泡布局层，是本轮唯一伤筋动骨处；无表格的消息保留原单 `TextView` 路径以控回归
- (两端) spec 第 8 节 4 条待核实项：安卓 AI 卡片判定是否依赖 `ga_` 前缀 / Markwon `HtmlPlugin` 是否默认注册 `<sup>``<sub>` / 安卓软换行现状 / PC `message-info.vue` 与 `msg-reply-poll.vue` 是否需同样的表格横滚样式

## 关键决策记录

- 2026-08-14 范围只做 **PC + 安卓**，web 不动（`AcMarkdown.vue` 只服务 AI 卡片/文本优化弹窗，非消息气泡）
- 2026-08-14 **行为 spec 的「PC 复用 web 渲染」前提被证伪**：PC 自有 `markdown-it` 管线（`src/lib/markdownUtils.js`），与 web 的 `marked` 无关。本轮是两套独立管线各自补齐
- 2026-08-14 **两端均无流式打字机链路**（智能体回复整条推送）→ 行为 spec 第 6 节流式规则本轮 N/A
- 2026-08-14 **遮罩配色划出范围**：PC 用 `-webkit-mask-image` 透明淡出、安卓 4 张 drawable 按 `isSend` 分好，iOS 那个白遮罩 bug 两端都不存在
- 2026-08-14 **折叠阈值三端不统一**（PC 400px / 安卓 480dp / iOS 另有一套）—— 字号行距屏宽都不同，对齐数值反而不对齐观感
- 2026-08-14 安卓表格横滚走**段栈 + `HorizontalScrollView` 包 `TableLayout`**（与 iOS 同思路），不用「保持 span 只调样式」也不用「整个正文包横滚」。附带收益：折叠从像素硬切改为按段取舍，直接满足「裁剪线不切表格」
- 2026-08-14 PC 开 `breaks: true` 对齐 spec I8（聊天场景按换行显示），接受存量消息排版变化
- 2026-08-14 验收走**两端各建临时 debug 用例页**（30 条），验完删，与 iOS 上一轮做法一致

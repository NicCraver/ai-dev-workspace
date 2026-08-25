# Status：PC 端已读兜底 —— 表态反推已读水位

> 最后更新：2026-08-25（Task 5 实施代理撞会话额度上限挂掉，worktree 无残留，已重派）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 设计（spec） | — | — | — | ✅ |
| 实现计划（plan） | — | — | — | ✅ |
| Task 1 证据提取 + 水位判定纯函数 | — | — | — | ✅ `fc7d7e46` 13/13 |
| Task 2 扫消息列表算水位 | — | — | — | ✅ `ec092d9c` 23/23 |
| Task 3 水位仓库 | — | — | — | ✅ `dd6a4add` 31/31 |
| Task 4 接线：喂入 + 私聊读出 | — | — | — | ✅ `75025888` lint 0 + 31/31 |
| Task 5 接线：群聊读出 | — | — | — | 🚧 代理执行中（首次因额度上限失败，已重派） |
| Task 6 真机自测（4 条） | — | — | — | ⬜ |

本功能只做 desktop，另三端不涉及。Task 1–4 的 ✅ = worktree 提交 + 单测 + 评审通过，**不含真机**。

## 工作目录（并行开发）

| 目录 | 分支 | 归谁 |
|---|---|---|
| `apps/desktop` | `feat/gfm-markdown` | 用户 / Cursor，另一条并行任务（GFM / 对比度） |
| `apps/desktop-watermark`（worktree） | `feat/pc-read-watermark`，相对 `origin/release` ahead 4，工作区干净 | 本功能 |

worktree 的 `node_modules` 是指向 `apps/desktop/node_modules` 的软链，两边共用一份依赖，**禁止任何 install**。
`node_modules` 与 `.superpowers/` 已加进 `.git/info/exclude`（软链不被 `.gitignore` 的 `node_modules/` 匹配）。

执行方式：subagent-driven-development，每任务一个实施代理 + 一个评审代理，台账在
`apps/desktop-watermark/.superpowers/sdd/progress.md`。四笔提交均未 push（分支跟踪的是 `origin/release`）。

## 各端工作区现状（2026-08-25 复查，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|----|------|------|------|----------|------|
| context | `main` ahead 246 | 脏 25 | 构建脚本 / 命令文件 / GFM 文档 | 否 | 本功能只应提交本目录 `status.md`；GFM 文档另提 |
| web | `feat/web-markdown-table-align-pc` | synced | 干净 | 否 | 已 push `f5616c5` 波浪下划线 + 对比度，属 markdown 对齐 PC |
| android | `feat/gfm-markdown` | synced | 脏 12 | 否 | GFM 引用高亮左偏 + 蓝色被整段字色盖掉，与已读水位无关 |
| ios | `feat/ios-agent-date-range` | **no upstream** | 脏 20 | 否 | 已从 `feat/ios-file-download-progress` 换到新分支，无上游。与已读水位无关 |
| desktop | `feat/gfm-markdown` | synced | 脏 8 | 否 | markdown 表格宽度改动，属 GFM，**不要合进水位分支**。另有 `.env.test` / `electron-builder.yml` / `package.json` 本地调试，**禁止提交** |
| desktop-watermark | `feat/pc-read-watermark` | ahead 4 vs `origin/release` | 干净 | **是** | Task 1–4 已提交；Task 5 代理执行中 |
| meeting | `merge/pr4-pr7` | — | 脏 12 | 否 | `apps/meeting` 的 designs 目录改动，与已读水位无关。**`code-status.sh` 只覆盖 4 端，看不到它与 action-center / desktop-watermark** |

> `apps/` 下实际有 7 个目录：`web` / `android` / `ios` / `desktop` / `desktop-watermark`（本功能 worktree）/ `meeting` / `action-center`。
> `scripts/code-status.sh` 硬编码只查前四个，另三个需手查。

## 待办 / 阻塞

- (desktop-watermark) **Task 5 执行中**：群聊 `getMergedGroupReceipt`，只把名单里已有的人从 0 翻成时间戳，不改分母；本地名单缺失返回 `null` 不是 `{}`。首次派的代理撞会话额度上限（重置 19:00 Asia/Shanghai）挂掉，worktree 检查过无残留、HEAD 仍 `75025888`，已重派。若再挂就不用代理、直接定点编辑（简报里代码是现成的）
- (desktop-watermark) Task 5 的行号提示：简报里的行号是 `origin/release` 原始版本的。Task 4 插了 68 行，模板那三处 `:msgReceipt`（339/436/454 附近）**没漂**，但两个计数方法（2929–2936 附近）**下移约 50 行**。按代码文本定位，别按行号
- (desktop-watermark) Task 6 真机验收 4 条见 `spec.md` 第七节；需要 `npm run dev:test`，与 `apps/desktop` 抢 9080 端口，起之前先确认主目录的 dev 已停
- (desktop-watermark) 终审 triage 几条 Minor 见 `progress.md`（裸对象当 set、`senderUserId`/`bySelf` 冗余、空会话条目、`refreshReadWatermark` 注释措辞）——不挡 Task 5
- (desktop) 主目录 `feat/gfm-markdown` 本回合改了 markdown 表格宽度，属 `20260820`，不要合进水位分支。`.env.test` / `electron-builder.yml` / `package.json` 保持脏、勿 stage
- (web / android / ios) 脏区或刚 push 的提交均属 markdown / GFM 并行功能，不要合进本分支
- (android / ios) 2026-08-25 HTML `color:green` → `#008000`，归属 GFM，不是本功能
- (android) 2026-08-25 引用块里 `<mark>` 高亮往左偏、引用里的蓝色被整段字色盖掉，已改代码，真机未验。归属 `20260814` GFM，不是本功能
- (ios) 2026-08-25 自己发到群里的个人 AI 框长卡片不折叠：折叠开关从「是不是 AI 卡片」拆开，所有 ActionCard 超高都折。归属 `20260813` GFM，不是本功能。真机未验

## 关键决策记录

- 2026-08-25 上一轮方案 `20260824-3端-私聊群聊已读回执不翻转排查` 封存，本功能取代之。根因是融云回执 `isPersited: false`，在回执通道上打补丁有天花板。
- 2026-08-25 兜底做成「已读水位」：`watermark[U] = T` 表示 U 在 T 时刻打开着会话，我发的 `sentTime <= T` 的消息对 U 已读。
- 2026-08-25 水位取「被表态消息的 sentTime」而非「表态时间 t」——更保守，且绕开上一轮「缺 t 用 1 占位」的坑。
- 2026-08-25 三个证据源：表态、回复、对方发言。前两者共用消息扩展通道，同一份数据结构、同一段代码。
- 2026-08-25 群聊只补分子、不改分母。分母（@ 名单）语义是「需要已读的人数」，由发送方登记决定，不被旁人动作改写。
- 2026-08-25 不落盘。历史消息重新加载后照样生效，落盘方案做不到这点。
- 2026-08-25 上一轮未做完的服务端写入解耦、群聊 `chatType: 2` 接口，不在本次范围。

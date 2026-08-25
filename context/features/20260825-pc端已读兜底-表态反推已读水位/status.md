# Status：PC 端已读兜底 —— 表态反推已读水位

> 最后更新：2026-08-25（Task 1–4 已在 worktree 落地；本回合只收尾文档，未改本功能代码）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 设计（spec） | — | — | — | ✅ |
| 实现计划（plan） | — | — | — | ✅ |
| Task 1 证据提取 + 水位判定纯函数 | — | — | — | ✅ `fc7d7e46` 13/13 |
| Task 2 扫消息列表算水位 | — | — | — | ✅ `ec092d9c` 23/23 |
| Task 3 水位仓库 | — | — | — | ✅ `dd6a4add` 31/31 |
| Task 4 接线：喂入 + 私聊读出 | — | — | — | ✅ `75025888` lint 0 + 31/31 |
| Task 5 接线：群聊读出 | — | — | — | ⬜ brief 已写，无代码 |
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

## 各端工作区现状（2026-08-25，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|----|------|------|------|----------|------|
| context | `main` ahead 242 | 脏 22 | 构建脚本 / 命令文件 / iOS GFM status | 否 | 本功能只应提交本目录 `status.md` |
| web | `feat/web-markdown-table-align-pc` | synced | 干净 | 否 | 本回合已 push `f5616c5` 波浪下划线 + 对比度，属 markdown 对齐 PC |
| android | `feat/gfm-markdown` | synced | 脏 12 | 否 | Markwon / 表格 / 波浪下划线等 GFM，与已读水位无关 |
| ios | `feat/ios-file-download-progress` | synced | 脏 11 | 否 | GFM 渲染层叠在文件进度分支上，与已读水位无关 |
| desktop | `feat/gfm-markdown` | synced | 脏 3 | 否 | 仅 `.env.test` / `electron-builder.yml` / `package.json` 本地调试，**禁止提交** |
| desktop-watermark | `feat/pc-read-watermark` | ahead 4 vs `origin/release` | 干净 | **是** | Task 1–4 已提交；Task 5 群聊接线未开工 |

## 待办 / 阻塞

- (desktop-watermark) **下一步是 Task 5**：群聊 `getMergedGroupReceipt`，只把名单里已有的人从 0 翻成时间戳，不改分母；本地名单缺失返回 `null` 不是 `{}`
- (desktop-watermark) Task 6 真机验收 4 条见 `spec.md` 第七节；需要 `npm run dev:test`，与 `apps/desktop` 抢 9080 端口，起之前先确认主目录的 dev 已停
- (desktop-watermark) 终审 triage 几条 Minor 见 `progress.md`（裸对象当 set、`senderUserId`/`bySelf` 冗余、空会话条目、`refreshReadWatermark` 注释措辞）——不挡 Task 5
- (desktop) 主目录脏的三份本地调试文件保持脏、勿 stage
- (web / android / ios) 脏区或刚 push 的提交均属 markdown / GFM 并行功能，不要合进本分支

## 关键决策记录

- 2026-08-25 上一轮方案 `20260824-3端-私聊群聊已读回执不翻转排查` 封存，本功能取代之。根因是融云回执 `isPersited: false`，在回执通道上打补丁有天花板。
- 2026-08-25 兜底做成「已读水位」：`watermark[U] = T` 表示 U 在 T 时刻打开着会话，我发的 `sentTime <= T` 的消息对 U 已读。
- 2026-08-25 水位取「被表态消息的 sentTime」而非「表态时间 t」——更保守，且绕开上一轮「缺 t 用 1 占位」的坑。
- 2026-08-25 三个证据源：表态、回复、对方发言。前两者共用消息扩展通道，同一份数据结构、同一段代码。
- 2026-08-25 群聊只补分子、不改分母。分母（@ 名单）语义是「需要已读的人数」，由发送方登记决定，不被旁人动作改写。
- 2026-08-25 不落盘。历史消息重新加载后照样生效，落盘方案做不到这点。
- 2026-08-25 上一轮未做完的服务端写入解耦、群聊 `chatType: 2` 接口，不在本次范围。

# Status：PC 端已读兜底 —— 表态反推已读水位

> 最后更新：2026-08-25 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 设计（spec） | — | — | — | ✅ |
| 实现计划（plan） | — | — | — | ✅ |
| Task 1 证据提取 + 水位判定纯函数 | — | — | — | 🚧 |
| Task 2 扫消息列表算水位 | — | — | — | ⬜ |
| Task 3 水位仓库 | — | — | — | ⬜ |
| Task 4 接线：喂入 + 私聊读出 | — | — | — | ⬜ |
| Task 5 接线：群聊读出 | — | — | — | ⬜ |
| Task 6 真机自测（4 条） | — | — | — | ⬜ |

本功能只做 desktop，另三端不涉及。

## 工作目录（并行开发）

| 目录 | 分支 | 归谁 |
|---|---|---|
| `apps/desktop` | `feat/gfm-markdown` | 用户 / Cursor，另一条并行任务 |
| `apps/desktop-watermark`（worktree） | `feat/pc-read-watermark`，从 `origin/release` `613af430` 切出 | 本功能 |

worktree 的 `node_modules` 是指向 `apps/desktop/node_modules` 的软链，两边共用一份依赖，**禁止任何 install**。
`node_modules` 与 `.superpowers/` 已加进 `.git/info/exclude`（软链不被 `.gitignore` 的 `node_modules/` 匹配）。

执行方式：subagent-driven-development，每任务一个实施代理 + 一个评审代理，台账在
`apps/desktop-watermark/.superpowers/sdd/progress.md`。

## 待办 / 阻塞

- (desktop) Task 1–5 由子代理执行中
- (desktop) Task 6 真机验收 4 条见 `spec.md` 第七节；需要 `npm run dev:test`，与主目录抢 9080 端口，起之前先确认主目录的 dev 已停
- 另三端（web / android / ios）工作区有脏改动，均属其它并行功能，与本功能无关

## 关键决策记录

- 2026-08-25 上一轮方案 `20260824-3端-私聊群聊已读回执不翻转排查` 封存，本功能取代之。根因是融云回执 `isPersited: false`，在回执通道上打补丁有天花板。
- 2026-08-25 兜底做成「已读水位」：`watermark[U] = T` 表示 U 在 T 时刻打开着会话，我发的 `sentTime <= T` 的消息对 U 已读。
- 2026-08-25 水位取「被表态消息的 sentTime」而非「表态时间 t」——更保守，且绕开上一轮「缺 t 用 1 占位」的坑。
- 2026-08-25 三个证据源：表态、回复、对方发言。前两者共用消息扩展通道，同一份数据结构、同一段代码。
- 2026-08-25 群聊只补分子、不改分母。分母（@ 名单）语义是「需要已读的人数」，由发送方登记决定，不被旁人动作改写。
- 2026-08-25 不落盘。历史消息重新加载后照样生效，落盘方案做不到这点。
- 2026-08-25 上一轮未做完的服务端写入解耦、群聊 `chatType: 2` 接口，不在本次范围。

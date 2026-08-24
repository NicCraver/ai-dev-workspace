# Status：3端-私聊群聊已读回执不翻转排查

> 最后更新：2026-08-24 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 本轮性质

**只读审计，不改代码。** 现象无法稳定复现（用户说不清是哪端发的、遇到时无记录），唯一证据是代码本身。
主交付是 `findings.md`。web 端不参与 IM 已读回执，故全列 `—`。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec 定稿 | — | ✅ | ✅ | ✅ |
| 纵切：私聊已读链路测绘 | — | ✅ | ✅ | ✅ |
| 纵切：群聊已读链路测绘 | — | ✅ | ✅ | ✅ |
| 纵切：SDK 初始化配置 | — | ✅ 两类会话都开回执（`RongMessageInit.java:118-123`）；`readReceiptTimeout` 未显式设置 | ✅ 未找到显式设置 | ✅ 未传 options，取默认 1 天（`IMSDKServer.js:11`） |
| 横切：6 阶段 × 2 机制对比矩阵 | — | ✅ | ✅ | ✅ |
| 18 格组合推演 | — | ✅ | ✅ | ✅ |
| 可疑点 A/B/C 定级 | — | ✅ | ✅ | ✅ |
| `findings.md` 成稿 | — | ✅ | ✅ | ✅ |
| HTML 汇报（`report.html`） | — | ✅ | ✅ | ✅ |
| 展示层专项（electron-store 数据流） | — | ✅ | ✅ | ✅ |
| 修复方案选型 | — | ⬜ | ⬜ | ⬜ |
| **真机验证（全部未做）** | — | ⬜ | ⬜ | ⬜ |

## 各端工作区现状（2026-08-24，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 |
|----|------|------|------|--------------|
| context | `main` | ahead 199 | 脏 23（命令/脚本/契约文档，另一会话在改） | 无关 |
| web | `feat/web-markdown-table-align-pc` | synced | 干净 | 无关（web 不参与 IM 已读回执） |
| android | `feat/gfm-markdown` | synced | 干净 | 无关（上个 feature 的打点已清，切回本分支） |
| ios | `feat/ios-file-download-progress` | synced | 干净 | 无关 |
| desktop | `feat/gfm-markdown` | synced | 脏 3 | **无关且禁止提交**：`.env.test` / `electron-builder.yml` / `package.json`，PC 打包本地配置，本会话开始前就存在 |

> 本功能自始至终**零代码改动**，四端脏区均非本功能产生。

## 审计结论（详见 findings.md）

问题最集中在 **PC 端**。PC 是三端里唯一不用融云 SDK 原生回执 API 的一端——发送方登记、阅读方回执、回执入库全自研，与 SDK 原生口径在四处不一致。

3 条 A 级（代码坐实）：

- **A1** PC 阅读群消息时回执只覆盖「文本/引用 且 `extra` 非空」的消息（`msg-list.vue:1433-1446`）；安卓/iOS 按 SDK 的 `readReceiptInfo` 判定、不限类型。
- **A2** PC 私聊已读回执被 `!isFirstScreen || showDownMsg` 整体挡掉（`msg-list.vue:2587-2589`）；6 个调用点全撞这道门。安卓/iOS 无等价门槛。**这条最能解释「偶发、无法稳定复现」。**
- **A3** 安卓发送方只对纯文本发回执请求，引用消息不发（`ConversationFragment.java:1580`）；iOS/PC 都不限。

6 条 B 级、5 条 C 级见 findings.md。

### 展示层专项（追加，findings.md 第五之二节）

同事指出「显示靠 electron-store」——核实成立，且比回执发送侧更根本。4 条 D 级：

- **D1** 已读状态纯本地存储，无重建路径 → 换机/重装/清缓存永久丢失。
- **D2** 私聊已读按天分片、只加载 4 天窗口（`storeModule/index.js:38-51`）→ **3 天前的消息回落显示「未读」**。
- **D3** 登记表决定渲不渲染已读入口，丢了之后回执全被第一道门丢弃（`storeModule/index.js:157-159`）——服务端权威源也救不了这一层。
- **D4** 三端各存各的，无共同权威源。

**关键机会**：`datasyn/getReadMessage` 返回带 `accountId`，接口明确支持 `chatType: 2`（群聊），三端写入侧都在打 `datasyn/readMessage`——服务端有全量数据。但安卓 / iOS **接口定义了却零调用**，PC 只用私聊且 reduce 时丢掉 `accountId`。

## 待办 / 阻塞

- (跨端) **卡在方案选型**，已向用户摆了三个方案待选：
  **A**（推荐）服务端 `datasyn/getReadMessage` 做权威源、本地存储降级为缓存，三端同源；
  **B** 只补本地存储的洞（不解决换机丢失与跨端一致）；
  **C** 以融云 `readReceiptInfo` 为准（治标，且 PC 的 v2 adapter 与原生 5.x 不同源）。
  倾向 A + B 里的 B1/B3 必修项（D3 那层服务端救不了）。
- (阻塞 A) **`chatType: 2` 的返回是否含按人明细，未验证**——这是 A 方案唯一命门。建议第一步不写代码，先打一发接口看返回。若只有会话级，群聊那半边要退回 C。
- (跨端) **全部结论未经真机验证**，A 级也只是「代码上必然」。下一步按性价比：先验 A2（PC 本地 `npm run dev:test` 即可，无需出包）→ 再验 A1（需 iOS 配合发非纯文本 @ 消息）→ B1/B3 一起（devtools 看一次 @所有人 消息的 `extra` 结构）→ A3 最后（需安卓出包）。
- (跨端) 本轮**未改任何代码**，四端工作区状态与审计开始时一致。
- (android) 融云只有 `rong_imlib_5.5.3.jar` + `libRongIMLib.so`，SDK 内部不可读；凡涉及原生 SDK 内部行为的结论一律降到 B 级（见 B5）。
- (desktop) `apps/desktop` 当前在 `feat/gfm-markdown`，工作区脏 3 个（`.env.test` / `electron-builder.yml` / `package.json`）——PC 打包本地配置，**与本功能无关且禁止提交**。
- (desktop) 8/19 的 `context/features/20260819-pc端群@消息已读回执丢失/plan.md` 从未执行（`fix/pc-group-at-read-receipt` 分支不存在）。其事实表已在本轮复核并更新——**其中「阅读方回执只对文本/引用」「PC 不处理 RRReqMsg」两条仍成立，但「发送方登记只在 `MessageModel.js:305-317`」的描述需配合 `messageService.js:295-339` 的 `shouldRequestGroupReadReceipt` 一起看**（后者是那之后新增的）。
- (契约) `datasyn/getReadMessage` 在 `context/contracts/` 下无契约文件。三端都在调，本轮未逐字段比对传参与解读，补契约留到下轮。

## 关键决策记录

- 2026-08-24 范围收敛为 **3 端**（desktop / android / ios）：`apps/web/src` 下 grep `ReadReceipt|readReceipt` 命中的全是个人 AI 框语境的 unread，web 不参与 IM 已读回执。
- 2026-08-24 只查「已读回执」，**不查自己的未读数 / 红点多端同步**：用户确认后者不是本次现象；两套机制确有耦合，但一起查范围翻倍。
- 2026-08-24 本轮**只出分析报告，不加埋点不出包**：无复现路径，埋点也拿不到触发场景，先把代码事实摸清再决定埋在哪。
- 2026-08-24 调查法选「先纵后横」：纵切产出带 `文件:行号` 的事实表（下轮修复可直接复用），横切成阶段矩阵暴露三端不对称。
- 2026-08-24 不反编译安卓 jar/so：改用「调用层代码 + iOS 公开头文件 + PC 明文 adapter」三角互证。
- 2026-08-24 智能体 / 机器人会话的已读跳过逻辑纳入范围（PC `msg-list.vue:2643`）：它是阶段③的过滤条件，直接决定某些私聊会话永不回执。

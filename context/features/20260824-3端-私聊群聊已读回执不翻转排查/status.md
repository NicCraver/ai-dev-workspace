# Status：3端-私聊群聊已读回执不翻转排查

> 最后更新：2026-08-25（C1+I1~I7 已修完 8 commit，HEAD `aff6aaaf`；真机验收未跑）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 本轮性质

审计阶段已结束（主交付 `findings.md`）。2026-08-24 起进入 **PC 已读回执加固实现**（分支 `apps/desktop` 的 `fix/pc-read-receipt-hardening`）。web 端不参与 IM 已读回执，故全列 `—`。

> 2026-08-24 同日旁路（**不属于本功能**）：web 个人 AI 框 Markdown 行内 `` `code` `` 去掉 prose 伪元素反引号，改成浅底胶囊。代码在 `apps/web` 的 `feat/web-markdown-table-align-pc`，不改三端 IM 回执。
>
> 2026-08-24 再一条旁路（**不属于本功能**）：安卓智能体 `ZX:ActionCardMsg` 带引用前缀时 GFM 表格退化成管道符。修在 `apps/android` 的 `feat/gfm-markdown`，见 `20260814-pc安卓-GFM-Markdown渲染对齐`。不改三端 IM 回执。
>
> 2026-08-24 第三条旁路（**不属于本功能**）：安卓复制 `@个人智能体` 粘贴后筛选条/发送走群。修在 `apps/android` 的 `feat/gfm-markdown` 工作树（`MentionAgentKindResolver`），见 `20260728-安卓端@个人AI框`。不改三端 IM 回执。**与 GFM 改动不要混提交。**
>
> 2026-08-24 第四条旁路（**不属于本功能**）：iOS 智能体「回复 @xx：」叠在表格第一行上。修在 `apps/ios` 的 `feat/ios-file-download-progress`（该分支已合入 GFM），见 `20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化`。不改三端 IM 回执。
>
> 2026-08-24 第五条旁路（**不属于本功能**）：`ZX:ActionCardMsg` 内联 HTML，iOS 不认 `<mark>`、安卓没有背景色。修在 `apps/ios` 的 `feat/ios-file-download-progress` 与 `apps/android` 的 `feat/gfm-markdown`（只动 `SpanTagHandler` + 单测）。见两个 GFM 功能目录。不改三端 IM 回执。**安卓提交时不要带上 mention 那几份。**
>
> 2026-08-25 第六条旁路（**不属于本功能**）：同上一样本文，iOS / 安卓高亮有底色但偏下、没有上下居中。行距 extra 加在字下面，系统按整行盒子填背景。安卓改自绘字形盒；iOS 换 LayoutManager 从底部裁到字形行高。仍不改三端 IM 回执。
>
> 2026-08-25 第七条旁路（**不属于本功能**）：web 个人 AI 框内联 `<span style="background-color;padding;border-radius">` 无样式。Tiptap 只收下字色。修在 `apps/web` 的 `feat/web-markdown-table-align-pc`（`ExtendInlineSpanStyle`）。见 `20260820-web端的-markdown对其pc，你先收集信息`。不改三端 IM 回执。
>
> 2026-08-25（**本功能**）：Opus 5 终审 1 Critical + 7 Important 已全修，8 个独立 commit（C1→I1→I2→I3→I4→I5→I6+I7），HEAD `aff6aaaf`。报告 `.superpowers/sdd/receipt/fix-report.md`。真机验收仍未跑。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec 定稿 | — | ✅ | ✅ | ✅ |
| 纵切：私聊已读链路测绘 | — | ✅ | ✅ | ✅ |
| 纵切：群聊已读链路测绘 | — | ✅ | ✅ | ✅ |
| 纵切：SDK 初始化配置 | — | ✅ 两类会话都开回执（`RongMessageInit.java:118-123`）；`readReceiptTimeout` 未显式设置 | ✅ 未找到显式设置 | ✅ 已传 `{ readReceiptTimeout: 15 }`（`IMSDKServer.js:15`，Task 9） |
| 横切：6 阶段 × 2 机制对比矩阵 | — | ✅ | ✅ | ✅ |
| 18 格组合推演 | — | ✅ | ✅ | ✅ |
| 可疑点 A/B/C 定级 | — | ✅ | ✅ | ✅ |
| `findings.md` 成稿 | — | ✅ | ✅ | ✅ |
| HTML 汇报（`report.html`） | — | ✅ | ✅ | ✅ |
| 展示层专项（electron-store 数据流） | — | ✅ | ✅ | ✅ |
| 复现路径手册（`repro.md`，6 条） | — | ✅ | ✅ | ✅ |
| 加固方案分批（第一批/第二批） | — | ✅ | ✅ | ✅ |
| 修复方案选型 | — | — | — | ✅ 定为三层方案（见下） |
| **PC 加固实施（Task 0~11）** | — | — | — | ✅ 11 个 commit，单测 43/43，lint exit 0 |
| **PC 加固副作用审查（对原有功能）** | — | — | — | ✅ 2026-08-25 Opus 5 子代理完成：1 Critical + 7 Important + 8 Minor + 14 条已排除 |
| **审查 findings 修复（C1 + I1~I7）** | — | — | — | ✅ 8 个 commit，HEAD `aff6aaaf`，vitest 43/43，lint exit 0 |
| **真机验证（全部未做）** | — | ⬜ | ⬜ | ⬜ **卡这里**，见 `acceptance.md` |

## PC 加固实施结果（2026-08-24）

分支 `fix/pc-read-receipt-hardening`，从 `origin/release` **613af430** 切出（不含 GFM Markdown 那 20 个 commit，可独立发版）。

| Task | 内容 | commit |
|---|---|---|
| 1 | 已读时间合并 + 私聊已读解析 | `d02faddd` |
| 2 | 群回执候选筛选 + 名单合并 | `e7393131` |
| 3 | 服务端返回归一化 | `650e5792` |
| 4 | 可观测计数器 `window.__receiptMetrics` | `0297ff61` |
| **4B** | **表态/回复反推已读**（用户中途追加的增补机制） | `63501144` |
| 5 | 私聊显示去日期册门槛 + 册子按需补载 | `0f4db746` |
| 6 | 私聊回执去 `isFirstScreen` + 窗口聚焦触发 | `17f04acc` |
| 7 | 群回执口径对齐安卓/iOS（**A1 修复**） | `c6bc1cc1` |
| 8 | 群回执入库改单调更新 + 两处判定统一 | `288682c0` |
| 9 | 回执有效期 15 天 / 修 switch fallthrough / 修 SRSMsg 包装 | `cc68cec3` |
| 10 | 服务端权威源接入 + 反推接线 | `8ec3451e` |
| **终审 C1** | 群名单未登记返回 null，修 @ 误显已读勾 | `28529f22` |
| **终审 I1** | focus 补发已读加路由守卫 | `02a20812` |
| **终审 I2** | 历史浏览态不发已读 | `65d069dd` |
| **终审 I3** | @所有人+@某人 继续判 atUserList | `b8413df0` |
| **终审 I4** | 补回群回执多端角标清零 | `603681c3` |
| **终审 I5** | 记 readReceiptTimeout 放宽的权衡（不改 15） | `0049ad8f` |
| **终审 I6+I7** | 群回执节流+去重 | `aff6aaaf` |

**核验结果（Task 1~10）**：单测 43/43 绿、`npm run lint` exit 0、**全分支无禁忌文件**。
**核验结果（终审 C1+I1~I7）**：8 个独立 commit，vitest 43/43，lint exit 0，禁忌文件检查 `OK 无禁忌文件`。HEAD `aff6aaaf`。GUI/真机未跑。

### 实施过程中的两条勘误

- 计划写「测试 10 个用例」，实际是 9 条 `it()`（4+5）。实现者拒绝造假用例凑数，判断正确。
- 计划写「模板 4 处 `:msgReceipt` 绑定」，实际只有 3 处属性绑定（339/434/450，已全改）。
  第 4 处（560-561）是「已读 N/M」文案的 `v-if` 门槛，不是 prop。功能无缺口——
  合并结果的名单键来自本地表，本地没登记时合并也是空，文案本就不显示。

## 副作用审查结论（2026-08-25，Opus 5 子代理）

审查包 `.superpowers/sdd/receipt/review-package.md`（11 commit / 10 文件 / +912−110），
修复任务书 `.superpowers/sdd/receipt/fix-brief.md`。**用户选择全修（C1 + I1~I7）。**

### Critical

**C1 · 群里所有带 @ 的消息误显示「已读」绿勾**（`readStateModel.js:137-152` + `msg-list.vue:3038-3046` + 模板 339/434/450）

`mergeGroupReceiptEntry` 恒返回 `{}`（truthy）。改前模板传 `groupReceipt && groupReceipt[uid]`，
未登记时是 `undefined` → prop default `null` → 假值。子组件条件
`msgReceipt && ... && msgReceipt[row.userId] !== 0` 里 `{}[uid]` 是 `undefined`，
`undefined !== 0` 为 true → 渲染 `msg-read.png`。

**旁观者看别人的 @ 消息也会出现绿勾**；首帧 `groupReceipt` 为 `null` 时全部 @ 先显示已读、2 秒后翻回，还会闪。

> **控制端此前的判断有误**：8/24 我在 Task 10 复核时说「功能无缺口」——那句只对
> 「已读 N/M」文案的 `v-if`（它仍挡在原始 `groupReceipt` 上），漏了 `:msgReceipt` 这条 prop 路径。

### Important（4 条是回归）

| # | 问题 | 位置 | 回归 |
|---|---|---|---|
| I1 | `focus` 补发已读无路由守卫。聊天面板常驻挂载（`main.vue` 用 `v-show`，不在 keep-alive 内），切到邮箱面板后 focus 照样触发 → **清掉用户没看过的消息角标** | `msg-list.vue:891-904` | ✅ |
| I2 | 去掉 `!isFirstScreen` 后，历史浏览态（`GetIsGetHistoryStatus` 为真时 `messageList` 返回 `tempMessageList`）向下翻页会拿"窗口内最新"当"会话最新"，**清零整个会话角标** | `msg-list.vue:2686` | ✅ |
| I3 | `@所有人 + @某人` 组合：`mentionedInfo.type` 是 ALL 但被点名的人照样进 `atUserList` 且已登记；新代码 ALL 分支直接 `return hasAllList` 就走，**不发 RRReqMsg** → 永远 0/N。旧代码是好的 | `messageService.js:307-315` | ✅ |
| I4 | switch 拆开后丢了 `UpdateReminderMap` self 判断 → **手机读群消息后 PC 角标不再清零**（旧代码靠 fallthrough 执行） | `ReceiveMessageListener.js:246-266` | ✅ |
| I5 | adapter 收 RRRspMsg「**窗口外原样放行、窗口内才裁剪**」。放宽到 15 天把一部分原本蒙混过关的离线回执关进裁剪逻辑 | `IMSDKServer.js:15` | |
| I6 | 群回执用 `clearTimeout` 纯防抖，**活跃群（消息间隔 <1s）一条都发不出去** | `msg-list.vue:1511-1518` | |
| I7 | 候选集放宽后 `receiptMessageDic` 随会话时长单调增长，大群里往几十 KB 走且全群扇出 | `msg-list.vue:1494-1519` | |

> I5 无干净代码修法（SDK 在 app 看到消息前就改写了 dic），只做注释文档化 + 列为验收观测项，**不动 15 这个值**。

### 已核查并排除的 14 项（摘要）

- **最高风险项排除**：`init(AppKey, null, {...})` 安全——实读 adapter `init:function(e,t,n)`，
  第二参 `t` 在函数体内**从未被引用**，传 null 等价于不传。初始化不会坏。
- 新增的 `RC:RRReqMsg` / `RC:SRSMsg` 映射**不构成行为变更**——adapter 的 `GL` 表本来就有这两条，
  改前就没落进 `UnknownMessage`。（控制端派单时的担心不成立。）
- 删掉的 `Object.keys(groupStore).length === 0` 确是死代码（Conf 实例键恒为 4 个）；
  删掉的数组当 key 那行不落盘、纯内存脏数据。
- `ensureReadTimeDates` 不泄漏 fd、不创建空文件、不显著拖慢启动。
- 回执类消息不污染角标/会话列表（adapter `ra` 表里三类全是 `isCounted:!1, isPersited:!1`）。
- fallthrough 拆开除 I4 外无损；`SyncReadStatusMessage` 改传纯对象正确；≤10 人群 @所有人 未被误伤。
- `focus` 无重复注册（`activated` 因不在 keep-alive 内是死代码）；`__groupReceiptTimer` 句柄管理正确。
- 8 个改动文件全文无 `?.` / `??`；eslint 零告警；vitest 43/43。

### Minor（留待终审，未修）

- Task 10 的探测 `console.log` 仍在代码里（有意保留，验收时要读）
- `hasPerUserDetail` 只要有任意 `accountId` 就置 true，而请求本身就带自己的 `accountId`
  → 探测结论可能误导（功能无害）。建议判据改成「存在 accountId ≠ 当前用户」
- **`msg-list.vue:1055-1069` 的 `innerReadTime` 回填仍被日期册门槛挡着**——Task 5 只修了 `getStatusText` 那一半
- `provide.getGroupReceipt` 仍返回未合并的 `groupReceipt`（子组件 inject 已注释，无实际影响）
- `messageActions.js` 从 store 反向 import components 下的模块，分层不佳（无循环依赖）
- 切群时 `serverGroupReceipt` 无竞态保护（按全局唯一 messageUId 索引，最多少显示不会串数据）
- `getStatusTextColor` 内部调 `getStatusText`，单条私聊消息每渲染跑 3 次 `extractExpansionReaders`，
  群聊每条 `bySelf` 消息跑 7 次 `getMergedGroupReceipt`。**估算可接受**；若验收时列表卡顿，这里是第一嫌疑

### 审查者建议的真机必测项（已并入 acceptance.md 待补）

1. 群里**别人发的** @ 消息，@名字后不应有任何已读/未读图标（C1）
2. 打开会话 → 切邮箱面板 → 收新消息 → alt-tab 出去再回来 → 角标不应被清（I1）
3. 从搜索跳进 3 个月前历史 → 下翻 → 会话角标不应清零（I2）
4. \>10 人群发「@所有人 @某人」→ 对方读后应变 1/1（I3）
5. 手机读群消息 → PC 该群角标应清零（I4）
6. 活跃群里 `groupReceiptSent` 不应长期为 0（I6）
7. 全程盯 `groupRespEmptyForMe` / `groupRespApplied` 比值（I5/I7）

### 未决项

**`chatType: 2` 是否含按人明细仍未知**（全程无 GUI 验证）。
代码按「有明细 / 无明细」两分支兼容，用 `hasPerUserDetail` 做门闩；无明细时群聊退化为仅本地回执，
**与改动前持平、不会更差**。起 PC 打开任意群，Console 会打印
`[receipt] 群已读服务端返回 条数=N 含按人明细=true/false`，读到后回填 `acceptance.md` 的「零」节。
| PC 加固 Task 1：已读状态纯逻辑模块（`mergeReadTime` / `resolvePrivateReadTime`） | — | — | — | ✅ `d02faddd`，vitest 9/9 |
| PC 加固 Task 2：群回执候选筛选与名单合并（`isAgentOrRobotId` / `pickGroupReceiptCandidates` / `buildReceiptMessageDic` / `mergeGroupReceiptEntry`） | — | — | — | ✅ `e7393131`，vitest 25/25 |
| PC 加固 Task 3：服务端已读返回归一化（`normalizeServerReadList`） | — | — | — | ✅ `650e5792`，vitest 31/31 |
| PC 加固 Task 4：可观测计数器（`receiptMetrics.js`，挂 `window.__receiptMetrics`） | — | — | — | ✅ `0297ff61`，eslint 无 error；零接线 |
| PC 加固 Task 4B：表态/回复反推已读（`extractExpansionReaders` + `mergeGroupReceiptEntry` 第三源） | — | — | — | ✅ `63501144`，vitest 43/43；零接线 |
| PC 加固 Task 5：私聊显示去门槛 + 已读册子按需加载（`ensureReadTimeDates` + `resolvePrivateReadTime` 接线） | — | — | — | ✅ `0f4db746`，eslint 无 error；**未执行 GUI 验证** |
| PC 加固 Task 6：私聊回执去掉 `isFirstScreen` 门槛 + 窗口聚焦补发（`msg-list.vue` `ReadLastMessage`） | — | — | — | ✅ `17f04acc`，eslint 无 error；**未执行 GUI 验证** |
| PC 加固 Task 7：群阅读方口径对齐安卓/iOS + 补会话切换触发点 | — | — | — | ✅ `c6bc1cc1`（上一任务已提交，本回合补记矩阵）；**未执行 GUI 验证** |
| PC 加固 Task 8：群回执入库放宽为单调更新 + 大群@所有人不发无用请求 | — | — | — | ✅ `288682c0`，eslint 无 error；**未执行 GUI 验证** |
| PC 加固 Task 9：回执窗口 15 天 + switch fallthrough + 消息映射 + SRSMsg 去包装 | — | — | — | ✅ `cc68cec3`，eslint 无 error；**未执行 GUI 验证** |
| PC 加固 Task 10：服务端权威源接入（chatType:2 探测 + 表态/回复反推接线） | — | — | — | ✅ `8ec3451e`，eslint 无 error；**未执行 GUI 验证，chatType:2 探测结论未知** |

## 各端工作区现状（2026-08-25，`scripts/code-status.sh`）

| 端 | 分支 | 同步 | 脏区 | 与本功能关系 |
|----|------|------|------|--------------|
| context | `main` | ahead origin/main 224 | 脏 23：打包命令/`pack` 脚本、`markdown-style-tokens.md`、web Markdown 功能 status；本功能只动 status | 本功能本回合只更新 status。命令/脚本/Markdown token **无关**，不要跟这次一起提交 |
| web | `feat/web-markdown-table-align-pc` | synced | 脏 1：未跟踪 `aaaaaaa.md` | **无关**。行内代码胶囊已在 `92efddc`；剩下是草稿文件，不是 IM 回执 |
| android | `feat/gfm-markdown` | synced | 脏 8：`ActionCard`/`SpanTagHandler`/引用消息 Markdown + 未跟踪 `MentionAgentKindResolver` 与 `IM/src/test/`，另有 `IM/build.gradle` | **无关**：GFM + 「粘贴个人 @ 误识别为群」。见 `20260814-pc安卓-GFM-Markdown渲染对齐` / `20260728-安卓端@个人AI框`。**mention 不要和 GFM 混提交** |
| ios | `feat/ios-file-download-progress` | synced | 脏 2：`ZXMarkdownContentView.m`、`ZXMarkdownManager.m` | **无关**：GFM「回复 @」与表格。见 `20260813-ios-机器人与智能体消息-GFM-Markdown渲染优化` |
| desktop | `fix/pc-read-receipt-hardening` | ahead origin/release 19（HEAD `aff6aaaf`） | 脏 3 | **本功能**：Task 1~10 + 终审修复 8 commit 已提交。脏 3 仍是本地打包配置，**禁止提交**：`.env.test` / `electron-builder.yml` / `package.json` |

> 2026-08-25 终审 findings 已修完（8 commit，HEAD `aff6aaaf`）。desktop 工作区脏 3 个禁忌文件未动。web / 安卓 / iOS 脏区仍是 Markdown / @ 识别旁路，不是 IM 回执。未做 web 联调，不改 `impl-notes.md`。

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

## 推荐方案（2026-08-24 定稿，取代下方早期的 A/B/C 三选一）

> **2026-08-24 修订**：用户澄清「>10 人不显示已读是需求」，原第 1 层（恢复大群 @所有人 已读）**作废**，
> 降级为「让两处判定一致、别发无用请求」。第 2 层升为首要。

### 核心判断

PC 是三端里唯一不用融云 SDK 原生回执 API 的一端——发送方登记、阅读方筛选、回执入库全自研。
自研与 SDK 原生的**口径差**才是根，逐条打补丁治不住。

### 第 1 层 · 两处判定统一（对齐需求，非功能恢复）

`shouldRequestGroupReadReceipt`（发不发请求，`messageService.js:295-318`）与
`setNeedReceipt`（登不登记，`storeModule/index.js:116-151`）今天各判各的：
大群 @所有人 时前者放行、后者不登记 → **请求发出去了，回执一定丢弃**，纯浪费，还让对方端做无用回执。

抽成一个纯函数供两处共用。按需求，大群 @所有人 直接不发 `RC:RRReqMsg`。

- 收益：去无用流量；结构上杜绝两处条件再走偏
- 风险：极低

### 第 2 层 · PC 阅读方口径对齐另两端（修 A1，**当前首要**，代码确定但未实测）

去掉 `msg-list.vue:1433-1446` 的类型白名单与 `extra` 非空要求，改为与安卓 / iOS 同口径。

- 即使 R8 测不出来也该改：三端阅读方口径不一致本身就是缺陷，PC 是最窄的一端
- 风险：低。多发几条回执，SDK 收端自带去重

### 第 3 层 · 服务端做权威源（治本，需先验前提）

打开会话按 `chatType` 拉 `datasyn/getReadMessage`（群聊传 2），用 `accountId` 维度重建群已读；
electron-store 降为缓存，冲突取已读时间较大者。

- 收益：换机可恢复、三端同源、不受融云 15 天窗口限制
- **前提**：`chatType: 2` 返回需含按人明细（模型里有 `accountId`，机制支持，未实测）

### 附带三条一行改动

| 改什么 | 位置 |
|---|---|
| `readReceiptTimeout` 1 天 → 15 天 | `IMSDKServer.js:11` |
| `switch` 漏 `break` + 重复 case | `ReceiveMessageListener.js:246-264` |
| `SyncReadStatusMessage` 消息体多包一层 | `messageService.js:545-553` |

### 排除的两条路

- **只修本地存储**：治不了 B1（问题在发送侧不在存储侧），也治不了换机丢失。
- **全面改用融云 SDK 原生**：PC 是 v2 adapter，按人明细在 SDK 私有 localStorage
  （`` `${myId}${messageUId}SENT` `` → `{userIds:{...}}`）。读它等于依赖未公开实现，而 8/19 已确认那块**不能写**
  （SDK 构造时整表读进内存，外部写会被覆盖）。不可靠。

### 排期

| 批次 | 内容 | 依赖 |
|---|---|---|
| 立刻 | 验 `chatType: 2` 返回（不写代码，10 分钟） | 无 |
| 第一批 | 第 1 层 + 第 2 层 + 三条一行改动 + 可观测埋点 | 无，纯 PC 端 |
| 第二批 | 第 3 层 | 取决于上面的验证结果 |

**B1 出局后，目前没有任何一条缺陷有实测证据。** 已实测的三项（happy path、8/6 老消息、R7）全部是「正常」或「符合需求」。
汇报时必须如实说明：所有待修项都是代码级判断，未经实测复现。**当务之急是跑 R8 / R3 拿到第一个实测阳性。**

## 加固版分批（2026-08-24 早期版本，已被上方「推荐方案」取代，保留作演进记录）

用户当前处境：**复现不了，但要向领导汇报并出加固版**。结论是不等复现直接加固，分两批。

### 第一批 · 低风险纯收益，全部只动 PC，不依赖任何未验证前提

| 改什么 | 对应结论 | 改动量 | 风险 |
|---|---|---|---|
| 私聊已读存储不再只加载 4 天窗口（`storeModule/index.js:38-51`） | D2 | 小 | 极低 |
| `readReceiptTimeout` 1 天 → 15 天（`IMSDKServer.js:11`，SDK 上限） | B4 | **一行** | 极低 |
| 去掉私聊回执的滚动位置门槛（`msg-list.vue:2587-2589`） | A2 | 小 | 低，最多多发几次回执 |
| 修 `switch` 漏 `break`、补 `RC:RRReqMsg`/`RC:SRSMsg` 映射、修 `SyncReadStatusMessage` 双重包装 | C1/C2/C3 | 小 | 低，都是明确写错 |

### 第二批 · 需先验证或跨端协调

| 改什么 | 对应结论 | 卡在哪 |
|---|---|---|
| 放宽 PC 群回执消息类型白名单 | A1 | 要先确认哪些类型真会带 @ |
| 统一 PC 群回执登记条件 | B1/B3 | 要先看「@所有人」消息的实际 `extra` 结构 |
| 服务端做权威源，换机可恢复 | D1/D3/D4 | **卡在 `chatType:2` 返回是否含按人明细，未验** |
| 安卓引用消息补发回执请求 | A3 | 需安卓出包 |

### 必须配套：可观测

现状是「用户报问题 → 拿不到现场 → 只能读代码」。加固版发出去后若用户仍报，**分不清是没修对还是修漏了**。
建议 PC 端加关键节点计数（回执发出 / 收到 / 被丢弃次数），出问题时可导出。不是用户功能，是留现场。

### 承诺边界（汇报时不可省）

修的是代码上确定存在的缺陷，能保证**这几条路径**不再出问题；但因原问题无法复现，
**不能断言用户遇到的就是这几条**。配合可观测，发版后观察 2 周闭环。

## 实测进展

| 日期 | 测了什么 | 结果 | 影响 |
|---|---|---|---|
| 2026-08-24 | 用户在三端各发消息、各端去读（**happy path**） | 全部正常翻转，未复现 | 符合预期——所有缺陷都是条件触发，happy path 一条都不碰 |
| 2026-08-24 | PC 翻 **8/6**（4 天窗口外、6 个月内）自己发的私聊消息 | **显示已读** | **D2 降级、D1 私聊部分降级、`repro.md` R1 作废**。融云本地库持久化了 `sentStatus=READ`，册子缺失只丢已读时间戳 |
| 2026-08-24 | **R7**：PC 在群里发 @某人 与 @所有人，手机读 | @某人 已读**正常翻转**；@所有人 **未登记、名单 undefined** | **B1 坐实**（卡点订正为 `storeModule/index.js:141-143` 名单为空 return，不是 `atUserList` 判空——`[]` 是 truthy）。但 @所有人 界面本就不显示已读图标（`msgtype/msg-txt.vue:52-73` 两个 `v-if` 都要 `msgReceipt` 非空），**大概率不是用户抱怨的现象**。「群 + PC 发 + @某人 + 手机读」路径**排除** |
| 2026-08-24 | Task 10 起应用读 `chatType:2` 探测（`npm run dev:test` 开群聊看 Console） | **未执行 GUI 验证，chatType:2 探测结论未知** | Node v24.19.0 webpack OpenSSL 失败，窗口未起。`fetchServerGroupReceipt` 的 `console.log` 已保留，待 Node 14 环境人工补跑 |
| 2026-08-25 | 审查 PC 加固 11 commit 对原有功能的副作用 | Opus 5 子代理完成：1 Critical + 7 Important | 用户选全修 |
| 2026-08-25 | 修 C1 + I1~I7 | 8 个独立 commit，HEAD `aff6aaaf`，vitest 43/43，lint exit 0 | 真机验收仍未跑 |

### B1 根因定位到源头：`send-box.vue` 的 10 人硬上限

`apps/desktop/src/renderer/components/chitchat/sendbox/send-box.vue:1597-1605`：

```js
if (atAllList.length) {
  const allPeopleList = [...this.currentGroup.groupMembers];
  allPeopleList.push(this.currentGroup.owner);
  const peopleIdList = allPeopleList.filter(item => item != this.GetSendUser.id);
  if (peopleIdList.length <= 10) {        // ← 硬编码 10 人上限
    atAllUserList = peopleIdList;
  }
}
// :1728
source.extra = { atAllList, atUserList, ...(atAllUserList && { atAllUserList }), richList };
```

**群成员 > 10 人时 `atAllUserList` 根本不写进 `extra`** —— 与实测输出 `atAllUserList: undefined` 完全吻合（用户测的群 >10 人）。

完整因果链：

| 步骤 | 位置 | 结果 |
|---|---|---|
| 1 | `send-box.vue:1603` | 群 >10 人 → `atAllUserList` 不入 extra |
| 2 | — | `atUserList` 为空数组（@所有人 无具体被 @ 人） |
| 3 | `storeModule/index.js:127-143` | 名单构造为空 → `return`，**不登记** |
| 4 | `messageService.js:300` | 但 `mentionedInfo.type === 1` 放行，**RRReqMsg 照发给对方** |
| 5 | `storeModule/index.js:169-171` | 对方回执回来，查不到登记 → 静默丢弃 |
| 6 | `msgtype/msg-txt.vue:52-73` | `msgReceipt` 为 undefined → 不显示任何图标 |

**分界线**：≤10 人的群 @所有人 正常，>10 人的群 @所有人 无已读。

> **2026-08-24 用户澄清：「大于 10 人不显示是需求」。**
>
> **B1 出局，不是缺陷。** `send-box.vue:1603` 的 10 人上限是产品有意为之，>10 人群 @所有人 不显示已读属预期行为。
> 上面的因果链保留作机制记录，但**不作为待修项**。
>
> **唯一残留的真问题**：`shouldRequestGroupReadReceipt`（`messageService.js:300`）在 `mentionedInfo.type === 1` 时
> 无条件放行，**照样把 `RC:RRReqMsg` 发给对方**。既然本机注定不登记、回执一定丢弃，这条请求就是纯浪费——
> 还会让对方端（安卓 / iOS）做一次无用回执。应与「登不登记」用同一判定，大群 @所有人 直接不发请求。
> 性质是**对齐需求 + 去无用流量**，不是恢复已读功能。
>
> 待确认：安卓 / iOS 在 >10 人群 @所有人 时是否同样不显示已读。若显示，则是三端产品行为不一致（产品问题，非本次缺陷）。

**由此得到的关键推论**：

- **私聊**显示「未读」**只可能是回执没到达发送方**，不是显示层丢失 → 集中查 A2（R3）与 B4（R6），显示层不必再查。
- **群聊**反而升级：群「已读 N/M」是纯 electron-store，**无融云兜底**，D1 / D3 / B1 / B3 一旦命中就是必现。
- 下一步优先跑 **R7**（PC 发 @所有人，验 B1/B3）——单机就能出结论，不用等对方读。

## 待办 / 阻塞

- (desktop) **2026-08-25 终审 findings 已修完**：C1 + I1~I7 共 8 个 commit（`28529f22`…`aff6aaaf`），vitest 43/43，lint exit 0，全分支无禁忌文件。详见 `.superpowers/sdd/receipt/fix-report.md`。**下一步是真机验收**（见 `acceptance.md` 与审查者 7 条必测）。
- (desktop) **PC 加固 Task 1 已完成**（`d02faddd`）：`readStateModel.js` 抽出 `mergeReadTime` / `resolvePrivateReadTime`，vitest 9 passed。零接线。
- (desktop) **PC 加固 Task 2 已完成**（`e7393131`）：同模块追加 `isAgentOrRobotId` / `pickGroupReceiptCandidates` / `buildReceiptMessageDic` / `mergeGroupReceiptEntry`，vitest 25 passed（含 Task 1 的 9 条）。仍零接线，线上群回执筛选行为不变；后续任务接到 `msg-list.vue` 才修 A1。
- (desktop) **PC 加固 Task 3 已完成**（`650e5792`）：同模块追加 `normalizeServerReadList`，兼容 `msgUID`/`readMsgUID` 与有无 `accountId` 两种形态，vitest 31 passed。仍零接线；`hasPerUserDetail` 留给后续权威源任务决定群聊那半边能不能用服务端明细。`chatType: 2` 是否下发按人明细仍未实测。
- (desktop) **PC 加固 Task 4 已完成**（`0297ff61`）：新建 `receiptMetrics.js`（`bump`/`snapshot`/`dump` + 12 个预留计数键），eslint 无 error。模块加载时挂 `window.__receiptMetrics`，但当前零 import，开发者工具里现在还调不到。后续接线任务必须 import 并在发出/跳过/拦截/收到/丢弃/写入处 `bump`，否则加固版上线后仍无法用 dump 区分三种失败。
- (desktop) **PC 加固 Task 4B 已完成**（`63501144`）：同模块追加 `extractExpansionReaders`，并把 `mergeGroupReceiptEntry` 扩展为第三可选参数 `inferredEntry`（不传则行为与 Task 2 一致）。vitest 43 passed（含 Task 2 留下的 5 条老合并用例，改写后仍全绿）。Task 10（`8ec3451e`）已把推断源接到 `getMergedGroupReceipt` / `getStatusText`；GUI 未验，表态/回复反推是否真能翻转「未读」待人工看。
- (desktop) **PC 加固 Task 5 已完成**（`0f4db746`）：第一个接线任务。`storeModule` 新增 `ensureReadTimeDates`；`msg-list.vue` 的 `getStatusText` 改走 `resolvePrivateReadTime`（服务端兜底不再被册子缺失短路），`msgLength` watcher 条数变化时按需补载超窗口册子。eslint 无 error。**未执行 GUI 验证**（未能起 Electron 窗口翻历史私聊）。`pickGroupReceiptCandidates` / `buildReceiptMessageDic` / `receiptMetrics` 已 import 但本任务未调用。
- (desktop) **PC 加固 Task 6 已完成**（`17f04acc`）：`ReadLastMessage` 去掉 `!isFirstScreen` 门槛、保留 `showDownMsg`；发出 / 跳过智能体 / 拦截三条路径 `receiptMetrics.bump`；`mounted` 里 `window` `focus` 补发已读，清理加进已有 `beforeDestroy`（未新建第二个同名钩子；无 `destroyed`）。eslint 无 error。**未执行 GUI 验证**（`npm run dev:test` 在 Node v24 下 webpack OpenSSL 失败，窗口未起）。
- (desktop) **PC 加固 Task 7 已完成**（`c6bc1cc1`，本回合补记）：群阅读方口径对齐安卓/iOS，补会话切换触发点。**未执行 GUI 验证**。
- (desktop) **PC 加固 Task 8 已完成**（`288682c0`）：`setGroupReceipt` 放宽为「名单里有这个人且新时间更大」；删掉 `needReceiptMap[groupId][messageUIds] = sentTime` 脏 key；`HandleGroupMsgResp` 接入 `receiptMetrics`；`shouldRequestGroupReadReceipt` 对 @所有人要求 `atAllUserList` 非空。eslint 无 error。**未执行 GUI 验证**（`npm run dev:test` 在 Node v24 下 webpack OpenSSL 失败，窗口未起）。
- (desktop) **PC 加固 Task 9 已完成**（`cc68cec3`）：`RongIMClient.init(AppKey, null, { readReceiptTimeout: 15 })`；`ReceiveMessageListener` 的 `ReadReceiptResponseMessage` 只保留一处且补 `break`；`MsgObjectNameEnum` 补 `RC:RRReqMsg` / `RC:SRSMsg` 正反向映射；`SyncReadStatusMessage` 改传纯对象。eslint 无 error。**未执行 GUI 验证**（`npm run dev:test` 在 Node v24 下 webpack OpenSSL 失败，窗口未起）。
- (desktop) **PC 加固 Task 10 已完成**（`8ec3451e`）：最后一个接线任务。`getReadMessage` 补 chatType 注释；私聊/群聊 watcher 都拉服务端已读；`serverGroupReceipt` + `fetchServerGroupReceipt`；展示 `getMergedGroupReceipt` / `getStatusText` 合并本地 + 服务端 + 表态/回复反推。模板 `:msgReceipt=` 实际 3 处（`:339` `:434` `:450`）全部改走合并。eslint 无 error。**未执行 GUI 验证，chatType:2 探测结论未知**（同 Node 24 OpenSSL）。
- (desktop) **R8 待跑（当前第一优先）**：**手机发 @ 消息 → PC 去读 → 手机看已读**。
  至此所有实测都是 PC 发、手机读，**PC 当阅读方一次没测过**，而 A1 只在这个方向发作。
  测法：PC 收到手机发的 @ 消息后，在 devtools 里核对 `msg-list.vue:1433-1446` 的三个筛选条件
  （`messageType ∈ {TextMessage, ReferenceMessage}`、`content.extra` 非空、`!isLocalMessage`）是否全部满足。
  任一不满足 → PC 静默不回执 → 手机侧永远未读，**即 A1 坐实**。
- (desktop) ~~R7 待跑~~ —— 已跑完，见上表。B1 坐实但界面无感；@某人 路径排除。
- (desktop) ~~R1 的界面表现尚未亲眼确认~~ —— 已确认，结果为「已读」，见上表。文件与代码的矛盾已核实（本机 `electronStore/1478260773032583169/` 下存在
  `msgReadTime-20260817/18/19.json`，8/19 那份有 5 条记录；而 `refreshReadTimeState` 今天只加载 20260822~20260825），
  但「界面显示未读」是推断出的后果，**没点开看过**。汇报前应补这 1 分钟的确认，口径写「代码层面已坐实，界面表现待确认」。
- (跨端) **卡在方案选型**，已向用户摆了三个方案待选：
  **A**（推荐）服务端 `datasyn/getReadMessage` 做权威源、本地存储降级为缓存，三端同源；
  **B** 只补本地存储的洞（不解决换机丢失与跨端一致）；
  **C** 以融云 `readReceiptInfo` 为准（治标，且 PC 的 v2 adapter 与原生 5.x 不同源）。
  倾向 A + B 里的 B1/B3 必修项（D3 那层服务端救不了）。
- (阻塞 A) **`chatType: 2` 的返回是否含按人明细，仍未验证**——Task 10 已接线（`hasPerUserDetail` 为 true 才落地群名单，false 则退化为仅本地回执）。本回合 GUI 未起，探测结论未知。人工补跑：Node 14 下 `npm run dev:test`，开任意群聊看 Console `[receipt] 群已读服务端返回 条数= N 含按人明细= true/false`。`含按人明细= false` 时再记「需后端补群维度按人已读查询」。
- (跨端) **全部结论未经真机验证**，A 级也只是「代码上必然」。下一步按性价比：先验 A2（PC 本地 `npm run dev:test` 即可，无需出包）→ 再验 A1（需 iOS 配合发非纯文本 @ 消息）→ B1/B3 一起（devtools 看一次 @所有人 消息的 `extra` 结构）→ A3 最后（需安卓出包）。
- (跨端) 审计阶段未改 IM 回执代码；2026-08-24 起 PC 加固 Task 1+2+3+4+4B 已提交纯逻辑模块，Task 5（`0f4db746`）已把私聊已读时间接到 `msg-list` / `storeModule`，Task 6（`17f04acc`）去掉 `isFirstScreen` 门槛并补窗口 focus 触发点，Task 7（`c6bc1cc1`）群阅读方口径对齐，Task 8（`288682c0`）群回执入库放宽并统一大群 @所有人 判定，Task 9（`cc68cec3`）回执窗口 15 天、修 switch fallthrough、补消息映射、SRSMsg 去包装，Task 10（`8ec3451e`）接入服务端权威源并把表态/回复反推接到展示（GUI 均未验；chatType:2 探测结论未知）。同日旁路改了 web `AcMarkdown` 行内代码样式、安卓智能体表格在引用前缀后不渲染、安卓粘贴个人 `@` 误识别为群、以及 iOS「回复 @」叠在表格上（见文首），均与回执无关。
- (android) 融云只有 `rong_imlib_5.5.3.jar` + `libRongIMLib.so`，SDK 内部不可读；凡涉及原生 SDK 内部行为的结论一律降到 B 级（见 B5）。
- (desktop) `apps/desktop` 当前在 `fix/pc-read-receipt-hardening`（Task 1~10 + 终审 C1+I1~I7 已提交，HEAD `aff6aaaf`）。工作区仍脏 3 个（`.env.test` / `electron-builder.yml` / `package.json`）——PC 打包本地配置，**禁止提交**。
- (desktop) 8/19 的 `context/features/20260819-pc端群@消息已读回执丢失/plan.md` 从未执行（`fix/pc-group-at-read-receipt` 分支不存在）。其事实表已在本轮复核并更新——**其中「阅读方回执只对文本/引用」「PC 不处理 RRReqMsg」两条仍成立，但「发送方登记只在 `MessageModel.js:305-317`」的描述需配合 `messageService.js:295-339` 的 `shouldRequestGroupReadReceipt` 一起看**（后者是那之后新增的）。
- (契约) `datasyn/getReadMessage` 在 `context/contracts/` 下无契约文件。三端都在调，本轮未逐字段比对传参与解读，补契约留到下轮。

## 关键决策记录

- 2026-08-24 范围收敛为 **3 端**（desktop / android / ios）：`apps/web/src` 下 grep `ReadReceipt|readReceipt` 命中的全是个人 AI 框语境的 unread，web 不参与 IM 已读回执。
- 2026-08-24 只查「已读回执」，**不查自己的未读数 / 红点多端同步**：用户确认后者不是本次现象；两套机制确有耦合，但一起查范围翻倍。
- 2026-08-24 本轮**只出分析报告，不加埋点不出包**：无复现路径，埋点也拿不到触发场景，先把代码事实摸清再决定埋在哪。
- 2026-08-24 调查法选「先纵后横」：纵切产出带 `文件:行号` 的事实表（下轮修复可直接复用），横切成阶段矩阵暴露三端不对称。
- 2026-08-24 不反编译安卓 jar/so：改用「调用层代码 + iOS 公开头文件 + PC 明文 adapter」三角互证。
- 2026-08-24 智能体 / 机器人会话的已读跳过逻辑纳入范围（PC `msg-list.vue:2643`）：它是阶段③的过滤条件，直接决定某些私聊会话永不回执。
- 2026-08-25 发版前先审副作用：用户明确要求核对加固是否碰到发送、会话切换、未读红点、@、智能体会话、首屏滚动等原有路径。Opus 5 审出 1 Critical + 7 Important，已全修（8 commit，HEAD `aff6aaaf`）。真机验收未跑，**还不能当已验收**。

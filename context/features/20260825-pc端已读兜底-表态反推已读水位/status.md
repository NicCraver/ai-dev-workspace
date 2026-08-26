# Status：PC 端已读兜底 —— 表态反推已读水位

> 最后更新：2026-08-26（旁路：主目录 GFM 表格宽度已 push `d987d746`，与水位无关。**仍等 Task 6 真机验收**）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 设计（spec） | — | — | — | ✅ |
| 实现计划（plan） | — | — | — | ✅ |
| Task 1 证据提取 + 水位判定纯函数 | — | — | — | ✅ `fc7d7e46` 13/13 |
| Task 2 扫消息列表算水位 | — | — | — | ✅ `ec092d9c` 23/23 |
| Task 3 水位仓库 | — | — | — | ✅ `dd6a4add` 31/31 |
| Task 4 接线：喂入 + 私聊读出 | — | — | — | ✅ `75025888` lint 0 + 31/31 |
| Task 5 接线：群聊读出 | — | — | — | ✅ `bd52a77c` lint 0 + 31/31 |
| Task 5b 群聊合并加引用缓存（计划外） | — | — | — | ✅ `e96e3925` lint 0 + 44/44 |
| 终审（全分支 6 commit） | — | — | — | ✅ **With fixes**，2 条 Important |
| 终审修复（5 条一次提交） | — | — | — | ✅ `74b41acd` lint 0 + 46/46 |
| 修复复审 | — | — | — | ✅ 逐条追证落地，**Ready: Yes** |
| Task 6 真机自测（4 条） | — | — | — | ⬜ **需要你来跑** |

本功能只做 desktop，另三端不涉及。Task 1–5b 的 ✅ = worktree 提交 + 单测 + 评审通过，**不含真机**。

## 终审发现的两条 Important（均已核实为真）

### 1. `isLocalMessage` 把服务端历史消息的证据整片扔了

`collectWatermark` 循环顶端的 `if (msg.isLocalMessage) continue;` 把三个证据源一起跳过。
但 `WebIM/message/MessageModel.js:357` 的 `convertHitoryMessage` 对**每一条**从公司 chat 服务拉回的
历史消息无条件写 `isLocalMessage = true`，而同一函数 `:349` 又把这些消息的扩展塞进了
`expansionDataMap`——**表态/回复的证据就在手里却被白扔**。

> **`isLocalMessage` 在本仓库的真实语义是「融云本地库里没有这条消息」，不是「本地伪造的假消息」。**
> 唯一其它用途是 `msg-list.vue:1471` 排除**发回执**的消息（SDK 没法为本地库里不存在的消息发回执）。
> 读水位不发任何东西，这约束对水位模块不成立。**这是会重复踩的坑，务必进 impl-notes。**

触发频率不低：`service/messageService.js:673-695`，融云返回条数不足 `size` 就从 chat 服务补，
短会话直接走这条路——正好是验收用例 #1 的场景。性质是**假阴性**（兜不住），不违反安全底线，
但会让真机验收得出「方案失效」的错误结论。

修法：`continue` 从循环顶端下移，只留在源 3（对方发言）的判断条件里；源 1/2（表态/回复）放行。

### 2. 会话 key 不含自己账号 Id，切账号后私聊水位会串

`buildConversationKey` 产出 `${conversationType}_${targetId}`。而 `views/qrcode-login.vue:483`
的「切换账号」只做 logout + 重取二维码，**渲染进程全仓库没有一处 `location.reload()`**，
模块级 `watermarkMap` 跨账号存活。账号 A 与 U 私聊留下 `"1_U"`，切到账号 B 后 key 还是 `"1_U"`
→ **A 的水位套到 B 头上，产出错误的已读**。群聊不受影响（「U 打开着群 G」与登录者无关）。

**这条击穿了本方案「绝不产出错误已读」的承诺，比第 1 条严重。**

修法：`buildConversationKey(conversationType, targetId, selfId)`，key 变成 `${selfId}_${type}_${targetId}`，
三者缺任一返回空串。

### 6 条已知 Minor 的 triage 结论

| # | 结论 |
|---|---|
| 裸对象当 set/map，`__proto__` 类键误判 | 留着——追过三处失败模式**全是假阴性**，无一处会造成错误已读；账号 Id 形如 `u1001` 不可能撞上 |
| `senderUserId !== selfId` 与 `!bySelf` 冗余 | **其实不是问题**——两字段来自两条转换路径（融云看 `messageDirection`（`MessageModel.js:249`），服务端历史看 `fromUserId` 比对（`:353`）），各自可能缺失，双重判断是正当防御。补注释，别删 |
| `bumpWatermark` 提前建空条目 | 留着——上界是本次会话打开过的会话数，几十字节 |
| `refreshReadWatermark` 注释措辞不准 | 顺手改掉 |
| `getMergedGroupReceipt` 无自动化测试 | 留着——本仓库 CLAUDE.md 明写「测试用例基本空置，质量靠 lint + 真机自测」 |
| 引用缓存不随消息滚出窗口裁剪 | 留着——与同文件既有 `innerReadTime` / `msgExpansionKeyMap` 同款 |

## 真机验收前必须先对齐的两件事（不是缺陷）

1. **水位翻出的私聊已读会让一批消息显示同一个时间戳。** 水位是「人」的属性不是「消息」的属性，
   这是水位语义的正确表现（与既有 `innerReadTime` 往前回填同款）。**提前告知测试人员，否则会拿回一堆假 bug。**
2. **验收时开着 DevTools console。** `msg-txt.vue:168` 那句 `console.log("watch msgReceipt", x)` 是
   `origin/release` 上的既有代码，正好当探针——群里有人表态时若它刷屏或整条消息闪烁，
   说明 Task 5b 的引用缓存没生效。这是给「组件方法无自动化测试」补的人工验证。
3. **切会话 / 切公司时留意已读状态有无肉眼可见的闪烁。** 复审记的一条理论 Minor：
   若 `senderInfo.id`（Vuex `GetSendUser`）在同账号会话期内瞬时置空，会话 key 会变空串，
   组件本地的 `readWatermark` 被清成 `{}`，仅靠水位兜底显示已读的消息会短暂闪回未读再自愈。
   **不产生错误已读**（模块级 `watermarkMap` 不受影响，`bumpWatermark` 遇空 key 提前 return），
   只是可能的 UI 抖动。没观察到就忽略。

## 分支最终状态

`feat/pc-read-watermark`，**7 个 commit，全部未 push**，工作区干净。相对 `origin/release` 净改动
5 个文件 +813 / -11（其中 372 行是测试）。

| commit | 内容 |
|---|---|
| `fc7d7e46` | 证据提取与判定纯函数 |
| `ec092d9c` | 扫消息列表算按人水位，三源合一 |
| `dd6a4add` | 水位仓库，会话级按人单调只增 |
| `75025888` | 私聊已读接入水位 |
| `bd52a77c` | 群聊已读名单接入水位，只补分子不改分母 |
| `e96e3925` | 群聊合并名单加引用缓存（终审前自查发现的回归） |
| `74b41acd` | 终审两条 Important 修复 |

新增 3 个文件（2 个纯逻辑模块 + 2 个测试文件），改 1 个既有文件（`msg-list.vue`）。
46 个单测全绿、`npm run lint` exit 0。**合并 / push 等你发话。**

## 工作目录（并行开发）

| 目录 | 分支 | 归谁 |
|---|---|---|
| `apps/desktop` | `feat/gfm-markdown` | 用户 / Cursor，另一条并行任务（GFM / 对比度） |
| `apps/desktop-watermark`（worktree） | `feat/pc-read-watermark`，相对 `origin/release` ahead 4，工作区干净 | 本功能 |

worktree 的 `node_modules` 是指向 `apps/desktop/node_modules` 的软链，两边共用一份依赖，**禁止任何 install**。
`node_modules` 与 `.superpowers/` 已加进 `.git/info/exclude`（软链不被 `.gitignore` 的 `node_modules/` 匹配）。

执行方式：subagent-driven-development，每任务一个实施代理 + 一个评审代理，台账在
`apps/desktop-watermark/.superpowers/sdd/progress.md`。四笔提交均未 push（分支跟踪的是 `origin/release`）。

## 各端工作区现状（2026-08-26 收尾，`scripts/code-status.sh` + 手查 3 个）

本回合会话只排查了「PC 测试包 error 日志暴涨 297 GB」（诊断结论见下面独立小节），**没有改任何代码、没有跑真机**。各端脏区与上回合逐字一致，全部归属并行 GFM / 无关 vendor，见下表。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|----|------|------|------|----------|------|
| context | `main` ahead 250 | 脏 25+ | 构建脚本 / 命令 / GFM token / 会议室 UI 文档 | 否 | 本功能只提交本目录 `status.md`；其余另提 |
| web | `feat/web-markdown-table-align-pc` | synced | 干净 | 否 | 波浪下划线 + 对比度已在远端 `f5616c5` |
| android | `feat/gfm-markdown` | synced | 脏 12 | 否 | GFM：`SpanTagHandler` / 高亮居中 / 波浪线 / 引用前缀+表；另有 `MentionAgentKindResolver` **不要和 GFM 混提**。与水位无关 |
| ios | `feat/ios-agent-date-range` | **no upstream** | 脏 13 | 否 | GFM：`ZXMarkdownStyle` / LayoutManager 高亮居中 / ActionCard 折叠拆开。分支本身是记忆条日期区间，与水位无关 |
| desktop | `feat/gfm-markdown` | synced | 脏 3 | 否 | GFM 表格宽度已 push `d987d746`。剩 `.env.test` / `electron-builder.yml` / `package.json` **禁止提交**。与水位无关 |
| desktop-watermark | `feat/pc-read-watermark` | **ahead 7** vs `origin/release` | 干净 | **是** | 代码全完成，未 push，等真机 |
| meeting | `main` | synced | 干净 | 否 | 已不在 `merge/pr4-pr7` |
| action-center | `release` | synced | 脏 7 | 否 | 删了 `@tiptap-pro/extension-unique-id/dist/*`，vendor 产物，与水位 / GFM 都无关，勿 stage |

## 改动文件清单（相对 `origin/release` `613af430`）

| 状态 | 文件 | 行数 |
|---|---|---|
| **改** | `src/renderer/components/chitchat/message/msg-list.vue` | +117 / −11 |
| 新增 | `src/renderer/components/chitchat/read-receipt/readWatermarkModel.js` | +237 |
| 新增 | `src/renderer/components/chitchat/read-receipt/readWatermarkStore.js` | +87 |
| 新增 | `src/renderer/components/chitchat/read-receipt/tests/readWatermarkModel.test.js` | +297 |
| 新增 | `src/renderer/components/chitchat/read-receipt/tests/readWatermarkStore.test.js` | +75 |

合计 +813 / −11，其中 372 行是测试。**只碰 `msg-list.vue` 一个既有文件**，其余全是新建。

`msg-list.vue` 里的改动点：import、`created()` 加引用缓存、`conversationKey` computed、
`messageList` 与 `conversationKey` 两个 watcher、`msg-expansion-update` 的 `$on`/`$off`、
新方法 `refreshReadWatermark`、`getStatusText`（私聊读出）、
`getMergedGroupReceipt` + `getGroupNeedReadCount` / `getGroupHasReadCount`（群聊读出）、
3 处模板 `:msgReceipt` 绑定。

> `apps/` 下实际有 7 个目录：`web` / `android` / `ios` / `desktop` / `desktop-watermark`（本功能 worktree）/ `meeting` / `action-center`。
> **`scripts/code-status.sh` 硬编码只查前四个**，另三个需手查——Stop hook 报的 `meeting` 脏区在它输出里看不到。

## 计划外发现：PC 测试包 error 日志 9 小时写出 106 GB（**不属本功能，但卡真机验收**）

`~/Library/Application Support/zhixin-test/logs/error/` 下 `2026-08-25` 191 GB + `2026-08-26` 106 GB，
**整目录 297 GB**，根卷只剩 29 GB 可用。内容 99.9% 是同一条 `write EPIPE`，00:00:00 刷到 08:54:18，
约 4700 行/秒。

**根因是 `uncaughtException` handler 自噬**（`apps/desktop/src/main/index.js:437`）：

```js
process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);   // 438 行，凶手
  Logger.error({ type: "Caught exception", message: util.inspect(err) });
});
```

app 的 stderr 是 pipe（从终端 / npm 脚本直起，终端后来关了，管道读端消失）→ 任一次 `console.error`
抛 `EPIPE`，异步抛出所以进 `uncaughtException` → handler 第一行又 `console.error` → 又 EPIPE → **无限自激**。
每圈 `Logger.error` 用 `fs.appendFileSync` 追 ~700 字节。stack 里显示 `console.warn` 是因为 Node 里
`console.error` 与 `console.warn` 是同一个函数对象，不是另一处调用。

放大器在 `src/modules/logger/index.js`：只按天切文件，**无大小上限 / 无轮转 / 无限速 / 无去重**；
清理只看 7 天过期（`deleteAllOverdue`），一天写爆 200 GB 它管不着；且 `appendFileSync` 同步阻塞主进程
——那 9 小时里主进程基本耗在磁盘 I/O 上。

当前跑着的 pid 63112 是 Finder 启的，fd 0/1/2 全是 `/dev/null`，**已不再刷**，文件停在 08:54。
**判据：只要从终端直接起包（而非 Finder / `open`），关掉终端就会复现。**

建议修法（三处，均在 `apps/desktop`，**尚未动手**）：
1. handler 去掉 `console.error`，或先判 `process.stderr.destroyed`；`EPIPE`/`EBADF` 直接 return 不落盘。
2. `Logger.error` 加同 message 去重 + 限速，合并成一行 `xN`。
3. 单文件加字节上限，超了停写或轮转。

## 待办 / 阻塞

- (desktop) **真机验收前先清日志**：`logs/error/2026-08-25` + `2026-08-26` 共 297 GB，根卷仅剩 29 GB。
  删除不可逆，**等用户自己执行**；删前必须先退出 zhixin-test，否则 fd 还开着空间不释放。
  磁盘满会直接搞砸 Task 6 真机验收
- (desktop) 上面三处 EPIPE / Logger 修法**未实施**，改哪条分支待定——主目录现在是 `feat/gfm-markdown`，脏区只剩 3 个本地调试文件。
  **与水位无关，不要合进 `feat/pc-read-watermark`**

- (desktop-watermark) **下一步仍是 Task 6 真机验收，需要你来跑**。4 条用例见 `spec.md` 第七节。
  要起 `npm run dev:test`，与 `apps/desktop` 抢 9080 端口，**起之前先确认主目录的 dev 已停**。
  worktree 是从 `origin/release` 干净切的，没有主目录那份指向 localhost 的调试配置，先：
  `cp ../desktop/.env.test ../desktop/electron-builder.yml ../desktop/package.json .`（拷完这三个会变脏，**永远不要 `git add`**）
- (desktop-watermark) 验收前先跟测试人员对齐上面「必须先对齐的两件事」，否则会拿回假 bug
- (desktop-watermark) 真机跑完后补 `impl-notes.md`，**务必把 `isLocalMessage` 在本仓库的真实语义记进去**——这是会重复踩的坑
- (desktop-watermark) **7 笔**提交全部**未 push**，分支跟踪的是 `origin/release`。合并/push 等你发话
- (desktop) 主目录 `feat/gfm-markdown` 表格宽度已 push `d987d746`（属 `20260820`）。剩 `.env.test` / `electron-builder.yml` / `package.json` 保持脏、勿 stage。**不要合进水位分支**
- (android) `feat/gfm-markdown` 脏 12：高亮居中、波浪线、引用前缀+表、`MentionAgentKindResolver`。**提交 GFM 不要带 mention**。与水位无关
- (ios) `feat/ios-agent-date-range` 脏 13：GFM 高亮居中 / 标签 / ActionCard 折叠。与水位无关
- (action-center) `release` 上删了 `@tiptap-pro/extension-unique-id/dist/*`，与本功能无关，勿 stage
- (web) 干净，GFM/web markdown 已在远端，不要合进本分支
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

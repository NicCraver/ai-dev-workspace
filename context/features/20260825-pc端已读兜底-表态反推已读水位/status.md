# Status：PC 端已读兜底 —— 表态反推已读水位

> 最后更新：2026-08-26（本回合只查 iOS 状态；水位 3 条空转/日志修法已提交，**真机未复验**）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

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
| 验收日志出口（计划外） | — | — | — | ✅ `d61316d8` lint 0 + 48/48 |
| Task 6 真机验收 · 核心兜底 | — | — | — | ✅ **已验证生效**，见下「实证」 |
| Task 6 真机验收 · 回归 4 条 | — | — | — | ⬜ 切账号 / 群聊分母 / 引用缓存 / 只增不减 |
| 刷新空转 + 日志缺陷修复 | — | — | — | 🚧 `d4a08e3e` + `c3fe6bcc` 代码已落，真机未复验 |

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

## ⚠️ 验收方式已改：看日志，不看 UI（2026-08-26）

**原来那四条「先确认 PC 显示未读，再触发证据」的用例，构造不出来。**
用户指出：对方在手机上打开会话去表态时，**会话打开本身就发了一条正常回执**，PC 在线就收到了，
已读通过正常通道就翻了——根本分不清是水位兜底生效还是回执本来就好使。原 bug 压根没被复现。

（要真复现，得在第 2 步插「PC 完全退出应用」，让回执到达时 PC 不在线。可行但麻烦，且失败时
分不清是逻辑错了还是证据压根没到。）

**改为：开发 PC 上 @某人，那人用手机表态 / 发消息，开发 PC 看 console 日志。**

为此加了 `readWatermarkDebug.js`（commit `d61316d8`）。关键设计：
**即使回执通道正常工作、水位没被用上，日志也照样把水位那一列打出来**——
一次正常测试就能同时确认「水位算对了」和「当前是谁在起作用」，不用做断线体操。

### 怎么跑

```bash
cd apps/desktop      # 注意：现在主目录就是水位分支，worktree 已没了
npm run dev:test
```

**必须 dev 模式，不能用装好的测试包。** `.electron-vue/build.js:3` 把 `NODE_ENV` 设成 `production`，
DefinePlugin 烤进包里，日志总开关就关了。dev 模式下 `dev-runner.js` 不设 `NODE_ENV`，
运行时是 undefined，按「开」处理。

console 里先 `window.__readWatermark.help()` 确认出口在，再用 **`[已读水位]`（带方括号）** 过滤。

### 三类日志

```
[已读水位] 收到证据：A 的水位抬到 14:32:07（来源：表态或回复，消息 3f9a2b1c）
[已读水位] 会话 me_3_g12345 当前水位：A=14:32:07  B=14:28:11
[已读水位] 群聊 8c4d1e0f 发于 14:20:33 | 2/2 | A=**水位**14:32:07  B=本地14:25:02
[已读水位] 私聊 5b7e9a2d 发于 14:20:33 | 本地=- 服务端=- 水位=14:32:07 → **水位兜底**
```

**判据：`**水位**` 带星号那行出现 = 兜底真生效。** 若显示 `本地xx:xx`，说明这次回执没丢、
正常通道在起作用、水位待命——**那也是有效信息，不是失败**。

按判定签名去重，同一条消息判定不变不重复打，不刷屏。`window.__readWatermark` 可查当前水位表
与最近 200 条证据，`.enabled = false` 随时关。

**已知不足**：总开关关闭时 `installWatermarkDebug()` 提前 return，连 `window.__readWatermark`
都不挂，所以打包版没法运行时打开。若之后要用测试包验收，需把挂载从开关里摘出来（约 3 行）。

**这套只服务验收，不参与任何判定逻辑，验完可整体删掉。**

## ✅ 核心兜底已真机验证生效（2026-08-26）

私聊实测日志：

```
[已读水位] 私聊 767-0D0H 发于 16:45:43 | 本地=- 服务端=- 水位=11:42:18 → **水位兜底**
```

`本地=-` `服务端=-` —— **回执通道对这条消息一条记录都没有**，正是「回执丢了」的状态；
水位把它翻成了已读。**这就是本功能存在的理由，它成立了。**
（767-0D0H 必然是前一天或更早的消息：日志时刻约 11:42，当天 16:45:43 尚未到达。）

同批日志里 `→ 本地册子` 的几条也正确：私聊读出点故意只在其它源都没值时才用水位
（水位是下界，不如回执精确），符合设计。

三个证据源（表态 / 引用回复 / 对方发言）实测都能收到，日志可见。

### 剩余回归 4 条（非核心，快速过）

1. **切账号不串** —— 唯一会产出错误已读的路径。实测会话 key 已是
   `1880150187008081921_1_1919599141374148609`，前缀就是自己账号，隔离已在。换账号跟同一人私聊复验一次。
2. **群聊分母不能被改** —— 不在 @ 名单的人表态，`x/y` 必须完全不变。
3. **引用缓存没失效** —— 群里有人表态时 `msg-txt.vue:168` 的 `watch msgReceipt` 有无刷屏 / 消息整条闪。
4. **只增不减** —— 已显示已读的，切走再切回不能退回未读。

## ⚠️ 待修 3 条：一次事件触发 6 次全量重算（2026-08-26）

群聊实测日志里同一批证据**重复 6 遍**，暴露出刷新空转。**日志在生产包里会被编译期消除，
但重算在生产环境照样发生。**

### 生产包日志开销 = 0（已确认，不用担心）

`readWatermarkDebug.js:19` 的开关是 `process.env.NODE_ENV !== "production"`。
`.electron-vue/build.js:3` 设 `NODE_ENV=production` → `webpack.renderer.config.js:216` 的
DefinePlugin 烤成字面量 → 表达式编译期即 `false` → 日志函数第一行 return，压缩时函数体被 DCE。

### 为什么会重算 6 次

**老问题（`origin/release` 就有，不是本功能引入）**：`messageList` 这个 computed
**自己读又自己写 `innerReadTime`** —— 读在 `msg-list.vue:1067` / `:1071`，写在 `:1073`。
自失效 computed，一次变更连锁重算好几轮。

本功能把一个 O(N) 全表扫描（`collectWatermark` 每次从空表重扫所有已加载消息）挂在它的
watcher 上，**放大了这个 thrash**。

**本功能自己的问题**：`refreshReadWatermark` 无条件把 `bumpWatermark` 返回的**新对象**
赋给 `this.readWatermark`，即使值一个都没变 → 新引用 → 所有依赖它的已读绑定
（`getStatusText`、`getMergedGroupReceipt`）全部重算。

Task 5b 那层引用缓存挡住了子组件 DOM 重挂，所以**不掉帧**，但上游这一层在空转。

### 实际影响

纯计算量亚毫秒级（N 条消息 × 6 次廉价属性读）。真正开销是每次强制一轮已读绑定重算。
大群 + 长历史 + 消息密集时会有感。**不阻塞上线，但该修。**

### 三条修法

1. **`refreshReadWatermark` 值没变就不换引用** —— 复用现成的 `isSameReceiptEntry`
   （形状一样，都是 `{id: 时间戳}`）。掐掉 6 次里的 5 次空转，**顺带日志刷屏也没了**。
   改的是判定路径外的赋值时机，不改判定结果。
2. **证据日志去重** —— 只在真正抬到新高点时报一次。现在报的是「本次重算过程中的中间抬高」：
   `collectWatermark` 每次从空表重扫，遍历顺序靠前的小值也会触发一次「抬高」，
   所以会报出被后续大值覆盖掉的中间态（实测见过报 11:42:07 又报 11:42:18）。
3. **日志加日期** —— 改成 `MM-DD HH:mm:ss`。`hhmmss()` 丢掉日期，导致
   `发于 16:45:43 | 水位=11:42:18 → 水位兜底` 单看像 bug，只能靠「当天 16:45 还没到」倒推。
   **验收日志必须自证，不该靠推理。**

第 1 条动 `msg-list.vue`，2、3 只动 `readWatermarkDebug.js`。

**代码已提交（2026-08-26 下午，非本回合）**：`d4a08e3e` 值没变不换引用 + 日志去中间态并补日期；`c3fe6bcc` 证据日志改按身份去重、补报未抬高水位。脏区仍只有 3 个禁提交调试文件。**真机还没复跑**，刷屏是否消失、日期是否自证，等下次 `npm run dev:test` 确认后再把本行改 ✅。

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

`feat/pc-read-watermark` @ `c3fe6bcc`，**10 个 commit，全部未 push**（跟踪 `origin/release`），工作区只剩 3 个禁提交的本地调试配置。

| commit | 内容 |
|---|---|
| `fc7d7e46` | 证据提取与判定纯函数 |
| `ec092d9c` | 扫消息列表算按人水位，三源合一 |
| `dd6a4add` | 水位仓库，会话级按人单调只增 |
| `75025888` | 私聊已读接入水位 |
| `bd52a77c` | 群聊已读名单接入水位，只补分子不改分母 |
| `e96e3925` | 群聊合并名单加引用缓存（终审前自查发现的回归） |
| `74b41acd` | 终审两条 Important 修复 |
| `d61316d8` | 验收日志出口（`readWatermarkDebug.js` + `onEvidence` 回调） |
| `d4a08e3e` | 水位值没变不换引用；日志去中间态并补日期 |
| `c3fe6bcc` | 证据日志按身份去重，补报未抬高水位 |

新增 5 个文件（3 个模块 + 2 个测试文件），改 1 个既有文件（`msg-list.vue`）。
**合并 / push 等用户发话。**

> `readWatermarkDebug.js` 只服务验收、不参与判定，验完可整体删掉（连同 `onEvidence` 回调与
> `msg-list.vue` 里那 6 处接线）。

## ⚠️ 工作目录：worktree 已没了，回到串行（2026-08-26）

原来的并行方案（`apps/desktop` 跑 GFM、`apps/desktop-watermark` worktree 跑水位）**已经不存在**。
不知何时被摘除，现状：

| 目录 | 现在 |
|---|---|
| `apps/desktop` | **主 checkout**（`.git` 是目录），分支 `feat/pc-read-watermark` @ `c3fe6bcc`，ahead 10 |
| `apps/desktop-watermark` | **空目录**，无 `.git`、无代码，只剩 `.superpowers/sdd/` 流程草稿。`git` 命令在里面会穿透到编排仓 |

`git worktree list` 只有 `apps/desktop` 一条。

**影响：`feat/gfm-markdown` 现在没有任何地方 checkout 着。** 那条线的改动已 push `d987d746` 不会丢，
但要继续改 markdown 就得切分支，切了水位这边就得让位——**又变回串行了**。
是否重新支 worktree，待用户决定。

执行方式：subagent-driven-development，每任务一个实施代理 + 一个评审代理。
台账仍在 `apps/desktop-watermark/.superpowers/sdd/progress.md`（目录还在，只是没代码）。
**10 笔提交全部未 push**（分支跟踪的是 `origin/release`）。

## 各端工作区现状（2026-08-26 收尾，`scripts/code-status.sh` + 手查 meeting / action-center / desktop-watermark）

本回合会话**只查了 iOS 的 git / 代码状态**，没有改任何端的代码、没有跑真机。Stop hook 因 apps 脏区触发收尾。相对上一份 status：desktop 多了 2 笔水位提交（见上 `d4a08e3e` / `c3fe6bcc`，非本回合所写），其余脏区仍全是并行 GFM / vendor。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|----|------|------|------|----------|------|
| context | `main` ahead 255 | 脏 25 | 构建脚本 / 命令 / GFM token / 会议室 UI 文档 / `迭代.md` | 否 | 本功能只提交本目录 `status.md`；其余另提 |
| web | `feat/web-markdown-table-align-pc` | synced | 干净 | 否 | 波浪下划线 + 对比度已在远端 `f5616c5` |
| android | `feat/gfm-markdown` | synced | 脏 12 | 否 | GFM：`SpanTagHandler` / `VerticalCenterBackgroundSpan` / `WavyUnderlineSpan` / 引用前缀+表；另有 `MentionAgentKindResolver` **不要和 GFM 混提**。与水位无关 |
| ios | `feat/ios-agent-date-range` | **no upstream** | 脏 13 | 否 | **已提交**是记忆条日期区间 `80cfabb20`；**脏区全是 GFM**：LayoutManager 高亮居中、style 对比度、`color:green→#008000`、所有 ActionCard 超高折叠。两摊不要混提。与水位无关 |
| desktop | **`feat/pc-read-watermark`** | **ahead 10** | 脏 3 | **是** | HEAD `c3fe6bcc`。脏区只有 `.env.test` / `electron-builder.yml` / `package.json`，**禁止提交** |
| desktop-watermark | — | — | — | 否 | **空目录，worktree 已摘除**，只剩 `.superpowers/sdd/` 草稿。`git` 命令在里面会穿透到编排仓，报的是编排仓状态，别被误导 |
| meeting | `main` | synced | 干净 | 否 | — |
| action-center | `release` | synced | 脏 7 | 否 | 删了 `@tiptap-pro/extension-unique-id/dist/*`，vendor 产物，与水位无关，勿 stage |

## 改动文件清单（相对 `origin/release` `613af430`）

| 状态 | 文件 | 行数 |
|---|---|---|
| **改** | `src/renderer/components/chitchat/message/msg-list.vue` | +117 / −11 |
| 新增 | `src/renderer/components/chitchat/read-receipt/readWatermarkModel.js` | +237 |
| 新增 | `src/renderer/components/chitchat/read-receipt/readWatermarkStore.js` | +87 |
| 新增 | `src/renderer/components/chitchat/read-receipt/readWatermarkDebug.js`（验收用，可删） | +228 |
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
- (desktop) 上面三处 EPIPE / Logger 修法**未实施**，改哪条分支待定——主目录现在是 `feat/pc-read-watermark`，脏区只剩 3 个本地调试文件。
  **与水位无关，不要合进 `feat/pc-read-watermark`**

- (desktop) **核心兜底已真机验证生效**。空转 + 日志 3 条**代码已提交**（`d4a08e3e` / `c3fe6bcc`），**下一步真机复验**：刷屏是否消失、时间戳是否带日期。再过剩余回归 4 条：切账号 / 群聊分母 / 引用缓存 / 只增不减
- (desktop) 跑验收用 `cd apps/desktop && npm run dev:test`（**必须 dev 模式，打包版日志总开关是关的**）
- (desktop) 验收前先跟用户对齐下面「必须先对齐的两件事」，否则会拿回假 bug
- (desktop) 验收跑完后补 `impl-notes.md`，**务必把 `isLocalMessage` 在本仓库的真实语义记进去**——这是会重复踩的坑
- (desktop) **10 笔**提交全部**未 push**，分支跟踪的是 `origin/release`。合并 / push 等用户发话
- (desktop) `feat/gfm-markdown` **现在没有任何地方 checkout 着**（改动已 push `d987d746` 不会丢）。
  要继续改 markdown 得切分支或重新支 worktree，**待用户决定**。切走的话水位这边就得让位
- (android) `feat/gfm-markdown` 脏 12：高亮居中、波浪线、引用前缀+表、`MentionAgentKindResolver`。**提交 GFM 不要带 mention**。与水位无关
- (ios) `feat/ios-agent-date-range` **无 upstream、未 push**。HEAD 是记忆条日期区间；脏 13 全是 GFM（LayoutManager / 对比度 / green→#008000 / ActionCard 全折），**两摊不要混提**。与水位无关。真机未验
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

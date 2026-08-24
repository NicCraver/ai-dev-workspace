# Impl Notes：安卓端@个人AI框

> 平台无关的实现笔记，是其他端移植的唯一逻辑依据。
> 写法要求：描述"逻辑"而不是"代码"——禁止出现 React/Kotlin/Swift 具体 API。
>
> **开项前**：先通读 `context/features/20260728-ios端at个人AI框/impl-notes.md`（产品与联调坑已沉淀）；本文只记 Android 落地后的增量与本端差异。
> 状态：Task 1–8 已实现并合入 `personal-ai-chat`；`assembleOnTestDebug` 通过；真机 E2E 待手测。

## 状态流转

### agentKind 分流（落地形态）

- `@` 提及模型持久化两个新字段：`agentKind`（`group` / `personal`）与个人 `agentId`；草稿序列化/反序列化一并带上。
- 判定收敛为三个静态判据，所有共享点只调它们，不再各自判前缀：
  - 「有群智能体提及」＝ `agentKind=group`，**或**旧草稿无 kind 且 id 以 `ga_` 开头（历史兜底）。
  - 「有个人 AI 提及」＝ 仅认 `agentKind=personal`（不做前缀兜底，避免把群误判成个人）。
  - 「取个人 agentId」＝ 首个 personal 提及上的 `agentId`。
- 普通输入区与**大输入区**两套宿主对称接线：各自持有自己的个人筛选条宿主，显隐、get/save、发送前取值三处都要分别覆盖，否则大输入下发送会丢筛选值。

### 记忆条可见性

- 输入内容变化时统一算一次：有个人提及 → 显个人条并隐群条；有群提及 → 显群条；都没有 → 两条都隐。同一时刻最多一条。
- 隐藏＝移除视图 + 清缓存 DTO + 清 agentId（取消 `@` / 清空 / 发送成功 / 切会话一致）。
- 草稿只恢复可见性，筛选内容再 get。

## 接口调用时序

- 个人 get：`accountId` + `agentId`（`agentId` 来自 `@` 提及；提及缺失则不请求，只挂空条并打日志）。
- get 回参为空时本地兜底一个默认 DTO（时间＝近一周），`dataRangeScopeList` 为 null 一律转 `[]`。
- 个人 save：全量（`dataRangeList` / `timeType` / `netSearch` / `deepThink` / `dataRangeScopeList`），触发点＝改类型、改时间、切联网。
- DataScope：筛选条只回调点击，由宿主打开选择页（跨模块经统一入口传 `{agentId, accountId}` JSON，IM 不直接依赖选择页所在模块）；选择页内部 get 返显 + 确认 save，返回 ACK 成功后筛选条**再 get** 刷本地。
- 发送：IM 发送成功回调里带 `msgUID` / `objName` / `referUuid` 调 `aiRobtChat`；`agentId` 群个人都传，个人额外带 `dataRangeScopeList`，`dataRangeList` 原样透传。

## 边界情况

| 场景 | 预期行为 |
|------|----------|
| `@` 列表 | 顺序：所有人 → 群智能体 → 自己的个人 AI（`groupAgentRels` 中 `accountId===当前登录人`）→ 群成员 |
| 已有任一智能体提及 | 再输 `@`：两类智能体都不进候选；仍可 `@人` |
| `@` 面板内同时勾两个智能体 | 拦截：回滚本次勾选 + toast「智能体合计最多一个」（同 accountId 视为同一个，不算冲突） |
| 工具栏「@智能体」 | 只插群智能体，且已有智能体时不插 |
| 会话消息身份 | `extra.personalAccountId` 有值 → 个人 AI 框；否则 `ga_` 仍为群 AI |
| 个人 AI 消息展示 | tag「个人AI框」；名/头像优先 `content.user.name` / `portrait`（`extra` 可能是 JSON 字符串须 parse） |
| 个人 AI 回复菜单 | 本人：只「@回复」；他人：只「回复」。群 AI：只「@回复」 |
| 消息发送人回显兜底 | 无 `content.user` 时再按 `agentAccountId` 匹配 `groupAgentRels` / 群 rel |
| 个人 agentId 缺失 | 不发 get/save，不弹 toast，仅日志；条仍可挂但为空态 |

## 错误处理策略

get/save/aiRobtChat 失败：对齐群智能体——仅日志、不 toast、不加防抖。

## 互斥的两道闸（缺一不可）

1. **注入侧**：打开 `@` 面板时若输入区/已选里已有智能体，两类智能体都不进列表（防「已有再加」）。
2. **勾选侧**：面板内两类智能体同时在列表时，勾第二个要拦截——回滚勾选态并提示（防「一次选俩」）。

只做第 1 道时，首次打开面板（输入区还没有智能体）群 AI 与个人 AI 会同时在列表里，用户可以一次勾两个，绕过互斥。iOS 的做法是在「加入已选」入口统一校验并回滚，Android 同源实现。

## 联调坑（实际接口 ≠ 文档之处）

移植必看（1–5 已在 iOS 证实，6–8 为 Android 落地补充）：

1. **不能只靠 `ga_` 判类型** → 见 iOS impl-notes。
2. **个人 `dataRangeList` 须原样透传（含 3/4）**：勿套用群侧「固定补齐 0/1/2」的序列化，否则 `aiRobtChat` 会丢个人知识类型并出现假 type0。
3. **`saveDataRange` 禁止空 `dataRangeList`**：未 get 回填前若 save `[]` 会覆盖服务端记忆；实现上在保存入口直接短路（列表为空 → 只打日志跳过），等 get 回填后再存。
4. **发送前先读个人筛选值再藏条**：发送成功回调会立刻隐藏两条并清 `@`；必须在发起发送**之前**把 DTO 与 agentId 读进局部变量。
5. **知识类型胶囊「类型+N」**（群条同步改）；DataScope 仍「数据+N」——用户可感知，须回归并告知测试。
6. **大输入区是第二条链路**：显隐、取值、DataScope 三处都要与普通输入区对称，否则「大输入里 `@` 个人 AI 发送」会走空 DTO 分支静默不调 AI。
7. **DataScope 回调复用既有 requestCode**：与 WebView 选择数据范围同码，宿主要按「是否本条发起」消费结果，避免与 web 侧回调互吞。
8. **`groupAgentRels` 需随群信息落库缓存**：消息回显按 `agentAccountId` 读缓存；`@` 列表在群信息接口返回前也要能出个人 AI，否则弱网/接口失败时 `@` 不到自己的个人 AI。个人项与群项在同一张表里要**能共存且可分别查询**——个人项按「群id_归属人id」+ 类型 0 存，群项按「群id」+ 类型 3 存；否则两者按 belongId 互相覆盖。
9. **发送载荷 `aiRoleId` 三端统一固定 `"1"`**（群与个人都传，2026-07-29 定）：后端靠 `agentId` 判定智能体身份。Android 原先群路径传会话 AI 框 roleId（群无 AI 框时为空），已改为常量——**触碰群主流程，须回归**。
10. **富文本输入框有多条 span→提及 的转换路径**：发送用的一条与草稿/全量信息用的一条是**不同方法**，`agentKind`/`agentId` 必须**每条都带**。只补其中一条时，界面能正常显示个人 AI 筛选条，但发送时提及会退化成群智能体 → 群条 DTO 为空 → 旁路 `aiRobtChat` 静默不发 → 表现为「@ 个人 AI 发消息没有任何回复」。排查入口：先打日志确认「是否走到调接口分支」，再看请求体。
11. **个人 AI 回复的流式效果由后端决定**：三端仿流式的判据一致——回复消息须是 `RC:ReferenceMsg` 且 `extra.fromType == 1`，客户端据此轮询 `aiRobtMessageById` 增量渲染。个人 AI 回复若不满足（消息类型不同或 extra 缺该字段），三端都无流式，**属后端下发问题，客户端无法单独修**。
12. **联网胶囊只留图标**：与 iOS 收敛后的筛选条一致。**时间弹层 Android 取水平居中**（与群记忆条一致，左侧越界贴边）——与 iOS 的右对齐不同，属本端刻意保留的差异。
13. **复制消息再粘贴会丢掉 `agentKind`**：发出去的 extra 只带 at 账号/名字/下标，没有 kind。粘贴时按 extra 重建提及——高亮能对上（账号还在），但 kind 为空。空 kind + `ga_` 被历史兜底判成群智能体，筛选条和发送都走群。还原时必须用**本群缓存**对齐：账号等于当前用户个人 AI → `personal`；等于本群智能体 → `group`。只靠 `ga_` 前缀不够（个人、群账号都是这个前缀）。其他端若粘贴链路同样不写 kind，会中同一枪。

## 与 bridge 的交互

无（Android 原生；DataScope 走本端已有选择页，不经 WebView bridge）。

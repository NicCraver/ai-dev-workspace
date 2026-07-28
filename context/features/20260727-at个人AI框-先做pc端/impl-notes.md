# Impl Notes：at个人AI框-先做pc端

> 平台无关的实现笔记，是其他端移植的唯一逻辑依据。
> 写法要求：描述"逻辑"而不是"代码"——禁止出现 React/Kotlin/Swift 具体 API。

## 状态流转

### agentKind 分流（不能只靠 `ga_`）

- 群智能体与个人 AI 的 `agentAccountId` 均以 `ga_` 开头；现网若只判前缀，个人 AI 会误触群记忆条并发出错误 get 参数。
- 插入 `@` 时根据 `groupAgentType` 写入 `agentKind`：群=`3` → `'group'`；个人=`0` → `'personal'`。
- 共享判断点（是否显示记忆条、草稿恢复、发送载荷、`@` 列表过滤等）一律按 `agentKind` 分支，群路径行为不变、个人逻辑不夹进群分支。
- 旧草稿无 `agentKind` 且 id 以 `ga_` 开头 → 兜底 `'group'`（兼容历史数据）。

### 记忆条可见性

| 事件 | 群智能体条 | 个人 AI 条 |
|------|-----------|-----------|
| `@` 对应智能体 | 显示 | 显示 |
| 删除 `@` / 清空输入 / 发送成功 | 立即隐藏 + reset | 立即隐藏 + reset |
| 切会话 | 按会话 key 隔离 | 按会话 key 隔离 |
| 草稿恢复 | 仅恢复可见性 | 仅恢复可见性 |

筛选内容**不**嵌草稿；条再现后重新 get。

### `@` 列表互斥

- 群智能体与个人 AI 合计最多一个。
- 已有任一智能体 `@` 后再输 `@`：候选人列表**不显示**两类智能体，仍显示所有人与群成员。

## 接口调用时序

### 个人 vs 群 get/save 入参差异

**getAgentDataRange**

| 场景 | 入参 |
|------|------|
| 个人 AI | `accountId` + `agentId`（`agentId` 取自 `groupAgentRels[].agentId`） |
| 群智能体 | 现网不变（`conditionType` / `belongId` / `belongType` / `aiRoleId` 等） |

**saveDataRange**

| 场景 | 入参 |
|------|------|
| 个人 AI | `accountId` + `agentId` + 全量载荷（含 `dataRangeList`、`timeType`、`netSearch`、`deepThink`、**`dataRangeScopeList`**）；每次变更都带 scope，`null` 当 `[]` |
| 群智能体 | 现网载荷与调用时机不动 |

**时序**

1. 记忆条出现 → get
2. 用户改类型 / 时间 / 联网 / DataScope → save（个人每次全量含 scope）
3. 发送：IM 成功 → 回填 `msgUID` → 调 `aiRobtChat`

### 发送 agentId 双路径 + personal scope

`agentChatData`（旁路 `POST /v1/aiRobtChat`）：

| 字段 | 群智能体 | 个人 AI |
|------|---------|---------|
| `agentId` | **必传**；取 get 回参顶层 `agentId` | **必传**；取 `groupAgentRels[].agentId` |
| `aiRoleId` | `'1'` | `'1'` |
| `dataRangeScopeList` | 不传 | 必传（来自记忆条当前 scope） |
| `dataRangeList` / `timeType` / `netSearch` / `deepThink` | 现网逻辑 | 个人记忆条当前值 |
| `referUuid` | 有 IM 回复条时带消息 UId | 同左 |

### DataScope 显示条件与空态

- 个人 AI 筛选条为独立组件，仅在 `@` 个人 AI 时挂载；「是个人 AI」由挂载条件保证。
- 组件内只判一条：知识类型勾选含 **1 / 2 / 4** 任一才显示 DataScope 胶囊；不含则隐藏。
- `dataRangeScopeList` 回参可为 `null` → 前端当 `[]`；胶囊显示「数据+0」，点开再选人/群。
- DataScope 选择**无上限**（不沿用转发弹窗 9 个限制）。

### 草稿只恢复可见性再 get

- 草稿持久化 `@` 提及（含 `agentKind`）；**不**持久化筛选条各字段。
- 恢复草稿 → 根据 `agentKind` 点亮对应记忆条可见性 → 条内触发 get 拉最新记忆。

### groupAgentRels 来源

- 与群智能体同路：`initList` → `groupInfoApi`；`groupAgentRel`=群，`groupAgentRels[]`=个人。
- 切会话清空缓存列表迫使重拉；本期不做个人 AI 新建/删除实时推送。

## 边界情况

| 场景 | 预期行为 |
|------|----------|
| 已有群智能体 `@` 再选个人 AI（或反过来） | 拦截：须先删现有智能体 `@` |
| get 失败 | 条保持空/默认；仅日志，不 toast |
| save 失败 | 仅日志，不 toast；不加防抖 |
| 工具栏「@智能体」 | 只插群智能体 |
| 消息发送人回显 | 按 `agentAccountId` 匹配 → `agentName` / `agentAvatar` |
| 会话消息身份 | `extra.personalAccountId` 有值 → 个人 AI 框；否则 `ga_` 仍为群 AI |
| 个人 AI 消息展示 | tag「个人AI框」；名/头像优先消息体 `content.user.name` / `portrait`（`extra` 可能是 JSON 字符串须 parse） |
| 个人 AI 回复菜单 | 本人：只「@回复」；他人：只「回复」。群 AI：只「@回复」 |
| 个人 AI 回复 | 群内其他人可见（非私密） |

## 错误处理策略

- get/save/aiRobtChat 失败：对齐群智能体现网——`console.log`，不 toast；用户可重试操作（改筛选、重发）。
- get 失败不阻塞输入与发送 UI；发送时仍带当前条内可见值（可能为默认）。

## 联调坑（实际接口 ≠ 文档之处）

1. **initList 缓存回退**：切会话或重进时若走缓存，`groupAgentRels` 合并进 `@` 列表须保留 `agentKind` 与 `ownerAccountId`（仅 `accountId === 当前登录人` 的个人项进列表）；否则个人 AI 不出现或误判为群。
2. **群胶囊文案**：知识类型胶囊由「数据+N」改为「类型+N」（群侧同步）；DataScope 胶囊仍「数据+N」——用户可感知，须回归并告知测试。
3. **aiRobtChat.agentId**：后端确认群与个人均必传；群路径本期新增补传（现网原先未传），须抓包验证。
4. **dataRangeScopeList null**：get 回参可为 null，save/发送须显式传 `[]` 或当前列表，避免后端按覆盖语义清空已选。

## 与 bridge 的交互

无（PC 原生实现，不涉及 WebView↔原生通信）。

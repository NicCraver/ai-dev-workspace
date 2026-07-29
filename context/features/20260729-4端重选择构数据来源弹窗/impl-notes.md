# Impl Notes：4端重构「选择数据来源」弹窗

> 平台无关的实现笔记，是其他端移植的唯一逻辑依据。描述"逻辑"不描述"代码"。
> 最后更新：2026-07-29（PC 端代码完成 + 经过 3 轮代码审查；**真机抓包未做**，标 ⏳ 的结论待补）

## 核心模型（四端必须逐条一致）

### 选中集合是单一真源

一个 key 集合，`key = "<scopeDataType>_<scopeDataId>"`（私聊 1、群聊 3）。三处视图（全部 / 群聊 / 组织架构）共享它，勾选实时互通。

- 初值来自 `getAgentDataRange` 回参的 `dataRangeScopeList`；
- **忽略 `getAllImDialogue` 回参的 `selected` 字段**——它来自 `ai_frame_user_setting`，是个人 AI 框「列表」的选中态，与本弹窗无关；
- 组织架构里勾的人写入同一集合，且这些人**可能不在候选清单里**（见「边界情况」）。

正向构造 key 与反向解析 key 必须对称：id 一律按字符串处理、type 一律按数字处理，否则数字 id 与字符串 id 会生成对不上的 key，导致返显丢失。

### 候选清单归一化

`getAllImDialogue`（`{accountId, selectModel: 0}`）回参数组 → 归一化为 `{ key, scopeDataType, scopeDataId, name, isGroup, isOutreach, avatar, groupAvatars }`：

- **保持后端返回顺序**，前端不排序；
- `targetId` 为空的项丢弃；
- `isGroup` = `type === 3`；非 3 一律按私聊处理；
- `isOutreach` = 群 且 `groupInfo.type >= 10`；缺省或 `< 10` 为组织群；
- 人头像 = `privateInfo.avatar`；群头像 = `groupInfo.accountInfoList` 前 4 人的 `avatar`；
- `name` = `targetName`，可能为空 → **在展示层兜底为 id**，不要在模型层兜底（模型层行为被单测锁定，四端一致）。

### 三个全选标记是派生值

```
groupAndAccountSelectAll   = 候选清单全部在选中集合里 ? 1 : 0
organizationGroupSelectAll = 组织群分区全部在选中集合里 ? 1 : 0
outreachGroupSelectAll     = 外联群分区全部在选中集合里 ? 1 : 0
```

- **空分区一律按 0**（不是 1）；
- 只按候选清单判定，不在清单内的额外 key（组织架构选的人）不参与；
- 语义是「用户勾了全选」的**意图**，后端据此在新增群时自动把新群补进 `dataRangeScopeList`。

### ⚠️ 三态语义（这是本期最容易踩的坑）

`saveDataRange` 是**全量 save**——用户改时间、点联网、改知识类型都会触发，不只是改数据来源时才发。而三个标记只有「打开弹窗并确定」才能算出来。若把「没算过」当成 0 上报，用户重启客户端后随手点一下联网，就会把后端已存的全选意图静默清零，之后新建的群不再自动补进数据范围，用户完全无感。

**四端必须实现三态**：

| 状态 | 含义 | save 载荷 |
|------|------|-----------|
| 未知 | 本次没有可信的标记值 | **这三个 key 必须不存在**（不是 0、不是 null） |
| 0 | 用户明确未全选 | 传 0 |
| 1 | 用户明确全选 | 传 1 |

进入「未知」的三条路径：
1. `getAgentDataRange` 回参不带这三个字段（后端尚未实现，见「联调坑」）→ restore 后为未知；
2. 弹窗的候选清单**取数失败** → 派生结果恒为全 0，是假值，必须回退为未知；
3. 弹窗的候选清单**仍在加载中**就点了确定 → 同上。

第 2、3 条容易漏：候选清单没拉到时 `dataRangeScopeList` 明细仍可按 restore 的已选正常上报，只有标记要退回未知。

传递链路上任何一跳把「未知」转成 0（比如用 `flags || {}` 之类的默认值兜底），三态就失效了。

## 接口调用时序

打开弹窗：
1. `getAgentDataRange`（优先 `agentId` + `accountId`）→ 已选态 + 三个标记（若后端已实现）；
2. `getAllImDialogue`（`{accountId, selectModel: 0}`）→ 候选清单，**弹窗生命周期内只拉一次**，存内存。

切 tab、打字搜索**不再发任何请求**。

确定：把选中集合序列化为**全量明细** `dataRangeScopeList` + 三个标记（或省略）→ `saveDataRange` → 成功后筛选条重新 `getAgentDataRange` 刷新胶囊数字。

## 边界情况

| 场景 | 预期行为 |
|------|----------|
| 候选清单取数失败 | 列表显示错误文案；表头「全选」行**不显示**（避免可点但无效）；此时点确定，明细照常上报、三个标记退回未知 |
| 候选清单加载中 | 同上；表头行不显示；确定时标记退回未知 |
| 搜索态下点表头「全选」 | 表头的三态显示与点击**只针对当前可见（已过滤）列表**；但上报的三个标记**始终按未过滤全量**算。这两份标记必须是独立的派生值，混用会导致：可见项全勾中时表头却显半选、且点表头无响应 |
| 组织架构勾的人不在候选清单 | 进选中集合、进 save 明细、不参与三个标记判定；底栏名称回退到本地通讯录/群缓存 |
| 某分区为空 | 该分区标记为 0；表头点击无副作用 |
| 人无头像 / 群成员列表为空 | 显示默认头像，不能出现裂图；群头像格子不足 4 个时排版仍要正常 |
| `targetName` 缺失 | 列表行显示 id 兜底，不能是空行 |
| restore 未成功就触发 save | **必须拦住**——否则会用空 `dataRangeScopeList` 覆盖后端已存明细。需要一道「成功 restore 后才允许 save」的门闩 |
| 切会话（前后两个会话都有 `@个人AI`） | 门闩必须被关掉、且新会话的设置必须被重新拉取。⚠️ PC 上这里有个陷阱：靠「筛选条可见性 false→true」的响应式回调来做重置是**不可靠**的——同一次更新批次内先置 false 再置回 true，前后值相同，回调根本不执行。要在切会话的事件里**直接同步**关闸并重新取数 |
| 快速来回切会话 | 并发的 `getAgentDataRange` 要按 agentId 做请求去重与过期响应丢弃，否则前一个会话的响应会覆盖后一个会话的状态 |

## 错误处理策略

- `getAllImDialogue` 失败：弹窗内提示「会话列表加载失败」，已选态仍按 restore 显示，确定仍可用（明细照传、标记退回未知）。
- `getAgentDataRange` 失败：**不允许**任何 save 发出（门闩关闭），筛选条保持上一次状态。
- `saveDataRange` 失败：按各端既有的接口失败提示处理，本期不新增特殊逻辑。

## 联调坑（实际接口 ≠ 文档之处）

| # | 现象 | 实际行为 | 契约是否已更新 |
|---|------|----------|----------------|
| 1 | `getAgentDataRange` 回参**不带**三个全选标记 | 前端 restore 后无法还原「全选意图」，而 `saveDataRange` 是全量 save，会把后端已存意图清零 | ✅ 已在 `getAgentDataRange.d.ts` 加三个字段并标 `@unconfirmed`，**后端待实现**。未返回期间前端按「未知态省略上报」兜底 |
| 2 | `getAllImDialogue` 的 `selected` 字段容易被误用 | 它来自 `ai_frame_user_setting`，是个人 AI 框列表的选中态，不是 DataScope 的 | ✅ 契约 Changelog 已注明 |
| 3 | PC 上真正构造 `saveDataRange` 载荷的不是筛选条组件 | 载荷在更上层的会话容器里用**显式字段枚举**拼装，新增字段不会自动透传，必须在那一层也加一次 | — （PC 特有，其他端注意自查自己的载荷组装点在哪） |

⏳ **待抓包确认（4 项，PC 手测时补）**：
1. `getAllImDialogue` 回参顺序是否稳定（是否已按 `activeTime` 倒序）；
2. 现网组织群的 `groupInfo.type` 实际取值（确认 `< 10` 成立）；
3. 后端在 `groupAndAccountSelectAll = 1` 时补录新增群的时机（实时 or 下次 get）；
4. 回参数组长度（决定是否需要虚拟列表）。

⏳ **整条链路最脆的假设**：`getAllImDialogue` 私聊项的 `targetId` 是否就等于组织架构里的 `accountId`。若不相等，同一个人会产生两个 key，导致重复上报与返显错位。**必须抓包验证**。

## 与 bridge 的交互

PC 端无。

移动端 web 的「数据范围」胶囊经 `selectDataRangeScope` 桥打开 ios/android 的**原生页**（原生页自己 `getAgentDataRange` 返显 + `saveDataRange` 落库，成功只 ACK `{ok:true}`，web 收到后再 get 刷新）。因此 ios/android 改完原生页，移动端 web 自动一致，web 仓库只需改 PC 分支弹窗。协议本期不变，详见 `context/bridge.md`。

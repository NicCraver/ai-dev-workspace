# Impl Notes：数据范围-筛选条迭代。

> 平台无关。最后更新：2026-08-06

## 文案规则

### 类型（个人 + 群 AI）

- `dataRangeList` 非空且全部 `choose===1` → 外示「全部类型」
- 否则 →「类型+x」（x=已选数）
- 空列表 → 现网空态（如「无（不关联任何数据）」），不算全部

### 数据（仅个人 AI 聊天记忆条）

- `groupAndAccountSelectAll === 1` →「全部数据」
- 否则（缺省 / undefined / null / 0 **展示当 0**）→「数据+min(n,999)」，n=`(dataRangeScopeList||[]).length`
- 弹层内列表与计数：真实数字，不封顶、不用「全部数据」替代
- 设置页 / 定时任务（非聊天记忆 persist 路径）：**不要**套用本规则，保持「数据+n」

## 点击数据时序

1. 调用 `getAgentDataRange`
2. 成功：回写父级 scopes + 三标记 → 刷新胶囊 → **再打开**选人/群弹层（编辑快照与胶囊同源）
3. 失败：warn、不强 toast、记忆不回滚 → **仍用本地数据开层**
4. 进行中重复点击：忽略（由首次请求结束后开层）

移动端原生选人页若开页仍 get：属二次拉齐；ACK/返回后父级胶囊须按最新 flags 更新。

## 三标记与 save

- 展示：缺省当 0
- save：未知省略三 key（禁止用 0 冒充）——既有逻辑，移植时勿回归

## 真全部

勾选全部应对新增群/人仍生效；本期只**消费** `groupAndAccountSelectAll` 做外示，不新开后端。

## 各端落点摘要

| 端 | 类型 | 数据 + 点击刷新 |
|----|------|-----------------|
| web | `DataRangeBar` + `filterCapsuleLabels.js` | `DataScopeBar`（persist=true）先 get 再开；`nextTick` 后再设 open |
| desktop | personal + agent memory-bar | personal bar emit `refresh-memory-scopes(done)` → chat-box fetch 后 done 开层 |
| android | PersonalAiFilterBar + 群 DataCheck | Host：`fetchAndBind(true)` 后再 `openDataScope` |
| ios | PersonalAiFilterBar + ZXAIAgentFilterBar | `zx_fetchPersonalAiMemoryThenPresentDataScope`；MemoryModel 增三标记 |

## 联调坑

- 后端未回传 `groupAndAccountSelectAll` 时外示走封顶规则，不会出现「全部数据」
- 三标记（含 `groupAndAccountSelectAll`）可能回传字符串 `"1"` / `"0"`：展示判断用数值比较（如 `Number(flag)===1`、iOS `zx_isSelectAllFlagOne`、Android `isGroupAndAccountSelectAllOne`），勿依赖严格布尔或 `=== 1` alone
- android get 用 `fetchGeneration` 丢弃过期响应；过期代际勿再 open（由最新一代 open）
- 勿再「先开层再并行 get」：弹层打开瞬间快照会与随后回写的胶囊不一致

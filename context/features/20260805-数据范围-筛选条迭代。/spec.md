# Spec：数据范围-筛选条迭代。

> 由 Superpowers brainstorm 产出。最后更新：2026-08-05

## 背景与目标

聊天记忆筛选条上，「类型」「数据」两枚胶囊长期只展示 `类型+n` / `数据+n`，无法表达「已全选」意图，数据侧在勾选量很大时数字也不宜无限增长。数据范围已有「真全部」三标记（`groupAndAccountSelectAll` 等），但胶囊未消费。

**成功标准**

1. 类型全选时外示「全部类型」，否则「类型+x」（个人 AI + 群 AI）。
2. 数据 `groupAndAccountSelectAll===1` 时外示「全部数据」；否则「数据+min(n,999)」；弹层内仍为真实数量。
3. 点击「数据」胶囊：先开弹层，并行 `getAgentDataRange`，成功后本地 scopes/flags 与胶囊对齐。
4. 真全部语义沿用现网三标记，本期不新开后端。

## 用户流程

### 类型胶囊

1. 用户打开个人 AI 或群 AI 聊天记忆筛选条。
2. 若当前 `dataRangeList` 非空且每项 `choose===1` → 胶囊文案为「全部类型」。
3. 否则 →「类型+x」（x = 已选数量）。列表为空时保留现网空态文案（如 web「无（不关联任何数据）」），不显示「全部类型」。
4. 用户在类型弹层勾选/取消 → 胶囊即时按上述规则更新。弹层内选项与计数不受外部「全部」文案影响。

### 数据胶囊（仅个人 AI，显示条件沿用 `shouldShowDataScopeBar` 等现网逻辑）

1. 胶囊文案：
   - `groupAndAccountSelectAll === 1` →「全部数据」
   - 否则（含字段缺省 / `undefined` / `0`，**缺省当 0**）→「数据+min(n, 999)」，n = `dataRangeScopeList` 长度（`null` 当 `[]`）
2. 用户点击「数据」胶囊：
   - **先打开**选人/群弹层（PC H5 或移动原生）
   - **并行**调用 `getAgentDataRange` 刷新记忆
   - 成功：回写父级记忆的 `dataRangeScopeList` 与三标记（有则更新；无标记则展示按缺省当 0），**胶囊**文案随之更新。已打开的弹层以打开瞬间的 scopes 为编辑快照，**不**被这次并行 get 强行覆盖（避免打断用户勾选）；用户取消关闭后，外层已是 get 最新值
   - 失败：不关弹层；可 `console.warn`；不强制 toast；本地记忆不回滚
3. 弹层内列表与勾选计数显示**真实数字**，不做 999 封顶，不用「全部数据」替代内部计数。
4. 用户在弹层确认保存后：仍走现网 `saveDataRange`；三标记三态语义不变（未知省略 key，禁止用 0 冒充上报）。

## 范围

### 本期做

- 聊天记忆筛选条：**类型**胶囊文案（个人 + 群 AI）
- 聊天记忆筛选条：**数据**胶囊文案 + 点击时并行 `getAgentDataRange`（个人 AI）
- 四端行为一致；各端各自实现（不共享跨端代码）；规则以本文为准
- web 可将文案规则收成可单测纯函数（仅 web 本地）

### 本期不做

- 设置页 Skill 编辑、定时任务等 `persist=false` / 非聊天记忆条场景的文案
- 后端「真全部」联调补齐或契约变更（标记已在 `getAgentDataRange` / `saveDataRange` 契约中）
- 修改 save 三态省略逻辑
- 「类型」胶囊点击时强制重拉 `getAgentDataRange`（非本期要求）

## 文案规则（平台无关）

### 类型

| 条件 | 外示文案 |
|------|----------|
| `dataRangeList.length > 0` 且全部 `choose === 1` | `全部类型` |
| 否则（含已选数为 0，但列表非空且现网用 `类型+0` 的路径） | `类型+x` |
| 列表为空 | 现网空态（不强制 `类型+0` / `全部类型`） |

判定：「当前列表全选」= 接口返回的 `dataRangeList` 每一项均选中（与弹层「全部」勾选态一致），不要求覆盖产品枚举全集。

### 数据

| 条件 | 外示文案 |
|------|----------|
| `groupAndAccountSelectAll === 1` | `全部数据` |
| 否则（缺省当 0） | `数据+min(n, 999)` |

- n = `(dataRangeScopeList || []).length`
- 例：n=999 → `数据+999`；n=1000 → 外 `数据+999`，弹层仍 1000
- 「真全部」：勾选全部表示对新增群/人仍生效；本期只**消费**现有 `groupAndAccountSelectAll` 做外示，不新开后端

## 各端落点

| 端 | 类型胶囊 | 数据胶囊 + 点击刷新 |
|----|----------|---------------------|
| web | `DataRangeBar`（FilterBar，含群） | `DataScopeBar`：文案；`openPicker` 先开再并行 get |
| desktop | `personal-ai-memory-bar` + 群 `agent-memory-bar` | 个人 bar DataScope 胶囊；开弹窗时并行 get |
| ios | `ZXPersonalAiFilterBar` + 群 `ZXAIAgentFilterBar` | 个人 dataScope 文案；开选人页与 get 对齐后回写 |
| android | 个人/群 FilterBar 对应文案处 | 同上 |

默认四端行为一致；无系统权限类差异。移动端原生选人页若开页已调 `getAgentDataRange`，需与「先开层、刷新回写」对齐，避免重复逻辑打架（可复用开页 get，但父级胶囊须在返回/ACK 后按最新 flags 更新）。

## 依赖的接口

- `context/contracts/personalAiFrame/getAgentDataRange.d.ts`
- `context/contracts/personalAiFrame/saveDataRange.d.ts`（三标记对称；本期不改契约）

关键字段：`groupAndAccountSelectAll`（0/1）；缺省时前端展示当 0，save 时未知仍省略 key。

## 错误与边界

- `agentId` / `accountId` 未就绪：不发起 get；打开能力按现网
- get 失败：弹层不关、记忆不回滚、不强打断 toast
- 不把「全部数据 / 数据+999」文案规则套用到设置页、定时任务

## 验收要点

1. 个人 + 群：类型全选 →「全部类型」；取消一项 →「类型+x」
2. 数据 selectAll=1 →「全部数据」；=0 且 n>999 →「数据+999」；弹层真实数
3. 点数据胶囊立即开层；get 成功后胶囊/本地与回参一致
4. 设置页 / 定时任务「数据+n」文案不变
5. save 未知三标记时仍省略 key（回归）

## 决策记录

- 2026-08-05：`groupAndAccountSelectAll` 缺省当 0 展示
- 2026-08-05：点击数据先开弹层，并行 get（不阻塞打开）
- 2026-08-05：范围仅聊天记忆筛选条；类型含群 AI；数据仍仅个人 AI
- 2026-08-05：外示文案为「全部类型」「全部数据」（非「数据 全部」）
- 2026-08-05：真全部本期只做文案消费现有标记，不新开后端
- 2026-08-05：类型「全选」= 当前 `dataRangeList` 全 choose=1
- 2026-08-05：四端规则一致、代码各写；非跨端共享函数

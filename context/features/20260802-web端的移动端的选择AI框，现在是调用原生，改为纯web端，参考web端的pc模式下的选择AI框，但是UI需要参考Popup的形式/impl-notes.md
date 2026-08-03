# Impl-notes：移动端选择 AI 框 · 纯 Web Popup

> 平台无关。最后更新：2026-08-03

## 行为摘要

- 移动端打开「选择 AI 框」→ H5 底部 Popup（约 95vh），不再调原生选择页。
- 页面栈：home（全部会话 + 入口）→ contacts（组织公司/部门/人员）/ groups（组织群）/ search（全部|群组|人员）。
- 主列表分组文案为「全部」（对齐 PC tab）；列表行与搜索结果展示智能体副标题（对齐 PC Dialog）。
- 点可选行立即提交（需防连点）；取消/返回/遮罩不提交。
- 数据与 PC Dialog 同源：`getAllImDialogue(selectModel=1)` 归一化；组织 HTTP 直调；隐藏外联。
- 选中后外层仍：本地 upsert → saveSelected → list。

## 边界

- 群人数：仅当接口带 `groupNumber`/`memberCount` 等可靠字段时展示；不用 top4 成员列表长度冒充。
- 「展示智能体名」与「按智能体名搜索」解耦：选择 AI 框两者默认开；选择数据范围两者关。
- 原生 `selectAiAgent` 代码保留，默认不调用，便于回滚。
- contacts → search → 返回：须保留组织钻取栈（勿因换页卸载清空）。

## 性能（大数据量）

- 会话列表 / 搜索结果 / 组织公司与部门人员：定高虚拟列表（对齐选择数据来源），只挂载可视区行；分区头与内容行高度必须与虚拟列表 `rowHeight` 一致。
- `allItems` 用 shallowRef，避免上千条 deep 代理。
- OrgPicker：会话私聊先建成 `accountId → item` Map，进部门合并时 O(人员) 而非反复扫全量会话；`showAgentName=false` 时不打 batchGetAgent。
- 虚拟列表子组件 slot 内勿用 `v-memo`（会触发 reading 'memo'）。

## 联调坑

- （待真机）`getAllImDialogue` 群是否回传人数字段；无则截图中的 `(N)` 不显示。

# Impl Notes：web「选择 AI 框」getAllImDialogue 重构

> 平台无关逻辑摘要。最后更新：2026-07-29（已完成 getAllImDialogue 真机抓包并修正 agent 字段假设；修复后 UI 待复测）

## 核心模型

1. 开弹窗一次 `getAllImDialogue({ accountId, selectModel: 1 })`，结果先归一化。
2. 归一化只丢弃无 `targetId` 的项；按人/群 id 调 `batchGetAgent` 补齐智能体字段；补齐后再丢弃无 `agentId` 的项。**忽略**回参 `selected`（不当作本弹窗选中态）。
3. 每次打开弹窗均为**未选中**。
4. 「全部」= 过滤后全量（可含外联群）；「群组」顶层 tab = 仅组织群（`groupInfo.type < 10` 或缺失）。
5. 搜索：对缓存做 `name` / `agentName` 忽略大小写子串匹配；结果分「全部 / 群组 / 人员」（群在前、人在后）。搜索「群组」可含外联。
6. 组织架构仍走公司/部门树 + batchGetAgent；选择 AI 框场景：隐藏外联 scope、无 `agentId` 人员不展示。数据来源弹窗不传这些开关，行为不变。

## 接口时序

- 开窗：`getAllImDialogue` → `batchGetAgent` 补齐（组织钻取除外）。
- 切 tab / 打字搜索：零会话列表请求。
- 其它仍用旧搜索入口的页面：未传候选列表时仍走 `selectGroupBySearch`。

## 联调坑

1. ✅ 已确认：`selectModel: 1` 仍可能返回全量会话，但所有 `agentId` / `aiRoleId` / `agentName` / `agentAvatar` 均为 null。不能在归一化阶段按 `agentId` 过滤，否则列表必空；须先调 `batchGetAgent` 补齐。
2. ⏳ 待确认：组织群 `groupInfo.type` 取值；列表量级；修复后 UI 是否正确展示已有 AI 框项。

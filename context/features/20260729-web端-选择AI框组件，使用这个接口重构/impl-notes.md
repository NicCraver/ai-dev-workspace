# Impl Notes：web「选择 AI 框」getAllImDialogue 重构

> 平台无关逻辑摘要。最后更新：2026-07-29（web 代码已合入 personal-ai-chat；**真机抓包未做**）

## 核心模型

1. 开弹窗一次 `getAllImDialogue({ accountId, selectModel: 1 })`，结果归一化后缓存于弹窗生命周期。
2. **丢弃**无 `targetId`、无 `agentId` 的项；**忽略**回参 `selected`（不当作本弹窗选中态）。
3. 每次打开弹窗均为**未选中**。
4. 「全部」= 过滤后全量（可含外联群）；「群组」顶层 tab = 仅组织群（`groupInfo.type < 10` 或缺失）。
5. 搜索：对缓存做 `name` / `agentName` 忽略大小写子串匹配；结果分「全部 / 群组 / 人员」（群在前、人在后）。搜索「群组」可含外联。
6. 组织架构仍走公司/部门树 + batchGetAgent；选择 AI 框场景：隐藏外联 scope、无 `agentId` 人员不展示。数据来源弹窗不传这些开关，行为不变。

## 接口时序

- 开窗：仅 `getAllImDialogue`（组织钻取除外）。
- 切 tab / 打字搜索：零会话列表请求。
- 其它仍用旧搜索入口的页面：未传候选列表时仍走 `selectGroupBySearch`。

## 联调坑

⏳ 待抓包：`selectModel: 1` 回参是否已保证带 `agentId`；组织群 `groupInfo.type` 取值；列表量级。

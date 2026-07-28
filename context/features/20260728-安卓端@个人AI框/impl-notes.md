# Impl Notes：安卓端@个人AI框

> 平台无关的实现笔记，是其他端移植的唯一逻辑依据。
> 写法要求：描述"逻辑"而不是"代码"——禁止出现 React/Kotlin/Swift 具体 API。
>
> **开项前**：优先通读 `context/features/20260728-ios端at个人AI框/impl-notes.md`（产品与联调坑已沉淀）；下列仅记 Android 开项后的增量与本端差异。

## 状态流转

（待 Android 实现后按实填充；产品规则对齐 iOS/PC：`agentKind` 分流、互斥、记忆条可见性、草稿只恢复可见性再 get。）

## 接口调用时序

（待实现。）个人 get/save 入参：`accountId` + `agentId`；save 全量含 `dataRangeScopeList`；发送旁路 `aiRobtChat` 必带 `agentId` + scopes。

## 边界情况

| 场景 | 预期行为 |
|------|----------|
| 会话消息身份 | `extra.personalAccountId` 有值 → 个人 AI 框；否则 `ga_` 仍为群 AI |
| 个人 AI 消息展示 | tag「个人AI框」；名/头像优先 `content.user.name` / `portrait`（`extra` 可能是 JSON 字符串须 parse） |
| 个人 AI 回复菜单 | 本人：只「@回复」；他人：只「回复」。群 AI：只「@回复」 |
| 消息发送人回显兜底 | 无 `content.user` 时再按 `agentAccountId` 匹配 `groupAgentRels` / 群 rel |

其余产品边界对齐 iOS/PC impl-notes（互斥、工具栏只插群、回复可见性等）。

## 错误处理策略

get/save/aiRobtChat 失败：对齐群智能体——仅日志、不 toast。

## 联调坑（实际接口 ≠ 文档之处）

移植必看（已在 iOS 联调证实，Android 勿重复踩）：

1. **不能只靠 `ga_` 判类型** → 见 iOS impl-notes。
2. **个人 `dataRangeList` 须原样透传（含 3/4）**：勿套用群侧「固定补齐 0/1/2」的序列化，否则 `aiRobtChat` 会丢个人知识类型并出现假 type0。
3. **`saveDataRange` 禁止空 `dataRangeList`**：未 get 回填前不要 save `[]` 覆盖服务端；优先读筛选条现场值，空则跳过。
4. **发送前先读个人筛选值再藏条**。
5. **知识类型胶囊「类型+N」**（群条同步）；DataScope 仍「数据+N」。

## 与 bridge 的交互

无（Android 原生；DataScope 经现有 SelectDataRange 页，不走 WebView bridge）。

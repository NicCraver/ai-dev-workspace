# Spec：复制 / 修改时个人 AI 框归属分流

> 由 grill-me / brainstorm 产出。最后更新：2026-09-01  
> 状态：设计已与用户确认（方案 1），待写 plan

## 背景与目标

群聊里复制或修改一条带 `@个人AI框` 的消息时，输入框回填 **只认 `ga_` 前缀或消息 extra 里的 `agentKind`**，不按「当前登录人自己的个人 AI」重新分类。

| 现象 | 截图 | 现状 | 目标 |
|------|------|------|------|
| 自己的个人 AI | `@赵彬华个人AI框` 蓝色正确，筛选条是「无（不关联任何数据）」 | 无 `agentKind` 时 `ga_` 兜成**群**智能体 | 高亮保持；出**个人**筛选条；发送走个人 AI |
| 别人的个人 AI | `@李权泓的 AI 框 22` 仍蓝色，且出了个人筛选条 | extra 里别人的 `agentKind=personal` 被原样当成有效 @ | **黑色普通文本**；不出筛选条；不走任何智能体 |

成功标准：三端（PC / Android / iOS）复制、修改、撤回再编辑，上述两行都成立；**群 AI 框回填行为不变**。

## 已决

| 项 | 结论 |
|----|------|
| 改法 | **回填时重新分类**，不在发送时补救，不按入口各改一坨 |
| 显示名 | 继续用原来的 `agentName`（如「赵彬华个人AI框」），不改成「自己的个人AI框」 |
| 自己 vs 别人 | 只看**当前登录人**是否拥有该 `ga_`，不看原消息是谁发的 |
| 群 AI 框 | **不动**：继续高亮、出群筛选条、发出去由群 AI 回 |
| 别人的个人 AI | 文案留在输入框，去掉 mention / 高亮，不当 @ |
| `ga_` 前缀 | 只说明「智能体账号」，**不再**用来区分群 / 个人 |
| 消息 extra 的 `agentKind` | **个人路径不信任**。别人的 personal 不能让当前用户当成自己的；自己的缺 kind 也不能靠 `ga_` 兜成群 |
| 场景 | 群聊输入框：复制粘贴、修改已发消息、撤回后重新编辑。草稿恢复同一套分类，避免再踩 |
| 私聊 | 不在本期（群聊才有 @ 智能体） |

## 分类规则（平台无关）

输入：待恢复的智能体账号 `gaAccountId`、当前登录人 `me`、本群 `groupAgentRel`、本群 `groupAgentRels[]`。

```
若 groupAgentRel.agentAccountId === gaAccountId
    → kind = group（沿用现网群路径，补齐 agentKind=group + agentId）

否则若存在 rel ∈ groupAgentRels
      满足 rel.accountId === me 且 rel.agentAccountId === gaAccountId
    → kind = personal（补齐 agentKind=personal + rel.agentId，显示名用 rel.agentName 或原文）

否则
    → drop：去掉 mention span / AtNameSpan / at 属性，留下纯文本，不进 @ 列表
```

互斥仍成立：有效智能体 @ 合计最多一个。drop 掉别人的个人 AI 之后，不应再点亮任何智能体筛选条。

## 用户流程

1. 用户复制或修改一条含 `@xxx` 的群聊消息，内容进入输入框。
2. 对每个智能体 @ 走上一节分类。
3. **自己的个人 AI**：蓝色 mention；个人筛选条（「全部类型」那套）；发送 `aiRobtChat` 带自己的 `agentId` + `dataRangeScopeList`。
4. **本群群 AI**：蓝色 mention；群筛选条；发送走群路径（现状）。
5. **别人的个人 AI**：`@李权泓的 AI 框 22` 等字还在，黑色，无筛选条；发送当普通文本，不调智能体。

## 范围

本期做：

- PC / Android / iOS 三端在**所有回填入口**套同一分类（复制、修改、撤回再编辑；建议草稿一并套上）。
- 自己的个人 AI 回填必须带上 `agentKind=personal` 与 `agentId`，驱动个人筛选条与个人旁路发送。
- 别人的个人 AI 降级为普通文本。
- 去掉（或收窄）「无 kind + `ga_` → 群」在**回填路径**上的误伤；发送路径若仍用该兜底，回填必须先写好 kind，避免再兜错。

本期不做：

- 改 @ 列表插入文案、改气泡里已发出消息的展示。
- 改群 AI 框产品行为。
- Web 个人 AI 页（不是会话输入框）。
- 新接口；分类用现有 `group/get` 的 `groupAgentRel` / `groupAgentRels`。

## 各端落点（实现时对照，不必新抽象跨仓模块）

逻辑相同，各用本端惯用写法。

| 端 | 必须改的回填口 | 已知坑 |
|----|----------------|--------|
| desktop | `send-box.vue`：`pasteTextOrHtml`（复制）；`setEditContent`（修改）；草稿恢复；退格 `checkAtHandler` + `inputHandle` | 粘贴只 `push({id,name})`。`hasGroupAgentMention` 对无 kind 的 `ga_` 当群。退格曾 `item != spanNode.id`（对象≠id，删不掉），`selectNodeContents` 留下空 mention 壳，筛选条不关 |
| android | `MsgDraftRichConvertUtil.getRealMentionList`（草稿 / 修改 / 撤回再编辑 / 粘贴都走它） | 凡 `ga_` 一律保留，不管是不是自己的个人 AI |
| ios | extra.atUserList **不存** agentKind。复制：`ZXChatTextView.paste` → `didPasteAtModels`；修改：`setupInputTextWithSelectModel`；撤回再编辑：`ZXChatRecallAtList`。高亮 `addAtUserAttriText`，条 `zx_refreshAgentFilterBar` | 回填只拷 userId+nickname。无 kind + ga_ 被 `zx_hasGroupAgentMention` 兜成群。别人的个人 AI 一样会高亮。必须用 atUserId 对当前群 `groupAgentRel` / `groupAgentRels`，不能从 extra 读 kind |

## 依赖的接口

无新接口。本群智能体关系仍来自现网 `group/get`：

- `groupAgentRel`：群智能体
- `groupAgentRels[]`：个人 AI；只认 `accountId === 当前登录人` 的那条

## 错误与边界

| 场景 | 行为 |
|------|------|
| 本群还没拉到 `groupAgentRels` | 先拉再分类；拉失败则智能体 @ 全部按 drop（宁可不亮，不要亮成群） |
| 自己的个人 AI 已从本群解绑 | drop，当别人的个人 AI |
| 一条消息里 @ 了别人的个人 AI + 真人 | 只 drop 智能体那段；真人 @ 规则不变 |
| 已有自己的个人 AI mention 再粘贴别人的 | 别人的 drop；自己的保留 |
| 已有群 AI 再粘贴自己的个人 AI | 现网互斥：不能两个智能体；按现网「已 @ 智能体不可再 @」处理，不要为了本 bug 改互斥 |

## 待用户确认的问题

无（分类规则、群 AI 不动、显示名不改，均已确认）。

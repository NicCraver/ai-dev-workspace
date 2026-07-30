# Spec：定时任务消息 · 气泡下来源 badge

> 最后更新：2026-07-30｜UI 示意：同目录 `ui-mock.html`  
> 状态：**已确认，待写 plan**

## 背景与目标

群聊里个人 AI / 群 AI 发出的消息，气泡下已有或将有「来自…」来源 badge。定时任务发到群的消息需要明确标出来源；非定时任务消息不应再显示该 badge。

成功标准（desktop / iOS / Android）：

1. `content.extra.fixTaskMessage === 1`（严格数字 `1`）时：
   - 个人 AI：显示 `来自{归属人昵称}个人AI框`
   - 群 AI：显示 `来自群AI框`
2. `fixTaskMessage` 为 `0`、缺省、`null`、字符串 `"1"` 等非数字 `1`：不显示来源 badge
3. 昵称旁 identity tag（「个人AI框」/「群AI框」）**本期不改**
4. badge 布局顺序对齐现有个人 AI badge：气泡 → 表情 →「N条回复」→ **来源 badge**（禁止插在「N条回复」上方）

## 用户流程

1. 用户在群聊消息列表看到一条 AI 消息
2. 客户端解析 `content.extra`（可能是对象或 JSON 字符串）
3. 若 `fixTaskMessage === 1`：
   - 有 `personalAccountId` → 按归属人查昵称 → 气泡下显示「来自{nick}个人AI框」
   - 否则若为群 AI（现有判据，如 `senderUserId` 以 `ga_` 开头且无 personalAccountId）→ 显示「来自群AI框」
4. 若非定时任务 → 不渲染来源 badge（个人 AI 现网会显示的 badge 改为隐藏）
5. 撤回消息：不显示 badge（沿用现有）

## 范围

### 本期做

- **desktop / iOS / Android** 会话消息气泡下的来源 badge：
  - 个人 AI：现有 badge 增加 `fixTaskMessage === 1` 门闩
  - 群 AI：新增固定文案 badge「来自群AI框」，同样受门闩控制
- 契约 / 文档：注明消息 `extra.fixTaskMessage` 语义（1=定时任务消息，0=不是）
- 复用现有挂载点与样式（个人 AI：PC `MsgPersonalAiRow`；Android `PersonalAiSourceBadgeBinder`；iOS `personalAiSourceBadgeTextForMessage`）

### 本期不做

- web（移动端消息列表在原生；PC 走 desktop）
- 改昵称旁 identity tag 显隐或文案
- 改头像 / 回复菜单 / `@` 筛选条
- 后端定时任务发送链路本身（假定消息已带好 `fixTaskMessage`）

## 显隐矩阵

| 场景 | 昵称旁 tag | 气泡下 badge |
|------|------------|--------------|
| 个人 AI + `fixTaskMessage === 1` | 「个人AI框」（不变） | 「来自{nick}个人AI框」 |
| 个人 AI + 非 1 | 「个人AI框」（不变） | **不显示** |
| 群 AI + `fixTaskMessage === 1` | 「群AI框」（不变） | 「来自群AI框」 |
| 群 AI + 非 1 | 「群AI框」（不变） | 不显示 |
| 撤回 / 非 AI | — | 不显示 |

## 判定规则（平台无关）

```
extra = parse(content.extra)   // 对象或 JSON 字符串
isFixTask = (extra.fixTaskMessage === 1)   // 仅数字 1；"1"/0/null/缺省 → false

personalId = extra.personalAccountId 非空 ? 该值 : null
isPersonalAi = personalId 非空
isGroupAi = 现有群 AI 判据（如 sender 以 ga_ 开头）且 !isPersonalAi

显示个人 badge ⟺ isFixTask && isPersonalAi && 昵称已解析 && 未撤回
显示群 badge   ⟺ isFixTask && isGroupAi && 未撤回

文案：
  个人 = "来自" + displayName(personalId) + "个人AI框"   // 查用户缓存，不用 content.user.name
  群   = "来自群AI框"   // 固定，不查人
```

个人昵称解析、缓存 miss 拉取、布局对齐：沿用 `20260729-消息来自个人AI框badge` / impl-notes，**仅多一道 isFixTask 门闩**；群 badge 挂同一位置，无查人。

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本期 | — | 改 badge 门闩 + 群文案 | 同左 | 同左 |
| 个人查人 | — | DataCenter fullName | CorpUserTable.name | AllUserMap name/nickName |
| 群 AI 判据 | — | 各端现有 `ga_` / 群 AI helper | 同左 | `senderUserId.startsWith('ga_')` 等现有逻辑 |

## 依赖的接口 / 字段

- 消息字段（IM 消息体，非独立 HTTP）：
  - `content.extra.personalAccountId`（既有）
  - `content.extra.fixTaskMessage`：`1` = 定时任务消息，`0` = 不是；**判真仅接受数字 `1`**
- 人员详情：各端既有「按 accountId 查用户」（仅个人 badge 需要）
- 契约：在合适的消息 / 个人 AI 相关契约或 feature 文档中补充 `fixTaskMessage` 注释（若暂无独立契约文件，写入本 feature 与 impl-notes 即可）

## 与既有功能关系

- 继承并收紧 `20260729-消息来自个人AI框badge`：个人来源 badge 从「有 personalAccountId 即显」改为「有 personalAccountId **且** fixTaskMessage===1 才显」
- 群 AI 为增量：同挂载点、新文案

## 待用户确认的问题

无（矩阵与 `ui-mock.html` 已确认）。

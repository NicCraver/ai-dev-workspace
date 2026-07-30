# Impl Notes：定时任务消息 · 气泡下来源 badge

> 平台无关逻辑提炼。参考端：PC `MsgPersonalAiRow` + `msg-list.getAiSourceBadgeVariant`。最后更新：2026-07-30

## 与 identity tag 的区别

| | 昵称旁 tag | 气泡下 badge（本功能） |
|--|-----------|----------------------|
| 文案 | `个人AI框` / `群AI框` | `来自{nick}个人AI框` / `来自群AI框` |
| 门闩 | **无**（本期不改） | 必须 `fixTaskMessage === 1`（数字） |
| 个人判据 | `personalAccountId` 有值 | 同左 + 昵称已解析 + fixTask |
| 群判据 | sender 为智能体前缀（如 `ga_`）且非个人 | 同左 + fixTask；文案固定 |

## 显隐

```
extra = parse(content.extra)   // 对象或 JSON 字符串
isFixTask = (extra.fixTaskMessage === 1)   // 仅数字 1；"1"/0/null/缺省 → false

personalId = extra.personalAccountId 非空
isPersonalAi = personalId 有值
isGroupAi = sender 以智能体前缀开头（ga_）且 !isPersonalAi

显示个人 badge ⟺ isFixTask && isPersonalAi && 昵称已解析 && 未撤回
显示群 badge   ⟺ isFixTask && isGroupAi && 未撤回
```

## 文案

- 个人：`"来自" + displayName(personalAccountId) + "个人AI框"`（查用户缓存，不用 `content.user.name`）
- 群：固定 `"来自群AI框"`（不查人）

## 布局

```
气泡
→ 表情 / 快捷操作（若有）
→ 「N条回复」（若有）
→ 来源 badge
→ 已读等（若有）
```

收到左对齐、发出右对齐；灰底 pill。禁止插在「N条回复」上方。

## 边界

| 场景 | 行为 |
|------|------|
| `fixTaskMessage` 非数字 1 | 无 badge（个人现网原会显示的改为隐藏） |
| 个人缓存 miss | 暂不显示，拉到后刷新出现 |
| 撤回 | 无 badge |
| tag | 完全按旧逻辑，与 fixTask 无关 |

## 联调坑

- 后端须下发 **数字** `1`；若发字符串 `"1"`，三端均不显示（产品已决严格相等）。
- extra 可能是 JSON 字符串，须先 parse 再读字段。

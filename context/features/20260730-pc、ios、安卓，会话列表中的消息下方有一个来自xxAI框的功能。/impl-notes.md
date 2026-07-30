# Impl Notes：定时任务消息 · 气泡下来源 badge

> 平台无关逻辑提炼。参考端：PC `MsgPersonalAiRow` + `msg-list.getAiSourceBadgeVariant`。最后更新：2026-07-30（安卓/iOS 详情仅循环时间；自己消息双 pill 反序对齐 PC `0b648606`）

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
isSelf = personalId === 当前登录用户 id

显示个人 badge ⟺ isFixTask && isPersonalAi && 昵称已解析 && 未撤回
显示群 badge   ⟺ isFixTask && isGroupAi && 未撤回
显示详情 badge ⟺ 已显示个人 badge && isSelf && detailText 非空
```

## 文案

- 个人：`"来自" + displayName(personalAccountId) + "个人AI框"`（查用户缓存，不用 `content.user.name`）
- 群：固定 `"来自群AI框"`（不查人）
- 详情（仅自己）：
  - **PC**：`triggerName + " " + cycleText`（缺一则只显示有的；都空则不渲染）
  - **安卓 / iOS**：仅 `cycleText`（**不展示** `agentSetAbilityTriggerName`；cycle 空则不渲染详情 pill）

## 详情 badge：`dealForExtraInfo`

来源：`extra.dealForExtraInfo`（整包传入展示层）。

| 字段 | 用途 |
|------|------|
| `agentSetAbilityTriggerName` | 触发名（**仅 PC 拼进详情**；安卓/iOS 忽略） |
| `cycleUnit` | `day` / `week` / `month` / `stage` / `quarter` / `year`；缺省 → 无循环文案 |
| `cycleValue` | 每 N 个周期，默认 1；为 1 时省略数字（「每天」vs「每2天」） |
| `hourMinute` 或 `time` | 时:分；`00:00` 或空不拼到文案末尾 |
| 各 unit 专属 | `weekDaysStr` / `monthDaysStr`+`monthMode` / `stageDay`+`stageMode` / `quarter*` / `year*` 等 |

`*Str` 兼容 JSON 数组字符串（`"[1,3]"`）或逗号分隔（`"1,3"`）。`weekDaysStr` 下标 `0~6` → 日一二三四五六（也兼容已是「一」这类字面量）。

文案规则对齐行动中心 LoopTaskTag；PC 另有 `MsgPersonalAiRow-format-rules.md` 细表。安卓/iOS 移植时照本表实现即可，不必抄 PC 组件名。

## 布局

```
气泡
→ 表情 / 快捷操作（若有）
→ 「N条回复」（若有）
→ 来源 badge [+ 同排详情 badge（仅自己）]
→ 已读等（若有）
```

收到左对齐、发出右对齐；灰底 pill。禁止插在「N条回复」上方。详情与来源同排。

**自己消息 pill 顺序**（对齐 PC `flex-row-reverse`）：视觉为 **详情 | 来源**，来源贴气泡右缘、详情在内侧。他人/群（仅来源）不变。双 pill 间距 **8px/8dp**（PC `gap-2`）。

## 边界

| 场景 | 行为 |
|------|------|
| `fixTaskMessage` 非数字 1 | 无 badge（个人现网原会显示的改为隐藏） |
| 个人缓存 miss | 暂不显示，拉到后刷新出现 |
| 撤回 | 无 badge |
| tag | 完全按旧逻辑，与 fixTask 无关 |
| 他人个人 AI / 群 AI | 有来源 badge 时也不出详情 badge |
| `dealForExtraInfo` 缺或无 cycle（安卓/iOS）/ 无 cycle 且无触发名（PC） | 仅来源 badge |

## 转发与 badge 字段

转发时会裁剪 `content.extra`（去掉 @ 等）。与 badge 相关约定：

| 模式 | badge 字段（`fixTaskMessage` / `personalAccountId` / `dealForExtraInfo`） |
|------|--------------------------------------------------------------------------|
| 逐条转发 / 单条长按转发 | **抹掉**（与现网一致；发出去的独立消息不显示 badge） |
| 合并转发（写入 OSS 聊天记录 txt） | **保留**（打开合并详情时子消息仍可按门闩渲染 badge） |

合并路径仍只保留：`richList`（若有）+ 上表三字段；其它 extra 键继续丢弃。

## 联调坑

- 后端须下发 **数字** `1`；若发字符串 `"1"`，三端均不显示（产品已决严格相等）。
- extra 可能是 JSON 字符串，须先 parse 再读字段。
- `dealForExtraInfo.*Str` 形态可能是 JSON 数组字符串或逗号分隔，两端都要兼容。
- **安卓**：badge 左右对齐须用 `MessageDirection.SEND`，不能用 `rightIconView == VISIBLE`——连续自己消息头像是 `INVISIBLE`，会误判居左。
- **合并转发**：若仍走「仅 richList」的逐条裁剪函数，合并详情里 badge 会丢；须用合并专用组装（安卓/iOS 已分叉）。

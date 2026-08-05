# Impl Notes：定时任务消息 · 气泡下来源 badge

> 平台无关逻辑提炼。参考端：PC `MsgPersonalAiRow` + `msg-list.getAiSourceBadgeVariant`。最后更新：2026-07-31（列表发送者昵称优先实时智能体资料）

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

## 列表发送者昵称（个人/群 AI）

气泡旁展示的发送者名（非 badge 文案）与群 AI 对齐：**优先实时智能体资料**，消息体里的 `user.name` / `senderUserInfo.name` **仅兜底**。智能体改名后，历史消息列表应同步显示新名。

| 归属 | 优先来源 | 兜底 |
|------|----------|------|
| 个人 AI（sender 为智能体前缀且带 personal 判据） | 群内智能体关系表上的当前 `agentName`（按 sender 账号匹配） | 消息体 name |
| 群 AI | 当前会话绑定的群智能体资料名（须确认账号与 sender 一致，避免个人 AI 误用群名） | 消息体 name |

PC：走统一的发送者名解析（智能体账号映射表最新名）。安卓若仍冻结消息体 name，应对齐本表。

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

转发时会裁剪 `content.extra`。**以 PC `getForwardExtraByMsgExtra` / `getCombineForwardExtraByMsgExtra` 为白名单事实来源**：

### 逐条 / 单条长按

| | |
|--|--|
| **保留** | 仅 `richList`（非空数组；整组原样拷贝，格式 type/value/startIndex/endIndex 不变） |
| **抹掉** | `@`（`atUserList` / `atAllList` / `atAllUserList`）、AI 来源（`fixTaskMessage` / `personalAccountId` / `dealForExtraInfo`）、以及其它任意键 |
| **无 richList** | extra 清空（发出去的独立消息不显示 badge） |

文本与 ActionCard（群 AI 定时常见）均应走同一白名单；复制 content 后再改 extra，避免污染原会话气泡。

### 合并转发（写入 OSS 聊天记录 txt）

| | |
|--|--|
| **保留** | `richList`（若有）+ `personalAccountId` + `fixTaskMessage` + `dealForExtraInfo` |
| **抹掉** | 其余全部（含 `@`） |

打开合并详情时子消息仍可按门闩渲染 badge。

### 合并详情列表也要渲染 badge（对齐 PC winbox）

不仅打包保留字段，打开「聊天记录」详情时，每条子消息气泡下同样展示来源/详情 pill（判定与会话列表一致）。

读写约定：

| 写入 | 读取 |
|------|------|
| 文本 content 同时带 `extra` 与 `baseExtra`（同为裁剪后的 JSON 字符串） | 优先 `baseExtra`，空则回落 `extra` |
| 若某端把 extra 写成 JSON **对象** | 读侧应 `JSON.stringify` 成字符串，**禁止清空** |

## 联调坑

- 后端须下发 **数字** `1`；若发字符串 `"1"`，三端均不显示（产品已决严格相等）。
- extra 可能是 JSON 字符串，须先 parse 再读字段。
- `dealForExtraInfo.*Str` 形态可能是 JSON 数组字符串或逗号分隔，两端都要兼容。
- **安卓**：badge 左右对齐须用 `MessageDirection.SEND`，不能用 `rightIconView == VISIBLE`——连续自己消息头像是 `INVISIBLE`，会误判居左。
- **合并转发**：若仍走「仅 richList」的逐条裁剪函数，合并详情里 badge 会丢；须用合并专用组装。
- **合并详情**：安卓须在 `CombineAdapter` 挂 badge（会话列表 binder 复用）；iOS 走既有 `ZXIMChatCell`，但建模型时须读到 `baseExtra`/`extra`。
- **iOS 合并打包**：勿只读 `yy_modelToJSONObject` 的 `content.extra`（可能空）；应用与会话 badge 相同的 `parseMsgExtraDictionary` / `content.extra` 再裁剪写入 `baseExtra`+`extra`。无字段时不要用空串覆盖原 `extra`。
- **iOS 合并建模型**：`user`/`senderUserInfo` 的 id 须写回 `message.senderUserId`（群 AI 靠 `ga_`）；文本/机器人同步 `_extra`；个人昵称拉取成功后发 `ZXNotifyGroupUserAvatarUpdatedFromDB` 刷新列表。
- **安卓合并详情 · 群 AI**：定时群 AI 多为 `ZX:ActionCardMsg`；`ActionCardTransformation` 须带 `extra`/`baseExtra`，`obtain` 后 `setExtra`，否则门闩丢失。打包 ActionCard/引用同文本写 `baseExtra`；`senderUserId` 空时回落 `userInfo.userId`。
- **旧聊天记录**：修复前已上传的合并 OSS 无 badge 字段，须重新合并转发才能验证。
- **iOS 逐条转发**：仅 Text/Reply 走「只留 richList」不够——群 AI 定时多为 ActionCard，须复制 content 后再裁 extra；`extra` 为字典时禁止整包序列化（会把 badge 字段带出）。
- **安卓逐条 ActionCard**：勿直接 `setExtra` 再 `Message.obtain` 后还原——obtain 持有同一引用会把 badge 写回待发消息；应 encode 拷贝后再白名单裁剪。
- **PC 现状**：文本逐条走白名单；ActionCard 单条目前**不**走该函数（原样带 extra）。移动端已按白名单收紧 ActionCard；若要求三端一致需另改 PC。

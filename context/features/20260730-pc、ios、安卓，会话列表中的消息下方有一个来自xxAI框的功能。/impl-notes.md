# Impl Notes：定时任务消息 · 气泡下来源 badge

> 平台无关逻辑提炼。参考端：PC `MsgPersonalAiRow` + `msg-list.getAiSourceBadgeVariant`。最后更新：2026-08-05（合并详情个人 AI 框名/头像优先消息体）

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

## 列表发送者昵称 / 头像（个人/群 AI）

**非 badge 文案**的发送者名与头像：

| 场景 | 名/头像优先 | 兜底 |
|------|-------------|------|
| **合并详情 · 个人 AI**（`personalAccountId` 有值） | 消息体 `content.user` / `userInfo` / `senderUserInfo`（AI **框**名与头像） | 默认 AI 头像；**禁止**查打开详情时所在会话的 `ga_` 缓存 |
| **合并详情 · 群 AI** | 同上消息体 | 默认 AI 头像（勿用当前会话群智能体缓存） |
| **会话列表 · 个人 AI** | 消息体名/头像 | 群内智能体关系表当前资料 |
| **会话列表 · 群 AI** | 当前会话绑定的群智能体资料（账号须与 sender 一致） | 消息体 |

合并详情昵称旁 **identity tag**：个人 →「个人AI框」；群 →「群AI框」（与会话列表一致；**无** `fixTaskMessage` 门闩）。

打包：合并 OSS 每条子消息须带齐 `content.user`（及等价 `senderUserInfo`）的 `id`/`name`/`portrait`（或 `portraitUri`），且 `senderUserId` 为 `ga_`；**只写 OSS JSON，勿改写会话里原消息的 userInfo**。

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
- **iOS 逐条转发**：禁止 `resultModel = model` 后改 `.content`——会污染会话列表原气泡；文本/ActionCard 均须 `alloc` 新 model + 拷贝后的 content。
- **安卓合并打包**：禁止对 `messageList` 里的原 `Message.getContent().setExtra(...)`；裁剪结果只写入 OSS JSON 的 `extra`/`baseExtra`。
- **安卓逐条 ActionCard**：勿直接 `setExtra` 再 `Message.obtain` 后还原——obtain 持有同一引用会把 badge 写回待发消息；应 encode 拷贝后再白名单裁剪。
- **PC 现状**：文本逐条 `map` 浅拷贝后替换 `content` 对象，一般不污染会话列表；ActionCard 单条仍不走该函数（原样带 extra）。移动端已按白名单收紧 ActionCard；若要求三端一致需另改 PC。
- **PC 多选转发空列表**：勾选回调里对文本 `emojiContent.map` 无兜底——纯文本常无该字段会抛错；条数 UI 仍更新、真正转发列表为空 → 误报「请至少选择一项」。须 `Array.isArray` 后再 map。
- **PC 转发后引用「不存在」**：ActionCard/`msg-refer` 用 `referMsgUid` 查**当前会话**列表；转发到其他会话必然 miss。转发时应剥离 `referMsgUid`（保留内嵌 `referMsg`）；读侧仅在「当前会话找得到且已撤回」时隐藏，否则展示内嵌快照。
- **PC 回复转发**：勿再把 `ReferenceMessage` 强转纯文本（会丢掉引用块）；保留类型并剥离 `referMsgUid`。
- **PC `packmysend`**：`extra` 为 JSON 字符串时禁止直接 object spread（会变成字符下标）；须先 `JSON.parse`。
- **安卓对齐（进行中）**：逐条同样保留 Reference、剥 `referMsgUid`；空 uid 勿触发「已删除」刷新。合并 OSS/预览 JSON：`content`=回复正文 + 内嵌引用 payload，并清空 `referMsgUid`；详情读侧兼容 `editSendText` 回落。
- **iOS 对齐（进行中）**：`convertModelByOriginModel` 保留 Reply 并剥 uid；合并预览拷贝 content 后剥 uid；`getRcMessageState` 无 uid 视为正常（按内嵌）；合并建模型勿把 Reply 转 Text。
- **合并转发页 · 回复**：PC 保留引用块并剥 uid。安卓若用 Gson 直接序列化 Reference，字段名与详情 `CombineReferTransformation.content` 不一致 → 正文空白；须显式写 `content` 并还原内嵌。iOS 若带着原 `referMsgUid` 在无效会话里查库 → 有的显示引用、有的显示「已删除」→ 剥 uid + 无 uid 不查库。
- **合并转发页 · AI 框回复引用头**：PC 用内嵌 `referMsg.user.name`。安卓合并详情若走精简 Transformation/`obtain` 会丢掉 `referMsg` → 无引用头；打包须 `encode()`；读侧完整 decode，且 **有 `referMsg` 即可还原**（缺 `objName` 时回落 payload.`objectName` / 文本类型）。iOS 合并建模型若未还原 `referMsgPayload`，会回落本机 UID/历史 → **不同账号看到不同错误人名**；须还原内嵌 + 合并态禁止本机回落。**旧 OSS 无引用字段须重新合并转发**。
- **合并转发页 · 点引用开聚合**：剥 uid 后勿再按本机 expansion 找回复（会「0条回复」）。合并态应用内嵌源消息 + 当前聊天记录列表里同引用的回复条数（至少含当前这条）。安卓合并详情须发**专用事件**（勿复用会话页聚合事件），否则底层会话会误开空弹窗；合成源消息勿带真实 uid / 勿开 expansion。**合成 Message 必须手写 `objectName`**（`Message.obtain` 不写，弹窗 `getObjectName().equals` 会 NPE 闪退）。
- **iOS 逐条转发（字段）**：仅 Text/Reply 走「只留 richList」不够——群 AI 定时多为 ActionCard，须复制 content 后再裁 extra；`extra` 为字典时禁止整包序列化（会把 badge 字段带出）。
- **合并详情个人 AI 名/头像**：读侧按 `senderUserId` 查**当前会话**智能体缓存会 miss/错名；须优先消息体 `user`。iOS 打包若缺 `senderUserInfo` 时写登录人会污染展示——应补 AI 框 id/name/portrait 且勿写回原消息。旧 OSS 无 `user` 须重新合并。
- **合并详情 tag**：有 `personalAccountId` + 智能体前缀 sender →「个人AI框」；与来源 badge 门闩无关。

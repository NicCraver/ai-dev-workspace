# Impl Notes：消息来自个人AI框 badge

> 平台无关逻辑提炼。参考端：PC `MsgPersonalAiRow` + `msg-list.getPersonalAccountId`。最后更新：2026-07-29

## 与 identity tag 的区别

| | 昵称旁 tag | 气泡下 badge（本功能） |
|--|-----------|----------------------|
| 文案 | `个人AI框` / `群AI框` | `来自{nickName}个人AI框` |
| 名字来源 | 发送人展示名（常为 `content.user.name`） | **归属人** `personalAccountId` → 用户缓存 nickName |
| 判据 | `personalAccountId` 有值 → 个人 | 同左 + 昵称已解析 |

## 显隐

1. 消息未撤回
2. `content.extra.personalAccountId` 有值（extra 可能是对象或 JSON 字符串，须 parse）
3. 已拿到对应账号的展示名（本地缓存或拉取成功）
4. 自己发出的个人 AI 消息也要显示（对齐气泡侧）

## 昵称解析

```
id = personalAccountId
local = 用户缓存[id]
if local.displayName → 用它
else → 请求人员详情(id) → 写缓存 → 刷新该消息行
同一 id 并发只拉一次
展示名优先「昵称/全名」字段，不用 content.user.name（那是 AI 展示名）
文案 = "来自" + displayName + "个人AI框"
```

## 布局

顺序对齐 PC：

```
气泡
→ 表情 / 快捷操作（若有）
→ 「N条回复」/ 已读统计（若有）
→ 「来自xxx个人AI框」badge
→ 底部操作按钮（若有）
```

- 收到：左对齐气泡；发出：右对齐气泡
- 样式：小 pill，灰底圆角，小字号
- **禁止**插在「N条回复」上方

## 边界

| 场景 | 行为 |
|------|------|
| 无 personalAccountId / 群 AI | 不显示 |
| 撤回 | 不显示 |
| 缓存 miss 拉取中 | 暂不显示，拉到后出现 |
| 拉取失败 | 保持不显示，不 toast |
| 无「N条回复」行 | badge 仍显示在表情/气泡下方同一挂载点 |

# Spec：消息来自个人AI框 badge

> 最后更新：2026-07-29｜对齐 PC `MsgPersonalAiRow`（气泡下方「来自xxx的个人AI框」）

## 背景与目标

群聊中个人 AI 发出的消息，`content.extra.personalAccountId` 标识归属人。PC 已在气泡**下方**展示灰底 pill：`来自{nickName}的个人AI框`。本期将同一逻辑移植到 **iOS / Android**。

成功标准：含 `personalAccountId` 且未撤回的消息，在解析到归属人昵称后，气泡下出现该 badge；与昵称旁「个人AI框」identity tag **并存、不互相替代**。

## 用户流程

1. 收到/展示含 `extra.personalAccountId` 的群聊消息
2. 用该 id 查本地用户缓存 → 命中则立刻显示 `来自{nickName}的个人AI框`
3. 未命中 → 按 accountId 拉人员详情，写入缓存后刷新该行再显示
4. 撤回消息不展示；昵称未就绪前不展示空 badge

## 范围

- 本期做：iOS + Android 气泡下来源 badge（文案、显隐、查人、布局对齐）
- 本期不做：web；改 PC；改 identity tag / 回复菜单

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本功能 | — | 实现 | 实现 | 已有（参考实现） |
| 用户缓存 | — | DataCenter fullName | CorpUserTable.name | AllUserMap name/nickName |

## 依赖的接口

- 消息字段：`content.extra.personalAccountId`（既有，见个人 AI 相关 feature）
- 人员详情：各端既有「按 accountId 查用户」接口（iOS `logicRequestUserInfo`；Android `getTheUserDetailInfoFromServer`）

## 待用户确认的问题

无（对齐 PC 已决行为）。

# Impl Notes：个人AI框-卡片资料页

> 平台无关的实现笔记。最后更新：2026-07-29

## 状态流转

- 未打开 → 点击群聊个人 AI 消息头像 → 打开智能体资料卡（加载中）→ 成功渲染精简字段 / 失败走现网兜底

## 识别

- **个人 AI**：消息 `extra.personalAccountId` 非空（不要只靠 `ga_` 前缀）
- **群 AI**：发送者为 `ga_*` 且无 `personalAccountId`

## 接口调用时序

1. 打开资料卡时请求 `POST aiBasic/agentSetBasic/getAgentBaseInfoForPlatform`
2. 个人 AI 入参：
   - `conditionType` = `im`
   - `belongId` = `personalAccountId`（消息归属人账号）
   - `belongType` = `1`（私聊归属，不是当前群 id）
   - `agentAccountId` = 消息发送者 `ga_*`
3. 成功：用回参渲染；失败：与现网群 AI 一致（有本地缓存用缓存，否则 Toast）

## 展示字段（仅个人 AI）

| 字段 | 数据源 | 空值 |
|------|--------|------|
| 头像 / 名称 | `avatar` / `name` | 用消息内嵌 user 兜底（若有） |
| 管理者 | `mainManagerList[].nickName` 拼接 | 整行不展示 |
| 智能体介绍 | `remark` | 整行不展示 |

**禁止**在个人 AI 资料卡展示：子管理员、知识范围、问答权限说明。

群 AI 资料卡逻辑与字段保持原样。

## 边界情况

- 群聊中个人 AI 与群 AI 混排 → 靠 `personalAccountId` 分流入参与字段
- 两字段皆空 → 资料卡仅头像+名称
- 私聊 / 点「来自 xxx」标签 → 本期不处理

## 错误处理策略

- 与各端现网群 AI 资料卡一致，不另造交互

## 联调坑

- PC 曾把个人 AI 头像当成普通用户对象（无 `agentAccountId`）→ 走人资料卡导致无法访问；需带上 `agentAccountId` 走智能体资料卡
- 安卓/ios 曾用当前群 `belongId`+`belongType=3` 拉个人 AI → 查错实体；必须用人归属

## 与 bridge 的交互

- 无（IM 原生/桌面壳内打开，不经 WebView bridge）

# Spec：个人AI框-卡片资料页

> 由 Superpowers brainstorm 产出。最后更新：2026-07-29

## 背景与目标

群聊中点击**个人 AI 框**消息头像时，资料卡目前打不开 / 走错成用户资料（表现为无法访问）。应打开智能体资料卡，且**仅展示「管理者」「智能体介绍」**两字段。

成功标准：群聊内点个人 AI 头像 → 打开资料卡（头像+名称+上述字段）；无数据字段整行隐藏；接口失败行为与现网群 AI 一致。

## 用户流程

1. 用户在**群聊**中看到个人 AI 消息（`extra.personalAccountId` 有值，标签「个人AI框」）。
2. 点击该消息头像。
3. 打开现有智能体资料卡 UI：
   - 拉取 `getAgentBaseInfoForPlatform`
   - 展示头像、名称
   - 有 `mainManagerList` → 展示「管理者」；否则不展示该行
   - 有 `remark` → 展示「智能体介绍」；否则不展示该行
   - **不展示**子管理员 / 知识范围 / 问答权限说明
4. 接口失败：与现网群 AI 一致（有本地缓存用缓存，否则 Toast）。

## 范围

- 本期做：
  - desktop / android / ios：群聊个人 AI 头像 → 资料卡可打开
  - 个人 AI 资料卡字段精简为 2 项（空行隐藏）
  - 入参：`agentAccountId`=发送者 `ga_*`；`belongId`=`personalAccountId`；`belongType`=1（私聊归属）；`conditionType`=`im`
- 本期不做：
  - 私聊场景
  - 点击「来自 xxx 的个人AI框」标签
  - 改群 AI 资料卡字段
  - web 端（IM 资料卡在原生/桌面壳）

## 各端差异点

| 差异点 | android | ios | desktop |
|--------|---------|-----|---------|
| 资料卡形态 | 全屏 Fragment | 全屏 Controller | 浮层 popover |
| 失败兜底 | 本地 AgentInfo 缓存 → Toast | 与现网群 AI 一致（Toast） | 回退消息内 user 信息后仍可渲染精简字段 |
| 识别 | `PersonalAiMsgHelper` | `ZXIMCellLogic personalAccountIdForMessage` | `extra.personalAccountId` |

## 依赖的接口

- `POST aiBasic/agentSetBasic/getAgentBaseInfoForPlatform`
  - 入参：`currentAccountId?`、`conditionType`、`belongId`、`belongType`、`agentAccountId`
  - 出参关键：`name`、`avatar`、`remark`、`mainManagerList[].nickName`（个人 AI 只用这些）

## 关键决策

- 仅群聊；入口=消息头像
- 个人 AI 只展示管理者 + 智能体介绍；群 AI 不变
- 空字段整行隐藏
- 失败与现网群 AI 一致
- 方案：复用现有智能体资料卡 + 个人 AI 精简模式

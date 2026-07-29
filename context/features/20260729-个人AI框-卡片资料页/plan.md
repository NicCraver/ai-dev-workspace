# 个人AI框-卡片资料页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 群聊点个人 AI 消息头像可打开资料卡，仅展示管理者 + 智能体介绍。

**Architecture:** 复用各端现有智能体资料卡；用 `extra.personalAccountId` 识别个人 AI，改用 `belongId=personalAccountId` + `belongType=1` + `agentAccountId=ga_*` 拉详情；渲染时跳过子管理/知识范围/问答权限。

**Tech Stack:** desktop Vue2 agent-info；android AgentDetailsFragment + RongIM 头像点击；ios ZXUserInfoController + Events 头像点击。

## Global Constraints

- 仅群聊；不改群 AI 字段
- 空字段整行隐藏
- 失败兜底与现网群 AI 一致
- push 仅 `personal-ai-chat`

---

## File map

| 端 | 文件 | 职责 |
|----|------|------|
| desktop | `msg-list.vue` | 个人 AI 头像传入带 `agentAccountId` 的 user |
| desktop | `agent-info.vue` | 个人 AI 精简字段；可选补 belong 入参 |
| android | `RongIM.java` / `MessageListAdapter` / `CombineAdapter` | 头像点击透传 personalAccountId |
| android | `RongMessageInit.java` | 个人 AI 用 belongType=1 |
| android | `AgentDetailsFragment.java` | belongType=1 时只渲染 2 字段 |
| ios | `ZXRCIMBaseChatController+Events.m` | 个人 AI 改 targetId/conversationType |
| ios | `ZXUserInfoController` | 个人 AI 精简字段（conversationType==PRIVATE 或显式 flag） |

---

### Task 1: Desktop 打开链路 + 精简字段 · desktop

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/message/msg-list.vue`
- Modify: `apps/desktop/src/renderer/components/common/user/agent-info.vue`

- [ ] Step 1: `personalAiPhotoUser` 增加 `agentAccountId: item.senderUserId`（及可选 `isPersonalAi: true`、`belongId`/`belongType`）
- [ ] Step 2: `agent-info.vue` 请求带上个人 AI 的 belong 入参；`setAsMainData` 若 `user.isPersonalAi` 只 push 管理者+介绍
- [ ] Step 3: 自测（或静态检查）群聊个人 AI 头像点开走 agent-pop-info

### Task 2: Android 打开链路 + 精简字段 · android

**Files:**
- Modify: `apps/android/IM/.../RongIM.java`（listener 签名）
- Modify: `MessageListAdapter.java` / `CombineAdapter.java`
- Modify: `RongMessageInit.java`
- Modify: `AgentDetailsFragment.java`

- [ ] Step 1: `onAgentPortraitClick` 增加 `personalAccountId` 参数；调用处从 `PersonalAiMsgHelper` 取值
- [ ] Step 2: `RongMessageInit`：personalAccountId 非空 → belongId=它、belongType=1；否则保持 group/3
- [ ] Step 3: `AgentDetailsFragment`：belongType==1 时 `setBaseMsgForServer/Local` 只展示主管理+介绍

### Task 3: iOS 打开链路 + 精简字段 · ios

**Files:**
- Modify: `ZXRCIMBaseChatController+Events.m`
- Modify: `ZXUserInfoController.m` / `.h`（如需 flag）

- [ ] Step 1: 头像点击若 `isPersonalAiMessage` → `targetId=personalAccountId`、`conversationType=PRIVATE`
- [ ] Step 2: `buildDataWithAgent`：个人 AI 只加管理者+介绍（空则不 add）

### Task 4: 文档收尾 · context

- [ ] 更新 `status.md` 平台矩阵
- [ ] 补 `impl-notes.md` 关键逻辑
- [ ] context `git commit`（用户未要求 apps commit 则只提交 context；apps 改动保留工作区）

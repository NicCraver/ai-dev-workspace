# 消息列表 · 个人AI框 tag / 头像名 / 回复菜单（Android）

> 对齐 PC：`context/features/20260727-at个人AI框-先做pc端/plan-msg-personal-ai-tag.md`  
> 产品规则以 PC 实测为准；实现读本功能 `impl-notes.md` + iOS notes「联调坑」+ 本 plan，**禁止**直接搬 PC/iOS 代码。

**Goal:** 群聊消息若 `content.extra` 含 `personalAccountId`，展示为「个人AI框」并用 `content.user` 的名字/头像；长按菜单：仅本人个人 AI 可「@回复」，他人个人 AI 只能「回复」。

**Tech:** `apps/android` Java；检索现网 `ga_` / 群AI框 tag / 回复菜单 / Provider（消息 Cell、会话 summary 若共用同一套解析可一并改）。

## 已决（与 PC / iOS 一致）

| 项 | 规则 |
|----|------|
| 主判据 | `extra.personalAccountId` 有值 → 个人 AI；**不要**只靠 `ga_` / `fromType` |
| `extra` | 可能是 JSON **字符串**，须 parse；失败当无个人字段 |
| tag | 个人 →「个人AI框」；群 AI（`ga_` 无该字段）→「群AI框」 |
| 名字 | 个人优先 `content.user.name`；否则现网逻辑 |
| 头像 | 个人优先 `content.user.portrait` / `portraitUri`；勿只用 senderId 查 map |
| 菜单·本人个人 AI | 只「@回复」，隐藏普通「回复」（对齐群 AI） |
| 菜单·他人个人 AI | 只「回复」，不出「@回复」 |
| 菜单·群 AI | 不变：只「@回复」 |
| 本人判定 | `String.valueOf(personalAccountId).equals(当前登录人 id)` |

## 与主 plan Task 8 关系

主 `plan.md` Task 8「按 `agentAccountId` 匹配 `groupAgentRels`」作兜底；**身份 tag / 优先名头像 / 回复菜单**以本增量 plan 为准。主功能未开项时，可先做本增量（仅消息展示），或与 Task 8 合并一次提交——实现前在 status 标明。

## Tasks

### Task 1: 解析工具

- [ ] `parseMsgExtra` / `getPersonalAccountId` / `isPersonalAiMsg`
- [ ] Commit：`feat(个人AI): 消息 extra.personalAccountId 解析`

### Task 2: 身份 tag

- [ ] `ga_`：`isPersonalAiMsg ? "个人AI框" : "群AI框"`
- [ ] Commit：`feat(个人AI): 消息身份标签区分个人与群`

### Task 3: 名字 + 头像

- [ ] 个人 AI：优先 `content.user` 的 name / portrait
- [ ] Commit：`feat(个人AI): 消息名头像优先 content.user`

### Task 4: 回复菜单分流

- [ ] 本人个人 → 仅 @回复；他人个人 → 仅回复；群 AI 不变
- [ ] Commit：`feat(个人AI): 消息回复菜单按本人他人分流`

### Task 5: 文档

- [ ] status 补 M1–M4；impl-notes 边界
- [ ] context commit：`docs(安卓端@个人AI框): 消息个人AI框展示与回复菜单`

## 约束

- 只改 Android；只 push `personal-ai-chat`
- 少改巨型类：解析工具可放功能包，宿主薄挂钩
- 群 AI 行为不变
- 编译：`./gradlew assembleOnTestDebug`（按需）

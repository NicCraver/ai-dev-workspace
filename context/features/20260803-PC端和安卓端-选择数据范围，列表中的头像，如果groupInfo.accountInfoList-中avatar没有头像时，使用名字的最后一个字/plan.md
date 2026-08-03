# 选择数据范围 · 群拼图无头像用名字末字 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。  
> 设计依据：同目录 `spec.md`；视觉：`avatar-fallback-mock.html`。

**Goal:** Desktop + Android「选择数据范围」群拼图格子在 `avatar` 为空时显示 `nickName` 末字；覆盖列表 / 搜索 / 底栏 chip。

**Architecture:** 归一化保留前 4 人 `groupMembers: [{id, nickName, avatar}]`；渲染以成员对象为准（可派生旧 `groupAvatars`）；Desktop 抽共用拼图格子组件；Android 改 `DataRangeAvatarHelper` 保留空 URL 格位并用 `createNameImage`。

**Tech Stack:** Desktop Vue 2.7（禁 `?.`/`??`）+ 既有 `data-scope-*`；Android Java + `ImageUtils.createNameImage`；单测：desktop `test/unit/personal-ai-data-scope-model.spec.js`，android `DataScopeModelTest`。

## Global Constraints

- **范围**：只改 desktop + android；web / ios / 私聊行不动。
- **名字**：只用 `accountInfoList[].nickName`，不查本地通讯录。
- **布局 / 空位底色**：1～4 人格局与 `#f3f3f3` 空位底色本期不动。
- **业务逻辑**：全选 / 保存 / 搜索过滤不变。
- **提交**：apps 各仓独立 commit；context 用 `docs(数据范围群拼图末字): …`。

## File Structure

| 文件 | 职责 |
|------|------|
| `apps/desktop/.../data-scope-model.js` | 归一化产出 `groupMembers` + 派生 `groupAvatars` |
| `apps/desktop/.../data-scope-group-avatar.vue`（新建） | 群拼图：图 / 末字 / 默认图 |
| `apps/desktop/.../data-scope-list-item.vue` | 改用上述组件 |
| `apps/desktop/.../data-scope-search-box.vue` | 搜索结果改用上述组件 |
| `apps/desktop/.../personal-ai-data-scope-dialog.vue` | 底栏 chip 改用上述组件；已选回填带 `groupMembers` |
| `apps/desktop/test/unit/personal-ai-data-scope-model.spec.js` | 归一化单测 |
| `apps/android/.../DataScopeModel.java` | `GroupMember` + `groupMembers`；`extractGroupMembers` |
| `apps/android/.../DataRangeAvatarHelper.java` | 拼图保留空格；末字 bitmap |
| `apps/android/.../DataScopeModelTest.java` | 归一化 / 成员保留单测 |

---

## Task 1: Desktop 归一化 groupMembers [desktop]

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-model.js`
- Modify: `apps/desktop/test/unit/personal-ai-data-scope-model.spec.js`

**Interfaces:**
- Produces: 归一化项增加 `groupMembers: Array<{ id: string, nickName: string, avatar: string }>`（最多 4）；`groupAvatars` 仍为由 avatar 组成的 string[]（兼容）

- [ ] **Step 1:** 在 `normalizeDialogueList` 群分支：

```js
var groupMembers = [];
if (isGroup) {
  members.slice(0, GROUP_AVATAR_MAX).forEach(function (member) {
    var m = member || {};
    groupMembers.push({
      id: m.id != null ? String(m.id) : "",
      nickName: (m.nickName && String(m.nickName).trim()) || "",
      avatar: (m.avatar && String(m.avatar).trim()) || ""
    });
  });
}
var groupAvatars = groupMembers.map(function (m) {
  return m.avatar;
});
// result.push({ ..., groupMembers: groupMembers, groupAvatars: groupAvatars })
```

- [ ] **Step 2:** 单测：前 4 人截断；空 avatar 仍占位且 nickName 保留；人项 `groupMembers` 为空数组
- [ ] **Step 3:** 跑 `npm test -- personal-ai-data-scope-model`（或仓库既有 vitest/karma 命令）期望 PASS
- [ ] **Step 4:** Commit（desktop）：`feat(data-scope): normalize groupMembers for letter avatar`

---

## Task 2: Desktop 共用拼图组件 + 三处接线 [desktop]

**Files:**
- Create: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-group-avatar.vue`
- Modify: `data-scope-list-item.vue`、`data-scope-search-box.vue`、`personal-ai-data-scope-dialog.vue`（chip + 已选回填）

**Interfaces:**
- Props: `members: Array`（`groupMembers`）、可选 `size`（列表 40 / chip 更小）
- 单格：`avatar` 非空 → `<img>`；否则 `nickName` 非空 → 末字（`nickName.slice(-1)`，可用 `v-randombgcolor` + `accountId`/`id`）；否则默认人像 `default_people.png`
- 无成员：整圆默认群头像 `default_group.png`（与现网一致）

- [ ] **Step 1:** 新建 `data-scope-group-avatar.vue`：圆形 2×2 flex，背景 `#f3f3f3`；样式对齐现 `pa-ds-avatar-group` / chip 格子；**禁止**改 3 人缺右下布局
- [ ] **Step 2:** `data-scope-list-item` 用 `<data-scope-group-avatar :members="item.groupMembers || []" />` 替换 URL 循环
- [ ] **Step 3:** `data-scope-search-box` 同上
- [ ] **Step 4:** dialog 底栏 chip 同上；`enrich`/回填已选时透传 `groupMembers`（从 dialogue 命中拷贝，与现 `groupAvatars` 回填同路径）
- [ ] **Step 5:** 手测：有图 / 无图有名 / 无名 / 3 人缺右下；`npm run lint`
- [ ] **Step 6:** Commit：`feat(data-scope): letter fallback for group collage cells`

---

## Task 3: Android 归一化 groupMembers [android]

**Files:**
- Modify: `apps/android/smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select/DataScopeModel.java`
- Modify: `apps/android/smart_message/src/test/java/com/cnmts/smart_message/personal_ai_select/DataScopeModelTest.java`

**Interfaces:**
- Produces:

```java
public static final class GroupMember {
    public String id = "";
    public String nickName = "";
    public String avatar = "";
}
// NormalizedDialogueItem.groupMembers: List<GroupMember>
// groupAvatars 仍派生自 avatar，兼容旧调用
```

- [ ] **Step 1:** `extractGroupMembers` 取前 4；`avatar`/`nickName` trim 空串；`groupAvatars` = 各 member.avatar
- [ ] **Step 2:** 单测：4 人截断；空 avatar 仍保留 member 且 nickName 在；人项空 list
- [ ] **Step 3:** 跑 `./gradlew :smart_message:test --tests DataScopeModelTest` 期望 PASS
- [ ] **Step 4:** Commit：`feat(data-scope): normalize groupMembers with nickName`

---

## Task 4: Android DataRangeAvatarHelper 末字拼图 [android]

**Files:**
- Modify: `apps/android/smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select/DataRangeAvatarHelper.java`
- 调用方（若只传 `List<String>`）：改为传 `List<GroupMember>` 或并行 names——优先改 `bindGroupAvatar` 签名吃 `List<DataScopeModel.GroupMember>`，并从 `DataRangeDialogueSession` / adapter 取 `groupMembers`

**Interfaces:**
- `bindGroupAvatar(context, imageView, groupId, List<GroupMember> members)`
- 规则：成员列表非空 → 按 1～4 格拼（含空 avatar）；每格有 avatar 则 Glide 拉图，失败或空则 `ImageUtils.createNameImage(id, lastChar, textSize)`（nickName 空则 `worker_img`）；画布底色仍 `#f3f3f3`
- **删除/停用**「只 collectNonEmptyUrls 导致格数塌缩」的路径（远程拼图必须按成员数占位）

- [ ] **Step 1:** 改 helper：按 `members.size()`（≤4）布局；空 avatar 不 drop
- [ ] **Step 2:** `SelectDataRangeAdapter`、底栏 `DataRangeMultiFooterHelper`、已选弹层等所有 `bindGroupAvatar`/`bindScopeAvatar` 入口改传 `groupMembers`
- [ ] **Step 3:** 真机/模拟器手测列表 + 搜索 + 底栏 chip；3 人缺右下仍为 `#f3f3f3`
- [ ] **Step 4:** Commit：`feat(data-scope): name-letter cells in group collage`

---

## Task 5: 文档收尾 [多端]

**Files:**
- Modify: 本功能 `status.md`、`impl-notes.md`（规则沉淀，平台无关）

- [ ] **Step 1:** 矩阵：desktop/android 开发与自测格更新；web/ios 标 —
- [ ] **Step 2:** impl-notes 写清：成员对象、单格优先级、不跳过空 avatar、空位底色不动
- [ ] **Step 3:** context wrapup commit

---

## Spec 覆盖自检

| Spec 要求 | 任务 |
|-----------|------|
| Desktop 列表/搜索/chip 末字 | T1–T2 |
| Android 同上 | T3–T4 |
| 仅 nickName、不查本地 | Global + T1/T3 |
| 不跳过空格、布局/底色不动 | T2/T4 |
| Web/iOS/私聊不做 | Global |
| 契约不改 | — |

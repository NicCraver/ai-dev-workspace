# 安卓端@个人AI框 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 群聊可 `@` 自己的个人 AI 框；选定后显示独立筛选条（知识类型 + DataScope + 时间 + 联网）；发送走 `aiRobtChat` 并带齐 `agentId` / `dataRangeScopeList`。

**Architecture:** 在现网 `@` 群智能体链路上按 `agentKind: group | personal` 分流。群筛选继续用 `GroupChatAgentDataCheckView`；个人 AI 新建独立筛选条，DataScope 经 `CoreApiUtil.selectDataRangeScope` 打开已有 `SelectDataRangeActivity`。共享 `ga_`（`Constants.AGENT_TYPE`）判断点改认 `agentKind`，保证群行为不变。

**Tech Stack:** `apps/android` — Java 为主；融云 IM；Retrofit2 + RxJava3；`AiChatBasicInterface`；跨模块 `CoreApiUtil`。无单元测试 → 验收靠 `./gradlew assembleOnTestDebug` + 真机 E2E。

**Design doc:** [`spec.md`](./spec.md)

**端标注：** 以下任务均为 **(android)**。

## Global Constraints

- **仅改 Android**：`apps/android/`；产品规则整表继承 PC/iOS spec。
- **隔离**：共享点一律按 `agentKind` 分支；禁止在群分支夹带个人 AI 字段/请求。
- **判别**：不能只靠 `Constants.AGENT_TYPE`（`ga_`）；插入 `@` 时写入 `agentKind`；`groupAgentType` 群=3 / 个人=0。
- **agentId（个人）**：`groupAgentRels[]` 中 `accountId === 当前登录人` 的对象的 `agentId`。
- **工具栏「@智能体」**：只插群智能体。
- **互斥**：智能体合计最多一个；已有后再 `@` → 列表不出两类智能体，仍可 `@人`。
- **发送**：`agentId` 群与个人均必传；`aiRoleId` 两边仍现网值（通常登录态 `aiRoleId`）；`dataRangeScopeList` 仅个人带。
- **胶囊**：知识类型「类型+N」（群侧同步）；DataScope「数据+N」。
- **DataScope**：勾选含 1/2/4 显示；`null`→`[]`；经 `CoreApiUtil.selectDataRangeScope` 打开 `SelectDataRangeActivity`；无上限。
- **工程**：少改存量巨型类；新逻辑进 `IM/.../dialogue/personal_ai_at/`；宿主薄挂钩；只 push `personal-ai-chat`；不推进「选择AI框」未提交债。
- **验证**：每任务至少 `assembleOnTestDebug` 通过；关键路径 E2E 见 Task 9。

## Plan Defaults

| 开项 | 默认 |
|------|------|
| 取消 `@` / 清空 / 发送成功 | 对应筛选条**立即隐藏**并 reset |
| 草稿恢复 | **带回可见性**；筛选内容再 `getAgentDataRange` |
| `groupAgentRels` 时机 | 随 `group/get`（`GetGroupInfoInterface.getGroupManageMessage`）解析；切会话清空；不做新建/删除实时推送 |
| get/save 失败 | 仅 `LogUtil` / `Log`，不 toast（对齐群；Picker 内既有 toast 不动） |

## File Structure

**新建**（相对 `apps/android/`）：

| 文件 | 职责 |
|------|------|
| `IM/.../dialogue/personal_ai_at/PersonalAiFilterBar.java` | 个人 AI 筛选条：类型 + DataScope + 时间 + 联网 |
| `IM/.../res/layout/view_personal_ai_filter_bar.xml` | 个人条布局（可参考 `ai_agent_data_choose_view.xml`） |
| `IM/.../dialogue/personal_ai_at/PersonalAiFilterHost.java`（或同级 Helper） | 挂载/显示隐藏/get·save/启动 DataScope；供 `RongExtension` 薄调 |

**修改：**

| 文件 | 改什么 |
|------|--------|
| `android_net/.../bean/GroupListResponse.java` | `GroupAccountInfoBean.groupAgentRels`；`GroupAgentRelBean` 补 `groupAgentType`、`accountId` |
| `IM/.../mention/MentionBlock.java` | `agentKind`、`agentId`；toJson/from 草稿带上 |
| `IM/.../widge/at_persion/AtPersonBean.java` | `agentKind`、`agentId`（列表→MentionBlock 拷贝） |
| `IM/.../widge/at_persion/GroupAtFragment.java` | 注入自己的个人 AI；互斥；群项写 `agentKind=group` |
| `IM/.../dialogue/RongExtension.java` | `showGroup…` 只认群；新增个人条挂载入口 |
| `IM/.../dialogue/ConversationLargeInputView.java` | 与普通输入对称挂个人条 |
| `IM/.../dialogue/ConversationFragment.java` | `@` 回填、发送前读个人 getter、hide 分流 |
| `IM/.../base/ConversationFragmentParent.java` | `uploadMessageToAgent` 补 `agentId` + 条件 `dataRangeScopeList` |
| `IM/.../dialogue/agent_data_check/GroupChatAgentDataCheckView.java` | 「数据+N」→「类型+N」 |
| `IM/.../mention/ChatInputManager.java` / draft 恢复 | 保留 `agentKind`；旧草稿 `ga_` 无 kind 兜底 group |

**只读对照：** `context/contracts/personalAiFrame/*`；`SelectDataRangeActivity`；`CoreApiUtil.selectDataRangeScope`；iOS `impl-notes.md`；PC/iOS spec。

**跨模块注意：** `IM` **不要**直接 import `smart_message.personal_ai_select.*`；打开 DataScope 用：

```java
CoreApiUtil.selectDataRangeScope(fragment, requestCode, openJson);
// openJson: {"agentId":"...","accountId":"..."}
```

---

### Task 1: (android) 模型 — `agentKind` + `groupAgentRels`

**Files:**
- Modify: `android_net/.../bean/GroupListResponse.java`
- Modify: `IM/.../mention/MentionBlock.java`
- Modify: `IM/.../widge/at_persion/AtPersonBean.java`

**Interfaces:**
- Produces:
  - `GroupAccountInfoBean.groupAgentRels: List<GroupAgentRelBean>`
  - `GroupAgentRelBean.groupAgentType`、`accountId`
  - `MentionBlock.agentKind`（`"group"` / `"personal"`）、`agentId`
  - `AtPersonBean` 同名字段 + getter/setter

- [ ] **Step 1: `GroupListResponse` 补字段**

```java
// GroupAccountInfoBean
private List<GroupAgentRelBean> groupAgentRels;
public List<GroupAgentRelBean> getGroupAgentRels() { return groupAgentRels; }
public void setGroupAgentRels(List<GroupAgentRelBean> groupAgentRels) { this.groupAgentRels = groupAgentRels; }

// GroupAgentRelBean 增补
public int groupAgentType; // 3=群，0=个人
public String accountId;   // 个人归属人；群项可为 null
```

- [ ] **Step 2: `MentionBlock` / `AtPersonBean` 加 kind**

```java
// MentionBlock
public String agentKind; // "group" | "personal" | null
public String agentId;

// toJson / 草稿反序列化处一并 putOpt / optString
```

从 `AtPersonBean` 生成 `MentionBlock` 时拷贝这两个字段。

- [ ] **Step 3: 编译**

```bash
cd apps/android && ./gradlew :android_net:compileOnTestDebugJavaWithJavac :IM:compileOnTestDebugJavaWithJavac
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit（android 仓）**

```bash
git -C apps/android add -A && git -C apps/android commit -m "feat(个人AI): 增加 agentKind 与 groupAgentRels 模型"
```

---

### Task 2: (android) `@` 列表注入个人 AI + 互斥

**Files:**
- Modify: `GroupAtFragment.java`（`addAgentToDataList` / 拉群 info 成功回调 ~674）
- Modify: 将 AtPerson → MentionBlock 的转换处拷贝 `agentKind`/`agentId`

**Interfaces:**
- Consumes: `result.getData().getGroupAgentRels()`、当前登录 `accountId`
- Produces: 列表项带 `agentKind`；群项 `group`，个人项 `personal` + `agentId`

- [ ] **Step 1: 辅助 — 取自己的个人 AI**

```java
static GroupListResponse.GroupAgentRelBean ownPersonalAgentRel(
        List<GroupListResponse.GroupAgentRelBean> rels, String me) {
    if (rels == null || StringUtils.isEmpty(me)) return null;
    for (GroupListResponse.GroupAgentRelBean rel : rels) {
        if (rel != null && me.equals(rel.accountId)
                && !StringUtils.isEmpty(rel.agentAccountId)) {
            return rel;
        }
    }
    return null;
}
```

- [ ] **Step 2: 注入顺序**

在现有 `groupAgentRel` 注入处：设群项 `agentKind=group`。随后若有 `ownPersonalAgentRel`，再 `addAgentToDataList` 个人项（`agentKind=personal`，`agentId=rel.agentId`，展示 `agentName`/`agentAvatar`）。

顺序期望：所有人 → 群智能体 → 自己的个人 AI → 成员…

- [ ] **Step 3: 互斥**

若 `choosedList` / 已选 mention 已含任一 `agentKind` 为 group/personal，或兜底 `accountId` 含 `ga_`：header **不插入**群/个人智能体（仍显示所有人与成员）。打开 `@` 前若输入区已有智能体 `@`，同样不出两类智能体。

- [ ] **Step 4: 工具栏「@智能体」**

`insertAtGroupAgent` / `btn_at_agent`：只插群；`MentionBlock.agentKind = "group"`；已有智能体则不插。

- [ ] **Step 5: 编译 + 手测列表**

群聊输入 `@`：有自己的个人 AI 则出现；已 `@` 群智能体后再 `@` 不应再出智能体。

- [ ] **Step 6: Commit**

```bash
git -C apps/android commit -am "feat(个人AI): @列表注入个人AI并互斥"
```

---

### Task 3: (android) 筛选条挂载分流 — `agentKind`

**Files:**
- Modify: `RongExtension.java`（`showGroupAiAgentDataCheckView`、`onDeleteAtAgentEvent` / `onPastAtAgentEvent`、草稿恢复）
- Modify: `ConversationLargeInputView.java`（`setGroupAtMembers` / `showGroupAiAgentDataCheckView`）
- Modify: `ConversationFragment.java`（`@` 回填 `showGroupAiAgentDataCheckView(hasAtAiAgent)` ~2358、~623）

**Interfaces:**
- Produces:
  - `hasGroupAgentMention(List<MentionBlock>)` / `hasPersonalAgentMention(...)`
  - 群条可见性只跟群 mention
  - 个人条可见性跟个人 mention（Task 5 接线；本任务先保证个人不出群条）

- [ ] **Step 1: 拆分判断**

```java
static boolean hasGroupAgentMention(List<MentionBlock> blocks) {
    if (blocks == null) return false;
    for (MentionBlock b : blocks) {
        if ("group".equals(b.agentKind)) return true;
        if (StringUtils.isEmpty(b.agentKind)
                && b.userId != null && b.userId.startsWith(Constants.AGENT_TYPE)) {
            return true; // 旧草稿兜底群
        }
    }
    return false;
}
static boolean hasPersonalAgentMention(List<MentionBlock> blocks) {
    if (blocks == null) return false;
    for (MentionBlock b : blocks) {
        if ("personal".equals(b.agentKind)) return true;
    }
    return false;
}
```

- [ ] **Step 2: 群条只认群**

所有 `showGroupAiAgentDataCheckView(true, …)` 入口改为 `hasGroupAgentMention`；**不要**因个人 AI `@` 打开群条。

个人条显示钩子可先留空方法 `showPersonalAiFilterBar(boolean)`，Task 5 实现。

- [ ] **Step 3: 发送/删除/清空**

删 `@` / 清空 / 发送成功：分别 hide 群条与个人条（个人条实现前至少不误开群条）。

- [ ] **Step 4: 编译 + 回归**

`@` 群智能体仍出群条；选个人 AI（若列表已有）应**不出**群条。

- [ ] **Step 5: Commit**

```bash
git -C apps/android commit -am "fix(个人AI): 筛选条挂载按 agentKind 分流"
```

---

### Task 4: (android) 个人 AI 筛选条 UI

**Files:**
- Create: `IM/.../dialogue/personal_ai_at/PersonalAiFilterBar.java`
- Create: `IM/.../res/layout/view_personal_ai_filter_bar.xml`
- 参考: `GroupChatAgentDataCheckView` + `ai_agent_data_choose_view.xml`（胶囊交互）；**勿**把个人逻辑塞进群 View

**Interfaces:**
- Produces:
  - 高度对齐群条现网高度
  - `bind(LastAiAgentChooseDataRspDTO dto)` / update
  - Listener：类型/时间/联网变更、`onDataScopeClick`
  - DataScope 胶囊：`数据+N`；知识类型：`类型+N`
  - DataScope 可见：勾选含 type `1|2|4`

- [ ] **Step 1: 搭建条 UI**

横向胶囊：知识类型、DataScope（条件显示）、时间、联网。深思无控件，DTO 内透传。

- [ ] **Step 2: DataScope 点击只回调**

条本身不 start Activity；由 Host（Task 5）调 `CoreApiUtil`。

- [ ] **Step 3: 编译**

```bash
cd apps/android && ./gradlew :IM:compileOnTestDebugJavaWithJavac
```

- [ ] **Step 4: Commit**

```bash
git -C apps/android commit -am "feat(个人AI): 新增 PersonalAiFilterBar"
```

---

### Task 5: (android) 挂载个人条 + get/save + DataScope

**Files:**
- Create: `IM/.../dialogue/personal_ai_at/PersonalAiFilterHost.java`（推荐）
- Modify: `RongExtension.java`、`ConversationLargeInputView.java` — 容器 addView 薄挂钩
- Modify: `ConversationFragment.onActivityResult`（或现有 AutoCallback 通路）处理 DataScope ACK 后再 get
- 复用: `AiChatBasicInterface.getAgentDataRange` / `saveDataRange`
- 复用: `CoreApiUtil.selectDataRangeScope`

**Interfaces:**
- Consumes: `hasPersonalAgentMention`；个人 `agentId`（MentionBlock 或 `ownPersonalAgentRel`）
- Produces: 个人条实例；缓存 `LastAiAgentChooseDataRspDTO`（含 `dataRangeScopeList`）；getter 供发送前读取

- [ ] **Step 1: 显示/隐藏**

`hasPersonalAgentMention` → 显示个人条并 get；否则 hide + reset。与群条互斥显示（同时最多一条）。

- [ ] **Step 2: get（个人入参）**

```java
Map<String, Object> params = new HashMap<>();
params.put("accountId", PrefManager.getAccountId());
params.put("agentId", personalAgentId); // 禁止走 belongId/belongType 群路径
```

失败仅日志。`dataRangeScopeList == null` → 当 `[]`；刷新条。

- [ ] **Step 3: save（类型/时间/联网变更）**

全量：`dataRangeList` + `timeType` + `netSearch` + `deepThink` + `dataRangeScopeList`（null→空列表）。失败只日志。

- [ ] **Step 4: DataScope**

```java
JSONObject open = new JSONObject();
open.put("agentId", personalAgentId);
open.put("accountId", PrefManager.getAccountId());
CoreApiUtil.selectDataRangeScope(conversationFragment, REQ_PERSONAL_DATA_RANGE, open.toString());
```

`onActivityResult` / ACK 成功后 **再 get** 刷条（Picker 内已 save）。

- [ ] **Step 5: 取消/发送/切会话**

对齐 Plan Defaults：立即 hide；切会话 reset。

**发送前缓存：** 在 hide/清 `@` **之前**把个人条 DTO 读出交给 `uploadMessageToAgent`（见 Task 6）。

- [ ] **Step 6: 编译 + 手测**

`@` 个人 AI → 出条 → 改类型会 save → 点数据+N 出 `SelectDataRangeActivity`。

- [ ] **Step 7: Commit**

```bash
git -C apps/android commit -am "feat(个人AI): 挂载筛选条并接 get/save/DataScope"
```

---

### Task 6: (android) `aiRobtChat` 补 `agentId` + 个人 scopes

**Files:**
- Modify: `ConversationFragmentParent.uploadMessageToAgent`（~178）
- Modify: `ConversationFragment` 发送成功旁路（~1907）：按 kind 取群条或个人条 DTO；触发条件改为「任一智能体 `@`」

**Interfaces:**
- 群：`agentId` = 群条 get 回参顶层 `chooseDataRspDTO.getAgentId()`（或现网 `GroupChatAgentDataCheckView` 内 agentId）；**不传** scopes（或 null）
- 个人：`agentId` = 个人 agentId；`dataRangeScopeList` = 条缓存（null→`[]`）
- `aiRoleId`：两边继续 `this.aiRoleId`（现网）

- [ ] **Step 1: 组参写入 `agentId` / 条件写入 scopes**

```java
params.put("agentId", agentId); // 群、个人均必传
if (isPersonal) {
    List<?> scopes = chooseDataRspDTO.getDataRangeScopeList();
    params.put("dataRangeScopeList", scopes != null ? scopes : new ArrayList<>());
}
```

- [ ] **Step 2: 发送分支**

```java
LastAiAgentChooseDataRspDTO dto;
String agentId;
boolean personal = hasPersonalAgentMention(...);
if (personal) {
    dto = mRongExtension.getPersonalAiCheckData(); // 须在 hide 前取
    agentId = /* personal agentId */;
} else {
    dto = mRongExtension.getGroupAgentCheckData();
    agentId = dto != null ? dto.getAgentId() : null;
}
if (dto != null) {
    uploadMessageToAgent(..., dto, agentId, personal);
}
mRongExtension.showGroupAiAgentDataCheckView(false, null);
mRongExtension.showPersonalAiFilterBar(false);
```

- [ ] **Step 3: 编译 + 抓包/日志确认字段**

- [ ] **Step 4: Commit**

```bash
git -C apps/android commit -am "feat(个人AI): aiRobtChat 补 agentId 与 dataRangeScopeList"
```

---

### Task 7: (android) 群条胶囊「类型+N」

**Files:**
- Modify: `GroupChatAgentDataCheckView.java` ~234

```java
// was: "数据+" + count
tvDataRangeText.setText("类型+" + count);
```

仅改知识类型胶囊；若后续个人条另有 DataScope「数据+N」勿混改。

- [ ] **Step 1: 改文案**
- [ ] **Step 2: 编译**
- [ ] **Step 3: Commit**

```bash
git -C apps/android commit -am "fix(群智能体): 知识类型胶囊改为类型+N"
```

---

### Task 8: (android) 消息发送人回显（个人 AI）

**Files:**
- 检索 `agentAccountId` / `ga_` 头像昵称回显处（会话列表 summary、消息 Cell Provider 等）
- 用 `groupAgentRels` 按 `agentAccountId` 匹配 `agentName` / `agentAvatar`

- [ ] **Step 1: 回显补个人 rel 查找**（无匹配再走群 `groupAgentRel`）
- [ ] **Step 2: 手测个人 AI 回复气泡头像昵称**
- [ ] **Step 3: Commit**

```bash
git -C apps/android commit -am "feat(个人AI): 消息回显匹配 groupAgentRels"
```

---

### Task 9: (android) E2E 与文档收尾

**Files:**
- Update: `context/features/20260728-安卓端@个人AI框/status.md`
- Update: `impl-notes.md`（平台无关；可对齐/引用 iOS notes，补 Android 联调坑）

**验收清单：**

- [ ] 群聊 `@` 列表出现自己的个人 AI；他人个人 AI 不出
- [ ] `@` 个人 → 独立筛选条；DataScope 条件与 `SelectDataRangeActivity` 正常；改筛选会 save
- [ ] 发送后 AI 回复群内可见；请求含 `agentId` + `dataRangeScopeList`
- [ ] 回复消息后再 `@` 个人 AI，`referUuid` 有值
- [ ] 群智能体主流程回归：`@` → 改筛选 → 发送 → 回复；胶囊为「类型+N」
- [ ] 互斥：不能同时 `@` 群+个人；已有后再 `@` 不出智能体
- [ ] 取消/清空/发送成功立即藏条
- [ ] `./gradlew assembleOnTestDebug` 通过

- [ ] **更新 status 矩阵**（页面开发 / 联调 / 自测）
- [ ] **wrapup 提交 context**

```bash
git add context/ && git commit -m "docs(安卓端@个人AI框): 同步实现进展"
```

---

## Spec coverage（自检）

| Spec 要求 | Task |
|-----------|------|
| 只群聊 / 互斥 / 工具栏只插群 | 2, 3 |
| `agentKind` + 不靠 `ga_` | 1, 3 |
| `groupAgentRels` → agentId | 1, 2, 5, 6 |
| 独立筛选条 | 4, 5 |
| DataScope + SelectDataRangeActivity | 4, 5 |
| get/save 全量 / 错误只日志 | 5 |
| aiRobtChat agentId + scopes | 6 |
| 类型+N 群侧同步 | 7 |
| 回复+referUuid | 6（沿用现网 reply） |
| 回显 | 8 |
| 取消藏条 / 草稿可见性 | 5, 9 |
| 大输入对称 | 3, 5 |
| E2E / 文档 | 9 |

## 执行方式

Plan 已保存至 `context/features/20260728-安卓端@个人AI框/plan.md`。

**1. Subagent-Driven（推荐）** — 每 Task 新开子代理，任务间复核  
**2. Inline Execution** — 本会话按 Task 连续执行  

选哪种？

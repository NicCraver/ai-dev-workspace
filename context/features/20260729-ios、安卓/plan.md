# ios / 安卓 · 群机器人可 @ 判定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** android + ios 群聊 `@` 列表与消息「@回复」按 `chatRobotType` / `hasCallBackAddress` 统一判定可 @ 机器人。

**Architecture:** 机器人仍只来自 `POST /api/chat/v1/group/get` → `groupRobots[]`。补齐并落库 `hasCallBackAddress`；各端一个纯函数 `canAtRobot`；`@` 列表组装时过滤；消息菜单在 sender 为 `robot_` 时查本群机器人再决定是否出「@回复」。

**Tech Stack:** Android Kotlin/Java + GreenDao；iOS Objective-C；契约 TypeScript `.d.ts`。

## Global Constraints

- 本期只做 **android + ios**；web / desktop 不改。
- 判定：`String(chatRobotType) !== "1" || String(hasCallBackAddress) === "1"`。
- 不可 @：`@` 列表不展示；菜单藏「@回复」、保留「回复」。
- 查不到机器人详情 → 按不可 @（不展示「@回复」）。
- 群设置页机器人列表不过滤。
- 比较字段统一转字符串，兼容 number / string。

---

### Task 1: 契约 · groupRobots 片段（多端文档）

**Files:**
- Create: `context/contracts/personalAiFrame/groupGet.groupRobots.d.ts`（或 `context/contracts/chat/groupGet.groupRobots.d.ts`，与现有 `groupGet.groupAgentRels.d.ts` 同目录惯例）
- Modify: `context/contracts/README.md`（登记新文件一行）

**Interfaces:**
- Produces: `GroupRobotInfo { chatAccountId, chatRobotName, chatRobotType?, hasCallBackAddress?, chatRobotState?, … }`；`GroupGetRobotsSlice { groupRobots?: GroupRobotInfo[] }`

- [ ] **Step 1: 写契约文件**

参考现有 `groupGet.groupAgentRels.d.ts` 风格：文件头写 `POST /api/chat/v1/group/get`、Changelog、本功能消费方说明。至少声明：

```ts
export interface GroupRobotInfo {
  chatAccountId: string;
  chatRobotName?: string;
  chatRobotImage?: string;
  /** 机器人状态：-1 解绑，1 正常 */
  chatRobotState?: string | number;
  /**
   * 机器人类型。为 1 时须 hasCallBackAddress===1 才可 @；
   * 不为 1（含缺省）均可 @。
   */
  chatRobotType?: string | number;
  /**
   * 是否有回调地址。1 = 有。仅 chatRobotType===1 时参与可 @ 判定。
   */
  hasCallBackAddress?: string | number;
}
```

并在注释写明纯逻辑：

```
canAtRobot = String(chatRobotType) !== "1" || String(hasCallBackAddress) === "1"
```

- [ ] **Step 2: README 登记路径**

- [ ] **Step 3: Commit（context）**

```
docs(contract): group/get groupRobots 补 hasCallBackAddress 可@判定
```

---

### Task 2: Android · 模型落库 hasCallBackAddress + canAtRobot（android）

**Files:**
- Modify: `apps/android/android_net/.../bean/RobotDataBean.java` — 增字段 getter/setter
- Modify: `apps/android/base_data/.../GroupRobot.java` — GreenDao 实体增 `hasCallBackAddress`（String，与 chatRobotType 一致）
- Modify: `apps/android/base_data/.../GroupRobotDao.java` — 若项目用手写 Dao，同步列；若用 greendao generator，按仓库惯例重新生成
- Modify: `apps/android/smart_message/.../GroupInfoSaveDaoUtil.java` — `insertOrUpdateGroupRobot` / `createGroupRobot*` 读写新字段
- Create: `apps/android/IM/.../util/GroupRobotAtHelper.java`（或现有 util 包）— `public static boolean canAtRobot(String chatRobotType, String hasCallBackAddress)`
- Test: 若有 JVM 单测目录则加；否则用临时 `node`/`junit` 按仓库惯例；最低在 helper 旁写 4 条断言用例注释并由手动跑一次

**Interfaces:**
- Consumes: Task 1 字段语义
- Produces: `GroupRobotAtHelper.canAtRobot(type, flag): boolean`；DB/Bean 可读写 `hasCallBackAddress`

- [ ] **Step 1: 写 canAtRobot 用例（先红后绿）**

```
type=1, flag=1 → true
type=1, flag=0 → false
type=1, flag=null → false
type=2 / null, flag=任意 → true
```

- [ ] **Step 2: 实现 helper + Bean/实体/落库**

注意 DB schema 升级：若 GreenDao 有 schema version，按项目现网升级方式加列（勿 silent crash）。旧库无列时读出来为 null → 判定为不可 @（当 type=1）。

- [ ] **Step 3: Commit（android 仓）**

```
feat(im): 群机器人落库 hasCallBackAddress + canAtRobot
```

---

### Task 3: Android · @ 列表过滤（android）

**Files:**
- Modify: `apps/android/IM/.../at_persion/GroupAtFragment.java`（约 944–956 行组装机器人处）

**Interfaces:**
- Consumes: `DataCenter.getGroupRobotList`、`GroupRobotAtHelper.canAtRobot`

- [ ] **Step 1: 在 `@机器人` 循环内加过滤**

```java
for (GroupRobot groupRobot : groupRobotList) {
    if (!GroupRobotAtHelper.canAtRobot(
            groupRobot.getChatRobotType(),
            groupRobot.getHasCallBackAddress())) {
        continue;
    }
    // 原有 AtPersonDataTypeBean 组装不变
}
```

搜索分支若另有机器人入口，同样过滤。

- [ ] **Step 2: 真机 / 调试：type=1 无回调的机器人不出现在列表**

- [ ] **Step 3: Commit**

```
feat(im): @列表按 canAtRobot 隐藏不可@机器人
```

---

### Task 4: Android · 消息 @回复 菜单（android）

**Files:**
- Modify: `apps/android/IM/.../RongMessageItemLongClickActionManager.java` — `getMessageItemLongClickActions` 与/或 `@回复` 的 `showFilter`
- 可能还需快捷「@回复」入口（若有独立 attach 按钮，对齐同一规则）

**Interfaces:**
- Consumes: `DataCenter.getGroupRobot(groupId, senderUserId)`、`canAtRobot`

- [ ] **Step 1: 识别机器人消息**

`senderUserId.startsWith("robot_")`（或项目现有 Constants）。

- [ ] **Step 2: 菜单逻辑**

```
if (isRobotMsg) {
  GroupRobot r = DataCenter.getGroupRobot(targetId, senderUserId);
  boolean canAt = r != null && canAtRobot(r.getChatRobotType(), r.getHasCallBackAddress());
  if (!canAt && "@回复".equals(title)) continue; // 仍保留「回复」
}
```

查不到 `r` → `canAt=false`。

注意：勿破坏现有 ga_ 智能体 / 个人 AI 的「@回复」分流。

- [ ] **Step 3: 自测矩阵**

| 消息 | 期望 |
|------|------|
| type≠1 机器人 | 有 @回复 |
| type=1 且 hasCallBack=1 | 有 @回复 |
| type=1 且 hasCallBack≠1 | 仅回复 |
| 普通成员 | 不变 |
| 群/个人 AI | 不变 |

- [ ] **Step 4: Commit**

```
feat(im): 机器人消息@回复受 canAtRobot 约束
```

---

### Task 5: iOS · 模型 + canAtRobot（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Base/ZX_Model/ZXGroupModel.h` — `ZXGroupRobotListModel` 增 `@property (nonatomic, copy) NSString *hasCallBackAddress;`（若接口为 number，MJExtension 仍可落到 NSString/NSNumber——按现网其它数字字段惯例，优先 `NSString` 与 `chatRobotType` 一致，或 `NSNumber` 并在 helper 内转字符串）
- Create/Modify: helper，如 `ZXGroupLogic+RobotAt` 或 `ZXRobotAtHelper`：`+ (BOOL)canAtRobotWithType:(id)type hasCallBackAddress:(id)flag;`
- 确认 `group/get` 解析路径已把整段 robot 字典灌进模型（MJExtension）；新字段无需额外 mapping 若 key 同名

**Interfaces:**
- Produces: `+[ZXRobotAtHelper canAtRobotWithType:hasCallBackAddress:]`

- [ ] **Step 1: 用例四条（与 Android 同表）**

- [ ] **Step 2: 属性 + helper**

- [ ] **Step 3: Commit（ios 仓）**

```
feat(im): 群机器人 hasCallBackAddress + canAtRobot
```

---

### Task 6: iOS · @ 列表过滤（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/.../ZXATContactContainerView.m`（约 451–453 循环 robots 处）
- 可选：在 `+[ZXGroupLogic getGroupRobots:]` 内过滤会波及群设置；**不要**在 getGroupRobots 全局滤，只在 @ UI 入口滤

- [ ] **Step 1: 循环内**

```objc
for (ZXGroupRobotListModel *tmpModel in robots) {
    if (![ZXRobotAtHelper canAtRobotWithType:tmpModel.chatRobotType
                          hasCallBackAddress:tmpModel.hasCallBackAddress]) {
        continue;
    }
    ZXContactModel *tmpContactModel = [ZXContactModel modelWithGroupRobotTable:tmpModel];
    // ...
}
```

搜索 @ 列表若另有路径，同样过滤。

- [ ] **Step 2: 自测**

- [ ] **Step 3: Commit**

```
feat(im): @列表按 canAtRobot 隐藏不可@机器人
```

---

### Task 7: iOS · 消息 @回复 菜单（ios）

**Files:**
- Modify: `apps/ios/SmartMessage/.../ZXIMCellLogic.m` — `getMessageMenuItems:` 中 `isAddAtReply` 分支
- 检查快捷 attach「@回复」（`ZXChatCellAttachView`）是否对机器人消息也要同源约束

**Interfaces:**
- Consumes: 当前会话 `groupModel.groupRobots` / `ZXGroupLogic` 查 robot by `chatAccountId`

- [ ] **Step 1: sender 为 robot_ 时**

```
查 groupRobots 中 chatAccountId == sender
canAt == NO → isAddAtReply = NO（isAddReply 保持原逻辑，通常为 YES）
```

- [ ] **Step 2: 与 Android 同一自测矩阵**

- [ ] **Step 3: Commit**

```
feat(im): 机器人消息@回复受 canAtRobot 约束
```

---

### Task 8: 文档收尾（多端 / context）

**Files:**
- Modify: `context/features/20260729-ios、安卓/status.md`
- Modify: `context/features/20260729-ios、安卓/impl-notes.md`（两端都自测通过后写平台无关笔记）

- [ ] **Step 1: 更新矩阵各任务格**

- [ ] **Step 2: impl-notes 写判定、数据源、边界（无端 API 名）**

- [ ] **Step 3: context commit**

```
docs(ios、安卓): 群机器人可@判定联调/自测进度
```

---

## 执行顺序建议

1 → 2 → 3 → 4（android 可先闭环）  
1 → 5 → 6 → 7（ios 并行）  
8 收尾

## 风险

| 风险 | 缓解 |
|------|------|
| 后端尚未回 `hasCallBackAddress` | type=1 会全部不可 @；联调前抓包确认字段名大小写 |
| GreenDao 加列升级 | 跟现网 schema 升级套路；旧数据 null 按规则处理 |
| `getGroupRobots` 被群设置共用 | 过滤只做在 @ UI，避免设置页少机器人 |
| Android `@回复` filter 对 ACTION_CARD / robot_ 条件复杂 | 在现有 filter 之上叠加 canAt，先读懂再改 |

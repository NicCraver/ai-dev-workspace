# ios端at个人AI框 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 群聊可 `@` 自己的个人 AI 框；选定后显示独立筛选条（知识类型 + DataScope + 时间 + 联网）；发送走 `aiRobtChat` 并带齐 `agentId` / `dataRangeScopeList`。

**Architecture:** 在现网 `@` 群智能体链路上按 `agentKind: group | personal` 分流。群筛选继续用 `ZXAIAgentFilterBar`；个人 AI 新建独立筛选条，DataScope 直接 present 已有 `ZXPersonalAiPickerController`。共享 `ga_`（`ZXAgentFlag`）判断点改认 `agentKind`，保证群行为不变。

**Tech Stack:** `apps/ios` — Objective-C + UIKit；融云 IM；`ZXAIAgentManager` / `ZXPersonalAiPicker*`；CocoaPods。无单元测试 → 验收靠 `xcodebuild`（`zhixinAppTest`）+ 模拟器/真机 E2E。

**Design doc:** [`spec.md`](./spec.md)

**端标注：** 以下任务均为 **(ios)**。

## Global Constraints

- **仅改 iOS**：`apps/ios/`；产品规则整表继承 PC spec。
- **隔离**：共享点一律按 `agentKind` 分支；禁止在群分支夹带个人 AI 字段/请求。
- **判别**：不能只靠 `ZXAgentFlag`（`ga_`）；插入 `@` 时写入 `agentKind`；`groupAgentType` 群=3 / 个人=0。
- **agentId（个人）**：`groupAgentRels[]` 中 `accountId === 当前登录人` 的对象的 `agentId`。
- **工具栏「@智能体」**：只插群智能体。
- **互斥**：智能体合计最多一个；已有后再 `@` → 列表不出两类智能体，仍可 `@人`。
- **发送**：`agentId` 群与个人均必传；`aiRoleId` 两边仍 `@"1"`（或现网等价）；`dataRangeScopeList` 仅个人带。
- **胶囊**：知识类型「类型+N」（群侧同步）；DataScope「数据+N」。
- **DataScope**：勾选含 1/2/4 显示；`null`→`@[]`；present `ZXPersonalAiPickerController`（`SelectDataRange`）；无上限。
- **工程**：只 push `personal-ai-chat`；新 `.m/.h` 须加入 Xcode target（`zhixinApp` / Test / Prod 按现网惯例）。
- **验证**：每任务至少编译通过；关键路径 E2E 见 Task 9。

## Plan Defaults

| 开项 | 默认 |
|------|------|
| 取消 `@` / 清空 / 发送成功 | 对应筛选条**立即隐藏**并 reset |
| 草稿恢复 | **带回可见性**；筛选内容再 `getAgentDataRange` |
| `groupAgentRels` 时机 | 随 `group/get`（`API_ImGroupInfo`）解析缓存；切会话清空；不做新建/删除实时推送 |
| get/save 失败 | 仅 `NSLog`，不 toast（对齐群） |

## File Structure

**新建**（相对 `apps/ios/SmartMessage/`）：

| 文件 | 职责 |
|------|------|
| `ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Model/ZXGroupAgentRelModel.h/.m` | 映射 `groupAgentRel` / `groupAgentRels[]`（契约 `GroupAgentRelInfo`） |
| `ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_View/ZX_IMToolBarView/ZXPersonalAiFilterBar.h/.m` | 个人 AI 筛选条：类型 + DataScope + 时间 + 联网；高度对齐 `ZXAIAgentFilterBarHeight` |
| `ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Controller/ZXRCIMBaseChatController+PersonalAiFilter.h/.m` | 个人条挂载/布局/get·save/状态；与 `+AgentFilter` 隔离 |

**修改：**

| 文件 | 改什么 |
|------|--------|
| `ZX_Base/ZX_Model/ZXGroupModel.h/.m` | 增加 `groupAgentRel` / `groupAgentRels`（MJ 映射；若进库需 ignore 或只 runtime） |
| `ZX_Modules/.../ZX_Home/ZX_Model/ZXRCAtMessageModel.h/.m` | `agentKind`、`agentId` |
| `ZX_Base/ZX_Model/ZXContactModel.h/.m` | `@` 列表用：`agentKind`、`agentId`（可选） |
| `ZX_ChatAt/.../ZXATContactContainerView.m`（及 `ZXChatATController.m` 若同源） | 注入自己的个人 AI；已有智能体时隐藏两类 |
| `ZX_RCIMBaseChatController+AgentFilter.h/.m` | `zx_hasGroupAgent…` / `zx_hasPersonalAgent…`；群条只认群 |
| `ZX_RCIMBaseChatController+SendMessage.m` | 按 kind 组旁路；传 `agentId` / scopes |
| `ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentManager.h/.m` | `requestAiRobtChat…` 增 `agentId`、`dataRangeScopeList` |
| `ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentFilterBar.m` | 「数据+N」→「类型+N」 |
| 工具栏插群智能体处 | 显式 `agentKind=group`；不插个人 |

**只读对照：** `context/contracts/personalAiFrame/*`；`ZX_PersonalAi/Picker/*`；web `DataScopeBar`（仅协议）；PC spec。

---

### Task 1: (ios) 模型 — `agentKind` + `groupAgentRels`

**Files:**
- Create: `.../ZX_Home/ZX_Model/ZXGroupAgentRelModel.h/.m`
- Modify: `ZXGroupModel.h/.m`、`ZXRCAtMessageModel.h/.m`、`ZXContactModel.h/.m`
- Xcode：新文件加入 SmartMessage / app targets

**Interfaces:**
- Produces:
  - `ZXGroupAgentRelModel`：`agentId`、`agentAccountId`、`agentName`、`agentAvatar`、`accountId`、`groupAgentType` 等
  - `ZXGroupModel.groupAgentRel` / `groupAgentRels`
  - `ZXRCAtMessageModel.agentKind`（`@"group"` / `@"personal"`）、`agentId`
  - `ZXContactModel.agentKind` / `agentId`（列表→at 模型拷贝）

- [ ] **Step 1: 新增 `ZXGroupAgentRelModel`**

对齐契约 `GroupAgentRelInfo`，MJ 映射即可。

- [ ] **Step 2: `ZXGroupModel` 挂上 rel 字段**

```objc
@property (nonatomic, strong, nullable) ZXGroupAgentRelModel *groupAgentRel;
@property (nonatomic, strong, nullable) NSArray<ZXGroupAgentRelModel *> *groupAgentRels;
```

`+mj_objectClassInArray` 声明 `groupAgentRels → ZXGroupAgentRelModel`。若 `ZXGroupModel` 持久化到 FMDB：对这两字段做 ignore，避免脏库；以 `group/get` 内存结果为准。

- [ ] **Step 3: at / contact 模型加 kind**

```objc
// ZXRCAtMessageModel
@property (nonatomic, copy, nullable) NSString *agentKind; // @"group" | @"personal"
@property (nonatomic, copy, nullable) NSString *agentId;
```

Contact 同理；从 Contact 生成 At 时拷贝这两个字段。

- [ ] **Step 4: 编译**

```bash
cd apps/ios && xcodebuild -workspace zhixinApp.xcworkspace -scheme zhixinAppTest \
  -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 15' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit（ios 仓）**

```bash
git -C apps/ios add -A && git -C apps/ios commit -m "feat(个人AI): 增加 agentKind 与 groupAgentRels 模型"
```

---

### Task 2: (ios) `@` 列表注入个人 AI + 互斥

**Files:**
- Modify: `ZXATContactContainerView.m`（`ZXContactModelWithAIAgent` / header 注入段 ~321）
- Modify: `ZXChatATController.m`（若独立构建同类 header，同步改）
- Modify: 将 Contact→At 的转换处拷贝 `agentKind`/`agentId`

**Interfaces:**
- Consumes: `groupModel.groupAgentRels`、当前 `accountId`
- Produces: 列表项带 `agentKind`；群项 `group`，个人项 `personal` + `agentId`

- [ ] **Step 1: 辅助方法 — 取自己的个人 AI**

```objc
static ZXGroupAgentRelModel *ZXOwnPersonalAgentRel(ZXGroupModel *group) {
    NSString *me = ZXDataInstance.accountModel.accountId;
    if (!me.length || !group.groupAgentRels.count) return nil;
    for (ZXGroupAgentRelModel *rel in group.groupAgentRels) {
        if ([rel.accountId isEqualToString:me] && rel.agentAccountId.length) {
            return rel;
        }
    }
    return nil;
}
```

- [ ] **Step 2: 注入顺序**

Header：所有人 → 群智能体（现网 `ZXContactModelWithAIAgent`，设 `agentKind=group`）→ 自己的个人 AI（`agentKind=personal`，`agentId=rel.agentId`，展示 `agentName`/`agentAvatar`）→ 机器人/成员…

若 `groupModel.groupAgentRels` 为空：在打开 `@` 前确保已 `group/get` 刷新（与现网拉群信息同路）；仍无则不展示个人项。

- [ ] **Step 3: 互斥**

若 `atMessageModels`（或 `didSelArray`）已含任一 `agentKind` 为 group/personal，或兜底 `userId hasPrefix:ZXAgentFlag`：header **不插入**群/个人智能体（仍显示所有人与成员）。

- [ ] **Step 4: 工具栏「@智能体」**

只插群智能体；写入 `agentKind=@"group"`；若已有智能体 `@` 则不插（现网行为）。

- [ ] **Step 5: 编译 + 手测列表**

群聊输入 `@`：有自己的个人 AI 则出现；已 `@` 群智能体后再 `@` 不应再出智能体。

- [ ] **Step 6: Commit**

```bash
git -C apps/ios commit -am "feat(个人AI): @列表注入个人AI并互斥"
```

---

### Task 3: (ios) AgentFilter — `agentKind` 分流

**Files:**
- Modify: `ZXRCIMBaseChatController+AgentFilter.h/.m`
  - `zx_hasAtAgentInInput`（~119）
  - `zx_shouldShowAgentFilterBar` / `zx_shouldTriggerAgentChat`

**Interfaces:**
- Produces:
  - `- (BOOL)zx_hasGroupAgentMention`
  - `- (BOOL)zx_hasPersonalAgentMention`
  - `- (BOOL)zx_hasAnyAgentMention`
  - 群条可见性只跟 `zx_hasGroupAgentMention`（及现网回复上下文若仅群）
  - 个人条可见性跟 `zx_hasPersonalAgentMention`（Task 5 接线）

- [ ] **Step 1: 拆分判断**

```objc
- (BOOL)zx_hasGroupAgentMention {
    for (ZXRCAtMessageModel *m in self.atMessageModels) {
        if ([m.agentKind isEqualToString:@"group"]) return YES;
        // 旧数据兜底：ga_ 且无 kind → 群
        if (!m.agentKind.length && [m.userId hasPrefix:ZXAgentFlag]) return YES;
    }
    return NO;
}
- (BOOL)zx_hasPersonalAgentMention {
    for (ZXRCAtMessageModel *m in self.atMessageModels) {
        if ([m.agentKind isEqualToString:@"personal"]) return YES;
    }
    return NO;
}
```

- [ ] **Step 2: 群条只认群**

`zx_shouldShowAgentFilterBar`：群聊 &&（`zx_hasGroupAgentMention` \|\| 现网 `zx_isReplyingInAgentContext` 若产品确认回复上下文仍只开群条）。**不要**因个人 AI `@` 打开群条。

`zx_shouldTriggerAgentChat`：改为 `zx_hasAnyAgentMention`（群或个人都要旁路），具体载荷在 Task 6 分支。

- [ ] **Step 3: 隐藏时机**

删除/清空/`atMessageModels` 变化后 `zx_refreshAgentFilterBar`；个人条在 Task 5 同步 hide。

- [ ] **Step 4: 编译 + 回归**

`@` 群智能体仍出群条；临时用 mock `agentKind=personal` 的 at 项应**不出**群条。

- [ ] **Step 5: Commit**

```bash
git -C apps/ios commit -am "fix(个人AI): AgentFilter 按 agentKind 分流"
```

---

### Task 4: (ios) 个人 AI 筛选条 UI

**Files:**
- Create: `ZXPersonalAiFilterBar.h/.m`
- 参考: `ZXAIAgentFilterBar`（胶囊交互），**勿**把 DataScope 逻辑塞进群条

**Interfaces:**
- Produces:
  - 高度：`ZXAIAgentFilterBarHeight`（或同常量）
  - `- updateWithDataRangeList:timeType:netSearch:dataRangeScopeList:`
  - callbacks：`dataRangeChanged` / `timeChanged` / `netSearchChanged` / `dataScopeTapped` / 变更后由外部 save
  - DataScope 胶囊文案：`数据+%ld`；知识类型：`类型+%ld`
  - DataScope 可见：勾选含 type `1|2|4`

- [ ] **Step 1: 搭建条 UI**

横向胶囊：知识类型、DataScope（条件显示）、时间、联网。深思无控件。

- [ ] **Step 2: DataScope 点击只回调**

条本身不 present Picker；由 Category（Task 5）present。

- [ ] **Step 3: 加入工程并编译**

- [ ] **Step 4: Commit**

```bash
git -C apps/ios commit -am "feat(个人AI): 新增 ZXPersonalAiFilterBar"
```

---

### Task 5: (ios) 挂载个人条 + get/save + DataScope Picker

**Files:**
- Create: `ZXRCIMBaseChatController+PersonalAiFilter.h/.m`
- Modify: ToolBar 布局（`zx_layoutAgentFilterBarWithToolbarHeight:` 旁）避免两条叠层冲突——同时最多一条可见
- 复用: `ZXAIAgentManager requestAgentDataRangeWithAgentId:` / `requestSaveDataRangeWithAgentId:...dataRangeScopeList:`
- 复用: `ZXPersonalAiPickerController` + `ZXPersonalAiPickerContext`

**Interfaces:**
- Consumes: `zx_hasPersonalAgentMention`；个人 `agentId`（从 at 模型或 `ZXOwnPersonalAgentRel`）
- Produces: `personalAiFilterBar`；`personalAiMemoryAgentId`；scopes / ranges / time / net / deepThink 缓存

- [ ] **Step 1: 显示/隐藏**

`zx_hasPersonalAgentMention == YES` → 显示个人条并 get；`NO` → hide + reset。与群条互斥显示。

- [ ] **Step 2: get**

```objc
[ZXAIAgentManager requestAgentDataRangeWithAgentId:agentId handler:^(ZXAIAgentSessionMemoryModel *memory, ZXError *error) {
    if (error) { NSLog(@"[个人AI] getAgentDataRange 失败: %@", error.errorMsg); return; }
    // 更新条；deepThink 只存不展示
}];
```

入参须带 `accountId`（现有 `requestAgentDataRangeWithAgentId` 已从登录态取则确认不变）。

- [ ] **Step 3: save（类型/时间/联网变更）**

全量：`dataRangeList` + `timeType` + `netSearch` + `deepThink` + `dataRangeScopeList`（nil→`@[]`）。失败只 NSLog。

- [ ] **Step 4: DataScope**

```objc
ZXPersonalAiPickerContext *ctx = [[ZXPersonalAiPickerContext alloc] init];
ctx.mode = ZXPersonalAiPickerModeSelectDataRange;
ctx.agentId = agentId;
ctx.dataRangeFinishHandler = ^(NSDictionary *payload) {
    // ACK 后再次 get 刷条
};
// present nav OverFullScreen（对齐 ZXJSAIChatAPI）
```

- [ ] **Step 5: 取消/发送/切会话**

对齐 Plan Defaults：立即 hide；切会话 `zx_resetPersonalAiFilterSessionState`。

- [ ] **Step 6: 编译 + 手测**

`@` 个人 AI → 出条 → 改类型会 save → 点数据+N 出 Picker。

- [ ] **Step 7: Commit**

```bash
git -C apps/ios commit -am "feat(个人AI): 挂载筛选条并接 get/save/Picker"
```

---

### Task 6: (ios) `aiRobtChat` 补 `agentId` + 个人 scopes

**Files:**
- Modify: `ZXAIAgentManager.h/.m` · `requestAiRobtChatWithGroupId:...`
- Modify: `ZXRCIMBaseChatController+SendMessage.m`（~95–180）

**Interfaces:**
- Produces: 方法签名增加

```objc
+ (void)requestAiRobtChatWithGroupId:(NSString *)groupId
                             content:(NSString *)content
                              msgUID:(NSString *)msgUID
                            aiRoleId:(NSString *)aiRoleId
                             agentId:(NSString *)agentId
                           referUuid:(nullable NSString *)referUuid
                             objName:(nullable NSString *)objName
                       dataRangeList:(nullable NSArray<ZXAIAgentRangeModel *> *)dataRangeList
                            timeType:(NSInteger)timeType
                           netSearch:(NSInteger)netSearch
                           deepThink:(NSInteger)deepThink
                  dataRangeScopeList:(nullable NSArray<NSDictionary *> *)dataRangeScopeList
                             handler:(void (^)(ZXError *_Nullable error))handler;
```

- 群：`agentId` = `self.agentMemoryAgentId`（get 顶层）；scopes 传 `nil`
- 个人：`agentId` = at/`groupAgentRels`；scopes = 条缓存（nil→不传或 `@[]`，与契约「个人必带」一致则传数组）
- `aiRoleId`：两边继续现网逻辑（通常 `@"1"`）

- [ ] **Step 1: Manager 组参写入 `agentId` / 条件写入 scopes**

```objc
[params setValue:agentId forKey:@"agentId"];
if (dataRangeScopeList) {
    [params setValue:dataRangeScopeList forKey:@"dataRangeScopeList"];
}
```

- [ ] **Step 2: SendMessage 分支**

按 `zx_hasPersonalAgentMention` vs 群取不同 filter 状态；`atAgent` 触发条件用 `zx_hasAnyAgentMention`。

- [ ] **Step 3: 全部调用点改签名**

`rg requestAiRobtChatWithGroupId` 更新。

- [ ] **Step 4: 编译 + 抓包/日志确认字段**

- [ ] **Step 5: Commit**

```bash
git -C apps/ios commit -am "feat(个人AI): aiRobtChat 补 agentId 与 dataRangeScopeList"
```

---

### Task 7: (ios) 群条胶囊「类型+N」

**Files:**
- Modify: `ZXAIAgentFilterBar.m` ~724

```objc
// was: 数据+%ld
self.dataRangeLabel.text = [NSString stringWithFormat:@"类型+%ld", (long)enabledCount];
```

- [ ] **Step 1: 改文案**（仅知识类型胶囊；若另有 DataScope 勿改）
- [ ] **Step 2: 编译**
- [ ] **Step 3: Commit**

```bash
git -C apps/ios commit -am "fix(群智能体): 知识类型胶囊改为类型+N"
```

---

### Task 8: (ios) 消息发送人回显（个人 AI）

> **增量**：身份 tag / `content.user` 优先 / 回复菜单分流见 **`plan-msg-personal-ai-tag.md`**（对齐 PC 2026-07-28）。本 Task 的 map 匹配作兜底。

**Files:**
- 检索 `agentAccountId` / `getSenderNickName` / 群智能体头像名回显处（如 `ZXIMCellLogic`）
- 用 `groupAgentRels` 按 `agentAccountId` 匹配 `agentName` / `agentAvatar`
- 另按 `plan-msg-personal-ai-tag.md` 改 tag / 菜单

- [ ] **Step 1: 回显补个人 rel 查找**（无匹配再走群 agent 表）
- [ ] **Step 2: 按 plan-msg 完成 tag + content.user + 菜单分流**（若 Task 1–8 已合过 map 回显，只补本步）
- [ ] **Step 3: 手测**（M1–M4，见 status）
- [ ] **Step 4: Commit**

```bash
git -C apps/ios commit -am "feat(个人AI): 消息个人AI框标签头像与回复菜单"
```

---

### Task 9: (ios) E2E 与文档收尾

**Files:**
- Update: `context/features/20260728-ios端at个人AI框/status.md`
- Update: `impl-notes.md`（平台无关逻辑；联调坑）

**验收清单：**

- [ ] 群聊 `@` 列表出现自己的个人 AI；他人个人 AI 不出
- [ ] `@` 个人 → 独立筛选条；DataScope 条件与 Picker 正常；改筛选会 save
- [ ] 发送后 AI 回复群内可见；请求含 `agentId` + `dataRangeScopeList`
- [ ] 回复消息后再 `@` 个人 AI，`referUuid` 有值
- [ ] 群智能体主流程回归：`@` → 改筛选 → 发送 → 回复；胶囊为「类型+N」
- [ ] 互斥：不能同时 `@` 群+个人；已有后再 `@` 不出智能体
- [ ] 取消/清空/发送成功立即藏条
- [ ] `xcodebuild` zhixinAppTest 通过

- [ ] **更新 status 矩阵**（页面开发 / 联调 / 自测）
- [ ] **wrapup 提交 context**

```bash
git add context/ && git commit -m "docs(ios端at个人AI框): 同步实现进展"
```

---

## Spec coverage（自检）

| Spec 要求 | Task |
|-----------|------|
| 只群聊 / 互斥 / 工具栏只插群 | 2, 3 |
| `agentKind` + 不靠 `ga_` | 1, 3 |
| `groupAgentRels` → agentId | 1, 2, 5, 6 |
| 独立筛选条 | 4, 5 |
| DataScope + Picker | 4, 5 |
| get/save 全量 / 错误只日志 | 5 |
| aiRobtChat agentId + scopes | 6 |
| 类型+N 群侧同步 | 7 |
| 回复+referUuid | 6（沿用现网 reply） |
| 回显 | 8 |
| 取消藏条 / 草稿可见性 | 5, 9 |
| E2E / 文档 | 9 |

## 执行方式

Plan 已保存至 `context/features/20260728-ios端at个人AI框/plan.md`。

**1. Subagent-Driven（推荐）** — 每 Task 新开子代理，任务间复核  
**2. Inline Execution** — 本会话按 Task 连续执行  

选哪种？

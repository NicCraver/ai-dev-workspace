# iOS Personal AI 选择壳 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 iOS 新建脱离转发的 Personal AI 选择壳，用同一套 UI 承载「选择 AI 框」（单选点选即回）与「选择数据范围」（多选 + 首页落库 ACK）。

**Architecture:** 新目录 `ZX_PersonalAi/Picker/` 持有 Context / Root / Home / Contact / OrgDrill / Group / Search / SearchBar / BottomBar；桥 `ZXJSAIChatAPI` 两入口 present 新壳不同 mode；已选状态集中在 Root；数据层复用融云会话 / 通讯录 DB / `ZXAIAgentManager`，UI 不引用 `ZXForwardOption` / 转发 `BookBottomView`。

**Tech Stack:** apps/ios — Objective-C + UIKit + Masonry；融云 `RCIMClient`；既有 `ZXAIAgentManager` / `ZXContactModel` / `ZXSelectAiAgentResult`；无单测框架 → 验收靠 `xcodebuild` + 模拟器/真机 E2E。

**Design doc:** [`design-ios-picker-rebuild.md`](./design-ios-picker-rebuild.md)

## Global Constraints

- **仅改 iOS**：`apps/ios/`；不改转发页、不改 Android/web/desktop（桥契约字段不变）。
- **禁止新壳依赖**：`ZXForwardOption`、转发语义 `isForWard`、转发用途 `BookBottomView`。
- **Mode**：`ZXPersonalAiPickerModeSelectAiAgent` = 单选点选即回、无底栏；`ZXPersonalAiPickerModeSelectDataRange` = 多选、底栏、仅 Home 确定落库。
- **回传**：AI 框用 `ZXSelectAiAgentResult.messagePayload`；数据范围用 `ZXSelectAiAgentResult.dataRangeAckPayload`（成功后）。
- **UI 准绳**：搜索框/搜索页/底栏对齐现数据范围首页（`ZXSearchHeaderView` 视觉 + `ZXSelectDataRangeBottomView`）。
- **工程**：新文件必须加入 Xcode target（`zhixinApp` / Test / Prod 相关 SmartMessage 源）；提交只 push `personal-ai-chat`。
- **验证**：每任务结束至少 `xcodebuild ... zhixinAppTest ... build` 通过；关键路径补真机 E2E。
- **注释**：中文。

## File Structure

**新建** `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/Picker/`：

| 文件 | 职责 |
|------|------|
| `ZXPersonalAiPickerContext.h/.m` | mode、agentId、initialScopes、finish/cancel 回调 |
| `ZXPersonalAiPickerItem.h/.m` | 统一已选项（人/群：id、name、avatar、type） |
| `ZXPersonalAiPickerRoot.h/.m` | 导航根 VC：持有 selectedItems、对外 finish/cancel、提供给子页的 API |
| `ZXPersonalAiPickerHome.h/.m` | 首页：搜索入口行、联系人/群组入口、最近聊天 |
| `ZXPersonalAiPickerContactPage.h/.m` | 组织/外联 Tab + 企业列表 |
| `ZXPersonalAiPickerOrgDrill.h/.m` | 部门钻取 + 人员（新 UI） |
| `ZXPersonalAiPickerGroupPage.h/.m` | 组织群/外联群 |
| `ZXPersonalAiPickerSearch.h/.m` | 搜索页 |
| `ZXPersonalAiPickerSearchBar.h/.m` | 统一搜索框（点按进搜索页，本身不编辑） |
| `ZXPersonalAiPickerBottomBar.h/.m` | 从 `ZXSelectDataRangeBottomView` 迁入/复制并改名 |
| `ZXPersonalAiPickerRowCell.h/.m` | 列表行（头像+名+多选勾） |

**修改：**

- `SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/ZXJSAIChatAPI.m` — 两桥改 present 新壳
- `context/features/20260707-选择AI框/status.md` — 矩阵/待办跟进
- `context/features/20260707-选择AI框/impl-notes.md` — 联调坑（有则补）

**保留（验通前不删）：** `SelectAiAgent/ZXSelectAiAgentController.*` 等旧实现。

**复用（只调 API，不嵌旧页）：**

- `ZXSelectAiAgentResult` — payload / scopeParams / ACK
- `ZXAIAgentManager` — `requestAgentDataRangeWithAgentId` / `requestSaveDataRangeWithAgentId:...`
- `ZXContactModel` + `RCIMClient getConversationList`
- 通讯录/群：从 `ZXGroupFramworkSubController` / `LYGCompanyViewController` / `ZXGroupListController` **抄取数逻辑**，新 VC 自绘

---

### Task 1: Context + Item + BottomBar 骨架

**Files:**
- Create: `.../Picker/ZXPersonalAiPickerContext.h/.m`
- Create: `.../Picker/ZXPersonalAiPickerItem.h/.m`
- Create: `.../Picker/ZXPersonalAiPickerBottomBar.h/.m`（从 `SelectAiAgent/ZXSelectDataRangeBottomView.*` 复制改名，delegate 方法前缀改为 `pickerBottomBar...`）
- Modify: Xcode project 将上述文件加入 SmartMessage 编译源

**Interfaces:**
- Produces:
  - `typedef NS_ENUM(NSInteger, ZXPersonalAiPickerMode) { ZXPersonalAiPickerModeSelectAiAgent = 0, ZXPersonalAiPickerModeSelectDataRange = 1 };`
  - `ZXPersonalAiPickerContext`: `mode`, `agentId`, `initialScopes`, `agentFinishHandler`, `dataRangeFinishHandler`, `cancelHandler`
  - `ZXPersonalAiPickerItem`: `scopeDataType`（人=与现 scope 一致）、`scopeDataId`、`name`、`avatar`；`+itemWithContactModel:`；`-isSameAs:`
  - `ZXPersonalAiPickerBottomBar`: 同现底栏 API（`showCancelButton`、`useDoneConfirmTitle`、`-updateSelectedCount:`）

- [ ] **Step 1: 定义 Context / Item 头文件**

```objc
// ZXPersonalAiPickerContext.h
typedef NS_ENUM(NSInteger, ZXPersonalAiPickerMode) {
    ZXPersonalAiPickerModeSelectAiAgent = 0,
    ZXPersonalAiPickerModeSelectDataRange = 1,
};
typedef void(^ZXPersonalAiPickerAgentFinish)(ZXSelectAiAgentResult *result);
typedef void(^ZXPersonalAiPickerDataRangeFinish)(NSDictionary *payload);
typedef void(^ZXPersonalAiPickerCancel)(void);

@interface ZXPersonalAiPickerContext : NSObject
@property (nonatomic, assign) ZXPersonalAiPickerMode mode;
@property (nonatomic, copy, nullable) NSString *agentId;
@property (nonatomic, copy, nullable) NSArray<NSDictionary *> *initialScopes;
@property (nonatomic, copy, nullable) ZXPersonalAiPickerAgentFinish agentFinishHandler;
@property (nonatomic, copy, nullable) ZXPersonalAiPickerDataRangeFinish dataRangeFinishHandler;
@property (nonatomic, copy, nullable) ZXPersonalAiPickerCancel cancelHandler;
@end
```

- [ ] **Step 2: 实现 Item 等价比较（人 accountId / 群 groupId）**

```objc
- (BOOL)isSameAs:(ZXPersonalAiPickerItem *)other {
    if (!other) return NO;
    if (self.scopeDataType != other.scopeDataType) return NO;
    return [self.scopeDataId isEqualToString:other.scopeDataId];
}
```

`scopeDataType` / id 规则与 `ZXSelectAiAgentResult dataRangeScopeParamsWithContacts:` 一致（实现时对照该方法，勿自创枚举值）。

- [ ] **Step 3: 复制 BottomBar**

复制 `ZXSelectDataRangeBottomView.m/.h` → `ZXPersonalAiPickerBottomBar.*`，类名/协议改名；视觉与约束保持不变（内容区高度与首页一致，含顶部 1pt 线若首页已有）。

- [ ] **Step 4: 加入 Xcode 工程并编译**

Run（在 `apps/ios`）:

```bash
xcodebuild -workspace zhixinApp.xcworkspace -scheme zhixinAppTest \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.0' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

Expected: **BUILD SUCCEEDED**

- [ ] **Step 5: Commit（ios）**

```bash
git add SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/Picker/
# 含 pbproj/pbxproj 若有
git commit -m "$(cat <<'EOF'
feat(personal-ai): 新增 Picker Context/Item/BottomBar 骨架

EOF
)"
```

---

### Task 2: Root + 已选状态 API

**Files:**
- Create: `.../Picker/ZXPersonalAiPickerRoot.h/.m`

**Interfaces:**
- Consumes: `ZXPersonalAiPickerContext`、`ZXPersonalAiPickerItem`、`ZXPersonalAiPickerBottomBar`
- Produces（供子页调用）:
  - `- (instancetype)initWithContext:(ZXPersonalAiPickerContext *)context;`
  - `@property (nonatomic, strong, readonly) ZXPersonalAiPickerContext *context;`
  - `@property (nonatomic, strong, readonly) NSMutableArray<ZXPersonalAiPickerItem *> *selectedItems;`
  - `- (BOOL)isItemSelected:(ZXPersonalAiPickerItem *)item;`
  - `- (void)toggleItem:(ZXPersonalAiPickerItem *)item;` — dataRange 勾选；agent 模式内部直接走 finish
  - `- (void)replaceSelectedItems:(NSArray<ZXPersonalAiPickerItem *> *)items;` — 子页「完成」写回
  - `- (void)clearSelectedItems;`
  - `- (void)finishWithAgentContact:(ZXContactModel *)contact;` — 组 `ZXSelectAiAgentResult` → dismiss → handler
  - `- (void)confirmDataRangeSave;` — 仅 Home 确定调用
  - `- (void)cancelPicker;` — dismiss → cancelHandler
  - `- (void)syncBottomBar;` — 更新计数；agent 模式隐藏底栏

- [ ] **Step 1: 实现 Root 为 `ZXMainBaseController` 子类，内嵌 `UINavigationController` 或自身作 nav root**

推荐：桥 present `ZXNavigationController` root=`ZXPersonalAiPickerRoot`，Root 再 `setViewControllers:@[home]`；子页 `self.navigationController push`。

- [ ] **Step 2: 实现 `toggleItem:`**

```objc
- (void)toggleItem:(ZXPersonalAiPickerItem *)item {
    if (self.context.mode == ZXPersonalAiPickerModeSelectAiAgent) {
        ZXContactModel *contact = [item toContactModel]; // Item 提供转换
        [self finishWithAgentContact:contact];
        return;
    }
    // dataRange: 有则删无则加，然后 syncBottomBar + 通知当前顶 VC reload（可用 NSNotification 或 delegate）
}
```

- [ ] **Step 3: 实现 `confirmDataRangeSave`**

对照旧 `ZXSelectAiAgentController finishWithDataRangeContacts:`：

1. `selectedItems.count == 0` → Toast「请选择联系人或群组」return  
2. `agentId` 空 → Toast return  
3. 调 `ZXAIAgentManager requestSaveDataRangeWithAgentId:... dataRangeScopeList:[ZXSelectAiAgentResult dataRangeScopeParamsWithContacts:contacts]`  
4. 成功：`dataRangeAckPayload` → dismiss completion → `dataRangeFinishHandler`  
5. 失败：Toast，不 dismiss  

须先 `requestAgentDataRange` 拿齐 `dataRangeList/timeType/netSearch/deepThink`（与旧 `loadDataRangeMemoryAndPrefill` 一致），存在 Root 的 `memory` 属性。

- [ ] **Step 4: 编译通过**

Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): Picker Root 已选状态与落库/回传 API

EOF
)"
```

---

### Task 3: Home（最近聊天）+ 桥切换

**Files:**
- Create: `.../Picker/ZXPersonalAiPickerHome.h/.m`
- Create: `.../Picker/ZXPersonalAiPickerRowCell.h/.m`
- Create: `.../Picker/ZXPersonalAiPickerSearchBar.h/.m`（本任务先做外观 + 点击回调；进搜索页在 Task 4）
- Modify: `ZXJSAIChatAPI.m`（`selectAiAgent` / `selectDataRangeScope`）
- Modify: Root 启动时 push/set Home

**Interfaces:**
- Consumes: Root API、`RCIMClient getConversationList`、`ZXContactModel modelWithRCConversation:`
- Produces: 可打开的两 mode 首页（联系人/群组入口可先 push 占位 VC 或 Toast「下一期」，但入口行 UI 要在）

- [ ] **Step 1: SearchBar UI**

高度约 `SS(56)`，圆角输入样式对齐现 `ZXSearchHeaderView`；`placeholder`「搜索联系人、智能体」；点击整栏触发 `onTap`（Home 里先空实现或 push 占位）。

- [ ] **Step 2: Home 布局**

```text
[SearchBar]
[选择联系人] 行（箭头）
[选择已有群组] 行
[最近聊天] section header
[列表：RowCell]
[BottomBar — 仅 dataRange]
```

标题：agent=`选择 AI 框`；dataRange=`选择数据范围`。  
左上关闭/返回 → `cancelPicker`。

- [ ] **Step 3: 加载最近聊天**

从旧 `loadConversationListData` 迁过滤逻辑（私聊/群；dataRange 需对齐「可展示会话」过滤，对照旧 Controller 与 android `acceptRecentConversation` 语义——iOS 旧实现有则照搬，无则先私聊+群全量，impl-notes 记债）。

- [ ] **Step 4: 点选行**

```objc
// agent → root finishWithAgentContact
// dataRange → root toggleItem + reload row
```

- [ ] **Step 5: dataRange 预填**

Root `viewDidLoad`：`requestAgentDataRange` → 将 scope 转 Item 填入 `selectedItems` → `apply` 到列表勾选态（对照旧 `applyInitialScopes`）。

- [ ] **Step 6: 切换桥**

`ZXJSAIChatAPI.m`：

```objc
ZXPersonalAiPickerContext *ctx = [ZXPersonalAiPickerContext new];
ctx.mode = ZXPersonalAiPickerModeSelectAiAgent; // 或 DataRange
ctx.agentId = agentId; // 仅 dataRange
ctx.agentFinishHandler = ^(ZXSelectAiAgentResult *r) { ... responseHandler ... };
ctx.cancelHandler = ^{ ... };
ZXPersonalAiPickerRoot *root = [[ZXPersonalAiPickerRoot alloc] initWithContext:ctx];
ZXNavigationController *nav = [[ZXNavigationController alloc] initWithRootViewController:root];
nav.modalPresentationStyle = UIModalPresentationOverFullScreen;
[self.webloader presentViewController:nav animated:YES completion:nil];
```

**保留**旧 Controller 文件，桥不再引用。

- [ ] **Step 7: 编译 + 模拟器手测**

- 打开个人 AI → 选 AI 框：最近列表点一人，应立刻关页且 web 收到 payload  
- 选数据范围：勾选多人，确定后 ACK，取消关页  

- [ ] **Step 8: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): Picker Home 最近聊天并切换桥入口

EOF
)"
```

---

### Task 4: Search 页

**Files:**
- Create: `.../Picker/ZXPersonalAiPickerSearch.h/.m`
- Modify: Home / Contact / Group / OrgDrill 的 SearchBar `onTap` → push Search（后续页在对应 Task 接通）

**Interfaces:**
- Consumes: Root selected API、本地联系人/群搜索（对照现 `ZXSearchController` 在 `selectDataRangeMode` 下的数据源，迁检索调用，不嵌旧 VC）
- Produces: 与首页同款 SearchBar 外观的搜索页；dataRange 底栏 `showCancelButton=NO`、`useDoneConfirmTitle=YES`

- [ ] **Step 1: 搜索页 UI** — 顶栏返回 + 可输入 SearchBar（或沿用首页不可编辑栏 + 本页 UITextField，但视觉一致）+ 结果列表 + 可选底栏  

- [ ] **Step 2: 检索** — 迁现网本地搜索；结果行点选走 Root `toggleItem` / `finishWithAgentContact`  

- [ ] **Step 3: dataRange「完成」** — `replaceSelectedItems` 当前页工作副本 → pop（工作副本在 push 时从 Root 拷贝，点选改副本，完成才写回；返回不写回）  

- [ ] **Step 4: 编译 + E2E** — 两 mode 搜索选人/群  

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): Picker 统一搜索页

EOF
)"
```

---

### Task 5: Contact（组织/外联企业列表）

**Files:**
- Create: `.../Picker/ZXPersonalAiPickerContactPage.h/.m`
- Modify: Home「选择联系人」→ push ContactPage

**Interfaces:**
- Consumes: 旧 `ZXGroupFramworkSubController` 拉企业列表的网络/DB 调用（组织 `isZZ=YES` / 外联 `isZZ=NO`）
- Produces: 双 Tab 企业列表；点企业 → push OrgDrill（Task 6；未完成前可 Toast）

- [ ] **Step 1: 页结构** — 标题「选择联系人」；顶 SearchBar → Search；`组织` | `外联` 切换；列表企业名  

- [ ] **Step 2: 取数** — 从 `ZXGroupFramworkSubController` 的组织/外联加载方法迁出到本页或 `Picker` 内小 Logic 类，**不要**继承旧 VC  

- [ ] **Step 3: dataRange 底栏** — `showCancelButton=NO`、`useDoneConfirmTitle=YES`；完成写回 Root 并 pop 到 Home（或 pop 一层，与产品确认：建议 pop 回 Home 并合并已选）  

  推荐行为：Contact/OrgDrill 共享 Root.selectedItems 实时同步（与旧 returnValueBlock 直播相反也可实时）；「完成」仅 pop。为与设计 D5 一致：**子页完成 = 写回 + pop**；若已实时写 Root，完成 = 只 pop。

- [ ] **Step 4: 编译 + E2E 企业列表展示**  

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): Picker 选择联系人企业列表

EOF
)"
```

---

### Task 6: OrgDrill（部门/人员新 UI）

**Files:**
- Create: `.../Picker/ZXPersonalAiPickerOrgDrill.h/.m`
- Modify: ContactPage 点企业 → `initWithCorp:...`

**Interfaces:**
- Consumes: `LYGCompanyViewController` 内拉部门/人员接口与面包屑数据关系（`rootDeptId`、`corpId`、pid 链）；**不** present 旧 VC
- Produces: 面包屑 + 本层部门/人员列表；人员可按 mode 点选；部门进入下层

- [ ] **Step 1: 入参模型**

```objc
@interface ZXPersonalAiPickerOrgDrill : ZXMainBaseController
- (instancetype)initWithCorpId:(NSString *)corpId
                   rootDeptId:(NSString *)rootDeptId
                     corpName:(NSString *)corpName
                       isWx:(BOOL)isWx
                      context:(ZXPersonalAiPickerContext *)context
                         root:(ZXPersonalAiPickerRoot *)root;
@end
```

- [ ] **Step 2: UI** — 顶 SearchBar；面包屑（可回退）；列表：部门行（箭头）/ 人员行（勾或点选）；dataRange 底栏同 Contact  

- [ ] **Step 3: 迁取数** — 对照 LYG `request` 部门人员接口；同名根部门自动跳过逻辑若旧页有则保留  

- [ ] **Step 4: 选人** — agent 点选即 `finishWithAgentContact`；dataRange `toggleItem`  

- [ ] **Step 5: 编译 + E2E** — 钻两层部门选人；面包屑返回  

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): Picker 组织架构钻取新 UI

EOF
)"
```

---

### Task 7: Group 页

**Files:**
- Create: `.../Picker/ZXPersonalAiPickerGroupPage.h/.m`
- Modify: Home「选择已有群组」→ push GroupPage

**Interfaces:**
- Consumes: `ZXGroupListController` 组织群/外联群取数（`isWx`）
- Produces: Tab「组织群|外联群」+ 群列表；mode 行为同 Contact

- [ ] **Step 1: UI + 取数迁出**（不嵌旧 VC）  

- [ ] **Step 2: 点选 / 多选 + 底栏完成**  

- [ ] **Step 3: 编译 + E2E**  

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): Picker 选择已有群组页

EOF
)"
```

---

### Task 8: 全链路打磨 + 文档 + 旧入口确认

**Files:**
- Modify: `context/features/20260707-选择AI框/status.md`
- Modify: `context/features/20260707-选择AI框/impl-notes.md`（联调坑）
- Modify: `context/features/20260707-选择AI框/design-ios-picker-rebuild.md`（状态 → 实施中/已完成）
- Optional: 删除或注释旧 `ZXSelectAiAgentController` 仅在双桥 E2E 通过后

- [ ] **Step 1: 对照设计成功标准做清单回归**

| 项 | 操作 |
|----|------|
| AI 框最近/搜索/联系人/群 | 点选即回，payload 字段完整 |
| 数据范围多选 | 子页完成不落库；首页确定 ACK |
| 搜索框视觉 | 各页一致 |
| 底栏 | 仅 dataRange；文案 确定/完成 |
| 转发 | 打开普通转发，确认仍旧 UI、仍最多 9 |

- [ ] **Step 2: 更新 status.md 待办** — 记「iOS Picker 新壳 P1–P7 完成 / 待真机」；T8/T9/T10 矩阵按实更新  

- [ ] **Step 3: impl-notes** — 记录迁数来源类名、已知差异（如搜索仍本地 DB）  

- [ ] **Step 4: context commit**

```bash
git add context/features/20260707-选择AI框/
git commit -m "$(cat <<'EOF'
docs(选择AI框): iOS Picker 重做计划落地与状态同步

EOF
)"
```

- [ ] **Step 5: ios commit（若有最后修复）并仅 push `personal-ai-chat`**

---

## Spec coverage（自检）

| 设计项 | Task |
|--------|------|
| D1 双入口重做 | 3（桥）、全链路 |
| D2 共用壳 + mode | 1–2 |
| D3 OrgDrill 新 UI | 6 |
| D4 点选即回 | 2 `toggleItem` / 3–7 |
| D5 仅首页落库 | 2 `confirmDataRangeSave`；4–7 完成只 pop |
| D6 不碰转发 | Global + Task 8 回归 |
| 搜索统一 | 4 |
| 底栏统一 | 1 BottomBar + Root |
| 分期 P1–P5 | Task 1–3≈P1；4≈P2；5–6≈P3；7≈P4；8≈P5 |

## Placeholder scan

无 TBD；取数迁出点已锚定旧类名；编译命令已写明。

## Type consistency

- Mode 枚举名：`ZXPersonalAiPickerModeSelectAiAgent` / `SelectDataRange`
- 回调：`agentFinishHandler` / `dataRangeFinishHandler` / `cancelHandler`
- 底栏：`ZXPersonalAiPickerBottomBar`

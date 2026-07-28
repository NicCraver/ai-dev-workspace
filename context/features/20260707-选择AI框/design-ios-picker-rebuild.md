# Design：iOS Personal AI 选择壳（脱离转发）

> 日期：2026-07-24  
> 状态：实施中（代码已落 `Picker/`，待本地构建/真机）  
> 实施补充（2026-07-24）：列表头像/行样式复用 `ZXForwardCell`；搜索复用 `ZXSearchHeaderView`；页布局统一「导航 header → 搜索 → 列表 → 底栏」；开发过程不跑中间 build。  
> 范围：仅 iOS；Android 不在本期  
> 关联：活跃功能 `20260707-选择AI框`；桥 `selectAiAgent` / `selectDataRangeScope`  
> 计划：[`plan-ios-picker-rebuild.md`](./plan-ios-picker-rebuild.md)

## 1. 背景与目标

当前「选择 AI 框」与「选择数据范围」复用转发链路（`ZXSelectAiAgentController` + `ZXContactCorpController` / `LYGCompanyViewController` / `ZXGroupListController` / `BookBottomView` 等），导致：

- 子页搜索框、搜索页、底栏与数据范围首页不一致；
- `selectDataRangeMode` / `selectAiAgentOnly` / 转发 9 人上限等分支缠绕；
- 改数据范围 UI 易误伤普通转发。

**目标**：两套入口共用一套**新建**选择壳，**不依赖转发**；搜索与（多选）底栏以现「选择数据范围」首页为准。

**非目标**：不改普通转发；不改 Android；不改 web H5 弹窗；不改桥回传契约字段语义。

## 2. 已确认决策

| # | 决策 |
|---|------|
| D1 | 选择 AI 框 + 选择数据范围 **均重做**，脱离转发 |
| D2 | **共用一套选择壳**，用 `mode` 区分单选 / 多选 |
| D3 | 组织架构钻取：**逻辑迁出** `LYGCompany`，**UI 全新**按数据范围首页范式 |
| D4 | 选择 AI 框：**点选即回传**（无底栏确认） |
| D5 | 选择数据范围：子页「完成」只写回 Root；**仅首页「确定」**原生落库 + ACK |
| D6 | 生效范围不含普通转发（新壳独立；旧转发页不动） |

## 3. Mode 行为

```text
mode = selectAiAgent
  → 单选，不展示底栏
  → 任意列表/搜索/钻取点选人/群 → 立刻 finish + dismiss + 回传 agent

mode = selectDataRange
  → 多选，展示底栏（对齐现 ZXSelectDataRangeBottomView）
  → 点选 = 勾选/取消，同步已选集合与底栏计数
  → 子页主按钮「完成」= 写回 Root 已选，pop，不落库、不关整窗
  → 仅 Home「确定」= saveDataRange → ACK → dismiss 整栈
  → 「取消」= 关闭整窗（与现首页一致）；有系统返回的子页可隐藏底栏「取消」
  → 「清空」= 清空已选
  → 「已选」= 展开已选列表（对齐现首页）
  → 无 9 人上限
```

回传契约保持不变：

- AI 框：`personal-ai:selected-agent`（字段与现桥一致；无真实 agentId 时省略）
- 数据范围：落库成功后 `{ type, payload: { ok: true } }` ACK

## 4. 模块结构

建议目录：

```text
SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/Picker/
  ZXPersonalAiPickerContext.h/.m     # mode、agentId、initialScopes、回调
  ZXPersonalAiPickerRoot.h/.m        # UINavigationController 内容根 / 状态持有
  ZXPersonalAiPickerHome.h/.m        # 首页
  ZXPersonalAiContactPage.h/.m       # 组织 | 外联 → 企业列表
  ZXPersonalAiOrgDrill.h/.m          # 公司→部门→人（新 UI）
  ZXPersonalAiGroupPage.h/.m         # 组织群 | 外联群
  ZXPersonalAiSearch.h/.m            # 搜索页
  ZXPersonalAiSearchBar.h/.m         # 搜索框 UI（各页统一）
  ZXPersonalAiBottomBar.h/.m         # 底栏（可由 ZXSelectDataRangeBottomView 迁入改名）
```

桥（`ZXJSAIChatAPI`）：

- `selectAiAgent` → present 新壳 `mode=selectAiAgent`
- `selectDataRangeScope` → present 新壳 `mode=selectDataRange`（agentId / initialScopes 照旧）

旧 `ZXSelectAiAgentController`：桥切走后废弃；真机验通再删文件，避免回滚困难。

**禁止**：新壳引用 `ZXForwardOption`、`BookBottomView`（转发用途）、`isForWard` 转发语义。自有 `ZXPersonalAiPickerContext` 传递配置与回调。

## 5. 页面树

```text
PickerRoot (持有 selected + mode + callbacks)
 ├─ Home
 │    搜索栏 → push Search
 │    选择联系人 → push Contact
 │    选择已有群组 → push Group
 │    最近聊天列表（人/群）
 ├─ Contact（组织 | 外联）
 │    企业列表 → push OrgDrill
 ├─ OrgDrill（面包屑 + 本层部门/人员）
 ├─ Group（组织群 | 外联群）
 └─ Search（人 + 群结果）
```

## 6. UI 对齐规则

1. **搜索框**：所有入口统一 `ZXPersonalAiSearchBar`，视觉对齐现数据范围首页 `ZXSearchHeaderView` 呈现（可复刻样式，不强制复用转发类名）。
2. **搜索页**：统一 `ZXPersonalAiSearch`；dataRange 带底栏且「完成」写回；AI 框点结果即回传。
3. **底栏**：仅 `selectDataRange` 挂载；视觉/交互 = 现首页四按钮；子页可 `showsCancel=NO`、`useDoneConfirmTitle=YES`（「完成」）。
4. **列表/导航**：新页自管 Cell 与导航栏；不出现转发「发送(N)/9」文案。
5. **已选展示名**：人/群名本地库补齐（延续现数据范围行为）。

## 7. 数据层

- 最近聊天 / 通讯录企业 / 部门人员 / 群列表：继续走现有本地 DB / 既有 Manager API（从 LYG / GroupFramework **迁逻辑、不迁 UI**）。
- 不引入 web 侧 `selectGroupBySearch` HTTP 作为 iOS 搜索唯一源（除非后续单独立项）；第一期搜索行为对齐现 iOS 数据范围/选择页可用的本地检索能力。
- `initialScopes` 进页预填；无效 scope 跳过（与现过滤策略一致即可）。

## 8. 分期

| 期 | 内容 | 验收 |
|----|------|------|
| P1 | Context + Root + Home + BottomBar + 桥切换（最近聊天） | 两 mode 可打开；AI 点选回传；数据范围勾选+确定落库 |
| P2 | Search（框 + 页） | 与首页搜索视觉一致；两 mode 行为正确 |
| P3 | Contact + OrgDrill | 组织/外联→企业→部门→人；UI 新、无转发底栏 |
| P4 | Group | 组织群/外联群多选/单选行为正确 |
| P5 | 拆除桥对旧 Controller 依赖；真机 E2E；可选删旧文件 | 转发回归无回归；两桥全绿 |

## 9. 风险与约束

- OrgDrill 从 `LYGCompanyViewController` 迁逻辑工作量大，是关键路径；P3 需单独估时与联调。
- 桥切换瞬间旧页不可达；建议 feature 开关或保留旧类一至两周便于热修。
- 单选点选即回：子页无需「确定」，避免误加底栏。
- 与 web「确定才关闭」不同：iOS AI 框为点选即回，属平台差异，不强制对齐 H5。

## 10. 成功标准

- 数据范围：任意子页搜索框/搜索页/底栏与首页一致；完成链路仅首页确定落库。
- AI 框：点选即回传，字段契约不变。
- 普通转发：行为与 UI 无变化。
- 代码：新壳目录无 `ZXForwardOption` / 转发 `BookBottomView` 依赖。

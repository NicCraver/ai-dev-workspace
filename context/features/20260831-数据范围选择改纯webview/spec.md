# Spec：数据范围选择改纯 webview（先 iOS）

> 由 Superpowers brainstorm 产出。最后更新：2026-08-31

## 背景与目标

「选择数据范围」当前是**四端各写一遍**：

- web PC：`SelectDataRangeDialog.vue`（AcDialog 壳，440×580）
- web 移动（定时任务 persist=false）：`SelectDataRangePopup.vue`（XPopup 壳，与 Dialog 同构）
- iOS：原生 `ZXPersonalAiPickerController`（mode=SelectDataRange）+ `ZXSelectDataRangeBottomView`
- Android：同样是原生实现

同一套选人/选群/组织架构/涉密/全选三态的逻辑维护了多份，改一处要跟四处。

**目标**：把选择数据范围收敛成**一个 web 组件**（`SelectDataRangeDialog.vue`），移动端宿主以纯
webview 加载，原生只负责开页 / 关页 / 收结果后刷新。**本轮先打通 iOS**，安卓与 web 移动端
后续按同一套接。

**成功标准**：iOS 筛选条点「数据范围」→ 全屏 webview 打开 web 组件 → 选完确定 → 记忆已落库 →
关页后筛选条胶囊文案与原生实现一致；取消不改任何状态。

参考实现是同一条筛选条上的**时间「自定义」档**（`20260828-aichat自定义时间范围`）：原生开
webview 加载 web 页、H5 选完主动上报、宿主据此关层。本 spec 沿用那套形态，差别在**这张页要鉴权**
（`/date-range` 是纯前端计算的免鉴权页，数据范围要调接口）。

## 用户流程

1. iOS 个人 AI 聊天页筛选条点「数据范围」胶囊
2. 原生 present **无原生导航栏的全屏 webview**，`needCode:YES`（带 userCode 换登录态），
   URL：`<host>ai-chat/m/data-range?agentId=<id>&accountId=<id>&platform=m`
3. web 页渲染 `SelectDataRangeDialog` 的移动变体（`open` 恒真）：
   - 顶部导航栏：左返回 / 中「选择数据范围」/ 右涉密（气泡文案走 `getSecretButtonTip`）
   - tabs：全部 / 群组（组织群·外联群）/ 组织架构
   - 搜索框常驻，聚焦后结果层盖住主列表，退出搜索回主列表
   - 底栏：已选 N 个 · 清空已选 · 取消 · 确定
4. 页加载时 `getAgentDataRange` 取当前记忆做回显（scopes + 三个全选标记）
5. 点「确定」：web 用第 4 步取到的记忆为底，**合并** `dataRangeScopeList` 与全选标记后
   `saveDataRange`；成功后上报 `{ type: "data-range:confirm", ok: true }`
6. 原生收到即关页，并 `zx_fetchPersonalAiMemoryForce` 重拉记忆刷筛选条
7. 点「取消」或左上返回：上报 `{ type: "data-range:cancel" }`，原生关页，状态不变
8. 保存失败：web 侧提示，**不关页、不上报**，用户可重试或取消

## 范围

- 本期做：
  - (web) 新页 `src/mpa/mobile/pages/data-range.vue`
  - (web) `SelectDataRangeDialog.vue` 加移动变体（壳 / 导航栏 / 搜索）
  - (web) 上报桥：把 `pages/date-range/host-bridge.js` 的通道判定提成参数化共用模块，两页复用
  - (ios) 全屏 webview 容器 + `reportDataRange` handler + 筛选条入口改开 webview
  - (docs) `context/bridge.md` 登记 `reportDataRange`

- 本期不做：
  - 安卓接同一套（协议已按三端设计，安卓照抄即可）
  - web 移动 Home 经 `selectDataRangeScope` 拉原生页的老链路（下一步改成直调组件）
  - 删除 iOS 原生 `ZXPersonalAiPickerController`（`selectDataRangeScope` 桥入口还在用它）
  - 改 `SelectDataRangePopup.vue`（定时任务 persist=false 继续用）
  - 改 PC：`DataScopeBar` 继续内联同一个 Dialog，PC 形态不变

## 关键设计决策

### 1. 页要鉴权，走 `needCode:YES`

`/date-range` 是免鉴权纯前端页；数据范围要调 `getAllImDialogue` / 组织架构 / `getAgentDataRange`
/ `saveDataRange`，必须有登录态。挂 **mobile 入口**（`src/mpa/mobile/pages/`）而非 main 入口：
移动登录态、http 拦截、`wnsdk.extendModule` 都在 `mpa/mobile/App.vue` 做好了，直接可用——
`/date-range` 当初正是栽在「main 入口拿不到 wnsdk 注册」上。

### 2. web 落库，回传只报 `ok`

`saveDataRange` 是**全量记忆写入**（契约 `personalAiFrame/saveDataRange.d.ts`：timeType /
startTime / endTime / netSearch / dataRangeList / dataRangeScopeList 同在一个请求里）。
若只发 scopes，会把时间档与联网搜索冲掉。

做法：web 页自己先 `getAgentDataRange` 拿到完整记忆，只替换 `dataRangeScopeList` 与三个全选标记，
其余字段原样回传。**不**让原生把 timeType/startTime/endTime 拼进 URL——那样每个宿主都要记得带全，
少一个字段就静默丢数据。

### 3. 原生不画导航栏

左返回 / 中标题 / 右涉密全部由 web 画。涉密说明文案来自 `getSecretButtonTip` 接口，已在 web 侧；
原生画 nav 就得把气泡再实现一遍，与「纯 webview」目标相悖。

代价：web 要吃安全区（顶部 `env(safe-area-inset-top)`、底栏 `env(safe-area-inset-bottom)`）。

### 4. 复用 `SelectDataRangeDialog`，不新建组件

四端同一个组件：PC 内联用，移动 webview 用移动变体，未来 web 移动端直调。移动变体只改**壳、
导航栏、搜索形态**三处，tabs / 虚拟列表 / OrgPicker / 已选 popover / 全选三态逻辑一行不动。

## 用户流程分支

| 分支 | 处理 |
|------|------|
| `agentId` 缺失 | 原生不开页（沿用现有 `zx_presentPersonalAiDataScopePicker` 的守卫） |
| 页内 `getAgentDataRange` 失败 | 页面提示重试；确定按钮禁用（无底可合并，直接 save 会丢字段） |
| `saveDataRange` 失败 | 提示，不关页不上报 |
| 上报桥不通（`resolveChannel` 返回 none） | 控制台告警；页面停留（与 `/date-range` 同处理） |
| 非法上报载荷 | 原生按取消收口，不写脏态（同 `selectDateRange`） |

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 组件形态 | 移动变体（webview 内 / 未来直调） | 同 web（后续接） | 加载 web 页 | PC 变体（AcDialog，不变） |
| 承载 | — | 后续：全屏 webview | 全屏无导航栏 webview，`needCode:YES` | 无（内联 Dialog） |
| 上报通路 | `parent.postMessage`（iframe 兜底） | `window.WebView.reportDataRange(JSON)` | `wnsdk.aiChat.reportDataRange`（载荷**平铺**） | — |
| 关页后刷新 | — | 后续 | `zx_fetchPersonalAiMemoryForce` | — |

## 桥协议（新增 `reportDataRange`）

方向与多数桥相反：**web → 原生上报**，与 `selectDateRange` 同形。

```jsonc
{ "type": "data-range:confirm", "ok": true }
{ "type": "data-range:cancel" }
```

| 宿主 | 调用形态 |
|------|---------|
| android | `window.WebView.reportDataRange(JSON.stringify(payload))` |
| ios | `wnsdk.aiChat.reportDataRange({ ...payload, success, error })`——业务字段**平铺**，勿套 `data` |
| PC iframe | `window.parent.postMessage(payload, "*")` |

iOS 原生 ACK：`code=0`，`result="{\"ok\":true}"`；web fire-and-forget 不消费。
原生解析平铺优先，回落 `data` / `success` 嵌套，非法载荷按取消收口。

> ⚠️ 载荷必须平铺：wnsdk `callInner` 把整个参数对象（仅剔除 `success`/`error`/`dataFilter`）
> 当作 `data` 下发原生。套一层 `data` 会让原生收到 `{"data":{...}}`、顶层无 `type`，
> 表现为「页关了但结果没生效」。这个坑在 `selectDateRange` 上踩过两次，见
> `context/features/20260828-aichat自定义时间范围/impl-notes.md`。

## 依赖的接口

| 接口 | 契约 | 用途 |
|------|------|------|
| `POST /agentSetDataRangeExpand/getAgentDataRange` | `contracts/personalAiFrame/getAgentDataRange.d.ts` | 回显 + 取合并底 |
| `POST /agentSetDataRangeExpand/saveDataRange` | `contracts/personalAiFrame/saveDataRange.d.ts` | 落库 |
| `getAllImDialogue` | 既有 | 候选清单（Dialog 内部已在用） |
| `getSecretButtonTip` | 既有 | 涉密气泡文案 |
| 组织架构取数 | 既有 `orgPickerContactApi.js` | 组织架构 tab |

均为既有接口，本期不改契约。

## 验证

- (web) `pnpm exec vue-tsc --noEmit` 通过；上报桥共用模块的 node 单测（沿用 `host-bridge.test.mjs`
  的用例，参数化 handler 名后覆盖两个方法）
- (ios) 人工 Xcode 构建 + 真机自测：开页 / 回显 / 搜索 / 组织架构 / 确定落库 / 返回取消 /
  关页后筛选条刷新；**且时间档与联网搜索不被冲掉**（这是决策 2 的验收点）

## 待用户确认的问题

- 桥方法名 `reportDataRange` 是否定稿（与既有 web→原生取数的 `selectDataRangeScope` 区分开）
- 移动变体的判定方式：新增 `mobile` prop 显式传，还是组件内 `isMobileEnv()` 自判（倾向前者，
  webview 内 UA 判定可靠但显式传更好测）

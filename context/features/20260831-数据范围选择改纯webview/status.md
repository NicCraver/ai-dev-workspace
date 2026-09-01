# Status：数据范围选择改纯 webview

> 最后更新：2026-09-01（契约补周工作字段）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

分支：web `feat/data-scope-storage-group`（领先 origin 1，工作区干净）｜ ios `feat/ios-agent-date-range`（领先 origin 4，脏 6 个文件，属另一功能的时间弹层改动）

> **2026-09-01 晚**：web 已部署测试环境，PC / 移动两端在浏览器实测通过（见下「验证记录」）。
> iOS 承载方式改定：**整页 push（右滑入）**，不再用底部弹层容器。

> **2026-09-01**：web 侧未 push 的 3 条本地提交 + `OrgPicker` 行高改动已 squash 成一条 `42f376e`（`feat(选择数据范围): /m/data-range 改用全屏 popup，host-bridge 收敛，行高对齐 48px`），工作区已干净。iOS 仍在 `feat/ios-agent-date-range`，但分支上多了一条与本功能无关的配色 commit `7af667bf4`（三端 markdown 配色，ff-only 合进来的）。本功能提 MR 时留意别把它一并带走。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 上报桥提共用模块（`hostReportBridge`）+ 单测 | ✅ | — | — | — |
| `AcDialog` 加 `hideClose` | ✅ | — | — | — |
| `SelectDataRangeDialog` 移动变体（全屏壳 / 导航栏 / 常驻搜索） | ✅ | — | — | — |
| 合并保存入参纯函数 + 单测 | ✅ | — | — | — |
| 新页 `/m/data-range` + 注册 `reportDataRange` | ✅ | — | — | — |
| 移动 Home 个人 AI 框直调组件（不再走原生） | ✅ 浏览器实测通过 | — | — | — |
| 移动 popup 全屏 + 去顶圆角 + 涉密入口 | ✅ | — | — | — |
| 整页 webview（模态右滑入）+ `reportDataRange` handler | — | — | 🚧 代码已写，待 Xcode 编译 | — |
| 原生会话筛选条入口切到 webview | — | ⬜ 本轮不做 | 🚧 代码已写，待真机 | — |
| `bridge.md` 登记 + impl-notes | ✅ | — | — | — |
| 真机 / 浏览器自测 | ✅ PC + 移动都过 | — | ⬜ 待人工真机 | — |
| 契约：dataRangeType=5 周工作 + weekWork* / showRangeTxt | ✅ context | — | — | — |

desktop 不涉及：PC 的 `DataScopeBar` 继续内联同一个 `SelectDataRangeDialog`，形态不变。

### 本回合各端现状（code-status）

本回合只改 context 契约与本 status，未动 apps 代码。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| context | main | ahead 103 | 契约 + 本 status | **本功能** | 周工作字段 |
| web | feat/data-scope-storage-group | ahead 1 | SelectDataRangePopup.vue | 本功能 | 非本次契约改动 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 验证记录（2026-09-01 浏览器实测）

`localhost:6173`，账号李权泓（corpId=6）。PC `zx/personal` 与移动 `m/personal`（390×844）各跑一遍：

| 步骤 | PC | 移动 |
|------|----|------|
| 点胶囊 → `getAgentDataRange` | ✅ 1 次 | ✅ 1 次 |
| 弹层内 `getAllImDialogue` | ✅ 1 次 | ✅ 1 次 |
| `getSecretButtonTip` | ✅ | ✅（本轮补的涉密入口） |
| 点确定 → `saveDataRange` | ✅ 1 次，`M0000` | ✅ 1 次，`M0000` |

两端 save 入参完全一致，关键字段未被冲：`timeType:7` / `startTime:null` / `endTime:null` /
`netSearch:1` / `deepThink:0` / `dataRangeList` 4 条 / `dataRangeScopeList` 66 条 /
三个全选标记 `1,1,1`。

> 底栏显示「已选 65 个」而 save 传 66 条：差的 1 条是收纳组（`scopeDataType=4`），
> 胶囊与已选计数按本分支规则排除它，save 照传。**不是 bug**。

## 本回合（契约）

只动 `context/contracts/personalAiFrame/`：`dataRangeType` 增加 **5-周工作**；get/save 知识范围、会话记忆、Agent 设置 `aiParaInfo`、定时任务四接口补 `weekWorkScopeList` 与 8 个 `weekWorkSelectAll*`；get 与定时任务 save 另有 `showRangeTxt`。共用类型在 `_shared.d.ts` 的 `PersonalAiFrameWeekWorkFields`。

`saveDataRange` 仍是全量写入：合并记忆时必须透传 `weekWork*`，省略会把后端已存的周工作选择冲掉。各端调用代码本回合未改。

## 待办 / 阻塞

- (全端) `saveDataRange` 全量合并须透传 `weekWorkScopeList` 与 8 个 `weekWorkSelectAll*`，省略会冲掉后端周工作记忆
- (web) `OrgPicker` 部门/人员层行高已从 60px 改为 48px（与公司层、`row-height` 对齐）。人员行仍是 40px 头像 + 双行文案，需打开弹层目视是否挤
- (web) **动画可能重叠**：`/m/data-range` 里 `SelectDataRangePopup` 带 XPopup 的底部滑入，
  而 iOS 已改成整页右滑入 push，进场会有双重感。真机看着别扭就去掉页内那层 XPopup
- (ios) **需人工 Xcode clean build**（`zhixinApp.xcworkspace` / `zhixinAppTest` + iPhone 15 iOS 17），AI 不代跑
- (ios) **需人工真机 8 项**，尤其第 6 项：改数据范围后确认时间档与联网搜索没被冲掉
- (android) 本轮不做：协议已按三端设计（`window.WebView.reportDataRange`），后续照抄 iOS
- (ios) 原生 `ZXPersonalAiPickerController` 暂不下线——`selectDataRangeScope` 桥入口还在用它
- (web) 移动变体的搜索层与键盘顶起、安全区表现只能真机验；浏览器里搜「李权泓」结果层会盖住列表，但自动化 fill 未触发 focus 时 candidates 为空、会先出空态

## 关键决策记录

- 2026-08-31 四端复用 `SelectDataRangeDialog`，不新建组件；移动端只改壳 / 导航栏 / 搜索三处
- 2026-08-31 web 落库、回传只报 `{ok:true}`：`saveDataRange` 是全量记忆写入，
  由 web 先 `getAgentDataRange` 取底再合并，避免冲掉 timeType / startTime / endTime / netSearch
- 2026-08-31 页挂 **mobile 入口**（`/m/data-range`）而非 main：main 入口拿不到
  `mpa/mobile/App.vue` 的 `extendModule` 注册，`/date-range` 已在此栽过
- 2026-08-31 页需登录态 → `needCode:YES` 带 userCode；与免鉴权的 `/date-range` 不同
- 2026-08-31 iOS **全屏**承载、原生不画导航栏：左返回 / 中标题 / 右涉密全由 web 画
  （涉密气泡文案走 `getSecretButtonTip`，原生画就得再实现一遍）
- 2026-08-31 新桥 `reportDataRange`，载荷 `{type:"data-range:confirm",ok:true}` / `cancel`，
  必须**平铺**（同 `selectDateRange` 的坑）
- 2026-08-31 移动搜索用「常驻输入框 + 全屏结果层」，不跳路由、不做搜索子页
- 2026-08-31 **个人 AI 框（web Home）直调组件，不走原生**：移动端 XPopup（`SelectDataRangePopup`），PC 仍 Dialog。原生会话筛选条仍走 `/m/data-range` webview。
- 2026-09-01 `/m/data-range` **改渲染 `SelectDataRangePopup`**，不给 Dialog 补 mobile 变体：
  Popup 本就是全屏形态，页里原先传的 `mobile` prop 与 `@cancel` 在重构后的 Dialog 上根本不存在
  （移动变体那条提交没跟着 cherry-pick 过来），会渲染成 PC 的 440×580 且取消上报不出去。
- 2026-09-01 移动 popup 定为**全屏无圆角**：内容 `h-screen`，并给 XPopup 传 `bg-transparent`
  ——圆角有两层，壳自己也带 `bg-white rounded-t-xl`，只改内容会留一圈白角。
- 2026-09-01 移动 popup **补涉密入口**，文案与 PC 同源 `getSecretButtonTip`，失败回退静态文案。
- 2026-09-01 顶部「知识、聊天 / 周工作」tab **暂时撤回**标题形态（PC + 移动都撤），
  周工作另开分支做。撤掉的实现在 `4ba8463` / `06ae524` 两条提交里，重做时可直接捡。
- 2026-09-01 **iOS 承载改整页右滑入**，不再用 `ZXJSWebPopoverView` + `HXContainerUtils`
  底部弹层容器：换成 `ZXJSWebLoader`，`style="-1"` 隐藏原生导航栏。
  连带一处必改——userCode 要**自己换好再拼**（`ZXJSWebLoader.loadHTML` 不像 popover 那样自动换）。
- 2026-09-01 **不能用 push，改 `UIModalPresentationOverFullScreen` 模态 + 自定义右滑入转场**
  （`ZXAgentSlideInTransition`，私有类放在 `ZXAIAgentManager.m` 里）。
  真机现象：push 打开、确认关闭后**筛选条整条消失**。根因在
  `ZXRCIMBaseChatController.m:210 viewDidDisappear`——清 `atMessageModels`、
  `zx_hidePersonalAiFilterBar`、`zx_resetAgentFilterSessionState`；push 让聊天页真消失一次，
  pop 回来 `zx_refreshPersonalAiFilterBar` 因 `zx_hasPersonalAgentMention` 已为假直接 hide。
  OverFullScreen 下 presenting 的 view 不被移除，聊天页收不到消失回调，状态原样保留。
  两个连带点：loader 的关页 / 内部跳转依赖 `self.navigationController`，所以要套一层
  `ZXNavigationController` 再 present；`transitioningDelegate` 是 weak，转场对象必须静态强持有。
  关页从 `popViewControllerAnimated` 改成 `dismissViewControllerAnimated`。
- 2026-09-01 **胶囊连点开出两层页**：换 userCode 是异步的，双击会并发跑两遍
  `openDataRangePickerWithAgentId`，present 两层，且后一层把前一层的 confirm/cancel 回调顶掉。
  在 manager 里加 `_zxDataRangeOpening` 标记（present 完成 / 各失败分支 / 关页时复位），
  在场判断用 `_zxDataRangeWebController.presentingViewController` 而非弱引用非空
  ——页面自行关闭后 controller 可能还没 dealloc，用非空判断会误锁住下一次打开。

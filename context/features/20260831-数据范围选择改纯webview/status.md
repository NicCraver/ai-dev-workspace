# Status：数据范围选择改纯 webview

> 最后更新：2026-09-01（iOS 未推送 7 条 + 脏区已 squash 并 push）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

分支：web `feat/data-scope-storage-group`（synced）｜ ios `feat/ios-agent-date-range`（synced，`7a96ed086`）

> **2026-09-01 晚**：web 已部署测试环境，PC / 移动两端在浏览器实测通过（见下「验证记录」）。
> iOS 承载方式改定：**OverFullScreen 模态 + 自定义右滑入**（不用 push，避免聊天页 `viewDidDisappear` 清筛选条）。

> **2026-09-01**：iOS 本地 7 条（数据范围 + 配色 `7af667bf4`）与 6 个未提交时间回填文件已 squash 成 `7a96ed086` 并 push。提 MR 时配色会跟着这条走，拆不出来了。

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
| 「数据+N」排除收纳组（`scopeDataType=4`） | ✅ 早已如此 | — | ✅ 本轮补 | — |
| `bridge.md` 登记 + impl-notes | ✅ | — | — | — |
| 真机 / 浏览器自测 | ✅ PC + 移动都过 | — | ⬜ 待人工真机 | — |
| 契约：dataRangeType=5 周工作 + weekWork* / showRangeTxt | ✅ context | — | — | — |

desktop 不涉及：PC 的 `DataScopeBar` 继续内联同一个 `SelectDataRangeDialog`，形态不变。

### 本回合各端现状（code-status）

本回合只 squash/push iOS，未改其它端代码。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| ios | feat/ios-agent-date-range | synced | 干净 | **本功能** + 时间回填 + 配色 | HEAD `7a96ed086` 已 push |
| web | feat/data-scope-storage-group | synced | 干净 | 本功能 | — |
| android | master-3.6.23 | ahead 3 | 脏(5) | 其它 | 本回合未改 |

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
- (web) **测试环境是旧包**：真机截图里 `/m/data-range` 出的还是 PC `el-dialog`（440 宽、居中、
  带已撤掉的「知识、聊天 / 周工作」tab）。当前分支源码早已是全屏 `SelectDataRangePopup`
  且 关闭 / 取消 都走 `emit("close")` → 页面上报 cancel。**须重新构建部署再验**，别照旧包提 bug
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
- 2026-09-01 移动 popup 搜索**落成整屏搜索层**（原先直接挂 `AiBoxSearchBox`，
  那是 PC 的 320px `Teleport` 下拉，手机上盖不住也难点）：入口换成一个假搜索框按钮，
  点开 `absolute inset-0 z-20` 一层，顶部 `SearchInput`（`nextTick` 后 focus 拉键盘）+ 取消，
  下面 `AiBoxSearchPanel` 占满，形态照抄 `SelectAiBoxPopupSearch`。
  勾选直接写同一个 `selectedKeySet`，「取消」只关层清关键字、不撤选。
- 2026-09-01 **双重进场动画落地解法**：`XPopup` 加 `instant` prop，为真时把 `<Transition>`
  的 name 换成没有对应 CSS 的 `x-instant`（不是删 Transition——`after-leave` 还得触发，
  否则 `close` 事件发不出）。`/m/data-range` 传 `instant`，页内即时显示，进场只剩原生那一次。
- 2026-09-01 **确定改为「落库 → 提示 → 再上报关页」**：原生收到 `data-range:confirm`
  立刻去重拉记忆，上报早于落库就会读到旧值。页里加 `saving` 防连点 +
  `showLoadingToast(forbidClick)` 挡住保存期间的点击，`saveAgentDataRange` resolve 后
  弹「已保存」，停 600ms 再上报。失败则关 toast、提示重试、不上报不关页。
- 2026-09-01 **iOS 胶囊「数据+N」跳过 `scopeDataType=4`**（`ZXPersonalAiFilterBar`
  加 `zx_countableScopeCount:`）：收纳组只是容器，成员在 `dataRangeScopeList` 里各占一条，
  算上它比实际多。口径与 web 底栏「已选 N 个」对齐；save 仍照传该条。
  `scopeDataType` 服务端时数字时字符串，统一 `integerValue` 比。
  提交时该文件同时带着「自定义时间范围」功能的未提交改动，用
  `git diff` 拆 hunk + `git apply --cached` 只暂存本功能那两块，别把别人的活一起提了。
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

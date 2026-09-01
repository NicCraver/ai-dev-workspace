# Status：数据范围选择改纯 webview

> 最后更新：2026-09-01 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

分支：web `feat/data-scope-storage-group`（领先 origin 1，工作区干净）｜ ios `feat/ios-agent-date-range`（领先 origin 3）

> **2026-09-01**：web 侧未 push 的 3 条本地提交 + `OrgPicker` 行高改动已 squash 成一条 `42f376e`（`feat(选择数据范围): /m/data-range 改用全屏 popup，host-bridge 收敛，行高对齐 48px`），工作区已干净。iOS 仍在 `feat/ios-agent-date-range`，但分支上多了一条与本功能无关的配色 commit `7af667bf4`（三端 markdown 配色，ff-only 合进来的）。本功能提 MR 时留意别把它一并带走。

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 上报桥提共用模块（`hostReportBridge`）+ 单测 | ✅ | — | — | — |
| `AcDialog` 加 `hideClose` | ✅ | — | — | — |
| `SelectDataRangeDialog` 移动变体（全屏壳 / 导航栏 / 常驻搜索） | ✅ | — | — | — |
| 合并保存入参纯函数 + 单测 | ✅ | — | — | — |
| 新页 `/m/data-range` + 注册 `reportDataRange` | ✅ | — | — | — |
| 移动 Home 个人 AI 框直调组件（不再走原生） | 🚧 移动走 XPopup，待浏览器确认 | — | — | — |
| 全屏 webview 容器 + `reportDataRange` handler | — | — | 🚧 代码已写，待 Xcode 编译 | — |
| 原生会话筛选条入口切到 webview | — | ⬜ 本轮不做 | 🚧 代码已写，待真机 | — |
| `bridge.md` 登记 + impl-notes | ✅ | — | — | — |
| 真机 / 浏览器自测 | 🚧 浏览器 UI 已过 | — | ⬜ 待人工真机 8 项 | — |

desktop 不涉及：PC 的 `DataScopeBar` 继续内联同一个 `SelectDataRangeDialog`，形态不变。

## 待办 / 阻塞

- (web) `OrgPicker` 部门/人员层行高已从 60px 改为 48px（与公司层、`row-height` 对齐）。人员行仍是 40px 头像 + 双行文案，需打开弹层目视是否挤
- (web) 移动 Home 已切直调 `SelectDataRangePopup`（XPopup）；PC 仍是 Dialog。不进原生选人页。待浏览器确认胶囊打开底部弹层；确定后时间档/联网不被冲
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

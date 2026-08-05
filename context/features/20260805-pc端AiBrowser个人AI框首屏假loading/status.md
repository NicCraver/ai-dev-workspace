# Status：pc端AiBrowser个人AI框首屏假loading

> 最后更新：2026-08-05（spec + plan 完成，待实施）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞 · — 本期不做

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| spec / plan | ✅ | — | — | ✅ |
| T1 `personal-ai:ready` 类型与判定 + 单测 | — | — | — | ⬜ |
| T2 `AiChatLoading.vue` 遮罩组件 | — | — | — | ⬜ |
| T3 宿主接线（显隐 / 8s 超时 / iframe error） | — | — | — | ⬜ |
| T4 web `onMounted` 回传 ready | ⬜ | — | — | — |
| T5 bridge.md 登记 + impl-notes | ✅ | — | — | ⬜ |
| 自测（首开 / 切回 / 拖拽 / 超时兜底） | — | — | — | ⬜ |

> android / ios 本期不做：两端个人 AI 框走各自 WebView 宿主，白屏问题同样存在，待本期 desktop 验证后由 impl-notes 移植。

## 待办 / 阻塞

- (desktop) ⬜ T1–T3 实施，按 plan.md 逐任务提交
- (web) ⬜ T4：`PersonalAiChat.vue` `onMounted` 加 `notifyHostReady()`，需与 desktop 同期发版才生效（老版本 web 走 8s 超时分支，不会坏）
- (desktop) ⬜ 真机自测 4 条：无纯白帧 / 切回不重复出现 / 遮罩期间可拖拽可点 / 断网 8s 自动撤

## 关键决策记录

- 2026-08-05 loading 放 **PC 宿主层遮罩**（非 web 骨架屏）：只有宿主层能覆盖「拉 web 资源 + JS 解析 + Vue 挂载」全过程
- 2026-08-05 收尾信号 = web 发 `personal-ai:ready` + **8s 超时兜底**；老版本 web 不发也不死锁
- 2026-08-05 ready 时机 = web `onMounted` 即发（不等列表接口），之后由 web 自身列表 loading 接力
- 2026-08-05 覆盖范围仅个人 AI 框（`aiId=0`）；外链 AI tab 走 `webview`、第三方站不发 ready，本期不碰
- 2026-08-05 遮罩底色 `#F7F9FE`（个人 AI 页真实底色，非 web `AcPageLoading` 的 `#F4F6F8`），撤遮罩无色差闪动
- 2026-08-05 遮罩必须带 `[-webkit-app-region:no-drag]`，否则 Electron 下被挡区域变系统拖拽区
- 2026-08-05 **不做 iframe 预热**（启动即后台挂载）：治本但每次启动多打一轮资源+接口，且与 `notifyPersonalAiDeactivate` 失活逻辑纠缠；本方案不阻塞它后续叠加

# Plan：PC 不可见推送延后与记忆刷新

> 规格：`spec.md`｜状态见 `status.md`

**Goal:** PC 个人 AI 不可见时，命中当前会话的推送只延后 Chat 消息；切回时冲刷消息并只更新记忆栏。

---

## Task 1：(web) 扩展推送 plan + 单测 — ✅

- [x] `resolvePushRefreshPlan` + `pageActive` / `deferMessages`
- [x] 单测 9 条通过

## Task 2：(web) Chat/Home/index 暴露 refreshMemoryOnly — ✅

- [x] Chat `refreshMemoryOnly`
- [x] Home / index 透传

## Task 3：(web) PersonalAiChat 编排 — ✅

- [x] `docVisible` / `shellActive` / pending / 激活失活

## Task 4：(desktop) AiBrowser aiBoxDeactivate — ✅

- [x] 切离 / 关面板发 deactivate；切回 / 开面板发 checkVersion

## Task 5：文档 + wrapup — ✅

- [x] 推送规则 / bridge / status / impl-notes

# Plan：aichat 自定义时间范围（iOS 桥接补齐）

> 依据 spec.md 的根因 RC1 / RC2。任务顺序即执行顺序。

## T1（web）host-bridge 改用 wnsdk 实例 + 正确载荷键

- 文件：`apps/web/src/pages/date-range/host-bridge.js`
- `probeHostEnv(g, sdk)` 增加 sdk 形参：iOS 桥判据改为 `sdk.aiChat.selectDateRange` 为函数（不再读 `window.wnsdk`）
- `callIos` 改为 `{ data: payload, success, error }`；`success`/`error` 只做日志，不承载数据
- 保留优先级：android > ios > parent > none
- 先写失败测试（`host-bridge.test.mjs`，node:test），再改实现

## T2（web）/date-range 页注册 wnsdk namespace

- 文件：`apps/web/src/pages/date-range/index.vue`
- `import wnsdk from "@tjmt/wnsdk"`，`onMounted` 里注册 `selectDateRange`（`os:["MTCoreApi"]`），幂等（已注册则跳过）
- 把 wnsdk 实例传给 `postToHost`

## T3（ios）解析兼容平铺载荷

- 文件：`SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/ZXJSAIChatAPI.m`
- `selectDateRange` handler：`data` 本身带 `type` 时直接当 payload；否则回落既有 `success`/`error` 嵌套解析
- 其余逻辑（`handleDateRangeConfirm` 防重、非法载荷按取消收口）不动

## T4（文档）契约登记

- `context/bridge.md`：方法清单加 `selectDateRange` 行 + 「`selectDateRange` 回传」小节 + Changelog
- `context/features/20260828-aichat自定义时间范围/impl-notes.md`：记 wnsdk 保留键坑与 main 入口无 wnsdk 坑

## T5 验证

- web：`node --test src/pages/date-range/*.test.mjs` 全绿；`pnpm exec vue-tsc --noEmit` 退出 0
- ios：编译验证由本人在 Xcode 真机自测（本轮不代跑构建）
- 收尾：更新 status.md 平台矩阵，分仓提交

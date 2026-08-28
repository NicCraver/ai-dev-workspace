# Status：aichat自定义时间范围

> 最后更新：2026-08-28 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

分支：web `dev-date-range` ｜ ios `feat/ios-agent-date-range` ｜ desktop `feat/ai-chat-date-range`

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 记忆条自定义档 + /date-range 页 | ✅ | ✅ | ✅ | ✅ |
| 宿主回传桥接 | ✅ 修 wnsdk 通路（实例注入 + 载荷放 data） | ✅ window.WebView | ✅ 平铺解析兼容 | ✅ parent.postMessage |
| 单测 | ✅ host-bridge 8 例 | — | — | — |
| 真机自测 | ⬜ | ✅ 同事已过 | 🚧 待本人真机验 | ✅ 同事已过 |

> 本迭代只动桥接层；功能主体（timeType=0 落库、载荷上送）此前已完成。

## 待办 / 阻塞

- (ios) 待真机自测：打开半屏日历 → 取消应关层不写脏态；确认应关层并回填区间到记忆条胶囊。
- (web) 本地 node_modules 缺 prettier，`pnpm format` 未跑（vue-tsc --noEmit 已过，退出 0）。

## 关键决策记录

- 2026-08-28 载荷统一放 wnsdk 的 `data` 键；`success`/`error` 仅作回调，不承载业务数据（wnsdk 内部只下发 `data`）。
- 2026-08-28 `/date-range` 页自注册 `selectDateRange` namespace（main 入口拿不到 mobile 的注册、UMD 不挂 window），桥实例显式注入，不再探测 `window.wnsdk`。
- 2026-08-28 非 iOS 客户端不访问 `wnsdk.aiChat`（os 不匹配会弹 showError），已加守卫测试。
- 2026-08-28 iOS 解析平铺优先、保留 `success`/`error` 嵌套兼容分支。

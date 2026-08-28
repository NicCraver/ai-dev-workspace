# Spec：aichat 自定义时间范围（iOS 桥接补齐）

> 创建：2026-08-28 ｜ 类型：缺陷修复 + 桥接契约补登记

## 背景

记忆条时间档新增「自定义」（`timeType=0`），点击后拉起 web 的 `/date-range` 免鉴权独立页选区间：

- **web / PC**：同事已完成（web `dev-date-range`、PC `feat/ai-chat-date-range`）
- **android**：同事已完成，走 `window.WebView.selectDateRange`（原生注入的 JS interface）
- **ios**：本人已实现（`feat/ios-agent-date-range`，提交 `80cfabb20`），半屏 webview 能拉起，但**关不掉、数据也回不来**

## 缺陷现象

iOS 上打开日期弹窗后，点「取消 / 确认」无任何反应：半屏层不关闭，原生侧收不到区间。

## 根因（已静态定位，双重叠加）

### RC1：`/date-range` 页在 iOS 下根本没有 wnsdk 桥

`apps/web/src/pages/date-range/host-bridge.js` 以 `window.wnsdk.aiChat.selectDateRange` 为存在性判据，但三条同时不成立：

1. `/date-range` 属 **main 入口**（`src/pages/`），main 入口从不 import wnsdk；`wnsdk.extendModule("aiChat", …)` 只在 `src/mpa/mobile/App.vue` 执行，作用不到该页。
2. `@tjmt/wnsdk` 是 UMD 包，被 Vite 按 CommonJS 分支打包，**不会挂 `window.wnsdk`**。
3. 全仓从未注册过 `selectDateRange` 这个 namespace（mobile 注册表只有 actionCardTransmit / mediaMessageTransmit / showAgentDetail / selectAiAgent / selectDataRangeScope / presentKnowledgeAuth）。

→ `resolveChannel` 永远进不了 `"ios"` 分支；顶层 webview 无 parent → 返回 `"none"` → `postToHost` 仅 `console.warn` 后返回，**确认/取消是空操作**。

安卓不受影响：`window.WebView` 由原生直接注入 window，不经 wnsdk 注册。

### RC2：载荷放在 wnsdk 的保留回调键上

`host-bridge.js` 用 `aiChat.selectDateRange({ success: payload })` 把业务数据塞进 `success`。但 wnsdk 内部：

```js
var o = a.success, n = a.error, ..., d = a.data;
// 随后 e.callHandler(proto, handlerName, d, cb)
```

`success` / `error` 被当作**回调函数**取走，真正下发原生的是 `data`。照现写法原生只会收到空 data，`ZXJSAIChatAPI.m` 解析后一律落到 `cancelled = YES`。

同仓可用范例：`src/components/views/personal-ai/selector/personalAiDataRangeScopeMessage.js`（`selectDataRangeScope`）——业务参数平铺，`success`/`error` 传函数。

### Layer B 排除

iOS 原生侧无问题：`ZXJSWKWebViewBridge.m` 对所有 webview（含半屏 `ZXJSWebPopoverView`）注册 `aiChat` 模块，`selectDateRange` handler 已注册（`ZXJSAIChatAPI.m`）。

## 方案

| # | 端 | 改动 |
|---|-----|------|
| 1 | web | `/date-range` 页自行 `extendModule("aiChat", [{namespace:"selectDateRange", os:["MTCoreApi"]}])`；host-bridge 改用传入的 wnsdk 实例探测，不再依赖 `window.wnsdk` |
| 2 | web | 载荷改 `{ data: {type,startTime,endTime}, success, error }`，与 `selectDataRangeScope` 用法一致 |
| 3 | ios | `ZXJSAIChatAPI.m` 解析加**平铺**分支（`data` 直接是 payload），保留既有 `{success/error:{…}}` 嵌套分支做兼容 |
| 4 | 文档 | `context/bridge.md` 登记 `selectDateRange` 方法与回传契约 + Changelog |

## 协议（定稿）

```jsonc
// web → 原生（ios）：wnsdk.aiChat.selectDateRange
{
  "data": { "type": "date-range:confirm", "startTime": 1756310400000, "endTime": 1756396799999 },
  "success": fn, "error": fn   // wnsdk 保留回调键，勿承载业务数据
}
// 取消：data = { "type": "date-range:cancel" }
// 原生 ACK：code=0，result = "{\"ok\":true}"（web fire-and-forget，不消费）
```

安卓保持不变：`window.WebView.selectDateRange(JSON.stringify(payload))`，payload 即上面 `data` 的内容。

## 非目标

- 不动 PC iframe（`parent.postMessage`）通路
- 不动 iOS 记忆条 / 载荷上送逻辑（`80cfabb20` 其余部分已自测通过）
- 不重构 `/date-range` 页 UI

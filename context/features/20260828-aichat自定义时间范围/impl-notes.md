# Impl Notes：aichat 自定义时间范围（桥接层）

> 平台无关的逻辑提炼。本功能主体（记忆条 timeType=0、区间落库、载荷上送）已在各端实现，
> 本文只沉淀**桥接层**的坑与定型协议。

## 交互链路

1. 记忆条时间档点「自定义」→ 原生拦截，不走普通 timeType 切换
2. 原生拉起 web 的 `/date-range` 免鉴权独立页（iOS/安卓半屏 webview，PC iframe），
   URL 带 `?platform=m|pc&startTime=<ms>&endTime=<ms>`（有历史区间才带，用于返显）
3. H5 内选完 → **H5 主动上报**结果给宿主（方向与其它桥相反：不是取数，是上报）
4. 宿主收到即关层；confirm 时把毫秒区间写入会话记忆并随后续请求上送

## 定型协议

载荷三端同一份：

```jsonc
{ "type": "date-range:confirm", "startTime": <ms>, "endTime": <ms> }
{ "type": "date-range:cancel" }
```

| 宿主 | 通路 |
|------|------|
| android | `window.WebView.selectDateRange(JSON.stringify(payload))` |
| ios | `wnsdk.aiChat.selectDateRange({ data: payload, success, error })` |
| PC iframe | `window.parent.postMessage(payload, "*")` |

优先级 android > ios > parent > none。完整契约见 `context/bridge.md`「selectDateRange 上报」。

## 联调坑

### 1. wnsdk 的 `success` / `error` 是保留回调键，业务数据只能放 `data`

wnsdk 内部：

```js
var o = a.success, n = a.error, ..., d = a.data;
// → callHandler(proto, handlerName, d, cb)
```

把 payload 塞进 `success` 时，wnsdk 把它当回调函数取走，下发原生的 `data` 为空。
原生侧表现：handler 触发但解析不出 `type`，按「非法载荷 → 取消」收口，
用户看到的是**弹窗关不掉、数据回不来**。

对照可用范例：`selectDataRangeScope`（`personalAiDataRangeScopeMessage.js`）——业务参数平铺，
`success`/`error` 传函数。

### 2. main 入口页拿不到 wnsdk，必须页面内自注册

- `/date-range` 是 main 入口的免鉴权独立页；`extendModule("aiChat", …)` 只在 mobile 入口
  （`mpa/mobile/App.vue`）执行，**作用不到它**
- `@tjmt/wnsdk` 是 UMD 包，被 Vite 按 CommonJS 分支打包，**不挂 `window.wnsdk`**

→ 任何靠 `window.wnsdk` 探测桥存在性的写法在该页恒为 false。做法：页面 `onMounted` 自注册
`{ namespace: "selectDateRange", os: ["MTCoreApi"] }`（一次性上报，无需 `isLongCb`），
并把 import 进来的实例显式传给桥判定函数。

安卓不受此影响：`window.WebView` 由原生直接注入 window，不经 wnsdk。

### 3. 非 iOS 客户端不得触碰 `wnsdk.aiChat`

wnsdk 的模块 getter 在 os 不匹配（PC/h5 访问 `os:["MTCoreApi"]` 的 api）时会走 `showError`
弹错误提示。判定函数必须先按 UA（`/MTCoreApi/i`）确认是 iOS 客户端，再读 `sdk.aiChat`。
已有守卫测试固化此约束。

### 4. 原生解析用平铺优先

wnsdk 下发给原生 handler 的就是 `data` 对应的字典，所以 iOS 侧 `type` 直接在顶层。
解析顺序：顶层有 `type` → 直接用；否则回落 `success`/`error` 嵌套（兼容早期写法）。
非法载荷一律按取消收口，不写脏态。

## 验证

- web：`node --test src/pages/date-range/host-bridge.test.mjs`（8 例：四通路 + 优先级 + 非 iOS 守卫）
- iOS 链路静态确认：半屏 `ZXJSWebPopoverView` → `ZXJSWebLoader`（UA 追加 `MTCoreApiJS/<ver>`，
  `/MTCoreApi/i` 可匹配）→ `ZXJSWKWebViewBridge` 注册 `aiChat` 模块 → `selectDateRange` handler

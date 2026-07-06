# JSBridge 协议（WebView ↔ 原生）

> 三端（Android / iOS / Electron）内嵌 web 的通信契约。任何一端改协议必须先改本文件。
> 最后更新：YYYY-MM-DD

## 通信机制

| 端 | web → 原生 | 原生 → web |
|----|-----------|-----------|
| android | <!-- 如 window.NativeBridge.invoke(json) --> | <!-- 如 evaluateJavascript 回调 --> |
| ios | <!-- 如 webkit.messageHandlers.bridge.postMessage --> | |
| desktop | <!-- 如 ipcRenderer / preload 暴露的 API --> | |

## 消息格式

```jsonc
// 请求
{ "id": "uuid", "method": "方法名", "params": {} }
// 响应
{ "id": "uuid", "code": 0, "data": {}, "msg": "" }
```

## 方法清单

| method | 方向 | params | 返回 | 支持端 | 备注 |
|--------|------|--------|------|--------|------|
| <!-- getToken --> | web→原生 | | | android/ios/desktop | |

## 版本与兼容

<!-- 老版本壳不支持新方法时 web 端的降级策略 -->

## Changelog

- YYYY-MM-DD 初始化

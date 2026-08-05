# Impl Notes：pc端AiBrowser个人AI框首屏假loading

> 平台无关。android / ios 个人 AI WebView 宿主可照此移植首屏遮罩逻辑。

## 状态流转

```
loadingVisible = 首次挂载 WebView/iframe 时为 true；之后恒 false（同会话内不再出现）

开遮罩：宿主首次挂载个人 AI 框 WebView/iframe 时立即显示

关遮罩（三路，幂等，重复调用无副作用）：
  1. 宿主收到 web postMessage { type: "personal-ai:ready" }
  2. 宿主 8s 超时定时器到期（老版本 web 不发 ready 的兜底）
  3. WebView/iframe 加载失败（error 事件）

关遮罩后：web 自身列表 loading / 骨架屏接力，宿主不再干预
```

覆盖范围：**仅个人 AI 框首次挂载**（`aiId=0`）。切到外链 AI tab 再切回、或同会话内二次激活，**不再**开遮罩。

## 接口调用时序

1. 用户打开个人 AI 框 → 宿主挂载 iframe/WebView → **立刻**显示宿主层 loading 遮罩  
2. 并行：iframe 拉取 web 资源 → JS 解析 → Vue 挂载  
3. web `PersonalAiChat` 根组件挂载完成 → 向宿主 postMessage `{ type: "personal-ai:ready" }`（**不等**列表接口）  
4. 宿主收到 ready **或** 8s 超时 **或** iframe error → 撤遮罩（幂等）  
5. web 继续拉会话列表等接口，由 web 侧 loading 态承接

**并发**：ready 与 8s 超时竞态；先到达者生效，后到达者因幂等被忽略。宿主应在收到 ready 时清除超时定时器。

## 边界情况

| 场景 | 预期 |
|------|------|
| 首开个人 AI 框 | 遮罩 → web ready 或超时 → 淡出 → web 列表骨架，全程无纯白帧 |
| 切到外链 AI tab 再切回个人 AI | 遮罩**不再出现**（仅首次挂载触发） |
| 老版本 web（不发 ready） | 8s 后遮罩自动撤，不死锁；体验略慢但可用 |
| 断网 / iframe 加载失败 | error 路径或 8s 超时撤遮罩，不死锁 |
| 遮罩显示期间拖动窗口 / 点 tab | 遮罩区域须 `no-drag`（见联调坑），标题栏与 tab 仍可交互 |
| 移动端 WebView 宿主 | 同样「首次挂载开、ready/超时/error 关」；postMessage 通道名与 desktop 对齐 |

## 错误处理策略

- **ready 未收到**：8s 超时自动撤遮罩，打 debug 日志；用户可见 web 可能仍空白或报错，但不死锁  
- **iframe/WebView load error**：立即撤遮罩，可保留 web 内错误页或空白，由 web 自行处理  
- **重复 ready**：宿主忽略后续 ready，不重复触发淡出动画  
- **撤遮罩失败（极端）**：超时定时器仍会在 8s 兜底

## 联调坑

- **遮罩必须在宿主层**：web 骨架屏只能覆盖 Vue 挂载之后，无法消除「拉资源 + 解析 JS」阶段的纯白帧。  
- **Electron 宿主遮罩必须 `no-drag`**：Electron 默认可拖拽区会覆盖被遮罩挡住的区域，导致窗口无法拖动、tab 无法点击。遮罩容器须标记为非拖拽区。  
- **ready 时机 = 根组件挂载**：不等 list 接口，否则遮罩停留过久；列表 loading 由 web 接力。  
- **底色须对齐个人 AI 页**：`#F7F9FE`（非 web 通用 loading 的 `#F4F6F8`），避免撤遮罩时色差闪动。  
- **老版本 web 兼容**：不发 ready 时走 8s 超时分支，与 desktop 新壳可独立发版。

## 与 bridge 的交互

| 方向 | type | 时机 | 说明 |
|------|------|------|------|
| web → 宿主 | `personal-ai:ready` | PersonalAiChat 根组件挂载完成 | fire-and-forget；宿主撤首屏 loading 遮罩 |
| — | （无宿主→web 消息） | — | 遮罩纯宿主 UI，不依赖 bridge 回传 |

**视觉参数（宿主遮罩，各端一致）**

- 底色：`#F7F9FE`  
- 转圈：直径 32px；底环 `#D7E3FF`，旋转头 `#3E7EFF`  
- 文案：「页面加载中...」  
- 淡出：撤遮罩时宿主层淡出，与 web 列表骨架无缝衔接

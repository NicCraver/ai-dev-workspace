# Spec：pc端AiBrowser个人AI框首屏假loading

> 由 Superpowers brainstorm 产出。最后更新：2026-08-05

## 背景与目标

PC 端 `apps/desktop/src/renderer/views/AiBrowser/index.vue` 里，个人 AI 框（`aiId=0`）是一个 iframe，加载 `${APP_AICHAT}/zx/personal`。现状：`loadedMap[aiId]` 一置 true 就直接挂 iframe，宿主侧没有任何占位，用户在「拉 web 资源 → JS 解析 → Vue 首屏挂载」整段时间里看到纯白。

**目标**：首次打开个人 AI 框时，宿主侧盖一层 loading，直到 web 端挂载完成才淡出，消除纯白等待。

**成功标准**：
- 首次进入个人 AI 框，全程无纯白帧：先转圈，再接 web 自身的列表 loading 骨架
- web 端不可达 / 老版本 web 时，8s 超时自动撤遮罩，行为不比改动前差
- 遮罩期间窗口拖拽与点击不失效

## 用户流程

1. 用户点左侧菜单进入 AI 面板（或应用启动后默认落到个人 AI tab）
2. 宿主挂载个人 AI iframe，**同时**在其上层显示 `AiChatLoading`（转圈 +「页面加载中...」）
3. iframe 内 web 端 `PersonalAiChat.vue` `onMounted` 后向 parent post `personal-ai:ready`
4. 宿主收到并通过 origin 校验 → 遮罩淡出（200ms opacity），露出 web 页面（此时 web 自身的会话列表 loading 骨架接力）
5. 用户切到别的 AI tab 再切回：iframe 不重载，遮罩不再出现

**分支**：
- 8s 内没收到 ready（老版本 web / 网络极慢 / web 报错）→ 超时撤遮罩，露出 iframe 当前状态
- iframe 触发 `error` 事件 → 立即撤遮罩

## 范围

- 本期做：
  - `apps/desktop` 新增 `views/AiBrowser/AiChatLoading.vue`（仿 web `AcPageLoading.vue`）
  - `apps/desktop` `views/AiBrowser/index.vue` 接线：遮罩显隐 + 超时 + iframe error
  - `apps/desktop` `components/aiChat/personalAiMessageBridge.js` 增 `PERSONAL_AI_READY_TYPE` / `isPersonalAiReady`
  - `apps/web` `personal-ai/list/PersonalAiChat.vue` `onMounted` 发 `personal-ai:ready`
- 本期不做：
  - **iframe 预热**（启动即后台挂载个人 AI iframe，让切换瞬开）。治本但会让每次启动多打一轮资源 + 接口，且与现有 `notifyPersonalAiDeactivate` 失活逻辑纠缠。留待后续单独评估，本方案不阻塞它叠加。
  - 外链 AI tab（kimi / deepseek 等，走 `webview` 而非 iframe）的 loading。第三方站点不会发 ready，需另听 `did-stop-loading` / `dom-ready`，本期不碰。
  - web 端骨架屏改造（web 已有 `AcPageLoading` + 列表 `loading` 态，够用）。

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 首屏遮罩 | 不做（仅新增 ready 上报） | — 本期不做 | — 本期不做 | 宿主 iframe 上层遮罩 |
| ready 信号 | `onMounted` 发 `personal-ai:ready` | — | — | 接收并撤遮罩 |

> android / ios 的个人 AI 框走各自 WebView 宿主，白屏问题存在但本期不处理。

## 技术设计

### 组件 `AiChatLoading.vue`

位置 `apps/desktop/src/renderer/views/AiBrowser/AiChatLoading.vue`（功能内聚：与 `AiLinkDetailPopoverInner.vue` / `AiMenusInner.vue` 同目录）。

照 web `src/components/common/AcPageLoading.vue` 仿写，Vue 2.7 + UnoCSS 原子类（desktop `presetUno` 与 `primary` token 均具备，类名可直接复用）：

```
容器：w-full h-full flex flex-col items-center justify-center gap-3 bg-[#F7F9FE] [-webkit-app-region:no-drag]
转圈：w-8 h-8 border-2 border-solid border-[#D7E3FF] border-t-primary rounded-full animate-spin
文案：text-[#8F959E] text-sm 「页面加载中...」
```

与 web 版的两处刻意偏差：
- 底色 `#F7F9FE`（个人 AI 页真实底色）而非 AcPageLoading 的 `#F4F6F8` —— 撤遮罩时无色差闪动
- 加 `[-webkit-app-region:no-drag]` —— 否则遮罩期间该区域变系统拖拽区，点击失效

### 宿主接线（`views/AiBrowser/index.vue`）

- 新增 `personalAiLoading` ref，初值 `false`
- 个人 AI 首次 `mountPage` 时置 `true` 并起 8s 定时器
- 遮罩 DOM 放在个人 AI 那个 `item` 容器内、iframe 之上（同一 `absolute` 定位层，z-index 高于 iframe），`v-if="item.isPersonalAi && personalAiLoading"`
- 撤遮罩统一走一个幂等函数（清定时器 + 置 false），三条触发路径：收到 ready / 8s 超时 / iframe `error`
- 淡出用 200ms opacity 过渡
- `onBeforeUnmount` 清定时器

iframe 只挂载一次、切 tab 不重载，因此「只首次显示」是天然行为，不需要额外的 once 标记。

### 消息协议（宿主 ← web）

沿用现有 `window.postMessage` + `isTrustedPersonalAiOrigin` origin 校验通道，新增一个 type：

```js
// personalAiMessageBridge.js
export const PERSONAL_AI_READY_TYPE = "personal-ai:ready";
export function isPersonalAiReady(message) {
  return Boolean(message && message.type === PERSONAL_AI_READY_TYPE);
}
```

`handlePersonalAiMessage` 里在 `isSelectAiAgentRequest` 判断之前加一个分支处理它。

web 侧照 `personal-ai/list/openImChat.js` 的既有写法：

```js
if (window.self !== window.top && window.parent) {
  window.parent.postMessage({ type: "personal-ai:ready" }, "*");
}
```

非 iframe 环境（独立浏览器打开、移动端 wrapper）不发、不报错。

> 需同步 `context/bridge.md`：新增 web → PC 宿主的 `personal-ai:ready` 通道。

## 依赖的接口

无新增后端接口。不涉及 `context/contracts/`。

## 测试策略

desktop 无单测习惯（vitest 基本空置），靠 `npm run dev:test` 真机验证四条：

1. 首开个人 AI：见转圈 → 淡出 → web 列表骨架接力，无纯白帧
2. 切到外链 AI tab 再切回：遮罩不再出现
3. 断网 / 改错 `APP_AICHAT`：8s 后遮罩自动撤掉，不死锁
4. 遮罩期间：窗口标题栏可拖拽，tab 可点击

web 侧改动一行，`pnpm exec vue-tsc --noEmit` 通过即可。

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| loading 放哪层 | PC 宿主层遮罩 | 能覆盖「资源下载 + JS 解析 + Vue 挂载」全过程；web 端骨架屏要等 JS 执行完才出现，覆盖不到白屏最长那段 |
| 收尾信号 | web 发 ready + 8s 超时兜底 | 精确；老版本 web 走超时分支不会坏 |
| ready 时机 | web `onMounted` 即发 | 最早撤遮罩，后续由 web 自身列表 loading 接力 |
| 覆盖范围 | 仅个人 AI 框（aiId=0） | 外链站点不会发 ready，需另一套 webview 事件逻辑 |
| 底色 | `#F7F9FE` | 与个人 AI 页一致，撤遮罩无色差 |
| 超时 | 8s | 慢网也能等到 ready；真挂了最多看 8 秒转圈 |

## 待用户确认的问题

无（设计要点已在 brainstorm 中逐条确认）。

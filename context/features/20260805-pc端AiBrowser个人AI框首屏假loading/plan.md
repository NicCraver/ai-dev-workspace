# Plan：pc端AiBrowser个人AI框首屏假loading

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。

**Goal：** 个人 AI 框（`aiId=0`）首次加载时，PC 宿主在 iframe 上层盖一层假 loading，直到 web 端 `onMounted` 回传 `personal-ai:ready` 才淡出，消除首屏纯白。

**Architecture：** 宿主遮罩层方案。`AiBrowser/index.vue` 里个人 AI 首次 `mountPage` 时置 `personalAiLoading=true` 并起 8s 定时器；iframe 内 web 端挂载后 `window.parent.postMessage({type:"personal-ai:ready"})`；宿主经既有 `handlePersonalAiMessage`（含 origin 校验）收到后撤遮罩。三条撤销路径幂等：ready / 8s 超时 / iframe `error`。

**Tech Stack：** desktop = Electron 19 + Vue 2.7 + UnoCSS（`presetUno`）+ vitest 2；web = Vue 3 + `<script setup>` + Vite。

## Global Constraints

- **desktop 禁用 ES2020 语法**：不用可选链 `?.` 与空值合并 `??`，一律 `&&` / `||` 兜底（webpack4 + babel6-7 不转译）。
- **desktop 注释用中文**；web 仓库注释同样用中文。
- **desktop 提交禁忌**：`git add` 一律排除 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json`，只提交业务源码与单测。
- **禁止重装 desktop 依赖**：不跑 `npm install` / `pnpm install`，不删 `node_modules`。
- 功能内聚：新组件放 `views/AiBrowser/` 目录内，单测放 `test/unit/`。
- 遮罩底色 `#F7F9FE`；超时常量 `8000` ms；消息 type 字符串 `"personal-ai:ready"`（三处必须完全一致）。

---

## Desktop 端（主体）

### Task 1: 消息类型 `personal-ai:ready`（desktop 侧判定）

**端：** desktop

**Files:**
- Modify: `apps/desktop/src/renderer/components/aiChat/personalAiMessageBridge.js`
- Test: `apps/desktop/test/unit/personal-ai-ready-message.spec.js`（新建）

**Interfaces:**
- Consumes: 无
- Produces: `PERSONAL_AI_READY_TYPE: string`（值 `"personal-ai:ready"`）、`isPersonalAiReady(message: object|null): boolean` —— Task 3 的 `handlePersonalAiMessage` 使用

- [ ] **Step 1: 写失败的测试**

新建 `apps/desktop/test/unit/personal-ai-ready-message.spec.js`：

```js
import { describe, expect, test } from "vitest";
import {
  PERSONAL_AI_READY_TYPE,
  isPersonalAiReady,
} from "../../src/renderer/components/aiChat/personalAiMessageBridge";

describe("personal-ai:ready 消息判定", () => {
  test("type 常量与 web 侧约定一致", () => {
    expect(PERSONAL_AI_READY_TYPE).toBe("personal-ai:ready");
  });

  test("命中 ready 消息", () => {
    expect(isPersonalAiReady({ type: "personal-ai:ready" })).toBe(true);
  });

  test("其它 personal-ai 消息不误判", () => {
    expect(isPersonalAiReady({ type: "personal-ai:open-chat" })).toBe(false);
    expect(isPersonalAiReady({ type: "personal-ai:select-agent" })).toBe(false);
  });

  test("空值 / 非对象不崩", () => {
    expect(isPersonalAiReady(null)).toBe(false);
    expect(isPersonalAiReady(undefined)).toBe(false);
    expect(isPersonalAiReady({})).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/desktop && npx vitest run test/unit/personal-ai-ready-message.spec.js
```

预期：FAIL，报 `PERSONAL_AI_READY_TYPE` / `isPersonalAiReady` 未导出（`is not a function` 或断言收到 `undefined`）。

- [ ] **Step 3: 最小实现**

在 `apps/desktop/src/renderer/components/aiChat/personalAiMessageBridge.js` 中，紧跟已有的 `OPEN_CHAT_REQUEST_TYPE` 常量之后加：

```js
/** web 端个人 AI 首屏挂载完成信号（宿主据此撤 loading 遮罩） */
export const PERSONAL_AI_READY_TYPE = "personal-ai:ready";
```

在已有的 `isOpenChatRequest` 函数之后加：

```js
/** 个人 AI web 首屏就绪 */
export function isPersonalAiReady(message) {
  return Boolean(message && message.type === PERSONAL_AI_READY_TYPE);
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/desktop && npx vitest run test/unit/personal-ai-ready-message.spec.js
```

预期：PASS，4 个用例全绿。

- [ ] **Step 5: lint + 提交**

```bash
cd apps/desktop && npm run lint
git add src/renderer/components/aiChat/personalAiMessageBridge.js test/unit/personal-ai-ready-message.spec.js
git commit -m "feat(ai-browser): 新增 personal-ai:ready 消息类型与判定"
```

---

### Task 2: `AiChatLoading.vue` 遮罩组件

**端：** desktop

**Files:**
- Create: `apps/desktop/src/renderer/views/AiBrowser/AiChatLoading.vue`
- 参考（只读，不改）：`apps/web/src/components/common/AcPageLoading.vue`

**Interfaces:**
- Consumes: 无（无 props、无 emits）
- Produces: 默认导出的 Vue 2.7 组件 `AiChatLoading`，撑满父容器（`w-full h-full`），供 Task 3 在 iframe 上层定位使用

- [ ] **Step 1: 建组件文件**

新建 `apps/desktop/src/renderer/views/AiBrowser/AiChatLoading.vue`：

```vue
<template>
  <!-- 个人 AI 框首屏假 loading：仿 web 端 AcPageLoading，底色取个人 AI 页真实底色避免撤遮罩时闪色 -->
  <div
    class="flex flex-col items-center justify-center w-full h-full gap-3 bg-[#F7F9FE] [-webkit-app-region:no-drag]"
  >
    <div
      class="w-8 h-8 border-2 border-solid border-[#D7E3FF] border-t-primary rounded-full animate-spin"
    />
    <span class="text-[#8F959E] text-sm">页面加载中...</span>
  </div>
</template>

<script>
export default {
  name: "AiChatLoading",
};
</script>
```

> 不写 `<style>`：转圈动画由 UnoCSS `presetUno` 的 `animate-spin` 提供，`primary` 取 `unocss.config.js` 主题色 `#3E7EFF`。`[-webkit-app-region:no-drag]` 必须留——否则遮罩期间该区域变系统拖拽区，tab 点不动。

- [ ] **Step 2: lint 通过**

```bash
cd apps/desktop && npm run lint
```

预期：无 error（本文件不应报错）。

- [ ] **Step 3: 提交**

```bash
cd apps/desktop && git add src/renderer/views/AiBrowser/AiChatLoading.vue
git commit -m "feat(ai-browser): 新增个人 AI 框首屏 loading 组件"
```

---

### Task 3: 宿主接线（显隐 / 超时 / error）

**端：** desktop

**Files:**
- Modify: `apps/desktop/src/renderer/views/AiBrowser/index.vue`

**Interfaces:**
- Consumes: Task 1 的 `isPersonalAiReady`、`PERSONAL_AI_READY_TYPE`；Task 2 的 `AiChatLoading` 组件
- Produces: 无对外接口（组件内部状态）

- [ ] **Step 1: 加 import**

在 `index.vue` `<script setup>` 中，已有的 `import AiMenusInner from "./AiMenusInner.vue";` 之后加：

```js
import AiChatLoading from "./AiChatLoading.vue";
```

在已有的 `personalAiMessageBridge` 解构 import 中补 `isPersonalAiReady`（放在 `isBridgeRequest` 之后）：

```js
import {
  isSelectAiAgentRequest,
  isOpenChatRequest,
  isBridgeRequest,
  isPersonalAiReady,
  isTrustedPersonalAiOrigin,
  parsePersonalAiMessage,
  BRIDGE_RESULT_TYPE,
} from "@/components/aiChat/personalAiMessageBridge";
```

- [ ] **Step 2: 加状态与显隐函数**

在 `const PERSONAL_AI_TOOL_ID = "0";` 之后加：

```js
/** 个人 AI 首屏假 loading 超时兜底（老版本 web 不发 ready 时靠它撤遮罩） */
const PERSONAL_AI_LOADING_TIMEOUT = 8000;
const personalAiLoading = ref(false);
let personalAiLoadingTimer = null;

/** 个人 AI iframe 首次挂载：盖遮罩并起超时 */
const showPersonalAiLoading = () => {
  if (personalAiLoadingTimer) {
    clearTimeout(personalAiLoadingTimer);
  }
  personalAiLoading.value = true;
  personalAiLoadingTimer = setTimeout(() => {
    personalAiLoadingTimer = null;
    console.warn("[AiBrowser] 个人 AI 未在 8s 内回传 ready，撤 loading 遮罩");
    personalAiLoading.value = false;
  }, PERSONAL_AI_LOADING_TIMEOUT);
};

/** 撤遮罩：ready / 超时 / iframe error 三条路径共用，幂等 */
const hidePersonalAiLoading = () => {
  if (personalAiLoadingTimer) {
    clearTimeout(personalAiLoadingTimer);
    personalAiLoadingTimer = null;
  }
  personalAiLoading.value = false;
};

/** iframe 加载失败：别让遮罩死锁 */
const handlePersonalAiFrameError = (item) => {
  if (item && item.isPersonalAi) {
    console.warn("[AiBrowser] 个人 AI iframe error，撤 loading 遮罩");
    hidePersonalAiLoading();
  }
};
```

> `ref` 已在文件顶部 import，无需再加。

- [ ] **Step 3: 在 `mountPage` 里触发遮罩**

把已有的 `mountPage` 改成（新增中间那段 if）：

```js
const mountPage = (item) => {
  if (!item) return;
  const aiId = toAiId(item.aiId);
  if (!pageUrlMap[aiId]) {
    pageUrlMap[aiId] = item.formatUrl;
  }
  // 个人 AI 首次挂载才盖遮罩；iframe 不重载，切 tab 回来不会重复出现
  if (aiId === PERSONAL_AI_TOOL_ID && !loadedMap[aiId]) {
    showPersonalAiLoading();
  }
  loadedMap[aiId] = true;
};
```

- [ ] **Step 4: 在 `handlePersonalAiMessage` 里收 ready**

在已有的 `const message = parsePersonalAiMessage(event.data);` + `if (!message) return;` 之后、`if (isSelectAiAgentRequest(message))` 之前插入：

```js
  if (isPersonalAiReady(message)) {
    hidePersonalAiLoading();
    return;
  }
```

- [ ] **Step 5: 模板挂遮罩**

在 `<div class="relative flex-1">` 内的 `v-for` 容器里，`<webview>` 之后、该容器 `</div>` 之前插入：

```html
        <transition name="ai-chat-loading-fade">
          <AiChatLoading
            v-if="item.isPersonalAi && personalAiLoading"
            class="absolute left-0 top-0 w-full h-full z-10"
          />
        </transition>
```

同时给同容器内的 `<iframe>` 标签加 error 兜底（在已有的 `scrolling="no"` 之后加一行）：

```html
          @error="handlePersonalAiFrameError(item)"
```

- [ ] **Step 6: 加淡出过渡样式**

在文件底部 `<style lang="scss" scoped>` 块内，`.tabs-scroll-wrapper` 规则之后加：

```scss
// 遮罩淡出（进入不做动画，避免首屏再多一次闪烁）
.ai-chat-loading-fade-leave-active {
  transition: opacity 0.2s ease;
}
.ai-chat-loading-fade-leave-to {
  opacity: 0;
}
```

- [ ] **Step 7: 卸载时清定时器**

在已有的 `onBeforeUnmount` 里，`if (loadListDebounceTimer) {...}` 之后加：

```js
  if (personalAiLoadingTimer) {
    clearTimeout(personalAiLoadingTimer);
    personalAiLoadingTimer = null;
  }
```

- [ ] **Step 8: lint + 单测回归**

```bash
cd apps/desktop && npm run lint && npx vitest run test/unit/personal-ai-ready-message.spec.js
```

预期：lint 无 error；测试 PASS。

- [ ] **Step 9: 提交**

```bash
cd apps/desktop && git status --short
git add src/renderer/views/AiBrowser/index.vue
git commit -m "feat(ai-browser): 个人 AI 框首屏盖假 loading，ready/超时/error 三路撤销"
```

> `git status` 里若有 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json` 改动，**不要 stage**。

---

## Web 端（配合）

### Task 4: web 挂载后回传 `personal-ai:ready`

**端：** web

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/list/PersonalAiChat.vue`（`onMounted`，约 165-176 行）

**Interfaces:**
- Consumes: 无
- Produces: 向 parent 发 `{ type: "personal-ai:ready" }`，被 Task 1 的 `isPersonalAiReady` 命中

- [ ] **Step 1: 加上报函数**

在 `PersonalAiChat.vue` 的 `onMounted(...)` 定义**之前**加：

```js
/**
 * 通知 PC 宿主首屏已挂载，撤掉 AiBrowser 的假 loading 遮罩。
 * 非 iframe 环境（独立浏览器 / 移动端 wrapper）直接跳过。
 */
const notifyHostReady = () => {
  if (typeof window === "undefined") return;
  if (window.self === window.top || !window.parent) return;
  window.parent.postMessage({ type: "personal-ai:ready" }, "*");
};
```

> 写法对齐同目录 `openImChat.js` 既有的 `window.parent.postMessage(..., "*")`：宿主侧 `isTrustedPersonalAiOrigin` 已做 origin 校验，此处用 `"*"` 与既有通道一致。

- [ ] **Step 2: 在 `onMounted` 里调用**

把已有的 `onMounted` 改为（末尾新增一行）：

```js
onMounted(() => {
  ensureSelectAgentNativeApi(wnsdk);
  ensureSelectSharedKnowledgeNativeApi(wnsdk);
  if (isMobile()) {
    try {
      wnsdk.ui.closeLoadingBar({});
    } catch {
      // 非 MTCoreApi 环境，忽略
    }
  }
  window.addEventListener("message", handleSelectedAgentMessage);
  notifyHostReady();
});
```

- [ ] **Step 3: 格式化 + 类型检查**

```bash
cd apps/web && pnpm format && pnpm exec vue-tsc --noEmit
```

预期：`vue-tsc` 退出码 0，无报错输出。

- [ ] **Step 4: 提交**

```bash
cd apps/web && git add src/components/views/personal-ai/list/PersonalAiChat.vue
git commit -m "feat(personal-ai): 首屏挂载后向 PC 宿主回传 personal-ai:ready"
```

---

## 文档与验收

### Task 5: 同步 bridge.md + 真机自测

**端：** desktop + web（文档在 context 仓库）

**Files:**
- Modify: `context/bridge.md`
- Modify: `context/features/20260805-pc端AiBrowser个人AI框首屏假loading/status.md`
- Create: `context/features/20260805-pc端AiBrowser个人AI框首屏假loading/impl-notes.md`

- [ ] **Step 1: bridge.md 登记新通道**

在「消息格式」代码块中，`personal-ai:open-chat` 那段之后加：

```jsonc
// AiBrowser iframe 首屏就绪（web → AiBrowser，无响应）
{ "type": "personal-ai:ready" }
// web 在 PersonalAiChat onMounted 后发；宿主收到即撤个人 AI 框首屏 loading 遮罩。
// 宿主 8s 超时兜底：老版本 web 不发此消息也不会死锁。
```

文件底部变更记录追加一行：

```
- 2026-08-05 登记 `personal-ai:ready`（web → AiBrowser，fire-and-forget）：web 首屏挂载完成信号，宿主据此撤个人 AI 框首屏假 loading；宿主 8s 超时兜底兼容老版本 web。
```

并把头部 `> 最后更新：2026-07-15` 改为 `> 最后更新：2026-08-05`。

- [ ] **Step 2: 真机自测（`npm run dev:test`）**

```bash
cd apps/desktop && npm run dev:test
```

逐条验证：

1. 首开个人 AI 框：先见转圈 +「页面加载中...」→ 淡出 → web 会话列表骨架接力，**全程无纯白帧**
2. 切到外链 AI tab（如 kimi）再切回个人 AI：遮罩**不再出现**
3. 遮罩期间：拖动窗口标题栏可移动窗口、顶部 tab 可点击（验证 `no-drag` 生效）
4. 断网，或临时把 `.env.test` 的 `APP_AICHAT` 改成不可达地址后重启：8s 后遮罩自动撤掉，不死锁（**验完还原 `.env.test`，绝不 `git add`**）

- [ ] **Step 3: 写 impl-notes.md**

沉淀平台无关逻辑，供 android / ios 后续移植：
- 遮罩显隐时机：首次挂载 WebView 时开；宿主收 ready / 8s 超时 / 加载失败三路关，幂等
- `personal-ai:ready` 协议与「老版本 web 走超时分支」的兼容策略
- 视觉参数：底色 `#F7F9FE`、转圈 32px、`#D7E3FF` 底环 + `#3E7EFF` 头、文案「页面加载中...」
- 坑：Electron 下遮罩必须 `no-drag`，否则被挡区域变系统拖拽区、点击失效

- [ ] **Step 4: 更新 status.md 矩阵并提交 context**

```bash
cd /Users/nic/w/ai-dev-workspace
git add -A
git commit -m "docs(20260805-pc端AiBrowser个人AI框首屏假loading): 登记 personal-ai:ready 通道与实现笔记"
```

---

## 任务与端对照

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| T1 `personal-ai:ready` 类型与判定 | — | — | — | ✅ 本期 |
| T2 `AiChatLoading.vue` 组件 | — | — | — | ✅ 本期 |
| T3 宿主接线（显隐/超时/error） | — | — | — | ✅ 本期 |
| T4 web 回传 ready | ✅ 本期 | — | — | — |
| T5 bridge.md + 真机自测 | — | — | — | ✅ 本期 |

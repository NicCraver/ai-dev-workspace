# 数据范围选择改纯 webview（先 iOS）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS 筛选条「数据范围」改为全屏 webview 加载 web 的 `SelectDataRangeDialog`，原生只负责开页 / 关页 / 关页后刷记忆。

**Architecture:** 新增 mobile 入口页 `/m/data-range`（`needCode:YES` 带 userCode 登录），页内渲染 `SelectDataRangeDialog` 的移动变体；确定时 web 以 `getAgentDataRange` 的返回为底、只替换 `dataRangeScopeList` 与三个全选标记后 `saveDataRange`，再经新桥 `reportDataRange` 上报 `{type:"data-range:confirm",ok:true}`；原生收到关页并 `zx_fetchPersonalAiMemoryForce`。上报通道判定从 `/date-range` 的 `host-bridge.js` 提成参数化共用模块，两页复用。

**Tech Stack:** web = Vue 3 `<script setup>` + UnoCSS + Element Plus + `@tjmt/wnsdk`，单测用 node 原生 test runner（`node --test`，仅覆盖纯 JS）；iOS = Objective-C + `ZXJSWebPopoverView` + `ZXJSWKWebViewBridge`。

## Global Constraints

- 注释一律中文（web / iOS 两仓都要求）。
- web 无 ESLint、无组件测试；纯 JS 模块用 `node --test`，组件改动靠 `pnpm exec vue-tsc --noEmit` + 人工自测。
- iOS 无单测、无 lint，**AI 不执行 `pod install` / `xcodebuild` / `xcrun simctl`**，构建与真机验证由人工在 Xcode 完成。
- 上报载荷必须**平铺**在 wnsdk 参数顶层：`success` / `error` / `dataFilter` 是保留回调键，套 `data` 会让原生收到 `{"data":{...}}` 而顶层无 `type`。
- 非 iOS 客户端**不得**访问 `wnsdk.aiChat`（os 不匹配时模块 getter 会弹 `showError`），判定必须先过 UA `/MTCoreApi/i`。
- `saveDataRange` 是全量记忆写入：省略 `timeType` / `startTime` / `endTime` / `netSearch` / `dataRangeList` 会把已存值冲掉。
- 三个全选标记是**三态**：未知（null）时省略这三个 key，绝不传 0 冒充。
- iOS 部署 base 固定 `/ai-chat/`，移动入口路由前缀 `/ai-chat/m/`。

## 文件结构

| 文件 | 职责 |
|------|------|
| `apps/web/src/utils/hostReportBridge.js`（新建） | 参数化的宿主上报通道：探测 / 判定 / 分派。handler 名与日志前缀由调用方传入 |
| `apps/web/src/utils/hostReportBridge.test.mjs`（新建） | 上述模块单测 |
| `apps/web/src/pages/date-range/host-bridge.js`（改） | 变成 `selectDateRange` 的薄封装，对外导出不变 |
| `apps/web/src/components/common/AcDialog.vue`（改） | 加 `hideClose` prop：移动全屏形态用自定义导航栏，不要右上角关闭 |
| `apps/web/src/components/views/personal-ai/picker/SelectDataRangeDialog.vue`（改） | 加 `mobile` prop：全屏壳 / 顶部导航栏（返回·标题·涉密）/ 搜索常驻 + 全屏结果层 / 安全区 |
| `apps/web/src/components/views/personal-ai/picker/dataRangeSavePayload.js`（新建） | 纯函数：以记忆为底合并 scopes + flags，产出 `saveDataRange` 入参 |
| `apps/web/src/components/views/personal-ai/picker/tests/dataRangeSavePayload.test.mjs`（新建） | 上述纯函数单测 |
| `apps/web/src/mpa/mobile/pages/data-range.vue`（新建） | webview 宿主页：读 query、等登录态、取记忆、渲染 Dialog、合并保存、上报 |
| `apps/web/src/mpa/mobile/App.vue`（改） | `extendModule("aiChat", …)` 增加 `reportDataRange` namespace |
| `apps/ios/.../ZX_WebJSView/ZXJSWebPopoverView.h/.m`（改） | 加 `topCornerRadius`（默认 16），全屏形态传 0 |
| `apps/ios/.../AIAgent/ZXAIAgentManager.h/.m`（改） | 加 `openDataRangePickerWithAgentId:accountId:onConfirm:onCancel:` 与 `handleDataRangeReportCancelled:` |
| `apps/ios/.../ZX_WebJSCoreAPI/ZXJSAIChatAPI.m`（改） | 注册 `reportDataRange` handler |
| `apps/ios/.../ZX_Controller/ZXRCIMBaseChatController+PersonalAiFilter.m`（改） | `zx_presentPersonalAiDataScopePicker` 改开 webview |
| `context/bridge.md`（改） | 登记 `reportDataRange` |

---

### Task 1: 上报桥提成参数化共用模块

**Files:**
- Create: `apps/web/src/utils/hostReportBridge.js`
- Create: `apps/web/src/utils/hostReportBridge.test.mjs`
- Modify: `apps/web/src/pages/date-range/host-bridge.js`（整文件替换为薄封装）
- Test: 上面两个 `.test.mjs`（`host-bridge.test.mjs` 原样保留，必须继续全绿）

**Interfaces:**
- Produces:
  - `createHostReporter({ handlerName, logTag })` → `{ probeHostEnv, resolveChannel, postToHost }`
  - `probeHostEnv(g?, sdk?)` → `{ hasAndroidBridge, hasIosBridge, isIosNative, hasParent }`
  - `resolveChannel(env)` → `"android" | "ios" | "parent" | "none"`
  - `postToHost(payload, g?, sdk?)` → 实际通道字符串
- Consumes: 无

- [ ] **Step 1: 写失败的测试**

创建 `apps/web/src/utils/hostReportBridge.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createHostReporter } from "./hostReportBridge.js";

const IOS_UA = "Mozilla/5.0 (iPhone) MTCoreApiJS/1.0.0";

const reporter = createHostReporter({
  handlerName: "reportDataRange",
  logTag: "data-range"
});

test("安卓桥优先，载荷转 JSON 字符串", () => {
  const calls = [];
  const g = {
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 13)" },
    WebView: { reportDataRange: (s) => calls.push(s) }
  };
  const channel = reporter.postToHost({ type: "data-range:confirm", ok: true }, g, null);
  assert.equal(channel, "android");
  assert.equal(calls[0], JSON.stringify({ type: "data-range:confirm", ok: true }));
});

test("iOS 桥：业务字段平铺在参数顶层，success/error 只放函数", () => {
  let received = null;
  const sdk = { aiChat: { reportDataRange: (params) => (received = params) } };
  const g = { navigator: { userAgent: IOS_UA } };
  const channel = reporter.postToHost({ type: "data-range:confirm", ok: true }, g, sdk);
  assert.equal(channel, "ios");
  assert.equal(received.type, "data-range:confirm");
  assert.equal(received.ok, true);
  assert.equal(received.data, undefined);
  assert.equal(typeof received.success, "function");
  assert.equal(typeof received.error, "function");
});

test("模拟 wnsdk 下发原生的 data：type 在顶层（固化平铺契约）", () => {
  let nativeData = null;
  const sdk = {
    aiChat: {
      reportDataRange: (params) => {
        // 复刻 wnsdk callInner：整个参数对象剔除三个保留键后当 data 下发
        const n = { ...params };
        n.success = undefined;
        n.error = undefined;
        n.dataFilter = undefined;
        nativeData = n;
      }
    }
  };
  reporter.postToHost({ type: "data-range:cancel" }, { navigator: { userAgent: IOS_UA } }, sdk);
  assert.equal(nativeData.type, "data-range:cancel");
});

test("非 iOS 客户端不触碰 sdk.aiChat（os 不匹配会弹 showError）", () => {
  let touched = false;
  const sdk = {
    get aiChat() {
      touched = true;
      return { reportDataRange: () => {} };
    }
  };
  const g = { navigator: { userAgent: "Mozilla/5.0 (Macintosh) Chrome/120" } };
  const channel = reporter.postToHost({ type: "data-range:cancel" }, g, sdk);
  assert.equal(touched, false);
  assert.equal(channel, "none");
});

test("iframe 宿主回退 parent.postMessage", () => {
  const posted = [];
  const g = {
    navigator: { userAgent: "Mozilla/5.0 (Macintosh) Chrome/120" },
    parent: { postMessage: (p, o) => posted.push([p, o]) }
  };
  g.parent.parent = g.parent;
  const channel = reporter.postToHost({ type: "data-range:cancel" }, g, null);
  assert.equal(channel, "parent");
  assert.deepEqual(posted[0][0], { type: "data-range:cancel" });
});

test("handlerName 参数化：只认自己那个方法名", () => {
  const g = {
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 13)" },
    WebView: { selectDateRange: () => {} }
  };
  const env = reporter.probeHostEnv(g, null);
  assert.equal(env.hasAndroidBridge, false);
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/web && node --test src/utils/hostReportBridge.test.mjs
```

Expected: FAIL — `Cannot find module '.../src/utils/hostReportBridge.js'`

- [ ] **Step 3: 写实现**

创建 `apps/web/src/utils/hostReportBridge.js`：

```js
/**
 * 宿主上报通道（web → 原生，方向与多数取数桥相反）。
 *
 * 三种宿主：
 *   - 安卓原生 webview：原生注入 window.WebView.<handlerName>（jsinterface 同步通道）
 *   - iOS 原生 webview：wnsdk.aiChat.<handlerName>
 *   - PC iframe：window.parent.postMessage
 *
 * 两个必须守住的点（`/date-range` 上踩过，勿回退）：
 *   1. wnsdk 把参数里的 success / error / dataFilter 当回调取走，其余键**整个对象**当 data
 *      下发原生（callInner：n = extend({}, params) 后置空这三个键）。业务载荷必须平铺在
 *      参数顶层：塞进 success 传不下去，套一层 data 会让原生收到 {"data":{...}}、顶层无 type。
 *   2. wnsdk 是 UMD 包经 Vite 走 CommonJS 分支打包，**不挂 window.wnsdk**。sdk 实例必须由
 *      调用方显式传入，不能探测 window。
 *
 * 判定为纯函数便于 node 下直接验证；副作用集中在 postToHost。
 *
 * @param {object} options
 * @param {string} options.handlerName 桥方法名，如 "selectDateRange" / "reportDataRange"
 * @param {string} options.logTag 日志前缀，如 "date-range"
 */
export function createHostReporter({ handlerName, logTag }) {
  /**
   * 探测宿主环境。
   * @param {object} g window（或测试替身）
   * @param {object|null} sdk 调用方注入的 wnsdk 实例（已注册 handlerName）
   */
  const probeHostEnv = (g = typeof window !== "undefined" ? window : {}, sdk = null) => {
    const ua =
      (g.navigator && g.navigator.userAgent) ||
      (typeof navigator !== "undefined" && navigator.userAgent) ||
      "";
    const androidBridge = g.WebView && typeof g.WebView[handlerName] === "function";
    const isIosNative = /MTCoreApi/i.test(ua);
    // 仅 iOS 宿主下才读 sdk.aiChat：wnsdk 模块 getter 在 os 不匹配时会走 showError 弹提示
    const iosBridge =
      isIosNative && sdk && sdk.aiChat && typeof sdk.aiChat[handlerName] === "function";
    return {
      hasAndroidBridge: !!androidBridge,
      hasIosBridge: !!iosBridge,
      isIosNative,
      hasParent: !!(g.parent && g.parent !== g)
    };
  };

  /** 优先级：安卓桥 > iOS 桥 > parent.postMessage > 无 */
  const resolveChannel = (env) => {
    if (env.hasAndroidBridge) return "android";
    if (env.isIosNative && env.hasIosBridge) return "ios";
    if (env.hasParent) return "parent";
    return "none";
  };

  /**
   * 向宿主上报 payload。
   * @returns {string} 实际使用的通道（"android"|"ios"|"parent"|"none"）
   */
  const postToHost = (
    payload,
    g = typeof window !== "undefined" ? window : {},
    sdk = null
  ) => {
    const env = probeHostEnv(g, sdk);
    let channel = resolveChannel(env);

    // iOS 宿主但桥未接通：提示并回退 parent（顶层 webview 下为 none）
    if (channel === "none" && env.isIosNative) {
      console.warn(
        `[${logTag}] iOS 原生宿主但 wnsdk.aiChat.${handlerName} 未注册，回退 parent.postMessage（顶层 webview 下为空操作）。`
      );
      channel = env.hasParent ? "parent" : "none";
    }

    try {
      if (channel === "android") {
        // 安卓 jsinterface：JSON 字符串载荷
        g.WebView[handlerName](JSON.stringify(payload));
      } else if (channel === "ios") {
        // 业务载荷平铺；success/error 是 wnsdk 保留回调键，只能放函数
        sdk.aiChat[handlerName]({
          ...payload,
          success: () => {},
          error: (e) => console.warn(`[${logTag}] iOS 桥回传失败:`, e)
        });
      } else if (channel === "parent") {
        g.parent.postMessage(payload, "*");
      }
      // none：静默（非嵌入且无桥）
    } catch (e) {
      console.warn(`[${logTag}] postToHost failed via ${channel}:`, e);
    }
    return channel;
  };

  return { probeHostEnv, resolveChannel, postToHost };
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/web && node --test src/utils/hostReportBridge.test.mjs
```

Expected: PASS（6 例）

- [ ] **Step 5: 把 `/date-range` 的 host-bridge 改成薄封装**

整文件替换 `apps/web/src/pages/date-range/host-bridge.js`：

```js
/**
 * /date-range 宿主通道与回传（ADR-0003）。
 * 通道判定与分派已提到 @/utils/hostReportBridge.js（与 /m/data-range 的 reportDataRange 共用一套）；
 * 本文件只固定 handler 名与日志前缀，对外导出保持不变（index.vue 与既有单测依赖它们）。
 */
import { createHostReporter } from "@/utils/hostReportBridge.js";

const reporter = createHostReporter({
  handlerName: "selectDateRange",
  logTag: "date-range"
});

export const probeHostEnv = reporter.probeHostEnv;
export const resolveChannel = reporter.resolveChannel;
export const postToHost = reporter.postToHost;
```

- [ ] **Step 6: 跑既有单测确认没回归**

`host-bridge.test.mjs` 用相对路径 import，而薄封装里用了 `@/` alias，node 跑不通 alias——把该文件的 import 改成相对路径：

```js
import { createHostReporter } from "../../utils/hostReportBridge.js";
```

即：`host-bridge.js` 的 import 写成 `../../utils/hostReportBridge.js`（Vite 与 node 都能解析）。改完跑：

```bash
cd apps/web && node --test src/pages/date-range/host-bridge.test.mjs src/utils/hostReportBridge.test.mjs
```

Expected: 两个文件全绿（原 9 例 + 新 6 例）

- [ ] **Step 7: 提交**

```bash
cd apps/web && git add src/utils/hostReportBridge.js src/utils/hostReportBridge.test.mjs src/pages/date-range/host-bridge.js
git commit -m "refactor(date-range): 宿主上报通道提成参数化共用模块，供数据范围页复用"
```

---

### Task 2: AcDialog 支持隐藏关闭按钮

**Files:**
- Modify: `apps/web/src/components/common/AcDialog.vue`

**Interfaces:**
- Produces: `AcDialog` 新增 prop `hideClose: Boolean`（默认 false）；为 true 时不渲染右上角关闭按钮与其 48px 占位
- Consumes: 无

- [ ] **Step 1: 加 prop**

在 `defineProps` 里 `submitClass` 后加：

```js
  /** 移动全屏形态用自定义导航栏（返回按钮在左），关掉右上角关闭按钮与其占位 */
  hideClose: Boolean,
```

- [ ] **Step 2: 关闭按钮加条件**

把 header 里包着关闭图标的那个 `<span class="flex items-center justify-center shrink-0 w-12 h-12 ml-4 self-start">` 加上 `v-if="!hideClose"`。

- [ ] **Step 3: 类型检查**

```bash
cd apps/web && pnpm exec vue-tsc --noEmit
```

Expected: 退出码 0

- [ ] **Step 4: 提交**

```bash
cd apps/web && git add src/components/common/AcDialog.vue
git commit -m "feat(AcDialog): 加 hideClose，供移动全屏形态自定义导航栏"
```

---

### Task 3: SelectDataRangeDialog 移动变体

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/SelectDataRangeDialog.vue`

**Interfaces:**
- Consumes: Task 2 的 `AcDialog` `hideClose`
- Produces:
  - `SelectDataRangeDialog` 新增 prop `mobile: Boolean`（默认 false）
  - 新增 emit `cancel`（移动端左上返回 / 取消都触发；PC 不变，仍走 `update:open=false`）
  - 已有 emit `submit` 载荷不变：`{ scopes, flags }`

- [ ] **Step 1: 加 prop 与 emit**

`defineProps` 末尾加：

```js
  /**
   * 移动变体（webview 全屏形态）：壳撑满视口、顶部自绘导航栏（返回·标题·涉密）、
   * 搜索改常驻输入框 + 全屏结果层。tabs / 列表 / OrgPicker / 已选气泡一律不变。
   */
  mobile: Boolean
```

`defineEmits` 改为：

```js
const emit = defineEmits(["update:open", "submit", "cancel"]);
```

`onClose` 改为同时抛 `cancel`（PC 侧无人监听，行为不变）：

```js
const onClose = () => {
  keyword.value = "";
  searchFocused.value = false;
  selectedPopoverVisible.value = false;
  emit("update:open", false);
  emit("cancel");
};
```

- [ ] **Step 2: 壳与导航栏**

`AcDialog` 开标签改成（`fullscreen` 经 `$attrs` 透传给 el-dialog）：

```html
  <AcDialog
    v-model="dialogVisible"
    title="选择数据范围"
    :class="mobile ? '' : '!w-440px !h-580px'"
    :fullscreen="mobile"
    :hideClose="mobile"
    content-class="select-data-range__content"
    :submit-title="'确定'"
    cancel-title="取消"
    splitTheme
    submit-class="!bg-#3E7DFF !border-#3E7DFF hover:!bg-#356FE6 hover:!border-#356FE6"
    :handleSubmit="onSubmit"
    @close="onClose"
  >
```

在 `<template #content>` 之前插入移动导航栏插槽（PC 下 `v-if` 不成立，不渲染）：

```html
    <!-- 移动全屏：自绘导航栏（左返回 / 中标题 / 右涉密），顶部吃状态栏安全区 -->
    <template #custom-header v-if="mobile">
      <div
        class="flex items-center w-full h-12 px-2"
        :style="{ paddingTop: 'env(safe-area-inset-top)' }"
      >
        <button
          type="button"
          class="flex items-center justify-center w-10 h-10 shrink-0"
          @click="onClose"
        >
          <SvgIcon name="arrow-back" class="w-5 h-5 text-black" />
        </button>
        <span class="flex-1 text-center text-4 font-semibold text-black truncate">
          选择数据范围
        </span>
        <el-popover
          trigger="click"
          placement="bottom-end"
          effect="dark"
          :width="240"
          popper-class="!p-3 !rounded-2"
        >
          <template #reference>
            <button
              type="button"
              class="flex items-center gap-1 w-10 shrink-0 text-#FEAC00 text-3.5 select-none"
              @click.stop
            >
              <SvgIcon name="secret" class="w-3.5 h-3.5" />
              涉密
            </button>
          </template>
          <span class="block text-3 leading-5 -m-1 whitespace-pre-wrap">{{
            secretTipText
          }}</span>
        </el-popover>
      </div>
    </template>
```

原来的 `#header-right`（PC 涉密入口）加 `v-if="!mobile"`，避免移动端渲染两个涉密按钮：

```html
    <template #header-right v-if="!mobile">
```

- [ ] **Step 3: 搜索改常驻 + 全屏结果层**

把 tabs 那一行里的 `<AiBoxSearchBox ... />` 用 `v-if="!mobile"` 保住 PC 形态，并在 tabs 行**下方**新增移动端搜索行与结果层。tabs 外层容器改为相对定位以承载结果层：

把 `<div class="flex flex-col h-full -mx-4 -my-4">` 改为 `<div class="relative flex flex-col h-full -mx-4 -my-4">`。

tabs 行内 `AiBoxSearchBox` 加 `v-if="!mobile"`。在 tabs 行 `</div>` 之后插入：

```html
        <!-- 移动变体：搜索框常驻一行；聚焦且有关键字时结果层盖住主列表（不跳路由） -->
        <div v-if="mobile" class="shrink-0 px-4 py-2 border-b border-split">
          <SearchInput
            v-model="keyword"
            placeholder="搜索联系人、群组"
            full-width
            focus-on-click
            @focus="onSearchFocus"
          />
        </div>
```

在该 `content` 根 div 的**末尾**（`</div>` 前）插入结果层：

```html
        <!-- 结果层：绝对定位盖住 tabs 以下区域；点结果只勾选，不关层 -->
        <div
          v-if="mobile && mobileSearchOpen"
          class="absolute inset-x-0 bottom-0 top-26 z-10 bg-white overflow-hidden"
        >
          <AiBoxSearchPanel
            class="h-full"
            :keyword="keyword"
            :visible="true"
            multi
            :selected-keys="selectedKeysForSearch"
            :candidates="searchCandidates"
            :candidates-loading="dialogueLoading"
            :show-agent-name="false"
            :match-agent-name="false"
            @select="onSearchSelect"
          />
        </div>
```

script 里补 import 与派生状态：

```js
import SearchInput from "./search/SearchInput.vue";
import AiBoxSearchPanel from "./search/AiBoxSearchPanel.vue";
```

```js
/** 移动搜索层显隐：有关键字才盖，清空即回主列表（不额外造一层状态） */
const mobileSearchOpen = computed(() => !!(keyword.value || "").trim());
```

- [ ] **Step 4: 底栏安全区**

把文件末尾整个 style 块替换为：

```css
<style scoped>
:deep(.select-data-range__content) {
  overflow: visible;
}
/* 移动全屏：底栏抬高到 home indicator 之上 */
:deep(.el-dialog.is-fullscreen .el-dialog__footer) {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
```

- [ ] **Step 5: 类型检查**

```bash
cd apps/web && pnpm exec vue-tsc --noEmit
```

Expected: 退出码 0

- [ ] **Step 6: 提交**

```bash
cd apps/web && git add src/components/views/personal-ai/picker/SelectDataRangeDialog.vue
git commit -m "feat(选择数据范围): Dialog 加移动变体（全屏壳 + 自绘导航栏 + 常驻搜索）"
```

---

### Task 4: 合并保存入参的纯函数

**Files:**
- Create: `apps/web/src/components/views/personal-ai/picker/dataRangeSavePayload.js`
- Create: `apps/web/src/components/views/personal-ai/picker/tests/dataRangeSavePayload.test.mjs`

**Interfaces:**
- Produces: `buildSaveDataRangePayload({ memory, accountId, agentId, scopes, flags })` → `saveDataRange` 入参对象
- Consumes: 无

- [ ] **Step 1: 写失败的测试**

创建 `apps/web/src/components/views/personal-ai/picker/tests/dataRangeSavePayload.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildSaveDataRangePayload } from "../dataRangeSavePayload.js";

const memory = {
  dataRangeList: [{ dataRangeType: 1, choose: 1 }],
  timeType: 0,
  startTime: 1756310400000,
  endTime: 1756396799999,
  netSearch: 1,
  deepThink: 0,
  dataRangeScopeList: [{ scopeDataType: 1, scopeDataId: "old" }],
  groupAndAccountSelectAll: 1
};

test("以记忆为底，只替换 scopes：时间档与联网搜索原样保留", () => {
  const payload = buildSaveDataRangePayload({
    memory,
    accountId: "280",
    agentId: "a1",
    scopes: [{ scopeDataType: 3, scopeDataId: "g9" }],
    flags: { groupAndAccountSelectAll: 0, organizationGroupSelectAll: 0, outreachGroupSelectAll: 0 }
  });
  assert.equal(payload.accountId, "280");
  assert.equal(payload.agentId, "a1");
  assert.equal(payload.timeType, 0);
  assert.equal(payload.startTime, 1756310400000);
  assert.equal(payload.endTime, 1756396799999);
  assert.equal(payload.netSearch, 1);
  assert.equal(payload.deepThink, 0);
  assert.deepEqual(payload.dataRangeList, [{ dataRangeType: 1, choose: 1 }]);
  assert.deepEqual(payload.dataRangeScopeList, [{ scopeDataType: 3, scopeDataId: "g9" }]);
});

test("flags 为 null（未知态）时省略三个 key，不传 0 冒充", () => {
  const payload = buildSaveDataRangePayload({
    memory,
    accountId: "280",
    agentId: "a1",
    scopes: [],
    flags: null
  });
  assert.equal("groupAndAccountSelectAll" in payload, false);
  assert.equal("organizationGroupSelectAll" in payload, false);
  assert.equal("outreachGroupSelectAll" in payload, false);
});

test("flags 有值时三个 key 都补齐（缺项按 0）", () => {
  const payload = buildSaveDataRangePayload({
    memory,
    accountId: "280",
    agentId: "a1",
    scopes: [],
    flags: { groupAndAccountSelectAll: 1 }
  });
  assert.equal(payload.groupAndAccountSelectAll, 1);
  assert.equal(payload.organizationGroupSelectAll, 0);
  assert.equal(payload.outreachGroupSelectAll, 0);
});

test("timeType 非 0 时区间清成 null，不残留旧区间", () => {
  const payload = buildSaveDataRangePayload({
    memory: { ...memory, timeType: 7 },
    accountId: "280",
    agentId: "a1",
    scopes: [],
    flags: null
  });
  assert.equal(payload.timeType, 7);
  assert.equal(payload.startTime, null);
  assert.equal(payload.endTime, null);
});

test("timeType 是字符串 \"0\" 也算自定义，区间保留", () => {
  const payload = buildSaveDataRangePayload({
    memory: { ...memory, timeType: "0" },
    accountId: "280",
    agentId: "a1",
    scopes: [],
    flags: null
  });
  assert.equal(payload.timeType, "0");
  assert.equal(payload.startTime, 1756310400000);
});

test("memory 为空对象时不炸，字段按缺省省略", () => {
  const payload = buildSaveDataRangePayload({
    memory: {},
    accountId: "280",
    agentId: "a1",
    scopes: [],
    flags: null
  });
  assert.equal(payload.accountId, "280");
  assert.deepEqual(payload.dataRangeScopeList, []);
  assert.equal("timeType" in payload, false);
  assert.equal("netSearch" in payload, false);
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/web && node --test src/components/views/personal-ai/picker/tests/dataRangeSavePayload.test.mjs
```

Expected: FAIL — `Cannot find module '.../dataRangeSavePayload.js'`

- [ ] **Step 3: 写实现**

创建 `apps/web/src/components/views/personal-ai/picker/dataRangeSavePayload.js`：

```js
/**
 * 组装 saveDataRange 入参：**以 getAgentDataRange 拿到的记忆为底**，只替换数据范围与全选标记。
 *
 * saveDataRange 是全量记忆写入（契约 contracts/personalAiFrame/saveDataRange.d.ts）：
 * 少传 timeType / startTime / endTime / netSearch / dataRangeList 会把服务端已存的值冲掉。
 * webview 页只负责选人选群，其余字段必须原样回传。
 *
 * @param {object} args
 * @param {object} args.memory getAgentDataRange 返回的记忆（可为 {}）
 * @param {string|number} args.accountId
 * @param {string|number} args.agentId
 * @param {Array<{scopeDataType:number, scopeDataId:string}>} args.scopes 弹窗选中的范围
 * @param {null|{groupAndAccountSelectAll?:number, organizationGroupSelectAll?:number, outreachGroupSelectAll?:number}} args.flags
 *        三态：null = 未知（候选取数失败/加载中），此时省略三个 key，绝不传 0 冒充
 * @returns {object} saveDataRange 入参
 */
export function buildSaveDataRangePayload({ memory, accountId, agentId, scopes, flags }) {
  const mem = memory || {};
  const payload = {
    accountId: String(accountId),
    agentId: String(agentId),
    dataRangeScopeList: scopes || []
  };

  if (mem.dataRangeList != null) payload.dataRangeList = mem.dataRangeList;
  if (mem.netSearch != null) payload.netSearch = mem.netSearch;
  if (mem.deepThink != null) payload.deepThink = mem.deepThink;

  if (mem.timeType != null) {
    payload.timeType = mem.timeType;
    // timeType=0 是自定义区间（接口偶发字符串 "0"）；非 0 显式传 null 清理，防旧区间残留
    const isCustom = Number(mem.timeType) === 0;
    payload.startTime = isCustom ? (mem.startTime ?? null) : null;
    payload.endTime = isCustom ? (mem.endTime ?? null) : null;
  }

  if (flags) {
    payload.groupAndAccountSelectAll = flags.groupAndAccountSelectAll ?? 0;
    payload.organizationGroupSelectAll = flags.organizationGroupSelectAll ?? 0;
    payload.outreachGroupSelectAll = flags.outreachGroupSelectAll ?? 0;
  }

  return payload;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd apps/web && node --test src/components/views/personal-ai/picker/tests/dataRangeSavePayload.test.mjs
```

Expected: PASS（6 例）

- [ ] **Step 5: 提交**

```bash
cd apps/web && git add src/components/views/personal-ai/picker/dataRangeSavePayload.js src/components/views/personal-ai/picker/tests/dataRangeSavePayload.test.mjs
git commit -m "feat(选择数据范围): 加合并保存入参纯函数，防冲掉时间档与联网搜索"
```

---

### Task 5: mobile 入口新页 `/m/data-range`

**Files:**
- Create: `apps/web/src/mpa/mobile/pages/data-range.vue`
- Modify: `apps/web/src/mpa/mobile/App.vue`（extendModule 增加 `reportDataRange`）

**Interfaces:**
- Consumes: Task 1 `createHostReporter`；Task 3 的 `SelectDataRangeDialog` `mobile` prop 与 `cancel` emit；Task 4 `buildSaveDataRangePayload`
- Produces: 路由 `/ai-chat/m/data-range?agentId=<id>&accountId=<id>&platform=m`；上报载荷 `{type:"data-range:confirm",ok:true}` / `{type:"data-range:cancel"}`

- [ ] **Step 1: 注册 wnsdk namespace**

`apps/web/src/mpa/mobile/App.vue` 的 `wnsdk.extendModule("aiChat", [...])` 数组里追加一项（放在 `selectDataRangeScope` 之后即可）：

```js
    {
      // /m/data-range 页选完后一次性上报结果（web→原生），原生据此关页并刷记忆。
      // 一次性上报、不等原生回选中结果，无需 isLongCb。
      namespace: "reportDataRange",
      os: ["MTCoreApi"]
    },
```

- [ ] **Step 2: 建页面**

创建 `apps/web/src/mpa/mobile/pages/data-range.vue`：

```vue
<template>
  <!-- /m/data-range：供 iOS/安卓原生以全屏 webview 加载的「选择数据范围」页。
       URL：/ai-chat/m/data-range?agentId=<id>&accountId=<id>&platform=m（原生额外拼 userCode 换登录态）
       确定：以 getAgentDataRange 为底合并 scopes/flags → saveDataRange → 上报 {type:"data-range:confirm",ok:true}
       取消/返回：上报 {type:"data-range:cancel"}，不写任何状态 -->
  <div class="w-screen h-screen overflow-hidden bg-white">
    <SelectDataRangeDialog
      v-if="ready"
      :open="true"
      mobile
      :account-id="accountId"
      :initial-scopes="initialScopes"
      @submit="onSubmit"
      @cancel="onCancel"
    />
    <div v-else class="flex items-center justify-center h-full text-3.5 text-gray-medium">
      {{ loadError || "加载中…" }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import wnsdk from "@tjmt/wnsdk";
import { showToast } from "vant";
import SelectDataRangeDialog from "@/components/views/personal-ai/picker/SelectDataRangeDialog.vue";
import { buildSaveDataRangePayload } from "@/components/views/personal-ai/picker/dataRangeSavePayload.js";
import {
  getAgentDataRange,
  saveAgentDataRange
} from "@/server/module/agentSetDataRangeExpand.js";
import { createHostReporter } from "@/utils/hostReportBridge.js";
import { getUrlParams } from "@/utils";
import { loadUserDataDone, user } from "@/loginUtil";

const reporter = createHostReporter({
  handlerName: "reportDataRange",
  logTag: "data-range"
});

const params = getUrlParams(location);
const agentId = params.get("agentId") || "";
/** accountId 优先取 URL；缺省回落 getMyInfo 拿到的当前登录用户 */
const accountId = computed(() => params.get("accountId") || user.value?.id || "");

/** 记忆（getAgentDataRange 原始返回）：确定时作为 save 的底，不可缺 */
const memory = ref(null);
const ready = ref(false);
const loadError = ref("");
const initialScopes = computed(() => memory.value?.dataRangeScopeList || []);

/** 只上报一次：确认后原生就关页，重复上报无意义 */
let reported = false;
const report = (payload) => {
  if (reported) return;
  reported = true;
  reporter.postToHost(payload, window, wnsdk);
};

const loadMemory = async () => {
  if (!agentId) {
    loadError.value = "agentId 未就绪";
    return;
  }
  if (!accountId.value) {
    loadError.value = "accountId 未就绪";
    return;
  }
  try {
    memory.value = (await getAgentDataRange({
      accountId: accountId.value,
      agentId
    })) || {};
    ready.value = true;
  } catch (error) {
    console.warn("[data-range] 记忆取数失败", error);
    // 拿不到底就不许保存：直接 save 会把 timeType / netSearch 冲掉
    loadError.value = "加载失败，请退出重试";
  }
};

// 原生带 userCode 进来，登录态是异步换的；拿到用户信息后再取记忆
watch(
  loadUserDataDone,
  (done) => {
    if (done) loadMemory();
  },
  { immediate: true }
);

const onSubmit = async ({ scopes, flags }) => {
  try {
    await saveAgentDataRange(
      buildSaveDataRangePayload({
        memory: memory.value,
        accountId: accountId.value,
        agentId,
        scopes,
        flags
      })
    );
  } catch (error) {
    console.warn("[data-range] 保存失败", error);
    showToast("保存失败，请重试");
    return; // 不上报、不关页，用户可重试或返回
  }
  report({ type: "data-range:confirm", ok: true });
};

const onCancel = () => {
  report({ type: "data-range:cancel" });
};
</script>
```

- [ ] **Step 3: 类型检查**

```bash
cd apps/web && pnpm exec vue-tsc --noEmit
```

Expected: 退出码 0

- [ ] **Step 4: 本地起服务人工过一遍**

```bash
cd apps/web && pnpm dev
```

浏览器开 `http://localhost:6173/ai-chat/m/data-range?agentId=<真实id>&accountId=<真实id>&platform=m`（需先在同源下有登录态，或带 `userCode`）。
确认：导航栏三件套在位、tabs 可切、搜索聚焦后结果层盖住列表、底栏「已选 N 个 / 清空已选 / 取消 / 确定」在位。
桥不通时点确定：控制台只应打 `[data-range] ...` 提示，页面不崩。

- [ ] **Step 5: 提交**

```bash
cd apps/web && git add src/mpa/mobile/pages/data-range.vue src/mpa/mobile/App.vue
git commit -m "feat(选择数据范围): 新增 /m/data-range webview 页并注册 reportDataRange"
```

---

### Task 6: iOS —— 全屏容器 + `reportDataRange` handler

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSView/ZXJSWebPopoverView.h`
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSView/ZXJSWebPopoverView.m`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentManager.h`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentManager.m`
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/ZXJSAIChatAPI.m`

**Interfaces:**
- Consumes: Task 5 的上报载荷 `{type:"data-range:confirm",ok:true}` / `{type:"data-range:cancel"}`
- Produces:
  - `ZXJSWebPopoverView.topCornerRadius`（CGFloat，默认 16）
  - `+[ZXAIAgentManager openDataRangePickerWithAgentId:accountId:onConfirm:onCancel:]`
  - `+[ZXAIAgentManager handleDataRangeReportCancelled:]`（供 handler 调用）

- [ ] **Step 1: 弹层视图支持不圆角（全屏形态）**

`ZXJSWebPopoverView.h` 在 `bgColor` 下加：

```objc
/** 顶部圆角半径，默认 16；全屏形态传 0（数据范围 webview 用） */
@property (nonatomic, assign) CGFloat topCornerRadius;
```

`ZXJSWebPopoverView.m` 的 `initWithFrame:url:appId:needCode:` 里，在 `self.backgroundColor = ...` 之前加默认值：

```objc
        self.topCornerRadius = 16;
```

`setupSubViews` 里圆角那段改为按属性取值（半径 0 时不设 mask）：

```objc
    // 圆角（全屏形态 topCornerRadius=0，不做遮罩）
    if (self.topCornerRadius > 0) {
        CAShapeLayer *maskLayer = [CAShapeLayer layer];
        maskLayer.path = [UIBezierPath bezierPathWithRoundedRect:self.bounds byRoundingCorners:UIRectCornerTopLeft | UIRectCornerTopRight cornerRadii:CGSizeMake(self.topCornerRadius, self.topCornerRadius)].CGPath;
        self.layer.mask = maskLayer;
    }
    self.layer.masksToBounds = YES;
```

> 注意：`topCornerRadius` 必须在 `setupSubViews` 之前赋值，所以默认值放在 init 内、`setupSubViews` 调用之前。外部要改成 0 的场景由下一步的新 API 内部完成（不是 init 后再设）。

为此在 `.m` 里再加一个便利初始化，避免调用方拿不到时机：

```objc
- (instancetype)initWithFrame:(CGRect)frame url:(NSString *)url appId:(NSString *)appId needCode:(BOOL)needCode topCornerRadius:(CGFloat)topCornerRadius {
    self = [super initWithFrame:frame];
    if (self) {
        self.topCornerRadius = topCornerRadius;
        self.backgroundColor = [UIColor colorWithHexRGB:@"#F4F6F8"];
        self.urlPath = url;
        self.needCode = needCode;
        self.microAppId = appId;
        [self setupSubViews];
    }
    return self;
}
```

`.h` 同步声明：

```objc
/** 指定顶部圆角的初始化（全屏形态传 0） */
- (instancetype)initWithFrame:(CGRect)frame url:(NSString *)url appId:(NSString *)appId needCode:(BOOL)needCode topCornerRadius:(CGFloat)topCornerRadius;
```

原 `initWithFrame:url:appId:needCode:` 改为转调新方法、半径传 16，保证既有调用方（`ZXJSPageAPI gotoJSWebByPopover`、`/date-range`）行为不变：

```objc
- (instancetype)initWithFrame:(CGRect)frame url:(NSString *)url appId:(NSString *)appId needCode:(BOOL)needCode {
    return [self initWithFrame:frame url:url appId:appId needCode:needCode topCornerRadius:16];
}
```

- [ ] **Step 2: Manager 加开页 API**

`ZXAIAgentManager.h` 在 `openDateRangePickerWithStartTime:...` 声明之后加：

```objc
/// 打开「选择数据范围」全屏 webview（/m/data-range，需登录态故 needCode=YES）。
/// H5 选完经 wnsdk.aiChat.reportDataRange 上报；确认回调里由调用方重拉记忆刷新筛选条。
+ (void)openDataRangePickerWithAgentId:(NSString *)agentId
                             accountId:(nullable NSString *)accountId
                             onConfirm:(nullable void (^)(void))onConfirm
                              onCancel:(nullable void (^)(void))onCancel;

/// H5 上报回调入口（由 ZXJSAIChatAPI 的 reportDataRange handler 调用）
+ (void)handleDataRangeReportCancelled:(BOOL)cancelled;
```

`ZXAIAgentManager.m` 顶部静态区（与 `_zxDateRangeResponded` 等同处）加：

```objc
static BOOL _zxDataRangeResponded = NO;
static void (^_zxDataRangeConfirmHandler)(void) = nil;
static void (^_zxDataRangeCancelHandler)(void) = nil;
static NSInteger const kZXAgentDataRangePopoverTag = 20260831;
```

实现（放在 `handleDateRangeConfirm:endTime:cancelled:` 之后）：

```objc
+ (void)openDataRangePickerWithAgentId:(NSString *)agentId
                             accountId:(nullable NSString *)accountId
                             onConfirm:(nullable void (^)(void))onConfirm
                              onCancel:(nullable void (^)(void))onCancel {
    _zxDataRangeResponded = NO;
    _zxDataRangeConfirmHandler = [onConfirm copy];
    _zxDataRangeCancelHandler = [onCancel copy];
    // 需登录态（页内要调 getAgentDataRange / saveDataRange），needCode=YES 由弹层视图换 userCode
    NSMutableString *url = [NSMutableString stringWithFormat:@"%@ai-chat/m/data-range?platform=m&agentId=%@", ZX_HostUrl, agentId ?: @""];
    if (accountId.length) {
        [url appendFormat:@"&accountId=%@", accountId];
    }
    // 全屏：撑满屏幕、不留状态栏、不做顶圆角（与原生 picker 的全屏观感一致）
    CGRect rect = CGRectMake(0, 0, kScreenWidth, kScreenHeight);
    ZXJSWebPopoverView *popView = [[ZXJSWebPopoverView alloc] initWithFrame:rect url:url appId:@"" needCode:YES topCornerRadius:0];
    popView.superController = [ZXClient getCurrentVC];
    HXEasyCustomShareView *shareView = [HXContainerUtils setupNavContainerView:popView tag:kZXAgentDataRangePopoverTag];
    shareView.shadeView.backgroundColor = [UIColor clearColor];
    shareView.cancelLine.hidden = YES;
    popView.popoverClose = ^{
        // H5/原生侧请求关闭：按取消收口（状态不变）
        [ZXAIAgentManager handleDataRangeReportCancelled:YES];
    };
}

+ (void)handleDataRangeReportCancelled:(BOOL)cancelled {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (_zxDataRangeResponded) {
            return; // 防重（同 selectDateRange）
        }
        _zxDataRangeResponded = YES;
        HXEasyCustomShareView *shareView = (HXEasyCustomShareView *)[[UIApplication sharedApplication].keyWindow viewWithTag:kZXAgentDataRangePopoverTag];
        [shareView tappedCancel];
        if (cancelled) {
            !_zxDataRangeCancelHandler ?: _zxDataRangeCancelHandler();
        } else {
            !_zxDataRangeConfirmHandler ?: _zxDataRangeConfirmHandler();
        }
        _zxDataRangeConfirmHandler = nil;
        _zxDataRangeCancelHandler = nil;
    });
}
```

- [ ] **Step 3: 注册 `reportDataRange` handler**

`ZXJSAIChatAPI.m` 在 `selectDateRange` 注册块之后加：

```objc
    // MARK: 选择数据范围结果上报（web → 原生）
    // 载荷平铺在顶层：{ type: "data-range:confirm", ok: true } / { type: "data-range:cancel" }
    // web 侧已完成 saveDataRange，这里只负责关页与回调；非法载荷一律按取消收口，不写脏态
    [self registerHandlerName:@"reportDataRange" handler:^(id data, ZXJSResponseHandler responseHandler) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSDictionary *payload = nil;
            if ([data isKindOfClass:[NSDictionary class]]) {
                NSDictionary *dict = (NSDictionary *)data;
                // 正常形态：wnsdk 把参数对象（剔除回调键）当 data 下发，载荷平铺在 dict 上
                if ([dict[@"type"] isKindOfClass:[NSString class]]) {
                    payload = dict;
                } else if ([dict[@"data"] isKindOfClass:[NSDictionary class]]) {
                    // 兼容旧 web 包把载荷套一层 data 的写法
                    payload = (NSDictionary *)dict[@"data"];
                } else {
                    id ok = dict[@"success"];
                    id err = dict[@"error"];
                    if ([ok isKindOfClass:[NSDictionary class]]) {
                        payload = (NSDictionary *)ok;
                    } else if ([err isKindOfClass:[NSDictionary class]]) {
                        payload = (NSDictionary *)err;
                    }
                }
            }
            NSString *type = [payload isKindOfClass:[NSDictionary class]] ? payload[@"type"] : nil;
            BOOL cancelled = YES;
            if ([type isKindOfClass:[NSString class]] && [type isEqualToString:@"data-range:confirm"]) {
                cancelled = NO;
            }
            [ZXAIAgentManager handleDataRangeReportCancelled:cancelled];
            responseHandler([ZXJSWebResponseModel modelWithCode:0 msg:@"" result:@"{\"ok\":true}"]);
        });
    }];
```

确认 `ZXJSAIChatAPI.m` 顶部已 `#import "ZXAIAgentManager.h"`（`selectDateRange` 已在用，通常已有；没有就补上）。

- [ ] **Step 4: 人工构建**

在 Xcode 打开 `apps/ios/zhixinApp.xcworkspace`，选 `zhixinAppTest` + iPhone 15 (iOS 17) 模拟器，clean build 通过。

Expected: 编译无 error（AI 不代跑 xcodebuild）

- [ ] **Step 5: 提交**

```bash
cd apps/ios && git add SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSView/ZXJSWebPopoverView.h SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSView/ZXJSWebPopoverView.m SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentManager.h SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentManager.m SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/ZXJSAIChatAPI.m
git commit -m "feat(数据范围): 加全屏 webview 容器与 reportDataRange 上报 handler"
```

---

### Task 7: iOS —— 筛选条入口切到 webview

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Controller/ZXRCIMBaseChatController+PersonalAiFilter.m:539-560`

**Interfaces:**
- Consumes: Task 6 的 `+[ZXAIAgentManager openDataRangePickerWithAgentId:accountId:onConfirm:onCancel:]`
- Produces: 无（终端行为）

- [ ] **Step 1: 换实现**

把 `zx_presentPersonalAiDataScopePicker` 整个方法体替换为：

```objc
- (void)zx_presentPersonalAiDataScopePicker {
    NSString *agentId = [self zx_currentPersonalAiAgentId];
    if (!agentId.length) {
        NSLog(@"[个人AI] DataScope Picker 跳过：agentId 未就绪");
        return;
    }
    ZXWeakSelf;
    // 纯 webview：web 页自己 save（以 getAgentDataRange 为底合并，不冲时间档），
    // 这里只在 ACK 后重拉记忆刷筛选条；取消静默
    [ZXAIAgentManager openDataRangePickerWithAgentId:agentId
                                           accountId:ZXDataInstance.accountModel.accountId
                                           onConfirm:^{
        [weakSelf zx_fetchPersonalAiMemoryForce];
    } onCancel:nil];
}
```

> `accountId` 用本文件既有写法 `ZXDataInstance.accountModel.accountId`（见同文件 `:181`）。
> 为空时照传即可——web 页会回落 `getMyInfo` 拿当前登录用户。

- [ ] **Step 2: 清理不再需要的 import / 无用变量**

若该文件因此不再引用 `ZXPersonalAiPickerController` / `ZXPersonalAiPickerContext`，删掉对应 `#import`。**不要删这两个类本身**——`selectDataRangeScope` 桥入口还在用。

- [ ] **Step 3: 人工构建 + 真机自测**

Xcode clean build 后在真机跑，逐项确认：

1. 筛选条点「数据范围」→ 全屏 webview 打开，导航栏是「← / 选择数据范围 / 涉密」
2. 已选项正确回显（与打开前胶囊一致）
3. 搜索：输入关键字出结果层，勾选后退出搜索，选中态保留
4. 组织架构 tab 可下钻、可勾人
5. 点「确定」→ 页关闭 → 胶囊文案按新选择刷新
6. **时间档与联网搜索不变**（这是本迭代的关键验收点：改数据范围前先设成「自定义」区间 + 开联网搜索，改完再看两者是否还在）
7. 点「取消」或左上返回 → 页关闭，胶囊与记忆均不变
8. 保存失败（可断网模拟）→ 页不关，提示「保存失败，请重试」

- [ ] **Step 4: 提交**

```bash
cd apps/ios && git add SmartMessage/ZX_Modules/ZX_Message/ZX_RCIMMessageChat/ZX_Home/ZX_Controller/ZXRCIMBaseChatController+PersonalAiFilter.m
git commit -m "feat(数据范围): 筛选条入口改为全屏 webview，原生 picker 不再参与该入口"
```

---

### Task 8: 文档收尾

**Files:**
- Modify: `context/bridge.md`
- Modify: `context/features/20260831-数据范围选择改纯webview/status.md`
- Create: `context/features/20260831-数据范围选择改纯webview/impl-notes.md`

**Interfaces:**
- Consumes: Task 1–7 的实际落地结果
- Produces: 无

- [ ] **Step 1: bridge.md 登记方法**

在方法总表里 `selectDateRange` 那行之后加一行：

```markdown
| `reportDataRange` | —（wnsdk `aiChat.reportDataRange` / 安卓 `window.WebView.reportDataRange`） | **web→原生（上报）** | 见下「reportDataRange 上报」 | ios：ACK `{"ok":true}` | ios（安卓待接） | 新增（数据范围选择改纯 webview） |
```

并在「`selectDateRange` 上报」小节之后新增一节：

```markdown
### `reportDataRange` 上报（web → 原生）

筛选条「数据范围」改纯 webview：原生开全屏 webview 加载 `/ai-chat/m/data-range`（`needCode=YES`，
带 userCode 换登录态），**web 页自己 `getAgentDataRange` 取底 + `saveDataRange` 落库**，
只把结果上报给原生，原生据此关页并重拉记忆刷筛选条。

载荷：

```jsonc
{ "type": "data-range:confirm", "ok": true }
{ "type": "data-range:cancel" }
```

| 宿主 | 调用形态 |
|------|---------|
| android | `window.WebView.reportDataRange(JSON.stringify(payload))`（待接） |
| ios | `wnsdk.aiChat.reportDataRange({ ...payload, success, error })`（业务字段**平铺**） |
| PC iframe | `window.parent.postMessage(payload, "*")` |

坑与 `selectDateRange` 完全一致（载荷平铺、非 iOS 不碰 `wnsdk.aiChat`），web 侧判定已提到
`apps/web/src/utils/hostReportBridge.js`，两条链路共用。原生 ACK `code=0`、`result="{\"ok\":true}"`。
```

- [ ] **Step 2: 更新 status.md**

按实际完成情况勾平台矩阵，「待办 / 阻塞」写明：安卓未接、web 移动 Home 老链路未切、iOS 原生 picker 未下线。

- [ ] **Step 3: 写 impl-notes.md**

至少覆盖：
- 为什么 web 落库而不是原生落库（`saveDataRange` 全量写入，少字段就冲掉）
- 为什么页挂 mobile 入口（main 入口拿不到 `extendModule` 注册；`/date-range` 的教训）
- 移动变体三处改动点（`hideClose` + `fullscreen` 壳、自绘导航栏、搜索常驻 + 结果层）
- 真机自测里实际踩到的坑（安全区、键盘顶起、结果层遮挡等）

- [ ] **Step 4: 提交 context 仓库**

```bash
cd /Users/nic/w/ai-dev-workspace
git add -A && git commit -m "docs(20260831-数据范围选择改纯webview): 登记 reportDataRange，沉淀实现笔记"
```

---

## 执行顺序与依赖

```
Task 1（共用桥）─┐
Task 2（AcDialog）─→ Task 3（移动变体）─┐
Task 4（保存纯函数）───────────────────┴→ Task 5（新页）→ Task 6（iOS 桥+开页）→ Task 7（iOS 入口）→ Task 8（文档）
```

Task 1 / 2 / 4 之间无依赖，可并行。

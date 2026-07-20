# 选择AI框 实施计划

> **增量计划（推送刷列表）**：见同目录 [`plan-推送后列表刷新.md`](./plan-推送后列表刷新.md)（规则：`推送后列表刷新规则.md`）。下文为选择弹窗一期原计划，多数任务已完成。

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。

**Goal:** 在 web 端（PC 环境）用 H5 弹窗替代 native 选择 UI，单选一个群/私聊的 AI 框并切换对话（24h 内恢复、超 24h 新建）。

**Architecture:** web 新增 `SelectAiBoxDialog`（AcDialog 壳）+ `OrgPicker`（组织钻取），经 `window.webview.*` 向 apps/desktop 壳取最近联系人/群组/组织架构；选中后复用既有 `personalAiAgentAdapter`（mapSelectionToAgent→upsertSelectedAgent→sortAgents）接入 `PersonalAiChat.vue` 已有链路。desktop 在 `static/plugin/webview.js` 增桥方法、在 `src/renderer/views/main.vue` 增宿主处理。

**Tech Stack:** apps/web — Vue 3 `<script setup>` + UnoCSS（`preset-wind3`）+ AcDialog/AcAvatar/AcGroupAvatar/SvgIcon 全局件 + `.test.mjs`(node) 单测 + `vue-tsc`；apps/desktop — Electron 19 + Vue 2.7 + `static/plugin/webview.js`(preload) + `ipcMain`/`sendToHost`。

## Global Constraints

- **范围**：只改 `apps/web` + `apps/desktop`；android / ios 本期不动。
- **样式（web）**：一律 UnoCSS 原子类，对照 `context/dev-rules/unocss-conventions.mdc` 与 `apps/web/uno.config.js` token（`primary=#3E7EFF` 等）；尺寸 `数字×4px`；严格还原蓝湖稿 `/Users/nic/Downloads/LanhuProject/src/views/lanhu_xuanzeaikuang/index.vue` + 4 张截图；位图图标换 `SvgIcon`。
- **复用**：弹窗壳用全局 `AcDialog`（见 `apps/web/src/components/views/setting/knowledge/ShareTargetDialog.vue` 用法）；头像 `AcAvatar`/`AcGroupAvatar`；选中态 `CheckboxView`/`SvgIcon name="check"`；adapter 用 `apps/web/src/components/views/home/personalAiAgentAdapter.js` 既有函数，勿重写。
- **测试**：web 无前端单测框架，但 adapter 等纯函数有 `.test.mjs`（node 跑）——纯函数（normalize/24h 判定）写 `.test.mjs`；组件靠 `pnpm exec vue-tsc --noEmit` + 壳内手测；desktop 靠 `npm run lint` + 真机。
- **契约**：`context/bridge.md` 是空模板，Task 1 补全；任何桥字段调整同步回 bridge.md + 本功能 impl-notes。
- **注释**：两仓库均要求中文注释。
- **提交**：每任务结束 `git add` 涉及文件并 commit；context/ 文档变更单独 commit（信息 `docs(选择AI框): ...`）；代码变更按仓库各自规范。

## File Structure

**apps/web（新增）**：
- `src/components/views/home/SelectAiBoxDialog.vue` — 弹窗主体（AcDialog 壳 + 三 tab + 搜索 + 单选 + 底部已选/取消/确定）
- `src/components/views/home/OrgPicker.vue` — 组织架构钻取子组件（公司→部门→人员 + 面包屑 + 组织/外联切换）
- `src/components/views/home/useAiBoxPickerData.js` — 取数组合函数（封装 `window.webview.*` 调用 + normalize + mock 开关）

**apps/web（修改）**：
- `src/components/views/home/PersonalAiChat.vue` — 入口接线（PC 用 `SelectAiBoxDialog` 替换 `selectAgentByNative` 调用点；选中结果走既有 adapter 链路）
- `src/components/views/home/personalAiAgentAdapter.js` — 若需补「24h 判定」辅助函数 `shouldResumeConversation(agent)`

**apps/desktop（修改）**：
- `static/plugin/webview.js` — `webview` 对象加 `getMyGroups`/`getOrgCompanies`/`getDeptUsers` 方法 + 回调 `case`；`getRecentContacts` 注释补 `agentName`/`lastChatAt` 字段
- `src/renderer/views/main.vue` — 宿主处理 `get-my-groups`/`get-org-companies`/`get-dept-users` 请求，从 store/service 取数回传；`get-recent-contacts` 处理补 `agentName`/`lastChatAt`

**context（修改/新增）**：
- `context/bridge.md` — 补全协议（Task 1）
- `context/features/20260707-选择AI框/impl-notes.md` — 联调坑记录（各任务随发现补）

---

## Task 1: 补全 bridge.md 桥协议 [多端契约]

**Files:**
- Modify: `context/bridge.md`

**Interfaces:**
- Produces: `window.webview.*` 5 个方法的契约（web 消费方 + desktop 实现方共同依据）

- [ ] **Step 1: 用实际通信机制替换空模板**

把 `context/bridge.md` 的占位（HTML 注释 + YYYY-MM-DD）替换为 desktop 真实机制（来自 `static/plugin/webview.js`）：

```markdown
## 通信机制
| 端 | web → 原生 | 原生 → web |
|----|-----------|-----------|
| desktop | 内嵌 web 调 `window.webview.<method>(...)` → preload `sendToHost(<channel>, params, uuid)` | 宿主 renderer 处理后 `webview.send(channel-with-uuid, result)` → preload 按 uuid resolve |
```

- [ ] **Step 2: 填方法清单**

| method | 方向 | params | 返回 | 端 | 状态 |
|---|---|---|---|---|---|
| `getRecentContacts` | web→原生 | — | `[{accountId/id, name, agentName, avatar, ownerType:'group'\|'private', lastChatAt:number}]` | desktop | 已有，**补 `agentName`+`lastChatAt`** |
| `getMyGroups` | web→原生 | `{type:'organization'\|'outsource', pageNum, pageSize}` | `[{id, name, agentName, avatar, memberCount, groupType:0\|10, lastChatAt}]` | desktop | 新增 |
| `getOrgCompanies` | web→原生 | `{type:'organization'\|'outsource'}` | `[{corpId, name, memberCount, corpType}]`（organization 含「入职企业」「我的下级」分组字段） | desktop | 新增 |
| `getDeptUsers` | web→原生 | `{corpId, pid}` | `{depts:[{id,name,memberCount,pid}], users:[{accountId,name,agentName,avatar}]}` | desktop | 新增 |

`ownerType`/`groupType` 约定沿用 desktop 转发窗（见 `context/platforms/desktop-forward-dialog.md`）：`groupType` 0=组织群/10=外联群。

- [ ] **Step 3: 补 Changelog + 移动端预留**

```markdown
## 版本与兼容
- 老 desktop 壳无 `getMyGroups` 等新方法时，web 端 `useAiBoxPickerData` 捕获异常 → 弹窗提示「请升级到最新版本」。

## Changelog
- 2026-07-07 新增 `getMyGroups`/`getOrgCompanies`/`getDeptUsers`；`getRecentContacts` 补 `agentName`/`lastChatAt`（选择AI框功能）。
- 移动端（`wnsdk.aiChat.*`）对应接口本期不实现，仅预留命名。
```

- [ ] **Step 4: Commit**

```bash
git add context/bridge.md
git commit -m "docs(选择AI框): 补全 bridge.md —— 选择AI框 4 项桥协议"
```

---

## Task 2: desktop 实现 window.webview.* 新桥方法 [desktop]

**Files:**
- Modify: `apps/desktop/static/plugin/webview.js:110-590`（`webview` 对象 + 回调 `case` 表）
- Modify: `apps/desktop/src/renderer/views/main.vue`（宿主处理新 channel）
- Reference: `apps/desktop/static/plugin/webview.js:569`（`getRecentContacts` 现有模式）、`apps/desktop/src/renderer/store/module/groupsModule/`（群组数据）、组织架构接口（`company-dept-user.vue` 用的 `getDeptUserPagelist`）

**Interfaces:**
- Consumes: Task 1 的契约
- Produces: desktop 壳对外暴露 `window.webview.getMyGroups/getOrgCompanies/getDeptUsers`，`getRecentContacts` 返回含 `agentName`/`lastChatAt`

- [ ] **Step 1: webview.js 加 3 个方法（照 `getRecentContacts` 模式）**

在 `static/plugin/webview.js` 的 `getRecentContacts` 后、`refreshApp` 前插入：

```js
  /**
   * 我的群组（组织群/外联群）
   * @param {{type:'organization'|'outsource', pageNum?:number, pageSize?:number}} data
   * @returns {Promise<Array<{id,name,agentName,avatar,memberCount,groupType,lastChatAt}>>}
   */
  getMyGroups(data) {
    return new Promise((resolve, reject) => {
      const uuid = getRandomId();
      registerCallback[uuid] = { resolve, reject };
      sendToHost("get-my-groups", data || {}, uuid);
    });
  },
  /**
   * 组织架构·公司列表
   * @param {{type:'organization'|'outsource'}} data
   */
  getOrgCompanies(data) {
    return new Promise((resolve, reject) => {
      const uuid = getRandomId();
      registerCallback[uuid] = { resolve, reject };
      sendToHost("get-org-companies", data || {}, uuid);
    });
  },
  /**
   * 组织架构·部门与人员（按公司+父部门钻取）
   * @param {{corpId:string, pid:string}} data
   */
  getDeptUsers(data) {
    return new Promise((resolve, reject) => {
      const uuid = getRandomId();
      registerCallback[uuid] = { resolve, reject };
      sendToHost("get-dept-users", data || {}, uuid);
    });
  },
```

- [ ] **Step 2: webview.js 回调 `case` 表加 3 个 channel**

在 `webview.js` 的回调 `switch`（`case "get-recent-contacts":` 所在处，约 89 行）确认 uuid→resolve 机制是否统一分发；若 `get-recent-contacts` 走统一 `trigger-result`/uuid 回调，则新 channel 自动复用，仅需在宿主回传时用相同 channel+uuid 格式。否则补：

```js
    case "get-my-groups":
    case "get-org-companies":
    case "get-dept-users":
      // 按 uuid resolve registerCallback（复制 get-recent-contacts 的 resolve 分支）
```

- [ ] **Step 3: main.vue 宿主处理 3 个 channel**

在 `src/renderer/views/main.vue` 找到处理 `get-recent-contacts` 的监听（`grep -n "get-recent-contacts" src/renderer/views/main.vue`），照其模式新增 3 个 handler。数据源复用 desktop 既有 API：
- `get-my-groups`：`this.$service.groupListApi({accountId, type:0|10, pageNum, pageSize})`（参考 `select-group-list.vue`），每项补 `agentName`（群 AI 框名）+ `lastChatAt`
- `get-org-companies`：组织/外联公司列表（参考 `outsource-group-select` → `organization-list` 的数据源）
- `get-dept-users`：`getDeptUserPagelist({corpId, pid})`（参考 `company-dept-user.vue`），人员项补 `agentName`

```js
// main.vue 内（紧邻 get-recent-contacts 的处理）
async handleGetMyGroups(data) {
  const type = data.type === "outsource" ? 10 : 0;
  const list = await this.$service.groupListApi.call(this, {
    accountId: this.$store.getters.GetUser.id, type,
    pageNum: data.pageNum || 1, pageSize: data.pageSize || 200
  });
  return (list.resultList || []).map(g => ({
    id: g.id, name: g.name, avatar: g.avatar, memberCount: g.groupNumber,
    groupType: g.type, lastChatAt: g.lastChatAt || 0,
    agentName: g.agentName || g.name // 群 AI 框名，按实际字段调整
  }));
}
// get-org-companies / get-dept-users 同理，分别接 organization-list / getDeptUserPagelist
```

> 实现时先 `grep -rn "get-recent-contacts\|getDeptUserPagelist\|groupListApi" src/renderer/` 定位宿主处理点与既有数据 API，复用而非新造。

- [ ] **Step 4: getRecentContacts 补字段**

定位 `main.vue` 里 `get-recent-contacts` 的处理函数，让返回项额外带 `agentName`（单聊取该用户 AI 框名、群聊取群 AI 框名）与 `lastChatAt`（会话最新消息时间，可从 `GetLatestOneMsg` 取）。

- [ ] **Step 5: 验证（真机）**

```bash
cd apps/desktop && npm run lint
npm run dev   # 起壳，在内嵌 AI 框页控制台执行：
# await window.webview.getMyGroups({type:'organization'}) → 群组数组
# await window.webview.getOrgCompanies({type:'organization'}) → 公司数组
# await window.webview.getDeptUsers({corpId:'<某公司>', pid:'0'}) → {depts,users}
# await window.webview.getRecentContacts() → 含 agentName + lastChatAt
```

- [ ] **Step 6: Commit**

```bash
cd apps/desktop
git add static/plugin/webview.js src/renderer/views/main.vue
git commit -m "feat(选择AI框): webview 桥新增 getMyGroups/getOrgCompanies/getDeptUsers，getRecentContacts 补字段"
```

---

## Task 3: web 取数组合函数 useAiBoxPickerData + mock [web]

**Files:**
- Create: `apps/web/src/components/views/home/useAiBoxPickerData.js`
- Create: `apps/web/src/components/views/home/useAiBoxPickerData.test.mjs`

**Interfaces:**
- Consumes: `window.webview.*`（Task 1 契约）
- Produces: `useAiBoxPickerData()` → `{ fetchRecent, fetchGroups(type), fetchCompanies(type), fetchDeptUsers(corpId,pid) }`；纯导出 `normalizeRecentItem`、`shouldResumeConversation`；mock 开关 `USE_MOCK`

- [ ] **Step 1: 写 normalize / 24h 判定的失败测试**

`useAiBoxPickerData.test.mjs`：

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRecentItem, shouldResumeConversation } from "./useAiBoxPickerData.js";

test("normalizeRecentItem 群项 ownerType=group", () => {
  const raw = { id: "g1", name: "群A", agentName: "群助手", avatar: "x", groupType: 0, lastChatAt: 1000 };
  const out = normalizeRecentItem(raw);
  assert.equal(out.ownerType, "group");
  assert.equal(out.id, "g1");
  assert.equal(out.agentName, "群助手");
  assert.equal(out.lastChatAt, 1000);
});

test("normalizeRecentItem 私聊项 ownerType=private", () => {
  const out = normalizeRecentItem({ accountId: "u1", name: "张三", agentName: "张三AI", avatar: "", lastChatAt: 2000 });
  assert.equal(out.ownerType, "private");
  assert.equal(out.id, "u1");
});

test("shouldResumeConversation 24h 内为 true", () => {
  const now = Date.now();
  assert.equal(shouldResumeConversation({ lastChatAt: now - 60 * 60 * 1000 }, now), true);
});

test("shouldResumeConversation 超 24h 为 false", () => {
  const now = Date.now();
  assert.equal(shouldResumeConversation({ lastChatAt: now - 25 * 60 * 60 * 1000 }, now), false);
});

test("shouldResumeConversation 无 lastChatAt 为 false", () => {
  assert.equal(shouldResumeConversation({}, Date.now()), false);
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/web && node --test src/components/views/home/useAiBoxPickerData.test.mjs
```
Expected: FAIL（模块未实现 / 导出缺失）。

- [ ] **Step 3: 实现 useAiBoxPickerData.js**

```js
// 选择AI框弹窗取数 + 归一化。所有 window.webview.* 调用集中于此，便于 mock 与降级。
const HOUR = 60 * 60 * 1000;
const USE_MOCK = false; // 桥不可用时手动改 true 跑 UI

// 最近联系人/群组项归一化成统一形态
export const normalizeRecentItem = (raw) => {
  const isGroup = raw.groupType != null || !!raw.accountInfoList?.length || (!!raw.id && !raw.accountId);
  return {
    id: raw.id || raw.accountId,
    accountId: raw.accountId,
    name: raw.name || raw.userName,
    agentName: raw.agentName || raw.name || raw.userName,
    avatar: raw.avatar,
    ownerType: isGroup ? "group" : "private",
    groupType: raw.groupType,
    lastChatAt: raw.lastChatAt || 0,
    raw
  };
};

// 24h 内有对话 → 恢复；否则新建
export const shouldResumeConversation = (agent, now = Date.now()) =>
  !!agent?.lastChatAt && now - agent.lastChatAt < 24 * HOUR;

// 群组项归一化
const normalizeGroup = (g) => ({
  id: g.id, name: g.name, agentName: g.agentName || g.name,
  avatar: g.avatar, memberCount: g.memberCount, groupType: g.groupType,
  lastChatAt: g.lastChatAt || 0, ownerType: "group", raw: g
});

const mockGroups = (type) => [
  { id: "g1", name: type === "outsource" ? "外联群A" : "组织群A", agentName: "助手A", avatar: "", memberCount: 12, groupType: type === "outsource" ? 10 : 0, lastChatAt: Date.now() - 2 * HOUR }
];
const mockCompanies = () => [{ corpId: "c1", name: "天津美腾科技", memberCount: 553, corpType: "organization" }];
const mockDeptUsers = () => ({
  depts: [{ id: "d1", name: "支持板块", memberCount: 75, pid: "0" }],
  users: [{ accountId: "u1", name: "杜智慧", agentName: "杜智慧AI", avatar: "" }]
});

export const useAiBoxPickerData = () => {
  const call = (method, ...args) => {
    const w = typeof window !== "undefined" ? window.webview : undefined;
    if (!w || typeof w[method] !== "function") {
      return Promise.reject(new Error(`当前环境不支持 ${method}，请升级到最新版本`));
    }
    return w[method](...args);
  };
  return {
    async fetchRecent() {
      if (USE_MOCK) return mockGroups("organization").map(normalizeRecentItem);
      return (await call("getRecentContacts")).map(normalizeRecentItem);
    },
    async fetchGroups(type) {
      if (USE_MOCK) return mockGroups(type).map(normalizeGroup);
      return (await call("getMyGroups", { type })).map(normalizeGroup);
    },
    async fetchCompanies(type) {
      if (USE_MOCK) return mockCompanies();
      return call("getOrgCompanies", { type });
    },
    async fetchDeptUsers(corpId, pid) {
      if (USE_MOCK) return mockDeptUsers();
      return call("getDeptUsers", { corpId, pid });
    }
  };
};
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test src/components/views/home/useAiBoxPickerData.test.mjs
```
Expected: PASS（5 个用例）。

- [ ] **Step 5: 类型检查 + Commit**

```bash
pnpm exec vue-tsc --noEmit
git add src/components/views/home/useAiBoxPickerData.js src/components/views/home/useAiBoxPickerData.test.mjs
git commit -m "feat(选择AI框): 取数组合函数 useAiBoxPickerData + normalize/24h 判定单测"
```

---

## Task 4: SelectAiBoxDialog 弹窗骨架（AcDialog + 三 tab + 单选） [web]

**Files:**
- Create: `apps/web/src/components/views/home/SelectAiBoxDialog.vue`
- Reference: `apps/web/src/components/views/setting/knowledge/ShareTargetDialog.vue`（AcDialog 用法、tab 切换、列表项、底部已选）

**Interfaces:**
- Consumes: `AcDialog`（全局）、`AcAvatar`/`AcGroupAvatar`/`CheckboxView`/`SvgIcon`（全局）、`useAiBoxPickerData`（Task 3）
- Produces: `<SelectAiBoxDialog v-model:open @submit(selection)>`；`selection = { ownerType, id, name, agentName, avatar, lastChatAt }`

- [ ] **Step 1: 写组件骨架（template + 单选状态 + 底部）**

照 `ShareTargetDialog.vue` 的 AcDialog 壳结构，改成**单栏 + 单选**。关键差异：单 `selected`（非数组）、底部「已选：群名 / AI框名」、列表项双行（上行 name、下行 agentName）。

```vue
<template>
  <AcDialog
    title="选择AI框"
    class="!w-690px !h-540px"
    content-class="select-ai-box__content"
    submit-title="确定"
    cancel-title="取消"
    :handleSubmit="onSubmit"
    @close="onClose"
  >
    <template #content>
      <div class="flex flex-col h-full">
        <!-- tab 栏 + 搜索 -->
        <div class="flex items-center gap-4 h-10 shrink-0 border-b border-split px-4">
          <div v-for="t in TABS" :key="t.key"
            class="relative flex items-center self-stretch cursor-pointer text-3.5"
            :class="{ 'text-primary': activeTab === t.key }" @click="activeTab = t.key">
            {{ t.label }}
            <div v-if="activeTab === t.key" class="absolute h-2px w-full bottom-0 bg-primary"></div>
          </div>
          <div class="flex-1"></div>
          <SearchInput v-model="keyword" placeholder="搜索联系人、智能体" />
        </div>
        <!-- 主体 -->
        <div class="flex-1 min-h-0 overflow-y-auto web-scrollbar">
          <AiBoxRow v-for="item in filteredList" v-if="activeTab !== 'org'" :key="item.ownerType+item.id"
            :item="item" :selected="selectedKey===item.ownerType+':'+item.id" @click="onSelect(item)" />
          <OrgPicker v-else :selected-key="selectedKey" :keyword="keyword" @select="onSelect" />
        </div>
      </div>
    </template>
    <template #footer-left>
      <span v-if="selected" class="truncate max-w-320px text-gray-dark text-3">
        已选：{{ selected.name }} / {{ selected.agentName }}
      </span>
    </template>
  </AcDialog>
</template>
```

> `AiBoxRow`/`SearchInput` 用本文件内小组件或独立文件实现（Task 5 抽 AiBoxRow）；`OrgPicker` 是 Task 6 的独立组件，Task 6 完成前临时 `v-if` 隐藏或渲染空。

- [ ] **Step 2: script setup —— 单选状态 + 取数 + 提交**

```js
<script setup>
import { ref, computed, watch } from "vue";
import { useAiBoxPickerData } from "./useAiBoxPickerData.js";

defineProps({ open: Boolean });
const emit = defineEmits(["update:open", "submit"]);

const TABS = [
  { key: "recent", label: "最近联系人" },
  { key: "group", label: "群组" },
  { key: "org", label: "组织架构" }
];
const activeTab = ref("recent");
const keyword = ref("");
const selectedKey = ref(null);
const selected = ref(null);

const data = useAiBoxPickerData();
const recent = ref([]);

const filteredList = computed(() => {
  const list = recent.value;
  const kw = keyword.value.trim();
  return kw ? list.filter((i) => (i.name + i.agentName).includes(kw)) : list;
});

const onSelect = (item) => {
  selectedKey.value = item.ownerType + ":" + item.id;
  selected.value = item;
};
const onSubmit = () => {
  if (!selected.value) return;
  emit("submit", selected.value);
  emit("update:open", false);
};
const onClose = () => emit("update:open", false);

watch(activeTab, async (t) => {
  if (t === "recent" && !recent.value.length) recent.value = await data.fetchRecent().catch(() => []);
}, { immediate: true });
</script>
```

> 群组 tab 的二级切换 + `groupsCache` 在 Task 5 接入；组织架构由 `OrgPicker`（Task 6）自管取数。

- [ ] **Step 3: 视觉还原（UnoCSS）—— 对照蓝湖稿画板 1**

尺寸 `!w-690px !h-540px`；tab 高 40px、列表行高 60px、字号 `text-3.5`；颜色用 `uno.config.js` token（`primary`/`split`/`grayDark`/`grayMedium`/`grayLight`）。`AiBoxRow` 行布局：`CheckboxView` + `AcAvatar`/`AcGroupAvatar`(`!w-10 !h-10`) + 两行（`name` `text-3.5`、`agentName` `text-3 text-gray-medium`）。

- [ ] **Step 4: 类型检查 + 手测（mock）**

```bash
pnpm exec vue-tsc --noEmit
```
临时把 `useAiBoxPickerData.js` 的 `USE_MOCK=true`，在 home 任意处挂 `<SelectAiBoxDialog v-model:open="x" />` 打开，确认：三 tab 切换、最近联系人单选高亮、底部「已选」即时更新、确定 emit。测完改回 `USE_MOCK=false`。

- [ ] **Step 5: Commit**

```bash
git add src/components/views/home/SelectAiBoxDialog.vue
git commit -m "feat(选择AI框): SelectAiBoxDialog 骨架（AcDialog 壳 + 三 tab + 单选）"
```

---

## Task 5: 群组 tab —— 组织群/外联群切换 + AiBoxRow 行 [web]

**Files:**
- Modify: `apps/web/src/components/views/home/SelectAiBoxDialog.vue`（群组 tab 二级切换 + 抽 `AiBoxRow`）

**Interfaces:**
- Consumes: `useAiBoxPickerData.fetchGroups(type)`（Task 3）

- [ ] **Step 1: 群组 tab 加「组织群 / 外联群」切换头**

在 Task 4 的主体区，按 `activeTab` 拆出群组分支（带二级切换）：

```vue
<template v-if="activeTab === 'group'">
  <div class="flex items-center h-9 shrink-0 border-b border-split">
    <button v-for="gt in GROUP_TABS" :key="gt.key"
      class="flex-1 h-full text-3.5"
      :class="groupType === gt.key ? 'text-primary' : 'text-gray-medium'"
      @click="switchGroupType(gt.key)">{{ gt.label }}</button>
  </div>
  <div class="flex-1 overflow-y-auto web-scrollbar">
    <AiBoxRow v-for="item in filteredGroups" :key="item.ownerType+item.id"
      :item="item" :selected="selectedKey===item.ownerType+':'+item.id" @click="onSelect(item)" />
  </div>
</template>
```

```js
const GROUP_TABS = [{ key: "organization", label: "组织群" }, { key: "outsource", label: "外联群" }];
const groupType = ref("organization");
const groupsCache = ref({ organization: [], outsource: [] });
const filteredGroups = computed(() => {
  const list = groupsCache.value[groupType.value] || [];
  const kw = keyword.value.trim();
  return kw ? list.filter((i) => (i.name + i.agentName).includes(kw)) : list;
});
const switchGroupType = async (key) => {
  groupType.value = key;
  if (!groupsCache.value[key].length) {
    groupsCache.value[key] = await data.fetchGroups(key).catch(() => []);
  }
};
```

- [ ] **Step 2: 抽 AiBoxRow 行组件（双行：name + agentName）**

`<AiBoxRow :item :selected @click>` 内部：`CheckboxView(:v=selected)` +（`item.ownerType==='group'` ? `AcGroupAvatar`（有 `accountInfoList` 时）/群头像 : `AcAvatar :user="item"`）+ `div.flex-1 > p.text-3.5.truncate{{item.name}} + p.text-3.text-gray-medium.truncate{{item.agentName}}`（照蓝湖稿画板 1）。

- [ ] **Step 3: 类型检查 + 手测 + Commit**

```bash
pnpm exec vue-tsc --noEmit
git add src/components/views/home/SelectAiBoxDialog.vue
git commit -m "feat(选择AI框): 群组 tab 组织群/外联群切换 + AiBoxRow 行"
```

---

## Task 6: OrgPicker —— 组织架构钻取（公司→部门→人员 + 面包屑） [web]

**Files:**
- Create: `apps/web/src/components/views/home/OrgPicker.vue`
- Reference: `apps/desktop/src/renderer/components/common/group/company-dept-user.vue`、`context/platforms/desktop-forward-dialog.md`

**Interfaces:**
- Consumes: `useAiBoxPickerData.fetchCompanies(type)` / `fetchDeptUsers(corpId,pid)`（Task 3）
- Produces: `<OrgPicker :selected-key :keyword @select(item)>`；人员 `@select` 上抛与其它 tab 同形态 item

- [ ] **Step 1: 组件结构 —— 顶部切换 + 面包屑 + 列表**

```vue
<template>
  <div class="flex flex-col h-full">
    <!-- 组织 / 外联 切换 -->
    <div class="flex items-center h-9 shrink-0 border-b border-split">
      <button v-for="t in SCOPE" :key="t.key" class="flex-1 h-full text-3.5"
        :class="scope===t.key ? (scope==='organization' ? 'text-primary' : 'text-success') : 'text-gray-medium'"
        @click="switchScope(t.key)">{{ t.label }}</button>
    </div>
    <!-- 面包屑（进入公司后显示） -->
    <div v-if="breadcrumb.length" class="flex items-center gap-1 px-4 py-2 bg-gray-light text-3">
      <span v-for="(b,i) in breadcrumb" :key="b.id" class="cursor-pointer"
        :class="i===breadcrumb.length-1 ? 'text-gray-medium' : 'text-primary'" @click="goBack(i)">
        {{ b.name }}<span v-if="i<breadcrumb.length-1"> ›</span>
      </span>
    </div>
    <!-- 列表（搜索时对当前层过滤） -->
    <div class="flex-1 overflow-y-auto web-scrollbar">
      <template v-if="!currentCorp">
        <div v-for="c in viewCompanies" :key="c.corpId"
          class="flex items-center gap-3 px-4 h-12 cursor-pointer hover:bg-gray-100" @click="enterCorp(c)">
          <AcGroupAvatar :accountList="[]" class="!w-8 !h-8" />
          <span class="flex-1 truncate text-3.5">{{ c.name }}</span>
          <span class="text-3 text-gray-medium">{{ c.memberCount }}人</span>
          <SvgIcon name="arrow-right" class="w-3 h-3 text-gray-medium" />
        </div>
      </template>
      <template v-else>
        <div v-for="d in viewDepts" :key="d.id"
          class="flex items-center gap-3 px-4 h-12 cursor-pointer hover:bg-gray-100" @click="enterDept(d)">
          <SvgIcon name="folder" class="w-4 h-4 text-gray-medium" />
          <span class="flex-1 truncate text-3.5">{{ d.name }}</span>
          <span class="text-3 text-gray-medium">{{ d.memberCount }}人</span>
          <SvgIcon name="arrow-right" class="w-3 h-3 text-gray-medium" />
        </div>
        <AiBoxRow v-for="u in viewUsers" :key="u.accountId"
          :item="toItem(u)" :selected="selectedKey==='private:'+u.accountId" @click="$emit('select', toItem(u))" />
      </template>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 钻取状态机**

```js
<script setup>
import { ref, reactive, computed, watch } from "vue";
import { useAiBoxPickerData } from "./useAiBoxPickerData.js";
const props = defineProps({ selectedKey: String, keyword: String });
defineEmits(["select"]);

const SCOPE = [{ key: "organization", label: "选择组织人员" }, { key: "outsource", label: "选择外联人员" }];
const scope = ref("organization");
const data = useAiBoxPickerData();
const companies = ref([]);
const currentCorp = ref(null);
const breadcrumb = ref([]);
const deptUsers = reactive({ depts: [], users: [] });

const toItem = (u) => ({ ownerType: "private", id: u.accountId, accountId: u.accountId, name: u.name, agentName: u.agentName, avatar: u.avatar });
// 搜索：仅过滤当前层
const kw = computed(() => (props.keyword || "").trim());
const viewCompanies = computed(() => kw.value ? companies.value.filter((c) => c.name.includes(kw.value)) : companies.value);
const viewDepts = computed(() => kw.value ? deptUsers.depts.filter((d) => d.name.includes(kw.value)) : deptUsers.depts);
const viewUsers = computed(() => kw.value ? deptUsers.users.filter((u) => (u.name + u.agentName).includes(kw.value)) : deptUsers.users);

const loadCompanies = async () => { companies.value = await data.fetchCompanies(scope.value).catch(() => []); };
const loadDept = async (corpId, pid) => {
  const r = await data.fetchDeptUsers(corpId, pid).catch(() => ({ depts: [], users: [] }));
  deptUsers.depts = r.depts; deptUsers.users = r.users;
};
const enterCorp = async (c) => { currentCorp.value = c; breadcrumb.value = [c]; await loadDept(c.corpId, "0"); };
const enterDept = async (d) => { breadcrumb.value.push(d); await loadDept(currentCorp.value.corpId, d.id); };
const goBack = async (i) => {
  breadcrumb.value = breadcrumb.value.slice(0, i + 1);
  await loadDept(currentCorp.value.corpId, i === 0 ? "0" : breadcrumb.value[i].id);
};
const switchScope = async (key) => { scope.value = key; currentCorp.value = null; breadcrumb.value = []; await loadCompanies(); };
watch(() => scope.value, loadCompanies, { immediate: true });
</script>
```

- [ ] **Step 3: 视觉还原 —— 对照蓝湖稿画板 2/3/4**

公司行（画板 2）：图标 + 公司名 + 人数 + 右箭头；部门行（画板 3）：部门图标 + 名 + 人数 + 右箭头；人员行（画板 4）：单选图标 + 头像 + 名（带 `agentName` 副行）；面包屑（画板 4）：`公司 › 部门 › 子部门`，末级灰、前级蓝、可点。组织=蓝(`primary`)、外联=绿(`success`)，沿用 desktop `company-dept-user` 的 `typeColorMap`。

- [ ] **Step 4: 接回 SelectAiBoxDialog（替换 Task 4 占位）+ 类型检查 + 手测 + Commit**

```bash
pnpm exec vue-tsc --noEmit
git add src/components/views/home/OrgPicker.vue src/components/views/home/SelectAiBoxDialog.vue
git commit -m "feat(选择AI框): OrgPicker 组织架构钻取（公司→部门→人员 + 面包屑 + 组织/外联）"
```

---

## Task 7: 搜索 —— 前端过滤 + 智能体匹配 [web]

**Files:**
- Modify: `apps/web/src/components/views/home/SelectAiBoxDialog.vue`（`SearchInput`）、`OrgPicker.vue`（已接 `keyword`）

**Interfaces:**
- Consumes: Task 4-6 内存列表

- [ ] **Step 1: SearchInput 组件（圆角 + 放大镜 + 清除）**

照蓝湖稿：`input` 圆角满高、左侧 `SvgIcon name="search"`、`placeholder="搜索联系人、智能体"`、`v-model` 双向、有值时右侧清除按钮。

- [ ] **Step 2: 确认过滤覆盖三处**

- 最近联系人：Task 4 `filteredList`（`name + agentName`）
- 群组：Task 5 `filteredGroups`（`name + agentName`）
- 组织架构：Task 6 `viewCompanies`/`viewDepts`/`viewUsers`（当前层）

- [ ] **Step 3: 空态**

`filteredList`/`viewUsers` 等为空且有关键词 → 居中灰字「未搜索到相关结果」（照 `ShareTargetDialog` 的 `nothing` 态）。

- [ ] **Step 4: 类型检查 + 手测 + Commit**

```bash
pnpm exec vue-tsc --noEmit
git add src/components/views/home/SelectAiBoxDialog.vue
git commit -m "feat(选择AI框): 搜索前端过滤（联系人/群/AI框名）+ 空态"
```

---

## Task 8: 入口接线 + 选中后链路接入 + 24h 恢复/新建 [web]

**Files:**
- Modify: `apps/web/src/components/views/home/PersonalAiChat.vue`（入口 + 选中后链路）
- Reference: `apps/web/src/components/views/home/PersonalAiChat.vue:66-68,118,151-160`（现有 adapter 调用点）

**Interfaces:**
- Consumes: `personalAiAgentAdapter.mapSelectionToAgent`/`upsertSelectedAgent`/`sortAgents`、`useAiBoxPickerData.shouldResumeConversation`（Task 3）

- [ ] **Step 1: 定位现有 native 选择入口**

```bash
cd apps/web && grep -nE "selectAiAgent|selectAgentByNative" src/components/views/home/PersonalAiChat.vue src/components/views/home/PersonalAiChatAgentList.vue
```
找到 PC 触发选择的调用点。

- [ ] **Step 2: PC 走 H5 弹窗替换 native 调用**

```js
// PersonalAiChat.vue 内
import { isMobileEnv } from "@/use/useMobileEnv"; // 用现有环境判断；若无则用 tokenBridge
import SelectAiBoxDialog from "./SelectAiBoxDialog.vue";

const pickerOpen = ref(false);
const openAiBoxPicker = () => {
  if (isMobileEnv()) {
    return selectAgentByNative(wnsdk).then(handleSelected); // 移动端本期仍走 native
  }
  pickerOpen.value = true; // PC 走 H5 弹窗
};
const onPickerSubmit = (selection) => handleSelected(selection);
```

模板原「选择 AI 框」按钮 `@click` 改 `openAiBoxPicker`，并挂 `<SelectAiBoxDialog v-model:open="pickerOpen" @submit="onPickerSubmit" />`。

- [ ] **Step 3: 选中后链路（复用 adapter）+ 24h 判定**

```js
import { mapSelectionToAgent, upsertSelectedAgent, sortAgents } from "./personalAiAgentAdapter.js";
import { shouldResumeConversation } from "./useAiBoxPickerData.js";

const handleSelected = (selection) => {
  const agent = mapSelectionToAgent(selection);            // 需求 1.3 出现
  upsertSelectedAgent(agents.value, agent);                // 已存在取消 hidden + 刷 lastChatAt
  agents.value = sortAgents(agents.value);                 // 需求 1.4 定位（个人/置顶/普通）
  switchToAgent(agent, shouldResumeConversation(agent));   // true=恢复最近对话 false=新建
};
```

`switchToAgent` 接 `PersonalAiChat.vue` 既有的「切换当前 agent + 加载对话」函数（grep 定位），`shouldResumeConversation` 为 true 传「恢复历史」、false 传「新会话」。

- [ ] **Step 4: 类型检查 + 手测**

```bash
pnpm exec vue-tsc --noEmit
```
mock 手测：选中一个 mock agent → 列表出现且定位正确 → 切换对话。真壳测（需 Task 2 完成）：24h 内恢复 vs 新建。

- [ ] **Step 5: Commit**

```bash
git add src/components/views/home/PersonalAiChat.vue
git commit -m "feat(选择AI框): PC 入口接 SelectAiBoxDialog + 选中后 upsert/sort/24h 恢复链路"
```

---

## Task 9: 联调 + 视觉还原验收 + impl-notes [多端]

**Files:**
- Modify: `context/features/20260707-选择AI框/impl-notes.md`、`context/features/20260707-选择AI框/status.md`、`context/bridge.md`

- [ ] **Step 1: 端到端联调（真壳）**

`apps/desktop` `npm run dev` + `apps/web` `pnpm dev`，`USE_MOCK=false`。逐项验：
- [ ] 三 tab 切换正常，数据来自 desktop 桥
- [ ] 群组 tab 组织群/外联群切换
- [ ] 组织架构 组织/外联 → 公司 → 部门 → 人员 + 面包屑回溯
- [ ] 搜索：联系人 / AI框名 / 群名
- [ ] 单选高亮、底部「已选」即时
- [ ] 选中后 agent 出现并定位（置顶/非置顶）
- [ ] 24h 内恢复对话、超 24h 新建
- [ ] 视觉对照蓝湖 4 张截图（尺寸/间距/配色/图标）

- [ ] **Step 2: 异常路径**

- [ ] 桥缺失（旧壳）：提示「请升级到最新版本」
- [ ] 取数失败：tab 内「加载失败，点击重试」
- [ ] 空列表/空搜索/空部门：空态文案
- [ ] 未选「确定」禁用

- [ ] **Step 3: 联调坑写入 impl-notes**

把联调中发现的不符（字段缺失、命名差异、宿主返回结构与契约偏差）写入 `impl-notes.md`「联调坑」小节，并回改 `bridge.md`。

- [ ] **Step 4: 更新 status.md 平台矩阵**

按 plan 的 9 个任务 × web/desktop 标注完成状态。

- [ ] **Step 5: Commit（context 仓库）**

```bash
git add context/features/20260707-选择AI框/impl-notes.md context/features/20260707-选择AI框/status.md context/bridge.md
git commit -m "docs(选择AI框): 联调完成 + impl-notes + status 平台矩阵"
```

---

## Self-Review（plan 作者自查）

**Spec 覆盖**：① 选择范围（群+可私聊人员，1:1 全显示）→ Task 4-7 列表 + Task 2 取数；② 24h 恢复/新建 → Task 3 `shouldResumeConversation` + Task 8；③ 出现/定位 → Task 8 `upsert`/`sort`；④ 三 tab → Task 4-6；⑤ 群组组织/外联 → Task 5；⑥ 组织架构钻取 → Task 6；⑦ 搜索 → Task 7；⑧ 视觉还原 → Task 4/5/6/9；⑨ 单选 → Task 4；⑩ bridge.md → Task 1。✓ 无遗漏。

**Placeholder 扫描**：Task 2 的 `grep 定位`、Task 8 的「`switchToAgent` 接既有函数，grep 定位」是对**现存代码**的定位指引（文件已知），非占位；其余步骤含完整代码或明确参照文件。✓

**类型一致**：`selection` 形态（`{ownerType,id,name,agentName,avatar,lastChatAt,...}`）在 Task 3 normalize / Task 4 submit / Task 8 handleSelected 一致；`selectedKey` 统一为 `${ownerType}:${id}`；`shouldResumeConversation` 在 Task 3 定义、Task 8 消费。✓

**范围**：apps/web（Task 3-8）+ apps/desktop（Task 2）+ 多端契约（Task 1/9），android/ios 不涉及。✓

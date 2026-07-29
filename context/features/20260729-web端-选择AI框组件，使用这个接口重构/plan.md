# web 端「选择 AI 框」getAllImDialogue 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC Web「选择 AI 框」弹窗改为一次 `getAllImDialogue(selectModel:1)` 取数，前端搜索与组织群/组织人员单 scope，仅展示有 `agentId` 的项。

**Architecture:** 新建 `aiBoxPickerModel.js` 做归一化/过滤/搜索（与 `dataScopeModel` 分离）；`SelectAiBoxDialog` 开窗拉一次缓存并派生「全部/群组」；`AiBoxSearchPanel` 改为接收候选列表本地过滤；`OrgPicker` 通过 prop 关闭外联并过滤无 agent，避免误伤数据来源弹窗。

**Tech Stack:** Vue 3、UnoCSS、现有 `getAllImDialogue` axios 封装、`node --test`。

## Global Constraints

- 仅改 **web** PC「选择 AI 框」路径；不改 `SelectDataRangeDialog` 的 `selectModel: 0` 逻辑。
- `selectModel` 固定传 **1**。
- 列表顺序保持后端返回顺序，前端不排序。
- 无 `agentId` 的项不进入「全部/群组/搜索」；OrgPicker 在 `requireAgent` 时同样不展示。
- 群组顶层 tab 只展示组织群（`groupInfo.type < 10` 或缺失）；搜索「群组」可含外联（同源缓存）。
- 子 tab / Org scope 可选项长度为 1 时隐藏切换条。
- 中文 commit message。

---

## File Structure

| 文件 | 职责 |
|------|------|
| `apps/web/.../picker/aiBoxPickerModel.js` | 新建：归一化、agent 过滤、组织群派生、关键词过滤 |
| `apps/web/.../tests/aiBoxPickerModel.test.mjs` | 新建：纯逻辑单测 |
| `apps/web/.../picker/SelectAiBoxDialog.vue` | 改：取数、tab 文案、隐藏群子 tab |
| `apps/web/.../picker/search/AiBoxSearchBox.vue` | 改：把 candidates 传给 Panel |
| `apps/web/.../picker/search/AiBoxSearchPanel.vue` | 改：本地过滤，不再调 `searchPicker` |
| `apps/web/.../picker/OrgPicker.vue` | 改：`hideOutsource` / `requireAgent` props |
| `apps/web/.../picker/useAiBoxPickerData.js` | 改：可选增加 `fetchAllImDialogueForPicker`，或 Dialog 直接调 server |
| `apps/web/src/server/module/personalAiFrame.js` | 改：注释补 selectModel:1 用途 |
| `context/contracts/personalAiFrame/getAllImDialogue.d.ts` | 改：Changelog 追加本消费方 |

---

### Task 1: 契约 Changelog（多端文档 / web 消费）

**Files:**
- Modify: `context/contracts/personalAiFrame/getAllImDialogue.d.ts`
- Modify: `apps/web/src/server/module/personalAiFrame.js`（注释）

**Interfaces:**
- Produces: 文档声明 `selectModel: 1` 用于「选择 AI 框」弹窗

- [ ] **Step 1: 更新契约 Changelog**

在文件头 Changelog 追加一条：

```
 * - 2026-07-29 新增消费方：web「选择 AI 框」弹窗（selectModel 传 1）。
 *   前端再过滤无 agentId 的项；忽略 selected 字段作为弹窗选中态。
```

- [ ] **Step 2: 更新 server 模块注释**

将 `getAllImDialogue` 注释改为同时覆盖 selectModel 0（数据来源）与 1（选择 AI 框）。

- [ ] **Step 3: Commit（context + 若 web 注释同批可后置到 web 提交）**

```bash
git -C /Users/nic/w/ai-dev-workspace add context/contracts/personalAiFrame/getAllImDialogue.d.ts
git -C /Users/nic/w/ai-dev-workspace commit -m "$(cat <<'EOF'
docs(contract): getAllImDialogue 注明选择AI框 selectModel=1

EOF
)"
```

---

### Task 2: 纯逻辑模型 + 单测（web）

**Files:**
- Create: `apps/web/src/components/views/personal-ai/picker/aiBoxPickerModel.js`
- Create: `apps/web/src/components/views/personal-ai/tests/aiBoxPickerModel.test.mjs`

**Interfaces:**
- Produces:
  - `normalizeAiBoxDialogueList(rawList) → AiBoxItem[]`
  - `orgGroupsOnly(items) → AiBoxItem[]`
  - `filterAiBoxByKeyword(items, keyword) → AiBoxItem[]`
  - `splitAiBoxSearchBuckets(items) → { users, groups }`

`AiBoxItem` 形状（最小集）：

```js
{
  id: string,
  accountId?: string, // 私聊时 = id
  name: string,
  agentName: string | null,
  agentAvatar: string | null,
  agentId: string,
  aiRoleId: string | null,
  avatar: string,
  accountInfoList: array,
  ownerType: 'private' | 'group',
  isOutreach: boolean,
  lastChatAt: number, // 用 activeTime，缺省 0
  raw: object
}
```

- [ ] **Step 1: 写失败单测**

`aiBoxPickerModel.test.mjs` 至少覆盖：

1. 丢弃无 `targetId`、无 `agentId`
2. 私聊映射 `ownerType:'private'`，带头像与 agent 字段
3. 群 `groupInfo.type>=10` → `isOutreach:true`；`<10` 或缺失 → false
4. `orgGroupsOnly` 只留非外联群
5. `filterAiBoxByKeyword` 匹配 `name` 或 `agentName`，忽略大小写；空关键字返回原数组
6. `splitAiBoxSearchBuckets` 按 ownerType 拆分且保持相对顺序

- [ ] **Step 2: 跑测确认失败**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/aiBoxPickerModel.test.mjs
```

Expected: FAIL（模块不存在或断言失败）

- [ ] **Step 3: 实现 `aiBoxPickerModel.js`**

```js
export const normalizeAiBoxDialogueList = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.targetId ?? '');
    if (!id) continue;
    const agentId = raw.agentId == null ? '' : String(raw.agentId);
    if (!agentId) continue;
    const isGroup = Number(raw.type) === 3;
    const isOutreach = isGroup && Number(raw.groupInfo?.type) >= 10;
    // ... 填齐 AiBoxItem，name = raw.targetName ?? ''
    out.push(/* ... */);
  }
  return out;
};

export const orgGroupsOnly = (items) =>
  (items || []).filter((it) => it?.ownerType === 'group' && !it.isOutreach);

export const filterAiBoxByKeyword = (items, keyword) => {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return items || [];
  return (items || []).filter((it) => {
    const n = String(it?.name || '').toLowerCase();
    const a = String(it?.agentName || '').toLowerCase();
    return n.includes(kw) || a.includes(kw);
  });
};

export const splitAiBoxSearchBuckets = (items) => {
  const users = [];
  const groups = [];
  for (const it of items || []) {
    if (it?.ownerType === 'group') groups.push(it);
    else users.push(it);
  }
  return { users, groups };
};
```

- [ ] **Step 4: 跑测确认通过**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/aiBoxPickerModel.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit（apps/web）**

```bash
cd apps/web && git add src/components/views/personal-ai/picker/aiBoxPickerModel.js \
  src/components/views/personal-ai/tests/aiBoxPickerModel.test.mjs && \
git commit -m "$(cat <<'EOF'
feat(personal-ai): 选择AI框对话列表纯逻辑模型

EOF
)"
```

---

### Task 3: 搜索 popover 改本地过滤（web）

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/search/AiBoxSearchPanel.vue`
- Modify: `apps/web/src/components/views/personal-ai/picker/search/AiBoxSearchBox.vue`

**Interfaces:**
- Consumes: `filterAiBoxByKeyword`, `splitAiBoxSearchBuckets`
- Produces: Panel props 增加 `candidates: Array`（默认 `[]`）

- [ ] **Step 1: `AiBoxSearchBox` 增加 `candidates` prop 并下传**

```js
candidates: { type: Array, default: () => [] }
```

模板里传给 `AiBoxSearchPanel`。

- [ ] **Step 2: 改写 `AiBoxSearchPanel.runSearch`**

去掉对 `useAiBoxPickerData().searchPicker` 的调用；改为：

```js
const filtered = filterAiBoxByKeyword(props.candidates, kw);
const { users: u, groups: g } = splitAiBoxSearchBuckets(filtered);
users.value = u;
groups.value = g;
```

空 keyword → `clearResult`；无网络 loading 可瞬时结束（可保留极短 loading=false）。错误态仅在无 candidates 且父级标记失败时可选——最小实现：无匹配走「未搜索到相关结果」。

- [ ] **Step 3: 确认 `AiBoxSearchRow` 已对 `name`/`agentName` 做 `highlightKeyword`（无需改）**

- [ ] **Step 4: Commit（apps/web）**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): 选择AI框搜索改为前端本地过滤

EOF
)"
```

---

### Task 4: SelectAiBoxDialog 换数据源 + 隐藏群子 tab（web）

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/SelectAiBoxDialog.vue`

**Interfaces:**
- Consumes: `getAllImDialogue`、`normalizeAiBoxDialogueList`、`orgGroupsOnly`
- Consumes: `user` from `@/loginUtil`

- [ ] **Step 1: Tab 文案**

```js
const TABS = [
  { key: 'recent', label: '全部' }, // key 可保留 recent 以减少无关 diff
  { key: 'group', label: '群组' },
  { key: 'org', label: '组织架构' }
];
```

- [ ] **Step 2: 开窗取数**

```js
import { getAllImDialogue } from '@/server/module/personalAiFrame.js';
import { user } from '@/loginUtil';
import { normalizeAiBoxDialogueList, orgGroupsOnly } from './aiBoxPickerModel.js';

const allItems = ref([]); // 归一化后全量（已滤 agentId）
const orgGroups = computed(() => orgGroupsOnly(allItems.value));
const currentList = computed(() =>
  activeTab.value === 'recent' ? allItems.value : orgGroups.value
);

// open watcher：
const accountId = String(user.value?.id || '');
if (!accountId) { /* 空态提示 */ return; }
const list = await getAllImDialogue({ accountId, selectModel: 1 });
allItems.value = normalizeAiBoxDialogueList(list);
```

去掉 `data.fetchRecent` / `data.fetchGroups` / `groupsCache` / `GROUP_TABS` 切换逻辑。

- [ ] **Step 3: 群子 tab UI**

`GROUP_TABS` 改为仅组织群一项，或删除子 tab 区块。因仅一项，按 spec：**不渲染**子 tab 条。

- [ ] **Step 4: 搜索接入**

```vue
<AiBoxSearchBox
  v-model="keyword"
  :candidates="allItems"
  ...
/>
```

- [ ] **Step 5: OrgPicker 传开关**

```vue
<OrgPicker
  :selected-key="selectedKey"
  hide-outsource
  require-agent
  @select="onSelect"
/>
```

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): 选择AI框改用 getAllImDialogue(selectModel=1)

EOF
)"
```

---

### Task 5: OrgPicker prop 化（web，兼容数据来源）

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/OrgPicker.vue`
- 确认: `SelectDataRangeDialog.vue` **不传**新 prop（保持外联 + 不强制 agent）

**Interfaces:**
- Produces props:
  - `hideOutsource: Boolean`（默认 false）
  - `requireAgent: Boolean`（默认 false）

- [ ] **Step 1: 可见 SCOPE**

```js
const SCOPE_ALL = [
  { key: 'organization', label: '选择组织人员' },
  { key: 'outsource', label: '选择外联人员' }
];
const visibleScope = computed(() =>
  props.hideOutsource
    ? SCOPE_ALL.filter((t) => t.key === 'organization')
    : SCOPE_ALL
);
```

模板：`v-if="visibleScope.length > 1"` 包住 scope 条；`v-for="t in visibleScope"`。

- [ ] **Step 2: `requireAgent` 过滤人员**

```js
const viewUsers = computed(() => {
  const list = deptUsers.users;
  if (!props.requireAgent) return list;
  return list.filter((u) => u.agentId);
});
```

`enrichAccountsWithBatchAgents` 之后依赖 `agentId` 字段（确认 enrich 已写入）。

- [ ] **Step 3: `hideOutsource` 时固定 `scope='organization'`，勿再 watch 外联**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(personal-ai): OrgPicker 支持隐藏外联并过滤无智能体

EOF
)"
```

---

### Task 6: 联调自测清单（web）

**Files:** 无强制代码；更新本功能 `status.md`

- [ ] **Step 1: 抓包 / 行为核对**

必须：

1. 打开弹窗仅一次 `getAllImDialogue`，body 含 `selectModel: 1`
2. 搜索打字无 `selectGroupBySearch` 请求
3. 「全部」无外联子 tab；「群组」无组织/外联子 tab 条
4. 组织架构无「选择外联人员」条
5. 搜索命中智能体名并高亮；全部/群组/人员三 tab 可用
6. 无 `agentId` 的组织人员不出现
7. 确定提交项仍含 `agentId` / `aiRoleId` 等，下游开聊正常

回归：

8. 数据来源弹窗仍可切外联群/外联人员（未传新 prop）

- [ ] **Step 2: 更新 status 矩阵「接口联调 / 自测」格**

- [ ] **Step 3: 若联调发现契约偏差 → 先改契约 Changelog，再改代码，并写 `impl-notes.md`**

---

## Spec coverage（self-review）

| Spec 要求 | Task |
|-----------|------|
| selectModel:1 一次取数 | 4 |
| 「全部」文案 + 全量有 agent 项 | 2+4 |
| 群组仅组织群、隐藏单 tab | 4 |
| 前端搜索 + 智能体名高亮 + 三 tab | 2+3 |
| OrgPicker 藏外联 + 无 agent 不展示 + prop 兼容 | 5 |
| 契约 Changelog | 1 |
| 忽略 selected / 打开未选中 | 4（保持现逻辑） |
| 不改 DataRange | 5 默认 prop |

无 TBD 占位。类型名 `AiBoxItem` / 函数名在 Task 2–4 一致。

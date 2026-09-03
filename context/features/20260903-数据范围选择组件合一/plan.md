# 数据范围选择组件合一 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `SelectDataRangeDialog.vue` / `SelectDataRangePopup.vue` 两份平行实现收敛成一套逻辑 + 一套内容区组件，新增或修改 tab 只写一处，两端交互与视觉不变。

**Architecture:** 逻辑全部搬进 `useDataRangePicker.js`（依赖注入，纯 JS 可被 `node --test` 直接跑）；UI 拆成 4 个共用组件，`variant="pc" | "mobile"` 控形态差异；两个壳只剩容器、按钮与初始化时机。壳创建 picker 实例后以 prop 传给各共用组件，避免 provide/inject 的隐式耦合。

**Tech Stack:** Vue 3 `<script setup>` + Composition API、UnoCSS 原子类、Element Plus（`el-popover`）、`node --test`（`.mjs`）、`vue-tsc` 类型检查。

## Global Constraints

- 仓库：`apps/web`，分支 `feat/data-range-week-work`（当前分支，勿新开）
- 注释一律中文；不引入 Pinia/Vuex；不整包 import 组件库
- **不改** `dataScopeModel.js`、`weekWorkModel.js`、`dataRangeSavePayload.js`、`OrgPicker.vue`、`WeekWorkPicker.vue`、`AiBoxVirtualList.vue`、`AiBoxRow.vue`、`StorageRow.vue` 的实现
- **可被 `node --test` 直接 import 的文件里禁止出现 `@/` 别名**（node 不解析 vite alias）。`useDataRangePicker.js` 因此走依赖注入，接口取数由壳注入
- 新文件全部落在 `apps/web/src/components/views/personal-ai/picker/dataRange/`，单测落 `apps/web/src/components/views/personal-ai/picker/tests/`
- 每个任务结束前跑 `pnpm exec vue-tsc --noEmit`（exit 0）与 `pnpm format`
- 提交信息用 `refactor(选择数据范围): …`，每个任务一次提交

## 文件结构

| 文件 | 职责 |
|---|---|
| `dataRange/tabs.js`（新建） | `SCOPE_TABS` / `TABS` / `LIST_TABS` / `FALLBACK_SECRET_TIP` 四个常量，现在两个壳各一份 |
| `dataRange/useDataRangePicker.js`（新建） | 全部状态、派生与行为；`init()` 拉候选与涉密文案；依赖注入 |
| `dataRange/DataRangeScopeTabs.vue`（新建） | 一级 tab 条（知识、聊天 / 周工作）。PC 放 `AcDialog #custom-header`，移动放自绘 header —— 位置由壳决定，标记不再写两遍 |
| `dataRange/DataRangeSecretTip.vue`（新建） | 涉密说明气泡（`el-popover` + 触发按钮），`placement` / `width` 按 variant |
| `dataRange/DataRangeSelectedBar.vue`（新建） | 已选计数 + chip 弹层 + 清空按钮 |
| `dataRange/DataRangeBody.vue`（新建） | 内容区：二级 tabs、搜索入口（variant 分支）、三级胶囊、表头全选、虚拟列表、`OrgPicker`、`WeekWorkPicker` 挂载、移动整屏搜索层 |
| `SelectDataRangeDialog.vue`（改） | 只剩 `AcDialog` 容器 + 三个 slot 装配 + `watch(props.open)` 调 `init()` |
| `SelectDataRangePopup.vue`（改） | 只剩 `XPopup` 容器 + 自绘 header/footer + `onMounted` 调 `init()` |
| `tests/useDataRangePicker.test.mjs`（新建） | composable 单测，注入假接口 |

**与 spec 的两处修订**（spec 已同步）：

1. 一级 tab **不搬进内容区**，改抽成 `DataRangeScopeTabs.vue` 由壳放在各自的 header 位置。既只写一次，又零视觉变动 —— spec 里「PC 放弃 custom-header、需目视回归」的取舍作废。
2. 初始化时机**不统一到 `onMounted`**：PC 壳 `watch(props.open)` 调 `picker.init()`，移动壳 `onMounted` 调。composable 实例在壳里创建（要同时喂给 body 与 selected-bar），所以时机留在壳里，各 3 行。

---

### Task 1: useDataRangePicker 逻辑收敛

**Files:**
- Create: `apps/web/src/components/views/personal-ai/picker/dataRange/useDataRangePicker.js`
- Test: `apps/web/src/components/views/personal-ai/picker/tests/useDataRangePicker.test.mjs`
- Read (搬迁来源，勿改): `apps/web/src/components/views/personal-ai/picker/SelectDataRangeDialog.vue:336-939`

**Interfaces:**
- Consumes: `../dataScopeModel.js`（`SCOPE_TYPE_PRIVATE` `SCOPE_TYPE_GROUP` `makeKey` `normalizeAllImDialogue` `deriveRecentDialogues` `toggleStorageSelection` `computeStorageStates` `buildSaveScopes` `dialogueKeysFromScopes` `computeCandidateCounts` `computeSelectAllFlags`）、`../weekWorkModel.js`（`isWeekWorkKey` `isCountableWeekWorkKey`）、`./tabs.js` 的 `FALLBACK_SECRET_TIP`
- Produces: `useDataRangePicker({ props, deps })`，返回下表全部字段。Task 2-6 只认这份清单。

```js
// 入参
// props: 壳的 props 对象（需含 accountId / initialScopes / autoSelectAll 三个字段）
// deps:  { getAllImDialogue, getSecretButtonTip } —— 壳注入的真实接口函数
//
// 返回（state 为 ref/shallowRef，computed 为只读 computed）：
// state:    scopeTab activeTab listTab popoverGroup keyword selectedPopoverVisible
//           expandedStorages searchFocused selectedKeySet extraSelected
//           weekWorkKeySet weekWorkExtra dialogueItems storages topLevelEntries
//           dialogueByKey dialogueLoading dialogueError secretTipText
// computed: selectedItems weekWorkSelectedItems knowledgeCount weekWorkCount selectedCount
//           selectedKeysForOrg selectedKeysForSearch searchCandidates
//           candidateCounts dialogCount storageCount orgSecretTagLookup memberKeySet
//           storageStateMap displayList emptyText listResetKey
//           currentSelectableKeys currentPartitionState allCurrentSelected halfCurrentSelected
// methods:  onSearchFocus onWeekWorkKeys onWeekWorkExtra removeWeekWorkKey
//           toggleItem removeItem clearAll selectAllItems toggleStorage toggleExpand
//           toggleSelectAllCurrent onSearchSelect
//           init() resetTransient() buildSubmitPayload()
```

三个新方法的语义（原来散在两个壳里）：

- `init()`：重置全部 state（tab 回 `knowledge`/`dialogue`/`all`、清空选中与候选、`initSelectionFromMemory()` 回显）、拉 `getSecretButtonTip()`（失败静默回退 `FALLBACK_SECRET_TIP`）、`accountId` 为空则置 `dialogueError = "accountId 未就绪"` 并返回，否则 `getAllImDialogue({ accountId, selectModel: 0 })` → `normalizeAllImDialogue` → `applyDialogueItems`，`props.autoSelectAll` 为真时再 `selectAllItems()`；失败置 `dialogueError = "会话列表加载失败"`
- `resetTransient()`：清 `keyword`、`searchFocused`、`selectedPopoverVisible`（壳关闭时调）
- `buildSubmitPayload()`：`{ scopes: buildSaveScopes(storages, [...selectedKeySet]), flags: (dialogueError || dialogueLoading) ? null : computeSelectAllFlags(dialogueItems, [...selectedKeySet]) }`

- [ ] **Step 1: 写失败的测试**

创建 `apps/web/src/components/views/personal-ai/picker/tests/useDataRangePicker.test.mjs`：

```js
import test from "node:test";
import assert from "node:assert/strict";
import { useDataRangePicker } from "../dataRange/useDataRangePicker.js";

/** 造一份最小候选清单：2 私聊 + 1 群 + 1 收纳组（组内含 p2） */
const rawDialogue = () => [
  { scopeDataType: 1, scopeDataId: "p1", name: "张三", activeTime: 300 },
  { scopeDataType: 1, scopeDataId: "p2", name: "李四", activeTime: 200 },
  { scopeDataType: 3, scopeDataId: "g1", name: "项目群", activeTime: 100 },
  {
    scopeDataType: 4,
    scopeDataId: "s1",
    name: "收纳组A",
    children: [{ scopeDataType: 1, scopeDataId: "p2", name: "李四" }]
  }
];

const makePicker = (over = {}) => {
  const props = {
    accountId: "280",
    initialScopes: [],
    autoSelectAll: false,
    ...over.props
  };
  const deps = {
    getAllImDialogue: async () => rawDialogue(),
    getSecretButtonTip: async () => "涉密提示",
    ...over.deps
  };
  return useDataRangePicker({ props, deps });
};

test("init 拉候选并归一化，涉密文案落到 secretTipText", async () => {
  const p = makePicker();
  await p.init();
  assert.ok(p.dialogueItems.value.length >= 3);
  assert.equal(p.dialogueError.value, "");
  assert.equal(p.secretTipText.value, "涉密提示");
});

test("accountId 为空时不取数，报 accountId 未就绪", async () => {
  const p = makePicker({ props: { accountId: "" } });
  await p.init();
  assert.equal(p.dialogueError.value, "accountId 未就绪");
  assert.equal(p.dialogueItems.value.length, 0);
});

test("initialScopes 回显进 selectedKeySet，收纳组 type=4 被过滤", async () => {
  const p = makePicker({
    props: {
      initialScopes: [
        { scopeDataType: 1, scopeDataId: "p1" },
        { scopeDataType: 4, scopeDataId: "s1" }
      ]
    }
  });
  await p.init();
  assert.ok(p.selectedKeySet.value.has("1_p1"));
  assert.equal(p.selectedKeySet.value.has("4_s1"), false);
});

test("autoSelectAll 在候选就绪后全选", async () => {
  const p = makePicker({ props: { autoSelectAll: true } });
  await p.init();
  assert.equal(p.selectedKeySet.value.size, p.dialogueItems.value.length);
});

test("toggleItem 增删，计数同步", async () => {
  const p = makePicker();
  await p.init();
  p.toggleItem({ scopeDataType: 1, scopeDataId: "p1", name: "张三" });
  assert.equal(p.knowledgeCount.value, 1);
  p.toggleItem({ scopeDataType: 1, scopeDataId: "p1", name: "张三" });
  assert.equal(p.knowledgeCount.value, 0);
});

test("表头全选只作用于当前分区，再点一次取消", async () => {
  const p = makePicker();
  await p.init();
  p.toggleSelectAllCurrent();
  assert.equal(p.allCurrentSelected.value, true);
  assert.ok(p.knowledgeCount.value > 0);
  p.toggleSelectAllCurrent();
  assert.equal(p.knowledgeCount.value, 0);
});

test("部分选中时表头为半选", async () => {
  const p = makePicker();
  await p.init();
  p.toggleItem({ scopeDataType: 1, scopeDataId: "p1", name: "张三" });
  assert.equal(p.allCurrentSelected.value, false);
  assert.equal(p.halfCurrentSelected.value, true);
});

test("周工作 key 计入 selectedCount，removeWeekWorkKey 移除", async () => {
  const p = makePicker();
  await p.init();
  p.onWeekWorkKeys(new Set(["ww_2_d1"]));
  p.onWeekWorkExtra([{ key: "ww_2_d1", name: "研发部", kind: "dept" }]);
  const total = p.selectedCount.value;
  assert.equal(total, p.knowledgeCount.value + p.weekWorkCount.value);
  p.removeWeekWorkKey("ww_2_d1");
  assert.equal(p.weekWorkCount.value, 0);
});

test("clearAll 清空两组选中并关掉已选弹层", async () => {
  const p = makePicker();
  await p.init();
  p.toggleItem({ scopeDataType: 1, scopeDataId: "p1", name: "张三" });
  p.onWeekWorkKeys(new Set(["ww_2_d1"]));
  p.selectedPopoverVisible.value = true;
  p.clearAll();
  assert.equal(p.selectedCount.value, 0);
  assert.equal(p.selectedPopoverVisible.value, false);
});

test("buildSubmitPayload 正常态给出 scopes 与 flags", async () => {
  const p = makePicker();
  await p.init();
  p.toggleSelectAllCurrent();
  const { scopes, flags } = p.buildSubmitPayload();
  assert.ok(Array.isArray(scopes) && scopes.length > 0);
  assert.notEqual(flags, null);
});

test("取数失败时 flags 为 null（未知态）", async () => {
  const p = makePicker({
    deps: {
      getAllImDialogue: async () => {
        throw new Error("boom");
      }
    }
  });
  await p.init();
  assert.equal(p.dialogueError.value, "会话列表加载失败");
  assert.equal(p.buildSubmitPayload().flags, null);
});

test("resetTransient 清关键字与弹层，不动选中", async () => {
  const p = makePicker();
  await p.init();
  p.toggleItem({ scopeDataType: 1, scopeDataId: "p1", name: "张三" });
  p.keyword.value = "张";
  p.searchFocused.value = true;
  p.selectedPopoverVisible.value = true;
  p.resetTransient();
  assert.equal(p.keyword.value, "");
  assert.equal(p.searchFocused.value, false);
  assert.equal(p.selectedPopoverVisible.value, false);
  assert.equal(p.knowledgeCount.value, 1);
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd apps/web && node --test src/components/views/personal-ai/picker/tests/useDataRangePicker.test.mjs
```

预期：`ERR_MODULE_NOT_FOUND`，找不到 `../dataRange/useDataRangePicker.js`。

- [ ] **Step 3: 建 tabs.js**

创建 `apps/web/src/components/views/personal-ai/picker/dataRange/tabs.js`，内容逐字取自 `SelectDataRangeDialog.vue:336-337,378-394`：

```js
/** 选择数据范围的三层 tab 常量与兜底文案（PC 壳与移动壳共用） */

/** 一级入口 */
export const SCOPE_TABS = [
  { key: "knowledge", label: "知识、聊天" },
  { key: "weekly", label: "周工作" }
];

/** 二级 tab。对话列表为默认入口：私聊+群聊+收纳组 */
export const TABS = [
  { key: "dialogue", label: "对话列表" },
  { key: "recent", label: "最近" },
  { key: "org", label: "组织架构" }
];

/**
 * 「对话列表」下的三级分区。key 与 splitGroups 无关
 * （旧「群组」入口已去掉，群聊统一进入「全部」分区，含组织群/外联群）
 */
export const LIST_TABS = [
  { key: "all", label: "全部" },
  { key: "storage", label: "收纳组" }
];

/** 涉密气泡兜底文案：getSecretButtonTip 失败或返回空串时用 */
export const FALLBACK_SECRET_TIP =
  "人力部门人员、公司全员群，聊天记录与文件涉密，不参与AI分析";
```

- [ ] **Step 4: 建 useDataRangePicker.js**

创建 `apps/web/src/components/views/personal-ai/picker/dataRange/useDataRangePicker.js`。

搬迁规则 —— **逐字搬 `SelectDataRangeDialog.vue:336-939` 的实现，只做下面 6 处适配**，其余（含全部中文注释）原样保留：

1. 文件头 `import { ref, shallowRef, computed } from "vue";` + `import { ... } from "../dataScopeModel.js";` + `import { isWeekWorkKey, isCountableWeekWorkKey } from "../weekWorkModel.js";` + `import { FALLBACK_SECRET_TIP } from "./tabs.js";`。**不要** import `@/server/module/personalAiFrame.js`（node 不解析别名），接口从 `deps` 拿。
2. 外层包一层 `export function useDataRangePicker({ props, deps }) { … return { … } }`。
3. 删掉 `dialogVisible`（壳的事）、`SCOPE_TABS` / `TABS` / `LIST_TABS`（移到 `tabs.js`）。
4. 原 `watch(() => props.open, …)` 的 body 拆成 `init()`（打开分支）与 `resetTransient()`（关闭分支），watch 本身不搬 —— 由壳决定何时调。
5. 原 `onSubmit` 改名 `buildSubmitPayload()`，只返回 `{ scopes, flags }`，不 emit。
6. `getAllImDialogue` / `getSecretButtonTip` 一律写成 `deps.getAllImDialogue(...)` / `deps.getSecretButtonTip()`；`console.warn` 前缀统一成 `[useDataRangePicker]`。

`watch(selectedPopoverVisible, …)`（`SelectDataRangeDialog.vue:495-506`，展开已选弹层时自动选中有内容的那一组）照搬进来，它是逻辑不是形态。

结尾 `return` 出「Interfaces」里列的全部字段，一个不漏 —— 后面 4 个组件按名取用。

- [ ] **Step 5: 跑测试确认通过**

```bash
cd apps/web && node --test src/components/views/personal-ai/picker/tests/useDataRangePicker.test.mjs
```

预期：`pass 12 / fail 0`。

- [ ] **Step 6: 类型检查 + 格式化 + 提交**

```bash
cd apps/web && pnpm format && pnpm exec vue-tsc --noEmit
git add src/components/views/personal-ai/picker/dataRange/ src/components/views/personal-ai/picker/tests/useDataRangePicker.test.mjs
git commit -m "refactor(选择数据范围): 抽出 useDataRangePicker 与 tabs 常量"
```

`vue-tsc` 预期 exit 0。**此时两个壳还没接入，不会有行为变化。**

---

### Task 2: 一级 tab 条与涉密气泡两个共用小件

**Files:**
- Create: `apps/web/src/components/views/personal-ai/picker/dataRange/DataRangeScopeTabs.vue`
- Create: `apps/web/src/components/views/personal-ai/picker/dataRange/DataRangeSecretTip.vue`
- Read: `SelectDataRangeDialog.vue:16-32,169-192`、`SelectDataRangePopup.vue:16-52`

**Interfaces:**
- Consumes: Task 1 的 `tabs.js#SCOPE_TABS`
- Produces:
  - `<DataRangeScopeTabs v-model="picker.scopeTab" :variant="'pc'|'mobile'" />`
  - `<DataRangeSecretTip :text="picker.secretTipText" :variant="'pc'|'mobile'" />`

无单测：两者是纯展示组件，无逻辑分支可测，验收靠 Task 5/6 的目视清单。

- [ ] **Step 1: 写 DataRangeScopeTabs.vue**

```vue
<template>
  <!-- 一级入口：知识、聊天 / 周工作。PC 挂 AcDialog #custom-header，移动挂自绘 header -->
  <div class="flex items-center gap-5 select-none" :class="variant === 'pc' ? 'h-12' : 'min-w-0'">
    <div
      v-for="s in SCOPE_TABS"
      :key="s.key"
      class="relative flex items-center self-stretch cursor-pointer text-3.5"
      :class="[
        modelValue === s.key ? 'text-primary' : 'text-#5D616B',
        variant === 'mobile' ? 'h-12' : ''
      ]"
      @click="emit('update:modelValue', s.key)"
    >
      {{ s.label }}
      <div
        v-if="modelValue === s.key"
        class="absolute h-2px w-full bottom-0 left-0 bg-primary"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { SCOPE_TABS } from "./tabs.js";

defineProps({
  modelValue: { type: String, default: "knowledge" },
  /** pc: AcDialog 标题栏内；mobile: 自绘 header 内（每项自带 h-12） */
  variant: { type: String, default: "pc" }
});
const emit = defineEmits(["update:modelValue"]);
</script>
```

- [ ] **Step 2: 写 DataRangeSecretTip.vue**

PC 原样带 `-mr-3`（贴近关闭按钮）、气泡 `placement="bottom"` `:width="280"` 文案居中；移动 `placement="bottom-end"` `:width="240"` 文案左对齐。

```vue
<template>
  <!-- 涉密说明气泡：与行内 tag 无关，独立入口；文案来自 getSecretButtonTip -->
  <el-popover
    trigger="click"
    :placement="variant === 'pc' ? 'bottom' : 'bottom-end'"
    effect="dark"
    :width="variant === 'pc' ? 280 : 240"
    popper-class="!p-3 !rounded-2"
  >
    <template #reference>
      <!-- PC 的 -mr-3 把按钮往右拽，缩短与关闭按钮之间的留白（关闭按钮自带 48px 命中区） -->
      <button
        type="button"
        class="flex items-center gap-1 text-#FEAC00 text-3.5 select-none shrink-0"
        :class="variant === 'pc' ? '-mr-3' : ''"
        @click.stop
      >
        <SvgIcon name="secret" class="w-3.5 h-3.5" />
        涉密
      </button>
    </template>
    <span
      class="block text-3 leading-5 -m-1 whitespace-pre-wrap"
      :class="variant === 'pc' ? 'text-center' : ''"
      >{{ text }}</span
    >
  </el-popover>
</template>

<script setup>
defineProps({
  text: { type: String, default: "" },
  variant: { type: String, default: "pc" }
});
</script>
```

> `SvgIcon` / `el-popover` 走仓库既有的自动注册，不要手动 import（与 `SelectDataRangePopup.vue` 现状一致）。

- [ ] **Step 3: 类型检查 + 格式化 + 提交**

```bash
cd apps/web && pnpm format && pnpm exec vue-tsc --noEmit
git add src/components/views/personal-ai/picker/dataRange/DataRangeScopeTabs.vue src/components/views/personal-ai/picker/dataRange/DataRangeSecretTip.vue
git commit -m "refactor(选择数据范围): 抽出一级 tab 条与涉密气泡共用件"
```

---

### Task 3: 已选底栏 DataRangeSelectedBar

**Files:**
- Create: `apps/web/src/components/views/personal-ai/picker/dataRange/DataRangeSelectedBar.vue`
- Read: `SelectDataRangeDialog.vue:194-302`、`SelectDataRangePopup.vue:180-280`

**Interfaces:**
- Consumes: Task 1 的 picker 实例（`selectedPopoverVisible` `selectedCount` `knowledgeCount` `weekWorkCount` `popoverGroup` `selectedItems` `removeItem` `clearAll`）
- Produces: `<DataRangeSelectedBar :picker="picker" :variant="'pc'|'mobile'" />`

两端差异只有两处：PC chip 上要显示 `DataScopeTag`（涉密 / 离职），清空按钮文案 PC 是「清空已选」移动是「清空」。其余标记逐字相同。

- [ ] **Step 1: 写组件**

搬 `SelectDataRangeDialog.vue:194-302` 的整块（已选 `el-popover` + chip 列表 + 清空按钮），改动三处：

1. 所有 `selectedCount` / `selectedItems` / `popoverGroup` / `removeItem` / `clearAll` 等改成 `picker.xxx`（`props.picker` 里取；模板里 `picker.selectedCount` 直接用，composable 返回的是 ref，模板自动解包对 `picker.selectedCount` **不生效** —— 用 `picker.selectedCount.value`，或在 `<script setup>` 里 `const { selectedCount, … } = props.picker` 解构后模板用裸名。**采用解构写法**，与仓库其它组件一致）
2. `DataScopeTag` 两行加 `v-if="variant === 'pc' && item.isSecret"` / `v-if="variant === 'pc' && item.isResigned"`
3. 清空按钮：`{{ variant === "pc" ? "清空已选" : "清空" }}`，PC 用 `mr-2`、移动用 `mr-1`

组件根节点用 `<div class="flex items-center gap-3 min-w-0">` 包已选 popover，清空按钮作为兄弟节点放在同一根下；PC 壳会把它塞进 `#footer-left` 与 `#footer-before-actions` 两个 slot —— 因此组件要支持**只渲染其中一半**：加 prop `section: "selected" | "clear"`，`section="selected"` 时只渲染已选 popover，`section="clear"` 时只渲染清空按钮，移动壳两次调用（中间夹 `flex-1` 占位）保持现有布局。

```js
defineProps({
  picker: { type: Object, required: true },
  variant: { type: String, default: "pc" },
  /** selected: 已选计数+chip 弹层；clear: 清空按钮。PC 两块分处 AcDialog 两个 slot */
  section: { type: String, default: "selected" }
});
```

- [ ] **Step 2: 类型检查 + 格式化 + 提交**

```bash
cd apps/web && pnpm format && pnpm exec vue-tsc --noEmit
git add src/components/views/personal-ai/picker/dataRange/DataRangeSelectedBar.vue
git commit -m "refactor(选择数据范围): 抽出已选底栏共用件"
```

---

### Task 4: 内容区 DataRangeBody

**Files:**
- Create: `apps/web/src/components/views/personal-ai/picker/dataRange/DataRangeBody.vue`
- Read: `SelectDataRangeDialog.vue:34-166`、`SelectDataRangePopup.vue:60-174,291-330`

**Interfaces:**
- Consumes: Task 1 的 picker 实例、`tabs.js#TABS` `#LIST_TABS`
- Produces: `<DataRangeBody :picker="picker" :variant="'pc'|'mobile'" />`

组件内部自持移动端整屏搜索层的三个状态（`searchLayerOpen` / `searchInputRef` / `openSearchLayer` / `closeSearchLayer`）—— 它们是形态，不是业务状态，不进 composable。

- [ ] **Step 1: 写组件**

结构（自上而下）：

1. `WeekWorkPicker`：`v-if="scopeTab === 'weekly'"`，class 按 variant —— PC `-mx-4 -my-4 h-full`（抵消 AcDialog 的 `px-4 pt-4`），移动 `flex-1 min-h-0`
2. `v-else` 的知识聊天区，根节点 class 同样按 variant：PC `flex flex-col h-full -mx-4 -my-4 select-none`，移动 `contents`（移动壳自己是 flex 列容器）
3. 二级 tab 条：`v-for="t in TABS"`，PC `gap-4`、移动 `gap-3.5 whitespace-nowrap`；右侧 `flex-1` 后接搜索入口
4. 搜索入口按 variant 分支：
   - pc：`<AiBoxSearchBox v-model="keyword" placeholder="搜索联系人、群组" multi :selected-keys="selectedKeysForSearch" :candidates="searchCandidates" :candidates-loading="dialogueLoading" :show-agent-name="false" :match-agent-name="false" @focus="onSearchFocus" @select="onSearchSelect" />`
   - mobile：胶囊按钮 `@click="openSearchLayer"`（`SelectDataRangePopup.vue:90-97` 原样）
5. 三级胶囊：`v-if="activeTab === 'dialogue'"`，`v-for="lt in LIST_TABS"`，标签 `{{ lt.label }} {{ lt.key === "all" ? dialogCount : storageCount }}`
6. 表头全选 + `AiBoxVirtualList`（`v-if="activeTab !== 'org'"`）：两端标记逐字相同，直接搬
7. `v-else` 的 `OrgPicker`：`:secret-tag-lookup` 只在 pc 传（`:secret-tag-lookup="variant === 'pc' ? orgSecretTagLookup : undefined"`）
8. 移动整屏搜索层：`v-if="variant === 'mobile' && searchLayerOpen"`，`absolute inset-0 z-20`，内含 `SearchInput` + `AiBoxSearchPanel`（`SelectDataRangePopup.vue:291-330` 原样）

`<script setup>` 里：

```js
import { ref, nextTick } from "vue";
import { TABS, LIST_TABS } from "./tabs.js";
// 其余子组件按原两个壳的 import 清单合并（AiBoxRow / AiBoxVirtualList / AiBoxSearchBox /
// SearchInput / AiBoxSearchPanel / OrgPicker / StorageRow / WeekWorkPicker / CheckboxView）

const props = defineProps({
  picker: { type: Object, required: true },
  variant: { type: String, default: "pc" }
});

// 解构 picker，模板里用裸名（composable 返回的 ref 不会被模板自动解包）
const {
  scopeTab, activeTab, listTab, keyword, selectedKeySet, weekWorkKeySet,
  dialogueLoading, dialogueError, displayList, emptyText, listResetKey,
  storageStateMap, memberKeySet, dialogCount, storageCount,
  selectedKeysForOrg, selectedKeysForSearch, searchCandidates, orgSecretTagLookup,
  allCurrentSelected, halfCurrentSelected,
  onSearchFocus, onSearchSelect, onWeekWorkKeys, onWeekWorkExtra,
  toggleItem, toggleStorage, toggleExpand, toggleSelectAllCurrent
} = props.picker;

/** 整屏搜索层（仅移动端形态）：searchFocused 开了 searchCandidates 才出数 */
const searchLayerOpen = ref(false);
const searchInputRef = ref(null);
const openSearchLayer = async () => {
  searchLayerOpen.value = true;
  props.picker.searchFocused.value = true;
  await nextTick();
  searchInputRef.value?.focus?.();
};
/** 关层：清关键字回列表。已勾选的项写在同一个 selectedKeySet 里，不受影响 */
const closeSearchLayer = () => {
  searchLayerOpen.value = false;
  props.picker.searchFocused.value = false;
  keyword.value = "";
};

defineExpose({ closeSearchLayer });
```

- [ ] **Step 2: 类型检查 + 格式化 + 提交**

```bash
cd apps/web && pnpm format && pnpm exec vue-tsc --noEmit
git add src/components/views/personal-ai/picker/dataRange/DataRangeBody.vue
git commit -m "refactor(选择数据范围): 抽出内容区 DataRangeBody"
```

---

### Task 5: PC 壳接入

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/SelectDataRangeDialog.vue`（全文重写，946 → 约 110 行）

**Interfaces:**
- Consumes: Task 1-4 全部产物
- Produces: 对外 props / emits **不变** —— `open` / `autoSelectAll` / `initialScopes` / `accountId`，`update:open` / `submit`。调用方 `DataScopeBar.vue`、`mpa/desktop/pages/data-range.vue` 不改一行

- [ ] **Step 1: 重写文件**

`<script setup>` 只剩：

```js
import { watch } from "vue";
import AcDialog from "@/components/common/AcDialog.vue"; // 若原文件走自动注册则保持原样，不新增 import
import DataRangeScopeTabs from "./dataRange/DataRangeScopeTabs.vue";
import DataRangeSecretTip from "./dataRange/DataRangeSecretTip.vue";
import DataRangeSelectedBar from "./dataRange/DataRangeSelectedBar.vue";
import DataRangeBody from "./dataRange/DataRangeBody.vue";
import { useDataRangePicker } from "./dataRange/useDataRangePicker.js";
import {
  getAllImDialogue,
  getSecretButtonTip
} from "@/server/module/personalAiFrame.js";

const props = defineProps({
  open: Boolean,
  autoSelectAll: { type: Boolean, default: false },
  initialScopes: { type: Array, default: () => [] },
  accountId: { type: [String, Number], default: "" }
});
const emit = defineEmits(["update:open", "submit"]);

const picker = useDataRangePicker({
  props,
  deps: { getAllImDialogue, getSecretButtonTip }
});

const dialogVisible = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v)
});

const onSubmit = () => {
  emit("submit", picker.buildSubmitPayload());
  emit("update:open", false);
};

const onClose = () => {
  picker.resetTransient();
  emit("update:open", false);
};

// 打开时重置并拉候选；关闭只清瞬时态（选中由下次 init 从 initialScopes 重建）
watch(
  () => props.open,
  (open) => {
    if (!open) {
      picker.resetTransient();
      return;
    }
    picker.init();
  },
  { immediate: true }
);
```

模板保持原 `AcDialog` 的全部属性（`class="!w-440px !h-580px"`、`content-class`、`splitTheme`、`submit-class`、`:handleSubmit="onSubmit"`、`@close="onClose"`）不变，四个 slot 换成：

```vue
<template #custom-header>
  <DataRangeScopeTabs v-model="picker.scopeTab.value" variant="pc" />
</template>

<template #content>
  <DataRangeBody :picker="picker" variant="pc" />
</template>

<template #header-right>
  <DataRangeSecretTip :text="picker.secretTipText.value" variant="pc" />
</template>

<template #footer-left>
  <DataRangeSelectedBar :picker="picker" variant="pc" section="selected" />
</template>

<template #footer-before-actions>
  <DataRangeSelectedBar :picker="picker" variant="pc" section="clear" />
</template>
```

原 `<style scoped>`（`:deep(.select-data-range__content) { overflow: visible; }`，`SelectDataRangeDialog.vue:942-945`）**保留**，已选 popover 依赖它不被裁切。

- [ ] **Step 2: 类型检查**

```bash
cd apps/web && pnpm exec vue-tsc --noEmit
```

预期 exit 0。

- [ ] **Step 3: 浏览器目视 PC**

```bash
cd apps/web && pnpm dev
```

开 `http://localhost:6173/ai-chat/zx/data-range?platform=pc&accountId=<你的账号id>`，逐项确认：

- 标题栏两个一级 tab 位置、下划线、切换正常
- 「涉密」气泡在关闭按钮左侧，点开文案正常
- 二级 tab（对话列表 / 最近 / 组织架构）+ 三级胶囊（全部 N / 收纳组 N）
- 收纳组展开收起，组勾选联动成员，三态正确
- 表头「全部」全选 / 半选
- 搜索框下拉勾选后关掉下拉，列表里该项为选中
- 组织架构 tab 里人员带涉密 / 离职标
- 底部「已选：N个」弹层：两组切换、chip 头像、单个移除、清空已选
- 点确定关窗并落库

- [ ] **Step 4: 提交**

```bash
git add src/components/views/personal-ai/picker/SelectDataRangeDialog.vue
git commit -m "refactor(选择数据范围): PC 壳改用共用逻辑与组件"
```

---

### Task 6: 移动壳接入

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/SelectDataRangePopup.vue`（全文重写，930 → 约 120 行）

**Interfaces:**
- Consumes: Task 1-4 全部产物
- Produces: 对外 props / emits **不变** —— `initialScopes` / `accountId` / `autoSelectAll` / `instant`，`submit` / `close`。调用方 `mpa/mobile/pages/data-range.vue`、`DataScopeBar.vue` 的 `xPopupWrapper` 调用不改

- [ ] **Step 1: 重写文件**

`<script setup>`：

```js
import { onMounted } from "vue";
import XPopup from "@/components/common/XPopup.vue";
import AcButton from "@/components/common/AcButton.vue";
import DataRangeScopeTabs from "./dataRange/DataRangeScopeTabs.vue";
import DataRangeSecretTip from "./dataRange/DataRangeSecretTip.vue";
import DataRangeSelectedBar from "./dataRange/DataRangeSelectedBar.vue";
import DataRangeBody from "./dataRange/DataRangeBody.vue";
import { useDataRangePicker } from "./dataRange/useDataRangePicker.js";
import {
  getAllImDialogue,
  getSecretButtonTip
} from "@/server/module/personalAiFrame.js";

const props = defineProps({
  initialScopes: { type: Array, default: () => [] },
  accountId: { type: [String, Number], default: "" },
  autoSelectAll: { type: Boolean, default: false },
  /** 去掉 XPopup 的底部滑入/滑出：/m/data-range 的原生整页 webview 自己已是右滑入 */
  instant: { type: Boolean, default: false }
});
const emit = defineEmits(["submit", "close"]);

const picker = useDataRangePicker({
  props,
  deps: { getAllImDialogue, getSecretButtonTip }
});

const onSubmit = () => emit("submit", picker.buildSubmitPayload());

const onClose = () => {
  picker.resetTransient();
  emit("close");
};

// xPopupWrapper 每次调用新建实例，onMounted 初始化即可
onMounted(() => picker.init());
```

模板保持 `XPopup` 壳与自绘 header / footer 的原有 class 不变，替换三处：

- header 左侧一级 tab → `<DataRangeScopeTabs v-model="picker.scopeTab.value" variant="mobile" />`
- header 右侧涉密 → `<DataRangeSecretTip :text="picker.secretTipText.value" variant="mobile" />`（关闭图标仍留在壳里）
- header 与 footer 之间的整块内容 → `<DataRangeBody :picker="picker" variant="mobile" />`
- footer 里已选 popover → `<DataRangeSelectedBar :picker="picker" variant="mobile" section="selected" />`，`flex-1` 占位后接 `<DataRangeSelectedBar … section="clear" />`，再接原来的取消 / 确定两个 `AcButton`

确定按钮沿用现状 `:title="'确定'"`（原文件 `:disabled="false && !selectedCount"` 与 `:title="'确定' || submitTitle"` 是历史死代码，本次一并删掉，行为不变）。

- [ ] **Step 2: 类型检查**

```bash
cd apps/web && pnpm exec vue-tsc --noEmit
```

预期 exit 0。

- [ ] **Step 3: 浏览器目视移动端**

浏览器切手机视口（375×812），开 `http://localhost:6173/ai-chat/m/data-range?platform=m&accountId=<你的账号id>`，逐项确认：

- header：一级 tab、涉密气泡（右下弹）、关闭图标
- 二级 tab 与三级胶囊，间距同改造前
- 收纳组展开、三态、表头全选
- 点搜索胶囊铺开整屏层，输入框自动聚焦；勾选后点「取消」关层，列表里该项为选中
- 周工作 tab：树勾选、「全部」胶囊全选口径
- footer：已选弹层、清空、取消、确定
- 确定后页面按现有逻辑落库并回传宿主

- [ ] **Step 4: 提交**

```bash
git add src/components/views/personal-ai/picker/SelectDataRangePopup.vue
git commit -m "refactor(选择数据范围): 移动壳改用共用逻辑与组件"
```

---

### Task 7: 全量验证与收尾

**Files:**
- Modify: `context/features/20260903-数据范围选择组件合一/status.md`
- Modify: `context/features/20260903-数据范围选择组件合一/impl-notes.md`

- [ ] **Step 1: 跑全部相关单测**

```bash
cd apps/web && node --test \
  src/components/views/personal-ai/picker/tests/useDataRangePicker.test.mjs \
  src/components/views/personal-ai/picker/tests/weekWorkModel.test.mjs \
  src/components/views/personal-ai/picker/tests/dataRangeSavePayload.test.mjs \
  src/components/views/personal-ai/tests/dataScopeModel.test.mjs \
  src/components/views/personal-ai/tests/selectDataRangeList.test.mjs
```

预期：全部 pass，fail 0。

- [ ] **Step 2: 全量构建**

```bash
cd apps/web && pnpm build
```

预期 exit 0（含 `vue-tsc` 与四个入口）。

- [ ] **Step 3: 确认没有遗留引用**

```bash
cd apps/web && grep -rn "SCOPE_TABS\|LIST_TABS\|FALLBACK_SECRET_TIP" src --include=*.vue --include=*.js
```

预期：只出现在 `dataRange/tabs.js` 与 `dataRange/` 下的组件里，两个壳不再出现。

```bash
cd apps/web && wc -l src/components/views/personal-ai/picker/SelectDataRange*.vue
```

预期：两个壳都在 150 行以内。

- [ ] **Step 4: 更新功能文档并提交 context**

`status.md` 平台矩阵按实际打勾（web 列），`impl-notes.md` 记三条：composable 依赖注入的原因（node --test 不解析 `@/` 别名）、`variant` 分支清单、`picker` 以 prop 传递而非 provide/inject 的原因。

```bash
cd /Users/nic/w/ai-dev-workspace
git add -A
git commit -m "docs(20260903-数据范围选择组件合一): 两壳合一完成，记录实现要点"
```

---

## 自查

- **spec 覆盖**：目标「新增/修改 tab 只写一处」由 Task 1（逻辑）+ Task 2（一级 tab）+ Task 4（二、三级 tab）共同满足；spec 的 variant 差异表逐条落在 Task 2/3/4；按钮留壳落在 Task 5/6；验证清单落在 Task 5 Step 3、Task 6 Step 3、Task 7。
- **spec 修订**：一级 tab 改用共用小件（原方案要挪进内容区并接受视觉变化）、初始化时机留在壳里 —— 两处已回写 spec。
- **命名一致性**：`buildSubmitPayload` / `init` / `resetTransient` 三个新名在 Task 1 定义，Task 5/6 引用一致；`picker` prop 名在 Task 3/4/5/6 一致；`section` prop 仅 `DataRangeSelectedBar` 有。
- **风险**：移动端整屏搜索层的 `nextTick` 聚焦从壳挪进 body 后需真机（iOS webview）复验键盘拉起，已列进 Task 6 目视清单；`AcDialog` 已确认 `:destroy-on-close="true"`（`AcDialog.vue:5`），PC 每次打开都是新内容树，不必额外加 `v-if`。

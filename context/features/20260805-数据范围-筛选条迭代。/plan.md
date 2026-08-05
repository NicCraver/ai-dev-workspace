# Plan：数据范围-筛选条迭代。

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。

**Goal：** 聊天记忆筛选条：类型全选外示「全部类型」，数据全选外示「全部数据」/ 非全选封顶「数据+999」；点数据胶囊先开层并行 `getAgentDataRange`。

**Architecture：** 平台无关文案规则见 `spec.md`。各端本地实现；web 抽纯函数单测。点击数据：先开弹层，并行 get，只回写父级记忆/胶囊，不覆盖弹层内编辑快照。真全部只消费现有 `groupAndAccountSelectAll`，不改契约。

**Tech Stack：** web Vue3；desktop Vue2.7（禁 `?.`/`??`）；ios ObjC；android Java。

## Global Constraints

- 范围：**仅聊天记忆筛选条**；设置页 / 定时任务文案不动。
- 类型：个人 + **群** AI；全选 = 当前 `dataRangeList` 全 `choose===1`；空列表保留现网空态。
- 数据：仅个人 AI；`groupAndAccountSelectAll===1` →「全部数据」；缺省当 0 → `数据+min(n,999)`；弹层真实数。
- 点击数据：先开层，并行 get；失败不关层、不强制 toast。
- save 三态：未知省略三 key，禁止 0 冒充。
- desktop：禁可选链/空值合并；提交排除 `.env.test` / `electron-builder.yml` / `package.json` / `package-lock.json`。
- 四端规则一致、代码各写；跨端移植只读 `impl-notes.md` + 契约 + `platforms/<端>.md`。

---

## Web（参考实现端）

### Task 1: 文案纯函数 + 单测（web）

**端：** web

**Files:**
- Create: `apps/web/src/components/views/home/commons/filterCapsuleLabels.js`
- Create: `apps/web/src/components/views/home/commons/tests/filterCapsuleLabels.test.mjs`

**Interfaces:**
- Produces:
  - `formatTypeCapsuleLabel(dataRangeList, emptyLabel = "无（不关联任何数据）"): string`
  - `formatDataCapsuleLabel(scopeCount, groupAndAccountSelectAll): string`
  - `isTypeListAllSelected(dataRangeList): boolean`

- [ ] **Step 1: 写失败的测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTypeCapsuleLabel,
  formatDataCapsuleLabel,
  isTypeListAllSelected
} from "../filterCapsuleLabels.js";

test("类型：全选 → 全部类型", () => {
  assert.equal(
    formatTypeCapsuleLabel([
      { choose: 1 },
      { choose: 1 }
    ]),
    "全部类型"
  );
});

test("类型：部分选 → 类型+x", () => {
  assert.equal(
    formatTypeCapsuleLabel([{ choose: 1 }, { choose: 0 }]),
    "类型+1"
  );
});

test("类型：空列表 → 空态", () => {
  assert.equal(formatTypeCapsuleLabel([]), "无（不关联任何数据）");
  assert.equal(isTypeListAllSelected([]), false);
});

test("数据：selectAll=1 → 全部数据", () => {
  assert.equal(formatDataCapsuleLabel(12, 1), "全部数据");
});

test("数据：缺省/0 封顶 999", () => {
  assert.equal(formatDataCapsuleLabel(0, undefined), "数据+0");
  assert.equal(formatDataCapsuleLabel(999, 0), "数据+999");
  assert.equal(formatDataCapsuleLabel(1000, 0), "数据+999");
  assert.equal(formatDataCapsuleLabel(1000, null), "数据+999");
});
```

- [ ] **Step 2: 跑测确认失败**

```bash
cd apps/web && node --test src/components/views/home/commons/tests/filterCapsuleLabels.test.mjs
```

预期：FAIL（模块不存在）

- [ ] **Step 3: 实现**

```js
export function isTypeListAllSelected(dataRangeList = []) {
  const list = Array.isArray(dataRangeList) ? dataRangeList : [];
  return list.length > 0 && list.every((item) => item && item.choose === 1);
}

export function formatTypeCapsuleLabel(
  dataRangeList = [],
  emptyLabel = "无（不关联任何数据）"
) {
  const list = Array.isArray(dataRangeList) ? dataRangeList : [];
  if (!list.length) return emptyLabel;
  if (isTypeListAllSelected(list)) return "全部类型";
  const n = list.filter((item) => item && item.choose === 1).length;
  return `类型+${n}`;
}

export function formatDataCapsuleLabel(scopeCount, groupAndAccountSelectAll) {
  if (groupAndAccountSelectAll === 1) return "全部数据";
  const n = Number(scopeCount) || 0;
  const capped = Math.min(Math.max(n, 0), 999);
  return `数据+${capped}`;
}
```

- [ ] **Step 4: 跑测通过**（同 Step 2，Expected: PASS）

- [ ] **Step 5: Commit**（web 仓）`feat(filter-bar): 类型/数据胶囊文案纯函数`

---

### Task 2: DataRangeBar 接类型文案（web）

**端：** web

**Files:**
- Modify: `apps/web/src/components/views/home/commons/DataRangeBar.vue`

**Interfaces:**
- Consumes: `formatTypeCapsuleLabel` from Task 1

- [ ] **Step 1:** 模板中胶囊文案改为：

```js
const capsuleLabel = computed(() =>
  formatTypeCapsuleLabel(dataRanges.value)
);
```

模板：`{{ capsuleLabel }}`（替换现有 `enabledList.length ? 类型+… : 空态`）

- [ ] **Step 2:** 关闭钮 `v-if` 仍用 `enabledList.length`（逻辑不变）

- [ ] **Step 3:** 手动点开：全选 →「全部类型」；取消一项 →「类型+x」；全不选 → 空态

- [ ] **Step 4: Commit** `feat(DataRangeBar): 全选显示全部类型`

---

### Task 3: DataScopeBar 文案 + 点击并行 get（web）

**端：** web

**Files:**
- Modify: `apps/web/src/components/views/home/commons/DataScopeBar.vue`
- Modify: `apps/web/src/components/views/home/commons/FilterBar.vue`
- Modify: `apps/web/src/components/views/home/ChatInput.vue`（若需透传 `selectAllFlags`）

**Interfaces:**
- Consumes: `formatDataCapsuleLabel`；`conditionMode.selectAllFlags`
- Produces: 点击时 emit `update` / `update-flags`（仅父级）；弹层 `initial-scopes` 用打开瞬间快照

- [ ] **Step 1:** `DataScopeBar` 新增 prop：

```js
selectAllFlags: { type: Object, default: null } // null=未知，展示当 0
```

胶囊：

```js
const capsuleLabel = computed(() =>
  formatDataCapsuleLabel(
    (props.dataRangeScopeList || []).length,
    props.selectAllFlags?.groupAndAccountSelectAll
  )
);
```

- [ ] **Step 2:** `FilterBar` / `ChatInput` 透传 `selectAllFlags`（从 `conditionMode.selectAllFlags`）

- [ ] **Step 3:** `openPicker`（PC 分支）逻辑：

```js
const openPicker = async () => {
  if (!useNativePicker.value) {
    dialogOpen.value = true; // 先开；SelectDataRangeDialog 用打开时 props 快照
    void refreshMemoryInBackground();
    return;
  }
  // 移动：现有 native 路径；persist 路径 ACK 后已 get；确保 emit flags
  ...
};

const refreshMemoryInBackground = async () => {
  const agentId = Assistant?.agentId;
  const acctId = user.value?.id;
  if (!agentId || !acctId) return;
  try {
    const memory = await getAgentDataRange({ accountId: acctId, agentId });
    const scopes = memory?.dataRangeScopeList || [];
    emit("update", scopes);
    const hasFlags =
      memory?.groupAndAccountSelectAll != null ||
      memory?.organizationGroupSelectAll != null ||
      memory?.outreachGroupSelectAll != null;
    emit(
      "update-flags",
      hasFlags
        ? {
            groupAndAccountSelectAll: memory.groupAndAccountSelectAll ?? 0,
            organizationGroupSelectAll: memory.organizationGroupSelectAll ?? 0,
            outreachGroupSelectAll: memory.outreachGroupSelectAll ?? 0
          }
        : null
    );
  } catch (e) {
    console.warn("选择数据范围：并行刷新记忆失败", e);
  }
};
```

注意：`SelectDataRangeDialog` 的 `initial-scopes` 勿被并行 get 改写正在编辑的勾选——若 dialog 用 props 响应式绑定，改为打开时拷贝进本地 ref，或仅更新父级胶囊、dialog 用 `v-if`+打开瞬间传入的拷贝。

- [ ] **Step 4:** 自测：selectAll=1 →「全部数据」；n>999 →「数据+999」；点开立即出层；get 后胶囊更新、弹层勾选不被冲掉

- [ ] **Step 5: Commit** `feat(DataScopeBar): 全部数据/封顶999与点击刷新`

---

### Task 4: web 自测清单 + impl-notes（web 完成后）

**端：** web（文档在 context）

- [ ] 按 spec 验收 1–5 勾选
- [ ] 写/更新 `impl-notes.md`（平台无关：文案规则、点击时序、弹层快照、缺省当 0）
- [ ] wrapup：更新 `status.md` web 列

---

## Desktop 移植

### Task 5: desktop 类型 + 数据胶囊（desktop）

**端：** desktop

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-memory-bar.vue`
- Modify: `apps/desktop/src/renderer/components/chitchat/sendbox/agent-memory-bar.vue`（仅类型）
- Optional helper: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-data-scope/filter-capsule-labels.js`（禁 `?.`/`??`）
- Test: `apps/desktop/test/unit/filter-capsule-labels.spec.js`

- [ ] 类型：全选「全部类型」，否则「类型+x」；空态保留
- [ ] 数据（仅 personal bar）：`selectAllFlags.groupAndAccountSelectAll===1` →「全部数据」，否则 min(n,999)
- [ ] 点数据：先 `dataScopeVisible=true`，并行 get 回写 mem/flags，不覆盖 dialog 内编辑
- [ ] Commit（排除禁忌文件）

---

## Android 移植

### Task 6: android FilterBar 文案 + 开页 get 对齐（android）

**端：** android

**Files:**
- Modify: `apps/android/IM/src/main/java/com/im/dialogue/personal_ai_at/PersonalAiFilterBar.java`（约 204、219 行）
- Modify: `apps/android/IM/src/main/java/com/im/dialogue/agent_data_check/GroupChatAgentDataCheckView.java`（群类型「类型+」）
- 其它群 FilterBar 若仍写死「类型+」一并改

- [ ] 类型/数据文案按 spec
- [ ] 开选人页已有 get 则复用；返回后刷新胶囊 flags
- [ ] 自测个人 + 群

---

## iOS 移植

### Task 7: ios FilterBar 文案 + 对齐（ios）

**端：** ios

**Files:**
- Modify: `apps/ios/.../ZXPersonalAiFilterBar.m`（typeLabel / dataScopeLabel）
- Modify: `apps/ios/.../ZXAIAgentFilterBar.m`（群类型）

- [ ] 同 android 规则
- [ ] 自测个人 + 群

---

## 接口联调

### Task 8: 联调确认（多端）

**端：** web 先；其它端随移植

- [ ] 确认后端已回传 `groupAndAccountSelectAll`；缺省展示当 0
- [ ] 不改契约文件（已有字段）；若实测与契约不符再 Changelog + 改契约
- [ ] 矩阵「接口联调」格更新

---

## Spec coverage（自检）

| Spec 项 | Task |
|---------|------|
| 全部类型 / 类型+x（含群） | 2, 5, 6, 7 |
| 全部数据 / 数据+999 | 3, 5, 6, 7 |
| 点击先开再 get | 3, 5, 6, 7 |
| 弹层真实数 | 3（不改弹层计数） |
| 缺省当 0 | 1, 3 |
| 设置页不动 | Global + Task 3 不改 SkillEditFormBody 文案路径 |
| 真全部不新开后端 | Global |
| impl-notes | 4 |

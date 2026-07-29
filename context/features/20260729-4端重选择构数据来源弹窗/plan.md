# 4端重构「选择数据来源」弹窗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 四端「选择数据来源」弹窗统一改为由 `POST /personalAiFrame/getAllImDialogue` 一次拉全量人+群、前端本地搜索、三段全选标记随 `saveDataRange` 落库。

**Architecture:** 弹窗打开时并行拉两个接口：`getAgentDataRange` 提供已选态（`dataRangeScopeList`），`getAllImDialogue` 提供候选清单。候选清单存内存，「全部 / 群聊（组织群+外联群）」两个视图都是它的派生视图，搜索是它的本地过滤；组织架构视图仍走各端现有组织接口。选中态是单一 `Set<"type_id">`，三处视图共享；三个全选标记由「分区是否被选满」派生而来，不独立存储。确定时把 Set 序列化成全量 `dataRangeScopeList` + 三个标记一起 save。

**Tech Stack:** desktop = Electron 19 + Vue 2.7 Options API + vitest；web = Vue 3 + TS；android = Java（`smart_message` 模块）；ios = Objective-C。

## Global Constraints

- 契约唯一事实来源在 `context/contracts/`，改接口先改契约、在文件头 Changelog 记一笔，再改调用代码。
- 全端注释用中文。
- **desktop 禁用可选链**：不写 `?.` / `??`，一律 `a && a.b` 兜底。
- desktop 用 Vue 2.7 **Options API**，不引入组合式 API、Pinia、第四套 UI 库；新接口加到 `src/renderer/service/<域>.js`；不硬编码域名。
- **忽略 `getAllImDialogue` 回参的 `selected` 字段**（它来自 `ai_frame_user_setting`，是个人 AI 框列表态，不是 DataScope 态）。已选态一律以 `getAgentDataRange` 的 `dataRangeScopeList` 为准。
- 列表**按后端返回顺序**渲染，前端不排序。
- 外联群判据：`groupInfo.type >= 10`；缺省或 `< 10` 为组织群。
- `saveDataRange` 的 `dataRangeScopeList` **必须传全量明细**，不得用空列表覆盖。
- 搜索为纯前端 **popover**：对会话名 + 智能体名做忽略大小写子串匹配，全局搜人+群，**不发网络请求**；主列表不随关键字过滤；表头全选始终按未过滤全量。
- 不改 `selectDataRangeScope` 桥协议（入参 `{agentId, accountId?}`、成功只 ACK `{ok:true}`）。

---

### Task 1: 契约更新（saveDataRange 三字段 + getAllImDialogue 消费方登记）

**涉及端：** 多端（共用契约）

**Files:**
- Modify: `context/contracts/personalAiFrame/saveDataRange.d.ts`
- Modify: `context/contracts/personalAiFrame/getAllImDialogue.d.ts:1-7`

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: `PersonalAiFrameSaveDataRangeReq` 新增三个可选字段 `groupAndAccountSelectAll?: 0 | 1`、`organizationGroupSelectAll?: 0 | 1`、`outreachGroupSelectAll?: 0 | 1`；新增导出类型 `PersonalAiFrameSelectAllFlag = 0 | 1`。后续所有端的保存载荷以此为准。

- [ ] **Step 1: 给 `saveDataRange.d.ts` 补三个全选字段与 Changelog**

把文件头 Changelog 改为（保留原有两条，新增第一条）：

```ts
/**
 * 契约：个人AI框域 · 知识范围记忆
 * POST /agentSetDataRangeExpand/saveDataRange
 * Changelog:
 * - 2026-07-29 对齐 YApi（2026-07-28 更新）：新增 groupAndAccountSelectAll /
 *   organizationGroupSelectAll / outreachGroupSelectAll 三个全选标记（0/1，非必填）。
 *   语义：表达「用户勾了全选」的意图，后端据此在新增群时自动把新群补进 dataRangeScopeList。
 *   前端仍需照传全量 dataRangeScopeList 明细，不得用空列表覆盖。
 * - 2026-07-14 新增 POST /agentSetDataRangeExpand/saveDataRange
 * - 2026-07-16 对齐 YApi：dataRangeType 明确 0–4（含 3-个人 / 4-分享）；
 *   dataRangeScopeList 子项 scopeDataType / scopeDataId 必填；字段注释补全
 */
```

在 `import` 之后、`PersonalAiFrameSaveDataRangeReq` 之前插入：

```ts
/** 全选标记：1-勾选了全部；0-未勾选全部 */
export type PersonalAiFrameSelectAllFlag = 0 | 1;
```

在 `PersonalAiFrameSaveDataRangeReq` 内 `dataRangeScopeList` 字段之后追加：

```ts
  /**
   * 人员和群勾选全部：1-勾选了全部；0-未勾选全部
   * 前端按「选中数 === 候选全量数」推断，不由 getAgentDataRange 回参提供
   */
  groupAndAccountSelectAll?: PersonalAiFrameSelectAllFlag;
  /** 组织群勾选全部：1-勾选了全部；0-未勾选全部（组织群 = groupInfo.type 缺省或 < 10） */
  organizationGroupSelectAll?: PersonalAiFrameSelectAllFlag;
  /** 外联群勾选全部：1-勾选了全部；0-未勾选全部（外联群 = groupInfo.type >= 10） */
  outreachGroupSelectAll?: PersonalAiFrameSelectAllFlag;
```

- [ ] **Step 2: 给 `getAllImDialogue.d.ts` 登记新消费方**

只改文件头（回参结构与 YApi 零 diff，不动）。把 Changelog 与用途行改为：

```ts
/**
 * 契约：个人AI框域 · 获取所有IM会话
 * POST /personalAiFrame/getAllImDialogue
 * 用途：① 个人 AI 框选会话 / 选智能体时拉取全部 IM 会话列表；
 *       ② 四端「选择数据来源」弹窗的候选清单（全量人 + 群，一次拉取、弹窗内存缓存）
 * Changelog:
 * - 2026-07-29 新增消费方：四端「选择数据来源」弹窗（selectModel 传 0）。
 *   注意：本接口的 selected 字段来自 ai_frame_user_setting，是个人 AI 框「列表」的选中态，
 *   与 DataScope 无关；弹窗已选态一律以 getAgentDataRange 的 dataRangeScopeList 为准。
 * - 2026-07-28 新增 POST /personalAiFrame/getAllImDialogue
 */
```

- [ ] **Step 3: 校验改动**

Run: `cd /Users/nic/w/ai-dev-workspace && git diff --stat context/contracts/`
Expected: 恰好 2 个文件被改动，`saveDataRange.d.ts` 约 +20 行、`getAllImDialogue.d.ts` 约 +5/-2 行；无其他契约文件被误改。

- [ ] **Step 4: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/contracts/personalAiFrame/saveDataRange.d.ts context/contracts/personalAiFrame/getAllImDialogue.d.ts
git commit -m "docs(4端重构选择数据来源弹窗): saveDataRange 补三个全选标记，登记 getAllImDialogue 新消费方"
```

---

### Task 2: desktop — service 层接入 `getAllImDialogue`

**涉及端：** desktop

**Files:**
- Modify: `apps/desktop/src/renderer/service/aiBasic.js`（在 `getAgentDataRange` 方法之后插入新方法）

**Interfaces:**
- Consumes: Task 1 的契约。
- Produces: `aiBasic.getAllImDialogue(data, config)` → `Promise<Array>`，`data = { accountId: string, selectModel: 0 }`，resolve 值是会话数组（即 `response.data.data`），失败 reject 整个响应体。Task 4 消费。

- [ ] **Step 1: 新增 service 方法**

在 `apps/desktop/src/renderer/service/aiBasic.js` 中 `getAgentDataRange` 方法的右花括号与逗号之后、`getBadgePushInfo` 注释之前，插入：

```js
  /**
   * 获取所有IM会话（全量人 + 群），用于「选择数据来源」弹窗候选清单
   * POST /personalAiFrame/getAllImDialogue
   * 入参：{ accountId, selectModel }，selectModel 0-选会话模式（弹窗固定传 0）
   * 回参 data 直接是会话数组
   */
  getAllImDialogue(data, config = {}) {
    return Vue.prototype.$http
      .post(
        `${Vue.prototype.$apipath.aiBasicPath}/personalAiFrame/getAllImDialogue`,
        data,
        config
      )
      .then((response) => {
        if (response.data.code === "M0000") {
          return Promise.resolve(response.data.data);
        } else {
          return Promise.reject(response.data);
        }
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  },
```

- [ ] **Step 2: lint 校验**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/desktop && npx eslint src/renderer/service/aiBasic.js`
Expected: 无输出（0 error 0 warning）。

- [ ] **Step 3: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/service/aiBasic.js
git commit -m "feat(personal-ai): service 接入 getAllImDialogue"
```

---

### Task 3: desktop — 抽出纯逻辑模块（含单测）

把「归一化候选项、分区、派生全选、搜索过滤、Set ↔ scopes 互转」抽成无 Vue 依赖的纯函数模块，先写测试。这是三端移植时唯一需要照抄的逻辑，务必与 spec 语义一字不差。

**涉及端：** desktop

**Files:**
- Create: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-model.js`
- Test: `apps/desktop/test/unit/personal-ai-data-scope-model.spec.js`

**Interfaces:**
- Consumes: 无运行时依赖（纯函数）。
- Produces: 具名导出，Task 4 消费：
  - `SCOPE_TYPE_PRIVATE = 1` / `SCOPE_TYPE_GROUP = 3`
  - `makeKey(scopeDataType, scopeDataId): string` → `"1_280"`
  - `normalizeDialogueList(rawList): NormalizedItem[]`，`NormalizedItem = { key, scopeDataType, scopeDataId, name, isGroup, isOutreach, avatar, groupAvatars }`，保持入参顺序
  - `splitGroups(items): { organization: NormalizedItem[], outreach: NormalizedItem[] }`
  - `keysFromScopes(scopes): string[]`
  - `scopesFromKeys(keys): Array<{ scopeDataType: number, scopeDataId: string }>`
  - `filterByKeyword(items, keyword): NormalizedItem[]`
  - `computeSelectAllFlags(items, selectedKeys): { groupAndAccountSelectAll, organizationGroupSelectAll, outreachGroupSelectAll }`（值域 0/1）

- [ ] **Step 1: 写失败测试**

创建 `apps/desktop/test/unit/personal-ai-data-scope-model.spec.js`：

```js
import { describe, expect, test } from "vitest";
import {
  SCOPE_TYPE_PRIVATE,
  SCOPE_TYPE_GROUP,
  makeKey,
  normalizeDialogueList,
  splitGroups,
  keysFromScopes,
  scopesFromKeys,
  filterByKeyword,
  computeSelectAllFlags,
} from "../../src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-model";

// 一份贯穿全测试的候选清单：2 人 + 1 组织群 + 1 外联群，顺序刻意乱排
var RAW = [
  {
    type: 1,
    targetId: "u1",
    targetName: "张三",
    selected: true,
    privateInfo: { avatar: "a-u1", leave: 0 },
  },
  {
    type: 3,
    targetId: "g1",
    targetName: "产品组",
    groupInfo: {
      type: 1,
      accountInfoList: [
        { id: "m1", avatar: "a-m1" },
        { id: "m2", avatar: "a-m2" },
        { id: "m3", avatar: "a-m3" },
        { id: "m4", avatar: "a-m4" },
        { id: "m5", avatar: "a-m5" },
      ],
    },
  },
  { type: 1, targetId: "u2", targetName: "LiSi", privateInfo: { avatar: "a-u2" } },
  {
    type: 3,
    targetId: "g2",
    targetName: "外联群A",
    groupInfo: { type: 10, accountInfoList: [{ id: "m9", avatar: "a-m9" }] },
  },
];

describe("选择数据来源 · 模型", () => {
  test("makeKey 拼接类型与 id", () => {
    expect(makeKey(SCOPE_TYPE_PRIVATE, "280")).toBe("1_280");
    expect(makeKey(SCOPE_TYPE_GROUP, 99)).toBe("3_99");
  });

  test("normalizeDialogueList 保持后端顺序且不排序", () => {
    var items = normalizeDialogueList(RAW);
    expect(items.map((i) => i.key)).toEqual(["1_u1", "3_g1", "1_u2", "3_g2"]);
  });

  test("normalizeDialogueList 归一化人的字段", () => {
    var items = normalizeDialogueList(RAW);
    expect(items[0]).toEqual({
      key: "1_u1",
      scopeDataType: 1,
      scopeDataId: "u1",
      name: "张三",
      isGroup: false,
      isOutreach: false,
      avatar: "a-u1",
      groupAvatars: [],
    });
  });

  test("normalizeDialogueList 群头像只取前 4 人", () => {
    var items = normalizeDialogueList(RAW);
    expect(items[1].groupAvatars).toEqual(["a-m1", "a-m2", "a-m3", "a-m4"]);
    expect(items[1].avatar).toBe("");
  });

  test("normalizeDialogueList 按 groupInfo.type >= 10 判外联群", () => {
    var items = normalizeDialogueList(RAW);
    expect(items[1].isOutreach).toBe(false);
    expect(items[3].isOutreach).toBe(true);
  });

  test("normalizeDialogueList 缺 groupInfo 的群按组织群处理", () => {
    var items = normalizeDialogueList([{ type: 3, targetId: "g9", targetName: "无信息群" }]);
    expect(items[0].isOutreach).toBe(false);
    expect(items[0].groupAvatars).toEqual([]);
  });

  test("normalizeDialogueList 丢弃无 targetId 的脏数据", () => {
    var items = normalizeDialogueList([{ type: 1, targetName: "脏" }, null]);
    expect(items).toEqual([]);
  });

  test("splitGroups 分出组织群与外联群，不含人", () => {
    var parts = splitGroups(normalizeDialogueList(RAW));
    expect(parts.organization.map((i) => i.key)).toEqual(["3_g1"]);
    expect(parts.outreach.map((i) => i.key)).toEqual(["3_g2"]);
  });

  test("keysFromScopes 把回参 scope 转成 key，兼容数字 id", () => {
    var keys = keysFromScopes([
      { scopeDataType: 1, scopeDataId: "u1" },
      { scopeDataType: 3, scopeDataId: 22 },
      null,
      { scopeDataType: 1 },
    ]);
    expect(keys).toEqual(["1_u1", "3_22"]);
  });

  test("scopesFromKeys 转回保存载荷格式", () => {
    expect(scopesFromKeys(["1_u1", "3_g1"])).toEqual([
      { scopeDataType: 1, scopeDataId: "u1" },
      { scopeDataType: 3, scopeDataId: "g1" },
    ]);
  });

  test("filterByKeyword 全局搜人+群，忽略大小写子串匹配", () => {
    var items = normalizeDialogueList(RAW);
    expect(filterByKeyword(items, "li").map((i) => i.key)).toEqual(["1_u2"]);
    expect(filterByKeyword(items, "群").map((i) => i.key)).toEqual(["3_g2"]);
  });

  test("filterByKeyword 空关键字返回全量", () => {
    var items = normalizeDialogueList(RAW);
    expect(filterByKeyword(items, "  ").length).toBe(4);
  });

  test("computeSelectAllFlags 全选满三个标记都为 1", () => {
    var items = normalizeDialogueList(RAW);
    expect(computeSelectAllFlags(items, ["1_u1", "3_g1", "1_u2", "3_g2"])).toEqual({
      groupAndAccountSelectAll: 1,
      organizationGroupSelectAll: 1,
      outreachGroupSelectAll: 1,
    });
  });

  test("computeSelectAllFlags 移除一个组织群后 全部与组织群同时退回 0", () => {
    var items = normalizeDialogueList(RAW);
    expect(computeSelectAllFlags(items, ["1_u1", "1_u2", "3_g2"])).toEqual({
      groupAndAccountSelectAll: 0,
      organizationGroupSelectAll: 0,
      outreachGroupSelectAll: 1,
    });
  });

  test("computeSelectAllFlags 忽略不在候选清单里的额外 key（组织架构选的人）", () => {
    var items = normalizeDialogueList(RAW);
    var flags = computeSelectAllFlags(items, ["1_u1", "3_g1", "1_u2", "3_g2", "1_outsider"]);
    expect(flags.groupAndAccountSelectAll).toBe(1);
  });

  test("computeSelectAllFlags 空分区按未全选处理", () => {
    var items = normalizeDialogueList([{ type: 1, targetId: "u1", targetName: "张三" }]);
    expect(computeSelectAllFlags(items, ["1_u1"])).toEqual({
      groupAndAccountSelectAll: 1,
      organizationGroupSelectAll: 0,
      outreachGroupSelectAll: 0,
    });
  });

  test("computeSelectAllFlags 候选清单为空时三个标记都为 0", () => {
    expect(computeSelectAllFlags([], [])).toEqual({
      groupAndAccountSelectAll: 0,
      organizationGroupSelectAll: 0,
      outreachGroupSelectAll: 0,
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/desktop && npx vitest run test/unit/personal-ai-data-scope-model.spec.js`
Expected: FAIL，报错为无法解析模块 `.../personal-ai-data-scope/data-scope-model`（文件尚未创建）。

- [ ] **Step 3: 写实现**

创建 `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-model.js`：

```js
/**
 * 「选择数据来源」弹窗的纯逻辑模型（无 Vue 依赖，便于单测与跨端移植）
 * 数据来源：POST /personalAiFrame/getAllImDialogue
 * 注意：本模块**不消费**回参的 selected 字段——那是个人 AI 框列表的选中态，
 * 弹窗已选态一律来自 getAgentDataRange 的 dataRangeScopeList。
 */

/** 私聊 */
export var SCOPE_TYPE_PRIVATE = 1;
/** 群聊 */
export var SCOPE_TYPE_GROUP = 3;

/** 外联群阈值：groupInfo.type >= 10 为外联群 */
var OUTREACH_GROUP_TYPE_MIN = 10;
/** 群头像最多拼前 4 人 */
var GROUP_AVATAR_MAX = 4;

/** 拼选中集合的 key：`<类型>_<id>` */
export function makeKey(scopeDataType, scopeDataId) {
  return String(scopeDataType) + "_" + String(scopeDataId);
}

/**
 * 归一化候选清单，**保持后端返回顺序**，前端不排序
 * 丢弃 targetId 为空的脏数据
 */
export function normalizeDialogueList(rawList) {
  var list = Array.isArray(rawList) ? rawList : [];
  var result = [];
  list.forEach(function (raw) {
    if (!raw || raw.targetId == null || raw.targetId === "") return;
    var isGroup = Number(raw.type) === SCOPE_TYPE_GROUP;
    var scopeDataType = isGroup ? SCOPE_TYPE_GROUP : SCOPE_TYPE_PRIVATE;
    var scopeDataId = String(raw.targetId);
    var groupInfo = raw.groupInfo || {};
    var privateInfo = raw.privateInfo || {};
    var members = Array.isArray(groupInfo.accountInfoList)
      ? groupInfo.accountInfoList
      : [];
    var groupAvatars = [];
    if (isGroup) {
      members.slice(0, GROUP_AVATAR_MAX).forEach(function (member) {
        groupAvatars.push((member && member.avatar) || "");
      });
    }
    result.push({
      key: makeKey(scopeDataType, scopeDataId),
      scopeDataType: scopeDataType,
      scopeDataId: scopeDataId,
      name: raw.targetName || "",
      isGroup: isGroup,
      isOutreach: isGroup && Number(groupInfo.type || 0) >= OUTREACH_GROUP_TYPE_MIN,
      avatar: isGroup ? "" : privateInfo.avatar || "",
      groupAvatars: groupAvatars,
    });
  });
  return result;
}

/** 把候选清单里的群拆成「组织群 / 外联群」两组（不含人） */
export function splitGroups(items) {
  var list = Array.isArray(items) ? items : [];
  var organization = [];
  var outreach = [];
  list.forEach(function (item) {
    if (!item || !item.isGroup) return;
    if (item.isOutreach) {
      outreach.push(item);
    } else {
      organization.push(item);
    }
  });
  return { organization: organization, outreach: outreach };
}

/** getAgentDataRange 回参的 dataRangeScopeList → 选中 key 数组 */
export function keysFromScopes(scopes) {
  var list = Array.isArray(scopes) ? scopes : [];
  var keys = [];
  list.forEach(function (scope) {
    if (!scope || scope.scopeDataId == null || scope.scopeDataId === "") return;
    var type = Number(scope.scopeDataType) === SCOPE_TYPE_GROUP
      ? SCOPE_TYPE_GROUP
      : SCOPE_TYPE_PRIVATE;
    keys.push(makeKey(type, scope.scopeDataId));
  });
  return keys;
}

/** 选中 key 数组 → saveDataRange 的 dataRangeScopeList 明细 */
export function scopesFromKeys(keys) {
  var list = Array.isArray(keys) ? keys : [];
  var scopes = [];
  list.forEach(function (key) {
    if (!key) return;
    var index = String(key).indexOf("_");
    if (index <= 0) return;
    scopes.push({
      scopeDataType: Number(String(key).slice(0, index)),
      scopeDataId: String(key).slice(index + 1),
    });
  });
  return scopes;
}

/** 前端搜索：全局搜人+群，targetName 忽略大小写子串匹配 */
export function filterByKeyword(items, keyword) {
  var list = Array.isArray(items) ? items : [];
  var word = String(keyword == null ? "" : keyword).trim().toLowerCase();
  if (!word) return list.slice();
  return list.filter(function (item) {
    return String((item && item.name) || "").toLowerCase().indexOf(word) !== -1;
  });
}

/** 某分区是否被选满（空分区按未全选处理） */
function isPartitionAllSelected(partition, selectedMap) {
  if (!partition.length) return false;
  return partition.every(function (item) {
    return selectedMap[item.key] === true;
  });
}

/**
 * 派生三个全选标记（0/1），不独立存储
 * 只按候选清单判定；组织架构里选的、不在清单内的人不参与判定
 */
export function computeSelectAllFlags(items, selectedKeys) {
  var list = Array.isArray(items) ? items : [];
  var keys = Array.isArray(selectedKeys) ? selectedKeys : [];
  var selectedMap = {};
  keys.forEach(function (key) {
    selectedMap[key] = true;
  });
  var parts = splitGroups(list);
  return {
    groupAndAccountSelectAll: isPartitionAllSelected(list, selectedMap) ? 1 : 0,
    organizationGroupSelectAll: isPartitionAllSelected(parts.organization, selectedMap) ? 1 : 0,
    outreachGroupSelectAll: isPartitionAllSelected(parts.outreach, selectedMap) ? 1 : 0,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/desktop && npx vitest run test/unit/personal-ai-data-scope-model.spec.js`
Expected: PASS，17 passed。

- [ ] **Step 5: lint**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/desktop && npx eslint src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-model.js test/unit/personal-ai-data-scope-model.spec.js`
Expected: 无输出。

- [ ] **Step 6: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-model.js test/unit/personal-ai-data-scope-model.spec.js
git commit -m "feat(personal-ai): 抽出选择数据来源弹窗纯逻辑模型 + 单测"
```

---

### Task 4: desktop — 弹窗接入新数据源（全部 / 群聊 / 组织架构 + 前端搜索）

**涉及端：** desktop

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-data-scope-dialog.vue`
- Create: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-list-item.vue`

**Interfaces:**
- Consumes: Task 2 的 `aiBasic.getAllImDialogue`；Task 3 的全部导出。
- Produces: 弹窗 `confirm` 事件的载荷由 `Array<scope>` 改为对象 `{ scopes, flags }`，其中 `scopes = Array<{scopeDataType, scopeDataId}>`、`flags = { groupAndAccountSelectAll, organizationGroupSelectAll, outreachGroupSelectAll }`。Task 5 消费。

- [ ] **Step 1: 抽出列表项子组件**

创建 `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-data-scope/data-scope-list-item.vue`：

```vue
<template>
  <div class="pa-ds-item" @click="$emit('toggle', item)">
    <img class="pa-check-img" :src="checkIcon" />
    <!-- 人：单头像；群：前 4 人拼合 -->
    <img v-if="!item.isGroup" class="pa-ds-avatar" :src="item.avatar" />
    <div v-else class="pa-ds-avatar pa-ds-avatar-group">
      <img
        v-for="(url, index) in item.groupAvatars"
        :key="index"
        class="pa-ds-avatar-cell"
        :src="url"
      />
    </div>
    <p class="pa-ds-name only-line">{{ item.name }}</p>
  </div>
</template>

<script>
import iconChecked from '../../../../assets/image/range/checked.png';
import iconUnchecked from '../../../../assets/image/range/unchecked.png';

export default {
  name: 'DataScopeListItem',
  props: {
    item: {
      type: Object,
      required: true
    },
    selected: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    checkIcon: function() {
      return this.selected ? iconChecked : iconUnchecked;
    }
  }
};
</script>

<style lang="scss">
.pa-ds-item {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 12px;
  cursor: pointer;

  &:hover {
    background: #f5f7fa;
  }

  .pa-ds-avatar {
    width: 32px;
    height: 32px;
    margin: 0 8px;
    border-radius: 4px;
    overflow: hidden;
  }

  .pa-ds-avatar-group {
    display: flex;
    flex-wrap: wrap;
    background: #eef1f6;
  }

  .pa-ds-avatar-cell {
    width: 16px;
    height: 16px;
  }

  .pa-ds-name {
    flex: 1;
    font-size: 14px;
    color: #1f2329;
  }
}
</style>
```

- [ ] **Step 2: 弹窗改 tab 定义与状态**

在 `personal-ai-data-scope-dialog.vue` 的 `<script>` 中：

把 import 段追加三行（放在 `import CompanyDeptUser ...` 之后）：

```js
import DataScopeListItem from './personal-ai-data-scope/data-scope-list-item.vue';
import {
  normalizeDialogueList,
  splitGroups,
  keysFromScopes,
  scopesFromKeys,
  filterByKeyword,
  computeSelectAllFlags,
  makeKey,
  SCOPE_TYPE_PRIVATE
} from './personal-ai-data-scope/data-scope-model';
import aiBasic from '@/service/aiBasic';
```

`components` 里加 `DataScopeListItem`。

把 `data()` 中的 `switchBtns` 改为：

```js
      switchBtns: [
        { text: '全部', type: 1, key: 'all' },
        { text: '群聊', type: 2, key: 'group' },
        { text: '组织架构', type: 3, key: 'contact' }
      ],
```

把 `data()` 中的 `showComponent` 改为：

```js
      showComponent: {
        all: false,
        group: false,
        contact: false
      },
```

删掉 `lastConversationList`、`groupSelectTick`、`showSelectedList` 三个字段（`showSelectedList` 在 Step 4 改成 computed），新增：

```js
      // getAllImDialogue 全量候选清单（归一化后），弹窗生命周期内只拉一次
      dialogueItems: [],
      dialogueLoading: false,
      dialogueError: '',
      // 选中集合：key -> true，key 由 makeKey 生成
      selectedMap: {},
      // 搜索关键字（前端本地过滤，不发请求）
      keyword: ''
```

新增 props（供组件取当前登录人 id 调接口），放在已有的 `scopes` prop 之后：

```js
    accountId: {
      type: [String, Number],
      default: ''
    }
```

- [ ] **Step 3: 弹窗改 computed**

删除 `allRecentSelected` / `halfRecentSelected` / `recentAllCheckIcon` / `allGroupsSelected` / `halfGroupsSelected` / `groupAllCheckIcon` / `selectedGroupIds` / `selectedPrivateIds` / `selectedKeys`，替换为：

```js
    /** 选中 key 数组 */
    selectedKeys: function() {
      var map = this.selectedMap;
      return Object.keys(map).filter(function(key) {
        return map[key] === true;
      });
    },
    /** 「全部」视图：全量候选，按后端顺序，受搜索过滤 */
    allViewList: function() {
      return filterByKeyword(this.dialogueItems, this.keyword);
    },
    /** 群分区（受搜索过滤） */
    groupPartitions: function() {
      return splitGroups(filterByKeyword(this.dialogueItems, this.keyword));
    },
    /** 三个全选标记（派生值，按未过滤的全量清单算） */
    selectAllFlags: function() {
      return computeSelectAllFlags(this.dialogueItems, this.selectedKeys);
    },
    allCheckIcon: function() {
      return this.partitionIcon(this.dialogueItems, this.selectAllFlags.groupAndAccountSelectAll);
    },
    orgGroupCheckIcon: function() {
      var parts = splitGroups(this.dialogueItems);
      return this.partitionIcon(parts.organization, this.selectAllFlags.organizationGroupSelectAll);
    },
    outreachGroupCheckIcon: function() {
      var parts = splitGroups(this.dialogueItems);
      return this.partitionIcon(parts.outreach, this.selectAllFlags.outreachGroupSelectAll);
    },
    /** 底栏已选列表：优先用候选清单里的名字，找不到再回退到 store */
    showSelectedList: function() {
      var self = this;
      var byKey = {};
      this.dialogueItems.forEach(function(item) {
        byKey[item.key] = item;
      });
      return this.selectedKeys.map(function(key) {
        var hit = byKey[key];
        if (hit) return { key: key, name: hit.name, id: hit.scopeDataId };
        var index = key.indexOf('_');
        var type = Number(key.slice(0, index));
        var id = key.slice(index + 1);
        return { key: key, name: self.resolveDisplayName(type, id), id: id };
      });
    }
```

保留 `...mapGetters` 中的 `AllUserMap` / `GroupsMap`（组织架构侧回显名称仍要用），删掉 `ConversationSort`。

- [ ] **Step 4: 弹窗改 methods**

删除 `buildConversationList`、`toggleSelectAllRecent`、`toggleSelectAllGroups`、`groupSelectHandle`、`bumpGroupSelectTick`、`addRecentItem`、`selectDialogHandle`、`findSelectedIndexByKey`、`findSelectedIndexByPrivateId`、`deleteSelectedHandle`、`itemSubLabel`，新增/替换为：

```js
    /** 拉候选清单，弹窗生命周期内只拉一次 */
    loadDialogueList: function() {
      var self = this;
      this.dialogueLoading = true;
      this.dialogueError = '';
      return aiBasic
        .getAllImDialogue({
          accountId: String(this.accountId),
          selectModel: 0
        })
        .then(function(list) {
          self.dialogueItems = normalizeDialogueList(list);
          self.dialogueLoading = false;
        })
        .catch(function(error) {
          self.dialogueItems = [];
          self.dialogueLoading = false;
          self.dialogueError = (error && error.msg) || '会话列表加载失败';
        });
    },
    /** 已选态来自 getAgentDataRange 的 dataRangeScopeList，忽略接口的 selected */
    hydrateFromScopes: function() {
      var map = {};
      var checked = {};
      keysFromScopes(this.scopes).forEach(function(key) {
        map[key] = true;
        if (key.indexOf('1_') === 0) {
          checked[key.slice(2)] = true;
        }
      });
      this.selectedMap = map;
      this.checkedObj = checked;
    },
    isSelectedKey: function(key) {
      return this.selectedMap[key] === true;
    },
    /** 单项勾选/取消，三处视图共享同一集合 */
    toggleItem: function(item) {
      if (!item || !item.key) return;
      var next = Object.assign({}, this.selectedMap);
      if (next[item.key] === true) {
        delete next[item.key];
        if (!item.isGroup) {
          this.$set(this.checkedObj, item.scopeDataId, false);
        }
      } else {
        next[item.key] = true;
        if (!item.isGroup) {
          this.$set(this.checkedObj, item.scopeDataId, true);
        }
      }
      this.selectedMap = next;
    },
    /** 分区表头三态图标 */
    partitionIcon: function(partition, allFlag) {
      var self = this;
      if (allFlag === 1) return checkIcons.checked;
      var some = (partition || []).some(function(item) {
        return self.isSelectedKey(item.key);
      });
      return some ? checkIcons.halfChecked : checkIcons.unchecked;
    },
    /** 分区全选/全不选 */
    togglePartition: function(partition, allFlag) {
      var self = this;
      var list = partition || [];
      if (!list.length) return;
      var next = Object.assign({}, this.selectedMap);
      list.forEach(function(item) {
        if (allFlag === 1) {
          delete next[item.key];
          if (!item.isGroup) self.$set(self.checkedObj, item.scopeDataId, false);
        } else {
          next[item.key] = true;
          if (!item.isGroup) self.$set(self.checkedObj, item.scopeDataId, true);
        }
      });
      this.selectedMap = next;
    },
    toggleAllPartition: function() {
      this.togglePartition(this.dialogueItems, this.selectAllFlags.groupAndAccountSelectAll);
    },
    toggleOrgGroupPartition: function() {
      var parts = splitGroups(this.dialogueItems);
      this.togglePartition(parts.organization, this.selectAllFlags.organizationGroupSelectAll);
    },
    toggleOutreachGroupPartition: function() {
      var parts = splitGroups(this.dialogueItems);
      this.togglePartition(parts.outreach, this.selectAllFlags.outreachGroupSelectAll);
    },
    /** 组织架构侧勾人，写入同一个选中集合 */
    toggleChecked: function(deptOrUser) {
      if (!deptOrUser || !deptOrUser.isUser) return;
      var accountId = deptOrUser.accountId;
      if (!accountId) return;
      this.toggleItem({
        key: makeKey(SCOPE_TYPE_PRIVATE, accountId),
        scopeDataType: SCOPE_TYPE_PRIVATE,
        scopeDataId: String(accountId),
        name: deptOrUser.name || String(accountId),
        isGroup: false
      });
    },
    cancelSelectHandle: function(row) {
      var next = Object.assign({}, this.selectedMap);
      delete next[row.key];
      this.selectedMap = next;
      if (row.key.indexOf('1_') === 0) {
        this.$set(this.checkedObj, row.key.slice(2), false);
      }
      if (!this.selectedKeys.length) {
        this.selectedPopoverVisible = false;
      }
    },
    clearAllSelected: function() {
      this.selectedMap = {};
      this.checkedObj = {};
      this.selectedPopoverVisible = false;
    },
    confirmHandle: function() {
      this.$emit('confirm', {
        scopes: scopesFromKeys(this.selectedKeys),
        flags: this.selectAllFlags
      });
    }
```

`resolveDisplayName` 保留但删掉对 `lastConversationList` 的引用，改为直接查 store：

```js
    resolveDisplayName: function(scopeDataType, scopeDataId) {
      var id = String(scopeDataId);
      if (scopeDataType === 3) {
        var group = (this.GroupsMap && this.GroupsMap[id]) || null;
        if (group && group.name) return group.name;
      } else {
        var user = (this.AllUserMap && this.AllUserMap[id]) || null;
        if (user && user.name) return user.name;
      }
      return id;
    },
```

`switchTabHandle` 删掉 `type === 2` 的 tick 分支：

```js
    switchTabHandle: function(row) {
      if (!this.showComponent[row.key]) {
        this.showComponent[row.key] = true;
      }
      this.activeTab = row.type;
      this.showDeptAndUser = false;
    },
```

`mounted` 改为：

```js
  mounted: function() {
    this.hydrateFromScopes();
    this.loadDialogueList();
    this.switchTabHandle(this.switchBtns[0]);
  },
```

- [ ] **Step 5: 弹窗改模板**

把「最近联系人」与「群组」两块（原文件 27–91 行）整体替换为：

```html
      <!-- 全部：人 + 群混排，按后端返回顺序 -->
      <div
        v-if="showComponent.all"
        v-show="activeTab === 1"
        class="pa-all-list"
      >
        <div class="pa-select-all-row" @click="toggleAllPartition">
          <img class="pa-check-img" :src="allCheckIcon" />
          <span class="pa-select-all-label">全部</span>
        </div>
        <div v-if="dialogueLoading" class="pa-empty">加载中…</div>
        <div v-else-if="dialogueError" class="pa-empty">{{ dialogueError }}</div>
        <template v-else>
          <data-scope-list-item
            v-for="item in allViewList"
            :key="item.key"
            :item="item"
            :selected="isSelectedKey(item.key)"
            @toggle="toggleItem"
          ></data-scope-list-item>
          <div v-if="!allViewList.length" class="pa-empty">暂无数据</div>
        </template>
      </div>

      <!-- 群聊：组织群 / 外联群两组，复用同一份候选清单 -->
      <div
        v-if="showComponent.group"
        v-show="activeTab === 2"
        class="pa-group-wrap"
      >
        <div class="pa-select-all-row" @click="toggleOrgGroupPartition">
          <img class="pa-check-img" :src="orgGroupCheckIcon" />
          <span class="pa-select-all-label">组织群</span>
        </div>
        <data-scope-list-item
          v-for="item in groupPartitions.organization"
          :key="item.key"
          :item="item"
          :selected="isSelectedKey(item.key)"
          @toggle="toggleItem"
        ></data-scope-list-item>
        <div class="pa-select-all-row" @click="toggleOutreachGroupPartition">
          <img class="pa-check-img" :src="outreachGroupCheckIcon" />
          <span class="pa-select-all-label">外联群</span>
        </div>
        <data-scope-list-item
          v-for="item in groupPartitions.outreach"
          :key="item.key"
          :item="item"
          :selected="isSelectedKey(item.key)"
          @toggle="toggleItem"
        ></data-scope-list-item>
        <div
          v-if="!groupPartitions.organization.length && !groupPartitions.outreach.length"
          class="pa-empty"
        >暂无数据</div>
      </div>
```

把顶栏搜索框改为受控输入（不再走 `search-box` 的 `@select` 拉后端）：

```html
      <input
        v-model="keyword"
        class="pa-data-scope-search"
        type="text"
        placeholder="搜索联系人、群聊"
      />
```

底栏 chips 的关闭按钮去掉 index 入参：

```html
            <i class="el-icon-close pa-chip-close" @click.stop="cancelSelectHandle(row)"></i>
```

删除已不用的 import 与 `components` 项：`SearchBox`、`SelectGroupList`、`ConversationModel`、`IMConversationEnum`，以及模板中已删除的 `user-photo` / `group-photo` / `group-sign` 用法。保留 `CompanyDeptUser` 与 `outsource-group-select`。

- [ ] **Step 6: lint 校验**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/desktop && npx eslint src/renderer/components/chitchat/sendbox/personal-ai-data-scope-dialog.vue src/renderer/components/chitchat/sendbox/personal-ai-data-scope/`
Expected: 无输出。若报「'xxx' is defined but never used」，说明 Step 5 的 import 清理没做干净，删掉对应 import 再跑。

- [ ] **Step 7: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/sendbox/personal-ai-data-scope-dialog.vue src/renderer/components/chitchat/sendbox/personal-ai-data-scope/
git commit -m "feat(personal-ai): 选择数据来源弹窗改用 getAllImDialogue + 前端搜索 + 三段全选"
```

---

### Task 5: desktop — 筛选条透传 accountId 与三个全选标记

**涉及端：** desktop

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-memory-bar.vue`（`:scopes` 绑定处约 121 行、save 载荷约 266 行、`confirm` 回调约 316 行）

**Interfaces:**
- Consumes: Task 4 的 `confirm` 事件载荷 `{ scopes, flags }`。
- Produces: `saveDataRange` 请求体新增三个全选标记；`dataRangeScopeList` 仍为全量明细。

- [ ] **Step 1: 给弹窗传 accountId**

在 `personal-ai-memory-bar.vue` 模板中 `<personal-ai-data-scope-dialog>` 的属性里，`:scopes="dataRangeScopeList"` 之后加一行：

```html
        :account-id="accountId"
```

若组件内尚无 `accountId` 这个 computed，按本文件 `saveDataRange` 载荷里已有的当前登录人 id 取值方式补一个同名 computed。

- [ ] **Step 2: 接住 flags 并存入 data**

在 `data()` 中 `dataRangeScopeList: []` 之后新增：

```js
      // 三个全选标记，由弹窗派生后回传，随 saveDataRange 上报
      selectAllFlags: {
        groupAndAccountSelectAll: 0,
        organizationGroupSelectAll: 0,
        outreachGroupSelectAll: 0
      },
```

把弹窗 `confirm` 的处理方法体（原文件约 316 行，形如 `this.dataRangeScopeList = Array.isArray(scopes) ? scopes.slice() : [];`，入参名改为 `payload`）改为：

```js
      var scopes = (payload && payload.scopes) || [];
      var flags = (payload && payload.flags) || {};
      this.dataRangeScopeList = Array.isArray(scopes) ? scopes.slice() : [];
      this.selectAllFlags = {
        groupAndAccountSelectAll: flags.groupAndAccountSelectAll || 0,
        organizationGroupSelectAll: flags.organizationGroupSelectAll || 0,
        outreachGroupSelectAll: flags.outreachGroupSelectAll || 0
      };
```

- [ ] **Step 3: 把三个标记写进 save 载荷**

在构造 `saveDataRange` 入参处（原文件约 266 行的 `dataRangeScopeList: this.dataRangeScopeList || []`）之后追加：

```js
        groupAndAccountSelectAll: this.selectAllFlags.groupAndAccountSelectAll,
        organizationGroupSelectAll: this.selectAllFlags.organizationGroupSelectAll,
        outreachGroupSelectAll: this.selectAllFlags.outreachGroupSelectAll
```

- [ ] **Step 4: lint**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/desktop && npx eslint src/renderer/components/chitchat/sendbox/personal-ai-memory-bar.vue`
Expected: 无输出。

- [ ] **Step 5: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/desktop
git add src/renderer/components/chitchat/sendbox/personal-ai-memory-bar.vue
git commit -m "feat(personal-ai): 筛选条透传 accountId 与三个全选标记"
```

---

### Task 6: desktop — 联调抓包 + 沉淀 impl-notes

四端移植的唯一依据。**没做完这个任务，不要开 Task 7/8/9。**

**涉及端：** desktop

**Files:**
- Create: `context/features/20260729-4端重选择构数据来源弹窗/impl-notes.md`
- Modify: `context/features/20260729-4端重选择构数据来源弹窗/status.md`

**Interfaces:**
- Consumes: Task 2–5 的实现。
- Produces: impl-notes.md，含平台无关的逻辑提炼 + 联调坑，Task 7/8/9 只读它，不读 desktop 源码。

- [ ] **Step 1: 起应用**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/desktop && npm run dev:test`
Expected: Electron 窗口起来，控制台无红色报错。

- [ ] **Step 2: 抓包核对 spec 的四个待确认项**

在群聊里 `@` 自己的个人 AI → 点「数据+N」胶囊 → 打开 DevTools Network，逐条记录到 impl-notes：

1. `getAllImDialogue` 回参数组顺序是否按 `activeTime` 倒序、是否稳定（连开两次比对）；
2. 现网组织群的 `groupInfo.type` 实际取值（确认 `< 10` 成立）；
3. 勾「全部」后确定 → 重开弹窗 → `getAgentDataRange` 的 `dataRangeScopeList` 是否与候选清单等长（验证后端按 `groupAndAccountSelectAll=1` 补录）；
4. `getAllImDialogue` 回参数组长度（决定后续是否需要虚拟列表）。

- [ ] **Step 3: 核对交互清单**

逐条勾验：
- 打开弹窗只发 2 个请求（`getAgentDataRange` + `getAllImDialogue`），切 tab、打字搜索**不再发任何请求**；
- 「全部」勾满 → 表头实心勾；去「群聊」取消一个组织群 → 回「全部」变半选，且「组织群」表头也变半选；
- 组织架构里勾一个人 → 回「全部」，该人若在候选清单中同步显示已勾；
- 确定后 `saveDataRange` 载荷 `dataRangeScopeList` 为全量明细（非空）、三个标记取值正确；
- 弹窗关闭后筛选条「数据+N」的 N 与已选数一致。

- [ ] **Step 4: 写 impl-notes.md**

按仓库既有 impl-notes 结构（见 `context/features/20260727-at个人AI框-先做pc端/impl-notes.md`）写，必须覆盖：接口调用时序、选中集合与三个派生标记的算法（照抄 Task 3 的语义，不贴 Vue 代码）、外联群判据、头像规则、搜索规则、保存载荷、Step 2 抓包结论、遇到的联调坑。

- [ ] **Step 5: 更新 status.md**

把平台矩阵 desktop 列的「弹窗/页改造」「接口联调」「自测通过」按实际结果改为 ✅ / 🚧；把「待办 / 阻塞」里已由抓包解决的条目改写为结论。

- [ ] **Step 6: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260729-4端重选择构数据来源弹窗/
git commit -m "docs(4端重构选择数据来源弹窗): desktop 联调结论与 impl-notes"
```

---

### Task 7: web — PC 弹窗对齐

**涉及端：** web（仅 PC 分支；移动端走桥调原生，不改）

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/SelectDataRangeDialog.vue`
- Modify: `apps/web/src/components/views/home/commons/DataScopeBar.vue`
- Create: `apps/web/src/components/views/personal-ai/picker/dataScopeModel.ts`
- Test: `apps/web/src/components/views/personal-ai/tests/dataScopeModel.test.mjs`

**Interfaces:**
- Consumes: Task 1 契约、Task 6 的 impl-notes（**只读 impl-notes，不读 desktop 源码**）。
- Produces: `dataScopeModel.ts` 导出与 Task 3 同名同语义的函数（`makeKey` / `normalizeDialogueList` / `splitGroups` / `keysFromScopes` / `scopesFromKeys` / `filterByKeyword` / `computeSelectAllFlags`），类型引用 `context/contracts/personalAiFrame/getAllImDialogue.d.ts` 与 `saveDataRange.d.ts`。

- [ ] **Step 1: 读 impl-notes 与契约**

Run: `cd /Users/nic/w/ai-dev-workspace && cat context/features/20260729-4端重选择构数据来源弹窗/impl-notes.md context/contracts/personalAiFrame/getAllImDialogue.d.ts context/contracts/personalAiFrame/saveDataRange.d.ts`
Expected: 拿到接口时序、三个标记语义、外联群判据、头像与搜索规则。

- [ ] **Step 2: 写失败测试**

在 `apps/web/src/components/views/personal-ai/tests/dataScopeModel.test.mjs` 中，按 Task 3 Step 1 的 17 条用例逐条重写（同一份 `RAW` 夹具、同样的期望值，断言写法参考同目录既有 `*.test.mjs`）。

- [ ] **Step 3: 跑测试确认失败**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/web && npx vitest run src/components/views/personal-ai/tests/dataScopeModel.test.mjs`
Expected: FAIL，模块 `../picker/dataScopeModel` 不存在。

- [ ] **Step 4: 实现 `dataScopeModel.ts`**

用 TS 实现，语义与 Task 3 Step 3 的实现完全一致（外联群 `groupInfo.type >= 10`、群头像取前 4、空分区判 0、搜索 trim + toLowerCase 子串、忽略 `selected` 字段、保持后端顺序）。类型从契约 `.d.ts` 引入，不另造。

- [ ] **Step 5: 跑测试确认通过**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/web && npx vitest run src/components/views/personal-ai/tests/dataScopeModel.test.mjs`
Expected: PASS，17 passed。

- [ ] **Step 6: 改弹窗与 DataScopeBar**

`SelectDataRangeDialog.vue`：tab 改为「全部 / 群聊 / 组织架构」，取数改调 `getAllImDialogue`（`selectModel: 0`）一次拉全量存组件内 `ref`，搜索改本地过滤，群聊 tab 用 `splitGroups` 分组织群/外联群并各带全选行，确定时 emit `{ scopes, flags }`。组织架构 tab 与 OrgPicker 保持不变。

`DataScopeBar.vue`：接住 `{ scopes, flags }`，`saveDataRange` 载荷追加 `groupAndAccountSelectAll` / `organizationGroupSelectAll` / `outreachGroupSelectAll`。**移动端分支（`isMobileEnv()` 走 `wnsdk.aiChat.selectDataRangeScope`）一行不改。**

- [ ] **Step 7: 类型检查与 lint**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/web && npx vue-tsc --noEmit && npx eslint src/components/views/personal-ai/picker src/components/views/home/commons/DataScopeBar.vue`
Expected: 均无错误输出。

- [ ] **Step 8: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/web
git add src/components/views/personal-ai/picker src/components/views/personal-ai/tests/dataScopeModel.test.mjs src/components/views/home/commons/DataScopeBar.vue
git commit -m "feat(personal-ai): 选择数据来源弹窗改用 getAllImDialogue + 前端搜索 + 三段全选"
```

---

### Task 8: android — 原生选择页对齐

改完 android 原生页，移动端 web 的「数据范围」也随之一致（走 `selectDataRangeScope` 桥打开的就是这个页）。

**涉及端：** android

**Files:**
- Modify: `apps/android/smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select/SelectDataRangeActivity.java`
- Modify: `apps/android/smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select/SelectDataRangeAdapter.java`
- Modify: `apps/android/smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select/SelectGroupActivity.java`
- Modify: `apps/android/smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select/SelectSearchActivity.java`
- Modify: `apps/android/smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select/DataRangeScopeHelper.java`
- Create: `apps/android/smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select/DataScopeModel.java`
- Test: `apps/android/smart_message/src/test/java/com/cnmts/smart_message/personal_ai_select/DataScopeModelTest.java`

**Interfaces:**
- Consumes: Task 1 契约、Task 6 impl-notes。
- Produces: `DataScopeModel` 静态方法，与 Task 3 一一对应：`makeKey(int, String)`、`normalizeDialogueList(List<ImDialogueDto>)`、`splitGroups(List<Item>)`、`keysFromScopes(List<Scope>)`、`scopesFromKeys(Set<String>)`、`filterByKeyword(List<Item>, String)`、`computeSelectAllFlags(List<Item>, Set<String>)`。

- [ ] **Step 1: 读 impl-notes 与契约**

Run: `cd /Users/nic/w/ai-dev-workspace && cat context/features/20260729-4端重选择构数据来源弹窗/impl-notes.md context/contracts/personalAiFrame/getAllImDialogue.d.ts`
Expected: 同 Task 7 Step 1。

- [ ] **Step 2: 写失败单测**

在 `DataScopeModelTest.java` 中用 JUnit 重写 Task 3 Step 1 的 17 条用例（同一份 `RAW` 夹具，用 Java 对象构造）。

- [ ] **Step 3: 跑测试确认失败**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/android && ./gradlew :smart_message:testOnTestDebugUnitTest --tests "*DataScopeModelTest*"`
Expected: 编译失败，`DataScopeModel` 不存在。

- [ ] **Step 4: 实现 `DataScopeModel.java` 并跑通测试**

语义与 Task 3 Step 3 一致。

Run: `cd /Users/nic/w/ai-dev-workspace/apps/android && ./gradlew :smart_message:testOnTestDebugUnitTest --tests "*DataScopeModelTest*"`
Expected: BUILD SUCCESSFUL，17 tests passed。

- [ ] **Step 5: 改 Activity 与 Adapter**

- 取数改调 `getAllImDialogue`（`accountId` + `selectModel=0`），一次拉全量存成员变量，页面生命周期内不重拉；
- 纵向结构：顶部保留「选择联系人」「群聊」两个入口（分别跳 `SelectContactActivity` / `SelectGroupActivity`），下方原「最近联系人」段头文案改为「**全部**」并渲染全量候选（按后端顺序）；
- `SelectGroupActivity` 的群列表改为复用同一份候选清单，内部按 `splitGroups` 分「组织群 / 外联群」两段，各带全选行；
- `SelectSearchActivity` 改为在传入的全量清单上本地过滤，不再发请求；
- 头像：人用 `privateInfo.avatar`，群用 `groupInfo.accountInfoList` 前 4 人拼合（复用 `DataRangeAvatarHelper`）；
- 确定时 `DataRangeScopeHelper` 组 `saveDataRange` 载荷，追加三个全选标记。

- [ ] **Step 6: 构建校验**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/android && ./gradlew assembleOnTestDebug`
Expected: BUILD SUCCESSFUL。

- [ ] **Step 7: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/android
git add smart_message/src/main/java/com/cnmts/smart_message/personal_ai_select smart_message/src/test/java/com/cnmts/smart_message/personal_ai_select
git commit -m "feat(personal-ai): 选择数据来源页改用 getAllImDialogue + 本地搜索 + 三段全选"
```

---

### Task 9: ios — 原生选择页对齐

**涉及端：** ios

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/SelectAiAgent/ZXSelectAiAgentController.m`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/SelectAiAgent/ZXSelectDataRangeBottomView.m`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentManager.m`
- Create: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/SelectAiAgent/ZXDataScopeModel.h`
- Create: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/SelectAiAgent/ZXDataScopeModel.m`

**Interfaces:**
- Consumes: Task 1 契约、Task 6 impl-notes。
- Produces: `ZXDataScopeModel` 类方法，与 Task 3 一一对应：`+makeKeyWithType:scopeId:`、`+normalizeDialogueList:`、`+splitGroups:`、`+keysFromScopes:`、`+scopesFromKeys:`、`+filterItems:keyword:`、`+computeSelectAllFlags:selectedKeys:`。

- [ ] **Step 1: 读 impl-notes 与契约**

Run: `cd /Users/nic/w/ai-dev-workspace && cat context/features/20260729-4端重选择构数据来源弹窗/impl-notes.md context/contracts/personalAiFrame/getAllImDialogue.d.ts`
Expected: 同 Task 7 Step 1。

- [ ] **Step 2: 实现 `ZXDataScopeModel`**

语义与 Task 3 Step 3 一致（外联群 `groupInfo.type >= 10`、群头像前 4、空分区 0、搜索 trim + lowercase 子串、忽略 `selected`、保持后端顺序）。

- [ ] **Step 3: 改选择页**

- 取数改调 `getAllImDialogue`（`accountId` + `selectModel=0`），一次拉全量缓存在 controller，页面生命周期内不重拉；
- 纵向结构：顶部「选择联系人」「群聊」入口，下方原「最近联系人」段头改「**全部**」并渲染全量候选（按后端顺序）；
- 群聊页复用同一份数据，按 `splitGroups` 分「组织群 / 外联群」两段，各带全选行；
- 搜索子页改本地过滤，不发请求；
- 头像：人用 `privateInfo.avatar`，群用 `groupInfo.accountInfoList` 前 4 人拼合；
- 确定时在 `ZXAIAgentManager` 的 `saveDataRange` 载荷里追加三个全选标记。

- [ ] **Step 4: 构建校验**

Run: `cd /Users/nic/w/ai-dev-workspace/apps/ios && xcodebuild -workspace SmartMessage.xcworkspace -scheme zhixinAppTest -sdk iphonesimulator -configuration Debug build | tail -5`
Expected: `** BUILD SUCCEEDED **`。

- [ ] **Step 5: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/ios
git add SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/SelectAiAgent SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentManager.m
git commit -m "feat(personal-ai): 选择数据来源页改用 getAllImDialogue + 本地搜索 + 三段全选"
```

---

### Task 10: 四端 E2E 与文档收尾

**涉及端：** 多端

**Files:**
- Modify: `context/features/20260729-4端重选择构数据来源弹窗/status.md`
- Modify: `context/features/20260729-4端重选择构数据来源弹窗/impl-notes.md`

**Interfaces:**
- Consumes: Task 6–9 的实现与联调结论。
- Produces: 四端矩阵全绿的 status.md + 补齐各端坑的 impl-notes.md。

- [ ] **Step 1: 四端逐条跑 E2E 清单**

每端都跑：
1. 打开弹窗只发 `getAgentDataRange` + `getAllImDialogue` 两个请求；
2. 切视图、打字搜索无任何网络请求；
3. 「全部」勾满 → 表头实心勾；去群聊取消一个组织群 → 「全部」与「组织群」同时变半选；
4. 组织架构勾的人与「全部」里的同一人勾选态互通；
5. 确定 → `saveDataRange` 载荷含全量 `dataRangeScopeList`（非空）+ 三个标记取值正确；
6. 重开弹窗返显与上次一致；
7. 移动端 web：在 WebView 里点「数据范围」，确认打开的是改造后的原生页，ACK 后筛选条数字刷新。

- [ ] **Step 2: 回归群智能体主流程**

群聊 `@` 群智能体 → 改筛选 → 发送 → 收到回复。确认本次改动**未影响**群侧记忆条（本期只改个人 AI 的 DataScope 弹窗）。

- [ ] **Step 3: 更新 status.md 与 impl-notes.md**

status.md：平台矩阵四端四行按实际置 ✅ / ❌；「待办 / 阻塞」清空已完成项，保留真实遗留项。
impl-notes.md：把 Task 7/8/9 各端遇到的坑补进「联调坑」小节（尤其各端头像拼合与全选行的差异）。

- [ ] **Step 4: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260729-4端重选择构数据来源弹窗/
git commit -m "docs(4端重构选择数据来源弹窗): 四端 E2E 结论与收尾"
```

---

### Task 11: web/desktop 搜索 UI 对齐发送目标（popover 本地搜）

**Goal:** 「选择数据范围」顶栏搜索改为 popover；本地过滤、零接口；主列表不随关键字过滤。

**Files:**
- Modify: `apps/web/.../SelectDataRangeDialog.vue`
- Modify: `apps/desktop/.../personal-ai-data-scope-dialog.vue`
- Create: `apps/desktop/.../personal-ai-data-scope/data-scope-search-box.vue`
- Modify: feature `spec.md` / `impl-notes.md` / `status.md`

- [x] Step 1: 决策确认（popover + 全量候选 + 主列表不过滤）
- [x] Step 2: web 换 `AiBoxSearchBox`（`candidates` + `multi`），去掉主列表 `filterByKeyword`
- [x] Step 3: desktop 新增本地搜索 popover 组件并对齐 footer chip 头像
- [x] Step 4: 更新 impl-notes / status 并 context commit

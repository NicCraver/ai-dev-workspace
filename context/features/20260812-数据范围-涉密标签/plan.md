# 数据范围-涉密标签 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。

**Goal：** 「选择数据范围」全部落点（全部/群组/组织架构/搜索/已选）给涉密对象、已离职对象叠加同款 tag，去掉现有「（已离职）」姓名后缀写法；弹窗底部新增涉密说明图标按钮，点击展开/收起固定说明文案。

**Architecture：** `getAllImDialogue` 一次性拉取的候选清单是标记的唯一数据源（`ignoreChatType`=涉密、`privateInfo.leave`=已离职），在 `dataScopeModel.js` 归一化阶段就地产出 `isSecret`/`isResigned` 布尔字段，替换掉原来拼进 `name` 里的后缀逻辑。`AiBoxRow`/`AiBoxSearchRow`（全部/群组/搜索）以及已选 chip 直接读 item 上的这两个字段即可，因为它们的数据源本来就是同一份归一化清单。唯一例外是「组织架构」tab —— 它的行数据来自单独的组织树接口、不带这两个字段，所以由 `SelectDataRangeDialog` 用已拉到的候选清单建一份 `accountId → {isSecret, isResigned}` 的查找表，通过新 prop 传给 `OrgPicker` 按 id 回填。tag 视觉本身抽成一个两端复用的小组件 `DataScopeTag.vue`。

**Tech Stack：** web Vue3 Composition API + `<script setup>` + UnoCSS；纯逻辑模块用 `node --test` 覆盖，Vue 组件本项目无自动化测试框架，按手动验证收尾（沿用 `20260805-数据范围-筛选条迭代` 的验证方式）。

## Global Constraints

- 涉密 tag：文案「涉密」，背景 `#FFF3DA`，文字 `#FEAC00`，圆角 2px。
- 已离职 tag：文案「已离职」，背景 `#E5E5E6`，文字复用项目既有 `grayMedium`（class `text-gray-medium` / `#8F959E`），圆角同涉密。两者用**同一个 tag 组件**，只切配色，不再用括号后缀。
- 共存顺序：涉密在前、已离职在后，并排展示；姓名/群名过长时两个 tag 必须完整展示，姓名/群名用标准 CSS 省略号截断（不做额外溢出图标）。
- 判定：`Number(item.ignoreChatType) === 1` → 涉密（私聊/群聊都适用）；私聊 `Number(privateInfo.leave) === 1` → 已离职（群聊恒 false）。三标记类字段历史上可能回传字符串，一律 `Number()` 比较，不用严格 `=== 1`。
- 说明图标按钮只挂在弹窗底部工具栏（非行内 tag），点击 toggle 显示/隐藏固定文案，点击气泡外自动关闭（`el-popover trigger="click"` 原生行为），不发请求。固定文案：「人力部门人员、公司全员群，聊天记录与文件涉密，不参与AI分析」。
- 涉密图标素材 `apps/web/src/assets/svg/secret.svg` 已建好并接入 `src/assets/index.ts`（`SvgIcon name="secret"`），本 plan 不重复处理。
- 契约 `context/contracts/personalAiFrame/getAllImDialogue.d.ts` 的 `ignoreChatType` 字段已就绪、后端已上线，不需要再改契约或等联调。
- 移动端「选择数据范围」现状 100% 走 wnsdk 桥接原生页面，本期**不新建** mobile web 页面；只有 android/ios 原生代码需要改（见文末「跨端移植」）。
- `apps/web` 提交前自检：`pnpm format` + `pnpm exec vue-tsc --noEmit`。

---

## Web（参考实现端）

### Task 1: dataScopeModel 归一化产出 isSecret / isResigned

**端：** web

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/dataScopeModel.js`
- Modify: `apps/web/src/components/views/personal-ai/tests/dataScopeModel.test.mjs`

**Interfaces:**
- Produces：`normalizeDialogueList` 归一化项新增两个字段：
  - `isSecret: boolean`（私聊/群聊都可能为 true）
  - `isResigned: boolean`（仅私聊可能为 true，群聊恒 `false`）
- 移除：归一化项 `name` 不再拼接「（已离职）」后缀。

- [ ] **Step 1: 写失败的测试（新增用例，替换旧的后缀断言）**

在 `dataScopeModel.test.mjs` 中：

1) 把「归一化人：完整字段（深度相等）」这个既有用例的期望对象补上新字段（放在 `agentAvatar: null,` 之后）：

```js
  it("归一化人：完整字段（深度相等）", () => {
    const [first] = normalizeDialogueList(RAW);
    assert.deepEqual(first, {
      key: "1_u1",
      scopeDataType: 1,
      scopeDataId: "u1",
      id: "u1",
      name: "张三",
      isGroup: false,
      isOutreach: false,
      ownerType: "private",
      avatar: "a-u1",
      groupAvatars: [],
      accountInfoList: [],
      agentName: null,
      agentAvatar: null,
      isSecret: false,
      isResigned: false,
    });
  });
```

2) 把原来的「私聊 leave===1 时 name 后缀「（已离职）」…」用例整体替换为：

```js
  it("私聊 leave===1 时 isResigned=true 且 name 不再拼后缀；leave=0/缺省为 false", () => {
    const items = normalizeDialogueList([
      {
        type: 1,
        targetId: "u-left",
        targetName: "王五",
        privateInfo: { avatar: "a", leave: 1 },
      },
      {
        type: 1,
        targetId: "u-ok",
        targetName: "赵六",
        privateInfo: { avatar: "b", leave: 0 },
      },
      { type: 1, targetId: "u-no", targetName: "钱七", privateInfo: { avatar: "c" } },
    ]);
    assert.equal(items[0].name, "王五");
    assert.equal(items[0].isResigned, true);
    assert.equal(items[1].isResigned, false);
    assert.equal(items[2].isResigned, false);
  });

  it("ignoreChatType===1 时 isSecret=true（私聊/群聊均适用）；0/缺省/字符串\"1\"", () => {
    const items = normalizeDialogueList([
      { type: 1, targetId: "u-secret", targetName: "李密", ignoreChatType: 1 },
      { type: 1, targetId: "u-open", targetName: "王开", ignoreChatType: 0 },
      { type: 1, targetId: "u-default", targetName: "赵默" },
      {
        type: 3,
        targetId: "g-secret",
        targetName: "涉密群",
        ignoreChatType: "1",
        groupInfo: { type: 1 },
      },
    ]);
    assert.equal(items[0].isSecret, true);
    assert.equal(items[1].isSecret, false);
    assert.equal(items[2].isSecret, false);
    assert.equal(items[3].isSecret, true);
    assert.equal(items[3].isResigned, false);
  });
```

- [ ] **Step 2: 跑测确认失败**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/dataScopeModel.test.mjs
```

预期：FAIL（`isSecret`/`isResigned` 为 `undefined`，深度相等失败；`name` 仍带旧后缀）

- [ ] **Step 3: 实现**

在 `normalizeDialogueList` 内，把：

```js
    let name = raw.targetName ?? "";
    if (!isGroup && Number(raw.privateInfo?.leave) === 1) {
      name = `${name}（已离职）`;
    }
```

替换为：

```js
    const name = raw.targetName ?? "";
    const isSecret = Number(raw.ignoreChatType) === 1;
    const isResigned = !isGroup && Number(raw.privateInfo?.leave) === 1;
```

然后在群分支 push 的对象里、`agentAvatar: raw.agentAvatar ?? null,` 之后加：

```js
        isSecret,
        isResigned: false,
```

在私聊分支 push 的对象里、`agentAvatar: raw.agentAvatar ?? null,` 之后加：

```js
        isSecret,
        isResigned,
```

同时更新文件顶部 `NormalizedDialogueItem` 的 JSDoc：删掉 `name` 属性描述里「私聊 leave===1 时后缀「（已离职）」」这句，新增两行：

```js
 * @property {boolean} isSecret 是否涉密（ignoreChatType===1，私聊/群聊均适用）
 * @property {boolean} isResigned 是否已离职（仅私聊；privateInfo.leave===1）
```

以及函数上方注释里那条「私聊且 `Number(privateInfo.leave) === 1` 时，`name` 后缀追加...」也删掉，改成一句：「`isSecret`/`isResigned` 由 `ignoreChatType`/`privateInfo.leave` 归一化产出，不再拼进 `name`」。

- [ ] **Step 4: 跑测通过**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/dataScopeModel.test.mjs
```

预期：PASS（全部用例）

- [ ] **Step 5: Commit**

```bash
cd apps/web
git add src/components/views/personal-ai/picker/dataScopeModel.js src/components/views/personal-ai/tests/dataScopeModel.test.mjs
git commit -m "feat(data-scope): 归一化产出 isSecret/isResigned，去掉离职姓名后缀"
```

---

### Task 2: DataScopeTag 共用标签组件

**端：** web

**Files:**
- Create: `apps/web/src/components/views/personal-ai/picker/DataScopeTag.vue`

**Interfaces:**
- Produces：`DataScopeTag`，`props: { type: 'secret' | 'resigned' }`，无 emit。

- [ ] **Step 1: 创建组件**

```vue
<template>
  <!-- 涉密/已离职共用 tag：同尺寸圆角，仅配色与文案不同 -->
  <span
    class="inline-flex items-center h-4.5 px-1 rounded-2px text-3 leading-none shrink-0"
    :class="
      type === 'secret'
        ? 'bg-#FFF3DA text-#FEAC00'
        : 'bg-#E5E5E6 text-gray-medium'
    "
  >{{ type === "secret" ? "涉密" : "已离职" }}</span>
</template>

<script setup>
defineProps({
  /** 'secret'=涉密（橙）；'resigned'=已离职（灰） */
  type: {
    type: String,
    required: true,
    validator: (v) => v === "secret" || v === "resigned"
  }
});
</script>
```

- [ ] **Step 2: 手动验证**

临时在任意已挂载页面（或下一任务改完的 `AiBoxRow`）里各渲染一次 `type="secret"` 和 `type="resigned"`，用浏览器 devtools 核对：橙色块背景 `#FFF3DA`、文字 `#FEAC00`；灰色块背景 `#E5E5E6`、文字 `#8F959E`；两者内边距/高度/圆角一致。确认后可以删掉临时渲染（后续任务会有正式落点）。

- [ ] **Step 3: Commit**

```bash
cd apps/web
git add src/components/views/personal-ai/picker/DataScopeTag.vue
git commit -m "feat(data-scope): 新增涉密/已离职共用 tag 组件"
```

---

### Task 3: AiBoxRow 接入 tag（全部/群组 tab）

**端：** web

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/AiBoxRow.vue`

**Interfaces:**
- Consumes：`DataScopeTag`（Task 2）；`item.isSecret` / `item.isResigned`（Task 1）。

- [ ] **Step 1: 改名称行为 flex 容器，塞入 tag**

把：

```html
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <span class="text-3.5 text-black truncate">
        {{ item.name || item.scopeDataId || item.id || ""
        }}<span
          v-if="showMemberCount && item.ownerType === 'group' && item.memberCount"
          class="text-gray-medium"
        >（{{ item.memberCount }}）</span>
      </span>
      <span
        v-if="showAgentName && item.agentName"
        class="text-3 text-gray-medium truncate"
      >{{ item.agentName }}</span>
    </div>
```

替换为：

```html
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <div class="flex items-center gap-1 min-w-0">
        <span class="text-3.5 text-black truncate min-w-0">
          {{ item.name || item.scopeDataId || item.id || ""
          }}<span
            v-if="showMemberCount && item.ownerType === 'group' && item.memberCount"
            class="text-gray-medium"
          >（{{ item.memberCount }}）</span>
        </span>
        <DataScopeTag v-if="item.isSecret" type="secret" />
        <DataScopeTag v-if="item.isResigned" type="resigned" />
      </div>
      <span
        v-if="showAgentName && item.agentName"
        class="text-3 text-gray-medium truncate"
      >{{ item.agentName }}</span>
    </div>
```

- [ ] **Step 2: import 组件**

在 `<script setup>` 顶部加：

```js
import DataScopeTag from "./DataScopeTag.vue";
```

- [ ] **Step 3: 手动验证**

打开「选择数据范围」弹窗「全部」tab（需要联调环境或 mock 数据里有 `ignoreChatType`/`leave` 字段的项），确认：涉密项显示橙色 tag、已离职项显示灰色 tag、两者共存时并排且顺序涉密在前；把某一行姓名换成很长字符串（本地临时改 mock）确认姓名截断、tag 不被挤丢。

- [ ] **Step 4: Commit**

```bash
cd apps/web
git add src/components/views/personal-ai/picker/AiBoxRow.vue
git commit -m "feat(data-scope): 全部/群组行接入涉密/已离职 tag"
```

---

### Task 4: AiBoxSearchRow 接入 tag（搜索）

**端：** web

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/search/AiBoxSearchRow.vue`

**Interfaces:**
- Consumes：`DataScopeTag`（Task 2）；`item.isSecret` / `item.isResigned`（Task 1，`searchCandidates` 直接复用 `dialogueItems`，已带这两个字段）。

- [ ] **Step 1: 同 Task 3 手法接入**

把：

```html
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <span class="text-3.5 text-black truncate">
        <span v-html="highlightKeyword(item.name, keyword)"></span
        ><span
          v-if="showMemberCount && item.ownerType === 'group' && item.memberCount"
          class="text-gray-medium"
        >（{{ item.memberCount }}）</span>
      </span>
      <span
        v-if="showAgentName && item.agentName"
        class="text-3 text-gray-medium truncate"
        v-html="highlightKeyword(item.agentName, keyword)"
      ></span>
    </div>
```

替换为：

```html
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <div class="flex items-center gap-1 min-w-0">
        <span class="text-3.5 text-black truncate min-w-0">
          <span v-html="highlightKeyword(item.name, keyword)"></span
          ><span
            v-if="showMemberCount && item.ownerType === 'group' && item.memberCount"
            class="text-gray-medium"
          >（{{ item.memberCount }}）</span>
        </span>
        <DataScopeTag v-if="item.isSecret" type="secret" />
        <DataScopeTag v-if="item.isResigned" type="resigned" />
      </div>
      <span
        v-if="showAgentName && item.agentName"
        class="text-3 text-gray-medium truncate"
        v-html="highlightKeyword(item.agentName, keyword)"
      ></span>
    </div>
```

并在 `<script setup>` 顶部加 `import DataScopeTag from "../DataScopeTag.vue";`（注意相对路径比 `AiBoxRow.vue` 多一层 `search/`）。

- [ ] **Step 2: 手动验证**

弹窗内搜索一个涉密/已离职对象的姓名，确认搜索结果行 tag 正常显示、关键词高亮不受影响。

- [ ] **Step 3: Commit**

```bash
cd apps/web
git add src/components/views/personal-ai/picker/search/AiBoxSearchRow.vue
git commit -m "feat(data-scope): 搜索结果行接入涉密/已离职 tag"
```

---

### Task 5: OrgPicker 接入 tag（组织架构 tab）

**端：** web

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/OrgPicker.vue`

**Interfaces:**
- Consumes：`DataScopeTag`（Task 2）
- Produces：新 prop `secretTagLookup: Map<string, { isSecret: boolean, isResigned: boolean }> | null`（默认 `null`，其它调用方不传时行为不变，不出 tag）

- [ ] **Step 1: 新增 prop**

在 `defineProps({ ... })` 里、`externalNav` 那项后加一个逗号，追加：

```js
  /**
   * 涉密/已离职查找表：accountId → { isSecret, isResigned }。
   * 只有「选择数据范围」会传；不传时（如「选择 AI 框」复用本组件）不出 tag。
   */
  secretTagLookup: {
    type: Object, // Map 实例
    default: null
  }
```

- [ ] **Step 2: 加取值 helper**

在 `<script setup>` 里（`props`/`emit` 定义之后任意位置）加：

```js
const tagInfoFor = (accountId) =>
  (props.secretTagLookup && props.secretTagLookup.get(accountId)) || {
    isSecret: false,
    isResigned: false
  };
```

- [ ] **Step 3: 改人员行模板**

把（原 105-135 行附近）：

```html
            <div class="flex-1 min-w-0 flex flex-col gap-1">
              <span class="text-3.5 text-black truncate">{{ row.user.name }}</span>
              <span
                v-if="showAgentName && row.user.agentName"
                class="text-3 text-gray-medium truncate"
                >{{ row.user.agentName }}</span
              >
            </div>
```

替换为：

```html
            <div class="flex-1 min-w-0 flex flex-col gap-1">
              <div class="flex items-center gap-1 min-w-0">
                <span class="text-3.5 text-black truncate min-w-0">{{ row.user.name }}</span>
                <DataScopeTag v-if="tagInfoFor(row.user.accountId).isSecret" type="secret" />
                <DataScopeTag v-if="tagInfoFor(row.user.accountId).isResigned" type="resigned" />
              </div>
              <span
                v-if="showAgentName && row.user.agentName"
                class="text-3 text-gray-medium truncate"
                >{{ row.user.agentName }}</span
              >
            </div>
```

- [ ] **Step 4: import 组件**

`<script setup>` 顶部加 `import DataScopeTag from "./DataScopeTag.vue";`

- [ ] **Step 5: 手动验证（待 Task 6 传入真实 lookup 后再测）**

先确认不传 `secretTagLookup`（`SelectAiBoxDialog`/`SelectAiBoxPopup` 场景）时组件渲染不报错、不出 tag（`tagInfoFor` 兜底空对象）。组织架构 tab 内涉密/已离职展示留到 Task 6 接上真实数据后一起验证。

- [ ] **Step 6: Commit**

```bash
cd apps/web
git add src/components/views/personal-ai/picker/OrgPicker.vue
git commit -m "feat(data-scope): OrgPicker 支持按 accountId 回填涉密/已离职 tag"
```

---

### Task 6: SelectDataRangeDialog 收口——组织架构查找表 + 已选 chip + 说明气泡

**端：** web

**Files:**
- Modify: `apps/web/src/components/views/personal-ai/picker/SelectDataRangeDialog.vue`

**Interfaces:**
- Consumes：`OrgPicker` 新 prop `secretTagLookup`（Task 5）；`DataScopeTag`（Task 2）；`item.isSecret`/`item.isResigned`（Task 1，`resolveSelectedItem` 优先命中 `dialogueByKey`，已带这两个字段）。

- [ ] **Step 1: 建组织架构用的查找表**

在 `groupPartitions` 计算属性附近加一个新计算属性：

```js
/** 组织架构 tab 用：accountId → {isSecret, isResigned}（仅私聊项） */
const orgSecretTagLookup = computed(() => {
  const map = new Map();
  for (const it of dialogueItems.value) {
    if (it.ownerType === "private") {
      map.set(it.scopeDataId, { isSecret: it.isSecret, isResigned: it.isResigned });
    }
  }
  return map;
});
```

- [ ] **Step 2: 传给 OrgPicker**

把：

```html
          <OrgPicker
            multi
            :show-agent-name="false"
            :selected-keys="selectedKeysForOrg"
            @toggle="toggleItem"
          />
```

改为：

```html
          <OrgPicker
            multi
            :show-agent-name="false"
            :selected-keys="selectedKeysForOrg"
            :secret-tag-lookup="orgSecretTagLookup"
            @toggle="toggleItem"
          />
```

- [ ] **Step 3: 已选 chip 加 tag**

把已选弹层里 chip 的这段（`<span class="text-3 text-black truncate max-w-28">{{ item.name || item.scopeDataId }}</span>` 所在的 `<div class="flex items-center gap-1.5 ...">` 块）：

```html
              <div
                v-for="item in selectedItems"
                :key="item.key"
                class="flex items-center gap-1.5 max-w-full h-7 pl-1 pr-1.5 rounded-full bg-#F4F6F8"
              >
                <AcAvatar
                  v-if="item.ownerType === 'private'"
                  :user="item"
                  hasThumb
                  class="!w-5 !h-5 shrink-0"
                />
                <AcGroupAvatar
                  v-else-if="item.accountInfoList?.length"
                  :accountList="item.accountInfoList"
                  hasThumb
                  class="!w-5 !h-5 shrink-0"
                />
                <AcAvatar
                  v-else
                  :user="item"
                  hasThumb
                  class="!w-5 !h-5 shrink-0"
                />
                <span class="text-3 text-black truncate max-w-28">{{
                  item.name || item.scopeDataId
                }}</span>
                <button
                  type="button"
                  class="flex items-center justify-center w-4 h-4 rounded-full bg-#D8D8D8 text-white shrink-0"
                  @click.stop="removeItem(item)"
                >
                  <SvgIcon name="close" class="w-2.5 h-2.5" />
                </button>
              </div>
```

改为（只在 name 与关闭按钮之间插入两个 tag，其余不动）：

```html
              <div
                v-for="item in selectedItems"
                :key="item.key"
                class="flex items-center gap-1.5 max-w-full h-7 pl-1 pr-1.5 rounded-full bg-#F4F6F8"
              >
                <AcAvatar
                  v-if="item.ownerType === 'private'"
                  :user="item"
                  hasThumb
                  class="!w-5 !h-5 shrink-0"
                />
                <AcGroupAvatar
                  v-else-if="item.accountInfoList?.length"
                  :accountList="item.accountInfoList"
                  hasThumb
                  class="!w-5 !h-5 shrink-0"
                />
                <AcAvatar
                  v-else
                  :user="item"
                  hasThumb
                  class="!w-5 !h-5 shrink-0"
                />
                <span class="text-3 text-black truncate max-w-28">{{
                  item.name || item.scopeDataId
                }}</span>
                <DataScopeTag v-if="item.isSecret" type="secret" />
                <DataScopeTag v-if="item.isResigned" type="resigned" />
                <button
                  type="button"
                  class="flex items-center justify-center w-4 h-4 rounded-full bg-#D8D8D8 text-white shrink-0"
                  @click.stop="removeItem(item)"
                >
                  <SvgIcon name="close" class="w-2.5 h-2.5" />
                </button>
              </div>
```

- [ ] **Step 4: 底部说明图标按钮 + 气泡**

在 `#footer-left` 插槽里、「已选：」`el-popover` 的 `</el-popover>` 之后（仍在同一个 `<div class="flex items-center gap-3 min-w-0">` 内）加：

```html
        <el-popover
          trigger="click"
          placement="top-start"
          :width="280"
          popper-class="!p-3 !rounded-2"
        >
          <template #reference>
            <button
              type="button"
              class="flex items-center gap-1 text-#5D616B text-3.5 select-none shrink-0"
              @click.stop
            >
              <SvgIcon name="secret" class="w-3.5 h-3.5 text-#FEAC00" />
              涉密
            </button>
          </template>
          <span class="text-3 text-#5D616B leading-5">
            人力部门人员、公司全员群，聊天记录与文件涉密，不参与AI分析
          </span>
        </el-popover>
```

- [ ] **Step 5: import 组件**

`<script setup>` 顶部加 `import DataScopeTag from "./DataScopeTag.vue";`

- [ ] **Step 6: 手动验证**

1. 打开弹窗「全部」/「群组」/「组织架构」/搜索 tab，逐一确认涉密/已离职 tag 展示正确（含长姓名截断场景）。
2. 展开「已选」弹层，确认 chip 上也带 tag。
3. 点击底部「涉密」图标按钮：气泡弹出，文案与固定文案一致；再点一次或点气泡外任意位置：气泡收起。
4. `pnpm exec vue-tsc --noEmit` 通过。

- [ ] **Step 7: Commit**

```bash
cd apps/web
git add src/components/views/personal-ai/picker/SelectDataRangeDialog.vue
git commit -m "feat(data-scope): 组织架构/已选 tag 回填 + 涉密说明气泡"
```

---

### Task 7: web 自测清单 + impl-notes（web 完成后）

**端：** web（文档写在 context 仓库）

- [ ] 按 spec 用户流程 1-6 逐条过一遍，勾选通过
- [ ] `pnpm format && pnpm exec vue-tsc --noEmit` 通过
- [ ] 写 `context/features/20260812-数据范围-涉密标签/impl-notes.md`（平台无关提炼，供后续 `/port` 使用）：
  - 数据来源判定规则（`ignoreChatType`/`leave` → `isSecret`/`isResigned`，Number() 比较，非严格 === 1）
  - tag 视觉规格表（复制 spec 里那张表）
  - 「组织架构类落点数据源不带标记字段，需要前端按 id 从全量候选清单回填」这条架构结论（对 android/ios 原生实现同样适用：其组织架构选人页大概率也是独立接口，需要同样的本地回填思路）
  - 说明气泡：纯前端静态文案、点击 toggle、无需请求接口
  - 已离职由「姓名后缀」改「独立 tag」这条变更（提醒移植时同步去掉原生端可能存在的类似后缀逻辑）
- [ ] wrapup：更新 `status.md` 平台矩阵 web 列 + 待办里加三条「(android/ios/desktop) 待 /port」

---

## 跨端移植（后续，非本 plan 执行范围）

按仓库根 `CLAUDE.md` 的跨端移植规则：Task 7 的 `impl-notes.md` 写好后，desktop / android / ios 各自用 `/port` 技能移植，**不要**在本 plan 里预先臆测三端的原生文件路径——`/port` 会在执行时只读 `impl-notes.md` + `context/contracts/` + 目标端 `context/platforms/<端>.md`，用目标端惯用范式实现，禁止照抄 web 代码。

- [x] `/port desktop`（commit `443a4e85`，`personal-ai-chat-hotfix`，未 push）——eslint + 模板编译过，未跑 `npm run dev` 真机验证
- [x] `/port android`（commit `0f6100be3`，`personal-ai-chat-hotfix`，未 push）——`assembleDevelopDebug` BUILD SUCCESSFUL，`DataScopeModelTest` 单测过
- [x] `/port ios`（commit `0646ddd6`，`personal-ai-chat-hotfix`，未 push）——按仓库规定未跑 `xcodebuild`，需人工 Xcode clean build 确认

三端各自完成后回填 `status.md` 平台矩阵。

---

## Spec coverage（自检）

| Spec 项 | Task |
|---------|------|
| 涉密判定 `ignoreChatType===1` | 1 |
| 已离职判定 `leave===1`，去掉姓名后缀 | 1 |
| tag 视觉规格（配色/圆角/共存顺序） | 2, 3, 4, 5, 6 |
| 全部/群组 tab | 3 |
| 搜索 | 4 |
| 组织架构 tab（前端按 id 回填） | 5, 6 |
| 已选 chip | 6 |
| 长名截断，tag 不被挤丢 | 3, 4, 5, 6（手动验证步骤） |
| 底部说明图标按钮 + 气泡交互 + 固定文案 | 6 |
| 涉密图标素材 | Global（已在 brainstorm 阶段完成） |
| 契约无需变更 | Global |
| 移动端不新建 web 页面 | Global |
| impl-notes 供移植 | 7 |
| 四端落点 | 7（web）+ 跨端移植章节（desktop/android/ios） |

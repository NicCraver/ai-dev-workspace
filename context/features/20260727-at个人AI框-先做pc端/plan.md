# at个人AI框（先做 PC）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 群聊可 `@` 自己的个人 AI 框；选定后显示独立筛选条（知识类型 + DataScope + 时间 + 联网）；发送走 `aiRobtChat` 旁路并带齐 `agentId` / `dataRangeScopeList`。

**Architecture:** 在现网 `@` 群智能体链路上按 `agentKind: 'group' | 'personal'` 分流。群筛选继续用 `AgentMemoryBar`；个人 AI 新建 `PersonalAiMemoryBar` + DataScope 弹窗（复用转发取数通道、无 9 上限）。共享 `ga_` 判断点全部改认 `agentKind`，保证群行为不变、个人逻辑不夹进群分支。

**Tech Stack:** `apps/desktop` — Electron 19 + Vue 2.7；element-ui；既有 `$service.getAgentDataRange` / `saveDataRange` / `aiRobtChat` / `groupInfoApi`。无单测框架 → 验收靠 `npm run lint` + 真机 E2E。**禁止**可选链 `?.` / 空值合并 `??`。

**Design doc:** [`spec.md`](./spec.md)

## Global Constraints

- **仅改 desktop**：`apps/desktop/`；web 只作 UI/选择交互参考，不移植组件与判断逻辑。
- **隔离**：共享点一律按 `agentKind` 分支；禁止在群分支夹带个人 AI 字段/请求。
- **判别**：不能只靠 `ga_`；插入 `@` 时写入 `agentKind`；`groupAgentType` 群=3 / 个人=0。
- **工具栏「@智能体」**：只插群智能体（现网行为）。
- **互斥**：智能体（群或个人）合计最多一个；已有智能体后再 `@` → 列表不显示两类智能体，仍可 `@人`。
- **发送**：`agentId` 群与个人均必传；`aiRoleId` 两边仍 `'1'`；`dataRangeScopeList` 仅个人带。
- **胶囊**：知识类型「类型+N」（群侧同步）；DataScope「数据+N」。
- **DataScope 显示**：组件内只判勾选含 `1`/`2`/`4`；`null` scope → `[]`；选择无上限。
- **工程**：提交只 push `personal-ai-chat`；中文注释/`console.log`。
- **验证**：每任务结束至少改动文件无语法问题；关键路径真机 E2E（见 Task 9）。

## Plan Defaults（spec 待补项落地）

> 实现前若产品改口，先改 spec「已决」再改代码。

| 开项 | 默认（对齐现网群智能体） |
|------|--------------------------|
| 取消 `@` / 清空 / 发送成功 | 筛选条**立即隐藏**（`hasXxxMention` watcher → visible=false → bar.reset） |
| 草稿恢复 | **带回筛选条可见性**；筛选内容**不**嵌草稿，靠 `getAgentDataRange` 再拉 |
| `groupAgentRels` 时机 | 与群智能体同路：`initList` 时读 `groupInfoApi` 的 `groupAgentRels`；切会话清空 `originPeopleList` 迫使重拉。本期不做「个人 AI 新建/删除」实时推送刷新 |
| get 失败 | bar 保持空/默认，`console.log`，不 toast（对齐群） |
| save 失败 | `console.log`，不 toast；本期不加防抖（对齐群） |

## File Structure

**新建**（路径均相对 `apps/desktop/src/renderer/`）：

| 文件 | 职责 |
|------|------|
| `components/chitchat/sendbox/personal-ai-memory-bar.vue` | 个人 AI 筛选条：知识类型 + DataScope 胶囊 + 时间 + 联网；`updateFromAgentSetting` / `getMemoryData` / `reset`；emit `memory-change` |
| `components/chitchat/sendbox/personal-ai-data-scope-dialog.vue` | 选人/群弹窗：复用转发五条取数；选择模型映射 `scopeDataType`+`scopeDataId`；**无 9 上限** |

**修改：**

| 文件 | 改什么 |
|------|--------|
| `components/chitchat/sendbox/send-box.vue` | `agentKind` 分流：computed / watcher / 草稿 / `@` 列表 / 工具栏 / `agentChatData` |
| `components/chitchat/sendbox/agent-memory-bar.vue` | 胶囊文案「数据+N」→「类型+N」 |
| `components/chitchat/chat-box.vue` | 挂载个人条；独立 fetch/save；`@` 列表身份标签；`msg-refer` class |
| `context/features/.../status.md` / `impl-notes.md` | 矩阵与联调笔记（实现过程中更新） |

**只读对照（禁止误改逻辑）：** web `FilterBar` / `DataScopeBar`；`context/platforms/desktop-forward-dialog.md`；契约三件套。

**既有服务（不改签名，只换调用参数）：** `service/aiBasic.js` 的 `getAgentDataRange` / `saveDataRange` / `aiRobtChat`。

---

### Task 1: send-box — `agentKind` 基础分流

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/sendbox/send-box.vue`（computed ~475、watch ~526、草稿 ~563/~982/~1017、`insertAgentMention` ~761、`atUserList` ~1415）

**Interfaces:**
- Produces:
  - `aSomeOneList` 项可含 `agentKind: 'group' | 'personal'`（及个人项 `agentId`）
  - computed：`hasGroupAgentMention` / `hasPersonalAgentMention` / `hasAnyAgentMention`
  - 旧草稿无 `agentKind` 且 `id` 以 `ga_` 开头 → 兜底 `'group'`

- [ ] **Step 1: 替换 `hasAgentMention` computed**

```js
hasGroupAgentMention() {
  return this.aSomeOneList.some(function(item) {
    return item.agentKind === 'group' ||
      (!item.agentKind && typeof item.id === 'string' && item.id.startsWith('ga_'));
  });
},
hasPersonalAgentMention() {
  return this.aSomeOneList.some(function(item) {
    return item.agentKind === 'personal';
  });
},
hasAnyAgentMention() {
  return this.hasGroupAgentMention || this.hasPersonalAgentMention;
},
```

- [ ] **Step 2: watcher 分别驱动两条可见性**

```js
hasGroupAgentMention(val) {
  this.$parent.agentMemoryBarVisible = val;
},
hasPersonalAgentMention(val) {
  this.$parent.personalAiMemoryBarVisible = val;
},
```

（`personalAiMemoryBarVisible` 在 Task 5 加到 chat-box；本任务先写调用，若父级暂无字段可先在 chat-box data 预置 `false`。）

- [ ] **Step 3: 草稿恢复保留 / 兜底 `agentKind`**

两处草稿循环（`replyMsgObj` / `initRange`）里，对 `ga_` 项：

```js
if (item.id == 0) {
  this.aSomeOneList.push(item);
} else if (typeof item.id === 'string' && item.id.startsWith('ga_')) {
  var draftItem = Object.assign({}, item);
  if (!draftItem.agentKind) draftItem.agentKind = 'group';
  this.aSomeOneList.push(draftItem);
} else {
  // 既有群成员校验逻辑不变
}
```

`initRange` 末尾改为：

```js
this.$parent.agentMemoryBarVisible = this.hasGroupAgentMention;
this.$parent.personalAiMemoryBarVisible = this.hasPersonalAgentMention;
```

- [ ] **Step 4: `insertAgentMention` 只认群**

```js
if (
  this.peopleList[i].agentKind === 'group' ||
  (!this.peopleList[i].agentKind &&
    typeof this.peopleList[i].id === 'string' &&
    this.peopleList[i].id.startsWith('ga_'))
) {
  agent = this.peopleList[i];
  break;
}
```

插入前若 `hasAnyAgentMention` 已为 true → `return`（不插）。

- [ ] **Step 5: `atUserList` 的 isAgent**

```js
const atItem = this.aSomeOneList.find(function(x) { return x.id === atUserId; });
const isAgent = !!(atItem && (atItem.agentKind === 'group' || atItem.agentKind === 'personal')) ||
  atUserId.startsWith('ga_');
```

个人/群均走智能体 `atUserName` 分支（勿当真人 name）。

- [ ] **Step 6: lint 抽查 + 提交 desktop**

```bash
cd apps/desktop && npx eslint src/renderer/components/chitchat/sendbox/send-box.vue || true
git add src/renderer/components/chitchat/sendbox/send-box.vue
git commit -m "feat(at-personal-ai): send-box 按 agentKind 分流智能体判断"
```

---

### Task 2: `@` 列表注入个人 AI + 互斥过滤 + 身份标签

**Files:**
- Modify: `send-box.vue` → `initList`（~2712）、`handleContentChange` / `changeAtPeopleListState`
- Modify: `chat-box.vue` → `@` 弹层身份标签（~265）

**Interfaces:**
- Consumes: Task 1 的 `hasAnyAgentMention` / `agentKind`
- Produces: `peopleList` 项 `{ id: agentAccountId, name, avatar, agentKind, agentId }`

- [ ] **Step 1: `initList` 同时解析 `groupAgentRel` + `groupAgentRels`**

在现有 `groupInfoApi` 分支上扩展（缓存 `AiAgentAccountInfoMap` 仍可先插群；接口兜底一次拿齐）：

```js
const res = await this.$service.groupInfoApi({ id: groupId });
const data = res && res.data && res.data.data;
const agentList = [];
if (data && data.groupAgentRel && data.groupAgentRel.agentAccountId) {
  agentList.push({
    id: data.groupAgentRel.agentAccountId,
    name: data.groupAgentRel.agentName,
    avatar: data.groupAgentRel.agentAvatar,
    agentKind: 'group',
    agentId: data.groupAgentRel.agentId
  });
}
var myId = this.GetSendUser && this.GetSendUser.id;
var rels = (data && data.groupAgentRels) || [];
for (var i = 0; i < rels.length; i++) {
  var rel = rels[i];
  if (rel && rel.accountId === myId && rel.agentAccountId) {
    agentList.push({
      id: rel.agentAccountId,
      name: rel.agentName,
      avatar: rel.agentAvatar,
      agentKind: 'personal',
      agentId: rel.agentId
    });
    // 写入 map，供消息发送人回显
    this.$store.dispatch('SetAiAgentAccountInfoMap', {
      agentAccountId: rel.agentAccountId,
      name: rel.agentName,
      avatar: rel.agentAvatar,
      belongId: groupId,
      belongType: 3,
      updateTime: Date.now()
    });
  }
}
```

缓存路径里已有群智能体项也补上 `agentKind: 'group'`。

- [ ] **Step 2: 已有智能体时从候选剔除两类**

在 `changeAtPeopleListState('show', …)` 前（或 `handleContentChange` 组装 data 时）：

```js
var list = this.peopleList.slice();
if (this.hasAnyAgentMention) {
  list = list.filter(function(item) {
    return item.agentKind !== 'group' &&
      item.agentKind !== 'personal' &&
      !(typeof item.id === 'string' && item.id.startsWith('ga_'));
  });
}
```

- [ ] **Step 3: `setAtData` 互斥**

若选中项是智能体且 `hasAnyAgentMention` 且不是同一 id → 不插入（或 `$Message.warning`）；正常插入时保留 `agentKind`/`agentId`。

- [ ] **Step 4: chat-box 身份标签**

```html
<span v-if="item.agentKind === 'personal'" class="identity-tag tag-agent">个人AI</span>
<span v-else-if="item.agentKind === 'group' || (item.id && ...startsWith('ga_'))" class="identity-tag tag-agent">群AI框</span>
```

- [ ] **Step 5: 真机冒烟**

群聊输入 `@`：应见「所有人 / 群AI框 / 个人AI（若有）/ 成员」。先 `@` 群智能体再 `@`：列表无智能体。工具栏「@智能体」仍只插群。

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(at-personal-ai): @列表注入个人AI并互斥过滤"
```

---

### Task 3: 群侧胶囊文案「类型+N」

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/sendbox/agent-memory-bar.vue:24`

- [ ] **Step 1: 改文案**

```html
<span v-if="enabledCount > 0" class="pill-text">{{ '类型+' + enabledCount }}</span>
```

- [ ] **Step 2: 真机确认群智能体记忆条显示「类型+N」**

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(agent-memory): 知识类型胶囊改为类型+N"
```

---

### Task 4: 新建 `PersonalAiMemoryBar`（无弹窗先通）

**Files:**
- Create: `apps/desktop/src/renderer/components/chitchat/sendbox/personal-ai-memory-bar.vue`

**Interfaces:**
- Produces:
  - props: `visible: Boolean`
  - methods: `updateFromAgentSetting(data)`, `reset()`, `getMemoryData()` → `{ dataRangeList, timeType, netSearch, deepThink, dataRangeScopeList }`
  - emit: `memory-change`
  - DataScope 胶囊：`showDataScope = dataRangeList 含 choose===1 且 type∈{1,2,4}`；文案「数据+N」（N=scope 长度，null 当 0）

- [ ] **Step 1: 以 `agent-memory-bar.vue` 为视觉模板复制骨架**

保留：知识类型 popover、时间 popover、联网 toggle。  
删掉：知识库授权相关 emit（个人 AI 实测 `knowledgeNeedAuthList=[]`）。  
改：知识类型胶囊「类型+N」。

- [ ] **Step 2: 增加 scope 状态 + DataScope 胶囊（弹窗占位）**

```js
data() {
  return {
    // …同群条字段
    dataRangeScopeList: []
  };
},
computed: {
  showDataScope() {
    return this.dataRangeList.some(function(item) {
      return item.choose === 1 &&
        (item.dataRangeType === 1 || item.dataRangeType === 2 || item.dataRangeType === 4);
    });
  },
  scopeCount() {
    return (this.dataRangeScopeList || []).length;
  }
},
methods: {
  updateFromAgentSetting(data) {
    // 同群条字段拷贝…
    var scopes = data && data.dataRangeScopeList;
    this.dataRangeScopeList = Array.isArray(scopes) ? scopes.slice() : [];
  },
  getMemoryData() {
    return {
      dataRangeList: this.dataRangeList,
      timeType: this.timeType,
      netSearch: this.netSearch,
      deepThink: this.deepThink,
      dataRangeScopeList: this.dataRangeScopeList || []
    };
  },
  // 类型/时间/联网变更均 $emit('memory-change')
}
```

DataScope 胶囊点击先 `console.log` 占位，Task 6 再接弹窗。

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(at-personal-ai): 新增 PersonalAiMemoryBar 骨架"
```

---

### Task 5: chat-box 挂载个人条 + get/save

**Files:**
- Modify: `apps/desktop/src/renderer/components/chitchat/chat-box.vue`

**Interfaces:**
- Consumes: Task 4 的 bar API
- Produces:
  - data: `personalAiMemoryBarVisible`, `personalAiMemoryAgentId`, `personalAiDataRangeScopeList`（可选，以 bar 内状态为准）
  - methods: `fetchPersonalAiMemorySettings()`, `savePersonalAiMemory()`

- [ ] **Step 1: template 并排挂载（独立 ref，勿共用）**

```html
<AgentMemoryBar
  ref="agentMemoryBar"
  :visible="agentMemoryBarVisible"
  :key="'ga-' + OpenDialog.id"
  @memory-change="saveAgentMemory"
  @need-knowledge-auth="openKnowledgeAuthWindows"
/>
<PersonalAiMemoryBar
  ref="personalAiMemoryBar"
  :visible="personalAiMemoryBarVisible"
  :key="'pa-' + OpenDialog.id"
  @memory-change="savePersonalAiMemory"
/>
```

`msg-refer` 的 class：任一条可见即 `with-memory-bar`。

- [ ] **Step 2: watcher**

```js
personalAiMemoryBarVisible(val) {
  if (val) {
    this.fetchPersonalAiMemorySettings();
  } else if (this.$refs.personalAiMemoryBar) {
    this.$refs.personalAiMemoryBar.reset();
  }
},
```

- [ ] **Step 3: fetch — `accountId` + `agentId`**

```js
fetchPersonalAiMemorySettings() {
  var agent = this.$refs.sendBox && this.$refs.sendBox.aSomeOneList &&
    this.$refs.sendBox.aSomeOneList.find(function(i) { return i.agentKind === 'personal'; });
  var agentId = agent && agent.agentId;
  if (!agentId) return;
  var fetchKey = 'pa::' + agentId;
  if (this._personalMemoryFetchInFlight && this._personalMemoryFetchKey === fetchKey) return;
  this._personalMemoryFetchInFlight = true;
  this._personalMemoryFetchKey = fetchKey;
  this.$service.getAgentDataRange({
    accountId: this.GetSendUser && this.GetSendUser.id,
    agentId: agentId
  }).then(function(data) {
    this._personalMemoryFetchInFlight = false;
    this.personalAiMemoryAgentId = (data && data.agentId) || agentId;
    var bar = this.$refs.personalAiMemoryBar;
    if (bar && data) bar.updateFromAgentSetting(data);
  }.bind(this)).catch(function(err) {
    this._personalMemoryFetchInFlight = false;
    console.log('[getAgentDataRange][personal] 失败', err);
  }.bind(this));
},
```

- [ ] **Step 4: save — 全量载荷含 scope**

```js
savePersonalAiMemory() {
  var bar = this.$refs.personalAiMemoryBar;
  if (!bar) return;
  var agentId = this.personalAiMemoryAgentId;
  if (!agentId) {
    console.log('[saveDataRange][personal] 跳过：agentId 未就绪');
    return;
  }
  var mem = bar.getMemoryData();
  var payload = {
    accountId: this.GetSendUser && this.GetSendUser.id,
    agentId: agentId,
    dataRangeList: mem.dataRangeList || [],
    timeType: mem.timeType,
    netSearch: mem.netSearch,
    deepThink: mem.deepThink,
    dataRangeScopeList: mem.dataRangeScopeList || []
  };
  this.$service.saveDataRange(payload)
    .then(function(res) { console.log('[saveDataRange][personal] 成功', res); }.bind(this))
    .catch(function(err) { console.log('[saveDataRange][personal] 失败', err); });
},
```

**禁止**改动既有 `fetchAgentMemorySettings` / `saveAgentMemory` 的入参形态。

- [ ] **Step 5: 真机** — `@` 个人 AI → 条出现 → Network 见 get；改类型 → save 带 scope `[]`。

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(at-personal-ai): chat-box 挂载个人筛选条并接 get/save"
```

---

### Task 6: DataScope 弹窗

**Files:**
- Create: `personal-ai-data-scope-dialog.vue`
- Modify: `personal-ai-memory-bar.vue`（点击胶囊打开；确认回写 scope 并 `memory-change`）

**Interfaces:**
- 选择项内部可用 `{ type: 'private'|'group', id, key, name, avatar }`
- 对外 scope：`{ scopeDataType: 1|3, scopeDataId: string }`（私聊=1，群=3）
- 取数：见 `context/platforms/desktop-forward-dialog.md`（`GetConversationSort.all` / `groupListApi` / 搜索 / `getDeptUserPagelist`）
- **无上限**（不要抄转发的 9 限制）

- [ ] **Step 1: 弹窗 UI**

三 tab：最近 / 群组 / 组织架构 + 搜索；右侧已选可删；确定/取消。视觉可简化，交互对齐转发「选目标」左侧。

- [ ] **Step 2: 映射**

```js
function toScope(item) {
  return {
    scopeDataType: (item.type === 'private' || item.type === 'user') ? 1 : 3,
    scopeDataId: String(item.id)
  };
}
```

打开时用当前 `dataRangeScopeList` 反查展示名（能从会话/缓存取到就显示，取不到至少显示 id）。

- [ ] **Step 3: bar 接入**

确认后 `this.dataRangeScopeList = scopes` → `$emit('memory-change')`。

- [ ] **Step 4: 真机** — 勾 1/2/4 时显示「数据+N」；选多人多群无上限；save 载荷含完整 scope。

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(at-personal-ai): DataScope 选人/群弹窗"
```

---

### Task 7: 发送载荷 `agentChatData`（含群补 `agentId`）

**Files:**
- Modify: `send-box.vue` ~1437–1468（组 `agentChatData` 处）

**Interfaces:**
- Consumes: `$parent.agentMemoryAgentId`、`$parent.personalAiMemoryAgentId`、对应 bar 的 `getMemoryData()`
- Produces: `extendData.agentChatData` 符合 `context/contracts/personalAiFrame/aiRobtChat.d.ts`
- `messageService.SendMessage` 已有旁路调用，**不改**（除非发现未带 `extendData`）

- [ ] **Step 1: 按 kind 组载荷**

```js
var _agentChatData = null;
if (this.hasAnyAgentMention) {
  var agentItem = null;
  for (var _ai = 0; _ai < this.aSomeOneList.length; _ai++) {
    var it = this.aSomeOneList[_ai];
    if (it.agentKind === 'group' || it.agentKind === 'personal' ||
        (!it.agentKind && typeof it.id === 'string' && it.id.startsWith('ga_'))) {
      agentItem = it;
      break;
    }
  }
  if (agentItem) {
    var kind = agentItem.agentKind || 'group';
    var memData = {};
    var agentId = '';
    if (kind === 'personal') {
      memData = this.$parent.$refs.personalAiMemoryBar
        ? this.$parent.$refs.personalAiMemoryBar.getMemoryData() : {};
      agentId = this.$parent.personalAiMemoryAgentId || agentItem.agentId || '';
    } else {
      memData = this.$parent.$refs.agentMemoryBar
        ? this.$parent.$refs.agentMemoryBar.getMemoryData() : {};
      agentId = this.$parent.agentMemoryAgentId || '';
    }
    _agentChatData = {
      accountId: this.GetSendUser && this.GetSendUser.id,
      nickName: this.GetSendUser && this.GetSendUser.name,
      aiRoleId: '1',
      agentId: agentId,
      corpId: this.GetCompany && this.GetCompany.corpId,
      content: data,
      groupId: this.currentGroup && this.currentGroup.id,
      referUuid: this.replyMsgObj && this.replyMsgObj.messageUId
        ? this.replyMsgObj.messageUId : '',
      dataRangeList: memData.dataRangeList || [],
      timeType: String(memData.timeType || 7),
      netSearch: String(memData.netSearch || 0),
      deepThink: String(memData.deepThink || 0),
      chooseList: [{
        id: this.currentGroup && this.currentGroup.id,
        type: this.OpenDialog && this.OpenDialog.conversationType,
        name: ''
      }]
    };
    if (kind === 'personal') {
      _agentChatData.dataRangeScopeList = memData.dataRangeScopeList || [];
    }
  }
}
```

确保 `extendData: { agentChatData: _agentChatData }` 仍传入发送路径（对照现网字段名）。

- [ ] **Step 2: 真机抓包**

1. `@` 群智能体发送 → `aiRobtChat` **有** `agentId`，无 `dataRangeScopeList`（或可忽略空）。  
2. `@` 个人 AI 发送 → 有 `agentId` + `dataRangeScopeList`。  
3. 右键回复 + `@` 个人 AI → `referUuid` 有值。

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(at-personal-ai): aiRobtChat 补 agentId 并区分个人 scope"
```

---

### Task 8: 取消 / 切换 / 草稿 收尾

**Files:**
- Modify: `send-box.vue`（inputHandle 同步 mention 后可见性已由 watcher 覆盖；确认发送成功清空）
- Modify: `chat-box.vue`（切会话 key 已隔离；确认两条 bar 互斥不会同显）

- [ ] **Step 1: 删除智能体 `@` 富文本**

现有 DOM 同步会缩 `aSomeOneList` → computed 变 false → watcher 隐藏对应条。真机确认个人/群均立即隐藏。

- [ ] **Step 2: 草稿**

含个人 AI `@` 的草稿：进会话 → 条显示 → 触发 personal get（非草稿内嵌记忆）。旧草稿无 `agentKind` → 当群处理，不误开个人条。

- [ ] **Step 3: 互斥断言**

`agentMemoryBarVisible` 与 `personalAiMemoryBarVisible` 不应同时为 true；若出现，以 `aSomeOneList` 实际 kind 为准强制纠正。

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(at-personal-ai): 草稿与取消筛选条可见性收尾"
```

---

### Task 9: 回归清单 + context 文档

**Files:**
- Modify: `context/features/20260727-at个人AI框-先做pc端/status.md`
- Modify: `context/features/20260727-at个人AI框-先做pc端/impl-notes.md`（若空则按 wrapup 结构写）
- Modify: `context/features/20260727-at个人AI框-先做pc端/spec.md`（待补项勾成已决 / Plan Defaults）

- [ ] **Step 1: 个人 AI E2E**

| # | 步骤 | 期望 |
|---|------|------|
| 1 | 群聊 `@` 列表 | 有个人 AI（自己的） |
| 2 | 选个人 AI | 出现个人筛选条；get 用 accountId+agentId |
| 3 | 改类型/时间/联网/DataScope | 每次 save 全量含 scope |
| 4 | 发送 | IM 成功后 aiRobtChat 含 agentId + scope |
| 5 | 回复 + `@` 个人 AI | referUuid 有值；回复群内可见 |
| 6 | 再 `@` | 列表无智能体，可 `@人` |
| 7 | 删 `@` / 清空 / 发送后 | 条立即隐藏 |
| 8 | 草稿恢复 | 条再现 + 重新 get |

- [ ] **Step 2: 群智能体回归（必做，告知测试）**

| # | 步骤 | 期望 |
|---|------|------|
| G1 | `@` 群 / 工具栏 `@智能体` | 现网 AgentMemoryBar |
| G2 | 改筛选 → 发送 | AI 回复正常；aiRobtChat **现含 agentId** |
| G3 | 胶囊 | 「类型+N」 |
| G4 | 草稿含群 `@` | 条恢复；行为同改前 |

- [ ] **Step 3: 更新 status 矩阵** — desktop「页面开发/联调/自测」按实际勾；待办清空已决开项；保留「须回归群智能体」提示直至测试签收。

- [ ] **Step 4: context 提交**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260727-at个人AI框-先做pc端/
git commit -m "docs(at-personal-ai): 实现计划与状态同步"
```

---

## Self-Review

1. **Spec coverage**
   - `@` 列表 / 互斥 / 工具栏只插群 → Task 2
   - 共享 9 处分流 → Task 1 + 7（agentChatData）+ 3（胶囊）+ 5（独立组件与 fetch）
   - 个人筛选 UI + DataScope 条件/空态/无上限 → Task 4–6
   - 发送 agentId / scope / referUuid → Task 7
   - 筛选记忆 get/save → Task 5
   - 草稿/取消 → Plan Defaults + Task 8
   - 群回归 → Task 9
   - 消息回显 → Task 2 写入 `AiAgentAccountInfoMap`
2. **Placeholder scan:** 无 TBD；开项已落 Plan Defaults。
3. **Type consistency:** `agentKind` / `personalAiMemoryBarVisible` / `personalAiMemoryAgentId` / `getMemoryData().dataRangeScopeList` 前后任务一致。

# 选择数据范围 · 原生落库（android / ios / web）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。步骤用 `- [ ]` 复选框跟踪。

**Goal:** 移动端「选择数据范围」不再经桥传递大包 `scopes[]`；改为原生自行 `getAgentDataRange` 返显、`saveDataRange` 落库，桥只回 ACK；web 收到成功后再 `getAgentDataRange` 刷新本地 `conditionMode`。

**Architecture:** 服务端为事实来源。web 开页只传 `agentId`（+ 可选 `accountId`）。原生打开后拉记忆 → 多选编辑 → 确认时「先读后写」整包 `saveDataRange`（保留 `dataRangeList`/`timeType`/`netSearch`/`deepThink`，只换 `dataRangeScopeList`）→ 成功才 ACK。web 不写 `saveDataRange`（`persist=true` 路径），只拉记忆更新胶囊。PC 仍走 H5 弹窗 + web `saveDataRange`。ios/android 对称。

**Tech Stack:** `apps/web`（Vue3 + axios）；`apps/android`（Java + Retrofit `AiChatBasicInterface`）；`apps/ios`（OC + `ZXAIAgentManager`）；契约 `context/contracts/personalAiFrame/{getAgentDataRange,saveDataRange}.d.ts`；桥 `context/bridge.md`。

## Global Constraints

- **范围**：web + android + ios + context 文档；**desktop / PC H5 弹窗不改**（仍传 scopes + web save）。
- **读记忆接口**：统一 `POST /agentSetDataRangeExpand/getAgentDataRange`（**不用** `getLastSessionMessage`，避免拉会话消息/鉴权副作用）。
- **写记忆接口**：`POST /agentSetDataRangeExpand/saveDataRange`；原生确认时必须带齐记忆字段（先读后写），禁止只传 scopes 冲掉其它项。
- **桥载荷**：入参禁止 `initialScopes`；成功回传禁止 `scopes[]`；仅 ACK / 取消 / 失败。
- **三态回传**：
  - 取消 → `code=-1`（web 静默，不拉记忆）
  - save 成功 → `{ type:"personal-ai:selected-data-range", payload:{ ok:true } }`（或等价空成功）
  - save 失败 → `error` / `code≠0`（web toast/warn，**不**拉记忆）
- **`persist=false`**（如定时任务 `SkillEditFormBody`）：**不走**原生落库；移动端若仍打开原生须改回「回传 scopes、web 不调 save」或强制 H5。本期个人 AI 聊天栏 `persist=true`。
- **开页前竞态**：`persist=true` 时 web 打开原生前先 `await saveAgentMemory()`（或等价 flush），避免原生按旧记忆覆盖 web 未落库的知识类型/时间。
- **确定 0 项**：保持现状——确定按钮 disabled（不可清空后确认）；若产品后续要「清空记忆」另开任务。
- **分支**：各 app 只 push `personal-ai-chat`；context `docs(选择AI框): ...`。
- **对照**：实现时只读本 plan + `bridge.md` + 契约 + `impl-notes`「数据范围」节；移植勿大段抄对端 UI 代码。

---

## 目标时序

```text
web DataScopeBar（移动 + persist=true）
  → await flush saveAgentMemory（当前 dataRangeList/timeType/netSearch/deepThink）
  → 原生 selectDataRangeScope({ agentId, accountId? })
       ├─ android: window.WebView.selectDataRangeScope(JSON)
       └─ ios: wnsdk.aiChat.selectDataRangeScope({...})
  → 原生 onCreate/viewDidLoad
       → getAgentDataRange({ accountId, agentId })
       → 用 dataRangeScopeList 预勾选；缓存整包记忆草稿（含 dataRangeList 等）
  → 用户多选…
  → 点确定
       → saveDataRange({
            accountId, agentId,
            dataRangeList, timeType, netSearch, deepThink,  // 来自打开时草稿
            dataRangeScopeList: 当前已选                     // 仅此项变
          })
       → 成功 → ACK ok → dismiss
       → 失败 → toast + 不 dismiss 或 dismiss+error（须明确；推荐：留在页可重试，或 dismiss+error）
  → web 收到 ok
       → getAgentDataRange({ accountId, agentId })
       → emit update(dataRangeScopeList) 刷新 conditionMode /「数据+n」
  → web 收到取消 → 不动
  → web 收到失败 → console.warn / toast，不动本地
```

PC：仍 `SelectDataRangeDialog` → `onSubmit(scopes)` → 本地 + `saveAgentDataRange`（不变）。

---

## File Structure

| 路径 | 职责 |
|------|------|
| `context/bridge.md` | 改 `selectDataRangeScope` 入参/回传契约 + Changelog |
| `context/contracts/personalAiFrame/getAgentDataRange.d.ts` | 确认 `dataRangeScopeList`；Changelog 若有语义变更 |
| `context/features/20260707-选择AI框/impl-notes.md` | 重写移动端时序（原生落库） |
| `context/features/20260707-选择AI框/status.md` | T10 / 待办改写 |
| `apps/web/.../agentSetDataRangeExpand.js` | 新增 `getAgentDataRange` |
| `apps/web/.../personalAiDataRangeScopeMessage.js` | 入参改 agentId；回传改 ACK；去掉 scopes 归一化主路径 |
| `apps/web/.../personalAiDataRangeScopeMessage.test.mjs` | ACK / 取消 / 失败单测 |
| `apps/web/.../DataScopeBar.vue` | 开页传 agentId；成功后拉记忆再 emit；不再原生路径 save |
| `apps/android/.../LastAiAgentChooseDataRspDTO.java` | 补 `dataRangeScopeList` |
| `apps/android/.../SelectDataRangeActivity.java` | 入参 agentId；打开拉记忆；确认 save；ACK |
| `apps/android/.../DataRangeScopeSession.java` / WebView 注入 | 入参 JSON 形态对齐 |
| `apps/ios/.../ZXAIAgentSessionMemoryModel.*` | 补 `dataRangeScopeList` |
| `apps/ios/.../ZXAIAgentManager.*` | `requestAgentDataRange` 支持 agentId；save 带 scopes |
| `apps/ios/.../ZXJSAIChatAPI.m` | 入参 agentId；确认后 save 再 ACK |
| `apps/ios/.../ZXSelectAiAgentController.*` | 数据范围模式：自拉记忆预勾，finish 前 save |

---

### Task 1: 契约 + 桥协议（context）

**Files:**
- Modify: `context/bridge.md`（`selectDataRangeScope` 行 + 「回传」小节 + Changelog）
- Modify: `context/contracts/personalAiFrame/getAgentDataRange.d.ts`（Changelog 注明本方案消费方含原生选择页）
- Modify: `context/features/20260707-选择AI框/status.md`（待办改写为本方案；矩阵 T10 保持 🚧）
- Modify: `context/features/20260707-选择AI框/impl-notes.md`「Home 对话 · 数据范围」移动端时序

**Interfaces:**
- Produces（桥入参）:

```jsonc
// web → 原生
{ "agentId": "<string>", "accountId"?: "<string>" }
```

- Produces（桥回传）:

```jsonc
// 成功
{ "type": "personal-ai:selected-data-range", "payload": { "ok": true } }
// 取消
// code=-1（wnsdk error / android 空串或 code=-1）
// save 失败
// code≠0 或 error.msg 含失败信息（勿伪装 ok）
```

- [x] **Step 1: 改 bridge.md**
- [x] **Step 2: 改 impl-notes 移动端时序**
- [x] **Step 3: 改 status.md 待办**
- [x] **Step 4: context 提交**

- [ ] **Step 4: context 提交**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/bridge.md context/contracts/personalAiFrame/getAgentDataRange.d.ts \
  context/features/20260707-选择AI框/plan-数据范围原生落库.md \
  context/features/20260707-选择AI框/impl-notes.md \
  context/features/20260707-选择AI框/status.md
git commit -m "$(cat <<'EOF'
docs(选择AI框): 数据范围改为原生落库桥 ACK

EOF
)"
```

---

### Task 2: web — HTTP + 桥封装 + DataScopeBar

**Files:**
- Modify: `apps/web/src/server/module/agentSetDataRangeExpand.js`
- Modify: `apps/web/src/components/views/personal-ai/selector/personalAiDataRangeScopeMessage.js`
- Modify: `apps/web/src/components/views/personal-ai/tests/personalAiDataRangeScopeMessage.test.mjs`
- Modify: `apps/web/src/components/views/home/commons/DataScopeBar.vue`
- Optional: `apps/web/src/components/views/home/Chat.vue`（若需暴露 `flushSaveAgentMemory` / `reloadAgentDataRangeMemory` 给 DataScopeBar；优先在 DataScopeBar 内自调 HTTP，少改 Chat）

**Interfaces:**
- Consumes: 桥 ACK `{ ok:true }`；`getAgentDataRange` 回参 `dataRangeScopeList`
- Produces:

```js
// agentSetDataRangeExpand.js
export const getAgentDataRange = (data) =>
  axios.post("/agentSetDataRangeExpand/getAgentDataRange", data, { baseURL: baseMap.ai });

// personalAiDataRangeScopeMessage.js
export function selectDataRangeScopeByNative(wnsdk, { agentId, accountId })
  // → Promise<void>  // resolve=ok；reject=取消/失败
```

- [ ] **Step 1: 写失败单测（ACK 归一化）**

在 `personalAiDataRangeScopeMessage.test.mjs` 增加：

```js
import {
  normalizeNativeSelectDataRangeAck,
  isSelectDataRangeCancelError
} from "../selector/personalAiDataRangeScopeMessage.js";

test("normalizeNativeSelectDataRangeAck accepts ok", () => {
  const r = normalizeNativeSelectDataRangeAck({
    type: "personal-ai:selected-data-range",
    payload: { ok: true }
  });
  assert.equal(r.ok, true);
});

test("normalizeNativeSelectDataRangeAck rejects legacy scopes-only as not-ok without ok flag", () => {
  // 过渡期：若仍带 scopes 且无 ok，视为协议错误（或临时兼容：有 scopes 也当 ok——实现时二选一写死并测）
  const r = normalizeNativeSelectDataRangeAck({
    type: "personal-ai:selected-data-range",
    payload: { scopes: [{ scopeDataType: 1, scopeDataId: "1" }] }
  });
  assert.equal(r.ok, false);
});
```

**实现约定（写死）：** 仅 `payload.ok === true`（或 `payload.ok === 1`）算成功；**忽略** legacy `scopes`（防大包回传复活）。旧单测 `unwraps scopes` 改为测 ACK，或删掉 scopes 断言。

- [ ] **Step 2: 跑测确认失败/红**

```bash
cd apps/web && node --test src/components/views/personal-ai/tests/personalAiDataRangeScopeMessage.test.mjs
```

Expected: FAIL（`normalizeNativeSelectDataRangeAck` 未导出）

- [ ] **Step 3: 实现 `getAgentDataRange` + ACK 封装**

`agentSetDataRangeExpand.js` 增加 `getAgentDataRange`（与 `saveAgentDataRange` 同 baseURL）。

`personalAiDataRangeScopeMessage.js`：

1. `selectDataRangeScopeByAndroidWebView({ agentId, accountId })`  
   - `JSON.stringify({ agentId, accountId })`（**无** `initialScopes`）  
   - `dataRangeScopeResultFromAndroid`：空串/`code=-1` → reject 取消；解析后 `normalizeNativeSelectDataRangeAck`，`ok` → resolve；否则 reject 失败
2. ios `wnsdk.aiChat.selectDataRangeScope({ agentId, accountId, success, error })` 同语义  
3. 导出 `selectDataRangeScopeByNative(wnsdk, { agentId, accountId })` → `Promise<void>`

- [ ] **Step 4: 跑测通过**

同 Step 2；Expected: PASS

- [ ] **Step 5: 改 DataScopeBar.vue**

`openPicker` 移动 + `persist===true`：

```js
const agentId = Assistant?.agentId;
const accountId = user.value?.id;
if (!agentId || !accountId) {
  console.warn("选择数据范围：agentId/accountId 未就绪");
  return;
}
// 开页前 flush 其它记忆项，避免原生先读后写覆盖
await saveAgentDataRange({
  accountId,
  agentId,
  dataRangeList: props.dataRangeList,
  timeType: props.timeType,
  netSearch: props.netSearch,
  deepThink: props.deepThink
  // 不带 dataRangeScopeList：保留服务端已有 scopes，只同步其它字段
});
await selectDataRangeScopeByNative(wnsdk, { agentId, accountId });
const memory = await getAgentDataRange({ accountId, agentId });
const scopes = memory?.dataRangeScopeList || [];
emit("update", scopes);
// 注意：此处不再调用 saveAgentDataRange（原生已 save）
```

`persist===false`：保持现有行为（若移动端会进到此路径——定时任务一般 PC；若 `useNativePicker` 为 true，**强制不走原生落库**：可临时 `dialogOpen=true` 或继续旧 scopes 回传；**禁止**让原生 save 智能体记忆）。

PC 路径不变。

- [ ] **Step 6: web 提交（personal-ai-chat）**

```bash
cd apps/web
git add src/server/module/agentSetDataRangeExpand.js \
  src/components/views/personal-ai/selector/personalAiDataRangeScopeMessage.js \
  src/components/views/personal-ai/tests/personalAiDataRangeScopeMessage.test.mjs \
  src/components/views/home/commons/DataScopeBar.vue
git commit -m "$(cat <<'EOF'
fix(personal-ai): 数据范围原生落库后 web 只 ACK 拉记忆

EOF
)"
```

---

### Task 3: android — DTO + 选择页 get/save + ACK

**Files:**
- Modify: `apps/android/android_net/.../bean/agent/LastAiAgentChooseDataRspDTO.java`（加 `List` scopes 字段 + getter/setter；元素可用已有 `DataRangeScopeItem` 或新建 VO：`scopeDataType`/`scopeDataId`）
- Modify: `apps/android/smart_message/.../SelectDataRangeActivity.java`
- Modify: `apps/android/core_function_api/.../DataRangeScopeSession.java` / WebView `@JavascriptInterface`（入参解析 `agentId`）
- Modify: `apps/android/core_function_api/.../api/AiChat.java` 注释
- Reference: `apps/android/IM/.../GroupChatAgentDataCheckView.java`（`getAgentDataRange`/`saveDataRange` 调用范例）

**Interfaces:**
- Consumes: `AiChatBasicInterface.getAgentDataRange` / `saveDataRange`
- Produces: 成功回调 web `dataRangeScopeResultFromAndroid(JSON)`，payload `{ type, payload:{ ok:true } }`；取消空串或 `code=-1`

- [ ] **Step 1: DTO 补 `dataRangeScopeList`**

```java
private List<DataRangeScopeItem> dataRangeScopeList;
// + get/set
```

若 `DataRangeScopeItem` 在 `core_function_api`、DTO 在 `android_net` 有模块依赖问题：在 `android_net` 建轻量 `DataRangeScopeVO`（两字段），选择页再映射到 `DataRangeScopeItem`。

- [ ] **Step 2: Activity 入参改 `EXTRA_AGENT_ID`**

- Intent / Session 存 `agentId`（必需）、`accountId`（可 `PrefManager.getAccountId()`）  
- **删除**对 `EXTRA_INITIAL_SCOPES_JSON` 作为唯一返显源的依赖（可留字段兼容但忽略）  
- `onCreate`：show loading → `getAgentDataRange({accountId, agentId})` → 填 `selectedMap` + 缓存 `memorySnapshot`（dataRangeList/timeType/netSearch/deepThink）→ hide loading；失败 toast 并可 finish+error

- [ ] **Step 3: 确定时 save 再 ACK**

替换当前 `onConfirm` 直接 `setResult(scopes)`：

```java
// 伪代码
Map<String, Object> params = new HashMap<>();
params.put("accountId", PrefManager.getAccountId());
params.put("agentId", agentId);
params.put("dataRangeList", memorySnapshot.dataRangeList); // 转接口所需结构
params.put("timeType", memorySnapshot.timeType);
params.put("netSearch", memorySnapshot.netSearch);
params.put("deepThink", memorySnapshot.deepThink);
params.put("dataRangeScopeList", toScopeParams(selectedMap));
// Retrofit saveDataRange → onSuccess: 写 resultJson ACK；finish
// onFail: Toast；不写 ok（可留页重试）
```

WebView 通路：成功 `loadUrl("javascript:dataRangeScopeResultFromAndroid('...')")` 注入 ACK JSON；取消仍空串。

- [ ] **Step 4: 编译**

```bash
cd apps/android && ./gradlew :smart_message:compileOnTestDebugJavaWithJavac
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 5: android 提交**

```bash
cd apps/android
git add -A  # 仅本功能相关文件
git commit -m "$(cat <<'EOF'
feat(personal-ai): 选择数据范围原生 get/save 后 ACK

EOF
)"
```

---

### Task 4: ios — MemoryModel + Manager + 选择页落库 + 桥 ACK

**Files:**
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentSessionMemoryModel.h`（及 `.m` 若有）
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_AIChat/AIAgent/ZXAIAgentManager.h` / `.m`
- Modify: `apps/ios/SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/ZXJSAIChatAPI.m`
- Modify: `apps/ios/SmartMessage/ZX_Modules/ZX_Message/ZX_PersonalAi/SelectAiAgent/ZXSelectAiAgentController.h` / `.m`

**Interfaces:**
- Produces:

```objc
// 优先 agentId
+ (void)requestAgentDataRangeWithAgentId:(NSString *)agentId
                                 handler:(void (^)(ZXAIAgentSessionMemoryModel * _Nullable, ZXError * _Nullable))handler;

// save 增加 scopes
+ (void)requestSaveDataRangeWithAgentId:(NSString *)agentId
                         dataRangeList:(NSArray<ZXAIAgentRangeModel *> *)dataRangeList
                              timeType:(NSInteger)timeType
                             netSearch:(NSInteger)netSearch
                             deepThink:(NSInteger)deepThink
                    dataRangeScopeList:(nullable NSArray<NSDictionary *> *)dataRangeScopeList
                               handler:(nullable void (^)(ZXError * _Nullable))handler;
```

旧无 scopes 的 save 方法可转发到新方法并传 `nil`（兼容群聊 AgentFilter），或加默认参数宏——以少改调用方为准。

- [ ] **Step 1: Model 补 `dataRangeScopeList`**

```objc
@property (nonatomic, strong, nullable) NSArray<NSDictionary *> *dataRangeScopeList;
// 元素：@{ @"scopeDataType": @(1|3), @"scopeDataId": @"..." }
```

解析 `getAgentDataRange` / 旧 expandVo 时写入该字段。

- [ ] **Step 2: Manager 支持 agentId 读 + save 带 scopes**

`requestAgentDataRangeWithAgentId:` 入参仅 `accountId`+`agentId`（对齐契约）。  
`requestSaveDataRange...` body 增加 `dataRangeScopeList`（有则传）。

- [ ] **Step 3: ZXJSAIChatAPI 入参改 agentId**

```objc
// data[@"agentId"] 必填；accountId 可缺（用 ZXDataInstance）
controller.selectDataRangeMode = YES;
controller.dataRangeAgentId = agentId;
// 不再赋 initialScopes
// dataRangeFinishHandler：改为「页内已 save 成功」后回
//   @{ @"type":@"personal-ai:selected-data-range", @"payload":@{ @"ok":@YES } }
```

- [ ] **Step 4: Controller 数据范围模式自拉记忆**

`viewDidLoad`（`selectDataRangeMode`）：`requestAgentDataRangeWithAgentId` → 设 `initialScopes` 内部预勾 + 缓存 memory。  
确定按钮：组 `dataRangeScopeList` → `requestSaveDataRange...` → 成功再 `dataRangeFinishHandler(ACK)` + dismiss；失败 Toast，不回调 ok。  
取消：仍 `cancelHandler` → `code=-1`。

- [ ] **Step 5: 编译（测试 scheme）**

```bash
cd apps/ios
xcodebuild -workspace zhixinApp.xcworkspace -scheme zhixinAppTest \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

Expected: BUILD SUCCEEDED（模拟器环境按 `platforms/ios.md`）

- [ ] **Step 6: ios 提交**

```bash
cd apps/ios
git add -A  # 仅本功能相关
git commit -m "$(cat <<'EOF'
feat(personal-ai): 选择数据范围原生 get/save 后 ACK

EOF
)"
```

---

### Task 5: 联调验收 + 收尾文档

**Files:**
- Modify: `context/features/20260707-选择AI框/status.md`
- Modify: `context/features/20260707-选择AI框/impl-notes.md`（联调坑若有）
- Modify: 本 plan 勾选框

- [ ] **Step 1: 真机 E2E 清单**

| # | 步骤 | 期望 |
|---|------|------|
| 1 | 个人 AI 框勾知识类型 → 点「数据+n」 | 原生页打开；已选与上次记忆一致（不依赖 web 传大包） |
| 2 | 多选 50+ 人/群 → 确定 | 无桥超时/截断；成功后胶囊数字更新 |
| 3 | 确定后杀进程重进 | 记忆仍在（save 已落库） |
| 4 | 打开后直接取消 | 胶囊不变 |
| 5 | 断网点确定 | 失败提示；胶囊不变 |
| 6 | 先改时间范围再开数据范围 | 时间不被旧值覆盖（开页前 flush 生效） |
| 7 | PC 弹窗选范围 | 仍 web save，行为不变 |
| 8 | ios / android 各跑一遍 1–6 | 对称 |

- [ ] **Step 2: 更新 status / impl-notes / 勾选本 plan**

- [ ] **Step 3: context 收尾提交**

```bash
cd /Users/nic/w/ai-dev-workspace
git add context/features/20260707-选择AI框/
git commit -m "$(cat <<'EOF'
docs(选择AI框): 数据范围原生落库联调状态

EOF
)"
```

---

## Self-Review

| 需求 | 对应 Task |
|------|-----------|
| 原生 get 返显 | T3 Step2 / T4 Step4 |
| 原生 save | T3 Step3 / T4 Step4 |
| web 知成功后再拉记忆 | T2 Step5 |
| 解决桥大数据 | T1 契约 + 各端去掉 scopes 双向传 |
| ios 对称 | T4 |
| 不用 getLastSessionMessage | Global Constraints + T3/T4 明确 getAgentDataRange |
| persist=false 不误写记忆 | T2 Step5 |
| 先读后写防冲其它记忆 | 目标时序 + T3/T4 |
| 开页前 flush | T2 Step5 |

**已知债（本期不做）：** android `LastAiAgentChooseDataRspDTO` 与群聊 `@` 滤镜共用——补 scopes 字段须确认 Gson 忽略未知/空不影响旧页；ios 旧 `requestSaveDataRange` 无 scopes 调用方保持兼容。

---

## 执行方式

Plan 已保存到 `context/features/20260707-选择AI框/plan-数据范围原生落库.md`。

**1. Subagent-Driven（推荐）** — 每 Task 新开子代理，Task 间人工/主线程审查  
**2. Inline Execution** — 本会话按 executing-plans 连续做，检查点停顿  

选哪种？

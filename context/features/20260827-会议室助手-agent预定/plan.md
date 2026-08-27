# 会议室助手 agent 预定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 预定首页 bot 能查空房（结果卡）并协助新预定；只有用户确认后才调用现有 `createBooking`。

**Architecture:** 服务端 `searchAvailability` 纯函数吃 `getBoard` 结果；内存 `AgentSessionStore` 记本会话下发过的档和草稿。`handleTurn` 按 `action` 分支：`message` 才调 OpenAI 兼容 chat+tools；`pick_slot` / `confirm` / `cancel` 不走 LLM。Hono `POST /meetingApi/agent/turn` 用 SSE 推契约事件。前端纯函数折叠事件到一张当前卡，FAB 负责输入条动画、表情和看板 `reload`。

**Tech Stack:** 现有 Hono + better-sqlite3 + `node:test`；web Vue 3 + `node:test`；LLM 用 `fetch` 调 `/v1/chat/completions`（不新增 SDK）。契约：`context/contracts/meeting/agentTurn.d.ts`。

## Global Constraints

- 只改 `apps/meeting/`（独立 git）。契约已在编排仓，实现时不要改契约字段名。
- 写库仅 `action === "confirm"` 且草稿属于当前 `userId`、未过期。
- `pick_slot` 的 `slot` 必须能在会话 `issuedSlots` 里按 `roomId+date+start+end` 精确匹配。
- 环境变量：`MEETING_LLM_BASE_URL`、`MEETING_LLM_API_KEY`、`MEETING_LLM_MODEL`。未配置时 `message` 不得假装成功。
- 空档规则与 `createBooking` 一致：30 分钟格、开放时间、`nextOpen`、半开区间、提前天数。
- 查询最多 5 间有空档的房间；推荐档 2～4 个。
- 前端 JS；server TS。测试：`pnpm -F @meeting/server test`、`pnpm -F @meeting/web test`。
- 中文注释。不做释放、改已有预定、公司网关、聊天记录。
- 每个 task 验证通过后在 **meeting 仓** commit，不要 push 到联调/发布分支。

---

### Task 1: 空档计算 `searchAvailability`

**Files:**
- Create: `apps/meeting/server/src/domain/availability.ts`
- Test: `apps/meeting/server/tests/availability.test.ts`
- Modify: 无

**Interfaces:**
- Consumes: `BoardRoom` from `domain/booking.ts`；`toMinutes` / `fromMinutes` / `nextOpen` from `domain/time.ts`
- Produces: `searchAvailability(rooms, query, now) => { heading: string; rooms: QueryRoom[] }`  
  `SearchQuery`: `{ date: string; durationMin?: number; windowStart?: string; windowEnd?: string; buildingName?: string; floorName?: string; capacity?: number; facilities?: string[] }`  
  `QueryRoom`: `{ roomId, roomName, buildingName, floorName, capacity, facilities, openStart, openEnd, busy: {start,end}[], slots: FreeSlot[] }`  
  `FreeSlot`: `{ roomId, roomName, buildingName, floorName, capacity, facilities, date, start, end }`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchAvailability } from "../src/domain/availability.ts";
import type { BoardRoom } from "../src/domain/booking.ts";

const now = { date: "2026-08-27", minute: 10 * 60 };

const room = (busy: BoardRoom["busyEvents"]): BoardRoom => ({
  id: "r1",
  name: "星海",
  buildingName: "A座",
  floorName: "3F",
  capacity: 12,
  facilities: ["投影"],
  locationNote: null,
  openStart: "09:00",
  openEnd: "18:00",
  bookAheadDays: 7,
  needApproval: false,
  allowRecurring: false,
  allowPreempt: false,
  busyEvents: busy
});

test("free slots skip occupied half-open interval", () => {
  const res = searchAvailability(
    [room([{ id: "b", start: "10:00", end: "12:00", title: "x", host: "", dept: "", mine: false }])],
    { date: "2026-08-27", durationMin: 60 },
    now
  );
  const starts = res.rooms[0].slots.map((s) => s.start + "-" + s.end);
  assert.equal(starts.includes("10:00-11:00"), false);
  assert.equal(starts.includes("11:00-12:00"), false);
  assert.equal(starts.includes("12:00-13:00"), true);
});

test("adjacent to busy is allowed (12:00-13:00 after 10:00-12:00)", () => {
  const res = searchAvailability(
    [room([{ id: "b", start: "10:00", end: "12:00", title: "x", host: "", dept: "", mine: false }])],
    { date: "2026-08-27", durationMin: 60, windowStart: "12:00", windowEnd: "13:00" },
    now
  );
  assert.equal(res.rooms[0].slots.length, 1);
  assert.equal(res.rooms[0].slots[0].start, "12:00");
});

test("today clips starts before nextOpen", () => {
  const res = searchAvailability([room([])], { date: "2026-08-27", durationMin: 60 }, now);
  assert.ok(res.rooms[0].slots.every((s) => s.start >= "10:00"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meeting/server exec tsx --test tests/availability.test.ts`  
Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

在 `availability.ts`：

- `durationMin` 默认 60，且必须是 30 的倍数、≥30。
- 过滤：`buildingName` / `floorName` 精确匹配；`capacity` 为最小人数；`facilities` 为房间设施超集。
- 把开放区间切成 30 分钟格，去掉与任一 busy `[start,end)` 相交的格，再合并连续空格，切出长度为 `durationMin` 的档（步进 30 分钟）。
- `windowStart`/`windowEnd` 若有，档必须完全落在窗口内。
- 无空档的房间丢掉；结果按空档数降序，截断 5 间。
- `heading`：有窗口则「{date} · {windowStart}–{windowEnd}」，否则「{date} · 空闲 ≥ {durationMin/60} 小时」（不足 60 分钟写分钟）。
- `busy` 原样映射 `busyEvents` 的 start/end。
- 每个 `FreeSlot` 带齐房间字段和 `date`（用 query.date）。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meeting/server exec tsx --test tests/availability.test.ts`  
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
cd /Users/nic/w/ai-dev-workspace/apps/meeting
git add server/src/domain/availability.ts server/tests/availability.test.ts
git commit -m "feat(agent): 按占用计算可点空档"
```

---

### Task 2: 会话草稿与已发档

**Files:**
- Create: `apps/meeting/server/src/domain/agentSession.ts`
- Test: `apps/meeting/server/tests/agentSession.test.ts`

**Interfaces:**
- Produces: `createAgentSessionStore(opts?: { ttlMs?: number; now?: () => number })`  
  方法：  
  `ensure(userId: string, sessionId?: string): { sessionId: string }`  
  `rememberSlots(userId, sessionId, slots: FreeSlot[]): void`  
  `hasIssued(userId, sessionId, slot: Pick<FreeSlot,"roomId"|"date"|"start"|"end">): boolean`  
  `putDraft(userId, sessionId, slot, title: string): { draftId: string }`  
  `getDraft(userId, draftId): { slot, title, sessionId } | null`  
  `deleteDraft(userId, draftId): void`  
  `dropSession(userId, sessionId): void`  
  TTL 默认 `10 * 60 * 1000`。过期条目 `getDraft`/`hasIssued` 当不存在。`sessionId` 用 `crypto.randomUUID()`。

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAgentSessionStore } from "../src/domain/agentSession.ts";

const slot = {
  roomId: "r1",
  roomName: "星海",
  buildingName: "A座",
  floorName: "3F",
  capacity: 12,
  facilities: [] as string[],
  date: "2026-08-27",
  start: "14:00",
  end: "15:00"
};

test("expired draft cannot be read", () => {
  let t = 0;
  const store = createAgentSessionStore({ ttlMs: 10, now: () => t });
  const { sessionId } = store.ensure("u1");
  store.rememberSlots("u1", sessionId, [slot]);
  const d = store.putDraft("u1", sessionId, slot, "周会");
  t = 11;
  assert.equal(store.getDraft("u1", d.draftId), null);
});

test("other user cannot read draft", () => {
  const store = createAgentSessionStore();
  const { sessionId } = store.ensure("u1");
  store.rememberSlots("u1", sessionId, [slot]);
  const d = store.putDraft("u1", sessionId, slot, "");
  assert.equal(store.getDraft("u2", d.draftId), null);
});

test("hasIssued is exact on room+date+start+end", () => {
  const store = createAgentSessionStore();
  const { sessionId } = store.ensure("u1");
  store.rememberSlots("u1", sessionId, [slot]);
  assert.equal(store.hasIssued("u1", sessionId, slot), true);
  assert.equal(store.hasIssued("u1", sessionId, { ...slot, start: "15:00", end: "16:00" }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meeting/server exec tsx --test tests/agentSession.test.ts`  
Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

用 `Map<string, Session>`，key 为 `userId`。Session 含 `sessionId`、`issued: Map<string, FreeSlot>`（key=`${roomId}|${date}|${start}|${end}`）、`drafts: Map<draftId, { slot, title, exp }>`、`exp`。每次读写先按 `now()` 清过期。`putDraft` 的 `draftId` 用 `crypto.randomUUID()`。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @meeting/server exec tsx --test tests/agentSession.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/agentSession.ts server/tests/agentSession.test.ts
git commit -m "feat(agent): 会话下发档与 TTL 草稿"
```

---

### Task 3: `handleTurn` 非 LLM 动作（含 confirm 写库门闩）

**Files:**
- Create: `apps/meeting/server/src/domain/agentTurn.ts`
- Test: `apps/meeting/server/tests/agentTurn.test.ts`

**Interfaces:**
- Consumes: `createAgentSessionStore`、`searchAvailability`、`createBooking`、`getBoard`
- Produces:  
  `type TurnEvent` = 契约里的 `MeetingAgentEvent`（TS 本地重复一份联合类型，字段名必须一致）  
  `handleTurn(input): TurnEvent[]`  
  `TurnInput`: `{ db, corpId, user: {userId,userName,dept}, body: { sessionId?, action?, message?, slot?, draftId?, title? }, store, now?: {date, minute}, llm?: LlmPort }`  
  `LlmPort` 本 task 可传 `undefined`；`action` 为 message 且无 llm 时返回单条 `{ type:"error", msg:"助手未配置", code:"M4000", expression:"sorry" }`（先让 message 测试过门，真正 LLM 在 Task 4）。  
  返回数组：始终先 `{ type:"session", sessionId }`（若新会话）。

行为：

- `cancel`：`dropSession`，事件 `closed` + `expression:"down"`。
- `pick_slot`：无 session / `hasIssued` false → `error` `msg:"请选择助手给出的时段"` `expression:"sorry"`。成功则 `putDraft`，`confirm` 事件 `expression:"expect"`，`title` 用空串。
- `confirm`：`getDraft` 空 → `error` `msg:"确认已过期，请重新选择"`。否则 `createBooking(..., { roomId: slot.roomId, date, start, end, title: body.title ?? draft.title }, now)`。成功：`deleteDraft`，`booked` + `bookingId` + `happy`。失败：`error` 带 `code`/`msg`；若 `M4010` 再 `searchAvailability` 同房间、同 `durationMin`（end-start）、同 date，取 2～4 个**不是原档**的 `slots` 做成 `suggest`（`reason` 用 `msg`，`sorry`），并 `rememberSlots`。
- `message` 本 task：若无 `llm`，`error` 助手未配置。有 `llm` 的路径 Task 4 再写，但函数签名先留 `llm?`。

- [ ] **Step 1: Write the failing test**

用 `openMemoryDb` + `createRoom` + 与 `booking.test.ts` 相同的 `FROZEN`/`host`。先 `rememberSlots` 再 `pick_slot`/`confirm`。

必须覆盖：

1. `confirm` 无 draft → 零 booking 行。  
2. `pick_slot` 未下发档 → 零 booking。  
3. `message` 无 llm → 零 booking。  
4. 合法 `pick_slot` + `confirm` → 一条 booking；`title` 可覆盖。  
5. 先占档再 `confirm` 同档 → `error` code `M4010` 且带 `suggest`。

查插入：`db.prepare("SELECT count(*) AS n FROM bookings").get()`。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @meeting/server exec tsx --test tests/agentTurn.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write `handleTurn`**

`agentTurn.ts` 内实现上述分支。`pick_slot` 不要调 `createBooking`。

- [ ] **Step 4: Run tests**

Run: `pnpm -F @meeting/server exec tsx --test tests/agentTurn.test.ts tests/booking.test.ts`  
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/agentTurn.ts server/tests/agentTurn.test.ts
git commit -m "feat(agent): 点档进草稿，确认才写库"
```

---

### Task 4: `message` + OpenAI 兼容 tool `search_availability`

**Files:**
- Create: `apps/meeting/server/src/domain/agentLlm.ts`
- Modify: `apps/meeting/server/src/domain/agentTurn.ts`
- Test: `apps/meeting/server/tests/agentLlm.test.ts`

**Interfaces:**
- Produces: `createOpenAiLlm(opts: { baseUrl, apiKey, model, fetchImpl?: typeof fetch }): LlmPort`  
  `LlmPort = { complete(args: { userText: string; toolResult?: unknown }): Promise<LlmDecision> }`  
  `LlmDecision` =  
  `{ kind: "search"; args: SearchQuery } | { kind: "need_more"; text: string } | { kind: "query_heading"; heading?: string }`  
  更简单、可测的约定：`complete` **一次**返回模型要调的 tool 参数或 `need_more`。`handleTurn` 的 message 路径：

  1. 推逻辑事件由路由做；本函数只返回后续事件列表。  
  2. `decision = await llm.complete({ userText: message })`。  
  3. `kind==="need_more"` → `[{type:"need_more", text, expression:"puzzled"}]`。  
  4. `kind==="search"` → `getBoard(db, corpId, args.date || now.date)` 失败则 `error`；成功则 `searchAvailability(board.rooms, { ...args, date: args.date || now.date }, now)`，`rememberSlots` 全部 slots。若 `rooms.length===0` → `need_more` 或 `error`「没有符合条件的空档」`puzzled`。否则 `query` 事件 `ease`。  
  5. 若用户话里明显是「订」且只有 1 个 slot：不要自动 confirm；仍返回 `query`（或单档也走 query 卡）。**禁止 message 路径 `createBooking`。**

`createOpenAiLlm`：POST `${baseUrl}/v1/chat/completions`，header `Authorization: Bearer ${apiKey}`，body：

```json
{
  "model": "<MEETING_LLM_MODEL>",
  "messages": [
    { "role": "system", "content": "你是会议室助手。只通过 search_availability 查空档。日期用 yyyy-MM-dd。时长默认 60 分钟。不要声称已经预定。" },
    { "role": "user", "content": "<userText>" }
  ],
  "tools": [{
    "type": "function",
    "function": {
      "name": "search_availability",
      "parameters": {
        "type": "object",
        "properties": {
          "date": { "type": "string" },
          "durationMin": { "type": "number" },
          "windowStart": { "type": "string" },
          "windowEnd": { "type": "string" },
          "buildingName": { "type": "string" },
          "floorName": { "type": "string" },
          "capacity": { "type": "number" },
          "facilities": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }],
  "tool_choice": "auto"
}
```

解析：若 `choices[0].message.tool_calls[0].function.name==="search_availability"`，`JSON.parse(arguments)` 为 search。若无 tool_calls 且有 content，当作 `need_more`（content 截断 80 字）。fetch 失败 → throw，由 `handleTurn` 收成 `error` `msg:"助手暂时不可用"` `sorry`。

测试用 **mock fetchImpl**：返回带 `search_availability`、`date=2026-08-27`、`durationMin=60` 的 tool_calls。断言 `handleTurn` message 后 booking 计数仍为 0，且事件含 `type:"query"`。

另测：mock 返回无 tool 只有 content「还要几点」→ `need_more`。

- [ ] **Step 1: Write failing tests in `agentLlm.test.ts`**
- [ ] **Step 2: Run，确认 FAIL**
- [ ] **Step 3: Implement `agentLlm.ts` 并接上 `handleTurn` message 分支（先 `status` 不在这里发，路由发）**
- [ ] **Step 4: `tsx --test tests/agentLlm.test.ts tests/agentTurn.test.ts` PASS**
- [ ] **Step 5: Commit** `feat(agent): message 只查空档不写库`

---

### Task 5: SSE 路由 `POST /meetingApi/agent/turn`

**Files:**
- Create: `apps/meeting/server/src/routes/agent.ts`
- Modify: `apps/meeting/server/src/app.ts`（`api.route("/", agent)`）
- Test: `apps/meeting/server/tests/agentRoute.test.ts`

**Interfaces:**
- Consumes: `handleTurn`、进程级单例 `createAgentSessionStore()`（module 级）
- `requireUser` 与 bookings 相同。
- `message` 且缺 `MEETING_LLM_API_KEY` 或 `MEETING_LLM_BASE_URL`：**不要 SSE**，`fail(c, "M4000", "助手未配置")` JSON。
- 成功：`Content-Type: text/event-stream`。先写 `status` `{ text:"正在理解", expression:"focus" }`，再写 `handleTurn` 返回的每一条（`session` 放最前）。用 Hono `streamSSE`：`await stream.writeSSE({ data: JSON.stringify(event) })`。
- `action` 缺省当 `message`。body JSON 解析失败 → `fail` `M4000` `请求无效`。

- [ ] **Step 1: 测试**

```ts
test("message without llm env returns JSON M4000", async () => {
  delete process.env.MEETING_LLM_API_KEY;
  delete process.env.MEETING_LLM_BASE_URL;
  const db = openMemoryDb();
  const res = await createApp(db).request("/meetingApi/agent/turn", {
    method: "POST",
    headers: { ...headers("u1"), "content-type": "application/json" },
    body: JSON.stringify({ message: "订一间" })
  });
  const body = await res.json();
  assert.equal(body.code, "M4000");
  assert.equal(body.msg, "助手未配置");
});

test("anonymous POST agent/turn is M4002", async () => {
  const res = await createApp(openMemoryDb()).request("/meetingApi/agent/turn", {
    method: "POST",
    headers: { zxCorpId: "zx-001", "content-type": "application/json" },
    body: JSON.stringify({ message: "hi" })
  });
  const body = await res.json();
  assert.equal(body.code, "M4002");
});
```

再测 `cancel`：设假 key 以免 message 误入；`action:"cancel"` 不需要 LLM，应 200 SSE，body 文本含 `"type":"closed"`。

- [ ] **Step 2: Run FAIL**
- [ ] **Step 3: 实现路由并挂到 `app.ts`**
- [ ] **Step 4: `tsx --test tests/agentRoute.test.ts` PASS；全量 `pnpm -F @meeting/server test` PASS**
- [ ] **Step 5: Commit** `feat(agent): POST /agent/turn SSE`

---

### Task 6: 前端事件折叠纯函数

**Files:**
- Create: `apps/meeting/web/src/features/booking/agent/applyEvent.js`
- Test: `apps/meeting/web/src/features/booking/tests/applyEvent.test.js`

**Interfaces:**
- Produces: `emptyAgentUi()` → `{ open:false, sessionId:"", status:"", expression:"idle", card:null }`  
  `card`：`null | { type:"query", heading, rooms } | { type:"confirm", draft } | { type:"suggest", reason, options } | { type:"need_more", text } | { type:"error", msg, code? }`  
  `applyAgentEvent(state, event) => state`（不可变）  
  规则：`session` 写 `sessionId`；`status` 写 `status`+`expression`，**保留** card；`query`/`confirm`/`suggest`/`need_more`/`error` 替换 card、清 status 或保留短 status 为空串、设 expression；`booked` → `open:false`、`card:null`、`expression:"happy"`；`closed` → `open:false`、`card:null`、`expression:"down"`。

- [ ] **Step 1: 测试** `query` 后 `status` 不丢 card；`closed` 收起；`booked` 收起。
- [ ] **Step 2: Run** `pnpm -F @meeting/web test` 新增文件 FAIL
- [ ] **Step 3: 实现**
- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit** `feat(agent): 折叠 SSE 事件到单卡片状态`

---

### Task 7: FAB 输入条、卡片、表情、预定成功刷新

**Files:**
- Modify: `apps/meeting/web/src/features/booking/components/AiBuddyFab.vue`
- Create: `apps/meeting/web/src/features/booking/components/AgentQueryCard.vue`
- Create: `apps/meeting/web/src/features/booking/components/AgentConfirmCard.vue`
- Create: `apps/meeting/web/src/features/booking/agent/streamTurn.js`
- Modify: `apps/meeting/web/src/features/booking/booking.css`（输入条从球长出、卡片在输入条上方、`.ai-buddy[data-expression]` 眼形：`sorry` 眼更圆、`down` 眼垂、`happy` 眼弯）
- Modify: `apps/meeting/web/src/features/booking/BookingBoardPage.vue` — `<AiBuddyFab @booked="reload" />`（`reload` 已有）
- Modify: `apps/meeting/web/src/features/booking/MobileBookingPage.vue` — 同样 `@booked` 调 `reload`，成功 `showToastSuccess("预定成功")` 放在 FAB 内 emit 后由页面 toast，或 FAB 自己 toast。**不要** `mine.open=true`。
- Modify: `apps/meeting/web/src/utils/index.js` 若需导出 token 头（已有 `getToken`/`getCorpId`/`getUserId`/`getUserName`/`getDept`）

**Interfaces:**
- `streamTurn(body)`：`fetch("/meetingApi/agent/turn", { method:"POST", headers: { "Content-Type":"application/json", zxCorpId, zxUserId, zxUserName, zxUserDept, Authorization: Bearer access_token }, body: JSON.stringify(body) })`。若 `content-type` 含 json：`res.json()`，`code!=="M0000"` throw `{ msg, code }`。若 SSE：读 `ReadableStream`，按行解析 `data: ` JSON，对每事件 callback。
- FAB props：现有 `lifted`；emit `booked`。
- 点 bot：`open=true`，显示输入条（`transform-origin` 右下），不先发请求。
- 发送：`action:"message"`，先本地 `status`「正在理解」`focus`。
- 点空档：`pick_slot` + 该 `slot` 对象原样。
- 确认：`confirm` + `draftId` + 输入框主题。
- 取消按钮：`cancel` 后本地也可 `applyAgentEvent(closed)`；网络失败仍收起。
- 查询卡：每间一行名称/楼层/人数；一条 flex 迷你条（busy 用 `--timeline-busy`，空档可点）；最多展示该间前 3 个 slot 按钮。
- 确认卡：主题 `contenteditable` 或 input；会议室时间只读；确认/取消。
- 推荐卡：reason + option 按钮，文案 `{roomName} {date} {start}-{end}`。
- 动画：`.ai-buddy-composer` `translateY(8px)` → `0`；卡片 `grid-template-rows: 0fr` → `1fr`。`prefers-reduced-motion` 已有全局覆盖。

- [ ] **Step 1: 实现 `streamTurn.js` + 扩展 FAB（无新单测框架则用 `applyEvent` 已覆盖折叠；手动点）**
- [ ] **Step 2: `pnpm -F @meeting/web test` 与 `pnpm -F @meeting/web run typecheck` 通过**
- [ ] **Step 3: 浏览器**  
  PC `http://localhost:6273/meeting/`、移动 `http://localhost:6273/meeting/m/`：点 bot 出输入条；无 LLM 发一句看到「助手未配置」；有 mock 时查卡可点、确认后看板刷新。  
  无 key 时不得出现「预定成功」。
- [ ] **Step 4: Commit** `feat(agent): 首页助手输入条与查订卡片`

---

### Task 8: 文档收尾（meeting 仓不改契约）

**Files:**
- Modify: `context/features/20260827-会议室助手-agent预定/status.md` 矩阵（实现完成后）
- 若联调与契约不符：先改 `context/contracts/meeting/` Changelog，再改代码，并在该功能 `impl-notes.md` 记一条。

- [ ] **Step 1: 全量** `pnpm test`（meeting 仓根）  
  Expected: server + web 全绿。
- [ ] **Step 2: 更新 status 矩阵对应行 ✅**
- [ ] **Step 3: 编排仓** `git add context/features/20260827-会议室助手-agent预定/status.md && git commit -m "docs(meeting-agent): 标记查订助手实现进度"`

---

## Self-review（对照 spec）

| Spec 条 | Task |
|---------|------|
| 输入条动画 + 上方单卡 | 7 |
| 查询精美卡 | 7 |
| 冲突推荐档可点且不直接写库 | 3、7 |
| 确认/取消；取消收起换表情 | 3、6、7 |
| 失败反馈；LLM 不能私自下单 | 3、4、5 |
| 只改主题 | 7 confirm 卡 + confirm `title` |
| OpenAI 兼容 env | 4、5 |
| 查询不改看板筛选；成功 reload+toast | 7 |
| 空档/草稿/message 零插入测试 | 1–4 |
| SSE 契约 | 5 |

无 TBD。`handleTurn` / `FreeSlot` 字段名与契约一致。

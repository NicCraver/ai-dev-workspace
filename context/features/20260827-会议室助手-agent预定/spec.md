# Spec：智能会议室 · 助手 agent 预定（查 + 订）

> Superpowers brainstorm 产出。最后更新：2026-08-27

## 背景与目标

PC / 移动预定首页右下角已有 Grok 风格 bot（白胶囊眼可动）。需要做成真正能查空房、协助预定的小 agent：用户说话 → 服务端工具查空档 → 精美结果卡或确认卡 → 用户确认后才调用现有 `createBooking`。

成功标准：

1. 点 bot 有动画弹出输入条；发出后上方弹出/替换一块面板，用户不觉得卡住。
2. 查询返回独立 UI 组件（房间 + 迷你空闲条 + 可点空档），不是长文本。
3. 冲突时提示换时间，推荐档可点且参数完整，点选后进入待确认而不是静默写库。
4. 确认前有确认/取消；取消立刻收起，bot 换表情；确认才写库。
5. 写库失败（含 `M4010`）反馈到面板；LLM 无法绕过草稿私自下单。
6. 主题可在确认卡点改；会议室和时间不可在卡片里自由编辑。

## 关键决策

| 项 | 结论 |
|---|---|
| 交互壳 | 锚定 bot：输入条 + 上方单卡片栈，不是聊天记录，不是全屏底栏 |
| 改字段 | 只允许点改主题；会议室/时间靠推荐档或再打一句 |
| LLM | 会议服务环境变量，OpenAI 兼容接口 |
| 范围 | 查空档 + 新预定。不做释放、改已有预定、公司 AI 网关 |
| 写库 | 仅 `action=confirm` + 有效 `draftId` 调现有 `createBooking` |
| 看板 | 查询不改首页筛选/日期；成功后 `reload()` + toast，不强制打开「我的预定」 |
| 契约 | `context/contracts/meeting/agentTurn.d.ts` |

## 范围

**做**：FAB 输入条与卡片栈；SSE `POST /meetingApi/agent/turn`；`search_availability` 工具；内存草稿；查询卡 / 确认卡 / 推荐档；bot 表情绑定状态；PC 与移动首页共用组件。

**不做**：多轮聊天泡、迷你表单改房间和时间、释放预定、改已有预定、未配置 LLM 时假装成功。

## 交互

点 bot：球原地，输入条从球长出。发出后卡片从输入条顶边展开；状态文案在同一块替换。取消/成功：卡片和输入条收回。`prefers-reduced-motion` 只淡入淡出。移动端有选时条时抬高（沿用 `lifted`）。

| 状态 | 卡片 | 表情 |
|------|------|------|
| 理解 / 查空档 | `status` | focus |
| 查询结果 | `query` | ease |
| 待确认 | `confirm`（主题可点改） | expect |
| 冲突 | `suggest`（2～4 完整档） | sorry |
| 缺信息 | `need_more` | puzzled |
| 失败 | `error` | sorry |
| 成功 | `booked` 后收起刷新看板 | happy |
| 取消 | `closed` 立刻收起 | down，再回 idle |

点查询卡空档或推荐档：`pick_slot`，不走 LLM，进入 `confirm`。点确认：`confirm`。点取消：`cancel`，丢草稿。

查询卡：PC 约 360px，移动全宽减边距；最多约 5 间；空档为按钮；满房可不列或灰掉。

## Agent 与数据流

环境变量：`MEETING_LLM_BASE_URL`、`MEETING_LLM_API_KEY`、`MEETING_LLM_MODEL`。未配置：握手失败返回业务错误，面板说明助手不可用。

一轮请求见契约 `MeetingAgentTurnReq`。`message` 才允许 LLM；工具只暴露 `search_availability`（入参日期/楼层/人数/时长/时段等，出参与看板占用规则一致：30 分钟格、开放时间、提前天数、半开区间重叠）。

草稿：`userId + draftId`，内存，约 10 分钟 TTL。`pick_slot` 必须是本会话下发过的档。`confirm` 用草稿 + 可选新主题调 `createBooking`。`M4010` 等失败：`error` 后可再 `suggest`。

前端用 fetch/SSE 消费事件，不用 axios 拆 `M0000` 信封解析每一帧。成功后走现有 `reload()`。

## 错误处理

- 未登录：与 `POST /bookings` 相同，拒绝。
- 非法/过期/他人 draft：`error`，不写库。
- LLM 超时或工具失败：`error`，表情 sorry。
- 预定校验失败：展示后端 `msg`，冲突则附推荐档。

## 测试

- 空档与占用不重叠；推荐档可预定。
- 无草稿 / 过期 / 错用户不能 `confirm`。
- 仅 `message` 轮次零插入。
- 前端按事件切卡片；取消收起。

## 落地位置

- `apps/meeting/web`：扩展现有 `AiBuddyFab` 为输入条 + 卡片栈 + 表情。
- `apps/meeting/server`：新路由与 agent 域，复用 `getBoard` / `createBooking`。
- 契约：`context/contracts/meeting/`。
- 原生三端不改（WebView 仍打开同一套页面）。

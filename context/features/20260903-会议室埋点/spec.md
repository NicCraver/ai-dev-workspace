# Spec：会议室埋点

> 最后更新：2026-09-03

## 背景与目标

看板预定与助手预定目前没有可查询的使用数据。新增只追加的 `meeting_event` 表，前端批量上报白名单事件，用来看：谁打开了看板、手动预定漏斗、助手从 chip/说话到订成的漏斗。

成功标准：合法事件能入库；非法事件名跳过；同一 `eventId` 幂等；用户说话原文（`text`/`message`）不入库。

## 用户流程

1. 打开预定看板 → `page_view`
2. 打开手动预定弹层 → `booking_open`；提交成功 → `booking_submit`（`source:"form"`）；失败 → `booking_fail`；释放 → `booking_release`
3. 助手：点 chip → `agent_chip`；打字发送 → `agent_message`（只带 `len`）；出结果 → `agent_result`；点时段 → `agent_pick`；确认 → `agent_confirm`；返回 → `agent_back`；订成 → `agent_booked`；失败 → `agent_fail`
4. 助手订成**不**再打 `booking_submit`，避免和表单双计

## 范围

- 本期做：contact DDL + `POST /meetingRoom/events` + 管理员 `GET /events/recent`；会议室前端看板 / 弹层 / 助手埋点；契约与单测
- 本期不做：分析看板、后台导出、原生端独立埋点 SDK、把用户原话存库

## 各端差异点

会议室走 WebView。埋点在 meeting 前端；android / ios / desktop 复用同一套页面，无需各端再接。

## 依赖的接口

- `context/contracts/meeting/events.d.ts`（POST `/meetingApi/events`）
- `context/contracts/meeting/eventsRecent.d.ts`（GET `/meetingApi/events/recent`）

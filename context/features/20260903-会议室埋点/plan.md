# Plan：会议室埋点

> 最后更新：2026-09-03

## Web（会议室前端，内嵌四端）

- [x] (web) `telemetry.js` 队列 + 400ms flush + `pagehide` beacon；剥 `text`/`message`
- [x] (web) 看板 `page_view` / 释放；弹层 `booking_open/submit/fail`
- [x] (web) 助手 chip / message / result / pick / confirm / back / booked / fail

## 接口（contact）

- [x] DDL `meeting_event`（雪花 id、`(corpId,eventId)` 唯一）
- [x] POST `/meetingRoom/events` 白名单、最多 20 条、幂等
- [x] GET `/meetingRoom/events/recent` 仅管理员
- [x] JUnit：入库、重复、非法名、超 20、剥原文、非管理员 M4003

## 接口联调

- [x] (web) 本地建表 + 重启 contact 后打通 POST，用 `/events/recent` 核对

## Android / iOS / Desktop 移植

无需独立移植；跟 meeting WebView。

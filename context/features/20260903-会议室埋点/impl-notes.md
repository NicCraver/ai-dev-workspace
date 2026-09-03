# 实现笔记：会议室埋点

> 平台无关。最后更新：2026-09-03

## 数据

- 表 `meeting_event`，只追加。主键雪花 id。同一企业 `eventId` 唯一，重复上报计 duplicated。
- `props` 为 JSON 字符串，最长 2000。服务端再剥一遍 `text`/`message`。`agent_message` 若无 `len` 则补 0。
- 白名单：`page_view`、`booking_open/submit/fail/release`、`agent_chip/message/result/pick/confirm/back/booked/fail`。
- 助手漏斗靠 `props.sessionId` 串联。首次发言时 session 可能尚未下发，该条可以没有 sessionId。
- 手动预定成功打 `booking_submit` + `source:"form"`；助手成功只打 `agent_booked`，不要两条都算一次成功。

## 接口

- 上报：`POST /meetingApi/events`（Java `/meetingRoom/events`），body `{ events: [...] }`，单次最多 20。
- 查询：`GET /meetingApi/events/recent?limit=`，管理员，本企业最近 N 条（上限 50）。
- 未登录：M4002。非管理员查 recent：M4003。超 20 条：M4000。非法事件名静默跳过，不挡业务。
- `clientType` 取 query `zxClientType` 或 header `clientType`，缺省 `app`。

## 前端行为

- 客户端先剥原文再入队；400ms 批量 flush；离开页用 sendBeacon。
- 上报失败吞掉，不影响预定。
- `page` 为去掉 `/meeting` 前缀的 pathname。

## 联调坑

- 本地 Java 必须重新打包并重启，旧 jar 没有 `/meetingRoom/events`。
- 本机没有 `mysql` 客户端时，用 JDBC（mysql-connector + socksNonProxyHosts）跑 DDL。
- Clash 会劫持 JDBC，建表/连库都要带 `socksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost`。

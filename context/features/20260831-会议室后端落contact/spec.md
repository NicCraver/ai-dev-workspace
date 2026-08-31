# Spec：会议室后端落 contact

> 2026-08-31 创建。依据：`apps/meeting` 现有 Node 服务（26 个文件 / 4 张表 / 19 个接口）逐条对照落成 Java。

## 目标与范围

把 `apps/meeting/server`（Hono + SQLite，本地开发用）的业务能力搬到 `apps/contact`（Spring Boot 微服务）作为正式后端。

**一期范围**：`rooms` / `dicts` / `bookings` / `board` / `me` 共 17 个接口。
**一期不搬**：`/agent/suggestions`、`/agent/turn`（要调 LLM，Java 侧无现成封装）。agent 继续留在 Node 端，改为调用本仓库新出的 Java 接口取数。
**不改前端**：Java 侧必须严格对齐现有请求/响应形状与错误码，`apps/meeting/web` 只改 baseURL，不改业务代码。

## 关键约束（先看这段，决定了所有实现细节）

1. **信封**：成功 `{code:"M0000", data, msg:""}`。前端 `web/src/server/http.js:151` 只判 `code !== "M0000"`，其余码一律弹 `msg`。contact 的 `Ret`（zx-common）自带 `code/msg/data/ctime/requestID`，多出两个字段前端无害 → **直接用 `Ret.ok().setData(x)`**。
2. **错误码必须原样保留**：`M4000` 参数/业务校验、`M4001` 缺企业、`M4002` 缺用户、`M4003` 无管理权限、`M4004` 不存在、`M4010` 时段被占用。这些码目前没有走 contact 的 `ErrCodeBean` 体系（那套是 `C_D_001` 风格），**不要改成 contact 风格**，否则前端提示与 agent 端 `M4010` 分支（`agentTurn.ts:177`）全废。
3. **建表**：同库 `zx_contact`。**表名下划线 + 列名驼峰**（现有表就是 `account_platform` / `accountId`，因为 `map-underscore-to-camel-case=false`）。
4. **主键**：`id-type=input`，实体继承 `BaseEntity`（`id` 为 String 雪花），插入走 `BaseService.insert()` 自动补 `id` / `creator` / `createAt` / `updator` / `updateAt`。**不要用自增**。
5. **租户与用户**：见下面「多企业」整节，这是本功能最容易做错的地方。
6. **时间表示**：沿用 Node 的模型——`date`（`YYYY-MM-DD` 字符串）+ `startMin` / `endMin`（当天零点起的分钟数，int）。冲突查询靠 `(roomId, date, startMin, endMin)` 区间比较，**别改成 datetime**，否则跨端时区与冲突判定要重写。响应里同时回 `start` / `end` 的 `HH:mm` 字符串（前端直接渲染用）。
7. **时区**：Node 端所有"现在"走 `shanghaiNow()`。Java 侧固定 `Asia/Shanghai`（Dockerfile 已设 `TZ`），判过期/可提前预定天数都用它。

## 多企业（重点，勘察自 contact + desktop 源码）

### contact 现有模型

| 机制 | 事实 |
|---|---|
| 账号 vs 成员 | `account`（登录账号）与 `user`（企业内成员）分离。一个 `accountId` 在 N 个企业各有一条 `user`（`user.corpId` + `user.accountId`，`user.id` 各不相同，逻辑删除 `isDel`） |
| 请求上下文 | `zx-common` 的 `AAuthFilter` 从 header 读 `zxAccountId` / `zxCorpId` / `zxClientType`（日志原文「API 网关接受的 corpId 为」），塞进 `SessionContext`。`getCurrentAppUser()` 只给 `accountId` + `corpId`，**没有 userId** |
| 租户隔离 | 所有业务表带 `corpId` 列，索引一律 corpId 打头（`dept` / `user` / `position` 都是这个套路） |
| 企业树 | `Corp.pid` + `pids`（物化路径祖先链），集团—子公司 |
| 企业间关联 | `corp_and_corp_rel`：relType = 直属 / 上级 / 下级 / 其他 / **个人外协**，带 relState |
| 跨企业细粒度授权 | `multiorg/dataauthority`（`TbSourceAuthority*`）：部门/用户粒度，带 direction、toCorpId、objectType。会议室**用不到** |

### 本功能的处理方式

- **全企业开放，不设白名单**。任何企业进来都能建自己的会议室、订自己的会议室，数据按 `corpId` 天然隔离。上线试点范围由运营控制入口（微应用是否对该企业可见），后端不做限制。
- **可见/可预定范围：仅本企业**。`meeting_room.corpId` 严格等于当前企业，不做集团子树、不做关联企业。外协一期不特判——外协人员在目标企业本就有 `user` 记录，自然能订。
- **corpId 取值：只认 `SessionContext`，忽略前端传的 `zxCorpId` 业务参数**。前端 URL query / 自定义 header 里的 corpId 一律不参与业务判断。
- **userId 必须服务端推导**：用 `(accountId, corpId)` 查 `user` 表（`isDel=0`）拿企业内 `user.id`，作为 `hostUserId`；`user.name` 作 `hostUserName`，部门名作 `hostDept`。**不要直接存 accountId**——同一个人在不同企业是不同 user.id，存 accountId 会让「我的预定」跨企业串台。
- **查不到有效 user 就拒绝**（返回 `M4002`）。这一步顺带堵住了伪造 `zxCorpId` 越权：即使 header 被改成别的企业，该账号在那个企业没有 user 记录，直接拒。
- 所有查询（看板、我的预定、冲突检测、管理员列表）一律带 `corpId` 条件，索引照 contact 惯例以 corpId 打头。

### PC 端切企业的实际行为（已勘察，链路是通的）

会议室以**微应用**形态挂在 PC 端应用面板里。切企业时：

- `views/open-panel.vue:139` 的 `LoginCompany` deep watch：corpId 变化 → `getAllmic("companyChange")` 重拉该企业微应用列表 + `openAppList.splice(0)` **清空已打开的微应用** + 回到应用列表页。`openAppList` 正是 `v-for` 渲染 `webview-control` 的数据源，清空即销毁 webview。
- `views/main.vue:587` 的同名 watch 同时 `SetMicroApps([])`、`hasOpenMail=false`、停邮件轮询。
- 重新打开会议室时，`components/common/webview-control.vue:335` 的 `formatURL()` 按当前 `LoginCompany.corpId` 重拼 URL。

**结论：切企业 = 会议室被关闭 + 重开时拿到新 corpId，不存在 stale corpId。** 多企业在前端这一侧是天然支持的。

> 注：`webview-control` 组件自身 `watch: {}` 为空、不监听企业变化——但上层已经把它销毁了，所以不影响。别被这个组件的空 watch 误导。

服务端仍然**不信前端传的 corpId**（见上），这是纵深防御，不是因为前端不可靠。

## 数据模型（4 张表）

`dbscript/2026/V1_0_20260901_meetingroom_DDL.sql`

| 表 | 说明 | 关键列 |
|---|---|---|
| `meeting_dict` | 字典（楼宇 / 设施） | `corpId` `type`(building/facility) `name` `sort` `enabled`；唯一键 `(corpId,type,name)` |
| `meeting_room` | 会议室 | `corpId` `name` `groupName` `buildingName` `floorName` `capacity` `facilities`(JSON 字符串) `locationNote` `openStart` `openEnd` `bookAheadDays`(7/30/90/180) `needApproval` `allowRecurring` `allowPreempt` `enabled` |
| `meeting_booking` | 预定 | `corpId` `roomId` `date` `startMin` `endMin` `title` `remark` `hostUserId` `hostUserName` `hostDept` `seriesId`(循环/多日批次) `releasedAt`(释放时间，非空=已释放) |
| `meeting_booking_audit` | 审计 | `corpId` `bookingId` `seriesId` `action`(create/update/release) `actorUserId` `actorUserName` `detail`(JSON) |

索引照搬 Node 端：`(corpId,enabled,createAt)` on room、`(corpId,type,sort)` on dict、`(corpId,roomId,date)` + `(corpId,hostUserId)` on booking、`(corpId,bookingId,createAt)` + `(corpId,createAt)` on audit。

> `facilities` 存 JSON 字符串（`["电视","白板"]`），与 Node 端一致，出参转成数组。

## 接口清单（17 个）

前缀统一 `/meetingRoom`，网关再映射到前端的 `/meetingApi`。

| 方法 | Node 路径 | Java 路径 | 说明 |
|---|---|---|---|
| GET | `/me` | `/meetingRoom/me` | 返回 `userId/userName/dept/isAdmin` |
| GET | `/health` | `/meetingRoom/health` | 健康检查 |
| GET | `/dicts?type=` | `/meetingRoom/dicts` | 带 `usageCount`（被多少会议室引用） |
| POST | `/dicts` | `/meetingRoom/dicts/create` | |
| PUT | `/dicts/:id` | `/meetingRoom/dicts/update/{id}` | |
| PUT | `/dicts/:id/enabled` | `/meetingRoom/dicts/enabled/{id}` | |
| DELETE | `/dicts/:id` | `/meetingRoom/dicts/delete/{id}` | 被引用时拒绝 |
| GET | `/rooms` | `/meetingRoom/rooms` | 过滤 `keyword/enabled/buildingName/floorName` + 分页 |
| GET | `/rooms/:id` | `/meetingRoom/rooms/get/{id}` | |
| POST | `/rooms` | `/meetingRoom/rooms/create` | |
| PUT | `/rooms/:id` | `/meetingRoom/rooms/update/{id}` | |
| PUT | `/rooms/:id/enabled` | `/meetingRoom/rooms/enabled/{id}` | |
| GET | `/board?date=` | `/meetingRoom/board` | 看板：`{facilityOptions, rooms[]}`，每室带 `busyEvents[]`（含 `mine` 标记） |
| GET | `/bookings/mine` | `/meetingRoom/bookings/mine` | 我的预定，带 `status` |
| GET | `/bookings/admin` | `/meetingRoom/bookings/admin` | 管理员分页，额外回 `hostUserId/hostUserName/hostDept` |
| POST | `/bookings` | `/meetingRoom/bookings/create` | 支持多日 `dates[]` 与 `repeatWeekly` |
| PUT | `/bookings/:id` | `/meetingRoom/bookings/update/{id}` | |
| PUT | `/bookings/:id/release` | `/meetingRoom/bookings/release/{id}` | 软释放，置 `releasedAt` |
| GET | `/bookings/:id/audit` | `/meetingRoom/bookings/audit/{id}` | 本人或管理员可看，否则 `M4003` |

> Node 用 `PUT /资源/:id`，contact 现有域一律 `POST /动作/{id}`（见 `PositionController`）。上表按 contact 惯例改写；**前端要同步改 `web/src/server/module/*.js` 的路径与方法**——这是唯一需要动前端的地方，改的是路径不是逻辑。

## 必须一比一复刻的业务规则

摘自 `server/src/domain/booking.ts`，每条都有对应前端提示，漏一条就有行为差异：

**创建/修改校验（全部返回 `M4000`）**
- 主题 ≤ 50 字；备注 ≤ 100 字
- 日期格式非法 → 「请选择日期」
- 时长不足 30 分钟 → 「剩余空闲不足 30 分钟」
- 超出会议室 `openStart`–`openEnd` → 「不在开放时间内」
- 时段已过（当天当前整格之前）→ 「该时段已过期」
- 超出 `bookAheadDays` → 「超出可提前预定范围」
- 会议室停用 → 「该会议室已停用」
- 同时传 `dates[]` 与 `repeatWeekly` → 「不能同时指定多日与每周重复」
- `repeatWeekly` 但会议室 `allowRecurring=false` → 「该会议室不允许循环预定」
- `dates[]` 去重后 > 5 → 「一次最多预定 5 天」

**冲突与批次**
- 冲突检测只看未释放（`releasedAt IS NULL`）的预定，区间重叠即冲突 → `M4010`「该时段已被占用」
- **整批事务**：多日/循环时逐日校验，任一天冲突则整批回滚，不允许部分成功
- 批次内 >1 条时生成 `seriesId`，单条为 `null`
- `repeatWeekly` 展开规则：从首日起按周递增，直到 `今天 + bookAheadDays` 为止
- 每条预定写一条 `create` 审计，`detail` 里带 `date/start/end/roomId/title/series`

**释放与修改**
- 已结束的预定不能改、不能释放 → `M4000`
- 释放是软删除（置 `releasedAt`），审计 `action=release`；看板与冲突检测都要排除已释放

**看板排序**：楼宇名 → 楼层名 → 会议室名，均按 `zh-CN` 排序（Java 用 `Collator.getInstance(Locale.CHINA)`，别用默认字典序）。

**默认字典**：某企业首次进看板时，若 `meeting_dict` 无该企业数据，初始化「奥城 / 生态城」「电视 / 白板 / 投影」（对应 `ensureDefaultDicts`）。

**管理员判定**：Node 端读环境变量 `MEETING_ADMIN_USER_IDS`（逗号分隔）。Java 侧同样走配置项 `meeting.admin.userIds`，**先不接角色系统**——接角色是二期的事，一期保持行为一致。

## 代码落位

```
src/main/java/com/zgiot/zx/meetingroom/
├── controller/  MeetingRoomController · BookingController · MeetingDictController · BoardController
├── dto/         XxxReqDTO / XxxRspDTO（含 BoardRspDTO 这类聚合结构）
├── entity/      MeetingRoom · MeetingBooking · MeetingDict · MeetingBookingAudit（均 extends BaseEntity）
├── mapper/      四个 Mapper extends BaseMapper<T>，@Repository
├── service/     MeetingRoomService · BookingService · MeetingDictService · BoardService（extends BaseService<T>）
├── enums/       DictTypeEnum · BookingAuditActionEnum · BookingStatusEnum
└── exception/   BookingConflictException · MeetingRoomNotFoundException · BookingExpiredException …
src/main/resources/mapper/meetingroom/*.xml   仅复杂查询（看板聚合、冲突检测、usageCount）
dbscript/2026/V1_0_20260901_meetingroom_DDL.sql
```

参照对象是 `com.zgiot.zx.position`（最小最规整的域），不要参照 `dept`（控制器过重）或 `multiorg.vteam`（`IXxxService`+`impl` 的非主流写法）。

## 分期

1. **建表 + 实体/Mapper + 字典 CRUD**（最简单，先打通链路验证信封与鉴权）
2. **会议室 CRUD + 列表过滤分页**
3. **看板 + 冲突检测 + 预定创建（含多日/循环批次事务）**
4. **修改 / 释放 / 审计 / 管理员列表**
5. **前端切 baseURL 与路径，逐屏联调**；agent 端改调新接口

## 待定（不阻塞开工）

- 网关把 `/meetingApi` 映射到 `zx-contact` 的哪个前缀，要跟运维确认
- `needApproval`（需审批）字段前端已有但 Node 端未实现审批流，Java 侧一期同样只存不用
- 二期再定：agent 是否搬 Java、管理员是否接角色系统、是否拆独立微服务

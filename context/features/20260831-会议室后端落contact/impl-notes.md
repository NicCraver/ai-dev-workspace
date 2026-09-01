# impl-notes：会议室后端落 contact

平台无关的实现与联调笔记。Task 12（前端切 Java）已在本机 meeting web 逐屏验过。

## 错误码不进 ErrCodeBean

会议室只用 `M4000` 校验 / `M4001` 缺企业 / `M4002` 缺用户 / `M4003` 无权限 / `M4004` 不存在 / `M4010` 时段占用，成功 `M0000`。

**不要**登记进 `ContactApplication.initCustomErrCode()` / `ErrCodeBean`。未登记的异常会被反射兜成 `D_F_00x`；登记成 `C_D_001` 会破坏前端提示和 agent 对 `M4010` 的分支。

产出路径：域内 `MeetingExceptionHandler`（`@RestControllerAdvice(basePackages="com.zgiot.zx.meetingroom")`）直接写 `Ret.code/msg`。

## 为什么必须 `@Order(HIGHEST_PRECEDENCE)`

zx-common 的 `GlobalExceptionAdvice` 有 `handleException(Exception)` → `M5002`。Spring 5.0 按 Advice **注册顺序**取第一个能匹配的 handler，域内 advice 若不提权，业务异常会被收成 `M5002`，前端看不到 `M40xx`。

## skipTests 覆盖

父 POM `zx-parent` 焊死 `maven.test.skip=true` 和 surefire `<skipTests>true</skipTests>`。contact `pom.xml` 已改成属性 `${skipTests}`，默认 false，这样 `mvn -o test` 能跑；打包仍用 `mvn -o -DskipTests clean package`。不要改回焊死。

本机若缺 `surefire-junit4:2.17`，从阿里云补进 `~/.m2`（jar + 父 POM `surefire-providers:2.17`），不要改私有依赖版本。

## slotFloor 与 Node nextOpen

`MeetingTimeKit.slotFloor` **向下**取整，与前端 `TL.nextOpen` 一致。Node 服务端同名 `nextOpen` 是向上取整：17:43 时前端可选 17:30，Node 会拒。Java 按「当前半格仍可预约」统一向下。

`isDate` 用 `uuuu-MM-dd` + `ResolverStyle.STRICT`，拒绝 `2026-02-30`（`yyyy` + SMART 会溢出成合法）。

## 身份推导

- **corpId** 只从 `SessionContext.getCurrentAppUser().getCorpId()`（String）取，忽略业务参数里的 corpId。
- **userId** 用 `(accountId, corpId)` 查 `user` 表拿企业内 `user.id`，查不到 `M4002`。`hostUserId` 存这个 `user.id`，不存 `accountId`，否则跨企业「我的预定」串台。
- 本地 `AAuthFilter` 读的是 **query** `zxAccountId` / `zxCorpId` / `zxClientType`。`zxClientType` 必须是 `app` 或 `webapp`，传 `1` 会变成 `M0005`。
- `dept` 先空字符串（没有 DeptUserMapper）。

## 批次事务怎么验回滚

创建预定：多日 / 每周重复在**一个** `@Transactional(rollbackFor = Exception.class)` 里，先逐日 `validateSlot` + `findOverlap`，任一天 `M4010` 则整批不落库。

验收：先订 `2026-09-02 09:00-10:00` 成功；再 `dates=["2026-09-02","2026-09-03"]` 同同时段，应 `M4010`；再查 `2026-09-03` 看板 `busyEvents` 必须为空。

## 创建接口 JSON 自引用

计划写法 `result = items.get(0); result.setItems(items)` 会让第一项指向自己，Jackson 把响应撑到数百 KB 后落到 `M5002`。实现改为另 `toDto` 一份作外壳再挂 `items`。

## 列名与主键

列名驼峰（`corpId`、`startMin`、`createAt`），表名下划线（`meeting_room`）。`map-underscore-to-camel-case=false`。主键不自增，实体继承 `BaseEntity`，插入走 `BaseService.insert`，不要自己 `setId`。审计表走 `EntityKit.preCreateWithOverrideAll`。

## 文案

提示文案逐字照抄 meeting 的 `server/src/domain/*.ts`。空主题无姓名 → 「同事预定的会议」。非本人改/释放 → `M4004`「预定不存在」（不是 `M4003`）。

## Controller 测试

`@WebMvcTest` 会因启动类 `@ComponentScan` / `@EnableFeignClients` 拉全量上下文。改用 `MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new MeetingExceptionHandler()).setMessageConverters(new MappingJackson2HttpMessageConverter()).build()`。

Service Mockito 测 `MeetingDictService.update` 时必须 `SessionContext.setSession`，否则 `EntityKit.preUpdate` NPE；并把 `BaseService.mapper` 指到 mock 的 `MeetingDictMapper`。

## 管理员

只实现 `MeetingAdminChecker` + `ConfigMeetingAdminChecker` 读 `meeting.admin.userIds`（逗号分隔成员 userId）。不要接角色或 `corp_manager`。配置文件只允许追加这一行。

本机联调账号（测试库 `user` 表，`isDel=0`）：

| 字段 | 值 | 说明 |
|---|---|---|
| accountId | `1880150187008081921` | 智信登录账号；**不是** hostUserId |
| corpId | `6` | 写入 query `zxCorpId` |
| user.id | `1880150191235940353` | 企业内用户；`hostUserId` / 管理员白名单用这个 |
| name | 李权泓 | `/me` 的 `userName` |

`meeting.admin.userIds` 必须写 **user.id**。写 accountId 则 `isAdmin=false`，管理端入口不可见。

## 本机代理拆两路

前端 **base 仍是 `/meetingApi`**，浏览器里看到 `/meetingApi/dicts`。开发代理：

- `/meetingApi/agent` → Node（3100），**不改写路径**（助手 suggestions / turn 一期不搬 Java）
- 其余 `/meetingApi` → contact Java（7004），前缀改写成 `/meetingRoom`
- 智信 token 刷新仍走 `/api` → 网关；本机联调尽量别走到

生产网关应对齐同一拆法：`/meetingApi/agent` 留 Node，其余进 `zx-contact` 的 `/meetingRoom`。未配网关不阻塞本机。

写操作 `PUT`/`DELETE` 在前端 module 里已改成 `POST`（`/dicts/create`、`/rooms/get/:id`、`/bookings/release/:id` 等），请求体与响应形状不变。

## 本地 query 鉴权

Java `AAuthFilter` **只读 query**，不读业务 header。每个打 Java 的请求带：

`zxAccountId` + `zxCorpId` + `zxClientType=app`（或 `webapp`）

`zxClientType=1` → `M0005`。业务体里的 corpId / userId **被忽略**。`hostUserId` 由服务端用 `(accountId, corpId)` 查 `user`；查不到 → `M4002`。

URL 引导一次后写入 session（`zxAccountId` / `meetingCorpId`），后续请求自动拼 query。`/me` 成功后再把 session 里的 userId 改成企业内 `user.id`，不要一直用 accountId。

演示门户的 `zx-001` / `demo-admin` **不能打 Java**。入口：

`/meeting/?zxAccountId=1880150187008081921&zxCorpId=6&zxClientType=app`

## 助手仍走 Node，取数可打 Java

`/agent/suggestions`、`/agent/turn` 继续 Node。本机 Node 配了 Java 基址后，看板查询与确认预定转发到 `/meetingRoom/board`、`/meetingRoom/bookings/create`，同样带三 query。验收：助手确认的预定出现在 MySQL `meeting_booking`，**不会**写入 Node SQLite。两套库不是同一份数据，不要用演示种子当验收基准。

一期助手工具只有搜空档；「我今天有哪些会」「取消最近一场」会打到 Node，但模型不能列预定/释放，只能口头回复。释放仍走「我的预定」。

## 联调坑

- Java `/me` 字段是 `isAdmin`，不是演示里的 `admin`。前端读身份时两者都认。
- 冲突码 `M4010`，服务端文案「该时段已被占用」；看板 UI 可能再拼占用者姓名，不要当成契约变了。
- 被设施引用的字典不能删（提示含引用房间数）；非本人改/释放预定 → `M4004`「预定不存在」（不是 `M4003`）。
- 多日预定任一天冲突则整批不落库：冲突日看板 `busyEvents` 必须仍空。

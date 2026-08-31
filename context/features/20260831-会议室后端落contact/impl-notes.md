# impl-notes：会议室后端落 contact

平台无关的实现与联调笔记。前端切 Java 接口（Task 12）尚未做。

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

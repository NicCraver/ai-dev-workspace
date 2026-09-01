# Status：会议室后端落 contact

> 最后更新：2026-09-01（Task 12 已联调；自动化 306 全绿，apps 仍未单独 commit）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

后端功能，矩阵按分期而非按端。`meeting web` 一列指前端需要配合改的部分。

| 阶段 | contact（Java） | meeting web |
|------|-----------------|-------------|
| 计划编制（spec + plan） | ✅ | — |
| 14 个任务实现（55 个单测绿） | ✅ | — |
| 首轮代码审查 | ✅ | — |
| P0 缺陷修复（4 条） | ✅ | — |
| P1 修复（5 条）+ P2 文案对齐 | ✅ | — |
| 错误码与域内异常信封（Task 1） | ✅ | — |
| 建表 + 实体/Mapper + 字典 CRUD | ✅ | — |
| 会议室 CRUD + 列表过滤分页 | ✅ | — |
| 看板 + 冲突检测 + 预定创建（批次事务） | ✅ | — |
| 修改 / 释放 / 审计 / 管理员列表 | ✅ | — |
| 切 baseURL 与路径、逐屏联调 | — | ✅ 本机 `/meeting/`；PC `/meeting/zx/` 未单独点 |

## 待办 / 阻塞

- (contact, 需外部确认) surefire 已圈定 `com/zgiot/zx/meetingroom/**`，但 `pom.xml` 仍解除了父 POM 的 `maven.test.skip`。**上线前问后端同事父 POM 为什么焊死跳过测试**，确认这个改动可接受
- (contact) 唯一没修的一条：`meeting_booking` 没有数据库层唯一约束，防并发靠 `SELECT ... FOR UPDATE` 行锁。多实例部署下有效（同一行锁在 MySQL 上），但 DDL 兜底更稳，视上线节奏再补

- ~~(meeting web) Task 12 未做~~ **本机已做**：module 路径 PUT/DELETE→POST；Vite `/meetingApi/agent`→Node 3100，其余 `/meetingApi` rewrite 成 `/meetingRoom` 打 7004；query 鉴权 `zxAccountId`/`zxCorpId`/`zxClientType=app`。网关映射仍待运维，不阻塞本机
- (meeting) 助手芯片「我今天有哪些会 / 取消最近一场」仍打 Node，但 LLM 只有 `search_availability`，取消会口头拒绝；找空闲确认预定已写入 Java MySQL（`李权泓预定的会议`），SQLite 无对应行
- (meeting) 仓库脏区 77 项与前端重构/位置描述等混在一起，**Task 12 尚未单独 commit**；contact 仅本地追加 `meeting.admin.userIds`，不要提交密码
- (阻塞分期 4) 管理员判定仍待定：目前只读 `meeting.admin.userIds`（`ConfigMeetingAdminChecker`）。2026-09-01 问后端同事，问题清单见 spec「管理员判定」
- (运维) 网关 `/meetingApi` → `zx-contact` 的前缀映射待确认，不阻塞 Java 开发
- (contact) `MeetingUserResolver.dept` 先空字符串（仓库没有 DeptUserMapper）
- (contact) 本地鉴权走 **query** `zxAccountId` / `zxCorpId` / `zxClientType=app`（`AAuthFilter` 不读 header；`zxClientType=1` 会变成 M0005）

## 本回合各端现状（code-status）

本回合推进 Task 12：meeting 切 Java + 浏览器 11 条；contact 仅本地追加管理员白名单。web / android / ios / desktop 脏区与本功能无关。

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| meeting | main | ahead 4 | 脏(77) | **本功能** + 前端重构等混杂 | Task 12：代理/路径/query 鉴权/agent 转调 Java；勿整仓提交 |
| contact | feat/meetingroom | 无 upstream | 脏(1) | **本功能** | 仅 `meeting.admin.userIds=1880150191235940353`，勿提交密码 |
| web | feat/data-scope-storage-group | synced | 脏(12) | 数据范围选择周工作 | 本回合未改本功能 |
| android | master-3.6.23 | synced | 干净 | 其它 | — |
| ios | feat/ios-agent-date-range | synced | 干净 | 其它 | — |
| desktop | master-3.4.27 | synced | 脏(3) 本地调试勿提交 | 其它 | — |

## 验证

```
# 2026-09-01 本机再跑
apps/contact  JAVA_HOME=corretto-1.8  mvn -o test
  Tests run: 66, Failures: 0, Errors: 0, Skipped: 0
  RoomRules 19 + Admin 5 + Dict 2 + BookingController 4 + BookingService 7
  + BookingRules 19 + TimeKit 7 + ExceptionHandler 3
apps/meeting  pnpm test
  server 125 pass / web 115 pass / 0 fail
apps/meeting  pnpm typecheck  （server tsc + web vue-tsc）通过
```

测试库 `192.168.10.31:3306/zx_contact` 已执行 `dbscript/2026/V1_0_20260901_meetingroom_DDL.sql`，四张 `meeting_*` 表存在。curl 已验字典/会议室/看板/预定创建与冲突/批次回滚/我的预定/释放/审计/me/admin。

本机 Task 12 入口（李权泓）：`http://localhost:6273/meeting/?zxAccountId=1880150187008081921&zxCorpId=6&zxClientType=app`。`/me` → `userId=1880150191235940353`（≠ accountId）、`isAdmin=true`。浏览器已点：看板过滤、字典/会议室 CRUD+停用、单条预定、冲突 M4010、多日整批不落库、我的预定释放、非本人 M4004、审计、管理端；助手「找空闲」确认后 MySQL 有「李权泓预定的会议」，Node SQLite 无此行。

## 首轮审查修复（2026-09-01，commit 3043607a6）

审查记录见 `review-01.md`，12 条里修了 11 条：

- 状态枚举 `finished` → `ended`（前端 `mine.js` 的 `MINE_STATUS_LABEL` 只认 4 个值，写错会渲染成 undefined）
- `mustGetOwn` 补 `releasedAt` 校验，已释放的预定不能再改/再释放，一律 M4004（原来能改，且冲突检测查不出来，会留脏记录）
- 会议室分组/位置备注、预定备注加 `@TableField(strategy = FieldStrategy.IGNORED)`，绕开全局 `field-strategy=not_empty` 导致的「清空保存不生效」
- 「我的预定」排序对齐 Node：进行中/待开始升序在前，已结束/已释放倒序在后
- 管理员列表补 `id` 兜底排序（`createAt` 是秒级，同批建的会翻页漏行）
- `Collator` 改 `ThreadLocal`（compare 会写实例游标，static 单例并发会串数据）
- 看板 date 校验与查询统一用 trim 后的值（原来校验 trim、查询用原串，带空白的入参会显示全天空闲）
- 预定创建/修改前 `SELECT ... FOR UPDATE` 锁会议室行，串行化「查冲突 → 落库」
- `ensureDefaults` 改幂等（撞唯一键跳过），本类自调用时 `@Transactional` 本就不生效
- 错误码补 `M4009`，字典删除/类型/会议室重名文案逐字对齐 Node
- surefire 圈定 `com/zgiot/zx/meetingroom/**`：原先解除父 POM 的 `maven.test.skip` 会把 16 个历史测试类（6 个 `@SpringBootTest`，要真库）拖进 `mvn test`，实测 8 个 error

验证：`mvn -o test` → 63 例全绿；`mvn -o -DskipTests package` → BUILD SUCCESS。

## 关键决策记录

- 2026-08-31 表建在同库 `zx_contact`，`meeting_` 前缀，不新开库（新开库要加多数据源，本轮不值当）
- 2026-08-31 agent（`/agent/suggestions`、`/agent/turn`）一期不搬，继续留 Node，改调新的 Java 接口取数
- 2026-08-31 错误码沿用 Node 的 `M4000/M4001/M4002/M4003/M4004/M4010`，**不改成 contact 的 `C_D_001` 风格**——前端提示与 agent 的 `M4010` 分支依赖这些码
- 2026-08-31 时间沿用 `date` + `startMin/endMin` 分钟数模型，不改 datetime（冲突判定与跨端时区会重写）
- 2026-08-31 租户/用户从 contact 的 `SessionContext` 取，替代 Node 的 `zxCorpId/zxUserId` header
- 2026-08-31 管理员判定 ⏸ **待定**，2026-09-01 问后端同事。先抽 `MeetingAdminChecker` 接口 + 配置项临时实现，只影响分期 4
- 2026-08-31 代码参照 `com.zgiot.zx.position` 的分层写法
- 2026-08-31 错误码不进 contact 的 `ErrCodeBean` 体系，改用域内 `@RestControllerAdvice(basePackages="com.zgiot.zx.meetingroom")` 直接产出 M40xx，不污染全局
- 2026-08-31 `MeetingTimeKit.slotFloor` 取**向下**取整，与前端 `TL.nextOpen` 一致；Node 服务端的 `nextOpen` 是向上取整，两边本来就不一致（17:43 时前端可选 17:30、Node 会拒），Java 侧按「当前半格可预约」统一
- 2026-08-31 业务规则抽成不依赖 Spring/DB 的纯函数（时间 / 预定校验 / 会议室校验），用 JUnit 4 做 TDD；Service 层用 Mockito mock Mapper、Controller 层用 `@WebMvcTest`，都不连库；只有端到端用 curl。不用 `@SpringBootTest` 当主力（要连 MySQL/Redis/Eureka，冷启动 66 秒）
- 2026-08-31 对照 Node 测试发现并修正 5 处计划错误：默认主题无姓名时是「同事」不是「我」、非本人操作回 M4004 不是 M4003、会议室校验实为 11 条、字典改名要级联重写会议室、会议室默认值是 07:00/23:00/90/循环 false
- 2026-08-31 **全企业开放，不设白名单**（先前定的 `meeting.corp.whitelist=6` 已撤销）；试点范围由运营控制微应用入口可见性，后端不限制
- 2026-08-31 PC 切企业会清空已打开的微应用（`open-panel.vue:139`），会议室被关闭、重开时拿到新 corpId，**不存在 stale corpId**（早前判断有误已更正）
- 2026-08-31 多企业：可见/可预定范围**仅本企业**，不做集团子树、不做关联企业；外协不特判
- 2026-08-31 corpId **只认 `SessionContext`**（网关经 `zxCorpId` header 注入），忽略前端业务参数里的 corpId
- 2026-08-31 `hostUserId` 存企业内 `user.id`（用 `(accountId, corpId)` 查得），**不存 accountId**，否则跨企业「我的预定」串台；查不到 user 直接拒（`M4002`），顺带堵伪造 corpId
- 2026-08-31 Task 1 实测：`zx-parent` 焊死 `maven.test.skip` + surefire `skipTests`，contact `pom.xml` 改成属性后 `mvn -o test` 才能跑；`GlobalExceptionAdvice.handleException(Exception)` 按 Advice 注册顺序会先于域内 handler 把异常收成 `M5002`，所以 `MeetingExceptionHandler` 加了 `@Order(HIGHEST_PRECEDENCE)`
- 2026-09-01 Task 14 实测：`@WebMvcTest` 会因 `@ComponentScan`/`@EnableFeignClients` 拉全量上下文，Controller 测试改 `MockMvcBuilders.standaloneSetup` + `setControllerAdvice(MeetingExceptionHandler)`
- 2026-09-01 Task 12：前端 base 仍 `/meetingApi`；本机把 `/meetingApi/agent` 留给 Node，其余改写成 `/meetingRoom` 打 7004。鉴权用 query 三参数，不用 Node 的 `zxUserId` header

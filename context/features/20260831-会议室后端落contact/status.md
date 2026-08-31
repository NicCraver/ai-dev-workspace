# Status：会议室后端落 contact

> 最后更新：2026-08-31（Task 1 错误码与信封已合入 contact `feat/meetingroom`）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

后端功能，矩阵按分期而非按端。`meeting web` 一列指前端需要配合改的部分。

| 阶段 | contact（Java） | meeting web |
|------|-----------------|-------------|
| 计划编制（spec + plan） | ✅ | — |
| 错误码与域内异常信封（Task 1） | ✅ | — |
| 建表 + 实体/Mapper + 字典 CRUD | ⬜ | — |
| 会议室 CRUD + 列表过滤分页 | ⬜ | — |
| 看板 + 冲突检测 + 预定创建（批次事务） | ⬜ | — |
| 修改 / 释放 / 审计 / 管理员列表 | ⬜ | — |
| 切 baseURL 与路径、逐屏联调 | ⬜ | ⬜ |

## 待办 / 阻塞

- (contact) Task 1 完成：`MeetingCode` / `MeetingBizException` / `MeetingExceptionHandler`，3 例 JUnit 通过；下一步 **Task 2 MeetingTimeKit**
- (contact) 测试分五层：纯函数 JUnit（50 例）+ Service Mockito（不连库）+ Controller `@WebMvcTest`（不连库）+ curl 端到端；验收基准是 Node 端已有的 77 个测试用例
- (contact) 前 4 个任务是纯函数 TDD，Task 4 起需连测试库 192.168.10.31 并手动执行建表脚本
- (contact) 本机跑测试须覆盖父 POM 的 `skipTests`（已写进 contact `pom.xml`）；本地 m2 缺 `surefire-junit4:2.17` 时需从阿里云补进仓库，否则 `mvn -o test` 编过了跑不起来
- (阻塞分期 4) 管理员怎么判待定：2026-09-01 问后端同事，问题清单见 spec「管理员判定」小节
- (运维) 网关 `/meetingApi` → `zx-contact` 的前缀映射待确认，不阻塞开发
- (meeting web) 联调阶段要改 `web/src/server/module/*.js` 的路径与方法（Node 的 `PUT /资源/:id` → contact 惯例的 `POST /动作/{id}`），只改路径不改逻辑

## 本回合各端现状（code-status）

本回合只改 `apps/contact`（分支 `feat/meetingroom`，无远端，HEAD `feat(meetingroom): 会议室错误码与域内异常信封`）。其余脏区与本功能无关，不改对应 status：

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| contact | feat/meetingroom | 无 upstream | 干净 | **本功能** | Task 1 已 commit |
| web | dev-date-range | ahead 5 | DataScopeBar.vue | 数据范围 / aichat 时间 | 非本回合 |
| android | master-3.6.23 | synced | 会话页 / 筛选条 3 文件 | 安卓 NPE / 数据范围 | 非本回合 |
| ios | feat/ios-agent-date-range | ahead 2 | Agent/个人 AI 筛选 6 文件 | 数据范围 / aichat 时间 | 非本回合 |
| desktop | master-3.4.27 | behind 1 | .env.test 等本地文件 | — | 勿提交 |
| meeting | main | ahead 4 | 约 50 文件 | 会议室前端重构等 | 只读参考源，本回合未改 |

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

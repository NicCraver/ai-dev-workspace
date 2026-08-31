# 代码审查 01：会议室后端首轮实现

> 2026-09-01。范围：`apps/contact` 的 `release..HEAD` 共 14 个提交，3464 行新增，工作区干净。
> 基准：`spec.md` / `plan.md` + Node 端 `apps/meeting/server/src/domain/*.ts` 与 `tests/`。
> 结论：**主体骨架与分层是对的，55 个新增单测全绿，但有 4 个必须改的缺陷会直接导致线上功能错。**

## 已核实通过的部分

- 分层与包结构照 `position` 域落地，无散落文件。
- 55 个新增单测全绿（`RoomRulesTest` 16 / `BookingRulesTest` 19 / `MeetingTimeKitTest` 7 / `BookingControllerTest` 4 / `BookingServiceTest` 4 / `MeetingDictServiceTest` 2 / `MeetingExceptionHandlerTest` 3）。
- `application.properties` 只多了 `meeting.admin.userIds=` 一行，没有夹带凭据或本地连接串。
- corpId 只取自 `SessionContext`，`(accountId, corpId)` 推导 userId，查不到回 `M4002` —— 越权防线按 spec 落实。
- `Ret.ok()` 的 code 是 `M0000`，信封与前端 `http.js` 的判定一致。
- `slotFloor` 向下取整、dept 暂空、管理员走配置项 —— 都是 spec 里的有意决策，不算缺陷。

---

## P0 必须改（4 条）

### 1. 状态枚举写错，前端标签会渲染成 undefined

`service/BookingService.java:362` `resolveStatus` 返回 `"finished"`，Node `mineStatus`（`booking.ts:182`）返回的是 **`"ended"`**。

前端 `web/src/features/booking/mine.js:1-6` 的 `MINE_STATUS_LABEL` 只认 `ongoing / upcoming / ended / released`，没有 `finished`。切到 Java 接口后「我的预定」和管理员历史里所有已结束记录的状态标签变成 `undefined`，tag 样式也落到默认色。

改：`"finished"` → `"ended"`（两处，362 和 368 行），并改 `BookingMineDTO` 上那行注释。

### 2. 已释放的预定还能被修改

`service/BookingService.java:195` 的 `mustGetOwn` 只校验 corpId + hostUserId。Node 是 `if (!row || row.host_user_id !== user.userId || row.released_at) return M4004`（`booking.ts:544`、`booking.ts:614` 两处都有 `released_at` 判断）。

后果：用户释放预定后（时段已经放出去、可能已被别人订走），再调 `/bookings/update/{id}` 会成功——改写 date/startMin/endMin、写一条 `update` 审计。而 `findOverlap` 又跳过已释放行，冲突检测发现不了。库里留下一条「已释放但时间被改过」的记录，看板不显示，审计却说它被移动了。

改：`mustGetOwn` 加 `|| booking.getReleasedAt() != null` 一起回 `M4004`。顺带 `release()` 里对已释放的记录也要回 `M4004`（现在是 `return toDto(booking)` 当幂等成功，前端会弹两次「释放成功」）。

### 3. 清空「分组」「位置备注」「备注」保存不生效

`application.properties:27` 全局配了 `mybatis-plus.global-config.db-config.field-strategy=not_empty`，`BaseService.updateById` 会**跳过 null 与空串字段**。

而 `RoomRules.normalize` 用 `trimToNull` 把分组、位置备注变成 null（`MeetingRoomService.java:86` 落库），预定的 remark 同理（`BookingService.java:221`）。用户把这几项清空后保存 → UPDATE 语句里根本不带这些列 → 旧值保留 → 重新打开又显示旧值。Node 那边 UPDATE 是显式写 NULL 的。

改：这几个可空字段改用 `UpdateWrapper.set("groupName", value)` 显式赋值，或给字段单独标 `@TableField(updateStrategy = FieldStrategy.IGNORED)`。

### 4. `pom.xml` 翻转了全仓库的测试开关，会让 CI 挂掉

`pom.xml:26` 加了 `maven.test.skip=false` + `skipTests=false` + surefire 配置。父 POM 原本焊死跳过测试**很可能是公司有意为之**——`src/test/java` 下 16 个历史测试类里有 6 个 `@SpringBootTest`，要真实 MySQL/Redis/Eureka。

实测（本机）：
```
mvn -o test              → Tests run: 25, Failures: 0, Errors: 8   BUILD FAILURE
mvn -o -DskipTests package → BUILD SUCCESS
```
打包流水线若带 `-DskipTests` 不受影响，但任何跑 `mvn test` 的环节从这个提交起会失败。

改：不要动项目级属性。改成只圈自己的包：
```xml
<configuration>
  <skipTests>false</skipTests>
  <includes><include>com/zgiot/zx/meetingroom/**/*Test.java</include></includes>
</configuration>
```
或整体挪进一个非默认激活的 profile。**这条要跟后端同事确认**父 POM 为什么跳过测试，别自作主张。

---

## P1 建议改（5 条）

5. **`BoardService.java:32` 的 `static final Collator` 非线程安全。** `RuleBasedCollator.compare` 复用实例字段，JDK 文档要求多线程前 `clone()`。两个企业并发请求看板时排序可能错乱，最坏在 `CollationElementIterator` 里抛异常。改成方法内 `Collator.getInstance(Locale.CHINA)` 或 `ThreadLocal`。

6. **同一时段并发预定会双写。** `BookingService.java:80` 先 `findOverlap` 再 `insert`，中间无行锁、无 `SELECT ... FOR UPDATE`，DDL 也没有 `(corpId,roomId,date,startMin)` 唯一约束。Node 靠 SQLite 单写锁天然规避，MySQL + 多实例不成立。最小代价是加一条唯一索引兜底（要考虑已释放行，可用 `releasedAt` 参与或改成应用层悲观锁）。

7. **`MeetingDictService.ensureDefaults` 竞态 + 事务失效。** check-then-insert 无锁，企业首次打开时前端并发打 `/dicts` 与 `/board`，两个请求都读到 count=0 各插 5 条，撞唯一键抛 `DuplicateKeyException`——而 `MeetingExceptionHandler` 只接 `MeetingBizException`，用户看到 M5002 而不是看板。另外 `list()` 是**本类自调用** `ensureDefaults`，Spring 代理被绕过，`@Transactional` 不生效。

8. **「我的预定」排序与 Node 不一致。** Node `listMine`（`booking.ts:525-529`）先按 date 升序输出 ongoing/upcoming，再把 ended/released 倒序接在后面；Java 统一 `date DESC`，导致最近的待开始会议被历史记录压到最底下，弹窗第一屏全是过期记录。

9. **`BoardService.java:70` 校验用 trim 后的值、查询用原值。** `?date=%202026-09-01` 这类带空白的入参能通过 `isDate` 校验但匹配不到任何预定，看板显示全天空闲，用户照此下单再被 M4010 拒。

---

## P2 可以后补（3 条）

10. **多处提示文案与 Node 不一致**（spec 要求逐字照抄，前端直接展示 `msg`）：
    - 字典删除：`已被 N 个会议室使用，不能删除` vs Node `有 N 间会议室正在使用「X」，无法删除`
    - `类型无效` vs Node `type 无效`
    - 会议室重名：`已有同名的启用会议室` vs Node create/update 的 `该名称已被使用`、setEnabled 的 `已有同名启用中的会议室，请修改名称`（Node 这里用的还是 `M4009` 不是 `M4000`）
11. **重复释放返回成功**（见 P0-2，一起改）。
12. **`MeetingRoomService.java:58` 分页排序不稳定。** 只按秒级的 `createAt` 倒序，Node 是 `created_at DESC, id DESC`。批量建的会议室 createAt 相同，翻页可能重复或漏行。补 `.orderByDesc("id")`。

---

## 处理建议

P0 四条改完再联调，其中第 4 条（pom）先跟后端同事确认父 POM 的意图。P1 里第 6 条（并发双写）建议同期做掉，上线后再补代价高。

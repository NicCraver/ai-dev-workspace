# 会议室后端落 contact 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/meeting/server`（Hono + SQLite）的 17 个会议室接口一比一搬到 `apps/contact`（Spring Boot 微服务），前端只改路径不改逻辑。

**Architecture:** 新增独立域 `com.zgiot.zx.meetingroom`，分层照 `com.zgiot.zx.position`（controller / dto / entity / mapper / service / exception）。业务规则（时间换算、11 条校验、区间重叠）抽成**不依赖 Spring 与数据库的纯函数类**，用 JUnit 4 做 TDD；CRUD 与聚合查询靠 MyBatis-Plus，用 curl 验收。错误码不进 contact 的 `ErrCodeBean` 体系，改用域内 `@RestControllerAdvice` 直接产出 `M40xx` 信封。

**Tech Stack:** Java 8 · Spring Boot 2.0.4 · MyBatis-Plus 3.x · MySQL 5.7 · JUnit 4.12 · Lombok · Swagger2

## Global Constraints

- **JDK 必须是 8**：`export JAVA_HOME=/Users/nic/Library/Java/JavaVirtualMachines/corretto-1.8.0_392/Contents/Home`。`/usr/libexec/java_home -v 1.8` 返回的是没有 javac 的 JRE。
- **Maven 一律加 `-o` 离线**：不加会逐个依赖去问公司 Nexus，慢到不可用。
- **信封**：成功 `Ret.ok().setData(x)`（code 恒为 `M0000`）。失败码只用这 6 个：`M4000` 校验 / `M4001` 缺企业 / `M4002` 缺用户 / `M4003` 无权限 / `M4004` 不存在 / `M4010` 时段被占用。**不要新增码、不要改成 contact 的 `C_D_001` 风格**——前端提示与 agent 的 `M4010` 分支依赖它们。
- **列名驼峰、表名下划线**：`map-underscore-to-camel-case=false`，列名直接写 `corpId` / `startMin` / `createAt`。
- **主键**：`id-type=input`。实体继承 `BaseEntity`，插入走 `BaseService.insert(entity)`——它内部调 `EntityKit.preCreateWithOverrideAll`，自动填 `IdWorker` 雪花 id + `creator`/`createAt`/`updator`/`updateAt`（creator 取自 `SessionContext` 的 accountId）。**不要自己 setId**。
- **表列类型照 `position` 表**：`id` / `corpId` / `creator` / `updator` 均 `bigint(20) unsigned`，`createAt` / `updateAt` 为 `timestamp DEFAULT CURRENT_TIMESTAMP`。
- **时间模型**：`date` 存 `char(10)` 的 `YYYY-MM-DD`，`startMin` / `endMin` 存当天零点起的分钟数 `smallint`。响应同时回 `start` / `end` 的 `HH:mm`。
- **时区**：一律 `Asia/Shanghai`。
- **corpId 只从 `SessionContext.getCurrentAppUser().getCorpId()` 取**，忽略前端传的任何 corpId 参数。
- **所有提示文案与默认值逐字照抄 Node 源码**，不要自己润色。前端按 `msg` 直接展示，`server/tests/*.test.ts` 里的断言就是验收标准。
- **注释写中文。**
- **提交只碰 `apps/contact`**，不要顺手改 `apps/meeting`。

## 文件结构

```
src/main/java/com/zgiot/zx/meetingroom/
├── common/
│   ├── MeetingCode.java              6 个错误码常量
│   ├── MeetingBizException.java      业务异常（带 code）
│   ├── MeetingExceptionHandler.java  域内 @RestControllerAdvice → Ret 信封
│   ├── MeetingTimeKit.java           纯函数：时间换算 / 日期 / 每周展开
│   ├── MeetingUserResolver.java      从 session 推导 corpId + 企业内 userId
│   ├── MeetingAdminChecker.java      管理员判定接口（实现待定，先配置项）
│   └── ConfigMeetingAdminChecker.java
├── rule/
│   ├── RoomSnapshot.java             校验用的会议室值对象（不碰 DB）
│   ├── SlotDraft.java                校验通过后的时段
│   └── BookingRules.java             纯函数：11 条校验 + 区间重叠
├── entity/     MeetingRoom · MeetingBooking · MeetingDict · MeetingBookingAudit
├── mapper/     四个 Mapper（+ resources/mapper/meetingroom/*.xml 放聚合查询）
├── service/    MeetingDictService · MeetingRoomService · BoardService · BookingService
├── dto/        请求/响应 DTO
└── controller/ MeetingDictController · MeetingRoomController · BoardController · BookingController · MeetingMeController

src/test/java/com/zgiot/zx/meetingroom/
├── MeetingTimeKitTest.java
├── BookingRulesTest.java
└── MeetingExceptionHandlerTest.java

dbscript/2026/V1_0_20260901_meetingroom_DDL.sql
```

## 测试策略与覆盖矩阵

`apps/meeting` 的 Node 端已有 **77 个非 agent 测试用例**（`server/tests/`），它们就是这次移植的行为契约。Java 侧按下表逐层补齐，**不要只测纯函数**。

| 层 | 手段 | 依赖 | 对应 Node 测试 | 用例数 |
|---|---|---|---|---|
| 纯函数（时间） | JUnit 4 | 无 | `time.test.ts` 8 例 | 12 |
| 纯函数（预定规则） | JUnit 4 | 无 | `booking.test.ts` 中的校验类 | 22 |
| 纯函数（会议室规则） | JUnit 4 | 无 | `room.test.ts` 6 例 | 16 |
| Service（冲突/批次/级联/状态） | JUnit 4 + Mockito（`spring-boot-starter-test` 自带） | mock Mapper，不连库 | `booking.test.ts` / `dict.test.ts` 行为类 | 24 |
| Controller（路由/信封/参数） | `@WebMvcTest` + `@MockBean` | 只加载 MVC，不连库/Redis/Eureka | `routes.test.ts` 16 例 + `httpApi.test.ts` 10 例 | 20 |
| 端到端 | curl 脚本 | 连测试库 | 手工 | 12 条 |

> **为什么不用 `@SpringBootTest` 做主力**：contact 启动要连 MySQL + Redis + Eureka + MQ，冷启动 66 秒，做不了快速反馈。`@WebMvcTest` 只加载 Web 层、Service 全部 `@MockBean`，秒级完成，足以覆盖路由与信封。真连库的验证放 curl。

**必须覆盖的行为清单**（逐条来自 Node 测试名，移植时打勾）：

预定：
- [ ] 11:00-13:00 与既有 10:00-12:00 重叠 → `M4010`
- [ ] 12:00-13:00 与既有 11:00-12:00 首尾相接 → 成功（半开区间）
- [ ] 当天早于当前半格 → 「该时段已过期」
- [ ] 08:00-09:00 超出开放 09:00-18:00 → 「不在开放时间内」
- [ ] 超过 今天+bookAheadDays → 「超出可提前预定范围」
- [ ] 停用会议室不可预定
- [ ] **非预定人不能释放**；本人释放后看板不再显示该占用
- [ ] 15 分钟时长被拒
- [ ] 日历上不存在的日期（如 2026-02-30）→ `M4000`
- [ ] 空主题 + 有姓名 → 「张三预定的会议」
- [ ] **空主题 + 无姓名 → 「同事预定的会议」**
- [ ] 主题超 50 字被拒
- [ ] 已释放的时段可被重新预定
- [ ] 已结束的预定不能释放
- [ ] 开放时间不在整半点时，未对齐的开始时间被拒；09:30 可以
- [ ] **看板不泄漏其它企业的预定**；facilities 是脏数据时不崩
- [ ] 本人可改主题与时段，重叠检测排除自身
- [ ] 已结束的预定不能改；改动写审计
- [ ] 每周循环在可提前范围内展开，**任一天冲突整批回滚**
- [ ] `dates` 多日在一个事务内落库
- [ ] `dates` 与 `repeatWeekly` 不能同时传
- [ ] 会议室不允许循环时拒绝 `repeatWeekly`
- [ ] 「我的」保留已释放与已结束历史；管理员看全部；**陌生人读审计被拒**

会议室：
- [ ] 启用状态下重名被拒
- [ ] 停用之后可以重名
- [ ] 把重名的那个改回启用时给出冲突提示
- [ ] 空名称 → `M4000`
- [ ] `openStart == openEnd` 被拒
- [ ] **新建时楼宇不在启用字典里 → 被拒**

字典：
- [ ] 首次访问初始化默认楼宇与设施
- [ ] 同类型重名被拒
- [ ] 被会议室引用的楼宇不可删
- [ ] **楼宇改名级联重写所有会议室的 buildingName；设施改名重写 rooms.facilities**

---

---

### Task 1: 错误码与信封基础

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/common/MeetingCode.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/common/MeetingBizException.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/common/MeetingExceptionHandler.java`
- Test: `src/test/java/com/zgiot/zx/meetingroom/MeetingExceptionHandlerTest.java`

**Interfaces:**
- Consumes: 无
- Produces: `MeetingCode.BAD_REQUEST/NO_CORP/NO_USER/NO_PERMISSION/NOT_FOUND/CONFLICT`（均为 `String`）；`MeetingBizException.badRequest(String msg)` / `noUser(String)` / `noPermission(String)` / `notFound(String)` / `conflict(String)` 五个静态工厂，均返回 `MeetingBizException`，其 `getCode()` / `getMessage()` 返回码与文案；`MeetingExceptionHandler#handleBiz(MeetingBizException)` 返回 `Ret<Object>`。

- [ ] **Step 1: 写失败的测试**

`src/test/java/com/zgiot/zx/meetingroom/MeetingExceptionHandlerTest.java`：

```java
package com.zgiot.zx.meetingroom;

import com.zgiot.zx.common.dto.Ret;
import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingCode;
import com.zgiot.zx.meetingroom.common.MeetingExceptionHandler;
import org.junit.Assert;
import org.junit.Test;

public class MeetingExceptionHandlerTest {

    private final MeetingExceptionHandler handler = new MeetingExceptionHandler();

    @Test
    public void 冲突异常应转成M4010信封() {
        Ret<Object> ret = handler.handleBiz(MeetingBizException.conflict("该时段已被占用"));
        Assert.assertEquals(MeetingCode.CONFLICT, ret.getCode());
        Assert.assertEquals("该时段已被占用", ret.getMsg());
        Assert.assertNull(ret.getData());
    }

    @Test
    public void 校验异常应转成M4000信封() {
        Ret<Object> ret = handler.handleBiz(MeetingBizException.badRequest("主题不超过 50 个字"));
        Assert.assertEquals("M4000", ret.getCode());
        Assert.assertEquals("主题不超过 50 个字", ret.getMsg());
    }

    @Test
    public void 不存在异常应转成M4004信封() {
        Ret<Object> ret = handler.handleBiz(MeetingBizException.notFound("会议室不存在"));
        Assert.assertEquals("M4004", ret.getCode());
    }
}
```

- [ ] **Step 2: 跑测试确认失败**

```bash
export JAVA_HOME=/Users/nic/Library/Java/JavaVirtualMachines/corretto-1.8.0_392/Contents/Home
mvn -o test -Dtest=MeetingExceptionHandlerTest
```
预期：编译失败，`程序包 com.zgiot.zx.meetingroom.common 不存在`。

- [ ] **Step 3: 写实现**

`MeetingCode.java`：

```java
package com.zgiot.zx.meetingroom.common;

/**
 * 会议室业务码。与 apps/meeting 的 Node 服务保持一比一，
 * 前端只判 M0000，其余码直接弹 msg；agent 端对 M4010 有专门分支。
 * 不要新增码，也不要改成 contact 的 C_D_001 风格。
 */
public final class MeetingCode {

    /** 成功 */
    public static final String OK = "M0000";
    /** 参数或业务校验不通过 */
    public static final String BAD_REQUEST = "M4000";
    /** 缺企业信息 */
    public static final String NO_CORP = "M4001";
    /** 缺用户信息 */
    public static final String NO_USER = "M4002";
    /** 无管理权限 */
    public static final String NO_PERMISSION = "M4003";
    /** 资源不存在 */
    public static final String NOT_FOUND = "M4004";
    /** 时段已被占用 */
    public static final String CONFLICT = "M4010";

    private MeetingCode() {
    }
}
```

`MeetingBizException.java`：

```java
package com.zgiot.zx.meetingroom.common;

import lombok.Getter;

/**
 * 会议室域内业务异常。不接 contact 的 ErrCodeBean 体系，
 * 由 MeetingExceptionHandler 直接转成 M40xx 信封。
 */
@Getter
public class MeetingBizException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String code;

    public MeetingBizException(String code, String msg) {
        super(msg);
        this.code = code;
    }

    public static MeetingBizException badRequest(String msg) {
        return new MeetingBizException(MeetingCode.BAD_REQUEST, msg);
    }

    public static MeetingBizException noCorp(String msg) {
        return new MeetingBizException(MeetingCode.NO_CORP, msg);
    }

    public static MeetingBizException noUser(String msg) {
        return new MeetingBizException(MeetingCode.NO_USER, msg);
    }

    public static MeetingBizException noPermission(String msg) {
        return new MeetingBizException(MeetingCode.NO_PERMISSION, msg);
    }

    public static MeetingBizException notFound(String msg) {
        return new MeetingBizException(MeetingCode.NOT_FOUND, msg);
    }

    public static MeetingBizException conflict(String msg) {
        return new MeetingBizException(MeetingCode.CONFLICT, msg);
    }
}
```

`MeetingExceptionHandler.java`：

```java
package com.zgiot.zx.meetingroom.common;

import com.zgiot.zx.common.dto.Ret;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 只作用于会议室域，避免影响 contact 其它域的全局异常处理。
 */
@Slf4j
@RestControllerAdvice(basePackages = "com.zgiot.zx.meetingroom")
public class MeetingExceptionHandler {

    @ExceptionHandler(MeetingBizException.class)
    public Ret<Object> handleBiz(MeetingBizException ex) {
        log.warn("会议室业务异常 code={} msg={}", ex.getCode(), ex.getMessage());
        Ret<Object> ret = new Ret<>();
        ret.setCode(ex.getCode());
        ret.setMsg(ex.getMessage());
        ret.setData(null);
        return ret;
    }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
mvn -o test -Dtest=MeetingExceptionHandlerTest
```
预期：`Tests run: 3, Failures: 0, Errors: 0`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom/common src/test/java/com/zgiot/zx/meetingroom
git commit -m "feat(meetingroom): 会议室错误码与域内异常信封"
```

---

### Task 2: 时间工具 MeetingTimeKit

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/common/MeetingTimeKit.java`
- Test: `src/test/java/com/zgiot/zx/meetingroom/MeetingTimeKitTest.java`

**Interfaces:**
- Consumes: 无
- Produces: `MeetingTimeKit` 全部静态方法——`Integer parseHm(String hhmm)`（非法返回 null，`"24:00"` 返回 1440）、`String fromMinutes(int min)`、`boolean isDate(String date)`、`String today()`、`int nowMinute()`、`String addDays(String date, int days)`、`List<String> weeklyDatesUntil(String start, String lastInclusive)`、`int slotFloor(int nowMin)`。

> ⚠️ `slotFloor` 对应 Node 的 `nextOpen`，但**语义故意改成向下取整**：Node 服务端是 `Math.ceil`，而前端 `web/src/features/booking/time.js:282` 是 `Math.floor`，两边现在对不上（17:43 时前端允许选 17:30，Node 会拒「该时段已过期」）。按已定决策「当日当前半格含已开始未结束可预约」，Java 侧取 floor。

- [ ] **Step 1: 写失败的测试**

```java
package com.zgiot.zx.meetingroom;

import com.zgiot.zx.meetingroom.common.MeetingTimeKit;
import org.junit.Assert;
import org.junit.Test;

import java.util.Arrays;
import java.util.List;

public class MeetingTimeKitTest {

    @Test
    public void 解析时刻() {
        Assert.assertEquals(Integer.valueOf(0), MeetingTimeKit.parseHm("00:00"));
        Assert.assertEquals(Integer.valueOf(1050), MeetingTimeKit.parseHm("17:30"));
        Assert.assertEquals(Integer.valueOf(1440), MeetingTimeKit.parseHm("24:00"));
        Assert.assertNull(MeetingTimeKit.parseHm("24:01"));
        Assert.assertNull(MeetingTimeKit.parseHm("7:30"));
        Assert.assertNull(MeetingTimeKit.parseHm(""));
        Assert.assertNull(MeetingTimeKit.parseHm(null));
    }

    @Test
    public void 分钟转时刻() {
        Assert.assertEquals("00:00", MeetingTimeKit.fromMinutes(0));
        Assert.assertEquals("09:05", MeetingTimeKit.fromMinutes(545));
        Assert.assertEquals("24:00", MeetingTimeKit.fromMinutes(1440));
    }

    @Test
    public void 日期校验要认闰年与月份天数() {
        Assert.assertTrue(MeetingTimeKit.isDate("2026-08-31"));
        Assert.assertTrue(MeetingTimeKit.isDate("2024-02-29"));
        Assert.assertFalse(MeetingTimeKit.isDate("2026-02-30"));
        Assert.assertFalse(MeetingTimeKit.isDate("2026-13-01"));
        Assert.assertFalse(MeetingTimeKit.isDate("20260831"));
        Assert.assertFalse(MeetingTimeKit.isDate(null));
    }

    @Test
    public void 加天数要跨月跨年() {
        Assert.assertEquals("2026-09-01", MeetingTimeKit.addDays("2026-08-31", 1));
        Assert.assertEquals("2027-01-01", MeetingTimeKit.addDays("2026-12-31", 1));
        Assert.assertEquals("2026-08-30", MeetingTimeKit.addDays("2026-08-31", -1));
    }

    @Test
    public void 每周展开含首尾() {
        List<String> dates = MeetingTimeKit.weeklyDatesUntil("2026-08-31", "2026-09-21");
        Assert.assertEquals(Arrays.asList("2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"), dates);
    }

    @Test
    public void 每周展开在起点晚于终点时为空() {
        Assert.assertTrue(MeetingTimeKit.weeklyDatesUntil("2026-09-30", "2026-09-01").isEmpty());
    }

    @Test
    public void 当前半格向下取整() {
        Assert.assertEquals(1050, MeetingTimeKit.slotFloor(1063)); // 17:43 → 17:30
        Assert.assertEquals(1050, MeetingTimeKit.slotFloor(1050)); // 17:30 → 17:30
        Assert.assertEquals(0, MeetingTimeKit.slotFloor(-5));
        Assert.assertEquals(1440, MeetingTimeKit.slotFloor(1500));
    }
}
```

- [ ] **Step 2: 跑测试确认失败**

```bash
mvn -o test -Dtest=MeetingTimeKitTest
```
预期：编译失败，`找不到符号: 类 MeetingTimeKit`。

- [ ] **Step 3: 写实现**

```java
package com.zgiot.zx.meetingroom.common;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 会议室时间工具。全部静态纯函数，不依赖 Spring，便于单测。
 * 与 apps/meeting/server/src/domain/time.ts 对齐，唯一有意差异见 slotFloor。
 */
public final class MeetingTimeKit {

    /** 会议室时区固定东八区 */
    public static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    /** 时段最小粒度：30 分钟 */
    public static final int SLOT_MIN = 30;
    /** 一天的分钟数 */
    public static final int DAY_MIN = 1440;

    private static final Pattern HM = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final Pattern DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private MeetingTimeKit() {
    }

    /** "HH:mm" → 分钟数；非法返回 null；"24:00" 特判为 1440 */
    public static Integer parseHm(String hhmm) {
        if (hhmm == null) {
            return null;
        }
        String value = hhmm.trim();
        if ("24:00".equals(value)) {
            return DAY_MIN;
        }
        if (!HM.matcher(value).matches()) {
            return null;
        }
        int hour = Integer.parseInt(value.substring(0, 2));
        int minute = Integer.parseInt(value.substring(3, 5));
        return hour * 60 + minute;
    }

    /** 分钟数 → "HH:mm"；1440 回 "24:00" */
    public static String fromMinutes(int min) {
        if (min == DAY_MIN) {
            return "24:00";
        }
        return String.format("%02d:%02d", min / 60, min % 60);
    }

    /** 是否合法的 yyyy-MM-dd（认闰年与每月天数） */
    public static boolean isDate(String date) {
        if (date == null || !DATE.matcher(date).matches()) {
            return false;
        }
        try {
            LocalDate.parse(date, DATE_FMT);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** 东八区今天 */
    public static String today() {
        return LocalDate.now(ZONE).format(DATE_FMT);
    }

    /** 东八区当前时刻的分钟数 */
    public static int nowMinute() {
        LocalDateTime now = LocalDateTime.now(ZONE);
        return now.getHour() * 60 + now.getMinute();
    }

    /** 日期加减天数，跨月跨年由 LocalDate 保证 */
    public static String addDays(String date, int days) {
        return LocalDate.parse(date, DATE_FMT).plusDays(days).format(DATE_FMT);
    }

    /** 从 start 起每 7 天一条，含首尾，直到不超过 lastInclusive */
    public static List<String> weeklyDatesUntil(String start, String lastInclusive) {
        if (!isDate(start) || !isDate(lastInclusive) || start.compareTo(lastInclusive) > 0) {
            return Collections.emptyList();
        }
        List<String> dates = new ArrayList<>();
        String cursor = start;
        while (cursor.compareTo(lastInclusive) <= 0) {
            dates.add(cursor);
            cursor = addDays(cursor, 7);
        }
        return dates;
    }

    /**
     * 当前所在半格的起点（向下取整）。
     * 注意：Node 服务端同名函数 nextOpen 是向上取整，与前端 TL.nextOpen 的向下取整对不上，
     * 这里按「当日当前半格含已开始未结束仍可预约」的决策统一取向下。
     */
    public static int slotFloor(int nowMin) {
        int snapped = Math.floorDiv(nowMin, SLOT_MIN) * SLOT_MIN;
        return Math.max(0, Math.min(DAY_MIN, snapped));
    }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
mvn -o test -Dtest=MeetingTimeKitTest
```
预期：`Tests run: 7, Failures: 0, Errors: 0`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom/common/MeetingTimeKit.java src/test/java/com/zgiot/zx/meetingroom/MeetingTimeKitTest.java
git commit -m "feat(meetingroom): 时间工具与单测，当前半格改为向下取整"
```

---

### Task 3: 预定校验规则 BookingRules

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/rule/RoomSnapshot.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/rule/SlotDraft.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/rule/BookingRules.java`
- Test: `src/test/java/com/zgiot/zx/meetingroom/BookingRulesTest.java`

**Interfaces:**
- Consumes: `MeetingTimeKit`、`MeetingBizException`
- Produces: `RoomSnapshot`（含 `openStart`/`openEnd` 为 `String`，`bookAheadDays` 为 `int`，`enabled`/`allowRecurring` 为 `boolean`，全参构造）；`SlotDraft`（`String date`、`int startMin`、`int endMin`、`String title`、`String remark`，全参构造 + getter）；`BookingRules.validateSlot(RoomSnapshot room, String date, String start, String end, String title, String remark, String userName, String nowDate, int nowMinute)` 返回 `SlotDraft`，不通过则抛 `MeetingBizException`；`BookingRules.overlaps(int aStart, int aEnd, int bStart, int bEnd)` 返回 `boolean`；`BookingRules.defaultTitle(String userName)` 返回 `String`；`BookingRules.resolveDates(RoomSnapshot room, String firstDate, List<String> dates, boolean repeatWeekly, String nowDate)` 返回 `List<String>`。

- [ ] **Step 1: 写失败的测试**

```java
package com.zgiot.zx.meetingroom;

import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingCode;
import com.zgiot.zx.meetingroom.rule.BookingRules;
import com.zgiot.zx.meetingroom.rule.RoomSnapshot;
import com.zgiot.zx.meetingroom.rule.SlotDraft;
import org.junit.Assert;
import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class BookingRulesTest {

    /** 08:00-22:00 开放、可提前 30 天、允许循环 */
    private RoomSnapshot room() {
        return new RoomSnapshot("101", "08:00", "22:00", 30, true, true);
    }

    private SlotDraft validate(String date, String start, String end, String title, String nowDate, int nowMinute) {
        return BookingRules.validateSlot(room(), date, start, end, title, null, "李明", nowDate, nowMinute);
    }

    private String codeOf(Runnable run) {
        try {
            run.run();
            return "NO_EXCEPTION";
        } catch (MeetingBizException e) {
            return e.getCode() + "|" + e.getMessage();
        }
    }

    @Test
    public void 正常时段应通过并补默认主题() {
        SlotDraft draft = validate("2026-09-01", "09:00", "10:00", null, "2026-09-01", 480);
        Assert.assertEquals("2026-09-01", draft.getDate());
        Assert.assertEquals(540, draft.getStartMin());
        Assert.assertEquals(600, draft.getEndMin());
        Assert.assertEquals("李明预定的会议", draft.getTitle());
    }

    @Test
    public void 无姓名时默认主题用同事() {
        SlotDraft draft = BookingRules.validateSlot(room(), "2026-09-01", "09:00", "10:00",
                null, null, null, "2026-09-01", 480);
        Assert.assertEquals("同事预定的会议", draft.getTitle());
    }

    @Test
    public void 姓名过长时默认主题要截断() {
        String longName = new String(new char[60]).replace('\0', '甲');
        SlotDraft draft = BookingRules.validateSlot(room(), "2026-09-01", "09:00", "10:00",
                null, null, longName, "2026-09-01", 480);
        Assert.assertEquals(50, draft.getTitle().length());
        Assert.assertTrue(draft.getTitle().endsWith("预定的会议"));
    }

    @Test
    public void 日期非法() {
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|请选择日期",
                codeOf(() -> validate("2026-13-01", "09:00", "10:00", null, "2026-09-01", 480)));
    }

    @Test
    public void 主题超长() {
        String longTitle = new String(new char[51]).replace('\0', '甲');
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|主题不超过 50 个字",
                codeOf(() -> validate("2026-09-01", "09:00", "10:00", longTitle, "2026-09-01", 480)));
    }

    @Test
    public void 备注超长() {
        String longRemark = new String(new char[101]).replace('\0', '乙');
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|备注不超过 100 个字",
                codeOf(() -> BookingRules.validateSlot(room(), "2026-09-01", "09:00", "10:00",
                        null, longRemark, "李明", "2026-09-01", 480)));
    }

    @Test
    public void 不在开放时间内() {
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|不在开放时间内",
                codeOf(() -> validate("2026-09-01", "07:00", "08:00", null, "2026-09-01", 360)));
    }

    @Test
    public void 昨天的时段已过期() {
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|该时段已过期",
                codeOf(() -> validate("2026-08-31", "09:00", "10:00", null, "2026-09-01", 480)));
    }

    @Test
    public void 当日当前半格仍可预约() {
        // 17:43 时预约 17:30-18:00 应通过（向下取整语义）
        SlotDraft draft = validate("2026-09-01", "17:30", "18:00", null, "2026-09-01", 1063);
        Assert.assertEquals(1050, draft.getStartMin());
    }

    @Test
    public void 上一整格已过期() {
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|该时段已过期",
                codeOf(() -> validate("2026-09-01", "17:00", "17:30", null, "2026-09-01", 1063)));
    }

    @Test
    public void 超出可提前预定范围() {
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|超出可提前预定范围",
                codeOf(() -> validate("2026-10-15", "09:00", "10:00", null, "2026-09-01", 480)));
    }

    @Test
    public void 时长不足半小时或不对齐() {
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|剩余空闲不足 30 分钟",
                codeOf(() -> validate("2026-09-01", "09:00", "09:20", null, "2026-09-01", 480)));
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|剩余空闲不足 30 分钟",
                codeOf(() -> validate("2026-09-01", "09:10", "09:40", null, "2026-09-01", 480)));
    }

    @Test
    public void 区间重叠判定() {
        Assert.assertTrue(BookingRules.overlaps(540, 600, 570, 630));
        Assert.assertTrue(BookingRules.overlaps(540, 600, 500, 560));
        Assert.assertFalse(BookingRules.overlaps(540, 600, 600, 660)); // 首尾相接不算冲突
        Assert.assertFalse(BookingRules.overlaps(540, 600, 480, 540));
    }

    @Test
    public void 多日与每周重复不能同时传() {
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|不能同时指定多日与每周重复",
                codeOf(() -> BookingRules.resolveDates(room(), "2026-09-01",
                        Arrays.asList("2026-09-02"), true, "2026-09-01")));
    }

    @Test
    public void 会议室不允许循环时拒绝每周重复() {
        RoomSnapshot noRecurring = new RoomSnapshot("101", "08:00", "22:00", 30, true, false);
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|该会议室不允许循环预定",
                codeOf(() -> BookingRules.resolveDates(noRecurring, "2026-09-01",
                        Collections.emptyList(), true, "2026-09-01")));
    }

    @Test
    public void 多日最多五天() {
        List<String> six = Arrays.asList("2026-09-01", "2026-09-02", "2026-09-03",
                "2026-09-04", "2026-09-05", "2026-09-06");
        Assert.assertEquals(MeetingCode.BAD_REQUEST + "|一次最多预定 5 天",
                codeOf(() -> BookingRules.resolveDates(room(), "2026-09-01", six, false, "2026-09-01")));
    }

    @Test
    public void 多日去重排序() {
        List<String> input = Arrays.asList("2026-09-03", "2026-09-01", "2026-09-03");
        Assert.assertEquals(Arrays.asList("2026-09-01", "2026-09-03"),
                BookingRules.resolveDates(room(), "2026-09-01", input, false, "2026-09-01"));
    }

    @Test
    public void 每周重复展开到可提前范围末尾() {
        List<String> dates = BookingRules.resolveDates(room(), "2026-09-01",
                Collections.emptyList(), true, "2026-09-01");
        // 2026-09-01 起每 7 天，直到 2026-10-01（今天+30）
        Assert.assertEquals(Arrays.asList("2026-09-01", "2026-09-08", "2026-09-15",
                "2026-09-22", "2026-09-29"), dates);
    }

    @Test
    public void 不传日期时用首日() {
        Assert.assertEquals(Collections.singletonList("2026-09-01"),
                BookingRules.resolveDates(room(), "2026-09-01", null, false, "2026-09-01"));
    }
}
```

- [ ] **Step 2: 跑测试确认失败**

```bash
mvn -o test -Dtest=BookingRulesTest
```
预期：编译失败，`找不到符号: 类 BookingRules`。

- [ ] **Step 3: 写实现**

`RoomSnapshot.java`：

```java
package com.zgiot.zx.meetingroom.rule;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** 校验用的会议室快照，不含持久化字段，便于纯函数单测 */
@Getter
@AllArgsConstructor
public class RoomSnapshot {

    private final String id;
    /** 开放开始 HH:mm */
    private final String openStart;
    /** 开放结束 HH:mm */
    private final String openEnd;
    /** 可提前预定天数 7/30/90/180 */
    private final int bookAheadDays;
    private final boolean enabled;
    private final boolean allowRecurring;
}
```

`SlotDraft.java`：

```java
package com.zgiot.zx.meetingroom.rule;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** 校验通过后的时段草稿 */
@Getter
@AllArgsConstructor
public class SlotDraft {

    private final String date;
    private final int startMin;
    private final int endMin;
    private final String title;
    private final String remark;
}
```

`BookingRules.java`：

```java
package com.zgiot.zx.meetingroom.rule;

import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingTimeKit;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * 预定业务规则，纯函数，不碰 Spring 与数据库。
 * 逐条对应 apps/meeting/server/src/domain/booking.ts 的 validateSlot / createBooking 校验，
 * 文案必须逐字一致，前端按 msg 直接展示。
 */
public final class BookingRules {

    /** 主题最大字数 */
    public static final int TITLE_MAX = 50;
    /** 备注最大字数 */
    public static final int REMARK_MAX = 100;
    /** 一次最多预定天数 */
    public static final int MAX_DATES = 5;

    private BookingRules() {
    }

    /** 主题后缀 */
    private static final String TITLE_SUFFIX = "预定的会议";

    /**
     * 未填主题时的默认值。无姓名时用「同事」；姓名过长先截断，保证总长不超 TITLE_MAX。
     * 对应 Node 的 defaultBookingTitle。
     */
    public static String defaultTitle(String userName) {
        String name = StringUtils.isBlank(userName) ? "同事" : userName.trim();
        int maxName = TITLE_MAX - TITLE_SUFFIX.length();
        if (name.length() > maxName) {
            name = name.substring(0, maxName);
        }
        return name + TITLE_SUFFIX;
    }

    /** 区间是否重叠；首尾相接（前一场 end == 后一场 start）不算冲突 */
    public static boolean overlaps(int aStart, int aEnd, int bStart, int bEnd) {
        return aStart < bEnd && bStart < aEnd;
    }

    /**
     * 单个时段校验。任何一条不过直接抛 MeetingBizException(M4000)。
     *
     * @param nowDate   东八区今天 yyyy-MM-dd
     * @param nowMinute 东八区当前分钟数
     */
    public static SlotDraft validateSlot(RoomSnapshot room, String date, String start, String end,
                                         String title, String remark, String userName,
                                         String nowDate, int nowMinute) {
        String theDate = StringUtils.trimToEmpty(date);
        if (!MeetingTimeKit.isDate(theDate)) {
            throw MeetingBizException.badRequest("请选择日期");
        }

        String finalTitle = StringUtils.isBlank(title) ? defaultTitle(userName) : title.trim();
        if (finalTitle.length() > TITLE_MAX) {
            throw MeetingBizException.badRequest("主题不超过 50 个字");
        }

        String finalRemark = remark == null ? null : remark.trim();
        if (finalRemark != null && finalRemark.length() > REMARK_MAX) {
            throw MeetingBizException.badRequest("备注不超过 100 个字");
        }

        Integer startMin = MeetingTimeKit.parseHm(start);
        Integer endMin = MeetingTimeKit.parseHm(end);
        if (startMin == null || endMin == null) {
            throw MeetingBizException.badRequest("剩余空闲不足 30 分钟");
        }

        Integer openStart = MeetingTimeKit.parseHm(room.getOpenStart());
        Integer openEnd = MeetingTimeKit.parseHm(room.getOpenEnd());
        if (openStart == null || openEnd == null) {
            throw MeetingBizException.badRequest("不在开放时间内");
        }
        if (startMin < openStart || endMin > openEnd) {
            throw MeetingBizException.badRequest("不在开放时间内");
        }

        boolean expired = theDate.compareTo(nowDate) < 0
                || (theDate.equals(nowDate) && startMin < MeetingTimeKit.slotFloor(nowMinute));
        if (expired) {
            throw MeetingBizException.badRequest("该时段已过期");
        }

        if (theDate.compareTo(MeetingTimeKit.addDays(nowDate, room.getBookAheadDays())) > 0) {
            throw MeetingBizException.badRequest("超出可提前预定范围");
        }

        if (startMin % MeetingTimeKit.SLOT_MIN != 0
                || endMin % MeetingTimeKit.SLOT_MIN != 0
                || endMin - startMin < MeetingTimeKit.SLOT_MIN) {
            throw MeetingBizException.badRequest("剩余空闲不足 30 分钟");
        }

        return new SlotDraft(theDate, startMin, endMin, finalTitle, finalRemark);
    }

    /**
     * 解析本次要落几天：多日列表、每周重复、或仅首日。
     * 多日与每周重复互斥；多日去重升序且不超过 5 天。
     */
    public static List<String> resolveDates(RoomSnapshot room, String firstDate, List<String> dates,
                                            boolean repeatWeekly, String nowDate) {
        List<String> listed = new ArrayList<>();
        if (dates != null) {
            for (String date : dates) {
                if (StringUtils.isNotBlank(date)) {
                    listed.add(date.trim());
                }
            }
        }

        if (repeatWeekly && !listed.isEmpty()) {
            throw MeetingBizException.badRequest("不能同时指定多日与每周重复");
        }
        if (repeatWeekly && !room.isAllowRecurring()) {
            throw MeetingBizException.badRequest("该会议室不允许循环预定");
        }
        for (String date : listed) {
            if (!MeetingTimeKit.isDate(date)) {
                throw MeetingBizException.badRequest("请选择日期");
            }
        }

        Set<String> unique = new TreeSet<>(listed);
        if (unique.size() > MAX_DATES) {
            throw MeetingBizException.badRequest("一次最多预定 5 天");
        }

        List<String> result;
        if (repeatWeekly) {
            result = MeetingTimeKit.weeklyDatesUntil(firstDate,
                    MeetingTimeKit.addDays(nowDate, room.getBookAheadDays()));
        } else if (!unique.isEmpty()) {
            result = new ArrayList<>(unique);
        } else {
            result = new ArrayList<>();
            result.add(firstDate);
        }

        if (result.isEmpty()) {
            throw MeetingBizException.badRequest("请选择日期");
        }
        return result;
    }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
mvn -o test -Dtest=BookingRulesTest
```
预期：`Tests run: 18, Failures: 0, Errors: 0`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom/rule src/test/java/com/zgiot/zx/meetingroom/BookingRulesTest.java
git commit -m "feat(meetingroom): 预定校验规则纯函数与单测"
```

---

### Task 4: 建表脚本与实体、Mapper

**Files:**
- Create: `dbscript/2026/V1_0_20260901_meetingroom_DDL.sql`
- Create: `src/main/java/com/zgiot/zx/meetingroom/entity/MeetingDict.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/entity/MeetingRoom.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/entity/MeetingBooking.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/entity/MeetingBookingAudit.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/mapper/MeetingDictMapper.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/mapper/MeetingRoomMapper.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/mapper/MeetingBookingMapper.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/mapper/MeetingBookingAuditMapper.java`

**Interfaces:**
- Consumes: 无
- Produces: 四个实体的 getter/setter（Lombok `@Getter@Setter`），字段名即列名；四个 Mapper 均 `extends BaseMapper<T>` 并打 `@Repository`。表名：`meeting_dict` / `meeting_room` / `meeting_booking` / `meeting_booking_audit`。

- [ ] **Step 1: 写建表脚本**

`dbscript/2026/V1_0_20260901_meetingroom_DDL.sql`：

```sql
-- 会议室：字典（楼宇 / 设施）
CREATE TABLE `meeting_dict` (
  `id` bigint(20) unsigned NOT NULL COMMENT '主键，雪花id',
  `corpId` bigint(20) unsigned NOT NULL COMMENT '企业id',
  `type` varchar(20) NOT NULL COMMENT '类型 building-楼宇 facility-设施',
  `name` varchar(50) NOT NULL COMMENT '名称',
  `sort` int(11) NOT NULL DEFAULT '0' COMMENT '排序',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用 0-否 1-是',
  `creator` bigint(20) unsigned NOT NULL COMMENT '创建人accountId',
  `createAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updator` bigint(20) unsigned NOT NULL COMMENT '更新人accountId',
  `updateAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_corp_type_name` (`corpId`,`type`,`name`),
  KEY `idx_dict_corp` (`corpId`,`type`,`sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议室字典';

-- 会议室
CREATE TABLE `meeting_room` (
  `id` bigint(20) unsigned NOT NULL COMMENT '主键，雪花id',
  `corpId` bigint(20) unsigned NOT NULL COMMENT '企业id',
  `name` varchar(50) NOT NULL COMMENT '会议室名称',
  `groupName` varchar(50) DEFAULT NULL COMMENT '分组名',
  `buildingName` varchar(50) NOT NULL COMMENT '楼宇',
  `floorName` varchar(20) NOT NULL COMMENT '楼层',
  `capacity` int(11) NOT NULL DEFAULT '0' COMMENT '容纳人数',
  `facilities` varchar(500) NOT NULL DEFAULT '[]' COMMENT '设施，JSON数组字符串',
  `locationNote` varchar(200) DEFAULT NULL COMMENT '位置备注',
  `openStart` char(5) NOT NULL DEFAULT '07:00' COMMENT '开放开始 HH:mm',
  `openEnd` char(5) NOT NULL DEFAULT '23:00' COMMENT '开放结束 HH:mm',
  `bookAheadDays` int(11) NOT NULL DEFAULT '90' COMMENT '可提前预定天数 7/30/90/180',
  `needApproval` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否需审批（一期只存不用）',
  `allowRecurring` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否允许循环预定',
  `allowPreempt` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否允许抢占（一期只存不用）',
  `enabled` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `creator` bigint(20) unsigned NOT NULL COMMENT '创建人accountId',
  `createAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updator` bigint(20) unsigned NOT NULL COMMENT '更新人accountId',
  `updateAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_room_corp` (`corpId`,`enabled`,`createAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议室';

-- 会议室预定
CREATE TABLE `meeting_booking` (
  `id` bigint(20) unsigned NOT NULL COMMENT '主键，雪花id',
  `corpId` bigint(20) unsigned NOT NULL COMMENT '企业id',
  `roomId` bigint(20) unsigned NOT NULL COMMENT '会议室id',
  `date` char(10) NOT NULL COMMENT '预定日期 yyyy-MM-dd',
  `startMin` smallint(6) NOT NULL COMMENT '开始，当天零点起分钟数',
  `endMin` smallint(6) NOT NULL COMMENT '结束，当天零点起分钟数',
  `title` varchar(100) NOT NULL COMMENT '会议主题',
  `remark` varchar(200) DEFAULT NULL COMMENT '备注',
  `hostUserId` bigint(20) unsigned NOT NULL COMMENT '预定人企业内userId',
  `hostUserName` varchar(50) NOT NULL COMMENT '预定人姓名',
  `hostDept` varchar(100) DEFAULT NULL COMMENT '预定人部门',
  `seriesId` bigint(20) unsigned DEFAULT NULL COMMENT '批次id，多日/循环共用',
  `releasedAt` timestamp NULL DEFAULT NULL COMMENT '释放时间，非空表示已释放',
  `creator` bigint(20) unsigned NOT NULL COMMENT '创建人accountId',
  `createAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updator` bigint(20) unsigned NOT NULL COMMENT '更新人accountId',
  `updateAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_booking_room_date` (`corpId`,`roomId`,`date`),
  KEY `idx_booking_host` (`corpId`,`hostUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议室预定';

-- 会议室预定审计
CREATE TABLE `meeting_booking_audit` (
  `id` bigint(20) unsigned NOT NULL COMMENT '主键，雪花id',
  `corpId` bigint(20) unsigned NOT NULL COMMENT '企业id',
  `bookingId` bigint(20) unsigned NOT NULL COMMENT '预定id',
  `seriesId` bigint(20) unsigned DEFAULT NULL COMMENT '批次id',
  `action` varchar(20) NOT NULL COMMENT '动作 create/update/release',
  `actorUserId` bigint(20) unsigned NOT NULL COMMENT '操作人企业内userId',
  `actorUserName` varchar(50) NOT NULL COMMENT '操作人姓名',
  `detail` varchar(1000) DEFAULT NULL COMMENT '明细JSON',
  `creator` bigint(20) unsigned NOT NULL COMMENT '创建人accountId',
  `createAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updator` bigint(20) unsigned NOT NULL COMMENT '更新人accountId',
  `updateAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_audit_booking` (`corpId`,`bookingId`,`createAt`),
  KEY `idx_audit_corp` (`corpId`,`createAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议室预定审计';
```

- [ ] **Step 2: 在测试库执行建表**

```bash
mysql -h192.168.10.31 -uroot -p123456 zx_contact < dbscript/2026/V1_0_20260901_meetingroom_DDL.sql
```
> 本机没装 mysql 客户端时，用 IDEA 的数据库面板执行，或临时用 `/tmp/jdbct/Q.java` 那套 JDBC 小工具逐条跑。
> 预期：四张表创建成功，`show tables like 'meeting%'` 返回 4 行。

- [ ] **Step 3: 写实体**

`MeetingDict.java`：

```java
package com.zgiot.zx.meetingroom.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.zgiot.zx.common.entity.BaseEntity;
import lombok.Getter;
import lombok.Setter;

/** 会议室字典：楼宇 / 设施 */
@Getter
@Setter
@TableName("meeting_dict")
public class MeetingDict extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /** 企业id */
    private String corpId;
    /** 类型 building / facility */
    private String type;
    /** 名称 */
    private String name;
    /** 排序 */
    private Integer sort;
    /** 是否启用 0-否 1-是 */
    private Integer enabled;

    public static final String TBL_CORPID = "corpId";
    public static final String TBL_TYPE = "type";
    public static final String TBL_NAME = "name";
    public static final String TBL_SORT = "sort";
    public static final String TBL_ENABLED = "enabled";
}
```

`MeetingRoom.java`：

```java
package com.zgiot.zx.meetingroom.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.zgiot.zx.common.entity.BaseEntity;
import lombok.Getter;
import lombok.Setter;

/** 会议室 */
@Getter
@Setter
@TableName("meeting_room")
public class MeetingRoom extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private String corpId;
    private String name;
    private String groupName;
    private String buildingName;
    private String floorName;
    private Integer capacity;
    /** 设施，JSON 数组字符串，如 ["电视","白板"] */
    private String facilities;
    private String locationNote;
    /** 开放开始 HH:mm */
    private String openStart;
    /** 开放结束 HH:mm */
    private String openEnd;
    /** 可提前预定天数 7/30/90/180 */
    private Integer bookAheadDays;
    private Integer needApproval;
    private Integer allowRecurring;
    private Integer allowPreempt;
    private Integer enabled;

    public static final String TBL_CORPID = "corpId";
    public static final String TBL_NAME = "name";
    public static final String TBL_BUILDINGNAME = "buildingName";
    public static final String TBL_FLOORNAME = "floorName";
    public static final String TBL_ENABLED = "enabled";
    public static final String TBL_CREATEAT = "createAt";
}
```

`MeetingBooking.java`：

```java
package com.zgiot.zx.meetingroom.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.zgiot.zx.common.entity.BaseEntity;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;

/** 会议室预定 */
@Getter
@Setter
@TableName("meeting_booking")
public class MeetingBooking extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private String corpId;
    private String roomId;
    /** yyyy-MM-dd */
    private String date;
    /** 当天零点起分钟数 */
    private Integer startMin;
    private Integer endMin;
    private String title;
    private String remark;
    /** 预定人企业内 userId */
    private String hostUserId;
    private String hostUserName;
    private String hostDept;
    /** 批次id，多日/循环共用，单条为 null */
    private String seriesId;
    /** 释放时间，非空表示已释放 */
    private Date releasedAt;

    public static final String TBL_CORPID = "corpId";
    public static final String TBL_ROOMID = "roomId";
    public static final String TBL_DATE = "date";
    public static final String TBL_STARTMIN = "startMin";
    public static final String TBL_ENDMIN = "endMin";
    public static final String TBL_HOSTUSERID = "hostUserId";
    public static final String TBL_SERIESID = "seriesId";
    public static final String TBL_RELEASEDAT = "releasedAt";
}
```

`MeetingBookingAudit.java`：

```java
package com.zgiot.zx.meetingroom.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.zgiot.zx.common.entity.BaseEntity;
import lombok.Getter;
import lombok.Setter;

/** 会议室预定审计 */
@Getter
@Setter
@TableName("meeting_booking_audit")
public class MeetingBookingAudit extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private String corpId;
    private String bookingId;
    private String seriesId;
    /** create / update / release */
    private String action;
    private String actorUserId;
    private String actorUserName;
    /** 明细JSON */
    private String detail;

    public static final String TBL_CORPID = "corpId";
    public static final String TBL_BOOKINGID = "bookingId";
    public static final String TBL_CREATEAT = "createAt";
}
```

- [ ] **Step 4: 写 Mapper**

四个文件同构，以 `MeetingRoomMapper.java` 为例，其余把泛型换成对应实体：

```java
package com.zgiot.zx.meetingroom.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zgiot.zx.meetingroom.entity.MeetingRoom;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingRoomMapper extends BaseMapper<MeetingRoom> {
}
```

```java
package com.zgiot.zx.meetingroom.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zgiot.zx.meetingroom.entity.MeetingDict;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingDictMapper extends BaseMapper<MeetingDict> {
}
```

```java
package com.zgiot.zx.meetingroom.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zgiot.zx.meetingroom.entity.MeetingBooking;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingBookingMapper extends BaseMapper<MeetingBooking> {
}
```

```java
package com.zgiot.zx.meetingroom.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zgiot.zx.meetingroom.entity.MeetingBookingAudit;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingBookingAuditMapper extends BaseMapper<MeetingBookingAudit> {
}
```

- [ ] **Step 5: 构建并启动，确认 Bean 注册无误**

```bash
mvn -o -DskipTests clean package
java "-DsocksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
     "-Dhttp.nonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
     -jar target/zx-contact-1.0.0.jar --eureka.client.register-with-eureka=false > /tmp/contact-run.log 2>&1 &
sleep 90 && grep -c "Started ContactApplication" /tmp/contact-run.log
```
预期：输出 `1`；日志里没有 `meetingroom` 相关的 `BeanCreationException`。

- [ ] **Step 6: 提交**

```bash
git add dbscript/2026/V1_0_20260901_meetingroom_DDL.sql src/main/java/com/zgiot/zx/meetingroom/entity src/main/java/com/zgiot/zx/meetingroom/mapper
git commit -m "feat(meetingroom): 建表脚本与实体、Mapper"
```

---

### Task 5: 当前用户解析 MeetingUserResolver

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/common/MeetingCurrentUser.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/common/MeetingUserResolver.java`

**Interfaces:**
- Consumes: `MeetingBizException`、`com.zgiot.zx.user.mapper.UserMapper`、`com.zgiot.zx.user.entity.User`、`com.zgiot.zx.dept.mapper.DeptUserMapper`
- Produces: `MeetingCurrentUser`（`String corpId` / `String accountId` / `String userId` / `String userName` / `String dept`，全参构造 + getter）；Spring Bean `MeetingUserResolver`，方法 `MeetingCurrentUser current()`（无有效用户抛 `M4002`）与 `String currentCorpId()`（无企业抛 `M4001`）。

- [ ] **Step 1: 写实现**

`MeetingCurrentUser.java`：

```java
package com.zgiot.zx.meetingroom.common;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** 会议室域内的当前用户，全部由服务端推导，不采信前端入参 */
@Getter
@AllArgsConstructor
public class MeetingCurrentUser {

    private final String corpId;
    private final String accountId;
    /** 企业内 userId，与 corpId 绑定 */
    private final String userId;
    private final String userName;
    private final String dept;
}
```

`MeetingUserResolver.java`：

```java
package com.zgiot.zx.meetingroom.common;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zgiot.zx.common.web.session.CurrentAppUser;
import com.zgiot.zx.common.web.session.SessionContext;
import com.zgiot.zx.user.entity.User;
import com.zgiot.zx.user.mapper.UserMapper;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 当前企业与当前用户的唯一来源。
 * corpId 取自网关注入的 session，不读前端传的任何 corpId 参数；
 * userId 用 (accountId, corpId) 查 user 表推导，查不到即拒，顺带堵住伪造 corpId 越权。
 */
@Component
public class MeetingUserResolver {

    @Autowired
    private UserMapper userMapper;

    /** 当前企业id，缺失抛 M4001 */
    public String currentCorpId() {
        CurrentAppUser appUser = SessionContext.getCurrentAppUser();
        String corpId = appUser == null ? null : appUser.getCorpId();
        if (StringUtils.isBlank(corpId)) {
            throw MeetingBizException.noCorp("缺少企业信息");
        }
        return corpId;
    }

    /** 当前用户，缺失或该账号在本企业无有效成员时抛 M4002 */
    public MeetingCurrentUser current() {
        CurrentAppUser appUser = SessionContext.getCurrentAppUser();
        String accountId = appUser == null ? null : appUser.getAccountId();
        String corpId = currentCorpId();
        if (StringUtils.isBlank(accountId)) {
            throw MeetingBizException.noUser("缺少用户信息，请重新登录");
        }

        List<User> users = userMapper.selectList(new QueryWrapper<User>()
                .eq(User.TBL_ACCOUNTID, accountId)
                .eq(User.TBL_CORPID, corpId));
        if (users == null || users.isEmpty()) {
            throw MeetingBizException.noUser("缺少用户信息，请重新登录");
        }

        User user = users.get(0);
        return new MeetingCurrentUser(corpId, accountId, user.getId(),
                StringUtils.trimToEmpty(user.getName()), "");
    }
}
```

> `User` 实体上打了 `@TableLogic` 的 `isDel`，MyBatis-Plus 自动过滤已删除成员，无需手写条件。
> `dept` 先留空字符串，Task 8 落看板时若确认前端要展示部门再补查 `dept_user`——Node 端该字段来自 header，本就可能为空。

- [ ] **Step 2: 编译确认通过**

```bash
mvn -o -DskipTests compile
```
预期：`BUILD SUCCESS`。

- [ ] **Step 3: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom/common/MeetingCurrentUser.java src/main/java/com/zgiot/zx/meetingroom/common/MeetingUserResolver.java
git commit -m "feat(meetingroom): 当前企业与用户由服务端推导"
```

---

### Task 6: 字典 CRUD

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/MeetingDictRspDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/MeetingDictSaveReqDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/EnabledReqDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/service/MeetingDictService.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/controller/MeetingDictController.java`

**Interfaces:**
- Consumes: `MeetingDictMapper`、`MeetingRoomMapper`、`MeetingUserResolver`、`MeetingBizException`
- Produces: `MeetingDictService#list(String corpId, String type)` → `List<MeetingDictRspDTO>`；`#create(String corpId, MeetingDictSaveReqDTO)` → `MeetingDictRspDTO`；`#update(String corpId, String id, MeetingDictSaveReqDTO)` → `MeetingDictRspDTO`；`#setEnabled(String corpId, String id, boolean enabled)` → `MeetingDictRspDTO`；`#delete(String corpId, String id)` → `void`；`#ensureDefaults(String corpId)` → `void`（Task 8 的看板会调）。

- [ ] **Step 1: 写 DTO**

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

/** 字典出参，字段名与 Node 端 DictRecord 对齐 */
@Getter
@Setter
public class MeetingDictRspDTO {

    private String id;
    private String corpId;
    private String type;
    private String name;
    private Integer sort;
    private Boolean enabled;
    /** 被多少个会议室引用 */
    private Integer usageCount;
    private String createdAt;
    private String updatedAt;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

/** 字典新增/修改入参 */
@Getter
@Setter
public class MeetingDictSaveReqDTO {

    /** building / facility */
    private String type;
    private String name;
    private Integer sort;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

/** 启用/停用入参 */
@Getter
@Setter
public class EnabledReqDTO {

    private Boolean enabled;
}
```

- [ ] **Step 2: 写 Service**

```java
package com.zgiot.zx.meetingroom.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zgiot.zx.common.service.BaseService;
import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.dto.MeetingDictRspDTO;
import com.zgiot.zx.meetingroom.dto.MeetingDictSaveReqDTO;
import com.zgiot.zx.meetingroom.entity.MeetingDict;
import com.zgiot.zx.meetingroom.entity.MeetingRoom;
import com.zgiot.zx.meetingroom.mapper.MeetingDictMapper;
import com.zgiot.zx.meetingroom.mapper.MeetingRoomMapper;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** 会议室字典：楼宇与设施 */
@Service
public class MeetingDictService extends BaseService<MeetingDict> {

    /** 名称最大字数 */
    public static final int NAME_MAX = 20;
    /** 楼宇 */
    public static final String TYPE_BUILDING = "building";
    /** 设施 */
    public static final String TYPE_FACILITY = "facility";

    @Autowired
    private MeetingDictMapper meetingDictMapper;

    @Autowired
    private MeetingRoomMapper meetingRoomMapper;

    /** 列表；type 为空则查全部，按 sort、name 升序 */
    public List<MeetingDictRspDTO> list(String corpId, String type) {
        ensureDefaults(corpId);
        QueryWrapper<MeetingDict> wrapper = new QueryWrapper<MeetingDict>()
                .eq(MeetingDict.TBL_CORPID, corpId);
        if (StringUtils.isNotBlank(type)) {
            wrapper.eq(MeetingDict.TBL_TYPE, type);
        }
        wrapper.orderByAsc(MeetingDict.TBL_SORT).orderByAsc(MeetingDict.TBL_NAME);

        List<MeetingDict> rows = meetingDictMapper.selectList(wrapper);
        List<MeetingDictRspDTO> result = new ArrayList<>();
        for (MeetingDict row : rows) {
            result.add(toDto(row, countUsage(corpId, row)));
        }
        return result;
    }

    /** 新增，同企业同类型重名直接拒 */
    @Transactional(readOnly = false)
    public MeetingDictRspDTO create(String corpId, MeetingDictSaveReqDTO req) {
        String type = normalizeType(req.getType());
        String name = StringUtils.trimToEmpty(req.getName());
        if (StringUtils.isBlank(name)) {
            throw MeetingBizException.badRequest("请输入名称");
        }
        if (name.length() > NAME_MAX) {
            throw MeetingBizException.badRequest("名称不超过 20 个字");
        }
        if (exists(corpId, type, name, null)) {
            throw MeetingBizException.badRequest("同类型下已有相同名称");
        }

        MeetingDict dict = new MeetingDict();
        dict.setCorpId(corpId);
        dict.setType(type);
        dict.setName(name);
        dict.setSort(normalizeSort(req.getSort()));
        dict.setEnabled(1);
        this.insert(dict);
        return toDto(dict, 0);
    }

    /**
     * 修改名称与排序，类型不可改。
     * 改名要级联：楼宇改名重写所有会议室的 buildingName；设施改名逐个重写 rooms.facilities。
     * 对应 Node dict.ts 的同名事务，漏了会导致会议室指向不存在的字典项。
     */
    @Transactional(readOnly = false, rollbackFor = Exception.class)
    public MeetingDictRspDTO update(String corpId, String id, MeetingDictSaveReqDTO req) {
        MeetingDict dict = mustGet(corpId, id);
        String oldName = dict.getName();
        String name = StringUtils.trimToEmpty(req.getName());
        if (StringUtils.isBlank(name)) {
            throw MeetingBizException.badRequest("请输入名称");
        }
        if (name.length() > NAME_MAX) {
            throw MeetingBizException.badRequest("名称不超过 20 个字");
        }
        if (exists(corpId, dict.getType(), name, id)) {
            throw MeetingBizException.badRequest("同类型下已有相同名称");
        }

        dict.setName(name);
        dict.setSort(normalizeSort(req.getSort()));
        this.updateById(dict);

        if (!name.equals(oldName)) {
            cascadeRename(corpId, dict.getType(), oldName, name);
        }
        return toDto(dict, countUsage(corpId, dict));
    }

    /** 字典改名后同步会议室上的冗余名称 */
    private void cascadeRename(String corpId, String type, String oldName, String newName) {
        if (TYPE_BUILDING.equals(type)) {
            MeetingRoom patch = new MeetingRoom();
            patch.setBuildingName(newName);
            meetingRoomMapper.update(patch, new QueryWrapper<MeetingRoom>()
                    .eq(MeetingRoom.TBL_CORPID, corpId)
                    .eq(MeetingRoom.TBL_BUILDINGNAME, oldName));
            return;
        }
        List<MeetingRoom> rooms = meetingRoomMapper.selectList(new QueryWrapper<MeetingRoom>()
                .eq(MeetingRoom.TBL_CORPID, corpId));
        for (MeetingRoom room : rooms) {
            List<String> facilities = MeetingRoomService.parseFacilities(room.getFacilities());
            if (!facilities.contains(oldName)) {
                continue;
            }
            List<String> renamed = new ArrayList<>();
            for (String item : facilities) {
                renamed.add(oldName.equals(item) ? newName : item);
            }
            MeetingRoom patch = new MeetingRoom();
            patch.setId(room.getId());
            patch.setFacilities(com.alibaba.fastjson.JSON.toJSONString(renamed));
            meetingRoomMapper.updateById(patch);
        }
    }

    /** sort 只接受正整数，非法归 1，对应 Node 的 nextSort */
    private int normalizeSort(Integer sort) {
        return sort != null && sort > 0 ? sort : 1;
    }

    /** 启用 / 停用 */
    @Transactional(readOnly = false)
    public MeetingDictRspDTO setEnabled(String corpId, String id, boolean enabled) {
        MeetingDict dict = mustGet(corpId, id);
        dict.setEnabled(enabled ? 1 : 0);
        this.updateById(dict);
        return toDto(dict, countUsage(corpId, dict));
    }

    /** 删除；被会议室引用时拒绝 */
    @Transactional(readOnly = false)
    public void delete(String corpId, String id) {
        MeetingDict dict = mustGet(corpId, id);
        int usage = countUsage(corpId, dict);
        if (usage > 0) {
            throw MeetingBizException.badRequest("已被 " + usage + " 个会议室使用，不能删除");
        }
        meetingDictMapper.deleteById(id);
    }

    /** 企业首次使用时初始化默认字典，对应 Node 的 ensureDefaultDicts */
    @Transactional(readOnly = false)
    public void ensureDefaults(String corpId) {
        Integer count = meetingDictMapper.selectCount(new QueryWrapper<MeetingDict>()
                .eq(MeetingDict.TBL_CORPID, corpId));
        if (count != null && count > 0) {
            return;
        }
        List<String[]> defaults = Arrays.asList(
                new String[]{TYPE_BUILDING, "奥城", "1"},
                new String[]{TYPE_BUILDING, "生态城", "2"},
                new String[]{TYPE_FACILITY, "电视", "1"},
                new String[]{TYPE_FACILITY, "白板", "2"},
                new String[]{TYPE_FACILITY, "投影", "3"}
        );
        for (String[] item : defaults) {
            MeetingDict dict = new MeetingDict();
            dict.setCorpId(corpId);
            dict.setType(item[0]);
            dict.setName(item[1]);
            dict.setSort(Integer.parseInt(item[2]));
            dict.setEnabled(1);
            this.insert(dict);
        }
    }

    private MeetingDict mustGet(String corpId, String id) {
        MeetingDict dict = meetingDictMapper.selectOne(new QueryWrapper<MeetingDict>()
                .eq("id", id)
                .eq(MeetingDict.TBL_CORPID, corpId));
        if (dict == null) {
            throw MeetingBizException.notFound("字典项不存在");
        }
        return dict;
    }

    private String normalizeType(String type) {
        String value = StringUtils.trimToEmpty(type);
        if (!TYPE_BUILDING.equals(value) && !TYPE_FACILITY.equals(value)) {
            throw MeetingBizException.badRequest("类型无效");
        }
        return value;
    }

    private boolean exists(String corpId, String type, String name, String excludeId) {
        QueryWrapper<MeetingDict> wrapper = new QueryWrapper<MeetingDict>()
                .eq(MeetingDict.TBL_CORPID, corpId)
                .eq(MeetingDict.TBL_TYPE, type)
                .eq(MeetingDict.TBL_NAME, name);
        if (StringUtils.isNotBlank(excludeId)) {
            wrapper.ne("id", excludeId);
        }
        Integer count = meetingDictMapper.selectCount(wrapper);
        return count != null && count > 0;
    }

    /** 楼宇按 buildingName 统计，设施按 facilities JSON 串模糊匹配 */
    private int countUsage(String corpId, MeetingDict dict) {
        QueryWrapper<MeetingRoom> wrapper = new QueryWrapper<MeetingRoom>()
                .eq(MeetingRoom.TBL_CORPID, corpId);
        if (TYPE_BUILDING.equals(dict.getType())) {
            wrapper.eq(MeetingRoom.TBL_BUILDINGNAME, dict.getName());
        } else {
            wrapper.like("facilities", "\"" + dict.getName() + "\"");
        }
        Integer count = meetingRoomMapper.selectCount(wrapper);
        return count == null ? 0 : count;
    }

    private MeetingDictRspDTO toDto(MeetingDict dict, int usageCount) {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        MeetingDictRspDTO dto = new MeetingDictRspDTO();
        dto.setId(dict.getId());
        dto.setCorpId(dict.getCorpId());
        dto.setType(dict.getType());
        dto.setName(dict.getName());
        dto.setSort(dict.getSort());
        dto.setEnabled(dict.getEnabled() != null && dict.getEnabled() == 1);
        dto.setUsageCount(usageCount);
        dto.setCreatedAt(dict.getCreateAt() == null ? null : fmt.format(dict.getCreateAt()));
        dto.setUpdatedAt(dict.getUpdateAt() == null ? null : fmt.format(dict.getUpdateAt()));
        return dto;
    }
}
```

- [ ] **Step 3: 写 Controller**

```java
package com.zgiot.zx.meetingroom.controller;

import com.zgiot.zx.common.dto.Ret;
import com.zgiot.zx.common.web.BaseController;
import com.zgiot.zx.meetingroom.common.MeetingUserResolver;
import com.zgiot.zx.meetingroom.dto.EnabledReqDTO;
import com.zgiot.zx.meetingroom.dto.MeetingDictRspDTO;
import com.zgiot.zx.meetingroom.dto.MeetingDictSaveReqDTO;
import com.zgiot.zx.meetingroom.service.MeetingDictService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(value = "/meetingRoom/dicts", tags = "会议室字典")
@RestController
@RequestMapping("/meetingRoom/dicts")
@Slf4j
public class MeetingDictController extends BaseController {

    @Autowired
    private MeetingDictService meetingDictService;

    @Autowired
    private MeetingUserResolver userResolver;

    @ApiOperation(value = "字典列表", notes = "type 可选 building / facility")
    @GetMapping
    public Ret<List<MeetingDictRspDTO>> list(@RequestParam(required = false) String type) {
        String corpId = userResolver.currentCorpId();
        return Ret.ok().setData(meetingDictService.list(corpId, type));
    }

    @ApiOperation(value = "新增字典", notes = "新增字典")
    @PostMapping("/create")
    public Ret<MeetingDictRspDTO> create(@RequestBody MeetingDictSaveReqDTO req) {
        String corpId = userResolver.currentCorpId();
        return Ret.ok().setData(meetingDictService.create(corpId, req));
    }

    @ApiOperation(value = "修改字典", notes = "修改字典")
    @PostMapping("/update/{id}")
    public Ret<MeetingDictRspDTO> update(@PathVariable("id") String id,
                                         @RequestBody MeetingDictSaveReqDTO req) {
        String corpId = userResolver.currentCorpId();
        return Ret.ok().setData(meetingDictService.update(corpId, id, req));
    }

    @ApiOperation(value = "启用停用字典", notes = "启用停用字典")
    @PostMapping("/enabled/{id}")
    public Ret<MeetingDictRspDTO> setEnabled(@PathVariable("id") String id,
                                             @RequestBody EnabledReqDTO req) {
        String corpId = userResolver.currentCorpId();
        boolean enabled = req.getEnabled() != null && req.getEnabled();
        return Ret.ok().setData(meetingDictService.setEnabled(corpId, id, enabled));
    }

    @ApiOperation(value = "删除字典", notes = "被会议室引用时不可删")
    @PostMapping("/delete/{id}")
    public Ret<String> delete(@PathVariable("id") String id) {
        String corpId = userResolver.currentCorpId();
        meetingDictService.delete(corpId, id);
        return Ret.ok();
    }
}
```

- [ ] **Step 4: 重启服务并 curl 验收**

```bash
mvn -o -DskipTests clean package
java "-DsocksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
     -jar target/zx-contact-1.0.0.jar --eureka.client.register-with-eureka=false > /tmp/contact-run.log 2>&1 &
sleep 90

# 网关不在本地，直接补 AAuthFilter 认的 header 模拟登录态。
# accountId 取法：select accountId from user where corpId='6' and name='<你的姓名>' limit 1
curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/dicts?type=building"
```
预期：返回 `{"code":"M0000","data":[{"type":"building","name":"奥城",...},{"name":"生态城",...}],...}`（首次调用触发默认字典初始化）。

```bash
curl -s --noproxy '*' -X POST -H "Content-Type: application/json" \
  -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  -d '{"type":"facility","name":"音响","sort":9}' \
  "http://127.0.0.1:7004/meetingRoom/dicts/create"
```
预期：`code` 为 `M0000`，`data.usageCount` 为 `0`。重复执行第二次预期 `{"code":"M4000","msg":"同类型下已有相同名称"}`。

再验级联改名——把「奥城」改成「奥城A座」后，原本挂在奥城的会议室 `buildingName` 必须一起变：
```bash
curl -s --noproxy '*' -X POST -H "Content-Type: application/json" \
  -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  -d '{"name":"奥城A座","sort":1}' "http://127.0.0.1:7004/meetingRoom/dicts/update/<buildingDictId>"
curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/rooms?page=1&pageSize=50"
```
预期：列表里原属奥城的会议室 `buildingName` 全部变成 `奥城A座`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom/dto src/main/java/com/zgiot/zx/meetingroom/service/MeetingDictService.java src/main/java/com/zgiot/zx/meetingroom/controller/MeetingDictController.java
git commit -m "feat(meetingroom): 字典 CRUD 与默认字典初始化"
```

---

### Task 6b: 会议室校验规则 RoomRules（纯函数）

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/rule/RoomDraft.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/rule/RoomRules.java`
- Test: `src/test/java/com/zgiot/zx/meetingroom/RoomRulesTest.java`

**Interfaces:**
- Consumes: `MeetingTimeKit`、`MeetingBizException`
- Produces: `RoomDraft`（规范化后的会议室字段，全 getter）；`RoomRules.FLOOR_OPTIONS`（`List<String>`，"1层".."20层"）；`RoomRules.BOOK_AHEAD`（`List<Integer>` 7/30/90/180）；`RoomRules.normalize(MeetingRoomSaveReqDTO req, List<String> facilityOrder)` → `RoomDraft`；`RoomRules.validate(RoomDraft draft, List<String> allFacilities, List<String> enabledFacilities, List<String> enabledBuildings, RoomDraft current)` → `void`（不过抛 `M4000`，`current` 为 null 表示新建）。

> 这些规则与文案逐条抄自 `apps/meeting/server/src/domain/room.ts` 的 `normalizePayload` / `validateNormalized`，**默认值也照抄**：`openStart=07:00`、`openEnd=23:00`、`bookAheadDays=90`、`needApproval/allowRecurring/allowPreempt=false`、`enabled=true`。

- [ ] **Step 1: 写失败的测试**

```java
package com.zgiot.zx.meetingroom;

import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.dto.MeetingRoomSaveReqDTO;
import com.zgiot.zx.meetingroom.rule.RoomDraft;
import com.zgiot.zx.meetingroom.rule.RoomRules;
import org.junit.Assert;
import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class RoomRulesTest {

    private static final List<String> ALL_FACILITY = Arrays.asList("电视", "白板", "投影");
    private static final List<String> ENABLED_FACILITY = Arrays.asList("电视", "白板");
    private static final List<String> ENABLED_BUILDING = Arrays.asList("奥城", "生态城");

    private MeetingRoomSaveReqDTO req() {
        MeetingRoomSaveReqDTO req = new MeetingRoomSaveReqDTO();
        req.setName("A401");
        req.setBuildingName("奥城");
        req.setFloorName("4层");
        req.setCapacity(10);
        req.setFacilities(Arrays.asList("白板", "电视"));
        return req;
    }

    private String msgOf(Runnable run) {
        try {
            run.run();
            return "NO_EXCEPTION";
        } catch (MeetingBizException e) {
            return e.getMessage();
        }
    }

    private void validate(MeetingRoomSaveReqDTO req) {
        RoomDraft draft = RoomRules.normalize(req, ALL_FACILITY);
        RoomRules.validate(draft, ALL_FACILITY, ENABLED_FACILITY, ENABLED_BUILDING, null);
    }

    @Test
    public void 默认值照抄Node() {
        MeetingRoomSaveReqDTO req = req();
        RoomDraft draft = RoomRules.normalize(req, ALL_FACILITY);
        Assert.assertEquals("07:00", draft.getOpenStart());
        Assert.assertEquals("23:00", draft.getOpenEnd());
        Assert.assertEquals(90, draft.getBookAheadDays());
        Assert.assertFalse(draft.isNeedApproval());
        Assert.assertFalse(draft.isAllowRecurring());
        Assert.assertFalse(draft.isAllowPreempt());
        Assert.assertTrue(draft.isEnabled());
    }

    @Test
    public void 设施去重并按字典顺序排列() {
        MeetingRoomSaveReqDTO req = req();
        req.setFacilities(Arrays.asList("白板", "电视", "白板"));
        RoomDraft draft = RoomRules.normalize(req, ALL_FACILITY);
        Assert.assertEquals(Arrays.asList("电视", "白板"), draft.getFacilities());
    }

    @Test
    public void 空名称() {
        MeetingRoomSaveReqDTO req = req();
        req.setName("  ");
        Assert.assertEquals("请输入名称", msgOf(() -> validate(req)));
    }

    @Test
    public void 名称超三十字() {
        MeetingRoomSaveReqDTO req = req();
        req.setName(new String(new char[31]).replace('\0', '甲'));
        Assert.assertEquals("名称不超过 30 个字", msgOf(() -> validate(req)));
    }

    @Test
    public void 分组超二十字() {
        MeetingRoomSaveReqDTO req = req();
        req.setGroupName(new String(new char[21]).replace('\0', '乙'));
        Assert.assertEquals("分组不超过 20 个字", msgOf(() -> validate(req)));
    }

    @Test
    public void 备注超一百字() {
        MeetingRoomSaveReqDTO req = req();
        req.setLocationNote(new String(new char[101]).replace('\0', '丙'));
        Assert.assertEquals("备注不超过 100 个字", msgOf(() -> validate(req)));
    }

    @Test
    public void 楼宇为空() {
        MeetingRoomSaveReqDTO req = req();
        req.setBuildingName("");
        Assert.assertEquals("请选择或输入建筑", msgOf(() -> validate(req)));
    }

    @Test
    public void 楼层必须在枚举内() {
        MeetingRoomSaveReqDTO req = req();
        req.setFloorName("21层");
        Assert.assertEquals("请选择楼层", msgOf(() -> validate(req)));
        Assert.assertEquals(20, RoomRules.FLOOR_OPTIONS.size());
        Assert.assertEquals("1层", RoomRules.FLOOR_OPTIONS.get(0));
    }

    @Test
    public void 容纳人数范围() {
        MeetingRoomSaveReqDTO tooSmall = req();
        tooSmall.setCapacity(0);
        Assert.assertEquals("请输入容纳人数（1-999整数）", msgOf(() -> validate(tooSmall)));
        MeetingRoomSaveReqDTO tooBig = req();
        tooBig.setCapacity(1000);
        Assert.assertEquals("请输入容纳人数（1-999整数）", msgOf(() -> validate(tooBig)));
    }

    @Test
    public void 开放时间非法() {
        MeetingRoomSaveReqDTO bad = req();
        bad.setOpenStart("25:00");
        bad.setOpenEnd("23:00");
        Assert.assertEquals("请选择开放时间", msgOf(() -> validate(bad)));
    }

    @Test
    public void 结束不晚于开始() {
        MeetingRoomSaveReqDTO same = req();
        same.setOpenStart("09:00");
        same.setOpenEnd("09:00");
        Assert.assertEquals("结束时间必须晚于开始时间", msgOf(() -> validate(same)));
    }

    @Test
    public void 可提前范围只能是白名单() {
        MeetingRoomSaveReqDTO req = req();
        req.setBookAheadDays(15);
        Assert.assertEquals("请选择可提前预定范围", msgOf(() -> validate(req)));
    }

    @Test
    public void 未知设施被拒() {
        MeetingRoomSaveReqDTO req = req();
        req.setFacilities(Collections.singletonList("咖啡机"));
        Assert.assertEquals("存在未知设施", msgOf(() -> validate(req)));
    }

    @Test
    public void 已停用设施新建时被拒() {
        MeetingRoomSaveReqDTO req = req();
        req.setFacilities(Collections.singletonList("投影")); // 在 ALL 里但不在 ENABLED 里
        Assert.assertEquals("存在未知设施", msgOf(() -> validate(req)));
    }

    @Test
    public void 编辑时允许保留原有的停用设施与楼宇() {
        MeetingRoomSaveReqDTO req = req();
        req.setFacilities(Collections.singletonList("投影"));
        req.setBuildingName("老楼");
        RoomDraft current = RoomRules.normalize(req, ALL_FACILITY);
        RoomDraft draft = RoomRules.normalize(req, ALL_FACILITY);
        // current 带着同样的停用设施与楼宇，编辑时不应报错
        RoomRules.validate(draft, ALL_FACILITY, ENABLED_FACILITY, ENABLED_BUILDING, current);
    }

    @Test
    public void 新建时楼宇必须在启用字典内() {
        MeetingRoomSaveReqDTO req = req();
        req.setBuildingName("没登记的楼");
        Assert.assertEquals("请选择启用中的建筑", msgOf(() -> validate(req)));
    }
}
```

- [ ] **Step 2: 跑测试确认失败**

```bash
mvn -o test -Dtest=RoomRulesTest
```
预期：编译失败，`找不到符号: 类 RoomRules`。

- [ ] **Step 3: 写实现**

`RoomDraft.java`：

```java
package com.zgiot.zx.meetingroom.rule;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

/** 规范化后的会议室字段 */
@Getter
@AllArgsConstructor
public class RoomDraft {

    private final String name;
    private final String groupName;
    private final String buildingName;
    private final String floorName;
    private final int capacity;
    private final List<String> facilities;
    private final String locationNote;
    private final String openStart;
    private final String openEnd;
    private final int bookAheadDays;
    private final boolean needApproval;
    private final boolean allowRecurring;
    private final boolean allowPreempt;
    private final boolean enabled;
}
```

`RoomRules.java`：

```java
package com.zgiot.zx.meetingroom.rule;

import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingTimeKit;
import com.zgiot.zx.meetingroom.dto.MeetingRoomSaveReqDTO;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 会议室字段规范化与校验，纯函数。
 * 规则与文案逐条抄自 apps/meeting/server/src/domain/room.ts，前端按 msg 直接展示。
 */
public final class RoomRules {

    /** 楼层枚举 1层..20层 */
    public static final List<String> FLOOR_OPTIONS;
    /** 可提前预定天数白名单 */
    public static final List<Integer> BOOK_AHEAD = Collections.unmodifiableList(
            Arrays.asList(7, 30, 90, 180));

    static {
        List<String> floors = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            floors.add(i + "层");
        }
        FLOOR_OPTIONS = Collections.unmodifiableList(floors);
    }

    private RoomRules() {
    }

    /**
     * 规范化：去空白、设施去重并按字典顺序排列、补默认值。
     *
     * @param facilityOrder 设施字典的展示顺序，用于排序；不在其中的排最后
     */
    public static RoomDraft normalize(MeetingRoomSaveReqDTO req, List<String> facilityOrder) {
        List<String> unique = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        if (req.getFacilities() != null) {
            for (String item : req.getFacilities()) {
                String value = String.valueOf(item);
                if (seen.add(value)) {
                    unique.add(value);
                }
            }
        }
        unique.sort((a, b) -> {
            int ia = facilityOrder.indexOf(a);
            int ib = facilityOrder.indexOf(b);
            int sa = ia == -1 ? Integer.MAX_VALUE : ia;
            int sb = ib == -1 ? Integer.MAX_VALUE : ib;
            return Integer.compare(sa, sb);
        });

        return new RoomDraft(
                StringUtils.trimToEmpty(req.getName()),
                StringUtils.trimToNull(req.getGroupName()),
                StringUtils.trimToEmpty(req.getBuildingName()),
                StringUtils.trimToEmpty(req.getFloorName()),
                req.getCapacity() == null ? Integer.MIN_VALUE : req.getCapacity(),
                unique,
                StringUtils.trimToNull(req.getLocationNote()),
                StringUtils.isBlank(req.getOpenStart()) ? "07:00" : req.getOpenStart().trim(),
                StringUtils.isBlank(req.getOpenEnd()) ? "23:00" : req.getOpenEnd().trim(),
                req.getBookAheadDays() == null ? 90 : req.getBookAheadDays(),
                Boolean.TRUE.equals(req.getNeedApproval()),
                Boolean.TRUE.equals(req.getAllowRecurring()),
                Boolean.TRUE.equals(req.getAllowPreempt()),
                req.getEnabled() == null || req.getEnabled());
    }

    /**
     * 校验。任何一条不过抛 M4000。
     *
     * @param current 编辑时传原值，允许保留原本已停用的设施与楼宇；新建传 null
     */
    public static void validate(RoomDraft draft, List<String> allFacilities,
                                List<String> enabledFacilities, List<String> enabledBuildings,
                                RoomDraft current) {
        if (StringUtils.isBlank(draft.getName())) {
            throw MeetingBizException.badRequest("请输入名称");
        }
        if (draft.getName().length() > 30) {
            throw MeetingBizException.badRequest("名称不超过 30 个字");
        }
        if (draft.getGroupName() != null && draft.getGroupName().length() > 20) {
            throw MeetingBizException.badRequest("分组不超过 20 个字");
        }
        if (draft.getLocationNote() != null && draft.getLocationNote().length() > 100) {
            throw MeetingBizException.badRequest("备注不超过 100 个字");
        }
        if (StringUtils.isBlank(draft.getBuildingName())) {
            throw MeetingBizException.badRequest("请选择或输入建筑");
        }
        if (!FLOOR_OPTIONS.contains(draft.getFloorName())) {
            throw MeetingBizException.badRequest("请选择楼层");
        }
        if (draft.getCapacity() < 1 || draft.getCapacity() > 999) {
            throw MeetingBizException.badRequest("请输入容纳人数（1-999整数）");
        }

        Integer startMin = MeetingTimeKit.parseHm(draft.getOpenStart());
        Integer endMin = MeetingTimeKit.parseHm(draft.getOpenEnd());
        if (startMin == null || endMin == null) {
            throw MeetingBizException.badRequest("请选择开放时间");
        }
        if (endMin <= startMin) {
            throw MeetingBizException.badRequest("结束时间必须晚于开始时间");
        }
        if (!BOOK_AHEAD.contains(draft.getBookAheadDays())) {
            throw MeetingBizException.badRequest("请选择可提前预定范围");
        }

        Set<String> all = new HashSet<>(allFacilities);
        Set<String> allowed = new HashSet<>(enabledFacilities);
        if (current != null) {
            allowed.addAll(current.getFacilities());
        }
        for (String facility : draft.getFacilities()) {
            if (!all.contains(facility) || !allowed.contains(facility)) {
                throw MeetingBizException.badRequest("存在未知设施");
            }
        }

        boolean buildingOk = current != null
                ? draft.getBuildingName().equals(current.getBuildingName())
                    || enabledBuildings.contains(draft.getBuildingName())
                : enabledBuildings.contains(draft.getBuildingName());
        if (!buildingOk) {
            throw MeetingBizException.badRequest("请选择启用中的建筑");
        }
    }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
mvn -o test -Dtest=RoomRulesTest
```
预期：`Tests run: 16, Failures: 0, Errors: 0`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom/rule src/test/java/com/zgiot/zx/meetingroom/RoomRulesTest.java
git commit -m "feat(meetingroom): 会议室校验规则纯函数与单测"
```

---

### Task 7: 会议室 CRUD 与列表过滤分页

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/MeetingRoomRspDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/MeetingRoomSaveReqDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/PageRsp.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/service/MeetingRoomService.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/controller/MeetingRoomController.java`

**Interfaces:**
- Consumes: `MeetingRoomMapper`、`MeetingUserResolver`、`MeetingBizException`、`MeetingTimeKit`
- Produces: `MeetingRoomService#list(String corpId, String keyword, Boolean enabled, String buildingName, String floorName, int page, int pageSize)` → `PageRsp<MeetingRoomRspDTO>`；`#get(String corpId, String id)` → `MeetingRoomRspDTO`；`#create/#update(String corpId, [String id,] MeetingRoomSaveReqDTO)` → `MeetingRoomRspDTO`；`#setEnabled(String corpId, String id, boolean)` → `MeetingRoomRspDTO`；`#toSnapshot(MeetingRoom)` → `RoomSnapshot`（Task 9 要用）；`#mustGetEnabled(String corpId, String roomId)` → `MeetingRoom`（Task 9 要用，不存在抛 M4004、停用抛 M4000「该会议室已停用」）。

- [ ] **Step 1: 写 DTO**

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** 会议室出参，字段名与 Node 端 RoomRecord 对齐 */
@Getter
@Setter
public class MeetingRoomRspDTO {

    private String id;
    private String corpId;
    private String name;
    private String groupName;
    private String buildingName;
    private String floorName;
    private Integer capacity;
    private List<String> facilities;
    private String locationNote;
    private String openStart;
    private String openEnd;
    private Integer bookAheadDays;
    private Boolean needApproval;
    private Boolean allowRecurring;
    private Boolean allowPreempt;
    private Boolean enabled;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** 会议室新增/修改入参 */
@Getter
@Setter
public class MeetingRoomSaveReqDTO {

    private String name;
    private String groupName;
    private String buildingName;
    private String floorName;
    private Integer capacity;
    private List<String> facilities;
    private String locationNote;
    private String openStart;
    private String openEnd;
    private Integer bookAheadDays;
    private Boolean needApproval;
    private Boolean allowRecurring;
    private Boolean allowPreempt;
    private Boolean enabled;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** 分页出参，字段名与 Node 端一致：list/total/page/pageSize */
@Getter
@Setter
public class PageRsp<T> {

    private List<T> list;
    private Integer total;
    private Integer page;
    private Integer pageSize;

    public PageRsp(List<T> list, int total, int page, int pageSize) {
        this.list = list;
        this.total = total;
        this.page = page;
        this.pageSize = pageSize;
    }
}
```

- [ ] **Step 2: 写 Service**

```java
package com.zgiot.zx.meetingroom.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.zgiot.zx.common.service.BaseService;
import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingTimeKit;
import com.zgiot.zx.meetingroom.dto.MeetingRoomRspDTO;
import com.zgiot.zx.meetingroom.dto.MeetingRoomSaveReqDTO;
import com.zgiot.zx.meetingroom.dto.PageRsp;
import com.zgiot.zx.meetingroom.entity.MeetingRoom;
import com.zgiot.zx.meetingroom.mapper.MeetingRoomMapper;
import com.zgiot.zx.meetingroom.rule.RoomSnapshot;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** 会议室维护 */
@Service
public class MeetingRoomService extends BaseService<MeetingRoom> {

    @Autowired
    private MeetingRoomMapper meetingRoomMapper;

    @Autowired
    private MeetingDictMapper meetingDictMapper;

    /** 列表，支持关键字（名称）、启用状态、楼宇、楼层过滤 */
    public PageRsp<MeetingRoomRspDTO> list(String corpId, String keyword, Boolean enabled,
                                           String buildingName, String floorName,
                                           int page, int pageSize) {
        int size = Math.min(100, Math.max(1, pageSize));
        int current = Math.max(1, page);

        QueryWrapper<MeetingRoom> wrapper = new QueryWrapper<MeetingRoom>()
                .eq(MeetingRoom.TBL_CORPID, corpId);
        if (StringUtils.isNotBlank(keyword)) {
            wrapper.like(MeetingRoom.TBL_NAME, keyword.trim());
        }
        if (enabled != null) {
            wrapper.eq(MeetingRoom.TBL_ENABLED, enabled ? 1 : 0);
        }
        if (StringUtils.isNotBlank(buildingName)) {
            wrapper.eq(MeetingRoom.TBL_BUILDINGNAME, buildingName.trim());
        }
        if (StringUtils.isNotBlank(floorName)) {
            wrapper.eq(MeetingRoom.TBL_FLOORNAME, floorName.trim());
        }
        wrapper.orderByDesc(MeetingRoom.TBL_CREATEAT);

        Page<MeetingRoom> pager = new Page<>(current, size);
        List<MeetingRoom> rows = meetingRoomMapper.selectPage(pager, wrapper).getRecords();
        List<MeetingRoomRspDTO> list = new ArrayList<>();
        for (MeetingRoom row : rows) {
            list.add(toDto(row));
        }
        return new PageRsp<>(list, (int) pager.getTotal(), current, size);
    }

    public MeetingRoomRspDTO get(String corpId, String id) {
        return toDto(mustGet(corpId, id));
    }

    @Transactional(readOnly = false)
    public MeetingRoomRspDTO create(String corpId, MeetingRoomSaveReqDTO req) {
        MeetingRoom room = new MeetingRoom();
        room.setCorpId(corpId);
        applyPayload(corpId, room, req, null);
        this.insert(room);
        return toDto(room);
    }

    @Transactional(readOnly = false)
    public MeetingRoomRspDTO update(String corpId, String id, MeetingRoomSaveReqDTO req) {
        MeetingRoom room = mustGet(corpId, id);
        applyPayload(corpId, room, req, room);
        this.updateById(room);
        return toDto(room);
    }

    @Transactional(readOnly = false)
    public MeetingRoomRspDTO setEnabled(String corpId, String id, boolean enabled) {
        MeetingRoom room = mustGet(corpId, id);
        // 停用的会议室可以重名，重新启用时要再查一次
        if (enabled && existsEnabledName(corpId, room.getName(), id)) {
            throw MeetingBizException.badRequest("已有同名的启用会议室");
        }
        room.setEnabled(enabled ? 1 : 0);
        this.updateById(room);
        return toDto(room);
    }

    /** 预定时用：必须存在且启用 */
    public MeetingRoom mustGetEnabled(String corpId, String roomId) {
        MeetingRoom room = meetingRoomMapper.selectOne(new QueryWrapper<MeetingRoom>()
                .eq("id", roomId)
                .eq(MeetingRoom.TBL_CORPID, corpId));
        if (room == null) {
            throw MeetingBizException.notFound("会议室不存在");
        }
        if (room.getEnabled() == null || room.getEnabled() != 1) {
            throw MeetingBizException.badRequest("该会议室已停用");
        }
        return room;
    }

    /** 转成校验用快照 */
    public RoomSnapshot toSnapshot(MeetingRoom room) {
        return new RoomSnapshot(room.getId(), room.getOpenStart(), room.getOpenEnd(),
                room.getBookAheadDays() == null ? 90 : room.getBookAheadDays(),
                room.getEnabled() != null && room.getEnabled() == 1,
                room.getAllowRecurring() != null && room.getAllowRecurring() == 1);
    }

    public MeetingRoomRspDTO toDto(MeetingRoom room) {
        MeetingRoomRspDTO dto = new MeetingRoomRspDTO();
        dto.setId(room.getId());
        dto.setCorpId(room.getCorpId());
        dto.setName(room.getName());
        dto.setGroupName(room.getGroupName());
        dto.setBuildingName(room.getBuildingName());
        dto.setFloorName(room.getFloorName());
        dto.setCapacity(room.getCapacity());
        dto.setFacilities(parseFacilities(room.getFacilities()));
        dto.setLocationNote(room.getLocationNote());
        dto.setOpenStart(room.getOpenStart());
        dto.setOpenEnd(room.getOpenEnd());
        dto.setBookAheadDays(room.getBookAheadDays());
        dto.setNeedApproval(room.getNeedApproval() != null && room.getNeedApproval() == 1);
        dto.setAllowRecurring(room.getAllowRecurring() != null && room.getAllowRecurring() == 1);
        dto.setAllowPreempt(room.getAllowPreempt() != null && room.getAllowPreempt() == 1);
        dto.setEnabled(room.getEnabled() != null && room.getEnabled() == 1);
        return dto;
    }

    /** facilities 存的是 JSON 数组字符串，解析失败按空数组处理 */
    public static List<String> parseFacilities(String raw) {
        if (StringUtils.isBlank(raw)) {
            return new ArrayList<>();
        }
        try {
            JSONArray array = JSON.parseArray(raw);
            List<String> result = new ArrayList<>();
            for (int i = 0; i < array.size(); i++) {
                result.add(String.valueOf(array.get(i)));
            }
            return result;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private MeetingRoom mustGet(String corpId, String id) {
        MeetingRoom room = meetingRoomMapper.selectOne(new QueryWrapper<MeetingRoom>()
                .eq("id", id)
                .eq(MeetingRoom.TBL_CORPID, corpId));
        if (room == null) {
            throw MeetingBizException.notFound("会议室不存在");
        }
        return room;
    }

    /**
     * 规范化 + 校验 + 落字段。校验逻辑全在 RoomRules（纯函数），这里只负责取字典与查重名。
     *
     * @param existing 编辑时传原实体，新建传 null
     */
    private void applyPayload(String corpId, MeetingRoom room, MeetingRoomSaveReqDTO req, MeetingRoom existing) {
        List<String> allFacilities = dictNames(corpId, MeetingDictService.TYPE_FACILITY, false);
        List<String> enabledFacilities = dictNames(corpId, MeetingDictService.TYPE_FACILITY, true);
        List<String> enabledBuildings = dictNames(corpId, MeetingDictService.TYPE_BUILDING, true);

        RoomDraft draft = RoomRules.normalize(req, allFacilities);
        RoomDraft current = existing == null ? null : toDraft(existing);
        RoomRules.validate(draft, allFacilities, enabledFacilities, enabledBuildings, current);

        // 启用中的会议室不能重名；停用的可以重名
        if (draft.isEnabled() && existsEnabledName(corpId, draft.getName(),
                existing == null ? null : existing.getId())) {
            throw MeetingBizException.badRequest("已有同名的启用会议室");
        }

        room.setName(draft.getName());
        room.setGroupName(draft.getGroupName());
        room.setBuildingName(draft.getBuildingName());
        room.setFloorName(draft.getFloorName());
        room.setCapacity(draft.getCapacity());
        room.setFacilities(JSON.toJSONString(draft.getFacilities()));
        room.setLocationNote(draft.getLocationNote());
        room.setOpenStart(draft.getOpenStart());
        room.setOpenEnd(draft.getOpenEnd());
        room.setBookAheadDays(draft.getBookAheadDays());
        room.setNeedApproval(draft.isNeedApproval() ? 1 : 0);
        room.setAllowRecurring(draft.isAllowRecurring() ? 1 : 0);
        room.setAllowPreempt(draft.isAllowPreempt() ? 1 : 0);
        room.setEnabled(draft.isEnabled() ? 1 : 0);
    }

    /** 取某类字典的名称，按 sort、name 排序；onlyEnabled=true 时只要启用的 */
    private List<String> dictNames(String corpId, String type, boolean onlyEnabled) {
        QueryWrapper<MeetingDict> wrapper = new QueryWrapper<MeetingDict>()
                .eq(MeetingDict.TBL_CORPID, corpId)
                .eq(MeetingDict.TBL_TYPE, type);
        if (onlyEnabled) {
            wrapper.eq(MeetingDict.TBL_ENABLED, 1);
        }
        wrapper.orderByAsc(MeetingDict.TBL_SORT).orderByAsc(MeetingDict.TBL_NAME);
        List<String> names = new ArrayList<>();
        for (MeetingDict dict : meetingDictMapper.selectList(wrapper)) {
            names.add(dict.getName());
        }
        return names;
    }

    private boolean existsEnabledName(String corpId, String name, String excludeId) {
        QueryWrapper<MeetingRoom> wrapper = new QueryWrapper<MeetingRoom>()
                .eq(MeetingRoom.TBL_CORPID, corpId)
                .eq(MeetingRoom.TBL_NAME, name)
                .eq(MeetingRoom.TBL_ENABLED, 1);
        if (StringUtils.isNotBlank(excludeId)) {
            wrapper.ne("id", excludeId);
        }
        Integer count = meetingRoomMapper.selectCount(wrapper);
        return count != null && count > 0;
    }

    private RoomDraft toDraft(MeetingRoom room) {
        return new RoomDraft(room.getName(), room.getGroupName(), room.getBuildingName(),
                room.getFloorName(), room.getCapacity() == null ? 0 : room.getCapacity(),
                parseFacilities(room.getFacilities()), room.getLocationNote(),
                room.getOpenStart(), room.getOpenEnd(),
                room.getBookAheadDays() == null ? 90 : room.getBookAheadDays(),
                room.getNeedApproval() != null && room.getNeedApproval() == 1,
                room.getAllowRecurring() != null && room.getAllowRecurring() == 1,
                room.getAllowPreempt() != null && room.getAllowPreempt() == 1,
                room.getEnabled() != null && room.getEnabled() == 1);
    }
}
```

- [ ] **Step 3: 写 Controller**

```java
package com.zgiot.zx.meetingroom.controller;

import com.zgiot.zx.common.dto.Ret;
import com.zgiot.zx.common.web.BaseController;
import com.zgiot.zx.meetingroom.common.MeetingUserResolver;
import com.zgiot.zx.meetingroom.dto.EnabledReqDTO;
import com.zgiot.zx.meetingroom.dto.MeetingRoomRspDTO;
import com.zgiot.zx.meetingroom.dto.MeetingRoomSaveReqDTO;
import com.zgiot.zx.meetingroom.dto.PageRsp;
import com.zgiot.zx.meetingroom.service.MeetingRoomService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@Api(value = "/meetingRoom/rooms", tags = "会议室维护")
@RestController
@RequestMapping("/meetingRoom/rooms")
@Slf4j
public class MeetingRoomController extends BaseController {

    @Autowired
    private MeetingRoomService meetingRoomService;

    @Autowired
    private MeetingUserResolver userResolver;

    @ApiOperation(value = "会议室列表", notes = "支持关键字/启用状态/楼宇/楼层过滤")
    @GetMapping
    public Ret<PageRsp<MeetingRoomRspDTO>> list(@RequestParam(required = false) String keyword,
                                                @RequestParam(required = false) Boolean enabled,
                                                @RequestParam(required = false) String buildingName,
                                                @RequestParam(required = false) String floorName,
                                                @RequestParam(required = false, defaultValue = "1") int page,
                                                @RequestParam(required = false, defaultValue = "20") int pageSize) {
        String corpId = userResolver.currentCorpId();
        return Ret.ok().setData(meetingRoomService.list(corpId, keyword, enabled,
                buildingName, floorName, page, pageSize));
    }

    @ApiOperation(value = "会议室详情", notes = "会议室详情")
    @GetMapping("/get/{id}")
    public Ret<MeetingRoomRspDTO> get(@PathVariable("id") String id) {
        String corpId = userResolver.currentCorpId();
        return Ret.ok().setData(meetingRoomService.get(corpId, id));
    }

    @ApiOperation(value = "新增会议室", notes = "新增会议室")
    @PostMapping("/create")
    public Ret<MeetingRoomRspDTO> create(@RequestBody MeetingRoomSaveReqDTO req) {
        String corpId = userResolver.currentCorpId();
        return Ret.ok().setData(meetingRoomService.create(corpId, req));
    }

    @ApiOperation(value = "修改会议室", notes = "修改会议室")
    @PostMapping("/update/{id}")
    public Ret<MeetingRoomRspDTO> update(@PathVariable("id") String id,
                                         @RequestBody MeetingRoomSaveReqDTO req) {
        String corpId = userResolver.currentCorpId();
        return Ret.ok().setData(meetingRoomService.update(corpId, id, req));
    }

    @ApiOperation(value = "启用停用会议室", notes = "启用停用会议室")
    @PostMapping("/enabled/{id}")
    public Ret<MeetingRoomRspDTO> setEnabled(@PathVariable("id") String id,
                                             @RequestBody EnabledReqDTO req) {
        String corpId = userResolver.currentCorpId();
        boolean enabled = req.getEnabled() != null && req.getEnabled();
        return Ret.ok().setData(meetingRoomService.setEnabled(corpId, id, enabled));
    }
}
```

- [ ] **Step 4: 重启并 curl 验收**

```bash
mvn -o -DskipTests clean package && \
java "-DsocksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
  -jar target/zx-contact-1.0.0.jar --eureka.client.register-with-eureka=false > /tmp/contact-run.log 2>&1 &
sleep 90

curl -s --noproxy '*' -X POST -H "Content-Type: application/json" \
  -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  -d '{"name":"A401","buildingName":"奥城","floorName":"4层","capacity":10,"facilities":["电视","白板"],"openStart":"08:00","openEnd":"22:00","bookAheadDays":30,"allowRecurring":true,"enabled":true}' \
  "http://127.0.0.1:7004/meetingRoom/rooms/create"
```
预期：`M0000`，`data.facilities` 是 `["电视","白板"]` 数组（不是字符串），`data.enabled` 为 `true`。

```bash
curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/rooms?keyword=A4&enabled=true&page=1&pageSize=20"
```
预期：`data.total` ≥ 1，`data.list[0].name` 为 `A401`。

再验一次越权隔离——换个 corpId 查同一个 id：

```bash
curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 7" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/rooms/get/<刚建的id>"
```
预期：`{"code":"M4004","msg":"会议室不存在"}`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom
git commit -m "feat(meetingroom): 会议室 CRUD 与列表过滤分页"
```

---

### Task 8: 看板 board

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/BoardRspDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/BoardRoomDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/BoardEventDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/service/BoardService.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/controller/BoardController.java`

**Interfaces:**
- Consumes: `MeetingRoomMapper`、`MeetingBookingMapper`、`MeetingDictService`、`MeetingRoomService`、`MeetingUserResolver`、`MeetingTimeKit`
- Produces: `BoardService#board(String corpId, String date, String userId)` → `BoardRspDTO`（含 `List<String> facilityOptions` 与 `List<BoardRoomDTO> rooms`，每个房间带 `List<BoardEventDTO> busyEvents`）。

- [ ] **Step 1: 写 DTO**

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** 看板出参 */
@Getter
@Setter
public class BoardRspDTO {

    /** 可选设施，取自启用的 facility 字典 */
    private List<String> facilityOptions;
    private List<BoardRoomDTO> rooms;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** 看板里的一间会议室 */
@Getter
@Setter
public class BoardRoomDTO {

    private String id;
    private String name;
    private String groupName;
    private String buildingName;
    private String floorName;
    private Integer capacity;
    private List<String> facilities;
    private String locationNote;
    private String openStart;
    private String openEnd;
    private Integer bookAheadDays;
    private Boolean needApproval;
    private Boolean allowRecurring;
    private Boolean allowPreempt;
    /** 当日已占用时段 */
    private List<BoardEventDTO> busyEvents;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

/** 看板上的一条占用 */
@Getter
@Setter
public class BoardEventDTO {

    private String id;
    /** HH:mm */
    private String start;
    private String end;
    private String title;
    /** 预定人姓名 */
    private String host;
    private String dept;
    /** 是否本人预定 */
    private Boolean mine;
}
```

- [ ] **Step 2: 写 Service**

```java
package com.zgiot.zx.meetingroom.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingTimeKit;
import com.zgiot.zx.meetingroom.dto.BoardEventDTO;
import com.zgiot.zx.meetingroom.dto.BoardRoomDTO;
import com.zgiot.zx.meetingroom.dto.BoardRspDTO;
import com.zgiot.zx.meetingroom.entity.MeetingBooking;
import com.zgiot.zx.meetingroom.entity.MeetingDict;
import com.zgiot.zx.meetingroom.entity.MeetingRoom;
import com.zgiot.zx.meetingroom.mapper.MeetingBookingMapper;
import com.zgiot.zx.meetingroom.mapper.MeetingDictMapper;
import com.zgiot.zx.meetingroom.mapper.MeetingRoomMapper;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** 预定看板：某一天所有启用会议室 + 当日占用 */
@Service
public class BoardService {

    /** 中文排序，别用默认字典序 */
    private static final Collator ZH = Collator.getInstance(Locale.CHINA);

    @Autowired
    private MeetingRoomMapper meetingRoomMapper;

    @Autowired
    private MeetingBookingMapper meetingBookingMapper;

    @Autowired
    private MeetingDictMapper meetingDictMapper;

    @Autowired
    private MeetingDictService meetingDictService;

    @Autowired
    private MeetingRoomService meetingRoomService;

    public BoardRspDTO board(String corpId, String date, String userId) {
        if (!MeetingTimeKit.isDate(StringUtils.trimToEmpty(date))) {
            throw MeetingBizException.badRequest("请选择日期");
        }
        meetingDictService.ensureDefaults(corpId);

        List<MeetingDict> facilityDicts = meetingDictMapper.selectList(new QueryWrapper<MeetingDict>()
                .eq(MeetingDict.TBL_CORPID, corpId)
                .eq(MeetingDict.TBL_TYPE, MeetingDictService.TYPE_FACILITY)
                .eq(MeetingDict.TBL_ENABLED, 1)
                .orderByAsc(MeetingDict.TBL_SORT)
                .orderByAsc(MeetingDict.TBL_NAME));
        List<String> facilityOptions = new ArrayList<>();
        for (MeetingDict dict : facilityDicts) {
            facilityOptions.add(dict.getName());
        }

        List<MeetingRoom> rooms = meetingRoomMapper.selectList(new QueryWrapper<MeetingRoom>()
                .eq(MeetingRoom.TBL_CORPID, corpId)
                .eq(MeetingRoom.TBL_ENABLED, 1));

        // 已释放的不占位
        List<MeetingBooking> bookings = meetingBookingMapper.selectList(new QueryWrapper<MeetingBooking>()
                .eq(MeetingBooking.TBL_CORPID, corpId)
                .eq(MeetingBooking.TBL_DATE, date)
                .isNull(MeetingBooking.TBL_RELEASEDAT)
                .orderByAsc(MeetingBooking.TBL_STARTMIN));

        Map<String, List<BoardEventDTO>> eventsByRoom = new HashMap<>();
        for (MeetingBooking booking : bookings) {
            BoardEventDTO event = new BoardEventDTO();
            event.setId(booking.getId());
            event.setStart(MeetingTimeKit.fromMinutes(booking.getStartMin()));
            event.setEnd(MeetingTimeKit.fromMinutes(booking.getEndMin()));
            event.setTitle(booking.getTitle());
            event.setHost(booking.getHostUserName());
            event.setDept(booking.getHostDept());
            event.setMine(StringUtils.isNotBlank(userId) && userId.equals(booking.getHostUserId()));
            eventsByRoom.computeIfAbsent(booking.getRoomId(), key -> new ArrayList<>()).add(event);
        }

        List<BoardRoomDTO> result = new ArrayList<>();
        for (MeetingRoom room : rooms) {
            BoardRoomDTO dto = new BoardRoomDTO();
            dto.setId(room.getId());
            dto.setName(room.getName());
            dto.setGroupName(room.getGroupName());
            dto.setBuildingName(room.getBuildingName());
            dto.setFloorName(room.getFloorName());
            dto.setCapacity(room.getCapacity());
            dto.setFacilities(MeetingRoomService.parseFacilities(room.getFacilities()));
            dto.setLocationNote(room.getLocationNote());
            dto.setOpenStart(room.getOpenStart());
            dto.setOpenEnd(room.getOpenEnd());
            dto.setBookAheadDays(room.getBookAheadDays());
            dto.setNeedApproval(room.getNeedApproval() != null && room.getNeedApproval() == 1);
            dto.setAllowRecurring(room.getAllowRecurring() != null && room.getAllowRecurring() == 1);
            dto.setAllowPreempt(room.getAllowPreempt() != null && room.getAllowPreempt() == 1);
            List<BoardEventDTO> events = eventsByRoom.get(room.getId());
            dto.setBusyEvents(events == null ? new ArrayList<>() : events);
            result.add(dto);
        }

        // 楼宇 → 楼层 → 名称，中文排序
        result.sort(Comparator
                .comparing(BoardRoomDTO::getBuildingName, ZH)
                .thenComparing(BoardRoomDTO::getFloorName, ZH)
                .thenComparing(BoardRoomDTO::getName, ZH));

        BoardRspDTO rsp = new BoardRspDTO();
        rsp.setFacilityOptions(facilityOptions);
        rsp.setRooms(result);
        return rsp;
    }
}
```

- [ ] **Step 3: 写 Controller**

```java
package com.zgiot.zx.meetingroom.controller;

import com.zgiot.zx.common.dto.Ret;
import com.zgiot.zx.common.web.BaseController;
import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingCurrentUser;
import com.zgiot.zx.meetingroom.common.MeetingUserResolver;
import com.zgiot.zx.meetingroom.dto.BoardRspDTO;
import com.zgiot.zx.meetingroom.service.BoardService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Api(value = "/meetingRoom/board", tags = "会议室看板")
@RestController
@RequestMapping("/meetingRoom")
@Slf4j
public class BoardController extends BaseController {

    @Autowired
    private BoardService boardService;

    @Autowired
    private MeetingUserResolver userResolver;

    @ApiOperation(value = "看板", notes = "某一天所有启用会议室与占用情况")
    @GetMapping("/board")
    public Ret<BoardRspDTO> board(@RequestParam String date) {
        String corpId = userResolver.currentCorpId();
        // 未登录成员也允许看板只读，拿不到 userId 时 mine 恒为 false
        String userId = "";
        try {
            MeetingCurrentUser user = userResolver.current();
            userId = user.getUserId();
        } catch (MeetingBizException ignored) {
            log.debug("看板匿名访问，mine 标记不生效");
        }
        return Ret.ok().setData(boardService.board(corpId, date, userId));
    }
}
```

- [ ] **Step 4: 重启并 curl 验收**

```bash
mvn -o -DskipTests clean package && \
java "-DsocksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
  -jar target/zx-contact-1.0.0.jar --eureka.client.register-with-eureka=false > /tmp/contact-run.log 2>&1 &
sleep 90

curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/board?date=2026-09-01"
```
预期：`data.facilityOptions` 含「电视/白板/投影」，`data.rooms[0].busyEvents` 为 `[]`，`data.rooms` 按楼宇→楼层→名称排序。

```bash
curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/board?date=20260901"
```
预期：`{"code":"M4000","msg":"请选择日期"}`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom
git commit -m "feat(meetingroom): 预定看板与中文排序"
```

---

### Task 9: 预定创建（多日/循环批次事务 + 审计）

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/BookingCreateReqDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/BookingRspDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/service/BookingService.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/controller/BookingController.java`

**Interfaces:**
- Consumes: `BookingRules`、`MeetingRoomService#mustGetEnabled/#toSnapshot`、`MeetingBookingMapper`、`MeetingBookingAuditMapper`、`MeetingUserResolver`、`MeetingTimeKit`
- Produces: `BookingService#create(MeetingCurrentUser user, BookingCreateReqDTO req)` → `BookingRspDTO`（`items` 字段带本批次全部预定）；`BookingService#findOverlap(String corpId, String roomId, String date, int startMin, int endMin, String excludeId)` → `MeetingBooking`（无冲突返回 null，Task 10 复用）；`BookingService#writeAudit(MeetingCurrentUser user, MeetingBooking booking, String action, String detailJson)` → `void`。

- [ ] **Step 1: 写 DTO**

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** 预定入参，与 Node 端 BookingPayload 对齐 */
@Getter
@Setter
public class BookingCreateReqDTO {

    private String roomId;
    /** yyyy-MM-dd，首日 */
    private String date;
    /** HH:mm */
    private String start;
    private String end;
    private String title;
    private String remark;
    /** 多日预定的日期列表，与 repeatWeekly 互斥，最多 5 天 */
    private List<String> dates;
    /** 每周重复 */
    private Boolean repeatWeekly;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** 预定出参；创建接口的 items 带本批次全部记录，单条预定时 items 只有一条 */
@Getter
@Setter
public class BookingRspDTO {

    private String id;
    private String corpId;
    private String roomId;
    private String date;
    private String start;
    private String end;
    private Integer startMin;
    private Integer endMin;
    private String title;
    private String remark;
    private String hostUserId;
    private String hostUserName;
    private String hostDept;
    private String seriesId;
    private String releasedAt;
    private List<BookingRspDTO> items;
}
```

- [ ] **Step 2: 写 Service**

```java
package com.zgiot.zx.meetingroom.service;

import com.alibaba.fastjson.JSON;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.zgiot.zx.common.service.BaseService;
import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingCurrentUser;
import com.zgiot.zx.meetingroom.common.MeetingTimeKit;
import com.zgiot.zx.meetingroom.dto.BookingCreateReqDTO;
import com.zgiot.zx.meetingroom.dto.BookingRspDTO;
import com.zgiot.zx.meetingroom.entity.MeetingBooking;
import com.zgiot.zx.meetingroom.entity.MeetingBookingAudit;
import com.zgiot.zx.meetingroom.entity.MeetingRoom;
import com.zgiot.zx.meetingroom.mapper.MeetingBookingAuditMapper;
import com.zgiot.zx.meetingroom.mapper.MeetingBookingMapper;
import com.zgiot.zx.meetingroom.rule.BookingRules;
import com.zgiot.zx.meetingroom.rule.RoomSnapshot;
import com.zgiot.zx.meetingroom.rule.SlotDraft;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 预定的创建与冲突检测 */
@Service
public class BookingService extends BaseService<MeetingBooking> {

    /** 审计动作 */
    public static final String ACTION_CREATE = "create";
    public static final String ACTION_UPDATE = "update";
    public static final String ACTION_RELEASE = "release";

    @Autowired
    private MeetingBookingMapper meetingBookingMapper;

    @Autowired
    private MeetingBookingAuditMapper meetingBookingAuditMapper;

    @Autowired
    private MeetingRoomService meetingRoomService;

    /**
     * 创建预定。多日/循环整批一个事务，任一天冲突则整批回滚，不允许部分成功。
     */
    @Transactional(readOnly = false, rollbackFor = Exception.class)
    public BookingRspDTO create(MeetingCurrentUser user, BookingCreateReqDTO req) {
        String corpId = user.getCorpId();
        MeetingRoom room = meetingRoomService.mustGetEnabled(corpId, req.getRoomId());
        RoomSnapshot snapshot = meetingRoomService.toSnapshot(room);

        String nowDate = MeetingTimeKit.today();
        int nowMinute = MeetingTimeKit.nowMinute();

        // 先校验首日，拿到规范化后的主题与备注
        SlotDraft first = BookingRules.validateSlot(snapshot, req.getDate(), req.getStart(), req.getEnd(),
                req.getTitle(), req.getRemark(), user.getUserName(), nowDate, nowMinute);

        List<String> dates = BookingRules.resolveDates(snapshot, first.getDate(), req.getDates(),
                Boolean.TRUE.equals(req.getRepeatWeekly()), nowDate);

        List<SlotDraft> slots = new ArrayList<>();
        for (String date : dates) {
            SlotDraft slot = BookingRules.validateSlot(snapshot, date, req.getStart(), req.getEnd(),
                    req.getTitle(), req.getRemark(), user.getUserName(), nowDate, nowMinute);
            if (findOverlap(corpId, room.getId(), slot.getDate(), slot.getStartMin(), slot.getEndMin(), null) != null) {
                throw MeetingBizException.conflict("该时段已被占用");
            }
            slots.add(slot);
        }

        String seriesId = slots.size() > 1 ? String.valueOf(IdWorker.getId()) : null;
        List<MeetingBooking> saved = new ArrayList<>();
        for (SlotDraft slot : slots) {
            MeetingBooking booking = new MeetingBooking();
            booking.setCorpId(corpId);
            booking.setRoomId(room.getId());
            booking.setDate(slot.getDate());
            booking.setStartMin(slot.getStartMin());
            booking.setEndMin(slot.getEndMin());
            booking.setTitle(slot.getTitle());
            booking.setRemark(slot.getRemark());
            booking.setHostUserId(user.getUserId());
            booking.setHostUserName(user.getUserName());
            booking.setHostDept(user.getDept());
            booking.setSeriesId(seriesId);
            this.insert(booking);
            saved.add(booking);

            Map<String, Object> detail = new HashMap<>();
            detail.put("date", slot.getDate());
            detail.put("start", MeetingTimeKit.fromMinutes(slot.getStartMin()));
            detail.put("end", MeetingTimeKit.fromMinutes(slot.getEndMin()));
            detail.put("roomId", room.getId());
            detail.put("title", slot.getTitle());
            detail.put("series", seriesId != null);
            writeAudit(user, booking, ACTION_CREATE, JSON.toJSONString(detail));
        }

        List<BookingRspDTO> items = new ArrayList<>();
        for (MeetingBooking booking : saved) {
            items.add(toDto(booking));
        }
        BookingRspDTO result = items.get(0);
        result.setItems(items);
        return result;
    }

    /**
     * 找同一会议室同一天的重叠预定；已释放的不算。
     *
     * @param excludeId 修改时排除自身，创建时传 null
     */
    public MeetingBooking findOverlap(String corpId, String roomId, String date,
                                      int startMin, int endMin, String excludeId) {
        QueryWrapper<MeetingBooking> wrapper = new QueryWrapper<MeetingBooking>()
                .eq(MeetingBooking.TBL_CORPID, corpId)
                .eq(MeetingBooking.TBL_ROOMID, roomId)
                .eq(MeetingBooking.TBL_DATE, date)
                .isNull(MeetingBooking.TBL_RELEASEDAT);
        if (StringUtils.isNotBlank(excludeId)) {
            wrapper.ne("id", excludeId);
        }
        List<MeetingBooking> rows = meetingBookingMapper.selectList(wrapper);
        for (MeetingBooking row : rows) {
            if (BookingRules.overlaps(startMin, endMin, row.getStartMin(), row.getEndMin())) {
                return row;
            }
        }
        return null;
    }

    /** 写一条审计 */
    public void writeAudit(MeetingCurrentUser user, MeetingBooking booking, String action, String detailJson) {
        MeetingBookingAudit audit = new MeetingBookingAudit();
        audit.setCorpId(booking.getCorpId());
        audit.setBookingId(booking.getId());
        audit.setSeriesId(booking.getSeriesId());
        audit.setAction(action);
        audit.setActorUserId(user.getUserId());
        audit.setActorUserName(user.getUserName());
        audit.setDetail(detailJson);
        MeetingBookingAuditService.insertBy(meetingBookingAuditMapper, audit);
    }

    public BookingRspDTO toDto(MeetingBooking booking) {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        BookingRspDTO dto = new BookingRspDTO();
        dto.setId(booking.getId());
        dto.setCorpId(booking.getCorpId());
        dto.setRoomId(booking.getRoomId());
        dto.setDate(booking.getDate());
        dto.setStart(MeetingTimeKit.fromMinutes(booking.getStartMin()));
        dto.setEnd(MeetingTimeKit.fromMinutes(booking.getEndMin()));
        dto.setStartMin(booking.getStartMin());
        dto.setEndMin(booking.getEndMin());
        dto.setTitle(booking.getTitle());
        dto.setRemark(booking.getRemark());
        dto.setHostUserId(booking.getHostUserId());
        dto.setHostUserName(booking.getHostUserName());
        dto.setHostDept(booking.getHostDept());
        dto.setSeriesId(booking.getSeriesId());
        dto.setReleasedAt(booking.getReleasedAt() == null ? null : fmt.format(booking.getReleasedAt()));
        return dto;
    }
}
```

审计表也要走 `BaseService` 才能自动补 id 与审计字段，补一个极薄的 service：

`src/main/java/com/zgiot/zx/meetingroom/service/MeetingBookingAuditService.java`

```java
package com.zgiot.zx.meetingroom.service;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zgiot.zx.common.entity.EntityKit;
import com.zgiot.zx.meetingroom.entity.MeetingBookingAudit;

/** 审计写入。EntityKit 负责补雪花id与创建人/时间 */
public final class MeetingBookingAuditService {

    private MeetingBookingAuditService() {
    }

    public static void insertBy(BaseMapper<MeetingBookingAudit> mapper, MeetingBookingAudit audit) {
        EntityKit.preCreateWithOverrideAll(audit);
        mapper.insert(audit);
    }
}
```

- [ ] **Step 3: 写 Controller**

```java
package com.zgiot.zx.meetingroom.controller;

import com.zgiot.zx.common.dto.Ret;
import com.zgiot.zx.common.web.BaseController;
import com.zgiot.zx.meetingroom.common.MeetingCurrentUser;
import com.zgiot.zx.meetingroom.common.MeetingUserResolver;
import com.zgiot.zx.meetingroom.dto.BookingCreateReqDTO;
import com.zgiot.zx.meetingroom.dto.BookingRspDTO;
import com.zgiot.zx.meetingroom.service.BookingService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Api(value = "/meetingRoom/bookings", tags = "会议室预定")
@RestController
@RequestMapping("/meetingRoom/bookings")
@Slf4j
public class BookingController extends BaseController {

    @Autowired
    private BookingService bookingService;

    @Autowired
    private MeetingUserResolver userResolver;

    @ApiOperation(value = "创建预定", notes = "支持多日 dates 与每周重复 repeatWeekly，整批事务")
    @PostMapping("/create")
    public Ret<BookingRspDTO> create(@RequestBody BookingCreateReqDTO req) {
        MeetingCurrentUser user = userResolver.current();
        return Ret.ok().setData(bookingService.create(user, req));
    }
}
```

- [ ] **Step 4: 重启并 curl 验收（含冲突与整批回滚）**

```bash
mvn -o -DskipTests clean package && \
java "-DsocksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
  -jar target/zx-contact-1.0.0.jar --eureka.client.register-with-eureka=false > /tmp/contact-run.log 2>&1 &
sleep 90

# 1. 正常单条
curl -s --noproxy '*' -X POST -H "Content-Type: application/json" \
  -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  -d '{"roomId":"<roomId>","date":"2026-09-02","start":"09:00","end":"10:00"}' \
  "http://127.0.0.1:7004/meetingRoom/bookings/create"
```
预期：`M0000`，`data.seriesId` 为 `null`，`data.items` 长度 1，`data.title` 为「<你的姓名>预定的会议」。

```bash
# 2. 同一时段再来一次 → 冲突
curl -s --noproxy '*' -X POST -H "Content-Type: application/json" \
  -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  -d '{"roomId":"<roomId>","date":"2026-09-02","start":"09:30","end":"10:30"}' \
  "http://127.0.0.1:7004/meetingRoom/bookings/create"
```
预期：`{"code":"M4010","msg":"该时段已被占用"}`。

```bash
# 3. 多日，其中一天与上面冲突 → 整批失败，且不留残留
curl -s --noproxy '*' -X POST -H "Content-Type: application/json" \
  -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  -d '{"roomId":"<roomId>","date":"2026-09-03","start":"09:00","end":"10:00","dates":["2026-09-02","2026-09-03"]}' \
  "http://127.0.0.1:7004/meetingRoom/bookings/create"
```
预期：`M4010`；随后查 `2026-09-03` 的看板，`busyEvents` 必须为空（证明整批回滚）：
```bash
curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/board?date=2026-09-03"
```

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom
git commit -m "feat(meetingroom): 预定创建、冲突检测与批次事务"
```

---

### Task 10: 我的预定、修改、释放、审计查询

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/BookingUpdateReqDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/BookingMineDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/BookingAuditRspDTO.java`
- Modify: `src/main/java/com/zgiot/zx/meetingroom/service/BookingService.java`
- Modify: `src/main/java/com/zgiot/zx/meetingroom/controller/BookingController.java`

**Interfaces:**
- Consumes: Task 9 的 `BookingService#findOverlap/#writeAudit/#toDto`、`MeetingAdminChecker`（Task 11 才有实现，本任务先只按「本人可见」实现，Task 11 再接管理员）
- Produces: `BookingService#listMine(MeetingCurrentUser)` → `List<BookingMineDTO>`；`#update(MeetingCurrentUser, String id, BookingUpdateReqDTO)` → `BookingRspDTO`；`#release(MeetingCurrentUser, String id)` → `BookingRspDTO`；`#listAudits(MeetingCurrentUser, String bookingId, boolean isAdmin)` → `List<BookingAuditRspDTO>`；`#mustGetOwn(String corpId, String userId, String id)` → `MeetingBooking`（非本人回 M4004）。

- [ ] **Step 1: 写 DTO**

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

/** 修改预定入参，只能改时间、主题、备注，不能换会议室 */
@Getter
@Setter
public class BookingUpdateReqDTO {

    private String date;
    private String start;
    private String end;
    private String title;
    private String remark;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

/** 我的预定 / 管理员列表的一行 */
@Getter
@Setter
public class BookingMineDTO {

    private String id;
    private String roomId;
    private String roomName;
    private String buildingName;
    private String floorName;
    private String title;
    private String date;
    private String start;
    private String end;
    private String remark;
    private String seriesId;
    /** upcoming-未开始 ongoing-进行中 finished-已结束 released-已释放 */
    private String status;
    /** 管理员列表才有值 */
    private String hostUserId;
    private String hostUserName;
    private String hostDept;
}
```

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

/** 审计记录 */
@Getter
@Setter
public class BookingAuditRspDTO {

    private String id;
    private String bookingId;
    private String seriesId;
    private String action;
    private String actorUserId;
    private String actorUserName;
    private String detail;
    private String createdAt;
}
```

- [ ] **Step 2: 给 BookingService 加方法**

在 `BookingService` 里追加（其余保持不变）：

```java
    /** 我的预定，按日期倒序 */
    public List<BookingMineDTO> listMine(MeetingCurrentUser user) {
        List<MeetingBooking> rows = meetingBookingMapper.selectList(new QueryWrapper<MeetingBooking>()
                .eq(MeetingBooking.TBL_CORPID, user.getCorpId())
                .eq(MeetingBooking.TBL_HOSTUSERID, user.getUserId())
                .orderByDesc(MeetingBooking.TBL_DATE)
                .orderByDesc(MeetingBooking.TBL_STARTMIN));
        return toMineList(user.getCorpId(), rows);
    }

    /** 修改预定：只能改本人的、未结束的；不能换会议室 */
    @Transactional(readOnly = false, rollbackFor = Exception.class)
    public BookingRspDTO update(MeetingCurrentUser user, String id, BookingUpdateReqDTO req) {
        MeetingBooking booking = mustGetOwn(user.getCorpId(), user.getUserId(), id);
        assertEditable(booking);

        MeetingRoom room = meetingRoomService.mustGetEnabled(user.getCorpId(), booking.getRoomId());
        RoomSnapshot snapshot = meetingRoomService.toSnapshot(room);
        SlotDraft slot = BookingRules.validateSlot(snapshot, req.getDate(), req.getStart(), req.getEnd(),
                req.getTitle(), req.getRemark(), user.getUserName(),
                MeetingTimeKit.today(), MeetingTimeKit.nowMinute());

        if (findOverlap(user.getCorpId(), booking.getRoomId(), slot.getDate(),
                slot.getStartMin(), slot.getEndMin(), booking.getId()) != null) {
            throw MeetingBizException.conflict("该时段已被占用");
        }

        Map<String, Object> detail = new HashMap<>();
        detail.put("from", booking.getDate() + " " + MeetingTimeKit.fromMinutes(booking.getStartMin())
                + "-" + MeetingTimeKit.fromMinutes(booking.getEndMin()));
        detail.put("to", slot.getDate() + " " + MeetingTimeKit.fromMinutes(slot.getStartMin())
                + "-" + MeetingTimeKit.fromMinutes(slot.getEndMin()));
        detail.put("title", slot.getTitle());

        booking.setDate(slot.getDate());
        booking.setStartMin(slot.getStartMin());
        booking.setEndMin(slot.getEndMin());
        booking.setTitle(slot.getTitle());
        booking.setRemark(slot.getRemark());
        this.updateById(booking);

        writeAudit(user, booking, ACTION_UPDATE, JSON.toJSONString(detail));
        return toDto(booking);
    }

    /** 释放：软删除，置 releasedAt */
    @Transactional(readOnly = false, rollbackFor = Exception.class)
    public BookingRspDTO release(MeetingCurrentUser user, String id) {
        MeetingBooking booking = mustGetOwn(user.getCorpId(), user.getUserId(), id);
        if (booking.getReleasedAt() != null) {
            return toDto(booking);
        }
        assertReleasable(booking);

        booking.setReleasedAt(new Date());
        this.updateById(booking);

        Map<String, Object> detail = new HashMap<>();
        detail.put("date", booking.getDate());
        detail.put("start", MeetingTimeKit.fromMinutes(booking.getStartMin()));
        detail.put("end", MeetingTimeKit.fromMinutes(booking.getEndMin()));
        writeAudit(user, booking, ACTION_RELEASE, JSON.toJSONString(detail));
        return toDto(booking);
    }

    /** 审计：本人或管理员可看 */
    public List<BookingAuditRspDTO> listAudits(MeetingCurrentUser user, String bookingId, boolean isAdmin) {
        MeetingBooking booking = meetingBookingMapper.selectOne(new QueryWrapper<MeetingBooking>()
                .eq("id", bookingId)
                .eq(MeetingBooking.TBL_CORPID, user.getCorpId()));
        if (booking == null) {
            throw MeetingBizException.notFound("预定不存在");
        }
        if (!isAdmin && !user.getUserId().equals(booking.getHostUserId())) {
            throw MeetingBizException.noPermission("无权限查看审计");
        }

        List<MeetingBookingAudit> rows = meetingBookingAuditMapper.selectList(
                new QueryWrapper<MeetingBookingAudit>()
                        .eq(MeetingBookingAudit.TBL_CORPID, user.getCorpId())
                        .eq(MeetingBookingAudit.TBL_BOOKINGID, bookingId)
                        .orderByAsc(MeetingBookingAudit.TBL_CREATEAT));

        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        List<BookingAuditRspDTO> result = new ArrayList<>();
        for (MeetingBookingAudit row : rows) {
            BookingAuditRspDTO dto = new BookingAuditRspDTO();
            dto.setId(row.getId());
            dto.setBookingId(row.getBookingId());
            dto.setSeriesId(row.getSeriesId());
            dto.setAction(row.getAction());
            dto.setActorUserId(row.getActorUserId());
            dto.setActorUserName(row.getActorUserName());
            dto.setDetail(row.getDetail());
            dto.setCreatedAt(row.getCreateAt() == null ? null : fmt.format(row.getCreateAt()));
            result.add(dto);
        }
        return result;
    }

    /**
     * 必须是本企业、且是本人的预定。
     * 注意：非本人一律回 M4004「预定不存在」而不是 M4003，
     * 与 Node 端一致（booking.ts 的 host_user_id 校验），避免泄漏他人预定的存在性。
     */
    public MeetingBooking mustGetOwn(String corpId, String userId, String id) {
        MeetingBooking booking = meetingBookingMapper.selectOne(new QueryWrapper<MeetingBooking>()
                .eq("id", id)
                .eq(MeetingBooking.TBL_CORPID, corpId));
        if (booking == null || !StringUtils.equals(booking.getHostUserId(), userId)) {
            throw MeetingBizException.notFound("预定不存在");
        }
        return booking;
    }

    /** 已结束不能改 */
    private void assertEditable(MeetingBooking booking) {
        if (isFinished(booking)) {
            throw MeetingBizException.badRequest("该预定已结束，无法修改");
        }
    }

    /** 已结束不能释放 */
    private void assertReleasable(MeetingBooking booking) {
        if (isFinished(booking)) {
            throw MeetingBizException.badRequest("该预定已结束，无法释放");
        }
    }

    private boolean isFinished(MeetingBooking booking) {
        String today = MeetingTimeKit.today();
        int nowMinute = MeetingTimeKit.nowMinute();
        if (booking.getDate().compareTo(today) < 0) {
            return true;
        }
        return booking.getDate().equals(today) && booking.getEndMin() <= nowMinute;
    }

    /** 补上会议室信息与状态 */
    public List<BookingMineDTO> toMineList(String corpId, List<MeetingBooking> rows) {
        List<BookingMineDTO> result = new ArrayList<>();
        if (rows.isEmpty()) {
            return result;
        }
        Set<String> roomIds = new HashSet<>();
        for (MeetingBooking row : rows) {
            roomIds.add(row.getRoomId());
        }
        Map<String, MeetingRoom> roomMap = new HashMap<>();
        for (MeetingRoom room : meetingRoomService.listByIds(corpId, roomIds)) {
            roomMap.put(room.getId(), room);
        }

        String today = MeetingTimeKit.today();
        int nowMinute = MeetingTimeKit.nowMinute();
        for (MeetingBooking row : rows) {
            MeetingRoom room = roomMap.get(row.getRoomId());
            BookingMineDTO dto = new BookingMineDTO();
            dto.setId(row.getId());
            dto.setRoomId(row.getRoomId());
            dto.setRoomName(room == null ? "" : room.getName());
            dto.setBuildingName(room == null ? "" : room.getBuildingName());
            dto.setFloorName(room == null ? "" : room.getFloorName());
            dto.setTitle(row.getTitle());
            dto.setDate(row.getDate());
            dto.setStart(MeetingTimeKit.fromMinutes(row.getStartMin()));
            dto.setEnd(MeetingTimeKit.fromMinutes(row.getEndMin()));
            dto.setRemark(row.getRemark());
            dto.setSeriesId(row.getSeriesId());
            dto.setStatus(resolveStatus(row, today, nowMinute));
            result.add(dto);
        }
        return result;
    }

    private String resolveStatus(MeetingBooking row, String today, int nowMinute) {
        if (row.getReleasedAt() != null) {
            return "released";
        }
        if (row.getDate().compareTo(today) < 0) {
            return "finished";
        }
        if (row.getDate().compareTo(today) > 0) {
            return "upcoming";
        }
        if (row.getEndMin() <= nowMinute) {
            return "finished";
        }
        return row.getStartMin() <= nowMinute ? "ongoing" : "upcoming";
    }
```

同时给 `MeetingRoomService` 补一个批量取会议室的方法：

```java
    /** 按 id 批量取本企业会议室（含已停用，历史预定要显示名称） */
    public List<MeetingRoom> listByIds(String corpId, java.util.Collection<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return new ArrayList<>();
        }
        return meetingRoomMapper.selectList(new QueryWrapper<MeetingRoom>()
                .eq(MeetingRoom.TBL_CORPID, corpId)
                .in("id", ids));
    }
```

新增的 import（加到 `BookingService` 顶部）：`java.util.Date`、`java.util.Set`、`java.util.HashSet`、`com.zgiot.zx.meetingroom.dto.BookingAuditRspDTO`、`BookingMineDTO`、`BookingUpdateReqDTO`。

- [ ] **Step 3: 给 BookingController 加接口**

```java
    @ApiOperation(value = "我的预定", notes = "按日期倒序")
    @GetMapping("/mine")
    public Ret<List<BookingMineDTO>> mine() {
        MeetingCurrentUser user = userResolver.current();
        return Ret.ok().setData(bookingService.listMine(user));
    }

    @ApiOperation(value = "修改预定", notes = "只能改本人未结束的预定")
    @PostMapping("/update/{id}")
    public Ret<BookingRspDTO> update(@PathVariable("id") String id,
                                     @RequestBody BookingUpdateReqDTO req) {
        MeetingCurrentUser user = userResolver.current();
        return Ret.ok().setData(bookingService.update(user, id, req));
    }

    @ApiOperation(value = "释放预定", notes = "软释放，置 releasedAt")
    @PostMapping("/release/{id}")
    public Ret<BookingRspDTO> release(@PathVariable("id") String id) {
        MeetingCurrentUser user = userResolver.current();
        return Ret.ok().setData(bookingService.release(user, id));
    }

    @ApiOperation(value = "预定审计", notes = "本人或管理员可看")
    @GetMapping("/audit/{id}")
    public Ret<List<BookingAuditRspDTO>> audit(@PathVariable("id") String id) {
        MeetingCurrentUser user = userResolver.current();
        // Task 11 接入 MeetingAdminChecker 后改为真实判定
        return Ret.ok().setData(bookingService.listAudits(user, id, false));
    }
```

对应 import：`java.util.List`、三个新 DTO、`org.springframework.web.bind.annotation.GetMapping`、`PathVariable`。

- [ ] **Step 4: 重启并 curl 验收**

```bash
mvn -o -DskipTests clean package && \
java "-DsocksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
  -jar target/zx-contact-1.0.0.jar --eureka.client.register-with-eureka=false > /tmp/contact-run.log 2>&1 &
sleep 90

curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/bookings/mine"
```
预期：`data[0].roomName` 为 `A401`，`status` 为 `upcoming`。

```bash
# 释放
curl -s --noproxy '*' -X POST -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/bookings/release/<bookingId>"
```
预期：`data.releasedAt` 非空；再查该日看板，`busyEvents` 里不再有它；同一时段重新预定应当成功（不再冲突）。

```bash
# 审计
curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/bookings/audit/<bookingId>"
```
预期：至少两条，`action` 依次为 `create`、`release`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom
git commit -m "feat(meetingroom): 我的预定、修改、释放与审计查询"
```

---

### Task 11: me / health / 管理员判定与管理员列表

**Files:**
- Create: `src/main/java/com/zgiot/zx/meetingroom/common/MeetingAdminChecker.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/common/ConfigMeetingAdminChecker.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/dto/MeetingMeRspDTO.java`
- Create: `src/main/java/com/zgiot/zx/meetingroom/controller/MeetingMeController.java`
- Modify: `src/main/java/com/zgiot/zx/meetingroom/service/BookingService.java`
- Modify: `src/main/java/com/zgiot/zx/meetingroom/controller/BookingController.java`
- Modify: `src/main/resources/application.properties`

**Interfaces:**
- Consumes: Task 10 的 `BookingService#toMineList`
- Produces: 接口 `MeetingAdminChecker#isAdmin(String corpId, String accountId, String userId)` → `boolean`；实现 `ConfigMeetingAdminChecker`（读 `meeting.admin.userIds`）；`BookingService#listAdmin(String corpId, int page, int pageSize)` → `PageRsp<BookingMineDTO>`。

> ⚠️ 管理员判定的最终方案 2026-09-01 问后端同事后再定（候选见 spec「管理员判定」小节）。本任务只做接口 + 配置项实现，换实现时不动调用方。

- [ ] **Step 1: 写接口与配置实现**

```java
package com.zgiot.zx.meetingroom.common;

/**
 * 会议室管理员判定。实现方式待定（配置项 / corp_manager 的 sysLevel / 独立表），
 * 定了之后只换实现类，调用方不动。
 */
public interface MeetingAdminChecker {

    /**
     * @param corpId    当前企业
     * @param accountId 登录账号id
     * @param userId    企业内成员id
     */
    boolean isAdmin(String corpId, String accountId, String userId);
}
```

```java
package com.zgiot.zx.meetingroom.common;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * 临时实现：读配置项里的成员id白名单，等价于 Node 端的 MEETING_ADMIN_USER_IDS。
 */
@Component
public class ConfigMeetingAdminChecker implements MeetingAdminChecker {

    @Value("${meeting.admin.userIds:}")
    private String adminUserIds;

    @Override
    public boolean isAdmin(String corpId, String accountId, String userId) {
        if (StringUtils.isBlank(adminUserIds) || StringUtils.isBlank(userId)) {
            return false;
        }
        Set<String> ids = new HashSet<>(Arrays.asList(adminUserIds.split(",")));
        for (String id : ids) {
            if (userId.equals(StringUtils.trimToEmpty(id))) {
                return true;
            }
        }
        return false;
    }
}
```

`src/main/resources/application.properties` 末尾追加（**只加这一行，别动文件里其它凭据**）：

```properties
# 会议室管理员成员id白名单，逗号分隔；最终方案待定，见 20260831-会议室后端落contact 的 spec
meeting.admin.userIds=
```

- [ ] **Step 2: 写 me 接口**

```java
package com.zgiot.zx.meetingroom.dto;

import lombok.Getter;
import lombok.Setter;

/** 当前用户信息，字段与 Node 端 /me 一致 */
@Getter
@Setter
public class MeetingMeRspDTO {

    private String userId;
    private String userName;
    private String dept;
    private Boolean isAdmin;
}
```

```java
package com.zgiot.zx.meetingroom.controller;

import com.zgiot.zx.common.dto.Ret;
import com.zgiot.zx.common.web.BaseController;
import com.zgiot.zx.meetingroom.common.MeetingAdminChecker;
import com.zgiot.zx.meetingroom.common.MeetingCurrentUser;
import com.zgiot.zx.meetingroom.common.MeetingUserResolver;
import com.zgiot.zx.meetingroom.dto.MeetingMeRspDTO;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Api(value = "/meetingRoom", tags = "会议室基础")
@RestController
@RequestMapping("/meetingRoom")
public class MeetingMeController extends BaseController {

    @Autowired
    private MeetingUserResolver userResolver;

    @Autowired
    private MeetingAdminChecker adminChecker;

    @ApiOperation(value = "当前用户", notes = "含是否会议室管理员")
    @GetMapping("/me")
    public Ret<MeetingMeRspDTO> me() {
        MeetingCurrentUser user = userResolver.current();
        MeetingMeRspDTO dto = new MeetingMeRspDTO();
        dto.setUserId(user.getUserId());
        dto.setUserName(user.getUserName());
        dto.setDept(user.getDept());
        dto.setIsAdmin(adminChecker.isAdmin(user.getCorpId(), user.getAccountId(), user.getUserId()));
        return Ret.ok().setData(dto);
    }

    @ApiOperation(value = "健康检查", notes = "健康检查")
    @GetMapping("/health")
    public Ret<String> health() {
        return Ret.ok().setData("ok");
    }
}
```

- [ ] **Step 3: 加管理员列表并接上审计判定**

`BookingService` 追加：

```java
    /** 管理员：全企业预定分页，按日期倒序 */
    public PageRsp<BookingMineDTO> listAdmin(String corpId, int page, int pageSize) {
        int size = Math.min(50, Math.max(1, pageSize));
        int current = Math.max(1, page);
        Page<MeetingBooking> pager = new Page<>(current, size);
        List<MeetingBooking> rows = meetingBookingMapper.selectPage(pager,
                new QueryWrapper<MeetingBooking>()
                        .eq(MeetingBooking.TBL_CORPID, corpId)
                        .orderByDesc(MeetingBooking.TBL_DATE)
                        .orderByDesc(MeetingBooking.TBL_STARTMIN)).getRecords();

        List<BookingMineDTO> list = toMineList(corpId, rows);
        // 管理员列表额外带预定人信息
        for (int i = 0; i < rows.size(); i++) {
            MeetingBooking row = rows.get(i);
            BookingMineDTO dto = list.get(i);
            dto.setHostUserId(row.getHostUserId());
            dto.setHostUserName(row.getHostUserName());
            dto.setHostDept(row.getHostDept());
        }
        return new PageRsp<>(list, (int) pager.getTotal(), current, size);
    }
```

新增 import：`com.baomidou.mybatisplus.extension.plugins.pagination.Page`、`com.zgiot.zx.meetingroom.dto.PageRsp`。

`BookingController` 追加 + 改审计判定：

```java
    @Autowired
    private MeetingAdminChecker adminChecker;

    @ApiOperation(value = "管理员预定列表", notes = "全企业预定，需管理员")
    @GetMapping("/admin")
    public Ret<PageRsp<BookingMineDTO>> admin(@RequestParam(required = false, defaultValue = "1") int page,
                                              @RequestParam(required = false, defaultValue = "20") int pageSize) {
        MeetingCurrentUser user = userResolver.current();
        if (!adminChecker.isAdmin(user.getCorpId(), user.getAccountId(), user.getUserId())) {
            throw MeetingBizException.noPermission("无管理权限");
        }
        return Ret.ok().setData(bookingService.listAdmin(user.getCorpId(), page, pageSize));
    }
```

并把 Task 10 里 `audit` 方法的 `false` 换成真实判定：

```java
    @ApiOperation(value = "预定审计", notes = "本人或管理员可看")
    @GetMapping("/audit/{id}")
    public Ret<List<BookingAuditRspDTO>> audit(@PathVariable("id") String id) {
        MeetingCurrentUser user = userResolver.current();
        boolean isAdmin = adminChecker.isAdmin(user.getCorpId(), user.getAccountId(), user.getUserId());
        return Ret.ok().setData(bookingService.listAudits(user, id, isAdmin));
    }
```

- [ ] **Step 4: 重启并 curl 验收**

```bash
mvn -o -DskipTests clean package && \
java "-DsocksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
  -jar target/zx-contact-1.0.0.jar --eureka.client.register-with-eureka=false \
  --meeting.admin.userIds=<你的userId> > /tmp/contact-run.log 2>&1 &
sleep 90

curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/me"
```
预期：`data.isAdmin` 为 `true`（配置里带了你的 userId）。

```bash
curl -s --noproxy '*' -H "zxAccountId: <accountId>" -H "zxCorpId: 6" -H "zxClientType: 1" \
  "http://127.0.0.1:7004/meetingRoom/bookings/admin?page=1&pageSize=20"
```
预期：`data.total` ≥ 1，`data.list[0].hostUserName` 有值。不带 `--meeting.admin.userIds` 重启后再调，预期 `{"code":"M4003","msg":"无管理权限"}`。

- [ ] **Step 5: 提交**

```bash
git add src/main/java/com/zgiot/zx/meetingroom src/main/resources/application.properties
git commit -m "feat(meetingroom): me/health 与管理员判定接口、管理员预定列表"
```

> ⚠️ 提交前 `git diff --cached src/main/resources/application.properties` 确认只多了 `meeting.admin.userIds` 一行，没把本地调试的数据库地址等带上。

---

### Task 12: 前端切到 Java 接口

**Files:**
- Modify: `apps/meeting/web/src/server/http.js`（baseURL）
- Modify: `apps/meeting/web/src/server/module/*.js`（路径与方法）

**Interfaces:**
- Consumes: Task 6–11 的全部 Java 接口
- Produces: 前端调用改为 `/meetingRoom/**`，其余业务代码不动

> 本任务动的是 `apps/meeting` 仓库，**单独提交**，不要和 contact 的改动混在一个 commit。

- [ ] **Step 1: 逐个改路径**

按下表把 `web/src/server/module/*.js` 里的请求改掉；方法从 `PUT`/`DELETE` 统一改成 `POST`，请求体与响应结构**不变**：

| 原 | 新 |
|---|---|
| `GET /dicts?type=` | `GET /meetingRoom/dicts?type=` |
| `POST /dicts` | `POST /meetingRoom/dicts/create` |
| `PUT /dicts/:id` | `POST /meetingRoom/dicts/update/:id` |
| `PUT /dicts/:id/enabled` | `POST /meetingRoom/dicts/enabled/:id` |
| `DELETE /dicts/:id` | `POST /meetingRoom/dicts/delete/:id` |
| `GET /rooms` | `GET /meetingRoom/rooms` |
| `GET /rooms/:id` | `GET /meetingRoom/rooms/get/:id` |
| `POST /rooms` | `POST /meetingRoom/rooms/create` |
| `PUT /rooms/:id` | `POST /meetingRoom/rooms/update/:id` |
| `PUT /rooms/:id/enabled` | `POST /meetingRoom/rooms/enabled/:id` |
| `GET /board?date=` | `GET /meetingRoom/board?date=` |
| `GET /bookings/mine` | `GET /meetingRoom/bookings/mine` |
| `GET /bookings/admin` | `GET /meetingRoom/bookings/admin` |
| `POST /bookings` | `POST /meetingRoom/bookings/create` |
| `PUT /bookings/:id` | `POST /meetingRoom/bookings/update/:id` |
| `PUT /bookings/:id/release` | `POST /meetingRoom/bookings/release/:id` |
| `GET /bookings/:id/audit` | `GET /meetingRoom/bookings/audit/:id` |
| `GET /me` | `GET /meetingRoom/me` |
| `GET /health` | `GET /meetingRoom/health` |

`/agent/*` 两个接口**保持不变**，仍打 Node 服务。

- [ ] **Step 2: 类型检查**

```bash
cd apps/meeting && pnpm -F @meeting/web exec vue-tsc --noEmit
```
预期：exit 0。

- [ ] **Step 3: 逐屏点一遍**

浏览器打开后台与预定页，依次验证：字典增删改、会议室增删改、看板渲染与排序、单条预定、多日预定、冲突提示文案、我的预定状态、释放后看板消失、审计弹窗。

- [ ] **Step 4: 提交**

```bash
cd apps/meeting
git add web/src/server
git commit -m "feat(booking): 前端切到 contact 的会议室接口"
```

---

---

### Task 13: Service 层测试（Mockito，不连库）

**Files:**
- Test: `src/test/java/com/zgiot/zx/meetingroom/BookingServiceTest.java`
- Test: `src/test/java/com/zgiot/zx/meetingroom/MeetingDictServiceTest.java`

**Interfaces:**
- Consumes: Task 9–11 的 `BookingService`、Task 6 的 `MeetingDictService`
- Produces: 无生产代码，只补自动化验证

> `spring-boot-starter-test` 已带 Mockito 2.x，直接用 `@RunWith(MockitoJUnitRunner.class)` + `@InjectMocks`，不启动 Spring、不连数据库，秒级跑完。

- [ ] **Step 1: 写冲突与归属的测试**

```java
package com.zgiot.zx.meetingroom;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingCode;
import com.zgiot.zx.meetingroom.entity.MeetingBooking;
import com.zgiot.zx.meetingroom.mapper.MeetingBookingMapper;
import com.zgiot.zx.meetingroom.service.BookingService;
import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.runners.MockitoJUnitRunner;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@RunWith(MockitoJUnitRunner.class)
public class BookingServiceTest {

    @Mock
    private MeetingBookingMapper meetingBookingMapper;

    @InjectMocks
    private BookingService bookingService;

    private MeetingBooking booking(String id, int startMin, int endMin, String hostUserId) {
        MeetingBooking booking = new MeetingBooking();
        booking.setId(id);
        booking.setCorpId("6");
        booking.setRoomId("101");
        booking.setDate("2026-09-01");
        booking.setStartMin(startMin);
        booking.setEndMin(endMin);
        booking.setHostUserId(hostUserId);
        return booking;
    }

    @SuppressWarnings("unchecked")
    private void givenBookings(List<MeetingBooking> rows) {
        Mockito.when(meetingBookingMapper.selectList(Mockito.any(Wrapper.class))).thenReturn(rows);
    }

    @Test
    public void 重叠时段能被找出来() {
        givenBookings(Collections.singletonList(booking("1", 600, 720, "u1"))); // 10:00-12:00
        MeetingBooking hit = bookingService.findOverlap("6", "101", "2026-09-01", 660, 780, null);
        Assert.assertNotNull(hit);
        Assert.assertEquals("1", hit.getId());
    }

    @Test
    public void 首尾相接不算冲突() {
        givenBookings(Collections.singletonList(booking("1", 600, 720, "u1")));
        Assert.assertNull(bookingService.findOverlap("6", "101", "2026-09-01", 720, 780, null));
    }

    @Test
    public void 修改时排除自身() {
        givenBookings(Arrays.asList(booking("1", 600, 720, "u1")));
        // excludeId 交给 SQL 过滤，这里模拟 mapper 已经排除后返回空
        givenBookings(Collections.emptyList());
        Assert.assertNull(bookingService.findOverlap("6", "101", "2026-09-01", 600, 720, "1"));
    }

    @Test
    public void 非本人取预定返回不存在() {
        Mockito.when(meetingBookingMapper.selectOne(Mockito.any(Wrapper.class)))
                .thenReturn(booking("1", 600, 720, "u1"));
        try {
            bookingService.mustGetOwn("6", "u2", "1");
            Assert.fail("应当抛异常");
        } catch (MeetingBizException e) {
            Assert.assertEquals(MeetingCode.NOT_FOUND, e.getCode());
            Assert.assertEquals("预定不存在", e.getMessage());
        }
    }
}
```

- [ ] **Step 2: 跑测试**

```bash
mvn -o test -Dtest=BookingServiceTest
```
预期：`Tests run: 4, Failures: 0, Errors: 0`。

- [ ] **Step 3: 写字典级联的测试**

```java
package com.zgiot.zx.meetingroom;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.zgiot.zx.meetingroom.entity.MeetingDict;
import com.zgiot.zx.meetingroom.entity.MeetingRoom;
import com.zgiot.zx.meetingroom.mapper.MeetingDictMapper;
import com.zgiot.zx.meetingroom.mapper.MeetingRoomMapper;
import com.zgiot.zx.meetingroom.service.MeetingDictService;
import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.runners.MockitoJUnitRunner;

import java.util.Collections;

@RunWith(MockitoJUnitRunner.class)
public class MeetingDictServiceTest {

    @Mock
    private MeetingDictMapper meetingDictMapper;

    @Mock
    private MeetingRoomMapper meetingRoomMapper;

    @InjectMocks
    private MeetingDictService meetingDictService;

    @SuppressWarnings("unchecked")
    @Test
    public void 楼宇改名要级联重写会议室() {
        MeetingDict dict = new MeetingDict();
        dict.setId("d1");
        dict.setCorpId("6");
        dict.setType(MeetingDictService.TYPE_BUILDING);
        dict.setName("奥城");
        dict.setSort(1);
        dict.setEnabled(1);
        Mockito.when(meetingDictMapper.selectOne(Mockito.any(Wrapper.class))).thenReturn(dict);
        Mockito.when(meetingDictMapper.selectCount(Mockito.any(Wrapper.class))).thenReturn(0);
        Mockito.when(meetingRoomMapper.selectCount(Mockito.any(Wrapper.class))).thenReturn(0);

        com.zgiot.zx.meetingroom.dto.MeetingDictSaveReqDTO req =
                new com.zgiot.zx.meetingroom.dto.MeetingDictSaveReqDTO();
        req.setName("奥城A座");
        req.setSort(1);
        meetingDictService.update("6", "d1", req);

        ArgumentCaptor<MeetingRoom> patch = ArgumentCaptor.forClass(MeetingRoom.class);
        Mockito.verify(meetingRoomMapper).update(patch.capture(), Mockito.any(Wrapper.class));
        Assert.assertEquals("奥城A座", patch.getValue().getBuildingName());
    }

    @SuppressWarnings("unchecked")
    @Test
    public void 设施改名要重写会议室的facilities() {
        MeetingDict dict = new MeetingDict();
        dict.setId("d2");
        dict.setCorpId("6");
        dict.setType(MeetingDictService.TYPE_FACILITY);
        dict.setName("电视");
        dict.setSort(1);
        dict.setEnabled(1);
        Mockito.when(meetingDictMapper.selectOne(Mockito.any(Wrapper.class))).thenReturn(dict);
        Mockito.when(meetingDictMapper.selectCount(Mockito.any(Wrapper.class))).thenReturn(0);
        Mockito.when(meetingRoomMapper.selectCount(Mockito.any(Wrapper.class))).thenReturn(0);

        MeetingRoom room = new MeetingRoom();
        room.setId("r1");
        room.setFacilities("[\"电视\",\"白板\"]");
        Mockito.when(meetingRoomMapper.selectList(Mockito.any(Wrapper.class)))
                .thenReturn(Collections.singletonList(room));

        com.zgiot.zx.meetingroom.dto.MeetingDictSaveReqDTO req =
                new com.zgiot.zx.meetingroom.dto.MeetingDictSaveReqDTO();
        req.setName("大屏");
        meetingDictService.update("6", "d2", req);

        ArgumentCaptor<MeetingRoom> patch = ArgumentCaptor.forClass(MeetingRoom.class);
        Mockito.verify(meetingRoomMapper).updateById(patch.capture());
        Assert.assertEquals("[\"大屏\",\"白板\"]", patch.getValue().getFacilities());
    }
}
```

> `this.updateById(dict)` 走的是 `BaseService` 里 `@Autowired` 的 `mapper` 字段，Mockito 注入不到时会 NPE。
> 解决：测试里用 `org.springframework.test.util.ReflectionTestUtils.setField(meetingDictService, "mapper", meetingDictMapper)` 在 `@Before` 里补上。

- [ ] **Step 4: 跑测试**

```bash
mvn -o test -Dtest=MeetingDictServiceTest
```
预期：`Tests run: 2, Failures: 0, Errors: 0`。

- [ ] **Step 5: 提交**

```bash
git add src/test/java/com/zgiot/zx/meetingroom
git commit -m "test(meetingroom): Service 层冲突、归属与字典级联测试"
```

---

### Task 14: Controller 层测试（@WebMvcTest，不连库）

**Files:**
- Test: `src/test/java/com/zgiot/zx/meetingroom/BookingControllerTest.java`

**Interfaces:**
- Consumes: Task 9–11 的 Controller 与 `MeetingExceptionHandler`
- Produces: 无生产代码

> 只加载 MVC 层，Service 与 Resolver 全部 `@MockBean`，不碰 MySQL / Redis / Eureka。验证路由能通、信封形状正确、业务异常被 `@RestControllerAdvice` 正确转码。

- [ ] **Step 1: 写测试**

```java
package com.zgiot.zx.meetingroom;

import com.zgiot.zx.meetingroom.common.MeetingAdminChecker;
import com.zgiot.zx.meetingroom.common.MeetingBizException;
import com.zgiot.zx.meetingroom.common.MeetingCurrentUser;
import com.zgiot.zx.meetingroom.common.MeetingExceptionHandler;
import com.zgiot.zx.meetingroom.common.MeetingUserResolver;
import com.zgiot.zx.meetingroom.controller.BookingController;
import com.zgiot.zx.meetingroom.service.BookingService;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@RunWith(SpringRunner.class)
@WebMvcTest(controllers = BookingController.class)
@Import(MeetingExceptionHandler.class)
public class BookingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BookingService bookingService;

    @MockBean
    private MeetingUserResolver userResolver;

    @MockBean
    private MeetingAdminChecker adminChecker;

    private void givenUser() {
        Mockito.when(userResolver.current())
                .thenReturn(new MeetingCurrentUser("6", "a1", "u1", "李明", "研发部"));
    }

    @Test
    public void 我的预定返回M0000信封() throws Exception {
        givenUser();
        Mockito.when(bookingService.listMine(Mockito.any())).thenReturn(Collections.emptyList());
        mockMvc.perform(get("/meetingRoom/bookings/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("M0000"))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    public void 冲突异常转成M4010() throws Exception {
        givenUser();
        Mockito.when(bookingService.create(Mockito.any(), Mockito.any()))
                .thenThrow(MeetingBizException.conflict("该时段已被占用"));
        mockMvc.perform(post("/meetingRoom/bookings/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roomId\":\"101\",\"date\":\"2026-09-01\",\"start\":\"09:00\",\"end\":\"10:00\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("M4010"))
                .andExpect(jsonPath("$.msg").value("该时段已被占用"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    public void 非管理员访问管理员列表被拒() throws Exception {
        givenUser();
        Mockito.when(adminChecker.isAdmin("6", "a1", "u1")).thenReturn(false);
        mockMvc.perform(get("/meetingRoom/bookings/admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("M4003"))
                .andExpect(jsonPath("$.msg").value("无管理权限"));
    }

    @Test
    public void 缺用户信息返回M4002() throws Exception {
        Mockito.when(userResolver.current())
                .thenThrow(MeetingBizException.noUser("缺少用户信息，请重新登录"));
        mockMvc.perform(get("/meetingRoom/bookings/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("M4002"));
    }
}
```

- [ ] **Step 2: 跑测试**

```bash
mvn -o test -Dtest=BookingControllerTest
```
预期：`Tests run: 4, Failures: 0, Errors: 0`。
> 若 `@WebMvcTest` 因为启动类上的 `@ComponentScan(excludeFilters=...)`、`@EnableFeignClients` 而尝试加载全量上下文，就退一步：去掉 `@WebMvcTest`，改用 `MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new MeetingExceptionHandler()).build()` 手工装配，断言不变。

- [ ] **Step 3: 全量跑一遍会议室的测试**

```bash
mvn -o test -Dtest='Meeting*Test,Booking*Test,RoomRulesTest'
```
预期：全绿，合计 60+ 用例。

- [ ] **Step 4: 提交**

```bash
git add src/test/java/com/zgiot/zx/meetingroom
git commit -m "test(meetingroom): Controller 路由与信封测试"
```

## 收尾

全部任务完成后：

1. 更新 `context/features/20260831-会议室后端落contact/status.md` 的平台矩阵与待办。
2. 生成 `impl-notes.md`，重点记：错误码不进 ErrCodeBean 体系的原因、`slotFloor` 与 Node 端 `nextOpen` 的取整差异、批次事务的回滚验证方法、`(accountId, corpId)` 推导 userId 的做法。
3. 在工作区根 `git add -A && git commit -m "docs(20260831-会议室后端落contact): ..."`。

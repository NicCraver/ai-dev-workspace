# 后端-通讯录服务（contact）一页纸

> 保持在约 100 行以内。最后更新：2026-08-31（首次建立，静态勘察，**未跑过构建**）

## 基本信息
- 仓库：`apps/contact/`（`zx-contact`，智信组织架构 / 通讯录微服务），远端 `xinxi/zhixin/server-v2/smart-oa/zx-contact.git`，默认分支 `release`。
- **性质：不是智信的第七端**，是后端微服务。四端平台矩阵不包含它；它提供的是四端消费的接口。
- 会议室后端功能计划落在**本仓库**（与前端 `apps/meeting/` 的 Hono server 是两回事，后者只是本地开发用的临时服务端）。
- 技术栈：Java 8 + Spring Boot（父 POM `com.zgiot.zx:zx-parent:0.1.3-SNAPSHOT`）+ Spring Cloud（Eureka 客户端 + OpenFeign + Nacos/Config）+ MyBatis-Plus + MySQL + Redis(lettuce) + MongoDB + RocketMQ(阿里云 ONS) + xxl-job + Swagger2 + Lombok。
- 端口 `7004`（`src/main/resources/application.properties`），服务名 `zx-contact-wdc`；`localconfig/` 里另有一套本地配置（服务名 `zx-contact`，端口 `7511`）。
- 打包 jar，Dockerfile 基于 `openjdk:8`。

## 常用命令
```bash
# 在 apps/contact/ 根执行（必须用 JDK 8）
export JAVA_HOME=$(/usr/libexec/java_home -v 1.8)
mvn -DskipTests clean package     # 产出 target/zx-contact-1.0.0.jar
mvn test                          # 单测（现有测试多为手工联调用途，未必全绿）
mvn spring-boot:run               # 本地起服务
```
> ⚠️ **当前构建跑不通，缺前置条件**：本机 `~/.m2/` 无 `com.zgiot` 私有依赖（`zx-parent` / `zx-common` / `zx-mq-producer` / `zx-log-core` / `zx-action-sdk` / `asyncTool`），也没有 `~/.m2/settings.xml` 配公司 Nexus 镜像。首次构建前需要拿到公司私服地址并写 `settings.xml`。
> ⚠️ 本机 `mvn -v` 默认跑在 JDK 26 上，项目是 Java 8，**不显式设 `JAVA_HOME` 必炸**。

## 目录与分层约定
```
src/main/java/com/zgiot/zx/<域>/
  controller/            REST 入口，@RestController + @RequestMapping("/<域>")，继承 BaseController
    request/ response/   （部分域）请求/响应 DTO 单独放
  dto/                   传输对象，命名 XxxReqDTO / XxxRspDTO / XxxResDTO
  entity/                MyBatis-Plus 实体，与表一一对应
  mapper/                Mapper 接口（XML 在 resources/mapper/<域>/XxxMapper.xml）
  service/               业务服务
  mgr/                   数据/领域管理层，继承 BaseService<T>，事务多打在这层
  fegin/ | feign/        跨服务调用（注意历史拼写 `fegin`，按所在域现状走）
  exception/             业务异常，继承 BizCommonException
  enums/                 枚举
```
- 现有域：`account` `corp` `dept` `user` `role` `position` `authorization` `industry` `notification` `openreg`(内含 inv/register/outsource/contactV2/modelcodeurl/base) `multiorg` `operateplatform` `resource` `graph` `model` `personnelchangestatistics` 等，共 1465 个 java 文件。
- **新增功能按域建独立 package**（会议室 → 新建 `com.zgiot.zx.meetingroom/`，内部再照上面分层），不要往 `common` / `util` 里塞业务代码。
- **业务异常必须注册错误码**：在 `ContactApplication.initCustomErrCode()` 里加 `new ErrCodeBean("<码>", XxxException.class)`，并在 `src/main/resources/i18n/messages.properties` 与 `messages_zh_CN.properties` 各补一条文案。未注册的异常会被反射兜底成 `D_F_00x` 这种无意义码。
- 错误码风格：`M0000` 成功（与四端前端拦截器约定一致）；业务码形如 `C_D_001`（模块_子域_序号）。
- MyBatis-Plus 全局配置在 `application.properties`：`id-type=input`（**主键不自增，由代码生成**）、逻辑删除 `logic-delete-value=1`、**`map-underscore-to-camel-case=false`**（下划线不自动转驼峰，字段名要么对齐要么写 `@TableField`）。
- Swagger：类上 `@Api(tags="…")`、方法上 `@ApiOperation`，四端联调看 `/swagger-ui.html`。
- 免登白名单走 `app.ann-url`（逗号分隔的路径前缀），新增无需鉴权的接口要往这里加。

## 数据库脚本约定
- `dbscript/<年份>/` 下按 `V<主>_<次>_<日期>_<描述>_DDL.sql` / `_DML.sql` 命名（如 `dbscript/2026/V1_0_20260002_badge_DML.sql`）。DDL 与 DML 分文件。
- 建表脚本必须随功能提交，四端联调前先把脚本给到运维/DBA 执行。

## 接口契约衔接
- 本仓库新增/改动接口后，**同步更新 `context/contracts/<域>/<接口>.d.ts`**（契约仍是四端的唯一事实来源），并在文件头 Changelog 记一笔。
- 实际返回与契约不符时：先改契约，再改代码，并在活跃功能 `impl-notes.md` 的「联调坑」补一条。

## 已知坑
- ⚠️ **`src/main/resources/application.properties` 里明文提交了大量生产/测试凭据**（MySQL 账号密码、阿里云 AccessKey、RSA 私钥、飞书 appSecret、GDB 账号）。改这个文件时不要新增凭据，也别把本地密码顺手提交上去；泄露风险应向后端负责人反馈。
- `.gitignore` 里有一行 `*.yml`——yml 配置一律不入库，配置只走 properties + 配置中心（Nacos / Spring Cloud Config）。
- `localconfig/application.properties` 是 GBK 编码（终端直接 cat 是乱码），改它请用编辑器指定编码，别整文件重写。
- `logging.level.root=DEBUG` 写死在主配置里，本地起服务日志量极大。
- 启动类打了 `@Lazy` **专为绕开循环依赖**；新增 Bean 若形成环，先想办法拆依赖，别再加 `@Lazy` 掩盖。
- `ContactApplication` 启动时会跑 `CommandLineRunner`（开放注册默认部门初始化）与全量反射扫描（`Reflections("com.zgiot.zx")`），冷启动偏慢，属正常。
- 依赖里 POI 3.17 / easyexcel 1.1.2-beta5 / jxls 多套 Excel 库并存，写导入导出前先看同域已有实现用的是哪套，别再引第四套。
- 测试目录里有 `Test1.java` / `TestEnum.java` 这类历史手工测试，别当回归基线。

## 与四端的关系
- 四端通过网关调用本服务，前端 axios 前缀 `/api/contact/v1`（见 `context/platforms/action-center.md` 的 `baseMap`）。
- 服务注册走 Eureka（`eureka.client.service-url.defaultZone`），服务间调用用 OpenFeign，Feign 客户端定义在各域的 `fegin/` 包内。

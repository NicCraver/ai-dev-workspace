# 交给外部编码 Agent 的提示词（Grok）

> 直接整段复制给 Grok。它只在 `apps/contact` 里干活，不碰其它仓库。

---

你是一名 Java 后端工程师，在一个已有的 Spring Boot 微服务里新增「会议室」功能模块。

## 你的工作范围

**只能改这一个仓库**：`/Users/nic/w/ai-dev-workspace/apps/contact`（服务名 `zx-contact`，智信通讯录/组织架构微服务，Java 8 + Spring Boot 2.0.4 + MyBatis-Plus + MySQL 5.7）。

**禁止**改动 `/Users/nic/w/ai-dev-workspace` 下的其它任何目录（`apps/meeting`、`apps/web`、`apps/android`、`apps/ios`、`apps/desktop`、`context/`）。`apps/meeting` 只能**读**，它是本次移植的参考源。

## 先读这三份文档，读完再动手

1. `/Users/nic/w/ai-dev-workspace/context/features/20260831-会议室后端落contact/plan.md` —— **实现计划，14 个任务，每个任务都有完整代码、测试代码、验证命令。按顺序一个一个做。**
2. `/Users/nic/w/ai-dev-workspace/context/features/20260831-会议室后端落contact/spec.md` —— 需求与业务规则的完整说明
3. `/Users/nic/w/ai-dev-workspace/apps/contact/CLAUDE.md` —— 本仓库的代码规范与提交禁忌

计划里的代码是可直接使用的，但**你要自己保证它能编译通过**——如果发现签名不匹配、import 缺失、方法名对不上，以能编译能通过测试为准，自行修正，并在最后汇报你改了什么。

## 环境（照做，不要自己探索）

```bash
# JDK 必须是 8。注意：/usr/libexec/java_home -v 1.8 返回的是没有 javac 的 JRE，用了会报
# "No compiler is provided in this environment"，必须写死下面这个路径
export JAVA_HOME=/Users/nic/Library/Java/JavaVirtualMachines/corretto-1.8.0_392/Contents/Home

cd /Users/nic/w/ai-dev-workspace/apps/contact

# Maven 一律加 -o 离线跑。不加 -o 会逐个依赖去问公司 Nexus，慢到不可用（5 分钟走不完 50 个依赖）
mvn -o -DskipTests clean package    # 约 17 秒，产出 target/zx-contact-1.0.0.jar
mvn -o test -Dtest=某个测试类         # 跑单个测试类

# 起服务（端口 7004，启动约 66 秒）
# 这两个 -D 必须带：本机 Clash 把系统 SOCKS 代理设成 127.0.0.1:7890，JVM 默认继承，
# 会把内网 MySQL/Redis/Eureka 的连接全部掐断，报 Communications link failure。
# 迷惑点是 nc/curl 测同一端口都通，只有 Java 不通，别顺着"数据库挂了"查。
java "-DsocksNonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
     "-Dhttp.nonProxyHosts=192.168.*|10.*|127.0.0.1|localhost" \
     -jar target/zx-contact-1.0.0.jar --eureka.client.register-with-eureka=false > /tmp/contact-run.log 2>&1 &
```

测试数据库是 `192.168.10.31:3306/zx_contact`（root/123456，需连公司 VPN）。建表脚本要**你自己执行**（Task 4 里有），本机没有 mysql 客户端就用 JDBC 小程序跑。

## 五条硬规则，违反了整个功能就是错的

1. **错误码只能用这 6 个**：`M4000` 校验 / `M4001` 缺企业 / `M4002` 缺用户 / `M4003` 无权限 / `M4004` 不存在 / `M4010` 时段被占用。成功码 `M0000`。**不要新增码，不要改成本仓库其它模块的 `C_D_001` 风格**——前端和 AI 助手都依赖这些码。

2. **所有提示文案逐字照抄 `apps/meeting/server/src/domain/*.ts`**，不许润色。例如就是「剩余空闲不足 30 分钟」「该时段已被占用」「请选择启用中的建筑」。前端直接把 `msg` 弹给用户，`apps/meeting/server/tests/*.test.ts` 里的断言就是验收标准。

3. **数据库列名用驼峰**（`corpId`、`startMin`、`createAt`），表名用下划线（`meeting_room`）。本仓库配了 `map-underscore-to-camel-case=false`，写成 `corp_id` 会查不到数据。

4. **主键不自增**。实体继承 `BaseEntity`，插入一律走 `BaseService.insert(entity)`——它内部会自动补雪花 id 和 creator/createAt/updator/updateAt。**不要自己 setId**。

5. **企业 id 只能从 `SessionContext.getCurrentAppUser().getCorpId()` 取**，绝对不能用前端传来的 corpId 参数。用户 id 要用 `(accountId, corpId)` 去 `user` 表查企业内的 `user.id`，查不到就返回 `M4002` 拒绝。

## 工作方式

- **一次做一个任务**。每个任务做完，跑它列出的验证命令，**贴出真实输出**，然后 `git commit`（提交信息用计划里给的那条）。做完一个任务停下来汇报，不要连续做完多个。
- **测试先行**：计划里凡是带测试的任务，先写测试、跑一遍确认失败、再写实现、再跑一遍确认通过。不要跳过"确认失败"这步。
- **不要谎报**。测试没过就说没过，贴出报错原文。不要写"应该可以了"。
- 遇到计划里没覆盖的情况，先去 `apps/meeting/server/src/domain/` 和 `apps/meeting/server/tests/` 找对应实现，照它的行为做，并在汇报里说明。

## 提交禁忌

- `src/main/resources/application.properties` 里明文存着数据库密码、阿里云 AccessKey、RSA 私钥。**只允许追加 `meeting.admin.userIds=` 这一行**，提交前必须 `git diff --cached src/main/resources/application.properties` 确认没有别的改动。
- 不要提交 `target/`、IDE 配置、本地调试用的连接串。
- 注释写中文。

## 已知的待定项

Task 11 的「会议室管理员怎么判定」还没定，计划里先用配置项 `meeting.admin.userIds` 顶着。**按计划实现即可**，不要自己去接角色系统或 `corp_manager` 表。

## 开始

先读三份文档，然后告诉我：
1. 你打算怎么做 Task 1，
2. 有没有发现计划里明显编译不过或前后矛盾的地方。

确认之后再动手写第一行代码。

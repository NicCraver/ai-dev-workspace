# Status：安卓端 收纳组丢失 / 子项为 0 / 置顶失效

> 最后更新：2026-08-21（打点包已装机 `cbaf94cf`，等真机日志）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 本次要解决的用户问题

用户报了 4 个，本轮**只查 2、3**（收纳组），1、4 已给出代码层结论，暂不动手。

| # | 现象 | 本轮处理 |
|---|------|----------|
| 1 | 8/21 开机提示「8/13 被其他账号登录」，需重新输密码 | 已分析，未动手 |
| 2 | 进入智信后**所有群收纳组消失** | 🚧 打点排查中 |
| 3 | 进入智信后**某一个收纳组数量为 0**，其他正常 | 🚧 打点排查中 |
| 4 | 首页「在组织内搜索」有的人搜不到 | 已分析，未动手 |

## 关键复现条件（用户提供，2026-08-21）

**清数据 / 重装后第一次打开：收纳组和组内数量都正常，与其他端一致。
杀进程后再打开：某个收纳组数量变 0，有的用户一个收纳组都没有了，置顶也出问题。**

这条把嫌疑范围收窄到「**第二次冷启动才走的那条链路**」：

- 第一次 = `InitPersonalDataActivity.requestImAttribute()` 走**全量**（`getGatherAndConversationOperateList(0)`）
- 第二次 = `AppStartSplashActivity.requestImAttribute()` 走**增量**（`startTime = PrefManager.getUpdateGatherConOperateTime()`）
- 第二次还多一件事：融云重连后**集中下发离线消息**，其中 `ZX:GatherMsg` 会走 `ThumbnailImageLoadManager`

## 排查前已定位的代码事实（只读分析，未改逻辑）

收纳组是纯本地数据，列表只读 GreenDAO，不查服务端：

- 查询 `DataCenter.getAllGathers(gatherId, belongSubgroup)`（`base_data/.../DataCenter.java:2511`）
  条件 = `accountId == PrefManager.getUserMessage().getId()` AND `delete == false` AND `belongSubgroup == 当前tab`。
  三者任一不匹配 → **整组不显示**（问题 2 的形态）。
- 子项渲染 `ConversationListView.getEntity()`（`IM/.../ConversationListView.java`）：
  群要 `getGroupInfoIgnoreDelete(myAccountId, groupId)` 非空，且**组织 tab 只收 `groupType < 10`、外联 tab 只收 `groupType >= 10`**；
  人要本地 `EaseUserInfo` 存在。任一不满足 → 子项静默不展示 → **组显示 0**（问题 3 的形态）。
- 三条写入通道都会**整体覆盖**本地行，不是字段级合并：
  1. 全量：`InitPersonalDataActivity.java:~630`
  2. 增量：`UserChangedDataManager.GroupParaSaveController.run()` — `new ConversationGather(...)` + `insertOrReplace`，
     `conversationList` 直接被服务端 `relList` 顶掉，`isExpand` 写死 false、`disturbTime` 写死 0
  3. 多端同步消息：`ThumbnailImageLoadManager` case 0~5 全都 `setConversationList(gatherMessage.getFinalRealChildList())`，
     守卫只有 `sentTime < 本地 updateTime` 一条
- `GatherCreateResult.belongSubgroup` 是 `int`，**JSON 缺省即 0 = 组织**。缺字段的一次下发就能把外联组整批挪走。

## 本轮打点（临时，验完删）

正式包里 `LogUtil` 被 `BuildConfig.DEBUG` 短路（`base_util/util/LogUtil.java:74`），**一条都打不出**，
所以新增 `base_util/src/main/java/util/ZXGatherLog.java` 直接用 `android.util.Log`。
tag = `ZXGather`（**不带冒号**，可 `adb logcat -s ZXGather:I`；上个 feature 用 `ZX:Stream` 踩过 `-s` 表达不了的坑）。

| 打点 | 位置 | 看什么 |
|------|------|--------|
| `net.req` / `net.resp` | `OkHttp3Interceptor` | `storage/getTopAndDisturbList` **原始 body**（区分"没下发字段"和"下发了 0"） |
| `init.req` / `init.storage` / `init.saved` / `init.time` | `InitPersonalDataActivity` | 第一次全量的基线 |
| `splash.req` / `splash.resp` | `AppStartSplashActivity` | 第二次冷启动增量的 startTime 与响应概况 |
| `login.req` | `LoginActivity` | 登录路径增量（备用） |
| `save.in` / `save.before` / `save.after` / `save.time` / `save.err` | `UserChangedDataManager` | 增量落库**每条：服务端值 vs 覆盖前旧行 vs 覆盖后实际值** |
| `save.session` | `UserChangedDataManager` | 会话置顶/免打扰增量明细（对应置顶问题） |
| `query` / `query.hit` / `query.row` | `DataCenter.getAllGathers` | 命中行 + **表内全部行**，直接区分「行没了」还是「被条件过滤」 |
| `entity.group` / `entity.child` | `ConversationListView.getEntity` | 每组「库里子项数 vs 实际展示数」+ 每个子项没展示的原因 |
| `msg.gather` / `msg.session` | `ThumbnailImageLoadManager` | 离线/多端同步消息，含覆盖前状态与守卫判定 |
| `db.delete` | `DataCenter.deleteGatherById` | 谁把组标记成删除 |

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 只读定位（4 个问题的代码链路） | — | ✅ | — | — |
| 新增 `ZXGatherLog` + 10 类打点 | — | ✅ 代码 | — | — |
| `:smart_message:compilePublishReleaseJavaWithJavac` | — | ✅ 无 error | — | — |
| 出正式包（`zx-android-prod_v3.6.21.apk` 77.8 MB） | — | ✅ | — | — |
| 装机（`adb install -r` Success，设备 `cbaf94cf` 小米 2509FPN0BC） | — | ✅ | — | — |
| 真机跑第一遍（清数据→登录→看收纳组） | — | ⬜ 等用户 | — | — |
| 真机跑第二遍（杀进程→重开→看收纳组） | — | ⬜ 等用户 | — | — |
| 定位根因 → 修复 | — | ⬜ | — | — |
| 删除全部临时打点 | — | ⬜ | — | — |

## 待办 / 阻塞

- (android) **等真机日志**。logcat 已后台抓到 `/tmp/zx-gather-run.log`（`adb logcat -v time`，缓冲已 `-G 16M` + `-c` 清空）。
  用户操作顺序：清数据 → 打开登录 → 看收纳组（第一遍基线）→ 杀进程 → 重开 → 看收纳组（第二遍复现）。
- (android) 工作区脏 9 个文件全部是本次临时打点，**根因定位后要连同 `ZXGatherLog` 一起删干净再提交**，不要把打点留进分支。
- (android) 分支仍是 `fix/md-table-fold-truncate`（无 upstream），tip `8275a307c` = 上个 feature 已推的提交。
- (desktop) 脏 3 个（`.env.test` / `electron-builder.yml` / `package.json`）是 PC 打 test 包留下的本地配置，**与本功能无关且禁止提交**。
- (未做) 问题 1、4 只有代码层分析，没有动手。问题 4 已确认三条独立成因：
  全量拉取只取第 1 页 1 万条（`getCorpUsersByCorpId(corpId, corpType, 10000, 1)`）、
  组织 tab 硬条件 `USER_DIRECT_CORP = 1`、
  字母/拼音检索分支在 `DataCenter.java:974-979` 被注释掉（只输字母会拼出非法 SQL 被 catch 吞掉）。

## 关键决策记录

- 2026-08-21 打点走**正式包**而不是 onTest：问题只在用户真实生产数据上复现，测试环境没有这些收纳组。
- 2026-08-21 打点不用 `LogUtil`：release 包里被 `BuildConfig.DEBUG` 短路。已确认 `minifyEnabled false` 且无
  `assumenosideeffects android.util.Log`，所以 `android.util.Log` 不会被剥。
- 2026-08-21 在 OkHttp 拦截器打**原始响应 body**：解析成 bean 后 `int` 字段的 0 分不清是服务端下发的还是 Java 默认值，
  而 `belongSubgroup` / `isTop` / `isDelete` 恰好全是 `int`，这个区分是定位的关键。

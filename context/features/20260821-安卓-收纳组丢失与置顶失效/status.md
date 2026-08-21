# Status：安卓端 收纳组丢失 / 子项为 0 / 置顶失效

> 最后更新：2026-08-21（根因已坐实并修复，自愈验证通过；解析修复待清数据场景验证）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 本次要解决的用户问题

用户报了 4 个，本轮**只修 2、3**（收纳组，含置顶），1、4 已给出代码层结论，暂不动手。

| # | 现象 | 本轮处理 |
|---|------|----------|
| 1 | 8/21 开机提示「8/13 被其他账号登录」，需重新输密码 | 已分析，未动手 |
| 2 | 进入智信后**所有群收纳组消失** | ✅ 根因同 3，已修 |
| 3 | 进入智信后**某一个收纳组数量为 0**，其他正常 | ✅ 根因坐实，已修 |
| 4 | 首页「在组织内搜索」有的人搜不到 | 已分析，未动手 |

## 根因（真机日志坐实，留档 `/tmp/zx-gather-run1.log`）

**不是增量接口的问题，是融云多端同步消息 `ZX:GatherMsg` 的解析整条崩掉。**

```
11:35:07.370  [init.saved]   2673 child=7                     ← 全量落库正确
11:35:11.663  [msg.gather]   operateType=1 gatherId=2673
                             finalRealChild=-1 operateChild=-1 → 放行覆盖
11:35:11.763  [entity.group] 组=项目产品 库里子项=-1 实际展示=0  ← 界面 0
第二次冷启动 [splash.resp] session=0 storage=0，增量一个字节没下发，只是把坏数据读出来
```

因果链：

1. `GatherMessage.encode()` 里 `childInfo` 只有 `getOperateChildList() != null` 才写。
2. **重命名 / 收纳组置顶 / 解散**这三类操作从不设 `operateChildList`
   （`ConversationListBaseView.java:1247/1342/1410/1740/1778/1463/1832` + `ChooseGatherUnitFragment.java:374`，共 8 处），
   所以发出的 JSON 里**没有 `childInfo`** 字段。
3. 接收端 `GatherMessage(byte[] data)` 用 `jsonObj.getJSONArray("childInfo")`——缺字段抛 `JSONException`，
   而 **catch 是空的**。
4. 于是这一行之后所有赋值全不执行：`finalRealChildList` 停在 **null**、`belongSubgroup` 停在 **0**、
   `time` / `extra` / `moveToGather*` 全默认。
   （`operateType` / `gatherId` / `gatherName` / `topStatus` 在异常之前，所以是对的——日志逐字吻合。）
5. `ThumbnailImageLoadManager` case 0~5 拿这些默认值无条件覆盖本地：
   `setConversationList(null)` → **子项清空（问题 3）**；
   `setBelongSubgroup(0)` → **外联收纳组被改成组织，从外联 tab 消失（问题 2）**。
6. 守卫 `sentTime < updateTime` 拦不住：服务端 `updateAt` 秒精度（`…545000`）、融云 `sentTime` 毫秒（`…545258`），
   同一次操作比出来消息总是「更新」。**毫秒尾数 <500 放行、≥500 拦住**——这就是"为什么只有某一个组坏"。
   同份日志有反例佐证：置顶消息 `sentTime=…546838` vs `updateAt=…547000`（进位），被正确拦下。

代码是 liuyiling **2021-12-25** `141fb7b7ae`「收纳组多端同步」写的，四年没动；
与最近 markdown / 流式迭代无关（`8275a307c` 只碰了该文件 1241 行的图片落盘）。
引爆点是 **2026-08-19 14:55:45** 的一次收纳组重命名。

## 已实施的修复

| | 改动 | 文件 |
|---|------|------|
| F1 | 三处 `getJSONArray` → `optJSONArray` + null 判断，可选字段缺失不再中断整条消息解析。**缺失时保持 null**（= 消息没带该信息），不退化成空集合（那是"清空"） | `IM/.../message_type/gather/GatherMessage.java` |
| F2 | `encode()` 里 `childInfo` / `moveToGatherFinalRealChildList` **始终下发**（无内容给空数组），**救未升级的存量客户端**——它们能继续读到后面的 `belongSubgroup` 与 `finalRealChildList` | 同上 |
| F3 | 新增 `updateLocalGatherByMessage()`，case 0~5 复用：`finalRealChildList == null` 不动本地子项；**`belongSubgroup` 不再跟随消息改**（重命名/置顶/加减子项都不改变归属） | `IM/.../manager/ThumbnailImageLoadManager.java` |
| F4 | 守卫改**秒对齐**（`/1000` 后比较），堵掉秒 vs 毫秒的精度漏洞；case 5 两处 `>` 写法一并对齐 | 同上 |
| F5 | 新增 `DataCenter.hasBrokenGather()`；`AppStartSplashActivity.requestImAttribute()` 检测到 `conversationList == null` 就把增量时间重置为 0 走全量自愈 | `base_data/.../DataCenter.java` + `smart_message/.../AppStartSplashActivity.java` |

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 只读定位（4 个问题的代码链路） | — | ✅ | — | — |
| 新增 `ZXGatherLog` + 10 类打点 | — | ✅ | — | — |
| 真机抓日志坐实根因 | — | ✅ | — | — |
| F1~F5 修复 | — | ✅ 代码 | — | — |
| `:smart_message:compilePublishReleaseJavaWithJavac` | — | ✅ 无 error | — | — |
| 出正式包 + 装机（`cbaf94cf` 小米 2509FPN0BC） | — | ✅ | — | — |
| 验证 1：自愈（不清数据直接覆盖装） | — | ✅ **通过** | — | — |
| 验证 2：杀进程重开不复发 | — | ⬜ | — | — |
| 验证 3：清数据全流程（**这才验得到 F1/F3**） | — | ⬜ | — | — |
| 验证 4/5：跨端重命名收 / 发 | — | ⬜ | — | — |
| 验证 6：外联组置顶不跳 tab | — | ⬜ | — | — |
| 删除全部临时打点 + 重新出包 | — | ⬜ | — | — |

### 验证 1 实测（2026-08-21 11:53）

```
[splash.req]   冷启动增量 startTime=0 检测到损坏收纳组=true
[splash.resp]  ctime=1787284409712 data=session=58 storage=6
[save.before]  2673 … || 本地旧行: child=-1 updateTime=1787122545258
[save.after]   2673 -> child=7 updateTime=1787122545000
[entity.group] 组=项目产品 库里子项=7 实际展示=7
```

**注意**：这一轮日志里**没有任何 `msg.gather`**——覆盖安装保留了融云本地库，8/19 那条历史消息不会重新投递。
所以目前只证明了 F5 自愈可用，**F1/F2/F3 尚未被实际触发验证**，必须靠「清数据」场景（融云重新拉离线消息）来验。

## 待办 / 阻塞

- (android) **设备掉线**（`adb devices` 空），日志抓取中断在 1.2MB（`/tmp/zx-gather-fix.log`）。重连 USB 后继续。
- (android) 下一步跑**验证 3（清数据全流程）**：清数据 → 登录 → 看 2673 应为 7 → 杀进程重开 → 仍为 7。
  这一步日志里应该出现 `msg.gather`，且显示子项未被覆盖，才算验到 F1/F3。
- (android) 工作区脏 10 个文件 = 5 项修复 + 临时打点。**验证全过后必须先删打点再提交**，
  `OkHttp3Interceptor` 里打原始 body 那段尤其要删干净（会打印会话数据）。
- (android) 分支 `fix/md-table-fold-truncate`（无 upstream），tip `8275a307c`。
- (desktop) 脏 3 个（`.env.test` / `electron-builder.yml` / `package.json`）是 PC 打包本地配置，**与本功能无关且禁止提交**。
- (跨端) 需知会 iOS / PC：检查各自 `GatherMessage` 解析是否同样在可选数组字段上崩、encode 是否漏发
  `childInfo` / `belongSubgroup`。安卓 F3 已做防御，但源头在发送端时其它端之间仍会互相污染。
- (未做) 其它 5 个消息类型（`ZXCombineMessage` / `ZXRichMessage` / `ActionCardMessage` / `ToDoMessage` /
  `TipMessage`）有**同样的 `getJSONArray` 崩解析模式**，本轮不修，单独排期。
- (未做) 问题 1、问题 4。问题 4 三条独立成因：全量拉取只取第 1 页 1 万条
  （`getCorpUsersByCorpId(corpId, corpType, 10000, 1)`）、组织 tab 硬条件 `USER_DIRECT_CORP = 1`、
  字母/拼音检索分支在 `DataCenter.java:974-979` 被注释掉（只输字母拼出非法 SQL 被 catch 吞掉）。
- (已知无关) 「信息部人员」库里 12 个子项只显示 10 个，两个联系人本地缺失，与问题 4 同源。

## 关键决策记录

- 2026-08-21 打点走**正式包**而非 onTest：问题只在真实生产数据上复现。
- 2026-08-21 打点不用 `LogUtil`：release 包里被 `BuildConfig.DEBUG` 短路。已确认 `minifyEnabled false`
  且无 `assumenosideeffects android.util.Log`，直接用 `android.util.Log` 不会被剥。
- 2026-08-21 在 OkHttp 拦截器打**原始响应 body**：解析成 bean 后 `int` 字段的 0 分不清是服务端下发还是 Java 默认值，
  而 `belongSubgroup` / `isTop` / `isDelete` 恰好全是 `int`——这个区分是定位的关键，也直接指向了解析中断。
- 2026-08-21 tag 用 `ZXGather` 不带冒号：上个 feature 的 `ZX:Stream` 踩过 `adb logcat -s` 表达不了的坑。
- 2026-08-21 F3 决定 `belongSubgroup` 一律不跟随消息改：重命名/置顶/加减子项本就不改归属，
  而 iOS/PC 漏发该字段时 `optInt` 会给 0，照搬就会把外联组挪进组织。这条把问题 2 的通路彻底堵死。
- 2026-08-21 自愈选「检测到损坏才走全量」而非「升级后无条件全量」：只在真损坏时多一次请求（实测响应约 15KB）。

# Status：会议室新增「位置描述」字段

> 最后更新：2026-09-01 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

会议室除名称、建筑、楼层外，再维护一条「怎么找到这间屋子」的描述，例如「3号会议室在7层711办公室」「2号会议室在715财务办公室旁边」。

字段名 `locationDesc`，**与既有 `locationNote` 是两个字段**：

| 字段 | 定位 | 上限 | 表单标签 |
|------|------|------|----------|
| `locationDesc` | 位置指引，帮人找到门 | 50 字 | 位置描述（基本信息里，紧跟所在位置） |
| `locationNote` | 通用补充说明（投影线、使用须知等） | 100 字 | 备注（备注信息卡片） |

## 平台矩阵

| 任务 | contact（Java） | meeting server（Node） | meeting web |
|------|-----------------|------------------------|-------------|
| 库表加列 | ✅ | ✅ | — |
| 实体 / DTO / 规范化 / 校验 | ✅ | ✅ | — |
| 看板接口返回该字段 | ✅ | ✅ | — |
| 管理端表单录入 | — | — | ✅ |
| 管理端列表展示 | — | — | ✅ |
| PC 看板房间弹窗 | — | — | ✅ |
| 移动端房间详情 / 房间卡片 | — | — | ✅ |
| 运行时联调（起服务点一遍） | ⬜ | ⬜ | ⬜ |

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| contact | feat/meetingroom | 无 upstream | 干净 | **本功能** | 已 commit，未 push |
| meeting | — | — | 大量 | **本功能** + 会议室前端重构 | 本功能改动**未单独 commit**：工作区里混着前端重构的在途改动，避免混提 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 本次改动

**apps/contact**（commit 见 `feat(meetingroom): 会议室新增位置描述 locationDesc`）

| 文件 | 改动 |
|------|------|
| `dbscript/2026/V1_0_20260901_meetingroom_locationDesc_DDL.sql` | 新增，`ALTER TABLE meeting_room ADD COLUMN locationDesc varchar(100)` |
| `entity/MeetingRoom.java` | 加字段，`@TableField(strategy = FieldStrategy.IGNORED)`（否则全局 `field-strategy=not_empty` 会让「清空保存」不生效） |
| `rule/RoomDraft.java` / `rule/RoomRules.java` | 规范化 trim→null；校验 >50 字报 `位置描述不超过 50 个字`（M4000） |
| `dto/MeetingRoomSaveReqDTO` / `MeetingRoomRspDTO` / `BoardRoomDTO` | 加字段 |
| `service/MeetingRoomService` / `BoardService` | toDto / applyPayload / toDraft / 看板映射 |
| `test/RoomRulesTest.java` | 3 例：超长、空串归 null、trim 后保留 |

**apps/meeting/server**

| 文件 | 改动 |
|------|------|
| `src/db.ts` | SCHEMA 加 `location_desc TEXT`；`ensureSchema` 加补列迁移（已有本地 sqlite 也能升上来） |
| `src/types.ts` | `RoomPayload.locationDesc?` / `RoomRecord.locationDesc` |
| `src/domain/room.ts` | RoomRow、toRecord、NormalizedRoom、normalizePayload、校验、INSERT / UPDATE 列 |
| `src/domain/booking.ts` | RoomRow 与 BoardRoom 加字段；顺手补上原本缺声明的 `group_name`（`tsc --noEmit` 本来是报错的） |
| `src/domain/demoSeed.ts` | 种子房间带上示例位置描述 |
| `tests/room.test.ts` | 4 例：落库读回、空串归 null、超长 M4000、与 locationNote 互不干扰 |

**apps/meeting/web**

| 文件 | 改动 |
|------|------|
| `features/admin/useRoomForm.js` | emptyForm / applyRoom / toPayload / 50 字校验 |
| `features/admin/RoomFormPage.vue` | 「基本信息」里加输入框，放在所在位置与容纳人数之间 |
| `features/admin/components/RoomTable.vue` | 列表加「位置描述」列，空显示 `-` |
| `features/booking/components/PcRoomPopover.vue` | 基础信息加一行 |
| `features/booking/components/RoomDetailModal.vue` | 加「位置描述」行；原「门牌/位置指引」（读的是 locationNote）改回「备注」，避免两个字段语义打架 |
| `features/booking/components/MobileRoomList.vue` | 房间卡片副标题下多一行位置描述（有才显示） |

## 验证

```
apps/contact:            mvn -o test → Tests run: 66, Failures: 0, Errors: 0
                         mvn -o -DskipTests package → BUILD SUCCESS
apps/meeting/server:     tsc --noEmit 干净；pnpm test → 125 pass / 0 fail
apps/meeting:            pnpm build 通过（server tsc → vue-tsc → main/zx/m → mergeDist）
```

测试库 `192.168.10.31:3306/zx_contact` 已执行 ALTER，`meeting_room.locationDesc` 列存在。

## 待办 / 阻塞

- (全端) 未起服务做运行时联调：管理端新建/编辑填位置描述 → 列表列、PC 房间弹窗、移动端房间卡片/详情各看一遍；重点验「清空已填的位置描述并保存」能落 null（这正是 `FieldStrategy.IGNORED` 要解决的）
- (meeting) 本功能改动混在前端重构的脏区里未单独提交，等重构那条线收口时一起提
- (contact) `context/contracts/` 下没有会议室房间的契约文件（只有 agent 与 bookingLifecycle），本次没地方同步；要补的话得新开 `contracts/meeting/room.d.ts`

## 关键决策记录

- 2026-09-01 **新增独立字段而不是复用 locationNote**（用户选择）。复用会让现存的通用备注（投影线、使用须知）语义变味
- 2026-09-01 上限 50 字：位置指引写不了那么长，比 locationNote 的 100 字短一档，也在表单上区分开两者定位
- 2026-09-01 Node 端保留同步实现——前端目前仍打 `/meetingApi` → Node（Java 侧的 Task 12 切路径没做），不同步改 Node 的话本地根本存不进这个字段

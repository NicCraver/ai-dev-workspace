# Status：会议室后端落 contact

> 最后更新：2026-08-31（spec 完成）｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

后端功能，矩阵按分期而非按端。`meeting web` 一列指前端需要配合改的部分。

| 阶段 | contact（Java） | meeting web |
|------|-----------------|-------------|
| 建表 + 实体/Mapper + 字典 CRUD | ⬜ | — |
| 会议室 CRUD + 列表过滤分页 | ⬜ | — |
| 看板 + 冲突检测 + 预定创建（批次事务） | ⬜ | — |
| 修改 / 释放 / 审计 / 管理员列表 | ⬜ | — |
| 切 baseURL 与路径、逐屏联调 | ⬜ | ⬜ |

## 待办 / 阻塞

- (contact) 按 spec 分期 1 开工：建表脚本 + 四个实体
- (阻塞分期 4) 管理员怎么判待定：2026-09-01 问后端同事，问题清单见 spec「管理员判定」小节
- (运维) 网关 `/meetingApi` → `zx-contact` 的前缀映射待确认，不阻塞开发
- (meeting web) 联调阶段要改 `web/src/server/module/*.js` 的路径与方法（Node 的 `PUT /资源/:id` → contact 惯例的 `POST /动作/{id}`），只改路径不改逻辑

## 关键决策记录

- 2026-08-31 表建在同库 `zx_contact`，`meeting_` 前缀，不新开库（新开库要加多数据源，本轮不值当）
- 2026-08-31 agent（`/agent/suggestions`、`/agent/turn`）一期不搬，继续留 Node，改调新的 Java 接口取数
- 2026-08-31 错误码沿用 Node 的 `M4000/M4001/M4002/M4003/M4004/M4010`，**不改成 contact 的 `C_D_001` 风格**——前端提示与 agent 的 `M4010` 分支依赖这些码
- 2026-08-31 时间沿用 `date` + `startMin/endMin` 分钟数模型，不改 datetime（冲突判定与跨端时区会重写）
- 2026-08-31 租户/用户从 contact 的 `SessionContext` 取，替代 Node 的 `zxCorpId/zxUserId` header
- 2026-08-31 管理员判定 ⏸ **待定**，2026-09-01 问后端同事。先抽 `MeetingAdminChecker` 接口 + 配置项临时实现，只影响分期 4
- 2026-08-31 代码参照 `com.zgiot.zx.position` 的分层写法
- 2026-08-31 **全企业开放，不设白名单**（先前定的 `meeting.corp.whitelist=6` 已撤销）；试点范围由运营控制微应用入口可见性，后端不限制
- 2026-08-31 PC 切企业会清空已打开的微应用（`open-panel.vue:139`），会议室被关闭、重开时拿到新 corpId，**不存在 stale corpId**（早前判断有误已更正）
- 2026-08-31 多企业：可见/可预定范围**仅本企业**，不做集团子树、不做关联企业；外协不特判
- 2026-08-31 corpId **只认 `SessionContext`**（网关经 `zxCorpId` header 注入），忽略前端业务参数里的 corpId
- 2026-08-31 `hostUserId` 存企业内 `user.id`（用 `(accountId, corpId)` 查得），**不存 accountId**，否则跨企业「我的预定」串台；查不到 user 直接拒（`M4002`），顺带堵伪造 corpId

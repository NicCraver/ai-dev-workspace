# Spec：ios / 安卓 · 群机器人可 @ 判定

> 状态：**设计已确认，见 plan.md**；最后更新：2026-07-29

## 背景与目标

群聊「@人」列表会展示本群机器人；部分机器人（`chatRobotType = 1`）只有配置了回调地址（`hasCallBackAddress = 1`）才支持被 @。现状两端会把群内全部机器人塞进 @ 列表，且消息「@回复」未按同一规则收敛，导致用户 @ 了无法响应的机器人。

**成功标准**

1. `@` 候选人列表只出现可 @ 的机器人（不可 @ 的直接不展示）。
2. 机器人消息：可 @ → 显示「@回复」；不可 @ → 只显示普通「回复」（不藏「回复」）。
3. 机器人数据仍来自 `POST /api/chat/v1/group/get` 的 `groupRobots[]`（不新开接口）。
4. 本期只改 **android + ios**；web / desktop 不动。

## 可 @ 判定（唯一规则）

```
canAtRobot(robot) =
  String(chatRobotType) !== "1"
  || String(hasCallBackAddress) === "1"
```

| chatRobotType | hasCallBackAddress | 可 @？ |
|---------------|--------------------|--------|
| `1` | `1` | ✅ |
| `1` | `0` / 缺省 / 其它 | ❌ |
| 非 `1`（含缺省） | 任意 | ✅ |

比较时统一转成字符串再比，避免接口回 number / string 混用踩坑。

## 用户流程

### A. 输入框 `@` 选机器人

1. 用户在群聊输入 `@`，打开候选人列表。
2. 列表数据源仍为群详情缓存的 `groupRobots`（随 `group/get` 落库 / 挂在群模型上）。
3. 组装列表时对每个机器人跑 `canAtRobot`；**false 则跳过，不进列表、不置灰**。
4. 可选中的机器人行为与现网一致（插入 mention）。

### B. 消息「@回复」

1. 用户长按 / 快捷菜单点机器人发出的消息。
2. 用该消息 `senderUserId`（`robot_…`）在本群 `groupRobots` 中查对应机器人。
3. `canAtRobot == true` → 菜单含「@回复」（与现网一致，会插入 @）。
4. `canAtRobot == false` → **隐藏「@回复」**，仍保留普通「回复」。
5. 查不到机器人详情时：按不可 @ 处理（不展示「@回复」），避免误 @。

## 范围

### 本期做

- 契约：登记 `group/get` → `groupRobots[]` 的 `chatRobotType`、`hasCallBackAddress`
- Android：解析并持久化 `hasCallBackAddress`；`GroupAtFragment` 过滤；消息菜单「@回复」按规则
- iOS：模型补字段；`@` 列表过滤；消息菜单「@回复」按规则
- 两端共用同一判定语义（各端一个小 helper 即可）

### 本期不做

- web / desktop
- 改群设置页「群机器人」列表（仍展示全部机器人，含不可 @ 的）
- 改群智能体 / 个人 AI 的 `@` 与 `@回复` 逻辑
- 后端过滤 `groupRobots`（客户端本地判定）

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本期实现 | — | ✅ | ✅ | — |
| 机器人缓存 | — | GreenDao `GroupRobot` | `ZXGroupModel.groupRobots` | — |
| @ 列表入口 | — | `GroupAtFragment` | `ZXATContactContainerView` | — |
| @回复 菜单 | — | `RongMessageItemLongClickActionManager` | `ZXIMCellLogic getMessageMenuItems` 等 | — |

## 依赖的接口

| 接口 | 字段 | 说明 |
|------|------|------|
| `POST /api/chat/v1/group/get` | `data.groupRobots[]` | 既有；确认为本功能机器人唯一来源 |
| 同上 | `groupRobots[].chatRobotType` | 既有；两端模型已有 |
| 同上 | `groupRobots[].hasCallBackAddress` | **新增消费**；两端模型目前缺失，需解析落库 |

契约文件：新建或扩展 `context/contracts/` 下 `group/get` 机器人片段（可与现有 `groupGet.groupAgentRels.d.ts` 并列，如 `groupGet.groupRobots.d.ts`）。

## 数据流

```
group/get
  └─ groupRobots[]  ──解析/落库──►  本地群机器人缓存
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                                       ▼
            @ 候选人列表                            消息菜单 @回复
         filter(canAtRobot)                 sender=robot_ → 查缓存 → canAtRobot
```

## 边界与错误处理

| 情况 | 行为 |
|------|------|
| `hasCallBackAddress` 缺省且 type=1 | 不可 @ |
| `chatRobotType` 缺省 | 视为可 @（非 1） |
| 本地尚无群详情 / 无该 robot | `@` 列表无此项；消息侧不展示「@回复」 |
| 群设置机器人列表 | **不过滤**（与 @ 列表无关） |

## 关键决策记录

- 2026-07-29 不可 @ → 菜单只藏「@回复」，保留「回复」
- 2026-07-29 本期只做 android + ios
- 2026-07-29 不可 @ 机器人在 @ 列表直接不展示
- 2026-07-29 采用客户端本地判定（方案 1），不依赖后端过滤列表
- 2026-07-29 数据来源确认：`group/get.groupRobots`
- 2026-07-29 查不到机器人详情时，@回复 按不可 @ 处理

# Impl Notes：ios · 群机器人可 @ 判定

> 平台无关。最后更新：2026-07-29（安卓已撤回，仅 ios）

## 数据源

- 群机器人唯一来源：`POST /api/chat/v1/group/get` → `data.groupRobots[]`
- 随群详情拉取落本地缓存；`@` 列表与消息菜单均读缓存，不另开接口

## 可 @ 判定

```
canAtRobot =
  String(chatRobotType) !== "1"
  || String(hasCallBackAddress) === "1"
```

- `chatRobotType` / `hasCallBackAddress` 比较前统一转字符串（兼容 number / string）
- `type` 缺省或非 `"1"` → 可 @
- `type === "1"` 且 `hasCallBackAddress` 非 `"1"`（含缺省）→ 不可 @

## UI 行为

| 场景 | 可 @ | 不可 @ |
|------|------|--------|
| `@` 候选人列表 | 展示 | **不展示** |
| 消息菜单「@回复」 | 显示 | **隐藏** |
| 消息菜单「回复」 | 不变 | **仍显示** |
| 群设置机器人列表 | 不过滤 | 不过滤 |

查不到该 `robot_` 的详情时：按不可 @（不展示「@回复」）。

## 边界

- 旧缓存无 `hasCallBackAddress`：`type=1` 的机器人会暂时不可 @，等下次 `group/get` 刷新
- 群设置页机器人列表**不要**套用本过滤
- **android 本期不做**（改动已撤回）

## 联调坑

- （待抓包）确认 `hasCallBackAddress` 字段名与取值（0/1 或 `"0"`/`"1"`）

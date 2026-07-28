# Android Personal AI 选择壳对齐说明

> 2026-07-28。等价于 iOS [`design-ios-picker-rebuild.md`](./design-ios-picker-rebuild.md) 的 Mode 行为；实现形态不同。

## 与 iOS 的差异（刻意保留）

| | iOS | Android |
|--|-----|---------|
| 壳形态 | 单 Controller + mode | 两 Activity（`SelectAiAgent` / `SelectDataRange`）+ `EXTRA_MULTI` |
| 共享已选 | 内存 `selectedArray` | Intent 传递 `EXTRA_SELECTED_SCOPES` |
| 桥 | `selectAiAgent` / `selectDataRangeScope` | 同名，仍开现有两 Activity |

行为表与 iOS 一致：AI 框点选即回；数据范围仅首页确定落库；子页「完成」只写回。

## 本轮补齐

- 新建 `SelectContactActivity`（组织|外联企业）+ `SelectOrgDrillActivity`（面包屑钻取）
- 去掉对 `ChooseAddressMemberFragment` 的依赖
- 分区头 / 搜索框样式与首页「最近聊天」对齐

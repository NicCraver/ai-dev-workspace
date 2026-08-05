# Spec：web DataRangeBar 点击类型弹窗不贴左且略加宽

> 最后更新：2026-08-05

## 背景与目标

首页输入区 FilterBar 中的「类型」选择器（`DataRangeBar`）使用 `el-popover` 弹出多选列表。当前实现宽度为 `200`，且 Element Plus 默认 `preventOverflow.padding` 四边为 `0`，当触发胶囊靠近页面左侧时，弹层会贴死视口左边缘，观感拥挤。

**成功标准**

1. 打开「类型」弹层后，相对整页视口左缘至少有约 **12px** 留白，不再贴死。
2. 弹层宽度由 **200 → 240**。
3. 勾选 / 全选 / 清空等交互与文案不变；仅视觉定位与宽度变化。

## 用户流程

1. 用户点击「类型」胶囊 → 弹出多选面板。
2. 面板在触发器上方展示，相对视口左（及必要时右/上下）保留约 12px 边距。
3. 用户勾选选项或关闭面板 → 行为与改前一致。

## 范围

- 本期做：
  - 仅修改 `apps/web/src/components/views/home/commons/DataRangeBar.vue` 的「类型」`el-popover`。
  - `:width` 改为 `240`。
  - 通过 `:popper-options` 追加 `preventOverflow` 修饰，`padding: 12`（覆盖 EP 默认四边 0）。
- 本期不做：
  - 不改 FilterBar 内时间范围、DataScope、邮件等其他弹层。
  - 不改勾选逻辑、接口、文案。
  - 不单独改 android / ios / desktop 原生代码（内嵌 Web 随 web 生效）。

## 各端差异点

| 差异点 | web | android | ios | desktop |
|--------|-----|---------|-----|---------|
| 本需求 | 改 DataRangeBar 弹层 | 无（WebView 复用） | 无（WebView 复用） | 无（内嵌 Web 复用） |

## 技术方案

采用 Element Plus `el-popover` 的 `popperOptions`，向 `@popperjs/core` 追加同名 `preventOverflow` 修饰（createPopper 会按 name merge，后写 options 覆盖默认 `padding: 0`）：

```js
{
  modifiers: [
    {
      name: "preventOverflow",
      options: { padding: 12 }
    }
  ]
}
```

宽度：`:width="240"`。

## 依赖的接口

无。纯 UI 定位与宽度调整。

## 待用户确认的问题

无（已确认：视口左边距约 8–12px 取 12；宽度取 240；方案 A）。

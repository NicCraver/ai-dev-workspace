# Spec：会议室前端重构

> 由 Superpowers brainstorm 产出后覆盖本模板。最后更新：2026-08-31

## 背景与目标

会议室 Web（`apps/meeting/web`）色值已接近智信 DESIGN.md，但令牌叫 `--color-*`，几乎没有基础组件：后台直接用 `el-button` / `el-dialog`，预定页手写 overlay / sheet / 内联 SVG。原型仓库 `zhixin-prototype` 已有 `--zx-*` 令牌和 `Ac*` 组件库。

本期把会议室前端对齐智信设计系统：**不改业务流程和 HTTP 接口**。成功标准：

1. `--zx-*` 是令牌唯一来源；既有 `--color-*` 仍解析到相同色值（不必一次改光所有 `var(--color-*)`）。
2. 后台、预定 PC、预定移动的按钮 / 弹窗外壳 / 空态 / 加载 / 顶栏 / 状态标改用移植后的基础组件。
3. 父页面仍用现有 `v-if` 开关弹层（命令式 `showXxx` 只给以后新弹窗）。
4. `apps/meeting` 的 `pnpm test` 通过。

## 用户流程

无新用户流程。预定（选时段 → 新建日程 → 我的预定 / 释放）、后台（会议室 CRUD、字典、预定记录审计）交互步骤不变。可见变化：控件尺寸 / 圆角 / 弹窗标题栏跟智信组件走；`AcDialog` 默认不能点遮罩或 Esc 关闭（手写 overlay 原先可以）。移动 sheet 仍走 `XPopup`，默认点遮罩可关，与现在一致。

## 范围

- 本期做：
  - 拷贝原型 `tokens.css` 为 `--zx-*`，旧名改成别名
  - Element Plus / Vant 主题接到 `--zx-*`
  - 按需拷贝基础组件到 `web/src/components/base/`
  - 后台 `el-button` / `el-dialog` → `AcButton` / `AcDialog`；状态 `el-tag` → `ZxStatusTag`
  - 预定 PC 弹窗外壳 → `AcDialog`；移动 sheet → `XPopup`；移动顶栏 → `NavBarHeader`；空态 → `AcEmpty` / `MEmpty`；列表状态标 → `ZxStatusTag`；需要处用 `SvgIcon` / `AcPageLoading`
  - Uno 主题补齐原型同名色与字号，保证拷过来的原子类能上色
- 本期不做：
  - 后端、契约、预定循环 / 审计逻辑
  - 把现有弹窗全部改成命令式 `showXxx()`
  - 拷 O5 / 头像 / 文件卡 / 全套 300+ svg
  - 按 `apps/meeting/designs/` 重排时间轴和筛选
  - 原生 android / ios / desktop

## 各端差异点

会议室是独立 Web，内嵌于智信 PC / iOS / 安卓 WebView。本期只动 meeting web。

| 差异点 | web（meeting） | android | ios | desktop |
|--------|----------------|---------|-----|---------|
| 实现面 | MPA 三入口共用同一套 `features/` | 不改 | 不改 | 不改 |
| PC 弹窗 | `AcDialog`（默认不点遮罩关） | — | — | 内嵌 `/meeting/zx/` 走同一套 PC 页 |
| 移动弹层 | `XPopup`（默认点遮罩关） | 内嵌 `/meeting/m/` | 同左 | — |

## 依赖的接口

不新增、不改契约。继续用现有 `web/src/server/module/*`。

## 待用户确认的问题

已冻结（2026-08-31）：

1. 成功标准 = 设计系统对齐，不改业务（选项 A）
2. 按需拷贝组件进 meeting，不 submodule（选项 A）
3. 外壳换成 `AcDialog` / `XPopup`，父级 `v-if` 不动（选项 A）
4. 落地顺序：令牌 → 组件 → 后台 → 预定 PC → 预定移动（方案 1）

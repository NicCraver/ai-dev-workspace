# Spec：数据范围选择组件合一（web）

> 2026-09-03 ｜ 仅 web 端。PC / iOS / 安卓均已内嵌 web 页，不涉及原生改动。

## 背景

「选择数据来源 / 数据范围」在 web 端有两个平行实现：

| 文件 | 行数 | 入口页 | 宿主 |
|---|---|---|---|
| `picker/SelectDataRangeDialog.vue` | 946 | `/zx/data-range` | PC（desktop `data-range-iframe.vue` 内嵌） |
| `picker/SelectDataRangePopup.vue` | 930 | `/m/data-range` | 移动（iOS / 安卓整页 webview） |

两者 script 顶层 34 个符号中 **30 个同名同实现**，差异只有形态相关的 4 个：Dialog 的 `dialogVisible`、`orgSecretTagLookup`，Popup 的 `searchLayerOpen`、`searchInputRef`、`submitTitle`。

后果：任何 tab 级改动都要写两遍。周工作 tab 就是各接了一次 `WeekWorkPicker`，两边同名 handler `onWeekWorkKeys` / `onWeekWorkExtra` / `removeWeekWorkKey` 逐字重复。

模板层差异是真实的（diff 441 行）：移动端有整屏搜索层、自绘 header/底栏，PC 是 AcDialog + el-popover 下拉。**但重复的是逻辑，不是样式。**

## 目标

新增或修改一个 tab（取数、勾选、计数、提交口径、tab 条本身）只写一处。两端现有交互与视觉保持不变。

非目标：改选择逻辑、改接口、动 `dataScopeModel.js` / `weekWorkModel.js` / `dataRangeSavePayload.js` 的既有实现，或碰其它三端。

## 方案

新目录 `apps/web/src/components/views/personal-ai/picker/dataRange/`：

| 文件 | 职责 |
|---|---|
| `useDataRangePicker.js` | 唯一逻辑源。状态（选中 Set、`extraSelected`、周工作 Set/Map、候选清单、收纳组、展开态、搜索态）+ 派生（计数、三态、`displayList`、`currentSelectableKeys`）+ 行为（`toggleItem` / `toggleStorage` / `toggleExpand` / `toggleSelectAllCurrent` / `onSearchSelect` / `removeItem` / `clearAll` / `selectAllItems` / 周工作三件套 / `buildSubmitPayload`）+ 取数 `load()` |
| `DataRangeBody.vue` | 整个内容区。一级 tab（知识聊天 / 周工作）、二级 tab、三级胶囊、表头全选、`AiBoxVirtualList`、`OrgPicker`、`WeekWorkPicker`、搜索、已选 chip 弹层 |
| `tabs.js` | `SCOPE_TABS` / `TABS` / `LIST_TABS`，现在两边各一份 |

两个壳瘦身为容器：`SelectDataRangeDialog.vue` = `AcDialog` + `DataRangeBody variant="pc"`；`SelectDataRangePopup.vue` = `XPopup` + `DataRangeBody variant="mobile"`。壳保留各自的 props（`open` / `instant`）与 emit 出口，不含选择逻辑。

### 形态差异的注入方式

`variant="pc" | "mobile"` prop，`DataRangeBody` 内部按它分支：

| 差异点 | pc | mobile |
|---|---|---|
| 搜索 | `AiBoxSearchBox` 输入框 + 下拉面板 | 点入口铺整屏搜索层（`SearchInput` + `AiBoxSearchPanel`），`nextTick` 后聚焦拉键盘 |
| 已选 chip 弹层 | `el-popover` 向上弹 | 底部抽屉 |
| tab 条 / 行高 / 间距 | PC 尺寸 | 移动尺寸 |
| 组织架构涉密标 | 传 `orgSecretTagLookup` | 不传 |

取舍：`DataRangeBody.vue` 会到 700–900 行，两端样式后续各自演进时分支会变多。接受——换来的是逻辑单点。真到分叉严重时再把搜索那块拆成 `SearchDropdown.vue` / `SearchFullscreen.vue` 两个外观件。

### 按钮与 body 的边界

确定 / 取消按钮**不进 body**：PC 的在 `AcDialog` footer，移动的在自绘底栏，位置由壳决定。

- body `defineExpose({ submit })`，壳的按钮调它
- body `emit("submit", { scopes, flags })` 冒泡到壳，壳再按自己的协议对外（PC `update:open` 关窗，移动 `emit("submit")` 交给 `xPopupWrapper` resolve）
- 已选计数 body `emit("update:count", n)`，壳自己渲染 `确定(N)`

### 一级 tab 的归属（有视觉影响）

「知识、聊天 / 周工作」这条移进 `DataRangeBody` 顶部，PC 壳**不再使用 `AcDialog #custom-header`**。这条现在 PC 在标题栏、移动在自绘 header，是重复最刺眼的一处；不挪就仍要写两遍。

代价：PC 上这条从标题栏位置下移到内容区顶部，需用 variant 调 padding / 高度对齐原样。**必须目视回归。**

### 初始化时机

现在 PC 是 `watch(props.open)` 重置 + 取数，移动是 `onMounted`。统一到 body 的 `onMounted`：PC 壳用 `v-if="open"` 让 body 每次打开重建。

前置确认：`AcDialog` 是否会提前挂载 content（若默认渲染，需 `destroyOnClose` 或壳内 `v-if`）。

## 验证

1. `pnpm build`（含 `vue-tsc`）通过
2. `node --test` 三个既有 model 测试仍绿（测的是纯 JS model，本次不动它们）
3. 浏览器目视两端 `/zx/data-range` 与 `/m/data-range`：
   - 一级 tab 切换（含 PC 上位置视觉与原先一致）
   - 二级 tab（对话列表 / 最近 / 组织架构）+ 三级胶囊（全部 / 收纳组）
   - 收纳组展开收起、组三态联动
   - 表头全选 / 半选
   - 搜索：PC 下拉、移动整屏层（含聚焦拉键盘）勾选后回列表选中态保持
   - 周工作 tab 勾选与「全部」胶囊全选口径
   - 已选 chip 弹层：计数、单个移除、清空
   - 确定回传 `{ scopes, flags }`；PC 关窗、移动 resolve 落库

## 风险

- **一级 tab 位置视觉变化**：唯一会动到 UI 的点，靠目视兜。
- **`AcDialog` 挂载时机**：若不支持延迟挂载，PC 需在壳里 `v-if`，且要确认关闭动画期间 body 卸载不会闪。
- **移动搜索层聚焦**：`nextTick` + `searchInputRef.focus()` 从壳挪进 body 后仍要能拉起键盘，真机（iOS webview）验证。
- 本次改动与活跃功能 `20260901-数据范围选择周工作` 在同一分支同一批文件上，先合一再继续周工作，避免两边各改一遍。

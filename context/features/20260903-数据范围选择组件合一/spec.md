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
| `useDataRangePicker.js` | 唯一逻辑源。状态（选中 Set、`extraSelected`、周工作 Set/Map、候选清单、收纳组、展开态、搜索态）+ 派生（计数、三态、`displayList`、`currentSelectableKeys`）+ 行为（`toggleItem` / `toggleStorage` / `toggleExpand` / `toggleSelectAllCurrent` / `onSearchSelect` / `removeItem` / `clearAll` / `selectAllItems` / 周工作三件套）+ `init()` / `resetTransient()` / `buildSubmitPayload()` |
| `DataRangeScopeTabs.vue` | 一级 tab 条（知识聊天 / 周工作）。位置由壳决定：PC 进 `AcDialog #custom-header`，移动进自绘 header |
| `DataRangeSecretTip.vue` | 涉密说明气泡 |
| `DataRangeSelectedBar.vue` | 已选计数 + chip 弹层 + 清空按钮（`section="selected" | "clear"` 分两块，PC 要塞进 AcDialog 两个不同 slot） |
| `DataRangeBody.vue` | 内容区：二级 tab、三级胶囊、表头全选、`AiBoxVirtualList`、`OrgPicker`、`WeekWorkPicker` 挂载、搜索（PC 下拉 / 移动整屏层） |
| `tabs.js` | `SCOPE_TABS` / `TABS` / `LIST_TABS` / `FALLBACK_SECRET_TIP`，现在两边各一份 |

两个壳瘦身为容器：`SelectDataRangeDialog.vue` = `AcDialog` + 四个 slot 装配；`SelectDataRangePopup.vue` = `XPopup` + 自绘 header/footer。壳保留各自的 props（`open` / `instant`）与 emit 出口，不含选择逻辑。

**状态共享方式**：壳里创建 picker 实例，以 `:picker` prop 传给各共用组件（body 与 selected-bar 在 PC 上分处 AcDialog 不同 slot，必须共用同一实例）。不用 provide/inject —— 显式传参更好查。

**依赖注入**：`useDataRangePicker.js` 不 import `@/server/module/personalAiFrame.js`，接口函数由壳作为 `deps` 传入。原因：`node --test` 不解析 vite 的 `@/` 别名，带别名的文件无法被单测直接 import（仓库既有 `useAiBoxPickerData.js` 也守这条）。

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

### 一级 tab 的归属（写 plan 时修订，已无视觉风险）

「知识、聊天 / 周工作」这条抽成独立小件 `DataRangeScopeTabs.vue`，**位置仍由壳决定**：PC 放 `AcDialog #custom-header`，移动放自绘 header。标记只写一次，两端视觉零变动。

> 原方案是把它挪进 `DataRangeBody` 顶部、PC 放弃 `custom-header`，代价是 PC 上这条要从标题栏下移到内容区并调 padding 对齐。抽小件后这个取舍不存在了，作废。

### 初始化时机（写 plan 时修订）

picker 实例建在壳里（body 与 selected-bar 要共用它），初始化时机也就留在壳里：PC `watch(props.open)` 调 `picker.init()`（关闭时调 `resetTransient()`），移动 `onMounted` 调 `picker.init()`。各 3 行。

`AcDialog` 已确认带 `:destroy-on-close="true"`（`AcDialog.vue:5`），PC 每次打开都是新内容树，不需要额外加 `v-if`。

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

- **移动搜索层聚焦**：`nextTick` + `searchInputRef.focus()` 从壳挪进 body 后仍要能拉起键盘，真机（iOS webview）验证。
- 本次改动与活跃功能 `20260901-数据范围选择周工作` 在同一分支同一批文件上，先合一再继续周工作，避免两边各改一遍。

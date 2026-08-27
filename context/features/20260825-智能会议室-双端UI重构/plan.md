# 智能会议室双端 UI 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将管理端与预定端原型重构为共享设计基线、字段语义一致且关键流程完整的“安静效率工作台”。

**Architecture:** 两套 HTML 原型继续独立运行，通过 `designs/shared/` 共享设计令牌、基础样式和房间字段定义。管理端围绕列表与表单，预定端按移动卡片和桌面时间轴拆分；平台特有布局不做跨端组件复用。

**Tech Stack:** React 18 UMD、Babel Standalone、原生 CSS、localStorage、现有内联 SVG 图标。

## Global Constraints

- 只修改 `apps/meeting/designs/`，不修改 `web/`、`server/`、接口契约或原生宿主。
- 不增加 npm 依赖、构建工具或第三方 UI 库。
- 主色固定为 `#3E7EFF`；设施枚举固定为 `电视 / 电话 / 投影仪 / 白板 / 视频会议`。
- 管理端不保留字典页、字典入口、字典状态或字典 localStorage。
- 预定事件独立于 Room 主数据；两端 Room 使用 `buildingName`、`floorName`、`openStart`、`openEnd`。
- 所有脚本继续放在模块顶层；不新增函数体内动态 import。
- 不提交 git commit，除非用户另行明确要求；完成后只提供建议提交信息。

---

## 文件职责

### 新增

- `designs/shared/tokens.css`：颜色、字体、间距、圆角、阴影、动效和响应式基础令牌。
- `designs/shared/base.css`：reset、焦点、按钮/输入基础状态、浮层和无障碍工具类。
- `designs/shared/room-schema.jsx`：固定设施枚举、Room 默认值、字段归一化和设施格式化。
- `designs/zhixin-meeting-mobile/components-shared.jsx`：Toast、Dialog、Sheet、Drawer、空态等反馈组件。
- `designs/zhixin-meeting-mobile/components-mobile.jsx`：移动端导航、筛选、房间卡片、预定表单和我的预定。
- `designs/zhixin-meeting-mobile/components-desktop.jsx`：桌面工具栏、筛选区、房间信息列和抽屉内容。

### 删除

- `designs/zhixin-meeting-room/components-dict.jsx`
- `designs/zhixin-meeting-room/tokens/tokens.css`
- `designs/zhixin-meeting-mobile/tokens/tokens.css`
- `designs/zhixin-meeting-mobile/components.jsx`

### 主要修改

- 两套 HTML：先加载共享 CSS 和 schema，再加载各端组件。
- 两套 `data.jsx`：统一字段和设施枚举，拆分预定事件。
- 两套 `app.jsx`：按领域数据、筛选、选择、弹层和提交状态重组。
- 管理端 `components-shared.jsx`、`components-list.jsx`、`components-form.jsx`、`styles.css`。
- 预定端 `mobile-timeline.jsx`、`pc-timeline.jsx`、`styles.css`。
- 两套 `_d_meta.json`：更新重构说明、页面清单和评审状态。

---

### Task 1：建立共享设计基线和房间模型

**Files:**
- Create: `designs/shared/tokens.css`
- Create: `designs/shared/base.css`
- Create: `designs/shared/room-schema.jsx`
- Modify: `designs/zhixin-meeting-room/Meeting Room Management.html`
- Modify: `designs/zhixin-meeting-mobile/Mobile Room Reservation.html`
- Modify: `designs/zhixin-meeting-room/data.jsx`
- Modify: `designs/zhixin-meeting-mobile/data.jsx`

**Interfaces:**
- Produces: `window.MeetingSchema.FACILITIES`
- Produces: `window.MeetingSchema.normalizeRoom(room)`
- Produces: `window.MeetingSchema.formatFacilities(facilities)`
- Produces: `window.MANAGEMENT_ROOMS`
- Produces: `window.RESERVATION_ROOMS`
- Produces: `window.ROOM_BOOKING_EVENTS`

- [ ] **Step 1：定义共享令牌**

从两套现有 `tokens/tokens.css` 合并出单一来源。至少包含：

```css
:root {
  --zx-primary: #3e7eff;
  --zx-primary-hover: #2f6fe8;
  --zx-text-1: #1f2329;
  --zx-text-2: #646a73;
  --zx-text-3: #8f959e;
  --zx-border: #dee0e3;
  --zx-canvas: #f5f7fa;
  --zx-surface: #ffffff;
  --zx-success: #00a870;
  --zx-warning: #d97904;
  --zx-danger: #d92d20;
  --zx-radius-control: 6px;
  --zx-radius-surface: 10px;
  --zx-focus-ring: 0 0 0 3px rgb(62 126 255 / 20%);
}
```

- [ ] **Step 2：定义共享模型**

`room-schema.jsx` 暴露稳定全局接口：

```jsx
window.MeetingSchema = {
  FACILITIES: ["电视", "电话", "投影仪", "白板", "视频会议"],
  normalizeRoom(room) {
    return {
      groupName: null,
      locationNote: null,
      openStart: "07:00",
      openEnd: "23:00",
      enabled: true,
      ...room,
      buildingName: room.buildingName || room.building || "",
      floorName: room.floorName || room.floor || ""
    };
  },
  formatFacilities(facilities) {
    const values = this.FACILITIES.filter(item => (facilities || []).includes(item));
    return values.length ? values.join(" / ") : "—";
  }
};
```

- [ ] **Step 3：对齐 mock 数据**

管理端将“投影”改为“投影仪”，删除 `DICT_TYPES`、`INITIAL_DICTS`、`dictItems`、`dictNames`。预定端将 `building/floor/openTime` 改为 `buildingName/floorName/openStart/openEnd`，将 `busyEvents` 移入 `ROOM_BOOKING_EVENTS[roomId]`。

- [ ] **Step 4：调整加载顺序**

两套 HTML 均按以下顺序加载：

```html
<link rel="stylesheet" href="../shared/tokens.css">
<link rel="stylesheet" href="../shared/base.css">
<link rel="stylesheet" href="styles.css">
<script type="text/babel" src="../shared/room-schema.jsx"></script>
<script type="text/babel" src="data.jsx"></script>
```

- [ ] **Step 5：验证共享基线**

启动静态服务器：

```bash
python3 -m http.server 4173 --directory designs
```

在两个原型控制台执行：

```js
window.MeetingSchema.FACILITIES.join(",")
```

预期输出：

```text
电视,电话,投影仪,白板,视频会议
```

两个页面均应加载完成，控制台无 `ReferenceError` 和 CSS 404。

---

### Task 2：重构管理端壳层与列表

**Files:**
- Modify: `designs/zhixin-meeting-room/app.jsx`
- Modify: `designs/zhixin-meeting-room/components-shared.jsx`
- Modify: `designs/zhixin-meeting-room/components-list.jsx`
- Modify: `designs/zhixin-meeting-room/styles.css`
- Modify: `designs/zhixin-meeting-room/Meeting Room Management.html`
- Delete: `designs/zhixin-meeting-room/components-dict.jsx`

**Interfaces:**
- Consumes: `window.MANAGEMENT_ROOMS`, `window.MeetingSchema`
- Produces: `RoomListPage({ rooms, filters, onFilters, onEdit, onToggleEnabled, onCreate })`
- Produces: `AppShell({ children })`

- [ ] **Step 1：删除字典链路**

从 HTML 移除 `components-dict.jsx`；从 `app.jsx` 删除 `DICTS_KEY`、`dicts`、`dicts` 视图、导航分支及增删改停用处理。Room 列表和表单不再接收 `dicts`。

- [ ] **Step 2：收敛页面壳**

将侧栏改为 56px 轻量顶栏，仅展示“智信 · 智能会议室”和当前页面标题；移除 `corpId`、运行环境和“PC WebView / 浏览器”等原型调试文案。

- [ ] **Step 3：重构筛选区**

列表顶层使用受控筛选对象：

```jsx
const [filters, setFilters] = React.useState({
  keyword: "",
  enabled: "all",
  buildingName: "all",
  floorName: "all"
});
```

建筑变化时若当前楼层不属于新建筑，自动重置 `floorName`。筛选项显示为可清除条件，并保留统一重置。

- [ ] **Step 4：重构表格和空态**

表格保持名称、位置、人数、设施、开放时间、状态和操作列。名称下可保留分组作为弱化副文案。实现“完全无数据”和“筛选无结果”两种不同空态，后者只提供重置，不提供新建误导。

- [ ] **Step 5：补列表状态**

在原型中支持 `loading / ready / error`，列表骨架不造成布局跳动；错误状态提供“重新加载”。停用确认默认焦点落在取消按钮，启用失败保留当前列表状态。

- [ ] **Step 6：验证管理列表**

在 1280px 和 1440px 下验证：

1. 默认显示 5 条数据。
2. 搜索“路演厅”只显示一条。
3. 选择“生态城”后楼层选项只来自该建筑。
4. 筛选无结果时显示“没有符合条件的会议室”。
5. 停用需要确认，启用无需确认。
6. 页面不存在横向溢出，键盘可到达所有筛选与行操作。

---

### Task 3：重构管理端新建与编辑表单

**Files:**
- Modify: `designs/zhixin-meeting-room/components-form.jsx`
- Modify: `designs/zhixin-meeting-room/app.jsx`
- Modify: `designs/zhixin-meeting-room/styles.css`

**Interfaces:**
- Consumes: `window.MeetingSchema.FACILITIES`
- Produces: `RoomFormPage({ initialRoom, existingRooms, onSave, onCancel })`
- Produces: 完整 Room payload，不包含预定事件

- [ ] **Step 1：重排表单结构**

保持四段顺序：基本信息、设施、预定规则、备注。桌面使用两列字段栅格，备注和设施跨两列；小于 900px 时降为单列。

- [ ] **Step 2：替换建筑和楼层控件**

使用原型内自建 Combobox，实现搜索已有值和创建新值。建筑选项由现有房间去重产生；楼层按建筑联动。建筑上限 30 字，楼层上限 20 字。

- [ ] **Step 3：对齐设施和规则**

设施从 `MeetingSchema.FACILITIES` 渲染，按固定顺序输出。开放时间、提前预定范围、审批、周期、抢占和状态保持现有业务约束，不展示“仅数据落库”等研发注释。

- [ ] **Step 4：统一校验与错误聚焦**

提交时构建 `errors` 对象；无效时聚焦第一个带 `data-field-error` 的控件。名称冲突区分新建保存和停用后重新启用场景。

- [ ] **Step 5：增加固定保存栏**

取消与保存固定在内容底部安全区；保存中禁用二次点击并显示“保存中…”。Toast 只在成功后出现，字段错误始终显示在对应控件附近。

- [ ] **Step 6：验证表单**

逐条执行：

1. 缺名称、建筑、楼层或人数时阻止提交并聚焦首错。
2. 结束时间不晚于开始时间时阻止提交。
3. 保存后列表出现新房间且筛选状态仍保留。
4. 编辑页正确回填五类设施和三个规则开关。
5. 修改后取消触发放弃确认，未修改取消不触发。

---

### Task 4：拆分预定端组件并重构移动体验

**Files:**
- Create: `designs/zhixin-meeting-mobile/components-shared.jsx`
- Create: `designs/zhixin-meeting-mobile/components-mobile.jsx`
- Create: `designs/zhixin-meeting-mobile/components-desktop.jsx`
- Modify: `designs/zhixin-meeting-mobile/Mobile Room Reservation.html`
- Modify: `designs/zhixin-meeting-mobile/app.jsx`
- Modify: `designs/zhixin-meeting-mobile/mobile-timeline.jsx`
- Modify: `designs/zhixin-meeting-mobile/styles.css`
- Delete: `designs/zhixin-meeting-mobile/components.jsx`

**Interfaces:**
- Consumes: `window.RESERVATION_ROOMS`, `window.ROOM_BOOKING_EVENTS`
- Produces: `MobileRoomList`, `MobileRoomDetailSheet`, `MobileBookingSheet`, `MobileMyBookings`
- Produces: `getNextAvailableRange(roomId, date, events)`

- [ ] **Step 1：按职责迁移组件**

反馈、Sheet、Dialog、空态放入 `components-shared.jsx`；移动首页、房间详情、预定确认和我的预定放入 `components-mobile.jsx`；桌面专用内容放入 `components-desktop.jsx`。更新 HTML 脚本顺序，确认所有 `window.*` 导出只定义一次。

- [ ] **Step 2：重构移动首页**

首页顺序固定为导航、日期、搜索与筛选、结果摘要、房间卡片。房间卡片优先展示名称、位置、人数、设施、开放时间和“最近可预定时段”，不在每张卡片持续显示完整微型时间轴。

- [ ] **Step 3：重构时段选择**

房间详情内展示完整时段。第一次点击设置开始，第二次点击设置结束；选择跨越占用区间时阻止并给出原因。底部选择栏持续展示日期、房间、区间和时长。

- [ ] **Step 4：重构预定确认**

移动端使用底部面板或全屏页，保留会议主题、成员、周期设置和已选房间时段。提交前从 `ROOM_BOOKING_EVENTS` 再次检查冲突；冲突时保留表单并刷新时段。

- [ ] **Step 5：整理我的预定**

按“即将开始 / 历史记录”分组；进行中会议显示“提前释放”，未来会议显示“取消预定”。破坏操作均通过共享确认面板完成。

- [ ] **Step 6：验证移动流程**

在 390×844 视口验证：

1. 日期和筛选始终可访问。
2. 房间卡片主要信息一屏可扫读，点击热区不少于 44px。
3. 可完成“选日期 → 筛选 → 选房 → 选时段 → 提交”。
4. 冲突后输入不丢失。
5. 我的预定可查看和释放。
6. Sheet 关闭后焦点返回触发按钮，页面无横向滚动。

---

### Task 5：重构桌面时间轴与抽屉

**Files:**
- Modify: `designs/zhixin-meeting-mobile/components-desktop.jsx`
- Modify: `designs/zhixin-meeting-mobile/pc-timeline.jsx`
- Modify: `designs/zhixin-meeting-mobile/app.jsx`
- Modify: `designs/zhixin-meeting-mobile/styles.css`

**Interfaces:**
- Consumes: `window.ROOM_BOOKING_EVENTS`
- Produces: `PcToolbar`, `PcTimelineBoard`, `DesktopBookingDrawer`, `DesktopMyBookingsDrawer`

- [ ] **Step 1：收敛桌面工具栏**

将日期切换、今天、名称搜索、位置/人数/设施筛选、图例和我的预定整理为一条主工具栏；次要筛选在空间不足时进入“更多筛选”。

- [ ] **Step 2：稳定时间轴结构**

房间信息列固定宽度，时间刻度和房间行共享水平滚动容器；当前时间线、占用块、选中区间和不可用区间使用不同语义状态，颜色之外同时使用边框或纹理区分。

- [ ] **Step 3：统一选择逻辑**

桌面与移动端共用开始/结束、吸附、占用边界和冲突校验函数。保留 30 分钟吸附，不实现拖拽创建，避免增加不必要手势复杂度。

- [ ] **Step 4：将弹窗改为右侧抽屉**

房间详情、创建预定和我的预定在桌面均使用右侧抽屉；抽屉打开后时间轴保持原位置。关闭后焦点返回触发点。

- [ ] **Step 5：验证桌面预定**

在 1280px 和 1440px 下验证：

1. 左侧房间信息与时间刻度滚动保持对齐。
2. 日期、筛选和图例不会遮挡时间轴。
3. 可完成选时段和提交，抽屉关闭后选择上下文符合预期。
4. 我的预定抽屉可查看并释放。
5. 页面只允许时间轴内部横向滚动，浏览器页面本身不横向溢出。

---

### Task 6：补齐状态、清理元数据并完成浏览器验收

**Files:**
- Modify: `designs/zhixin-meeting-room/_d_meta.json`
- Modify: `designs/zhixin-meeting-mobile/_d_meta.json`
- Modify: 两套原型中本计划已触及的 JSX/CSS/HTML 文件

**Interfaces:**
- Produces: 两套可独立打开、无控制台错误的最终原型

- [ ] **Step 1：补齐统一状态**

逐页检查加载、无数据、筛选无结果、网络失败、身份失效、记录不存在、校验失败、名称冲突、时段冲突、提交中和成功反馈。状态文案使用面向用户的语言，不显示接口、corpId 或“仅落库”等实现细节。

- [ ] **Step 2：检查无障碍和减少动效**

所有图标按钮添加可读名称；输入具有关联 label；Dialog、Sheet、Drawer 管理焦点；加入：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3：更新设计元数据**

管理端元数据移除“字典表”说明；两套元数据记录共享设计系统、“安静的效率工作台”方向、页面清单和已验证视口。

- [ ] **Step 4：执行完整浏览器验收**

静态服务器保持运行，依次打开：

```text
http://localhost:4173/zhixin-meeting-room/Meeting%20Room%20Management.html
http://localhost:4173/zhixin-meeting-mobile/Mobile%20Room%20Reservation.html
```

完成 Task 2–5 的所有验证场景。检查控制台无 error、所有本地资源返回 200、390/1280/1440 三种视口无页面级横向溢出。

- [ ] **Step 5：检查变更边界**

确认 git diff 只包含 `apps/meeting/designs/` 和本功能的 context 文档，不包含 `web/`、`server/` 或用户既有的无关改动。不要自行提交。

---

## 完成定义

- 两套原型均能通过静态服务器独立运行。
- 管理端无字典入口及相关代码，列表和表单主路径完整。
- 预定端移动与桌面形态共享字段和时段逻辑，但保留各自布局。
- 两端设计令牌、Room 字段、设施枚举和反馈状态一致。
- 核心路径在 390px、1280px、1440px 下经真实浏览器验证。
- 未引入新依赖，未修改正式业务代码与接口范围。

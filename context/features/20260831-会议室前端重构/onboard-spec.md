# Spec：10 秒订到会议室（手动入口 + AI 找空闲 + 新手引导）

> 2026-08-31。目标：没用过系统的同事不看文档也能自己完成一次预约。三条路径共用同一套预约表单与 `POST /bookings`。

## 共用预约弹窗

唯一弹窗：现有 `CreateScheduleModal`（扩展可编辑字段）。提交只走 `createBooking` → `POST /bookings`。

打开来源：

| 来源 | 预填 |
|------|------|
| 「+ 预约会议室」 | 日期=今天；开始=当前时刻向后取整到下一个 30 分钟；时长=1 小时；会议室=列表第一间可改 |
| 时间轴空白格 | 该格会议室 + 拖选/点击时段 |
| AI 卡片「立即预约」 | 卡片上的会议室、日期、起止 |

字段：会议室、日期、开始、结束、会议主题、参会人（可选，写入 remark）。重叠时文案「该时段已被 {host} 占用」，禁用提交。

## 涉及文件（web）

- `features/booking/bookingDefaults.js` 默认时段
- `features/booking/bookingConflict.js` 前端重叠
- `features/booking/findFree.js` 找空闲解析/缺项/搜索/降级/预填映射
- `features/booking/aiChips.js` 快捷句
- `features/booking/bookingTour.js` localStorage 与步骤
- `PcToolbar.vue` 主按钮；`PcTimelineBoard.vue` hover；`BookingBoardPage.vue` 编排
- `CreateScheduleModal.vue` 可编辑表单
- `BookingAiBar.vue` 常驻输入 + chips + 卡片
- `BookingTour.vue` driver.js v1
- `AgentQueryCard.vue` 「立即预约」

Agent：找空闲主路径用看板数据在前端跑（不另写提交接口）。复杂闲聊仍可走现有 `/agent/turn`。无新契约文件；卡片字段对齐现有 query.rooms / slots。

## 引导锚点

`data-tour="room-table" | empty-slot | book-cta | ai-input | chip-find-free"`，key=`mr_tour_v1`。

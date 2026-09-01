# Plan：选择数据范围 · 周工作

> 每个任务标注涉及端。本期只做 web 前端界面与交互（mock）。

**Goal:** 在选择数据范围弹窗加入「周工作」tab，按设计稿完成四级子 tab、树/列表勾选与已选汇总。

## 文件

| 文件 | 职责 |
|------|------|
| `apps/web/.../picker/weekWorkModel.js` | key 规则、树展开、勾选、转 scope |
| `apps/web/.../picker/weekWorkMock.js` | 全部树 + 关注/所属/主管 mock |
| `apps/web/.../picker/WeekWorkPicker.vue` | 周工作面板（PC / 移动共用） |
| `SelectDataRangeDialog.vue` / `SelectDataRangePopup.vue` | 一级 tab、已选分组、清空 |
| `dataRangeSavePayload.js` | 透传记忆里的 `weekWork*` |

## Web

- [ ] (web) `weekWorkModel.js`：`ww_{1\|2\|3\|4}_{id}`；部门勾选联动子孙人员；板块独立；纯函数单测
- [ ] (web) `weekWorkMock.js` + `WeekWorkPicker.vue`：全部=树（含团队工作）；关注/所属/主管=扁平「团队/人员」
- [ ] (web) Dialog / Popup 标题栏加「知识、聊天 / 周工作」；底栏已选合并与分组
- [ ] (web) `buildSaveDataRangePayload` 透传 `weekWork*`，避免冲记忆

## 接口联调

- [ ] (web) 周工作树接口到位后替换 mock；tab 显隐改为 `dataRangeList` type=5 choose=1；确定时写入 `weekWorkScopeList` 与 8 个 `weekWorkSelectAll*`

## Android / iOS / Desktop

<!-- 跟 web 页走，本期不改原生 -->

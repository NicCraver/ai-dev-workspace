# Status：选择数据范围 · 周工作

> 最后更新：2026-09-01 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 周工作 tab + 四级子 tab + mock 列表勾选 | 🚧 界面已写，待打开弹窗目视 | — | — | — |
| 已选底栏合并（知识聊天 + 周工作） | 🚧 代码已接，待目视 | — | — | — |
| save 透传记忆中的 weekWork* | ✅ 单测覆盖 | — | — | — |
| 周工作树真实接口 | ⬜ | — | — | — |
| dataRangeList type=5 控制 tab 显隐 | ⬜ 现常显 | — | — | — |
| 自测通过 | ⬜ 未登录，浏览器没点开弹窗 | — | — | — |

android / ios / desktop 已内嵌 web 页，不单独做原生选择器。

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| web | feat/data-scope-storage-group | synced | 脏(8) | **本功能** | Dialog/Popup + WeekWorkPicker + mock，未 commit |
| context | main | ahead 113 | 脏(本功能文档) | 本功能 | spec/plan/status |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 本次改动

**apps/web**（未 commit）

| 文件 | 改动 |
|------|------|
| `picker/weekWorkModel.js` | key `ww_{type}_{id}`、树展开、部门联动人员、板块独立、已选只计 type 1/2 |
| `picker/weekWorkMock.js` | 全部树 + 关注/所属/主管扁平 mock |
| `picker/WeekWorkPicker.vue` | 二级 tab、搜索、胶囊、树 / 扁平列表、「含团队工作」 |
| `SelectDataRangeDialog.vue` / `SelectDataRangePopup.vue` | 标题栏「知识、聊天 / 周工作」；底栏已选分组 |
| `dataRangeSavePayload.js` | 透传记忆里的 `weekWork*`，避免冲掉后端已存值 |
| `tests/weekWorkModel.test.mjs` | 18 例全绿（含 payload 透传） |

## 验证

```
apps/web: node --test picker/tests/weekWorkModel.test.mjs picker/tests/dataRangeSavePayload.test.mjs
→ 18 pass / 0 fail
pnpm exec vue-tsc --noEmit → 无本功能相关报错
```

未登录，没在浏览器里点开「选择数据范围」弹窗做目视。本地 Vite 在 6174（6173 已被占用）。

## 待办 / 阻塞

- (web) 打开弹窗目视：一级 tab、全部树（含团队工作）、关注/所属/主管扁平列表、已选分组、清空
- (web) 周工作候选接口未到，tab 常显 + mock；接口到了改为 `dataRangeList` type=5 choose=1 才显示
- (web) 确定暂不写 `weekWorkScopeList`，等接口；save 只透传记忆里已有的 weekWork*
- (web) 本功能改动未 commit

## 关键决策记录

- 2026-09-01 先做前端界面交互，接口后补；打开即显示周工作 tab
- 2026-09-01 所属、主管与关注同一套扁平列表
- 2026-09-01 周工作 key 用 `ww_{type}_{id}`，与知识聊天 key 隔离
- 2026-09-01 部门左勾选 = type 3（联动子孙人员）；「含团队工作」= type 2；底栏已选不计 type 3/4

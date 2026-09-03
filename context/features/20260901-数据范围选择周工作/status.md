# Status：选择数据范围 · 周工作

> 最后更新：2026-09-03 ｜ 图例：⬜ 未开始 · 🚧 进行中 · ✅ 完成 · ❌ 阻塞

## 平台矩阵

| 任务 | web | android | ios | desktop |
|------|-----|---------|-----|---------|
| 周工作 tab + 四级子 tab + mock 列表勾选 | 🚧 界面已写，待打开弹窗目视 | — | — | — |
| 已选底栏合并（知识聊天 + 周工作） | 🚧 代码已接，待目视 | — | — | — |
| save 透传记忆中的 weekWork* | ✅ 单测覆盖 | — | — | — |
| 周工作树真实接口 | 🚧 契约已落，接口模块已提交（`c4f7f87`），尚未接线 | — | — | — |
| dataRangeList type=5 控制 tab 显隐 | ⬜ 现常显 | — | — | — |
| 自测通过 | ⬜ 未在浏览器点开弹窗 | — | — | — |

android / ios / desktop 已内嵌 web 页，不单独做原生选择器。

## 本回合各端现状（code-status）

| 端 | 分支 | 同步 | 脏区 | 活跃功能 | 备注 |
|---|---|---|---|---|---|
| context | main | ahead | 脏(本功能契约) | **本功能** | 新增 `weekWorkDataRangeTree` 契约 |
| web | feat/data-range-week-work | 无 upstream | 干净 | **本功能** | 接口模块已提交 `c4f7f87`；分支另有重构与 release 合并，属 `20260903-数据范围选择组件合一` |
| desktop | feat/data-range-week-work | synced | 干净 | 本功能 | 未改 |
| 其余 | — | — | — | 其它活跃功能 | 本回合未改 |

## 本次改动

**context** 新增契约 `personalAiFrame/weekWorkDataRangeTree.d.ts`：`POST /corpPlateAccountRel/weekWorkDataRangeTree`。

一次返回四棵树（allTree / attentionTree / belongTree / manageTree）。前端必知口径写在 Changelog：Jackson 剥 `is` 前缀、`enableState=1` 自行拼「XXX团队工作」、团队/人员个数前端数节点、授权只在全部树、单企业跳过企业层。

## 待办 / 阻塞

- (web) 接线：`src/server/module/corpPlateAccountRel.js` 的 `getWeekWorkDataRangeTree` 已提交但无人调用，`WeekWorkPicker` 仍吃 `weekWorkMock.js`；接线时按契约把四棵树喂进去
- (web) 接真实接口：按 tab 取对应树，不重复调；`multiCorp=false` 时第一层用 `tree[0].corpPlateList`；attentionTree 平铺
- (web) 打开弹窗目视：全部胶囊才人+板块一起全选；其他 tab / 胶囊只勾当前列表
- (web) tab 显隐改为 `dataRangeList` type=5 choose=1 才显示（现常显）
- (web) 确定暂不写 `weekWorkScopeList`，等接口；save 只透传记忆里已有的 weekWork*
- (web) 新分支未 push，需要时 `git push -u origin feat/data-range-week-work`

## 关键决策记录

- 2026-09-01 先做前端界面交互，接口后补；打开即显示周工作 tab
- 2026-09-01 所属、主管与关注同一套扁平列表
- 2026-09-01 周工作 key 用 `ww_{type}_{id}`，与知识聊天 key 隔离
- 2026-09-01 组织图标用行动中心 PNG：团队工作 `mw-report`，部门/板块 `mw-dept`，名称含「组」`o5-group`
- 2026-09-02 表头全选：只有「全部」tab 的「全部」胶囊才人+含团队工作一起勾；其它只勾当前列表
- 2026-09-02 web 周工作改动从 `feat/data-scope-storage-group` 拆到 `feat/data-range-week-work`
- 2026-09-03 树接口契约落地：一次四棵树；授权只在 allTree；「XXX团队工作」前端拼接；team/person 计数前端数节点
